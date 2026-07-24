import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe.sequential("canvassing weekly workflow API", () => {
  const port = 43_000 + (process.pid % 1_000);
  const base = `http://127.0.0.1:${port}/api/canvassing`;
  let directory = "",
    server: ChildProcess;
  let routeId = "",
    sampleId = "",
    followupRouteId = "",
    conversationId = "",
    prospectId = "",
    areaId = "";
  let sourceHouseholds: string[] = [];

  async function startServer() {
    server = spawn(
      "node_modules/.bin/tsx",
      ["packages/canvassing/src/server.ts"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CANVASS_PORT: String(port),
          CANVASS_DB: join(directory, "canvassing.sqlite"),
          CANVASS_EVENT_LOG: join(directory, "events.jsonl"),
        },
        stdio: "ignore",
      },
    );
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        if ((await fetch(`${base}/state`)).ok) return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Disposable canvassing server did not start");
  }

  async function stopServer() {
    if (!server || server.exitCode != null) return;
    server.kill("SIGTERM");
    await new Promise<void>((resolve) => server.once("exit", () => resolve()));
  }

  async function request(path: string, value?: unknown, role = "candidate") {
    const response = await fetch(
      `${base}${path}`,
      value === undefined
        ? { headers: { "x-canvass-role": role } }
        : {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-canvass-role": role,
            },
            body: JSON.stringify(value),
          },
    );
    const data = await response.json();
    return { status: response.status, data };
  }

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "living-region-canvassing-m3-"));
    await startServer();
  }, 15_000);
  afterAll(async () => {
    await stopServer();
    await rm(directory, { recursive: true, force: true });
  });

  it("creates a completed flyer route and stable draft sample", async () => {
    const state = (await request("/state")).data;
    sourceHouseholds = state.households
      .slice(0, 12)
      .map((home: any) => home.household_id);
    const route = await request("/routes", {
      name: "Weekly flyer route",
      household_ids: sourceHouseholds,
    });
    routeId = route.data.id;
    for (const [index, householdId] of sourceHouseholds.entries()) {
      expect(
        (
          await request("/visits", {
            submission_key: `flyer-${index}`,
            household_id: householdId,
            route_id: routeId,
            outcome: "flyer_delivered",
            flyer_delivered: true,
            door_knocked: false,
          })
        ).status,
      ).toBe(201);
    }
    const sample = await request(`/routes/${routeId}/followup-sample`, {
      flyer_date: "2026-07-20",
      target_count: 5,
    });
    expect(sample.status).toBe(201);
    sampleId = sample.data.id;
    expect(sample.data.household_ids).toHaveLength(5);
    expect(sample.data.scheduled_for).toBe("2026-07-22");
  });

  it("persists manual overrides and locks the accepted route", async () => {
    let sample = (await request("/state")).data.followup_samples.find(
      (item: any) => item.id === sampleId,
    );
    const removed = sample.household_ids[0],
      included = sourceHouseholds.find(
        (id) => !sample.household_ids.includes(id),
      )!;
    sample = (
      await request(`/followup-samples/${sampleId}/override`, {
        type: "exclude",
        household_id: removed,
      })
    ).data;
    sample = (
      await request(`/followup-samples/${sampleId}/override`, {
        type: "include",
        household_id: included,
        position: 0,
      })
    ).data;
    const reversed = [...sample.household_ids].reverse();
    sample = (
      await request(`/followup-samples/${sampleId}/override`, {
        type: "reorder",
        household_ids: reversed,
      })
    ).data;
    expect(sample.household_ids).toEqual(reversed);
    expect(
      (
        await request(`/followup-samples/${sampleId}/schedule`, {
          scheduled_for: "2026-07-23",
        })
      ).data.scheduled_for,
    ).toBe("2026-07-23");
    const accepted = await request(`/followup-samples/${sampleId}/accept`, {});
    expect(accepted.status).toBe(201);
    followupRouteId = accepted.data.followup_route_id;
    expect(
      (
        await request(`/followup-samples/${sampleId}/override`, {
          type: "exclude",
          household_id: included,
        })
      ).status,
    ).toBe(409);
    expect(
      (await request(`/routes/${routeId}/followup-sample`, { target_count: 4 }))
        .status,
    ).toBe(409);
  });

  it("survives a server restart without changing the accepted sample", async () => {
    const before = (await request("/state")).data.followup_samples.find(
      (sample: any) => sample.id === sampleId,
    );
    await stopServer();
    await startServer();
    const after = (await request("/state")).data.followup_samples.find(
      (sample: any) => sample.id === sampleId,
    );
    expect(after.household_ids).toEqual(before.household_ids);
    expect(after.followup_route_id).toBe(followupRouteId);
    expect(after.status).toBe("accepted");
  });

  it("records area and household-associated neighbourhood conversations with volunteer redaction", async () => {
    const accepted = (await request("/state")).data.followup_samples.find(
      (sample: any) => sample.id === sampleId,
    );
    const conversation = await request("/neighbourhood-conversations", {
      submission_key: "conversation-1",
      lon: -80.943,
      lat: 44.567,
      issue_discussed: "Transit",
      political_outcome: "undecided",
      possible_local_representative: true,
      follow_up_requested: true,
      household_id: accepted.household_ids[0],
      route_id: followupRouteId,
      complete_household_attempt: true,
    });
    expect(conversation.status).toBe(201);
    conversationId = conversation.data.id;
    const areaConversation = await request("/neighbourhood-conversations", {
      submission_key: "conversation-2",
      lon: -80.944,
      lat: 44.568,
      issue_discussed: "Housing",
    });
    expect(areaConversation.data.household_id).toBeNull();
    expect(
      (await request("/state")).data.neighbourhood_conversations,
    ).toHaveLength(2);
    expect(
      (await request("/state", undefined, "volunteer")).data
        .neighbourhood_conversations,
    ).toEqual([]);
  });

  it("tracks ward recruitment and prospects sourced from conversations", async () => {
    const area = await request("/recruitment/areas", {
      name: "North weekly area",
    });
    areaId = area.data.id;
    const prospect = await request("/recruitment/prospects", {
      area_id: areaId,
      conversation_id: conversationId,
      role_interest: "local_representative",
    });
    prospectId = prospect.data.id;
    expect(
      (
        await request(`/recruitment/prospects/${prospectId}/status`, {
          status: "considering",
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await request(`/recruitment/areas/${areaId}/status`, {
          status: "candidate_confirmed",
        })
      ).status,
    ).toBe(201);
    const state = (await request("/state")).data;
    expect(
      state.recruitment_areas.find((area: any) => area.id === areaId).status,
    ).toBe("candidate_confirmed");
    expect(
      state.recruitment_prospects.find(
        (prospect: any) => prospect.id === prospectId,
      ).status,
    ).toBe("considering");
  });

  it("exposes focused address queues while keeping outside records out of routes", async () => {
    const state = (await request("/state")).data;
    expect(state.address_review_counts.outside_boundary).toBeGreaterThan(0);
    const outside = await request("/address-review?queue=outside_boundary");
    expect(
      outside.data.every(
        (record: any) =>
          record.within_boundary === 0 && record.address_id === null,
      ),
    ).toBe(true);
    expect(
      state.households.some((home: any) =>
        outside.data.some((record: any) => record.id === home.address_id),
      ),
    ).toBe(false);
  });
});

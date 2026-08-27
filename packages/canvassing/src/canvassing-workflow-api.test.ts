import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
  let sourceHouseholds: string[] = [],
    versionedHousehold = "";
  const testPassword = "canvassing-test-password";
  const cookies = new Map<string, string>();

  async function login(role: "candidate" | "volunteer" = "candidate") {
    const username = role === "volunteer" ? "rynaldo" : "andrii";
    const response = await fetch(`http://127.0.0.1:${port}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password: testPassword }),
    });
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
    expect(cookie).toBeTruthy();
    cookies.set(role, cookie!);
    return (await response.json()).user;
  }

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
          CANVASS_CALIBRATION_EXPORT: join(
            directory,
            "address-number-calibration.json",
          ),
          CANVASS_TEST_USERS: "1",
          CANVASS_TEST_PASSWORD: testPassword,
        },
        stdio: "ignore",
      },
    );
    for (let attempt = 0; attempt < 200; attempt++) {
      try {
        if ((await fetch(`http://127.0.0.1:${port}/api/canvassing/health`)).ok)
          return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Disposable canvassing server did not start");
  }

  async function stopServer() {
    if (!server || server.exitCode != null) return;
    server.kill("SIGTERM");
    await new Promise<void>((resolve) => server.once("exit", () => resolve()));
  }

  async function request(
    path: string,
    value?: unknown,
    role = "candidate",
    method = "POST",
  ) {
    if (!cookies.has(role === "volunteer" ? "volunteer" : "candidate"))
      await login(role === "volunteer" ? "volunteer" : "candidate");
    const cookie = cookies.get(role === "volunteer" ? "volunteer" : "candidate")!;
    const response = await fetch(
      `${base}${path}`,
      value === undefined
        ? { headers: { cookie } }
        : {
            method,
            headers: {
              "content-type": "application/json",
              cookie,
            },
            body: JSON.stringify(value),
          },
    );
    const data = await response.json();
    return { status: response.status, data };
  }
  async function requestText(path: string, role = "candidate") {
    if (!cookies.has(role === "volunteer" ? "volunteer" : "candidate"))
      await login(role === "volunteer" ? "volunteer" : "candidate");
    const response = await fetch(`${base}${path}`, {
      headers: { cookie: cookies.get(role === "volunteer" ? "volunteer" : "candidate")! },
    });
    return { status: response.status, text: await response.text() };
  }

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "living-region-canvassing-m3-"));
    await startServer();
  }, 60_000);
  afterAll(async () => {
    await stopServer();
    await rm(directory, { recursive: true, force: true });
  });

  it("appends civic-number corrections and creates a household for an unlinked roof", async () => {
    const before = (await request("/state")).data,
      linkedStructures = new Set(
        before.households.map((home: any) => home.structure_id).filter(Boolean),
      ),
      structures = JSON.parse(
        await readFile(
          "packages/web-client/public/canvassing/structures.geojson",
          "utf8",
        ),
      ),
      unlinked = structures.features.find(
        (feature: any) =>
          !linkedStructures.has(feature.properties.structure_id),
      );
    expect(unlinked).toBeTruthy();
    const correction = await request(
      `/structures/${unlinked.properties.structure_id}/civic-number`,
      {
        civic_number: "1234",
        street: "Test Street",
        reason: "field verified",
      },
    );
    expect(correction.status).toBe(201);
    const after = (await request("/state")).data,
      created = after.households.find(
        (home: any) => home.structure_id === unlinked.properties.structure_id,
      );
    expect(after.schema_version).toBe(20);
    expect(created).toMatchObject({
      civic_number: "1234",
      street: "Test Street",
      label: "1234 Test Street",
      number_corrected: 1,
    });
    const calibration = JSON.parse(
      await readFile(
        join(directory, "address-number-calibration.json"),
        "utf8",
      ),
    );
    expect(calibration.records).toContainEqual(
      expect.objectContaining({
        address_id: created.address_id,
        structure_id: unlinked.properties.structure_id,
        civic_number: "1234",
        street: "Test Street",
      }),
    );
  });

  it("accepts and safely reverses a persistent frontage split", async () => {
    const before = (await request("/state")).data,
      structures = JSON.parse(
        await readFile(
          "packages/web-client/public/canvassing/structures.geojson",
          "utf8",
        ),
      ),
      candidate = structures.features.find(
        (feature: any) =>
          Number(feature.properties.area_m2) >= 120 &&
          Number(feature.properties.area_m2) <= 500 &&
          before.households.some(
            (home: any) =>
              home.structure_id === feature.properties.structure_id,
          ),
      );
    expect(candidate).toBeTruthy();
    const preview = await request(
      `/structures/${candidate.properties.structure_id}/split/preview`,
      { method: "frontage", unit_count: 2, rotate: false },
    );
    expect(preview.status).toBe(200);
    expect(preview.data.children).toHaveLength(2);
    const accepted = await request(
      `/structures/${candidate.properties.structure_id}/split`,
      {
        submission_key: `split-${candidate.properties.structure_id}`,
        method: "frontage",
        unit_count: 2,
        rotate: false,
        reference_address_ids:
          candidate.properties.address_reference_ids ?? [],
      },
    );
    expect(accepted.status).toBe(201);
    expect(accepted.data.children).toHaveLength(2);
    const overlay = await request("/structure-splits");
    expect(overlay.data.hidden_parent_ids).toContain(
      candidate.properties.structure_id,
    );
    expect(overlay.data.features).toHaveLength(2);
    const after = (await request("/state")).data;
    expect(
      after.households.some((home: any) =>
        accepted.data.children.some(
          (child: any) => child.id === home.structure_id,
        ),
      ),
    ).toBe(true);
    const child = accepted.data.children[0],
      nestedPreview = await request(
        `/structures/${child.id}/split/preview`,
        { method: "frontage", unit_count: 2, rotate: false },
      );
    expect(nestedPreview.status).toBe(200);
    expect(nestedPreview.data.children).toHaveLength(2);
    const nested = await request(`/structures/${child.id}/split`, {
      submission_key: `nested-split-${child.id}`,
      method: "frontage",
      unit_count: 2,
      rotate: false,
    });
    expect(nested.status).toBe(201);
    const refinedOverlay = await request("/structure-splits");
    expect(refinedOverlay.data.hidden_parent_ids).toEqual(
      expect.arrayContaining([candidate.properties.structure_id, child.id]),
    );
    expect(refinedOverlay.data.features).toHaveLength(3);
    expect(
      refinedOverlay.data.features.some(
        (feature: any) => feature.properties.structure_id === child.id,
      ),
    ).toBe(false);
    expect(
      (await request(`/structures/${candidate.properties.structure_id}/split/reverse`, {}))
        .status,
    ).toBe(409);
    expect(
      (await request(`/structures/${child.id}/split/reverse`, {})).status,
    ).toBe(201);
    const reversed = await request(
      `/structures/${candidate.properties.structure_id}/split/reverse`,
      {},
    );
    expect(reversed.status).toBe(201);
    const collapsed = (await request("/state")).data;
    expect(
      collapsed.households.some(
        (home: any) =>
          home.structure_id === candidate.properties.structure_id,
      ),
    ).toBe(true);
    expect((await request("/structure-splits")).data.features).toHaveLength(0);
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

  it("tracks flyer versions, warns on repeats, and preserves delivery history", async () => {
    const before = (await request("/state")).data,
      flyerOne = before.flyers.find((flyer: any) => flyer.id === "flyer-1-original"),
      flyerTwo = before.flyers.find((flyer: any) => flyer.id === "flyer-2-current");
    expect(flyerOne).toMatchObject({ short_name: "Flyer 1: Original flyer" });
    expect(flyerTwo).toMatchObject({
      short_name: "A City That Works for Residents",
    });
    expect(
      (await request("/flyers/flyer-2-current", {
        short_name: "Spring information flyer",
        description: "Field test version",
        introduction_date: "2026-08-12",
        active: true,
      }, "candidate", "PATCH")).status,
    ).toBe(200);
    versionedHousehold = before.households.find(
      (home: any) => !home.flyer_delivered,
    ).household_id;
    const first = await request("/visits", {
      submission_key: "versioned-flyer-first",
      household_id: versionedHousehold,
      outcome: "flyer_delivered",
      flyer_delivered: true,
      flyer_id: "flyer-2-current",
      door_knocked: false,
    });
    expect(first.status).toBe(201);
    expect(first.data.flyer_id).toBe("flyer-2-current");
    const duplicate = await request("/visits", {
      submission_key: "versioned-flyer-duplicate",
      household_id: versionedHousehold,
      outcome: "flyer_delivered",
      flyer_delivered: true,
      flyer_id: "flyer-2-current",
      door_knocked: false,
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.data.duplicate).toBe(true);
    const override = await request("/visits", {
      submission_key: "versioned-flyer-override",
      household_id: versionedHousehold,
      outcome: "flyer_delivered",
      flyer_delivered: true,
      flyer_id: "flyer-2-current",
      allow_duplicate_flyer: true,
      door_knocked: false,
    });
    expect(override.status).toBe(201);
    const after = (await request("/state")).data,
      household = after.households.find(
        (home: any) => home.household_id === versionedHousehold,
      ),
      flyerSummary = after.summary.flyer_breakdown.find(
        (row: any) => row.flyer_id === "flyer-2-current",
      );
    expect(household.flyer_history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          flyer_id: "flyer-2-current",
          flyer_name: "Spring information flyer",
        }),
      ]),
    );
    expect(household.flyer_ids).toContain("flyer-2-current");
    expect(flyerSummary).toMatchObject({ delivery_count: 2, household_count: 1 });
    expect(after.summary.unknown_flyer_deliveries).toBe(0);
    expect(after.summary.households_receiving_both_flyers).toBe(0);
    const routeExport = await requestText("/export/routes.csv");
    expect(routeExport.status).toBe(200);
    expect(routeExport.text.split("\n", 1)[0]).toContain("flyer_versions");
    expect(await readFile(join(directory, "events.jsonl"), "utf8")).toContain(
      '"flyer_id":"flyer-2-current"',
    );
  });

  it("records flyer, conversation, revisit, and political outcome together", async () => {
    const visit = await request("/visits", {
      submission_key: "combined-visit",
      household_id: sourceHouseholds[0],
      route_id: routeId,
      outcome: "supportive",
      flyer_delivered: true,
      flyer_id: "flyer-1-original",
      allow_duplicate_flyer: true,
      door_knocked: true,
      conversation_occurred: true,
      revisit_requested: true,
      no_answer: false,
    });
    expect(visit.status).toBe(201);
    expect(visit.data).toMatchObject({
      outcome: "supportive",
      flyer_delivered: true,
      door_knocked: true,
      conversation_occurred: true,
      revisit_requested: true,
      no_answer: false,
    });
    const state = (await request("/state")).data,
      household = state.households.find(
        (home: any) => home.household_id === sourceHouseholds[0],
      );
    expect(household.status).toBe("revisit");
    expect(household.political_outcome).toBe("supportive");
    expect(state.summary.revisits).toBeGreaterThanOrEqual(1);
    expect(state.summary.supporters).toBeGreaterThanOrEqual(1);
    expect(state.summary.conversations).toBeGreaterThanOrEqual(1);
  });

  it("removes flyer state without removing a conversation or visit", async () => {
    const householdId = sourceHouseholds[0],
      before = (await request("/state")).data,
      homeBefore = before.households.find(
        (home: any) => home.household_id === householdId,
      ),
      flyerTotal = Number(before.summary.flyers_delivered),
      corrected = await request(`/households/${householdId}/flyer-status`, {
        flyer_delivered: false,
        reason: "field correction",
      });
    expect(corrected.status).toBe(201);
    const after = (await request("/state")).data,
      homeAfter = after.households.find(
        (home: any) => home.household_id === householdId,
      );
    expect(homeBefore).toMatchObject({
      flyer_delivered: 1,
      conversation_occurred: 1,
    });
    expect(homeAfter).toMatchObject({
      flyer_delivered: 0,
      conversation_occurred: 1,
      status: "revisit",
      visit_count: homeBefore.visit_count,
    });
    expect(Number(after.summary.flyers_delivered)).toBe(flyerTotal - 1);
  });

  it("appends private contact details and mailing-list consent", async () => {
    const householdId = sourceHouseholds[1],
      household = (await request("/state")).data.households.find(
        (home: any) => home.household_id === householdId,
      );
    expect((await request(`/households/${householdId}/contacts`)).data).toEqual(
      [],
    );
    const created = await request(`/households/${householdId}/contacts`, {
      name: "Alex Example",
      phone: "519-555-0101",
      email: "alex@example.test",
      mailing_list_consent: true,
      source: "candidate",
    });
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({
      name: "Alex Example",
      phone: "519-555-0101",
      email: "alex@example.test",
      mailing_list_consent: true,
      civic_number: household.civic_number,
      street: household.street,
      address_label: `${household.civic_number} ${household.street}`,
    });
    const updated = await request(`/households/${householdId}/contacts`, {
      person_id: created.data.person_id,
      name: "Alex Example",
      phone: "519-555-0102",
      email: "alex@example.test",
      mailing_list_consent: false,
      source: "manual_correction",
    });
    expect(updated.status).toBe(201);
    expect(
      (await request(`/households/${householdId}/contacts`)).data,
    ).toContainEqual(
      expect.objectContaining({
        person_id: created.data.person_id,
        phone: "519-555-0102",
        mailing_list_consent: 0,
        civic_number: household.civic_number,
        street: household.street,
      }),
    );
    expect(
      (await request(`/households/${householdId}/contacts`, undefined, "volunteer"))
        .status,
    ).toBe(403);
  });

  it("serializes concurrent journal writes from bulk flyer delivery", async () => {
    const state = (await request("/state")).data,
      households = state.households.slice(20, 28);
    const results = await Promise.all(
      households.map((home: any, index: number) =>
        request("/visits", {
          submission_key: `concurrent-flyer-${index}`,
          household_id: home.household_id,
          outcome: "flyer_delivered",
          flyer_delivered: true,
          door_knocked: false,
          source: "candidate",
        }),
      ),
    );
    expect(results.every((result) => result.status === 201)).toBe(true);
    const rows = (await readFile(join(directory, "events.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(new Set(rows.map((row) => row.sequence)).size).toBe(rows.length);
    for (let index = 1; index < rows.length; index++)
      expect(rows[index].previous_hash).toBe(rows[index - 1].event_hash);
  });

  it("reports the latest household update date and preserves an override", async () => {
    const before = (await request("/state")).data,
      home = before.households[100],
      occurredAt = "2026-07-03T12:00:00.000Z",
      visit = await request("/visits", {
        submission_key: "manual-visit-date",
        household_id: home.household_id,
        occurred_at: occurredAt,
        outcome: "flyer_delivered",
        flyer_delivered: true,
        door_knocked: false,
        source: "candidate",
      });
    expect(visit.status).toBe(201);
    const updated = (await request("/state")).data.households.find(
      (candidate: any) => candidate.household_id === home.household_id,
    );
    expect(updated.last_updated_at).toBe(occurredAt);
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

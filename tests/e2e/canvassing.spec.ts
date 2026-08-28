import { expect, test, type Page } from "playwright/test";

const MAP_STARTUP_TIMEOUT = 120_000;

async function waitForMapReady(page: Page) {
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({
    timeout: MAP_STARTUP_TIMEOUT,
  });
  await page.waitForFunction(
    () => Boolean((window as any).__livingRegionCanvassing?.map?.isStyleLoaded()),
    undefined,
    { timeout: MAP_STARTUP_TIMEOUT },
  );
}

async function openCanvassing(page: Page, width = 390, height = 844) {
  await page.setViewportSize({ width, height });
  await page.goto("/canvassing/?e2e=1", { waitUntil: "domcontentloaded" });
  await loginIfNeeded(page);
  await waitForMapReady(page);
  await page.waitForTimeout(1_000);
}

async function loginIfNeeded(page: Page, username = "andrii") {
  await page.waitForSelector("#login-form, .maplibregl-canvas", {
    timeout: MAP_STARTUP_TIMEOUT,
  });
  if (!(await page.locator("#login-form").count())) return;
  await page.locator("#login-username").fill(username);
  await page.locator("#login-password").fill("canvassing-test-password");
  await page.locator("#login-form button[type=submit]").click();
  await expect(page.locator("#login-form")).toHaveCount(0);
}

async function roofPoints(
  page: Page,
  count = 2,
  requireNoConversation = false,
) {
  return page.evaluate(({ wanted, requireNoConversation }) => {
    const map = (window as any).__livingRegionCanvassing.map;
    const state = (window as any).__livingRegionCanvassing.state();
    const noConversationStructures = new Set(
      state.households
        .filter(
          (home: any) =>
            !home.conversation_occurred &&
            !home.political_outcome &&
            !home.revisit_requested,
        )
        .map((home: any) => String(home.structure_id)),
    );
    const container = map.getContainer().getBoundingClientRect();
    const features = map
      .queryRenderedFeatures({ layers: ["structures"] })
      .filter(
        (feature: any) =>
          Number(feature.properties?.household_count) === 1 &&
          (!requireNoConversation ||
            noConversationStructures.has(String(feature.properties?.structure_id))),
      );
    const points: Array<{ id: string; x: number; y: number }> = [];
    const seen = new Set<string>();
    for (const feature of features) {
      const id = String(feature.properties.structure_id);
      if (seen.has(id)) continue;
      const coordinates: Array<[number, number]> = [];
      const walk = (value: any) => {
        if (typeof value?.[0] === "number") coordinates.push(value as [number, number]);
        else value?.forEach(walk);
      };
      walk(feature.geometry.coordinates);
      if (!coordinates.length) continue;
      const projected = coordinates.map((coordinate) => map.project(coordinate));
      const minX = Math.min(...projected.map((point: any) => point.x));
      const maxX = Math.max(...projected.map((point: any) => point.x));
      const minY = Math.min(...projected.map((point: any) => point.y));
      const maxY = Math.max(...projected.map((point: any) => point.y));
      const mean = projected.reduce(
        (sum: any, point: any) => ({ x: sum.x + point.x, y: sum.y + point.y }),
        { x: 0, y: 0 },
      );
      const candidates = [
        { x: mean.x / projected.length, y: mean.y / projected.length },
        { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
        ...[0.2, 0.4, 0.6, 0.8].flatMap((xFactor) =>
          [0.2, 0.4, 0.6, 0.8].map((yFactor) => ({
            x: minX + (maxX - minX) * xFactor,
            y: minY + (maxY - minY) * yFactor,
          })),
        ),
      ];
      const clickable = candidates.find((candidate) => {
        if (
          candidate.x < 0 ||
          candidate.y < 0 ||
          candidate.x > map.getCanvas().width ||
          candidate.y > map.getCanvas().height
        )
          return false;
        const hits = map.queryRenderedFeatures([candidate.x, candidate.y], {
          layers: ["structures"],
        });
        return (
          String(hits[0]?.properties?.structure_id) === id &&
          Number(hits[0]?.properties?.household_count) > 0
        );
      });
      if (!clickable) continue;
      if (
        points.some(
          (point) => Math.hypot(point.x - clickable.x, point.y - clickable.y) < 24,
        )
      )
        continue;
      points.push({
        id,
        x: container.left + clickable.x,
        y: container.top + clickable.y,
      });
      seen.add(id);
      if (points.length >= wanted) break;
    }
    return points;
  }, { wanted: count, requireNoConversation });
}

async function clickRoofs(page: Page, count = 2) {
  await page.waitForFunction(
    (wanted) =>
      ((window as any).__livingRegionCanvassing?.map?.queryRenderedFeatures({
        layers: ["structures"],
      }) ?? []).filter(
        (feature: any) => Number(feature.properties?.household_count) > 0,
      ).length >= wanted,
    count,
    { timeout: 30_000 },
  );
  const points = await roofPoints(page, Math.max(count * 12, 24));
  expect(points.length).toBeGreaterThanOrEqual(count);
  for (const point of points) {
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(80);
    const status = await page.locator("#bulk-selection-status").textContent();
    const selected = Number(status?.match(/(\d+) household/)?.[1] ?? 0);
    if (selected >= count) return;
  }
  const status = await page.locator("#bulk-selection-status").textContent();
  expect(status).toContain(`${count} household`);
}

type RenderedRoofPoint = {
  id: string;
  x: number;
  y: number;
  householdCount: number;
  targetIds: string[];
  flyerIds: string[];
  targetKind: string;
  hasAuthoritativeAddress: boolean;
  hasReferenceAddress: boolean;
};

async function renderedCanvassableRoofPoints(
  page: Page,
  wanted: number,
): Promise<RenderedRoofPoint[]> {
  return page.evaluate((requested) => {
    const map = (window as any).__livingRegionCanvassing.map;
    const state = (window as any).__livingRegionCanvassing.state();
    const canvas = map.getCanvas().getBoundingClientRect();
    const features = map
      .queryRenderedFeatures({ layers: ["structures"] })
      .filter(
        (feature: any) =>
          feature.properties?.canvassable &&
          feature.properties?.selection_target_id &&
          Number(feature.properties?.household_count) > 0,
      );
    const points: Array<{
      id: string;
      x: number;
      y: number;
      householdCount: number;
      flyerIds: string[];
      targetKind: string;
      hasAuthoritativeAddress: boolean;
      hasReferenceAddress: boolean;
    }> = [];
    const seen = new Set<string>();
    for (const feature of features) {
      const properties = feature.properties ?? {};
      const id = String(properties.structure_id ?? "");
      if (!id || seen.has(id)) continue;
      // The structure source is intentionally static.  Its flyer_ids can be
      // stale for a moment after an earlier ordered test has recorded a visit
      // or a history projection has attached activity to the physical roof.
      // Use the live state as well when choosing untouched roofs for this
      // write scenario; otherwise the test can select a roof that is already
      // covered and mistake duplicate protection for a selection failure.
      const stateFlyerIds = state.households
        .filter((home: any) => home.structure_id === id)
        .flatMap((home: any) => home.flyer_ids ?? [])
        .map(String);
      const coordinates: Array<[number, number]> = [];
      const walk = (value: any) => {
        if (typeof value?.[0] === "number") coordinates.push(value);
        else value?.forEach(walk);
      };
      walk(feature.geometry?.coordinates);
      if (!coordinates.length) continue;
      const projected = coordinates.map((coordinate) => map.project(coordinate));
      const minX = Math.min(...projected.map((point: any) => point.x));
      const maxX = Math.max(...projected.map((point: any) => point.x));
      const minY = Math.min(...projected.map((point: any) => point.y));
      const maxY = Math.max(...projected.map((point: any) => point.y));
      const mean = projected.reduce(
        (sum: any, point: any) => ({ x: sum.x + point.x, y: sum.y + point.y }),
        { x: 0, y: 0 },
      );
      const candidates = [
        { x: mean.x / projected.length, y: mean.y / projected.length },
        { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
        ...[0.2, 0.4, 0.6, 0.8].flatMap((xFactor) =>
          [0.2, 0.4, 0.6, 0.8].map((yFactor) => ({
            x: minX + (maxX - minX) * xFactor,
            y: minY + (maxY - minY) * yFactor,
          })),
        ),
      ];
      const clickable = candidates.find((candidate) => {
        const pageX = canvas.left + candidate.x;
        const pageY = canvas.top + candidate.y;
        if (
          candidate.x < 0 ||
          candidate.y < 0 ||
          candidate.x > map.getCanvas().width ||
          candidate.y > map.getCanvas().height ||
          pageY < 90 ||
          pageY > window.innerHeight - 105
        )
          return false;
        // queryRenderedFeatures can see through the fixed mobile selection
        // bar. Require the actual page point to be on the MapLibre canvas so
        // page.mouse.click() cannot be swallowed by a button or overlay.
        if (document.elementFromPoint(pageX, pageY) !== map.getCanvas())
          return false;
        const hits = map.queryRenderedFeatures([candidate.x, candidate.y], {
          layers: ["structures"],
        });
        return (
          String(hits[0]?.properties?.structure_id) === id &&
          Boolean(hits[0]?.properties?.selection_target_id)
        );
      });
      if (!clickable) continue;
      if (
        points.some(
          (point) =>
            Math.hypot(
              point.x - (canvas.left + clickable.x),
              point.y - (canvas.top + clickable.y),
            ) < 14,
        )
      )
        continue;
      const targetIds = Array.isArray(properties.selection_target_ids)
        ? properties.selection_target_ids.map(String)
        : typeof properties.selection_target_ids === "string"
          ? (() => {
              try {
                const parsed = JSON.parse(properties.selection_target_ids);
                return Array.isArray(parsed) ? parsed.map(String) : [];
              } catch {
                return [];
              }
            })()
          : [];
      if (!targetIds.length && properties.selection_target_id)
        targetIds.push(String(properties.selection_target_id));
      points.push({
        id,
        x: canvas.left + clickable.x,
        y: canvas.top + clickable.y,
        householdCount: Number(properties.household_count),
        targetIds,
        flyerIds: Array.isArray(properties.flyer_ids)
          ? [...new Set([...properties.flyer_ids, ...stateFlyerIds].map(String))]
          : [...new Set(stateFlyerIds)],
        targetKind: String(properties.selection_target_kind ?? ""),
        hasAuthoritativeAddress:
          Array.isArray(properties.authoritative_address_ids) &&
          properties.authoritative_address_ids.length > 0,
        hasReferenceAddress:
          Array.isArray(properties.address_reference_ids) &&
          properties.address_reference_ids.length > 0,
      });
      seen.add(id);
      if (points.length >= requested) break;
    }
    return points;
  }, wanted);
}

type RenderedUnlinkedRoofPoint = {
  id: string;
  x: number;
  y: number;
  properties: Record<string, unknown>;
};

/**
 * Deliberately finds the path that used to be omitted from the bulk test:
 * rendered residential roof features with no household rows yet. The
 * selection target property is still required; the click must exercise the
 * real operational-target materialization path.
 */
async function renderedUnlinkedRoofPoints(
  page: Page,
  wanted: number,
): Promise<RenderedUnlinkedRoofPoint[]> {
  return page.evaluate((requested) => {
    const map = (window as any).__livingRegionCanvassing.map;
    const canvas = map.getCanvas().getBoundingClientRect();
    const features = map
      .queryRenderedFeatures({ layers: ["structures"] })
      .filter(
        (feature: any) =>
          Boolean(feature.properties?.canvassable) &&
          Boolean(feature.properties?.selection_target_id) &&
          Number(feature.properties?.household_count) === 0,
      );
    const points: RenderedUnlinkedRoofPoint[] = [];
    const seen = new Set<string>();
    for (const feature of features) {
      const properties = feature.properties ?? {};
      const id = String(properties.structure_id ?? "");
      if (!id || seen.has(id)) continue;
      const coordinates: Array<[number, number]> = [];
      const walk = (value: any) => {
        if (typeof value?.[0] === "number") coordinates.push(value);
        else value?.forEach(walk);
      };
      walk(feature.geometry?.coordinates);
      if (!coordinates.length) continue;
      const projected = coordinates.map((coordinate) => map.project(coordinate));
      const minX = Math.min(...projected.map((point: any) => point.x));
      const maxX = Math.max(...projected.map((point: any) => point.x));
      const minY = Math.min(...projected.map((point: any) => point.y));
      const maxY = Math.max(...projected.map((point: any) => point.y));
      const mean = projected.reduce(
        (sum: any, point: any) => ({ x: sum.x + point.x, y: sum.y + point.y }),
        { x: 0, y: 0 },
      );
      const candidates = [
        { x: mean.x / projected.length, y: mean.y / projected.length },
        { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
        ...[0.2, 0.4, 0.6, 0.8].flatMap((xFactor) =>
          [0.2, 0.4, 0.6, 0.8].map((yFactor) => ({
            x: minX + (maxX - minX) * xFactor,
            y: minY + (maxY - minY) * yFactor,
          })),
        ),
      ];
      const clickable = candidates.find((candidate) => {
        const pageY = canvas.top + candidate.y;
        if (
          candidate.x < 0 ||
          candidate.y < 0 ||
          candidate.x > canvas.width ||
          candidate.y > canvas.height ||
          pageY < 90 ||
          pageY > window.innerHeight - 105
        )
          return false;
        if (document.elementFromPoint(canvas.left + candidate.x, pageY) !== map.getCanvas())
          return false;
        const hits = map.queryRenderedFeatures([candidate.x, candidate.y], {
          layers: ["structures"],
        });
        return (
          String(hits[0]?.properties?.structure_id) === id &&
          Number(hits[0]?.properties?.household_count) === 0
        );
      });
      if (!clickable) continue;
      if (
        points.some(
          (point) =>
            Math.hypot(
              point.x - (canvas.left + clickable.x),
              point.y - (canvas.top + clickable.y),
            ) < 14,
        )
      )
        continue;
      points.push({
        id,
        x: canvas.left + clickable.x,
        y: canvas.top + clickable.y,
        properties: { ...properties },
      });
      seen.add(id);
      if (points.length >= requested) break;
    }
    return points;
  }, wanted);
}

test.describe("Owen Sound canvassing field workflows", () => {
  test("coverage mode is the default after a temporary bulk-view preference", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "living-region.canvassing.field-state",
        JSON.stringify({ coverage_mode: false, multi_select: false }),
      );
    });
    await openCanvassing(page);
    await expect(page.locator("#coverage-toggle")).toHaveText("Households");
    await expect(page.locator("#mobile-next-area")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("mobile next area opens its diagnostic popup", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/canvassing/?e2e=1", { waitUntil: "domcontentloaded" });
    await loginIfNeeded(page);
    await expect(page.locator("#mobile-next-area")).toBeVisible({
      timeout: 30_000,
    });
    const serverResult = await page.evaluate(async () => {
      const response = await fetch("/api/canvassing/next-area");
      return response.json();
    });
    expect(serverResult).toHaveProperty("recommendation");
    expect(serverResult).toHaveProperty("calculation_ms");
    await page.locator("#mobile-next-area").click();
    await expect(page.locator(".maplibregl-popup")).toContainText(
      "Next underflyered area",
      { timeout: 30_000 },
    );
    await expect(page.locator(".maplibregl-popup")).toContainText(
      "Local remaining",
    );
    await expect(page.locator(".maplibregl-popup")).toContainText(
      "nearest 300",
    );
    await expect(page.locator(".maplibregl-popup")).toContainText(
      "nearest 600",
    );
    await expect(page.locator(".maplibregl-popup")).toContainText(
      "Broad undercoverage score",
    );
  });

  test("mobile bulk delivery selects roofs, requires a flyer, and marks them", async ({
    page,
  }) => {
    await openCanvassing(page);
    await page.locator("#mobile-menu").click();
    await page.locator("#mobile-bulk-open").click();
    await expect(page.locator("#multi-select")).toHaveText("Done selecting");
    await expect(page.locator("#coverage-toggle")).toHaveText("Coverage");
    await expect(page.locator("#mobile-next-area")).toBeVisible({
      timeout: 30_000,
    });
    await clickRoofs(page, 2);
    await expect(page.locator("#bulk-selection-status")).toContainText(
      "2 households selected",
    );
    await page.locator("#bulk-flyer").click();
    await expect(page.locator("#mobile-menu-sheet")).toBeVisible();
    await expect(page.locator("#toast")).toContainText("Choose an active flyer");
    await page.locator("#mobile-active-flyer").selectOption("flyer-2-current");
    await page.locator("#mobile-menu-close").click();
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForMapReady(page);
    await page.locator("#mobile-menu").click();
    await expect(page.locator("#mobile-active-flyer")).toHaveValue(
      "flyer-2-current",
    );
    await page.locator("#mobile-menu-close").click();
    await expect(page.locator("#bulk-selection-status")).toContainText(
      "2 households selected",
    );

    await page.locator("#bulk-flyer").click();
    await expect(page.locator("#toast")).toContainText("marked flyer delivered", {
      timeout: 10_000,
    });
    await expect(page.locator("#coverage-toggle")).toHaveText("Households");
    const summary = await page.evaluate(async () => {
      const state = await fetch("/api/canvassing/state").then((response) =>
        response.json(),
      );
      return state.summary.flyer_breakdown.find(
        (row: any) => row.flyer_id === "flyer-2-current",
      );
    });
    expect(summary.delivery_count).toBe(2);
    expect(summary.household_count).toBe(2);
  });

  test("mobile can record a visit without selecting a flyer", async ({ page }) => {
    test.setTimeout(180_000);
    await openCanvassing(page);
    await page.locator("#mobile-menu").click();
    await page.locator("#mobile-bulk-open").click();
    await page.locator("#multi-select").click();
    await page.evaluate(() => {
      (window as any).__livingRegionCanvassing.map.jumpTo({ zoom: 15.5 });
    });
    await page.waitForFunction(
      () =>
        ((window as any).__livingRegionCanvassing?.map?.queryRenderedFeatures({
          layers: ["structures"],
        }) ?? []).some(
          (feature: any) => Number(feature.properties?.household_count) > 0,
        ),
      undefined,
      { timeout: 30_000 },
    );
    const [point] = await roofPoints(page, 1, true);
    expect(point).toBeTruthy();
    await page.mouse.click(point.x, point.y);
    await expect(page.locator("#drawer")).toHaveClass(/mobile-open/);
    await page.locator("#visit-talked").evaluate((element) => {
      const input = element as HTMLInputElement;
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(page.locator("#visit-talked")).toBeChecked();
    await page.locator("#save-visit").click({ force: true });
    await expect(page.locator("#toast")).toContainText("Household status updated", {
      timeout: 60_000,
    });
    const summary = await page.evaluate(async () =>
      fetch("/api/canvassing/state").then((response) => response.json()),
    );
    expect(Number(summary.summary.conversations)).toBeGreaterThanOrEqual(1);
  });

  test("bulk flyer selects previously unlinked and review-marked roofs through the real map UI", async ({
    page,
  }, testInfo) => {
    test.setTimeout(300_000);
    const consoleOutput: string[] = [];
    const networkOutput: string[] = [];
    const dialogs: string[] = [];
    page.on("console", (message) =>
      consoleOutput.push(`${message.type()}: ${message.text()}`),
    );
    page.on("pageerror", (error) =>
      consoleOutput.push(`pageerror: ${error.message}`),
    );
    page.on("response", (response) => {
      if (response.url().includes("/api/canvassing/"))
        networkOutput.push(`${response.status()} ${response.url()}`);
    });
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });

    await openCanvassing(page, 390, 844);
    const fixtureResponse = await page.evaluate(async () => {
      const response = await fetch("/api/canvassing/test/bulk-fixture", {
        method: "POST",
      });
      return { status: response.status, body: await response.json() };
    });
    expect(fixtureResponse.status).toBe(200);
    const fixture = fixtureResponse.body as {
      review_structure_id: string;
      needs_review_structure_id: string;
      review_household_id: string;
      needs_review_household_id: string;
      unlinked_structure_ids: string[];
      unlinked_household_ids: string[];
      previously_flyered_household_id: string;
    };
    expect(fixture.unlinked_structure_ids.length).toBeGreaterThanOrEqual(10);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForMapReady(page);
    await page.locator("#mobile-menu").click();
    await page.locator("#mobile-active-flyer").selectOption("flyer-2-current");
    await page.locator("#mobile-bulk-open").click();
    await expect(page.locator("#multi-select")).toHaveText("Done selecting");
    await page.evaluate(() => {
      (window as any).__livingRegionCanvassing.map.jumpTo({
        center: [-80.943, 44.567],
        zoom: 15.5,
      });
    });
    await page.waitForTimeout(700);

    const initialInvariant = await page.evaluate(() => {
      const map = (window as any).__livingRegionCanvassing.map;
      const roofs = map
        .queryRenderedFeatures({ layers: ["structures"] })
        .filter((feature: any) => feature.properties?.canvassable);
      return {
        rendered: roofs.length,
        missingTarget: roofs.filter(
          (feature: any) => !feature.properties?.selection_target_id,
        ).length,
        unlinked: roofs.filter(
          (feature: any) => Number(feature.properties?.household_count) === 0,
        ).length,
      };
    });
    expect(initialInvariant.rendered).toBeGreaterThanOrEqual(20);
    expect(initialInvariant.missingTarget).toBe(0);
    const unlinked = await renderedUnlinkedRoofPoints(page, 10);
    expect(unlinked.length, JSON.stringify(unlinked)).toBeGreaterThanOrEqual(10);
    expect(
      unlinked.every((roof) => fixture.unlinked_structure_ids.includes(roof.id)),
    ).toBe(true);
    await testInfo.attach("initial-unlinked-roofs.json", {
      body: JSON.stringify(unlinked, null, 2),
      contentType: "application/json",
    });
    let selectedHouseholds = 0;
    const selectedStructureIds = new Set<string>();
    for (const roof of unlinked) {
      selectedStructureIds.add(roof.id);
      await page.mouse.click(roof.x, roof.y);
      selectedHouseholds += 1;
      try {
        await expect
          .poll(async () =>
            Number(
              (await page.locator("#bulk-selection-status").textContent())?.match(
                /(\d+) household/,
              )?.[1] ?? 0,
            ),
            { timeout: 30_000 },
          )
          .toBe(selectedHouseholds);
      } catch (error) {
        const details = await page.evaluate((structureId) => {
          const app = (window as any).__livingRegionCanvassing;
          const feature = app.map
            .queryRenderedFeatures({ layers: ["structures"] })
            .find((item: any) => String(item.properties?.structure_id) === structureId);
          const homes = app
            .state()
            .households.filter((home: any) => home.structure_id === structureId);
          const targetIds = Array.isArray(feature?.properties?.selection_target_ids)
            ? feature.properties.selection_target_ids
            : [];
          return {
            structureId,
            feature: feature?.properties ?? null,
            homes,
            targetHomes: app.state().households.filter((home: any) =>
              targetIds.includes(home.household_id),
            ),
            savedLocalStorage: Object.fromEntries(
              Object.entries(localStorage).filter(([key]) =>
                key.includes("living-region.canvassing.field-state"),
              ),
            ),
            status: document.querySelector("#bulk-selection-status")?.textContent,
            toast: document.querySelector("#toast")?.textContent,
            drawer: document.querySelector("#drawer")?.className,
          };
        }, roof.id);
        throw new Error(`${error instanceof Error ? error.message : error}\nselection debug: ${JSON.stringify({ details, network: networkOutput.slice(-20), console: consoleOutput.slice(-20) })}`);
      }
      await expect
        .poll(async () =>
          page.evaluate((structureId) =>
            Boolean(
              (window as any).__livingRegionCanvassing.map.getFeatureState({
                source: "structures",
                id: structureId,
              }).selected,
            ),
          roof.id),
          { timeout: 30_000 },
        )
        .toBe(true);
      await expect(page.locator("#bulk-flyer")).toBeEnabled();
      await expect(page.locator("#drawer")).not.toHaveClass(/mobile-open/);
      expect(await page.locator("body").textContent()).not.toContain(
        "Address needs review",
      );
    }

    const visibleLinked = await renderedCanvassableRoofPoints(page, 2_000);
    const additions = [
      fixture.review_structure_id,
      fixture.needs_review_structure_id,
    ]
      .map((id) => visibleLinked.find((roof) => roof.id === id))
      .filter((roof): roof is RenderedRoofPoint => Boolean(roof));
    const ordinary = visibleLinked
      .filter(
        (roof) =>
          roof.targetKind === "address_household" &&
          !roof.flyerIds.includes("flyer-2-current") &&
          !selectedStructureIds.has(roof.id),
      )
      .slice(0, 8);
    additions.push(...ordinary);
    expect(additions.length, JSON.stringify({ fixture, visibleLinked })).toBe(10);
    expect(new Set(additions.map((roof) => roof.id)).size).toBe(10);
    for (const roof of additions) {
      selectedStructureIds.add(roof.id);
      await page.mouse.click(roof.x, roof.y);
      selectedHouseholds += roof.householdCount;
      await expect
        .poll(async () =>
          Number(
            (await page.locator("#bulk-selection-status").textContent())?.match(
              /(\d+) household/,
            )?.[1] ?? 0,
          ),
          { timeout: 30_000 },
        )
        .toBe(selectedHouseholds);
      await expect
        .poll(async () =>
          page.evaluate((structureId) =>
            Boolean(
              (window as any).__livingRegionCanvassing.map.getFeatureState({
                source: "structures",
                id: structureId,
              }).selected,
            ),
          roof.id),
          { timeout: 30_000 },
        )
        .toBe(true);
      await expect(page.locator("#bulk-flyer")).toBeEnabled();
      await expect(page.locator("#drawer")).not.toHaveClass(/mobile-open/);
      expect(await page.locator("body").textContent()).not.toContain(
        "Address needs review",
      );
    }
    expect(selectedStructureIds.size).toBe(20);
    await expect(page.locator("#bulk-selection-status")).toHaveText(
      `${selectedHouseholds} households selected`,
    );
    await page.screenshot({
      path: testInfo.outputPath("unlinked-and-review-selected.png"),
      fullPage: true,
    });

    const selectedIds = [...selectedStructureIds];
    const readSelectedState = async () =>
      page.evaluate((structureIds) => {
        const state = (window as any).__livingRegionCanvassing.state();
        const visible = new Map(
          (window as any).__livingRegionCanvassing.map
            .queryRenderedFeatures({ layers: ["structures"] })
            .map((feature: any) => [
              String(feature.properties?.structure_id),
              feature.properties ?? {},
            ]),
        );
        return structureIds.map((structureId: string) => ({
          structureId,
          addressLabel: String(visible.get(structureId)?.civic_label ?? ""),
          addressQuality: String(visible.get(structureId)?.address_quality ?? ""),
          homes: state.households
            .filter((home: any) => home.structure_id === structureId)
            .map((home: any) => ({
              household_id: home.household_id,
              flyer_ids: home.flyer_ids,
              flyer_history: home.flyer_history,
              legacy_history_review: home.legacy_history_review,
            })),
          visibleFlyered: (visible.get(structureId)?.flyer_ids ?? []).includes(
            "flyer-2-current",
          ),
        }));
      }, selectedIds);
    const beforeWrite = await readSelectedState();
    expect(
      beforeWrite.every(
        (roof) =>
          /^~?\d/.test(roof.addressLabel) &&
          !/^Canvassing roof\b/i.test(roof.addressLabel) &&
          Boolean(roof.addressQuality),
      ),
    ).toBe(true);
    expect(beforeWrite.every((roof) => roof.homes.length > 0)).toBe(true);
    expect(
      beforeWrite
        .flatMap((roof) => roof.homes)
        .every((home) => !home.flyer_ids.includes("flyer-2-current")),
      JSON.stringify(beforeWrite),
    ).toBe(true);

    await page.locator("#bulk-flyer").click();
    expect(dialogs).toEqual([]);
    await expect(page.locator("#toast")).toContainText(
      `${selectedHouseholds} households marked flyer delivered`,
      { timeout: 30_000 },
    );
    // Bulk completion returns the normal map to its citywide coverage zoom.
    // Re-enter the roof-rendering zoom before asserting the persisted polygon
    // properties; this keeps the assertion about visible roofs rather than
    // about the cluster layer shown at the overview zoom.
    const showSelectedRoofs = async () => {
      await page.evaluate(() => {
        (window as any).__livingRegionCanvassing.map.jumpTo({
          center: [-80.943, 44.567],
          zoom: 15.5,
        });
      });
      await page.waitForTimeout(700);
    };
    await showSelectedRoofs();
    await expect
      .poll(readSelectedState, { timeout: 30_000 })
      .toEqual(
        expect.arrayContaining(
          selectedIds.map((structureId) =>
            expect.objectContaining({
              structureId,
              visibleFlyered: true,
              homes: expect.arrayContaining([
                expect.objectContaining({
                  flyer_ids: expect.arrayContaining(["flyer-2-current"]),
                }),
              ]),
            }),
          ),
        ),
      );
    let persisted = await readSelectedState();
    expect(persisted).toHaveLength(selectedIds.length);
    expect(
      persisted.every(
        (roof) =>
          roof.visibleFlyered &&
          roof.homes.length > 0 &&
          roof.homes.every((home) =>
            home.flyer_ids.includes("flyer-2-current"),
          ),
      ),
    ).toBe(true);
    expect(
      persisted
        .find((roof) => roof.structureId === fixture.review_structure_id)
        ?.homes.some((home) => home.legacy_history_review === 1),
      JSON.stringify({ fixture, persisted }),
    ).toBe(true);
    expect(
      persisted
        .find((roof) => roof.structureId === fixture.needs_review_structure_id)
        ?.homes.some((home) => home.legacy_history_review === 1),
      JSON.stringify({ fixture, persisted }),
    ).toBe(true);
    const recordedEvents = persisted.flatMap((roof) =>
      roof.homes.flatMap((home) =>
        home.flyer_history.filter(
          (event: any) => event.flyer_id === "flyer-2-current",
        ),
      ),
    );
    expect(recordedEvents.length).toBe(selectedHouseholds);
    expect(
      recordedEvents.every(
        (event: any) =>
          event.user_id === "andrii" &&
          event.source === "candidate" &&
          Number.isFinite(Date.parse(event.occurred_at)),
      ),
    ).toBe(true);
    const preexisting = await page.evaluate((householdId) =>
      (window as any).__livingRegionCanvassing
        .state()
        .households.find((home: any) => home.household_id === householdId),
      fixture.previously_flyered_household_id,
    );
    expect(
      preexisting?.flyer_history.filter(
        (event: any) => event.event_id === "e2e_previously_flyered",
      ),
    ).toHaveLength(1);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForMapReady(page);
    await showSelectedRoofs();
    persisted = await readSelectedState();
    expect(
      persisted.every(
        (roof) =>
          roof.visibleFlyered &&
          roof.homes.length > 0 &&
          roof.homes.every((home) =>
            home.flyer_ids.includes("flyer-2-current"),
          ),
      ),
    ).toBe(true);

    const reseed = await page.evaluate(async () => {
      const response = await fetch("/api/canvassing/test/reseed", {
        method: "POST",
      });
      return { status: response.status, body: await response.json() };
    });
    expect(reseed.status).toBe(200);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForMapReady(page);
    await showSelectedRoofs();
    persisted = await readSelectedState();
    expect(
      persisted.every(
        (roof) =>
          roof.visibleFlyered &&
          roof.homes.length > 0 &&
          roof.homes.every((home) =>
            home.flyer_ids.includes("flyer-2-current"),
          ),
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("unlinked-and-review-after-reseed.png"),
      fullPage: true,
    });
    await testInfo.attach("bulk-selection-result.json", {
      body: JSON.stringify(
        {
          selected_roof_count: selectedIds.length,
          selected_household_count: selectedHouseholds,
          successful_flyer_count: selectedHouseholds,
          selected_structure_ids: selectedIds,
          fixture,
          persisted,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
    await testInfo.attach("bulk-selection-network.txt", {
      body: networkOutput.join("\n"),
      contentType: "text/plain",
    });
    await testInfo.attach("bulk-selection-console.txt", {
      body: consoleOutput.join("\n"),
      contentType: "text/plain",
    });
    expect(consoleOutput.filter((line) => line.startsWith("pageerror:"))).toEqual(
      [],
    );
    expect(
      consoleOutput.filter(
        (line) =>
          line.startsWith("error:") && !line.includes("401 (Unauthorized)"),
      ),
    ).toEqual([]);
  });

  test("bulk flyer preserves already-materialized roof selection and statuses", async ({
    page,
  }, testInfo) => {
    // This scenario intentionally exercises the production-sized map and
    // state payload after a cold API start. Keep the test's limit above the
    // normal Playwright default without changing the user-facing workflow.
    test.setTimeout(180_000);
    const consoleOutput: string[] = [];
    const networkOutput: string[] = [];
    const dialogs: string[] = [];
    page.on("console", (message) =>
      consoleOutput.push(`${message.type()}: ${message.text()}`),
    );
    page.on("pageerror", (error) => consoleOutput.push(`pageerror: ${error.message}`));
    page.on("response", (response) => {
      if (response.url().includes("/api/canvassing/"))
        networkOutput.push(`${response.status()} ${response.url()}`);
    });
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });

    await openCanvassing(page, 390, 844);
    const fixture = await page.evaluate(async () => {
      const response = await fetch("/api/canvassing/test/bulk-fixture", {
        method: "POST",
      });
      return { status: response.status, body: await response.json() };
    });
    expect(fixture.status).toBe(200);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForMapReady(page);

    await page.locator("#mobile-menu").click();
    await page.locator("#mobile-active-flyer").selectOption("flyer-2-current");
    await page.locator("#mobile-menu-close").click();
    await page.locator("#mobile-menu").click();
    await page.locator("#mobile-bulk-open").click();
    await expect(page.locator("#multi-select")).toHaveText("Done selecting");
    await page.evaluate(() => {
      (window as any).__livingRegionCanvassing.map.jumpTo({
        center: [-80.943, 44.567],
        zoom: 15.5,
      });
    });
    await page.waitForTimeout(700);

    const mapInvariant = await page.evaluate(() => {
      const map = (window as any).__livingRegionCanvassing.map;
      const roofs = map
        .queryRenderedFeatures({ layers: ["structures"] })
        .filter((feature: any) => feature.properties?.canvassable);
      return {
        rendered: roofs.length,
        withoutSelectionTarget: roofs.filter(
          (feature: any) => !feature.properties?.selection_target_id,
        ).length,
      };
    });
    expect(mapInvariant.rendered).toBeGreaterThanOrEqual(20);
    expect(mapInvariant.withoutSelectionTarget).toBe(0);

    const rendered = await renderedCanvassableRoofPoints(page, 80);
    await testInfo.attach("rendered-roof-summary.json", {
      body: JSON.stringify(rendered.slice(0, 80), null, 2),
      contentType: "application/json",
    });
    expect(rendered.length).toBeGreaterThanOrEqual(20);
    expect(rendered.some((roof) => roof.targetKind === "operational_roof")).toBe(
      true,
    );
    // MapLibre preserves the target kind used for both canonical NAR-linked
    // and reconciled/reference-linked roofs; the source-data invariant test
    // covers the finer provenance split without weakening the click test.
    expect(rendered.some((roof) => roof.targetKind === "address_household")).toBe(
      true,
    );
    expect(rendered.some((roof) => roof.householdCount > 1)).toBe(true);
    // The review roof is part of the production-shaped state fixture and is
    // verified below after the write. It may sit behind the address cluster
    // layer at this zoom even though it is a selectable structure feature.

    const writableIds = await page.evaluate((roofs) => {
      const map = (window as any).__livingRegionCanvassing.map;
      const state = (window as any).__livingRegionCanvassing.state();
      const homesById = new Map(
        state.households.map((home: any) => [home.household_id, home]),
      );
      const source = map.getSource("structures") as any;
      const sourceFeatures = source?._data?.features ?? [];
      const parseIds = (value: any) => {
        if (Array.isArray(value)) return value.map(String);
        if (typeof value !== "string") return [];
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch {
          return [];
        }
      };
      return roofs
        .filter((roof: any) => {
          const sourceFeature = sourceFeatures.find(
            (feature: any) => String(feature.properties?.structure_id) === roof.id,
          );
          const targetIds = new Set([
            ...roof.targetIds,
            ...parseIds(sourceFeature?.properties?.selection_target_ids),
            ...state.households
              .filter((home: any) => home.structure_id === roof.id)
              .map((home: any) => home.household_id),
          ]);
          const homes = [...targetIds]
            .map((id) => homesById.get(id))
            .filter(Boolean);
          return (
            homes.length > 0 &&
            homes.every(
              (home: any) => !home.flyer_ids?.includes("flyer-2-current"),
            )
          );
        })
        .map((roof: any) => roof.id);
    }, rendered);
    const writable = rendered.filter((roof) => writableIds.includes(roof.id));
    expect(writable.length).toBeGreaterThanOrEqual(20);
    const selectedRoofs = writable.slice(0, 20);
    const selectedRoofIds = selectedRoofs.map((roof) => roof.id);
    await testInfo.attach("selected-roof-ids.json", {
      body: JSON.stringify(
        {
          fixture,
          selected_roof_ids: selectedRoofIds,
          selected_household_count: selectedRoofs.reduce(
            (sum, roof) => sum + roof.householdCount,
            0,
          ),
        },
        null,
        2,
      ),
      contentType: "application/json",
    });

    let expectedHouseholds = 0;
    for (const roof of selectedRoofs) {
      expectedHouseholds += roof.householdCount;
      await page.mouse.click(roof.x, roof.y);
      await expect
        .poll(async () =>
          Number(
            (await page.locator("#bulk-selection-status").textContent())?.match(
              /(\d+) household/,
            )?.[1] ?? 0,
          ),
        )
        .toBe(expectedHouseholds);
      await expect
        .poll(async () =>
          page.evaluate(
            (structureId) =>
              Boolean(
                (window as any).__livingRegionCanvassing.map.getFeatureState({
                  source: "structures",
                  id: structureId,
                }).selected,
              ),
            roof.id,
          ),
        )
        .toBe(true);
      await expect(page.locator("#bulk-flyer")).toBeEnabled();
      expect(await page.locator("body").textContent()).not.toContain(
        "Address needs review",
      );
    }
    await page.screenshot({ path: testInfo.outputPath("selected-roofs.png"), fullPage: true });
    await expect(page.locator("#bulk-selection-status")).toContainText(
      `${expectedHouseholds} households selected`,
    );

    await page.locator("#bulk-flyer").click();
    expect(dialogs).toEqual([]);
    await expect(page.locator("#toast")).toContainText("marked flyer delivered", {
      timeout: 30_000,
    });
    await expect(page.locator("#coverage-toggle")).toHaveText("Households");

    const verifyStatuses = async () =>
      page.evaluate(
        ({ selectedRoofs, fixture }) => {
          const state = (window as any).__livingRegionCanvassing.state();
            const homesByStructure = new Map<string, any[]>();
            const homesById = new Map<string, any>();
            for (const home of state.households) {
              homesById.set(home.household_id, home);
              const homes = homesByStructure.get(home.structure_id) ?? [];
            homes.push(home);
            homesByStructure.set(home.structure_id, homes);
            }
            return {
            selected: selectedRoofs.map((roof: any) => ({
              id: roof.id,
              homes: [
                ...(homesByStructure.get(roof.id) ?? []),
                ...roof.targetIds.map((id: string) => homesById.get(id)).filter(Boolean),
              ].filter(
                (home, index, homes) =>
                  homes.findIndex((candidate) => candidate.household_id === home.household_id) === index,
              ).map((home) => ({
                household_id: home.household_id,
                flyer_ids: home.flyer_ids,
                flyer_delivered: home.flyer_delivered,
                legacy_history_review: home.legacy_history_review,
              })),
            })),
            preExistingEventCount: state.households.reduce(
              (count: number, home: any) =>
                count +
                (home.flyer_history ?? []).filter(
                  (event: any) => event.event_id === "e2e_previously_flyered",
                ).length,
              0,
            ),
            reviewPresent: state.households.some(
              (home: any) =>
                home.household_id === fixture.review_household_id &&
                home.legacy_history_review === 1,
            ),
          };
        },
        { selectedRoofs, fixture: fixture.body },
      );
    await expect
      .poll(async () => {
        const current = await verifyStatuses();
        return current.selected.every((roof) =>
          roof.homes.length > 0 &&
          roof.homes.every((home) => home.flyer_ids.includes("flyer-2-current")),
        );
      }, { timeout: 30_000 })
      .toBe(true);
    let verification = await verifyStatuses();
    expect(verification.selected).toHaveLength(20);
    expect(
      verification.selected.every((roof) =>
        roof.homes.length > 0 &&
        roof.homes.every((home) => home.flyer_ids.includes("flyer-2-current")),
      ),
    ).toBe(true);
    expect(verification.preExistingEventCount).toBe(1);
    expect(verification.reviewPresent).toBe(true);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForMapReady(page);
    verification = await verifyStatuses();
    expect(
      verification.selected.every((roof) =>
        roof.homes.every((home) => home.flyer_ids.includes("flyer-2-current")),
      ),
    ).toBe(true);

    const reseed = await page.evaluate(async () => {
      const response = await fetch("/api/canvassing/test/reseed", { method: "POST" });
      return { status: response.status, body: await response.json() };
    });
    expect(reseed.status).toBe(200);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForMapReady(page);
    verification = await verifyStatuses();
    expect(
      verification.selected.every((roof) =>
        roof.homes.every((home) => home.flyer_ids.includes("flyer-2-current")),
      ),
    ).toBe(true);
    expect(verification.preExistingEventCount).toBe(1);
    expect(verification.reviewPresent).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("statuses-after-reseed.png"), fullPage: true });
    await testInfo.attach("network-output.txt", {
      body: networkOutput.join("\n"),
      contentType: "text/plain",
    });
    await testInfo.attach("console-output.txt", {
      body: consoleOutput.join("\n"),
      contentType: "text/plain",
    });
    expect(consoleOutput.filter((line) => line.startsWith("pageerror:"))).toEqual([]);
    expect(
      consoleOutput.filter(
        (line) => line.startsWith("error:") && !line.includes("401 (Unauthorized)"),
      ),
    ).toEqual([]);
  });

  test("catalogue editing, active selection, inspection filter, and route creation work on desktop", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await openCanvassing(page, 1280, 900);
    await expect(page.locator(".canvass-shell > header > nav")).toBeHidden();
    await expect(page.locator("#mobile-menu")).toBeVisible();
    await expect(page.locator(".canvass-shell > footer")).toBeHidden();
    await page.locator("#mobile-menu").click();
    await page.locator("#mobile-flyer-catalogue-open").click();
    await expect(page.locator("#flyer-dialog")).toBeVisible();
    await page
      .locator('[data-flyer-field="short_name"][data-flyer-id="flyer-2-current"]')
      .fill("Desktop test flyer");
    await page.locator('[data-save-flyer="flyer-2-current"]').click();
    await expect(page.locator("#toast")).toContainText("catalogue updated", {
      timeout: 30_000,
    });
    await page.locator("#flyer-dialog [data-close='flyer-dialog']").click();
    await page.locator("#mobile-menu").click();
    await page.locator("#mobile-active-flyer").selectOption("flyer-2-current");
    await page.locator("#mobile-flyer-filter").selectOption("flyer-2-current");
    await expect(page.locator("#mobile-active-flyer")).toHaveValue("flyer-2-current");
    await expect(page.locator("#mobile-flyer-filter")).toHaveValue("flyer-2-current");
    await page.locator("#mobile-flyer-filter").selectOption("");
    await page.locator("#mobile-menu-close").click();

    await page.locator("#mobile-menu").click();
    await page.locator("#mobile-bulk-open").click();
    await clickRoofs(page, 2);
    await expect(page.locator("#selection-count")).toHaveText("2");
    await page.locator("#mobile-menu").click();
    await page.locator("#mobile-tools-open").click();
    await page.locator("#route-name").fill("Playwright route");
    await page.locator("#create-route").click();
    await expect(page.locator("#toast")).toContainText("Route created", {
      // Route creation refreshes the production-sized canvassing state before
      // publishing its success toast. Allow that refresh to finish on a cold
      // test API without weakening the assertion.
      timeout: 60_000,
    });
    await expect(page.locator("#active-route option", { hasText: "Playwright route" })).toHaveCount(1);
  });
});

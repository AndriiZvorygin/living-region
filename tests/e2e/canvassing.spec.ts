import { expect, test, type Page } from "playwright/test";

async function openCanvassing(page: Page, width = 390, height = 844) {
  await page.setViewportSize({ width, height });
  await page.goto("/canvassing/?e2e=1", { waitUntil: "domcontentloaded" });
  await loginIfNeeded(page);
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForFunction(
    () => Boolean((window as any).__livingRegionCanvassing?.map?.isStyleLoaded()),
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(1_000);
}

async function loginIfNeeded(page: Page, username = "andrii") {
  await page.waitForSelector("#login-form, .maplibregl-canvas", {
    timeout: 30_000,
  });
  if (!(await page.locator("#login-form").count())) return;
  await page.locator("#login-username").fill(username);
  await page.locator("#login-password").fill("canvassing-test-password");
  await page.locator("#login-form button[type=submit]").click();
  await expect(page.locator("#login-form")).toHaveCount(0);
}

async function roofPoints(page: Page, count = 2) {
  return page.evaluate((wanted) => {
    const map = (window as any).__livingRegionCanvassing.map;
    const container = map.getContainer().getBoundingClientRect();
    const features = map
      .queryRenderedFeatures({ layers: ["structures"] })
      .filter((feature: any) => Number(feature.properties?.household_count) === 1);
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
        return map
          .queryRenderedFeatures([candidate.x, candidate.y], { layers: ["structures"] })
          .some(
            (hit: any) =>
              String(hit.properties?.structure_id) === id &&
              Number(hit.properties?.household_count) > 0,
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
  }, count);
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
    await page.waitForFunction(
      () => Boolean((window as any).__livingRegionCanvassing?.map?.isStyleLoaded()),
      undefined,
      { timeout: 30_000 },
    );
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
    const [point] = await roofPoints(page, 1);
    expect(point).toBeTruthy();
    await page.mouse.click(point.x, point.y);
    await expect(page.locator("#drawer")).toHaveClass(/mobile-open/);
    await page.locator("#visit-talked + span").click();
    await page.locator("#save-visit").click();
    await expect(page.locator("#toast")).toContainText("Household status updated", {
      timeout: 10_000,
    });
    const summary = await page.evaluate(async () =>
      fetch("/api/canvassing/state").then((response) => response.json()),
    );
    expect(Number(summary.summary.conversations)).toBeGreaterThanOrEqual(1);
  });

  test("catalogue editing, active selection, inspection filter, and route creation work on desktop", async ({
    page,
  }) => {
    await openCanvassing(page, 1280, 900);
    await page.locator("#flyer-catalogue-open").click();
    await expect(page.locator("#flyer-dialog")).toBeVisible();
    await page
      .locator('[data-flyer-field="short_name"][data-flyer-id="flyer-2-current"]')
      .fill("Desktop test flyer");
    await page.locator('[data-save-flyer="flyer-2-current"]').click();
    await expect(page.locator("#toast")).toContainText("catalogue updated", {
      timeout: 10_000,
    });
    await page.locator("#flyer-dialog [data-close='flyer-dialog']").click();
    await page.locator("#active-flyer").selectOption("flyer-2-current");
    await page.locator("#flyer-filter").selectOption("flyer-2-current");
    await expect(page.locator("#active-flyer")).toHaveValue("flyer-2-current");
    await expect(page.locator("#flyer-filter")).toHaveValue("flyer-2-current");
    await page.locator("#flyer-filter").selectOption("");

    await page.locator("#multi-select").click();
    await clickRoofs(page, 2);
    await page.locator("#route-name").fill("Playwright route");
    await page.locator("#create-route").click();
    await expect(page.locator("#toast")).toContainText("Route created", {
      timeout: 10_000,
    });
    await expect(page.locator("#active-route option", { hasText: "Playwright route" })).toHaveCount(1);
  });
});

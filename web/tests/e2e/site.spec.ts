import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("loads, finishes the intro and shows the hero", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("who goes where?", { timeout: 20_000 });
    await expect(page.getByRole("link", { name: /Launch the Quantum Workspace/ })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("lambda slider changes the optimal dispatch plan", async ({ page }) => {
    await page.goto("/#dilemma");
    const slider = page.getByLabel("priority weight lambda");
    await slider.scrollIntoViewIfNeeded();
    await slider.fill("0");
    await expect(page.getByText(/Maximise people reached/)).toBeVisible();
    await slider.fill("1");
    await expect(page.getByText(/Fastest response/)).toBeVisible();
  });

  test("CTA navigates to the workspace", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Launch the Quantum Workspace/ }).click();
    await expect(page).toHaveURL(/\/app\/?$/);
    await expect(page.getByText("Quantum Workspace").first()).toBeVisible();
  });

  test("has no critical/serious accessibility violations", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(6000);
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("canvas").analyze();
    const bad = res.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(bad.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });

  test("performance budget: DOMContentLoaded < 3 s, JS < 1.5 MB", async ({ page }) => {
    let js = 0;
    page.on("response", async (r) => { if (r.url().endsWith(".js")) js += Number(r.headers()["content-length"] ?? (await r.body()).length); });
    await page.goto("/");
    const t = await page.evaluate(() => performance.getEntriesByType("navigation")[0].toJSON().domContentLoadedEventEnd);
    expect(t).toBeLessThan(3000);
    await page.waitForLoadState("networkidle");
    expect(js).toBeLessThan(1.5 * 1024 * 1024);
  });
});

test.describe("quantum workspace", () => {
  test("Qiskit replay produces a plan that matches the exact optimum", async ({ page }) => {
    await page.goto("/app/");
    await page.getByRole("button", { name: /Qiskit replay/ }).click();
    await page.getByRole("button", { name: /Run QAOA/ }).click();
    await expect(page.getByText("Matches the exact brute-force optimum")).toBeVisible({ timeout: 30_000 });
  });

  test("live in-browser QAOA run completes (variant C, p=1)", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/app/");
    await page.getByRole("button", { name: /XY-QAOA/ }).click();
    await page.getByRole("button", { name: "1", exact: true }).click();
    await page.getByRole("button", { name: /Run QAOA/ }).click();
    await expect(page.getByText(/(Matches|Differs from) the exact/)).toBeVisible({ timeout: 100_000 });
  });

  test("presets update lambda", async ({ page }) => {
    await page.goto("/app/");
    await page.getByRole("button", { name: "Fastest" }).click();
    await expect(page.getByText("λ = 1.0")).toBeVisible();
  });

  test("has no critical/serious accessibility violations", async ({ page }) => {
    await page.goto("/app/");
    await page.waitForTimeout(3000);
    const res = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("canvas").analyze();
    const bad = res.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(bad.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});

test.describe("responsive", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("no horizontal overflow on mobile", async ({ page }) => {
    for (const path of ["/", "/app/"]) {
      await page.goto(path);
      await page.waitForTimeout(2500);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
  });
});

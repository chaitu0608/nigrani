import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });
const errors: string[] = [];
const toast = (p: Page, t: string | RegExp) => expect(p.locator("[data-sonner-toast]").filter({ hasText: t }).first()).toBeVisible();
const dialog = (p: Page) => p.getByRole("dialog");
let ALERT = "";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => { if (r.url().includes("/v1/") && r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
});
test.afterEach(() => { expect(errors, "no page errors / 5xx").toEqual([]); });

test("landing and overview render with real data", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("market manipulation");
  await page.getByRole("link", { name: /live demo/i }).first().click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Today's top risk", { exact: false })).toBeVisible();
});

test("alert lifecycle: assign, escalate, draft, feedback, close, reopen", async ({ page }) => {
  await page.goto("/dashboard/queue");
  const first = page.locator("[data-alert-id]").filter({ hasText: "Open" }).first();
  ALERT = (await first.getAttribute("data-alert-id"))!;
  await page.goto(`/dashboard/queue/${ALERT}`);
  const head = page.getByTestId("alert-detail");
  await head.getByRole("button", { name: /assign to me/i }).click();
  await toast(page, /assigned to analyst1/i);
  await expect(head.getByText("Owner").first()).toBeVisible();

  await head.getByRole("button", { name: /^escalate/i }).click();
  await dialog(page).getByRole("textbox").fill("Coordinated buying with KYC-linked accounts");
  await dialog(page).getByRole("button", { name: /^escalate$/i }).click();
  await toast(page, /escalat/i);
  await expect(head.getByText("Coordinated buying with KYC-linked accounts")).toBeVisible();

  await head.getByRole("button", { name: /draft case note/i }).click();
  await expect(dialog(page).locator("pre")).toContainText(/\S{10,}/);
  await dialog(page).getByRole("button", { name: /done/i }).click();

  await head.getByRole("button", { name: /label for retrain/i }).click();
  await dialog(page).getByRole("button", { name: /true positive/i }).click();
  await dialog(page).getByRole("button", { name: /save label/i }).click();
  await toast(page, /feedback recorded/i);

  await page.keyboard.press("c");
  await dialog(page).getByRole("button", { name: /true positive/i }).click();
  await dialog(page).getByRole("textbox").fill("e2e confirmed");
  await dialog(page).getByRole("button", { name: /close alert/i }).click();
  await toast(page, /closed/i);
  await expect(page).not.toHaveURL(new RegExp(ALERT)); // closing auto-advances to the next alert
  await page.goto(`/dashboard/queue/${ALERT}`);
  await expect(head.getByRole("button", { name: /reopen/i })).toBeVisible();

  await head.getByRole("button", { name: /reopen/i }).click();
  await dialog(page).getByRole("textbox").fill("new evidence arrived");
  await dialog(page).getByRole("button", { name: /^reopen$/i }).click();
  await toast(page, /reopened/i);
  await expect(head.getByRole("button", { name: /^close/i })).toBeVisible();

  await head.getByRole("button", { name: /activity/i }).click();
  await expect(head.getByText(/reopen/i).last()).toBeVisible();
});

test("queue keyboard navigation", async ({ page }) => {
  await page.goto("/dashboard/queue");
  await expect(page.locator("[data-alert-id]").first()).toBeVisible();
  const before = page.url();
  await page.keyboard.press("j"); await page.keyboard.press("j");
  await expect(page).not.toHaveURL(before);
  await page.keyboard.press("/");
  await expect(page.getByPlaceholder(/account or alert id/i)).toBeFocused();
});

test("cases: add alert to new case, note, drag across the board", async ({ page }) => {
  await page.goto(`/dashboard/queue/${ALERT}`);
  await page.getByTestId("alert-detail").getByRole("button", { name: /add to case/i }).click();
  await dialog(page).getByRole("textbox").fill("E2E wash ring");
  await dialog(page).getByRole("button", { name: /new case/i }).click();
  await toast(page, /case opened/i);

  await page.goto("/dashboard/cases");
  const card = page.locator("[data-case-id]").filter({ hasText: "E2E wash ring" });
  await card.click();
  await dialog(page).getByPlaceholder(/add a note/i).fill("Pulled bank statements");
  await dialog(page).getByRole("button", { name: /^add$/i }).click();
  await toast(page, /note added/i);
  await expect(dialog(page).getByText("Pulled bank statements")).toBeVisible();
  await dialog(page).getByRole("button", { name: /draft case summary/i }).click();
  await expect(dialog(page).locator("pre")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /new case/i }).click();
  await dialog(page).getByPlaceholder(/title/i).fill("E2E manual case");
  await dialog(page).getByRole("button", { name: /^create$/i }).click();
  await toast(page, /opened/i);

  await card.dragTo(page.locator('[data-col="under_review"]'));
  await toast(page, /moved/i);
  await expect(page.locator('[data-col="under_review"]').getByText("E2E wash ring")).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-col="under_review"]').getByText("E2E wash ring")).toBeVisible();
});

test("model page: analyst is refused, admin retrains and promotes", async ({ page, request }) => {
  // retrain needs at least one labelled disposition; seed one so this test also runs on its own
  const H = { "X-API-Key": "analyst-dev-key" };
  const q = await (await request.get("/v1/alerts?status=open&limit=1", { headers: H })).json();
  const id = (q.items ?? q)[0].alert_id;
  expect((await request.post(`/v1/alerts/${encodeURIComponent(id)}/feedback`, { headers: H, data: { verdict: "false_positive", note: "e2e seed" } })).ok()).toBeTruthy();
  await page.goto("/dashboard/model");
  await page.getByRole("button", { name: /retrain candidate/i }).click();
  await toast(page, /admin action failed/i);

  await page.evaluate(() => localStorage.setItem("nigrani.key", "admin-dev-key"));
  await page.reload();
  await page.getByRole("button", { name: /retrain candidate/i }).click();
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: /retrain finished/i }).first()).toBeVisible({ timeout: 90_000 });
  const promote = page.getByRole("button", { name: /^promote$/i }).first();
  await expect(promote).toBeVisible();
  await promote.click();
  await toast(page, /promoted/i);
  await page.reload(); // the promoted retrain has no held-out test block; page must still render
  await expect(page.getByRole("heading", { name: "Model", exact: true })).toBeVisible();
  await expect(page.getByText("production").first()).toBeVisible();
  await page.evaluate(() => localStorage.setItem("nigrani.key", "analyst-dev-key"));
});

test("command palette navigates and opens alerts", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText("Today's top risk", { exact: false })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  const input = page.getByPlaceholder(/search|type a command/i).last();
  await input.fill("cases");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/dashboard\/cases/);
  await page.keyboard.press("ControlOrMeta+k");
  await input.fill("model");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/dashboard\/model/);
  await page.keyboard.press("ControlOrMeta+k");
  await input.fill(ALERT.split(":")[1]);
  await page.getByRole("option").filter({ hasText: ALERT.split(":")[1] }).first().click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/queue/${ALERT.replace(":", "(:|%3A)")}`));
});

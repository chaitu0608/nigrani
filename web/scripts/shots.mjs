// Headless Playwright screenshots of the dashboard: node scripts/shots.mjs [baseUrl]
import { chromium } from "playwright";
const BASE = process.argv[2] || process.env.BASE || "http://localhost:8011";
const OUT = new URL("../../docs/screens/", import.meta.url).pathname;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { if (!localStorage.getItem("theme")) localStorage.setItem("theme", "dark"); localStorage.setItem("apiKey", "analyst-dev-key"); });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));
const shot = async (name, opts = {}) => { await page.waitForTimeout(opts.wait ?? 1200); await page.screenshot({ path: OUT + name + ".png", fullPage: !!opts.full }); console.log("saved", name); };
const go = async (p) => { await page.goto(BASE + p, { waitUntil: "networkidle" }); };

await go("/"); await shot("01-landing-hero");
await shot("02-landing-full", { full: true, wait: 300 });
await go("/dashboard"); await shot("03-overview");
await go("/dashboard/queue"); await shot("04-queue");
await go("/dashboard/queue/2026-06-08:867"); await shot("05-alert-detail");
await page.keyboard.press("3"); await shot("06-network", { wait: 3500 });
await go("/dashboard/cases"); await shot("07-cases");
await go("/dashboard/model"); await shot("08-model");
await go("/dashboard/queue"); await page.waitForTimeout(800); await page.keyboard.press("Meta+k");
await page.keyboard.type("account 8", { delay: 40 }); await shot("09-command-palette", { wait: 600 });
await page.keyboard.press("Escape");
await page.evaluate(() => localStorage.setItem("theme", "light"));
await go("/dashboard/queue/2026-06-08:867"); await shot("10-light-mode");
await go("/"); await shot("11-landing-light");
await browser.close();

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
const server = spawn(
  process.execPath,
  [
    "../../node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5178",
  ],
  { cwd: "apps/desktop", stdio: "ignore" },
);
let browser;
try {
  for (let i = 0; i < 80; i++) {
    if (
      await fetch("http://127.0.0.1:5178")
        .then((r) => r.ok)
        .catch(() => false)
    )
      break;
    await delay(250);
  }
  browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  const user = {
    id: "admin",
    name: "Admin Test",
    role: "ADMIN",
    email: "admin@test.invalid",
  };
  const token = "a".repeat(64),
    checks = [],
    errors = [];
  let offline = false,
    expired = false;
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    let body = { items: [], total: 0, pages: 1 },
      status = 200;
    if (path === "/auth/login") body = { token, user };
    if (path === "/auth/me") {
      checks.push(route.request().headers().authorization);
      if (offline) {
        await route.abort();
        return;
      }
      status = expired ? 401 : 200;
      body = expired ? { message: "Sesioni ka skaduar." } : user;
    }
    if (path === "/auth/logout") body = { message: "U çkyçët." };
    if (path === "/dashboard")
      body = {
        total: 0,
        active: 0,
        inactive: 0,
        courses: 0,
        groups: 0,
        recent: [],
      };
    if (path === "/invoice-review/reminders")
      body = { current: { count: 0 }, next: { count: 0 }, total: 0 };
    if (path === "/dashboard/payment-reminders")
      body = { upcoming: { total: 0 }, overdue: { total: 0 } };
    await route.fulfill({ status, json: body });
  });
  const login = async () => {
    await page.getByLabel("Emaili", { exact: true }).fill(user.email);
    await page
      .getByLabel("Fjalëkalimi", { exact: true })
      .fill("fixture-password");
    await page.getByRole("button", { name: "Kyçu në platformë" }).click();
    await page
      .getByRole("heading", { name: "Mirë se erdhe, Admin." })
      .waitFor();
  };
  await page.goto("http://127.0.0.1:5178");
  await login();
  await page.reload();
  await page.getByRole("heading", { name: "Mirë se erdhe, Admin." }).waitFor();
  assert(
    checks.length > 0 && checks.every((value) => value === `Bearer ${token}`),
  );
  assert.equal(
    await page.getByLabel("Fjalëkalimi", { exact: true }).count(),
    0,
  );
  offline = true;
  await page.reload();
  await page.getByRole("button", { name: "Riprovo lidhjen" }).waitFor();
  assert(
    await page.evaluate(() => Boolean(sessionStorage.getItem("erp-session"))),
    "Network failure preserves session",
  );
  offline = false;
  await page.getByRole("button", { name: "Riprovo lidhjen" }).click();
  await page.getByRole("heading", { name: "Mirë se erdhe, Admin." }).waitFor();
  await page.getByTitle("Çkyçu", { exact: true }).click();
  await page.getByLabel("Fjalëkalimi", { exact: true }).waitFor();
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("erp-session")),
    null,
  );
  const before = checks.length;
  await page.reload();
  await page.getByLabel("Fjalëkalimi", { exact: true }).waitFor();
  assert.equal(
    checks.length,
    before,
    "Logout remains logged out after refresh",
  );
  await login();
  expired = true;
  await page.reload();
  await page.getByLabel("Fjalëkalimi", { exact: true }).waitFor();
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("erp-session")),
    null,
  );
  expired = false;
  await login();
  const beforeSwitch = checks.length;
  await page.evaluate(() =>
    localStorage.setItem("erp-api-url", "https://other-server.invalid/api"),
  );
  await page.reload();
  await page.getByLabel("Fjalëkalimi", { exact: true }).waitFor();
  assert.equal(
    checks.length,
    beforeSwitch,
    "Never forward stored token to a different server",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: refresh restores session, server validates token, offline retry, logout, expiry, and server isolation.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}

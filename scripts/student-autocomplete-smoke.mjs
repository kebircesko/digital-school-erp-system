import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.setDefaultTimeout(15000);
  const errors = [],
    requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const students = [
    ["tiam-1", "Tiam", "Gashi", "000000001"],
    ["tiam-2", "Tiam", "Krasniqi", "000000002"],
    ["arta", "Arta", "Demo", "000000003"],
    ["besa", "Besa", "Demo", "000000004"],
  ].map(([id, firstName, lastName, parentPhone]) => ({
    id,
    firstName,
    lastName,
    parentName: "Prind Demo",
    parentPhone,
  }));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname.replace(/^\/api/, ""),
      search = url.searchParams.get("search") ?? "";
    requests.push({
      path,
      search,
      studentId: url.searchParams.get("studentId"),
    });
    let body,
      status = 200;
    if (path === "/auth/login")
      body = { token: "demo", user: { name: "Admin Demo", role: "ADMIN" } };
    else if (path === "/dashboard")
      body = {
        total: 0,
        active: 0,
        inactive: 0,
        groups: 0,
        courses: 0,
        recent: [],
      };
    else if (path === "/invoice-review/reminders")
      body = {
        current: { count: 0, period: "2026-10" },
        next: { count: 0, period: "2026-11" },
        total: 0,
      };
    else if (path === "/dashboard/payment-reminders")
      body = { upcoming: { total: 0 }, overdue: { total: 0 } };
    else if (path === "/students") {
      if (search === "Arta")
        await new Promise((resolve) => setTimeout(resolve, 350));
      if (search === "gabim") {
        status = 500;
        body = { message: "Gabim provues i kërkimit." };
      } else {
        const items = students.filter((row) =>
          `${row.firstName} ${row.lastName} ${row.parentPhone}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        );
        body = { items, total: items.length };
      }
    } else body = { items: [], total: 0, pages: 1 };
    await route.fulfill({ status, json: body }).catch(() => {});
  });
  await page.goto(process.env.ERP_UI_URL ?? "http://127.0.0.1:5178");
  await page.getByLabel("Emaili", { exact: true }).fill("admin@test.invalid");
  await page.getByLabel("Fjalëkalimi", { exact: true }).fill("demo-password");
  await page.getByRole("button", { name: "Kyçu në platformë" }).click();
  await page.getByRole("button", { name: "Veprim i ri", exact: true }).click();
  await page
    .locator("#quick-create-actions")
    .getByRole("button", { name: "Regjistro faturën", exact: true })
    .click();
  const modal = page.getByRole("dialog", {
    name: "Regjistro faturën",
    exact: true,
  });
  const input = modal.getByRole("combobox", {
    name: "Kërko: Nxënësi",
    exact: true,
  });
  await input.fill("tiam");
  await modal.getByRole("option", { name: /Tiam Krasniqi/ }).waitFor();
  assert.equal(await modal.getByRole("option").count(), 2);
  assert.equal(await modal.locator('select[aria-label="Nxënësi"]').count(), 0);
  assert.equal(await input.evaluate((node) => node.checkValidity()), false);
  await mkdir("output/student-autocomplete", { recursive: true });
  await page.screenshot({
    path: "output/student-autocomplete/suggestions.png",
    fullPage: true,
  });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.screenshot({
    path: "output/student-autocomplete/suggestions-dark.png",
    fullPage: true,
  });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  const chosenRequest = page.waitForRequest(
    (request) =>
      request.url().includes("studentId=tiam-2") &&
      request.url().includes("/invoice-review/pending"),
  );
  await modal.getByRole("option", { name: /Tiam Krasniqi.*000000002/ }).click();
  assert.equal(await input.inputValue(), "Tiam Krasniqi");
  assert.equal(await input.evaluate((node) => node.checkValidity()), true);
  await chosenRequest;
  const olderRequest = page.waitForRequest(
    (request) => new URL(request.url()).searchParams.get("search") === "Arta",
  );
  await input.fill("Arta");
  await olderRequest;
  await input.fill("Besa");
  await modal.getByRole("option", { name: /Besa Demo/ }).waitFor();
  await page.waitForTimeout(400);
  assert.equal(await modal.getByRole("option", { name: /Arta/ }).count(), 0);
  assert.equal(await input.evaluate((node) => node.checkValidity()), false);
  await input.press("Enter");
  assert.equal(await input.inputValue(), "Besa Demo");
  await input.press("ArrowDown");
  await modal.getByRole("listbox").waitFor();
  await input.press("Escape");
  assert.equal(await input.getAttribute("aria-expanded"), "false");
  assert.equal(await modal.count(), 1);
  await input.fill("zzzz");
  await modal.getByText(/Nuk u gjetën nxënës/).waitFor();
  assert.equal(await input.evaluate((node) => node.checkValidity()), false);
  await input.fill("gabim");
  await modal.getByRole("alert").filter({ hasText: "Gabim provues" }).waitFor();
  await page.mouse.move(0, 0);
  await input.fill("tiam");
  await modal.getByRole("option", { name: /Tiam Krasniqi/ }).waitFor();
  await input.press("ArrowDown");
  await input.press("Enter");
  assert.equal(await input.inputValue(), "Tiam Krasniqi");
  await modal
    .getByRole("button", { name: "Pastro zgjedhjen: Nxënësi", exact: true })
    .click();
  assert.equal(await input.inputValue(), "");
  assert.equal(await input.evaluate((node) => node.checkValidity()), false);
  assert.deepEqual(errors, []);
  console.log(
    "Autocomplete passed: immediate matches, contact details, single-click selection, keyboard, validation, clearing, errors and stale-response cancellation.",
  );
} finally {
  await browser.close();
}

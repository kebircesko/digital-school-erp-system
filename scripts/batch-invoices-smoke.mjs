import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
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
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
  });
  const requests = [],
    created = new Set(),
    errors = [];
  const prices = new Map(),
    lastRows = new Map();
  let rejectSecond = true;
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error(e.message);
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname.replace(/^\/api/, "");
    let body = { items: [], total: 0, pages: 1 },
      status = 200;
    if (path === "/auth/login")
      body = { token: "fixture", user: { name: "Admin Test", role: "ADMIN" } };
    if (path === "/dashboard")
      body = {
        total: 0,
        active: 0,
        inactive: 0,
        courses: 0,
        groups: 0,
        recent: [],
      };
    if (path === "/dashboard/payment-reminders")
      body = { upcoming: { total: 0 }, overdue: { total: 0 } };
    if (path === "/invoice-review/reminders")
      body = {
        current: { count: 0, period: "2026-11" },
        next: { count: 0, period: "2026-12" },
        total: 0,
      };
    if (path === "/invoice-review/pending") {
      const period = url.searchParams.get("period");
      const d = new Date(`${period}-01T12:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() - 1);
      const previousPeriod = d.toISOString().slice(0, 7);
      let rows = ["Ana Test", "Besa Test"]
        .map((name, i) => ({
          enrollmentId: `e${i}`,
          studentId: `s${i}`,
          studentName: name,
          period,
          monthlyPrice: "60.00",
          defaultAmount: "60.00",
          suggestedAmount: prices.get(`${period}:e${i}`)?.amount ?? "60.00",
          suggestedNotes: prices.get(`${period}:e${i}`)?.notes ?? "",
          priceDraft: prices.get(`${period}:e${i}`) ?? null,
          groupName: "TEST · Dizajn · C",
          courseName: "JavaScript – Basic [TEST]",
          instructorName: "Driton Morina [TEST]",
          dueDate: `${period}-29`,
          reviewToken: `fixture-token-${prices.get(`${period}:e${i}`)?.version ?? 0}`,
          attendance: {
            current: null,
            previous: {
              period: previousPeriod,
              totalLessons: 8,
              absences: 2,
              excusedAbsences: 1,
            },
          },
        }))
        .filter((r) => !created.has(r.enrollmentId));
      rows.forEach((row) => lastRows.set(`${period}:${row.enrollmentId}`, row));
      const search = url.searchParams.get("search")?.toLowerCase();
      if (search)
        rows = rows.filter((r) =>
          `${r.studentName} ${r.groupName} ${r.courseName}`
            .toLowerCase()
            .includes(search),
        );
      const summary = {
        all: rows.length,
        absences: rows.length,
        missing: 0,
        regular: 0,
      };
      if (["missing", "regular"].includes(url.searchParams.get("status")))
        rows = [];
      body = { items: rows, total: rows.length, page: 1, pages: 1, summary };
    }
    if (path === "/invoice-review/price") {
      const dto = route.request().postDataJSON(),
        key = `${dto.period}:${dto.enrollmentId}`;
      const previous = lastRows.get(key);
      assert.equal(dto.reviewToken, previous.reviewToken);
      const draft = {
        amount: dto.amount,
        notes: dto.notes,
        version: (prices.get(key)?.version ?? 0) + 1,
      };
      prices.set(key, draft);
      body = {
        ...previous,
        suggestedAmount: dto.amount,
        suggestedNotes: dto.notes,
        priceDraft: draft,
        reviewToken: `fixture-token-${draft.version}`,
      };
      lastRows.set(key, body);
    }
    if (path === "/students/s0")
      body = {
        id: "s0",
        firstName: "Ana",
        lastName: "Test",
        birthDate: "2010-05-05",
        status: "ACTIVE",
        parentName: "Prind Test",
        parentPhone: "000000001",
      };
    if (path === "/students/s0/history")
      body = { enrollments: [], invoices: [], payments: [] };
    if (path === "/invoice-review/approve") {
      const dto = route.request().postDataJSON();
      requests.push(dto);
      await delay(250);
      if (dto.enrollmentId === "e1" && rejectSecond) {
        status = 409;
        body = { message: "Mungesat kanë ndryshuar." };
        rejectSecond = false;
      } else {
        assert(
          !created.has(dto.enrollmentId),
          "Do not submit a successful invoice twice",
        );
        created.add(dto.enrollmentId);
        status = 201;
        body = { id: `invoice-${dto.enrollmentId}` };
      }
    }
    await route.fulfill({ status, json: body });
  });
  await page.goto("http://127.0.0.1:5178");
  await page.getByLabel("Emaili", { exact: true }).fill("admin@test.invalid");
  await page
    .getByLabel("Fjalëkalimi", { exact: true })
    .fill("fixture-password");
  await page.getByRole("button", { name: "Kyçu në platformë" }).click();
  await page.getByRole("button", { name: "Faturat", exact: true }).click();
  await page
    .getByRole("button", { name: "Faturat e muajit", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Përgatit muajin e ardhshëm" })
    .click();
  await page.getByLabel("Zgjidh Ana Test", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("Zbritja për Ana Test").isVisible(),
    false,
    "Discount controls start collapsed",
  );
  await page
    .getByRole("button", { name: "Pa vijueshmëri (0)", exact: true })
    .click();
  await page
    .getByText("Nuk u gjetën nxënës me këtë kërkim ose filtër.")
    .waitFor();
  await page
    .getByRole("button", { name: "Me mungesa (2)", exact: true })
    .click();
  await page.getByLabel("Zgjidh Ana Test", { exact: true }).waitFor();
  const search = page.getByLabel("Kërko nxënës, kurs ose grup për faturim");
  await search.fill("Ana");
  await page
    .getByRole("button", { name: "Me mungesa (1)", exact: true })
    .waitFor();
  assert.equal(
    await page.getByLabel("Zgjidh Besa Test", { exact: true }).count(),
    0,
  );
  await search.fill("");
  await page.getByLabel("Zgjidh Besa Test", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Të gjithë (2)", exact: true })
    .click();
  await page.getByLabel("Zgjidh Ana Test", { exact: true }).waitFor();
  await mkdir("output/batch-invoices", { recursive: true });
  await page.screenshot({
    path: "output/batch-invoices/compact.png",
    fullPage: true,
  });
  await page.getByLabel("Ndrysho çmimin për Ana Test", { exact: true }).click();
  await page.getByLabel("Zbritja për Ana Test", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Ana Test", exact: true }).click();
  const profile = page.getByRole("dialog", {
    name: "Profili · Ana Test",
    exact: true,
  });
  await profile
    .getByRole("button", { name: "Regjistro faturën", exact: true })
    .click();
  const invoiceForm = page.getByRole("dialog", {
    name: "Regjistro faturën",
    exact: true,
  });
  await invoiceForm.waitFor();
  assert.equal(
    await invoiceForm
      .getByRole("combobox", { name: "Kërko: Nxënësi", exact: true })
      .inputValue(),
    "Ana Test",
  );
  assert.equal(
    requests.length,
    0,
    "Opening invoice from profile does not create it",
  );
  await page.keyboard.press("Escape");
  await profile.waitFor();
  await page.keyboard.press("Escape");
  await profile.waitFor({ state: "hidden" });
  assert.equal(
    await page.getByLabel("Zbritja për Ana Test").inputValue(),
    "0.00",
    "No automatic absence deduction",
  );
  assert.equal(
    await page.getByText("2 mungesa (A)", { exact: true }).count(),
    2,
  );
  assert.equal(requests.length, 0, "Preparing does not issue invoices");
  await page.getByLabel("Zgjidh të gjithë në këtë faqe").check();
  await page.getByLabel("Zbritja për Ana Test").fill("61");
  await page
    .getByRole("button", { name: "Regjistro faturat e zgjedhura" })
    .click();
  await page.getByRole("alert").filter({ hasText: "zbritja duhet" }).waitFor();
  await page.getByLabel("Zbritja për Ana Test").fill("10");
  await page
    .getByRole("button", { name: "Regjistro faturat e zgjedhura" })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "shkruani arsyen" })
    .waitFor();
  await page
    .getByLabel("Arsyeja për Ana Test")
    .fill("Zbritje për mungesat, vendim i adminit");
  await page.getByLabel("Çmimi për Ana Test", { exact: true }).fill("50");
  assert.equal(
    await page.getByLabel("Zbritja për Ana Test").inputValue(),
    "10.00",
  );
  const anaRow = page
    .locator(".batch-invoice-table tbody tr")
    .filter({
      has: page.getByRole("button", { name: "Ana Test", exact: true }),
    });
  await anaRow
    .getByRole("button", { name: "Ruaj çmimin për këtë muaj", exact: true })
    .click();
  await anaRow.getByText(/I ruajtur: 50.00 € për/).waitFor();
  assert.equal(
    requests.length,
    0,
    "Saving a monthly price does not issue an invoice",
  );
  await page.getByRole("button", { name: "Rifresko", exact: true }).click();
  await page.getByLabel("Zgjidh Ana Test", { exact: true }).waitFor();
  await page.getByLabel("Ndrysho çmimin për Ana Test", { exact: true }).click();
  assert.equal(
    await page.getByLabel("Çmimi për Ana Test", { exact: true }).inputValue(),
    "50.00",
    "Saved price survives refresh",
  );
  await search.fill("Besa");
  await page.getByLabel("Zgjidh Besa Test", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Të gjithë (1)", exact: true })
    .waitFor();
  await search.fill("");
  await page.getByLabel("Zgjidh Ana Test", { exact: true }).waitFor();
  await page.getByLabel("Ndrysho çmimin për Ana Test", { exact: true }).click();
  assert.equal(
    await page.getByLabel("Zbritja për Ana Test").inputValue(),
    "10.00",
    "Discount survives searching and returning",
  );
  assert.match(
    await page.getByLabel("Arsyeja për Ana Test").inputValue(),
    /vendim i adminit/,
  );
  await page.getByLabel("Zgjidh të gjithë në këtë faqe").check();
  await page.screenshot({
    path: "output/batch-invoices/review.png",
    fullPage: true,
  });
  for (const width of [1440, 1100, 800]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({
      path: `output/batch-invoices/review-${width}.png`,
      fullPage: true,
    });
    assert(
      await page
        .locator(".batch-invoice-table")
        .evaluate(
          (table) => table.scrollWidth <= table.parentElement.clientWidth + 1,
        ),
      `Invoice rows fit at ${width}px`,
    );
    await page.screenshot({
      path: `output/batch-invoices/review-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.screenshot({
    path: "output/batch-invoices/review-dark.png",
    fullPage: true,
  });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await page
    .getByRole("button", { name: "Regjistro faturat e zgjedhura" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Konfirmo faturat e zgjedhura",
  });
  await dialog.waitFor();
  assert.match(await dialog.innerText(), /110.00 €/);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(requests.length, 0, "ESC cancels without issuing");
  await page
    .getByRole("button", { name: "Regjistro faturat e zgjedhura" })
    .click();
  await dialog.getByRole("button", { name: "Konfirmo regjistrimin" }).click();
  await page.keyboard.press("Escape");
  assert.equal(await dialog.count(), 1, "ESC cannot close while saving");
  await dialog
    .getByText("U regjistruan 1 nga 2 fatura.", { exact: true })
    .waitFor();
  assert.equal(requests[0].amount, "50.00");
  assert.equal(requests[1].amount, "60.00");
  await dialog.getByText(/Mungesat kanë ndryshuar/).waitFor();
  await page.screenshot({
    path: "output/batch-invoices/result.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Përfundo" }).click();
  await page.getByLabel("Zgjidh Besa Test", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("Zgjidh Ana Test", { exact: true }).count(),
    0,
  );
  await page.getByLabel("Zgjidh Besa Test", { exact: true }).check();
  await page
    .getByRole("button", { name: "Regjistro faturat e zgjedhura" })
    .click();
  await dialog.getByRole("button", { name: "Konfirmo regjistrimin" }).click();
  await dialog
    .getByText("U regjistruan 1 nga 1 fatura.", { exact: true })
    .waitFor();
  await dialog.getByRole("button", { name: "Përfundo" }).click();
  await page.getByText(/Nuk ka fatura të reja për të regjistruar/).waitFor();
  assert.equal(created.size, 2);
  assert.equal(requests.length, 3);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: manual discount, previous attendance, selection, validation, confirmation, ESC, partial failure and retry without duplicates.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}

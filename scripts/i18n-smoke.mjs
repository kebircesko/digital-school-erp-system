// Isolated browser or packaged desktop fixtures; never connects to the school database.
// ERP_DESKTOP_EXECUTABLE=/path/to/app.AppImage node scripts/i18n-smoke.mjs
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, _electron } from "playwright";
const executable = process.env.ERP_DESKTOP_EXECUTABLE;
const { version } = JSON.parse(
  await readFile(
    new URL("../apps/desktop/package.json", import.meta.url),
    "utf8",
  ),
);
const outputDir = executable ? `output/desktop-${version}` : "output/i18n";
const origin = "http://127.0.0.1:5181";
const vite = executable
  ? null
  : spawn(
      process.execPath,
      [
        "../../node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "5181",
        "--strictPort",
      ],
      { cwd: "apps/desktop", stdio: "ignore" },
    );
let browser, page, desktop, profile;
try {
  if (executable) {
    profile = await mkdtemp(join(tmpdir(), "erp-desktop-verify-"));
    const env = {
      ...process.env,
      ELECTRON_DEV: "0",
      APPIMAGE_EXTRACT_AND_RUN: "1",
      XDG_CONFIG_HOME: join(profile, "config"),
      XDG_CACHE_HOME: join(profile, "cache"),
    };
    delete env.ELECTRON_RUN_AS_NODE;
    desktop = await _electron.launch({
      executablePath: resolve(executable),
      args: ["--no-sandbox", `--user-data-dir=${join(profile, "profile")}`],
      env,
      timeout: 60000,
    });
    const metadata = await desktop.evaluate(({ app }) => ({
      version: app.getVersion(),
      packaged: app.isPackaged,
      userData: app.getPath("userData"),
    }));
    assert.equal(metadata.packaged, true, "Test the packaged application");
    assert.equal(metadata.version, version);
    assert.ok(
      metadata.userData.startsWith(profile),
      "Isolate all test settings from the user's desktop app",
    );
    page = await desktop.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    assert.equal(new URL(page.url()).origin, "null");
    assert.ok(page.url().startsWith("app://erp/"));
    assert.equal(
      await page.evaluate(() => typeof window.desktop.saveFile),
      "function",
    );
  } else {
    for (let i = 0; i < 80; i++) {
      if (
        await fetch(origin)
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
    page = await browser.newPage({
      viewport: { width: 1600, height: 1050 },
      locale: "en-US",
    });
  }
  page.setDefaultTimeout(10000);
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const student = {
    id: "s1",
    firstName: "Arbër",
    lastName: "Gashi",
    birthDate: "2010-05-05",
    parentName: "Prind Test",
    parentPhone: "044123456",
    status: "ACTIVE",
  };
  const user = { id: "u1", name: "Admin Test", role: "ADMIN" };
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname.replace(/^\/api/, ""),
      lang = route.request().headers()["accept-language"];
    requests.push({ path, lang, method: route.request().method() });
    let body = { items: [], total: 0, page: 1, pages: 1 },
      status = 200;
    if (path === "/auth/login") body = { token: "fixture", user };
    if (path === "/auth/me") body = user;
    if (path === "/dashboard")
      body = {
        total: 1,
        active: 1,
        inactive: 0,
        courses: 1,
        groups: 1,
        recent: [{ ...student, createdAt: "2026-10-01" }],
      };
    if (path === "/dashboard/payment-reminders")
      body = { upcoming: { total: 0 }, overdue: { total: 0 } };
    if (path === "/invoice-review/reminders")
      body = {
        total: 1,
        current: { count: 1, period: "2026-11" },
        next: { count: 0, period: "2026-12" },
      };
    if (path === "/students") {
      if (route.request().method() === "POST") {
        status = 400;
        body = { message: "Data e lindjes është e pavlefshme." };
      } else body = { items: [student], total: 1, page: 1, pages: 1 };
    }
    if (path === "/invoice-review/pending") {
      const period = url.searchParams.get("period");
      body = {
        items: [
          {
            enrollmentId: "e1",
            studentId: "s1",
            studentName: "Arbër Gashi",
            courseName: "Programim",
            groupName: "Grupi A",
            instructorName: "Instruktor Test",
            period,
            monthlyPrice: "40.00",
            suggestedAmount: "40.00",
            dueDate: `${period}-15`,
            attendance: { current: null, previous: null },
            reviewToken: "fixture",
          },
        ],
        total: 1,
        page: 1,
        pages: 1,
        summary: { all: 1, absences: 0, missing: 1, regular: 0 },
      };
    }
    if (path === "/invoices")
      body = {
        items: [
          {
            id: "i1",
            number: "FAT-TEST",
            studentId: "s1",
            studentName: "Arbër Gashi",
            courseName: "Programim",
            groupName: "Grupi A",
            period: "2026-11",
            issuedAt: "2026-11-01",
            dueDate: "2026-11-15",
            amount: "40.00",
            paidAmount: "0.00",
            balance: "40.00",
            status: "UNPAID",
          },
        ],
        total: 1,
        page: 1,
        pages: 1,
      };
    if (path === "/reports/financial")
      body = { total: "0.00", rows: [], courses: [], groups: [], methods: [] };
    if (path === "/reports/debts") body = { total: "0.00", items: [] };
    if (path === "/audit")
      body = {
        items: [
          {
            id: "a1",
            action: "STUDENT_CREATE",
            user,
            createdAt: "2026-11-01T12:00:00Z",
            entityId: "s1",
          },
        ],
        pages: 1,
      };
    if (path === "/backups") body = [];
    if (path === "/reports/financial.pdf") {
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        body: await readFile(`output/i18n/report-${lang}.pdf`),
      });
      return;
    }
    await route.fulfill({ status, json: body });
  });
  await mkdir(outputDir, { recursive: true });
  if (!executable) await page.goto(origin);
  await page
    .getByRole("heading", { name: "Kyçuni në hapësirën tuaj", exact: true })
    .waitFor();
  assert.equal(
    await page.locator("html").getAttribute("lang"),
    "sq",
    "Albanian default even in an English browser",
  );
  assert.equal(
    await page.getByLabel("Gjuha", { exact: true }).inputValue(),
    "sq",
  );
  await page.getByLabel("Emaili", { exact: true }).fill("admin@test.invalid");
  await page.getByLabel("Gjuha", { exact: true }).selectOption("en");
  await page
    .getByRole("heading", { name: "Sign in to your workspace", exact: true })
    .waitFor();
  assert.equal(
    await page.getByLabel("Email", { exact: true }).inputValue(),
    "admin@test.invalid",
    "Switch preserves login fields",
  );
  await page.screenshot({
    path: `${outputDir}/login-en.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("heading", { name: /Welcome,/ }).waitFor();
  await page.getByText("All registered students", { exact: true }).waitFor();
  assert.equal(requests.find((r) => r.path === "/auth/login").lang, "en");
  const sidebar = page.locator(".sidebar");
  await sidebar.getByRole("button", { name: "Students", exact: true }).click();
  await page.getByRole("heading", { name: "Students", exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Register student", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("First name", { exact: true }).fill("Test Name");
  await page.getByLabel("Language", { exact: true }).selectOption("sq");
  assert.equal(
    await dialog.getByLabel("Emri", { exact: true }).inputValue(),
    "Test Name",
    "Language switch preserves open forms",
  );
  await page.getByLabel("Gjuha", { exact: true }).selectOption("en");
  await dialog.getByLabel("Last name", { exact: true }).fill("Test Surname");
  await dialog.getByLabel("Date of birth", { exact: true }).fill("2010-05-05");
  await dialog
    .getByLabel("Parent / guardian name", { exact: true })
    .fill("Parent Test");
  await dialog.getByLabel("Parent phone", { exact: true }).fill("044123456");
  await dialog
    .getByRole("button", { name: "Save student", exact: true })
    .click();
  await dialog
    .getByText("The date of birth is invalid.", { exact: true })
    .waitFor();
  await page.getByLabel("Language", { exact: true }).selectOption("sq");
  await dialog
    .getByText("Data e lindjes është e pavlefshme.", { exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.getByLabel("Gjuha", { exact: true }).selectOption("en");
  // Search controls and dynamic status labels translate without changing student data.
  await page.getByPlaceholder("Search name, parent or phone…").waitFor();
  await page.getByText("Arbër Gashi", { exact: true }).waitFor();
  await page.getByRole("table").getByText("Active", { exact: true }).waitFor();
  await page
    .locator(".sidebar .nav-group")
    .evaluateAll((ds) => ds.forEach((d) => (d.open = true)));
  for (const [nav, heading, add, field] of [
    ["Courses", "Courses", "Add course", "Course name"],
    ["Groups", "Groups", "Add group", "Group name"],
    ["Users", "Users", "Add user", "First name"],
  ]) {
    await page
      .locator(".sidebar .nav-group")
      .evaluateAll((ds) => ds.forEach((d) => (d.open = true)));
    await sidebar.getByRole("button", { name: nav, exact: true }).click();
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
    await page.getByRole("button", { name: add, exact: true }).click();
    await page.getByRole("dialog").getByLabel(field, { exact: true }).waitFor();
    await page.keyboard.press("Escape");
  }
  await sidebar.getByRole("button", { name: "Invoices", exact: true }).click();
  await page.getByRole("table").getByText("Unpaid", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Monthly invoices", exact: true })
    .click();
  await page.getByLabel("Select Arbër Gashi", { exact: true }).waitFor();
  await page
    .getByLabel("Change discount for Arbër Gashi", { exact: true })
    .click();
  await page.getByLabel("Discount for Arbër Gashi", { exact: true }).fill("5");
  await page
    .getByLabel("Reason for Arbër Gashi", { exact: true })
    .fill("Test discount");
  await page.getByLabel("Select Arbër Gashi", { exact: true }).check();
  await page.getByLabel("Language", { exact: true }).selectOption("sq");
  assert.equal(
    await page
      .getByLabel("Zbritja për Arbër Gashi", { exact: true })
      .inputValue(),
    "5",
  );
  assert.equal(
    await page.getByLabel("Zgjidh Arbër Gashi", { exact: true }).isChecked(),
    true,
  );
  await page.getByLabel("Gjuha", { exact: true }).selectOption("en");
  await page
    .getByRole("button", { name: "Record selected invoices", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Confirm selected invoices", exact: true })
    .waitFor();
  await page
    .getByRole("dialog")
    .getByText("35.00 €", { exact: true })
    .first()
    .waitFor();
  await page.keyboard.press("Escape");
  assert.equal(
    requests.filter((r) => r.path === "/invoice-review/approve").length,
    0,
    "Localization test never issues invoices",
  );
  await page.screenshot({
    path: `${outputDir}/monthly-en.png`,
    fullPage: true,
    animations: "disabled",
  });
  await sidebar.getByRole("button", { name: "Reports", exact: true }).click();
  await page
    .getByRole("heading", { name: "Financial reports", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "PDF / Print", exact: true }).click();
  await page
    .getByRole("dialog", { name: "PDF preview", exact: true })
    .waitFor();
  await page.locator(".pdf-canvas-pages canvas").waitFor({ timeout: 30000 });
  assert.equal(
    requests.filter((r) => r.path.endsWith(".pdf")).at(-1).lang,
    "en",
  );
  await page.getByLabel("Language", { exact: true }).selectOption("sq");
  await page
    .locator(".pdf-canvas-pages canvas[aria-label='Faqja 1 e PDF-së']")
    .waitFor();
  assert.equal(
    requests.filter((r) => r.path.endsWith(".pdf")).at(-1).lang,
    "sq",
    "Changing language refreshes the open PDF",
  );
  await page.keyboard.press("Escape");
  await page.getByLabel("Gjuha", { exact: true }).selectOption("en");
  await page
    .locator(".sidebar .nav-group")
    .evaluateAll((ds) => ds.forEach((d) => (d.open = true)));
  await sidebar.getByRole("button", { name: "History", exact: true }).click();
  await page.getByText("Student registration", { exact: true }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: /Welcome,/ }).waitFor();
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
  assert.equal(
    await page.getByLabel("Language", { exact: true }).inputValue(),
    "en",
    "Choice persists after reload",
  );
  await page.screenshot({
    path: `${outputDir}/dashboard-en.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByLabel("Language", { exact: true }).selectOption("sq");
  await page.getByRole("heading", { name: /Mirë se erdhe,/ }).waitFor();
  await page.screenshot({
    path: `${outputDir}/dashboard-sq.png`,
    fullPage: true,
    animations: "disabled",
  });
  if (desktop) {
    const destination = join(profile, "native-save.pdf");
    await desktop.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async (_window, options) => {
        globalThis.__erpSaveFilter = options.filters[0].name;
        return { canceled: false, filePath: file };
      };
    }, destination);
    const content = [...(await readFile("output/i18n/invoice-en.pdf"))];
    assert.equal(
      await page.evaluate(
        (data) =>
          window.desktop.saveFile(
            new Uint8Array(data),
            "native-save.pdf",
            "en",
          ),
        content,
      ),
      true,
    );
    assert.deepEqual([...(await readFile(destination))], content);
    assert.equal(
      await desktop.evaluate(() => globalThis.__erpSaveFilter),
      "ERP document",
    );
    const invalid = await page.evaluate(async () => {
      try {
        await window.desktop.saveFile(new Uint8Array([1]), "../bad.pdf", "en");
      } catch (error) {
        return error.message;
      }
    });
    assert.match(invalid, /The file name is invalid/);
    console.log(
      `PASS: packaged AppImage ${version}, app:// assets, shared translations, preload bridge and native save dialog.`,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: Albanian default, English navigation/forms/statuses/errors, live switching without losing inputs, persistence, monthly draft/selection, PDF request language and refresh, audit labels. School data unchanged.",
  );
} catch (error) {
  if (page) {
    console.error(await page.getByRole("dialog").allTextContents());
    await page.screenshot({ path: `${outputDir}/failure.png`, fullPage: true });
  }
  throw error;
} finally {
  await desktop?.close();
  await browser?.close();
  vite?.kill("SIGTERM");
  if (profile) await rm(profile, { recursive: true, force: true });
}

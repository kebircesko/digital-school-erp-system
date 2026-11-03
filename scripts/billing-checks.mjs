import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import {
  arrearsPlan,
  seedArrears,
  inspectArrears,
} from "./seed-arrears-demo.mjs";
import { chromium, _electron } from "playwright";

export async function billingChecks({
  request,
  admin,
  finance,
  instructor,
  db,
  base,
  loginPassword,
}) {
  // The preceding role tests deliberately rotate the finance account's password.
  await request(
    "/users",
    "POST",
    {
      name: "Financa Faturimi",
      email: "billing-finance@test.invalid",
      role: "FINANCE",
      active: true,
      password: loginPassword,
    },
    admin,
    201,
  );
  finance = (
    await request(
      "/auth/login",
      "POST",
      { email: "billing-finance@test.invalid", password: loginPassword },
      undefined,
      201,
    )
  ).token;
  instructor = (
    await request(
      "/auth/login",
      "POST",
      { email: "instructor@test.invalid", password: loginPassword },
      undefined,
      201,
    )
  ).token;
  let checks = 0;
  const check = (value, label) => {
    assert(value, label);
    checks++;
  };
  const now = new Date();
  const period = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Tirane" })
    .format(now)
    .slice(0, 7);
  const previous = new Date(`${period}-01T00:00:00Z`);
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  const oldPeriod = previous.toISOString().slice(0, 7);
  const student = await request(
    "/students",
    "POST",
    {
      firstName: "Afati",
      lastName: "Prova",
      birthDate: "2013-05-10",
      parentName: "Prind Prova",
      parentPhone: "000000321",
      address: "",
      notes: "",
      status: "ACTIVE",
    },
    admin,
    201,
  );
  const course = await request(
    "/courses",
    "POST",
    {
      name: "Kurs Afati",
      monthlyPrice: "80.00",
      description: "",
      durationMonths: 12,
      status: "ACTIVE",
    },
    admin,
    201,
  );
  const teacher = await db.user.findUnique({
    where: { email: "instructor@test.invalid" },
  });
  const group = await request(
    "/groups",
    "POST",
    {
      name: "Grupi Afati",
      courseId: course.id,
      instructorId: teacher.id,
      days: [1, 3],
      startTime: "16:00",
      durationMinutes: 90,
      capacity: 15,
      status: "ACTIVE",
    },
    admin,
    201,
  );
  const day = Math.min(
    29,
    new Date(
      previous.getUTCFullYear(),
      previous.getUTCMonth() + 1,
      0,
    ).getDate(),
  );
  await request(
    "/enrollments",
    "POST",
    {
      studentId: student.id,
      groupId: group.id,
      startDate: `${oldPeriod}-${String(day).padStart(2, "0")}`,
      monthlyPrice: "80.00",
      discount: "0.00",
      offer: "",
    },
    admin,
    201,
  );
  const invoices = [];
  for (const month of [oldPeriod, period]) {
    const pending = await request(
      `/invoice-review/pending?studentId=${student.id}&period=${month}`,
      "GET",
      undefined,
      admin,
    );
    const row = pending.items.find((row) => row.studentId === student.id);
    const following = new Date(`${month}-01T00:00:00Z`);
    following.setUTCMonth(following.getUTCMonth() + 1);
    const maxDay = new Date(
      Date.UTC(following.getUTCFullYear(), following.getUTCMonth() + 1, 0),
    ).getUTCDate();
    check(
      row.dueDate ===
        `${following.toISOString().slice(0, 7)}-${String(Math.min(day, maxDay)).padStart(2, "0")}`,
      "Next payment follows the enrollment anniversary one month later",
    );
    invoices.push(
      await request(
        "/invoice-review/approve",
        "POST",
        {
          period: month,
          enrollmentId: row.enrollmentId,
          amount: row.suggestedAmount,
          notes: "",
          reviewToken: row.reviewToken,
        },
        admin,
        201,
      ),
    );
  }
  const [older, newer] = invoices;
  const payment = (allocations, key = randomUUID()) => ({
    studentId: student.id,
    amount:
      allocations.reduce(
        (sum, row) => sum + Math.round(Number(row.amount) * 100),
        0,
      ) /
        100 +
      ".00",
    method: "CASH",
    paidAt: `${period}-01`,
    notes: "",
    idempotencyKey: key,
    allocations,
  });
  await request(
    "/payments",
    "POST",
    payment([{ invoiceId: newer.id, amount: "10.00" }]),
    finance,
    409,
  );
  checks++;
  await request(
    "/payments",
    "POST",
    payment([{ invoiceId: older.id, amount: "30.00" }]),
    finance,
    201,
  );
  await request(
    "/payments",
    "POST",
    payment([{ invoiceId: newer.id, amount: "10.00" }]),
    finance,
    409,
  );
  checks++;
  const combined = payment([
    { invoiceId: newer.id, amount: "20.00" },
    { invoiceId: older.id, amount: "50.00" },
  ]);
  const paid = await request("/payments", "POST", combined, finance, 201);
  const replay = await request("/payments", "POST", combined, finance, 201);
  check(replay.id === paid.id, "Ordered combined payment remains idempotent");
  await request(
    "/payments",
    "POST",
    payment([{ invoiceId: newer.id, amount: "60.00" }]),
    finance,
    201,
  );
  const changed = await db.invoice.findUnique({ where: { id: newer.id } });
  check(
    changed.status === "PAID",
    "New month can be paid after prior month settles",
  );
  await request(
    `/payments/${paid.id}/reverse`,
    "POST",
    { reason: "Provë e rihapjes së borxhit" },
    admin,
    201,
  );
  await request(
    "/payments",
    "POST",
    payment([{ invoiceId: newer.id, amount: "20.00" }]),
    finance,
    409,
  );
  checks++;
  // Existing deadlines only change through an explicit administrator action.
  await db.invoice.update({
    where: { id: newer.id },
    data: { dueDate: new Date(`${period}-15`) },
  });
  const before = await request(
    `/invoices/${newer.id}`,
    "GET",
    undefined,
    admin,
  );
  check(
    before.canUpdateDeadline && before.registrationDueDate.slice(-2) !== "15",
    "Old invoices expose a registration-based correction",
  );
  await request(
    `/invoices/${newer.id}/registration-deadline`,
    "POST",
    undefined,
    finance,
    403,
  );
  checks++;
  await request(
    `/invoices/${newer.id}/registration-deadline`,
    "POST",
    undefined,
    admin,
    201,
  );
  const after = await request(`/invoices/${newer.id}`, "GET", undefined, admin);
  check(
    after.dueDate.slice(0, 10) === after.registrationDueDate &&
      after.amount === before.amount &&
      after.paidAmount === before.paidAmount,
    "Deadline correction leaves money unchanged",
  );
  check(
    (await db.auditLog.count({
      where: { entityId: newer.id, action: "INVOICE_DEADLINE_UPDATE" },
    })) === 1,
    "Deadline correction is audited",
  );
  await request(`/invoices/${newer.id}`, "GET", undefined, instructor, 403);
  checks++;

  const demoPlan = arrearsPlan(period);
  check(
    (await seedArrears(db, demoPlan)).created,
    "Ten arrears demo students are created atomically",
  );
  const demoReport = await inspectArrears(db, demoPlan);
  check(
    demoReport.count === 10 &&
      demoReport.students.filter(
        (row) => row.unpaidMonths.length === 3 && row.debt === "120.00",
      ).length === 5 &&
      demoReport.students.filter(
        (row) => row.unpaidMonths.length === 5 && row.debt === "200.00",
      ).length === 5,
    "Five three-month and five five-month debts are complete",
  );
  const demoInvoice = await db.invoice.findFirst({
    where: { studentId: demoPlan.students[0].id },
    orderBy: { period: "asc" },
  });
  await request(
    "/payments",
    "POST",
    {
      studentId: demoPlan.students[0].id,
      idempotencyKey: randomUUID(),
      amount: "10.00",
      method: "CASH",
      paidAt: `${period}-01`,
      notes: "Provë e të dhënave demo",
      allocations: [{ invoiceId: demoInvoice.id, amount: "10.00" }],
    },
    finance,
    201,
  );
  check(
    !(await seedArrears(db, demoPlan)).created,
    "Re-running demo fixture creates no duplicates",
  );
  check(
    (
      await db.invoice.findUnique({ where: { id: demoInvoice.id } })
    ).paidAmount.toFixed(2) === "10.00",
    "Re-running demo fixture preserves test payments",
  );

  const port = "5189",
    url = `http://127.0.0.1:${port}`;
  const vite = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "apps/desktop",
      "--host",
      "127.0.0.1",
      "--port",
      port,
      "--strictPort",
    ],
    {
      env: { ...process.env, VITE_API_URL: base },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let viteLogs = "";
  vite.stderr.on("data", (data) => (viteLogs += data));
  let browser, desktop;
  await mkdir("output/billing-preview", { recursive: true });
  try {
    for (let i = 0; i < 100; i++) {
      try {
        await fetch(url);
        break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (vite.exitCode !== null) throw new Error(viteLogs);
    }
    browser = await chromium.launch({
      channel: "chrome",
      headless: true,
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.setDefaultTimeout(20000);
    await page.addInitScript(() => {
      window.__printed = 0;
      window.print = () => {
        window.__printed++;
      };
    });
    await page.goto(url);
    await page.getByLabel("Emaili", { exact: true }).fill("admin@test.invalid");
    await page.getByLabel("Fjalëkalimi", { exact: true }).fill(loginPassword);
    await page.getByRole("button", { name: "Kyçu në platformë" }).click();
    await page.getByRole("heading", { name: /Mirë se erdhe/ }).waitFor();
    await page
      .getByRole("button", { name: "Veprim i ri", exact: true })
      .click();
    await page
      .locator("#quick-create-actions")
      .getByRole("button", { name: "Regjistro pagesë", exact: true })
      .click();
    const paymentDialog = page.getByRole("dialog");
    await paymentDialog
      .getByLabel("Kërko: Nxënësi", { exact: true })
      .fill("Afati Prova");
    await paymentDialog.getByRole("option", { name: /Afati Prova/ }).click();
    await paymentDialog.locator(".allocation-row").nth(1).waitFor();
    const oldCheck = paymentDialog
      .locator(".allocation-row")
      .first()
      .getByRole("checkbox");
    const newCheck = paymentDialog
      .locator(".allocation-row")
      .nth(1)
      .getByRole("checkbox");
    check(
      (await oldCheck.isChecked()) && !(await newCheck.isChecked()),
      "Payment search selects only the oldest month by default",
    );
    await paymentDialog
      .getByLabel("Shuma për " + older.number, { exact: true })
      .fill("20.00");
    check(
      await newCheck.isDisabled(),
      "Partial old-month allocation leaves newer month blocked",
    );
    await paymentDialog
      .getByLabel("Shuma për " + older.number, { exact: true })
      .fill("50.00");
    check(
      !(await newCheck.isDisabled()),
      "Fully covering old debt enables the optional newer month",
    );
    await paymentDialog
      .getByRole("button", { name: "Anulo", exact: true })
      .click();
    await page.getByLabel("Kërko nxënës nga çdo faqe").fill("Afati");
    await page
      .locator(".quick-results")
      .getByRole("button", { name: /Afati Prova/ })
      .click();
    const profile = page.getByRole("dialog", { name: "Profili · Afati Prova" });
    await profile.getByRole("region", { name: "Muajt e papaguar" }).waitFor();
    const rows = profile.locator(".outstanding-month");
    check((await rows.count()) === 2, "Profile lists both unpaid months");
    check(
      await rows.nth(1).getByRole("button").isDisabled(),
      "Newer month is blocked in profile",
    );
    await rows
      .first()
      .getByRole("button", { name: "Paguaj këtë muaj", exact: true })
      .click();
    const invoice = page.getByRole("dialog", { name: "Fatura", exact: true });
    await invoice.getByLabel("Shuma e pagesës EUR").waitFor();
    check(
      (await invoice.getByLabel("Shuma e pagesës EUR").inputValue()) ===
        "50.00",
      "Oldest month balance is proposed",
    );
    let downloads = 0;
    page.on("download", () => downloads++);
    await invoice
      .getByRole("button", { name: "Shiko PDF", exact: true })
      .click();
    const pdf = page.getByRole("dialog", { name: "Pamja PDF", exact: true });
    await pdf.locator("canvas").waitFor();
    await pdf.getByRole("button", { name: "Printo", exact: true }).waitFor();
    await page.waitForFunction(
      () => !document.querySelector(".pdf-preview-toolbar button")?.disabled,
    );
    check(downloads === 0, "Preview does not force a download");
    await page.screenshot({
      path: "output/billing-preview/pdf-preview.png",
      fullPage: true,
    });
    await pdf.getByRole("button", { name: "Printo", exact: true }).click();
    await page.waitForFunction(() => window.__printed === 1);
    check(
      (await page.evaluate(() => window.__printed)) === 1,
      "Preview offers explicit print",
    );
    await page.emulateMedia({ media: "print" });
    await page.screenshot({
      path: "output/billing-preview/print-layout.png",
      fullPage: true,
    });
    await page.emulateMedia({ media: "screen" });
    const downloadPromise = page.waitForEvent("download");
    await pdf.getByRole("button", { name: "Ruaj PDF", exact: true }).click();
    const file = await downloadPromise;
    check(
      (await readFile(await file.path())).subarray(0, 5).toString() === "%PDF-",
      "Save preserves original PDF bytes",
    );
    await page.keyboard.press("Escape");
    await pdf.waitFor({ state: "hidden" });
    check(
      (await invoice.count()) === 1,
      "Escape closes only PDF, preserving the underlying invoice",
    );
    const paymentsBeforeSave = await db.payment.count({
      where: { studentId: student.id },
    });
    let releasePayment;
    const paymentGate = new Promise((resolve) => {
      releasePayment = resolve;
    });
    const holdPayment = async (route) => {
      if (route.request().method() === "POST") await paymentGate;
      await route.continue();
    };
    await page.route("**/api/payments", holdPayment);
    try {
      const savingRequest = page.waitForRequest(
        (req) => req.url().endsWith("/api/payments") && req.method() === "POST",
      );
      await invoice
        .getByRole("button", { name: "Ruaj pagesën", exact: true })
        .click();
      await savingRequest;
      await page.waitForFunction(
        () =>
          document.querySelector(".invoice-payment-form button.primary")
            ?.disabled,
      );
      await page.keyboard.press("Escape");
      check(
        (await invoice.count()) === 1 &&
          (await invoice
            .getByRole("button", { name: "Mbyll faturën", exact: true })
            .isDisabled()),
        "Escape waits while a payment is being saved",
      );
      releasePayment();
      await invoice.getByText(/Pagesa u ruajt/).waitFor();
      check(
        (await db.payment.count({ where: { studentId: student.id } })) ===
          paymentsBeforeSave + 1,
        "Escape during saving does not duplicate or lose the payment",
      );
    } finally {
      releasePayment();
      await page.unroute("**/api/payments", holdPayment);
    }
    await invoice
      .locator(".outstanding-month")
      .getByRole("button", { name: "Paguaj këtë muaj", exact: true })
      .click();
    await invoice.getByLabel("Shuma e pagesës EUR").waitFor();
    check(
      (await invoice.getByLabel("Shuma e pagesës EUR").inputValue()) ===
        "20.00",
      "UI unlocks newer month after older payment",
    );
    await page.keyboard.press("Escape");
    await invoice.waitFor({ state: "hidden" });
    await profile.waitFor();
    check(
      (await profile.count()) === 1,
      "Escape from invoice returns to student profile",
    );
    await profile
      .getByRole("button", { name: "Ndrysho të dhënat", exact: true })
      .click();
    const editDialog = page.getByRole("dialog");
    await editDialog.getByLabel("Emri", { exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await profile.waitFor();
    check(
      (await profile.count()) === 1,
      "Escape cancels editing and returns to profile",
    );
    await page.keyboard.press("Escape");
    await profile.waitFor({ state: "hidden" });
    check(
      (await page.getByRole("dialog").count()) === 0,
      "Escape closes profile without closing the app",
    );
    await page
      .getByRole("button", { name: "Veprim i ri", exact: true })
      .click();
    await page
      .locator("#quick-create-actions")
      .getByRole("button", { name: "Regjistro faturën", exact: true })
      .click();
    const newInvoice = page.getByRole("dialog", {
      name: "Regjistro faturën",
      exact: true,
    });
    await newInvoice
      .getByLabel("Kërko: Nxënësi", { exact: true })
      .fill("Afati");
    await newInvoice.getByRole("option", { name: /Afati Prova/ }).waitFor();
    await page.keyboard.press("Escape");
    check(
      (await newInvoice.count()) === 1 &&
        (await newInvoice.getByRole("listbox").count()) === 0,
      "Escape dismisses student suggestions before the invoice form",
    );
    await page.keyboard.press("Escape");
    await newInvoice.waitFor({ state: "hidden" });
    check(
      (await page.getByRole("dialog").count()) === 0,
      "Second Escape closes invoice creation",
    );
    await page
      .getByRole("button", { name: "Veprim i ri", exact: true })
      .click();
    await page
      .locator("#quick-create-actions")
      .getByRole("button", { name: "Regjistro pagesë", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Regjistro pagesë", exact: true })
      .waitFor();
    await page.keyboard.press("Escape");
    check(
      (await page.getByRole("dialog").count()) === 0,
      "Escape closes payment creation",
    );
    await page
      .locator("nav")
      .getByRole("button", { name: "Nxënësit", exact: true })
      .click();
    await page.getByLabel("Kërko nxënës", { exact: true }).fill("Afati");
    const studentRow = page
      .locator("tbody tr")
      .filter({ hasText: "Afati Prova" });
    await studentRow
      .getByRole("button", { name: "Fshi nxënësin", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Fshi nxënësin?", exact: true })
      .waitFor();
    await page.keyboard.press("Escape");
    check(
      (await page.getByRole("dialog").count()) === 0 &&
        Boolean(await db.student.findUnique({ where: { id: student.id } })),
      "Escape cancels deletion without changing records",
    );
    async function openPage(name) {
      const button = page
        .locator("nav")
        .getByRole("button", { name, exact: true });
      if (!(await button.isVisible()))
        await page
          .locator(".nav-group")
          .filter({ hasText: name })
          .locator("summary")
          .click();
      await button.click();
    }
    await openPage("Regjistrimet");
    await page.getByLabel("Kërko", { exact: true }).fill("Afati");
    const enrollmentRow = page
      .locator("tbody tr")
      .filter({ hasText: "Afati Prova" });
    await enrollmentRow
      .getByRole("button", { name: "Përfundo", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Përfundo regjistrimin", exact: true })
      .waitFor();
    await page.keyboard.press("Escape");
    check(
      (await page.getByRole("dialog").count()) === 0 &&
        (await db.enrollment.findFirst({ where: { studentId: student.id } }))
          .status === "ACTIVE",
      "Escape cancels enrollment completion",
    );
    await enrollmentRow
      .getByRole("button", { name: "Ndërro grupin", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Ndërro grupin", exact: true })
      .waitFor();
    await page.keyboard.press("Escape");
    check(
      (await page.getByRole("dialog").count()) === 0 &&
        (await db.enrollment.count({ where: { studentId: student.id } })) === 1,
      "Escape cancels group transfer without creating another enrollment",
    );
    await openPage("Faturat");
    await page
      .getByLabel("Kërko faturë ose pagesë", { exact: true })
      .fill("DEMO-FAT");
    const cancellation = page
      .locator("tbody tr")
      .filter({ has: page.getByRole("button", { name: "Anulo", exact: true }) })
      .first();
    await cancellation.waitFor();
    const number = await cancellation.locator(".invoice-number").innerText();
    await cancellation
      .getByRole("button", { name: "Anulo", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Anulo " + number, exact: true })
      .waitFor();
    await page.keyboard.press("Escape");
    check(
      (await page.getByRole("dialog").count()) === 0 &&
        (await db.invoice.findUnique({ where: { number } })).status ===
          "UNPAID",
      "Escape cancels invoice cancellation without voiding the invoice",
    );
    check(errors.length === 0, errors.join("; "));

    if (process.env.BILLING_ELECTRON_TEST === "1") {
      const env = { ...process.env, ELECTRON_DEV: "0" };
      delete env.ELECTRON_RUN_AS_NODE;
      desktop = await _electron.launch({
        args: ["apps/desktop"],
        env,
        timeout: 30000,
      });
      const win = await desktop.firstWindow();
      const desktopErrors = [];
      win.on("pageerror", (error) => desktopErrors.push(error.message));
      win.setDefaultTimeout(25000);
      await win.evaluate(
        (base) => localStorage.setItem("erp-api-url", base),
        base,
      );
      await win.reload();
      await win
        .getByLabel("Emaili", { exact: true })
        .fill("admin@test.invalid");
      await win.getByLabel("Fjalëkalimi", { exact: true }).fill(loginPassword);
      await win.getByRole("button", { name: "Kyçu në platformë" }).click();
      await win.getByLabel("Kërko nxënës nga çdo faqe").fill("Afati");
      await win
        .locator(".quick-results")
        .getByRole("button", { name: /Afati Prova/ })
        .click();
      await win
        .getByRole("dialog")
        .getByRole("button", {
          name: newer.number + " · " + period,
          exact: true,
        })
        .click();
      await win
        .getByRole("dialog", { name: "Fatura", exact: true })
        .getByRole("button", { name: "Shiko PDF", exact: true })
        .click();
      const nativePdf = win.getByRole("dialog", {
        name: "Pamja PDF",
        exact: true,
      });
      await nativePdf.locator("canvas").waitFor();
      await win.waitForFunction(
        () => !document.querySelector(".pdf-preview-toolbar button")?.disabled,
      );
      await win.screenshot({
        path: "output/billing-preview/electron-preview.png",
        fullPage: true,
      });
      await win.keyboard.press("Escape");
      await nativePdf.waitFor({ state: "hidden" });
      check(
        (await win
          .getByRole("dialog", { name: "Fatura", exact: true })
          .count()) === 1,
        "Desktop Escape closes PDF only",
      );
      await win.keyboard.press("Escape");
      await win
        .getByRole("dialog", { name: "Profili · Afati Prova", exact: true })
        .waitFor();
      await win.keyboard.press("Escape");
      check(
        (await win.getByRole("dialog").count()) === 0,
        "Desktop Escape closes invoice and profile one at a time",
      );
      check(desktopErrors.length === 0, desktopErrors.join("; "));
      checks++;
    }
  } finally {
    await desktop?.close();
    await browser?.close();
    vite.kill("SIGTERM");
  }
  console.log(
    `${checks} billing deadline, oldest-month, PDF preview/print/save checks passed.`,
  );
  return checks;
}

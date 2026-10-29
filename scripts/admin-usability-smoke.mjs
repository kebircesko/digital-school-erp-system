// Browser checks with isolated API fixtures; no school data is changed.
// Start Vite first, then: node scripts/admin-usability-smoke.mjs
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { calendarDay } from "../apps/desktop/src/services/format.js";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--no-sandbox"],
});
const student = {
  id: "student-1",
  firstName: "Arta",
  lastName: "Testi",
  parentName: "Prindi Test",
  parentPhone: "044123456",
  status: "ACTIVE",
  birthDate: "2013-01-15",
  createdAt: "2026-10-01",
  version: 1,
};
const course = {
  id: "course-1",
  name: "Programimi",
  monthlyPrice: "50.00",
  durationMonths: 12,
  status: "ACTIVE",
};
const group = {
  id: "group-1",
  name: "Grupi A",
  course,
  instructor: { name: "Instruktori" },
  days: [1, 3],
  startTime: "16:00",
  capacity: 15,
  status: "ACTIVE",
};
const invoice = {
  id: "invoice-1",
  number: "F-001",
  studentId: student.id,
  studentName: "Arta Testi",
  courseId: course.id,
  courseName: course.name,
  groupName: group.name,
  period: "2026-10",
  issuedAt: "2026-10-01",
  dueDate: "2026-10-10",
  status: "UNPAID",
  subtotal: "50.00",
  discount: "0.00",
  amount: "50.00",
  paidAmount: "0.00",
  balance: "50.00",
  allocations: [],
};
const list = (items) => ({ items, total: items.length, pages: 1 });
try {
  for (const role of ["ADMIN", "FINANCE", "INSTRUCTOR"]) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    page.setDefaultTimeout(10000);
    const errors = [],
      requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        path = url.pathname.replace(/^\/api/, "");
      requests.push({
        path,
        query: url.searchParams.toString(),
        method: req.method(),
        body: req.postDataJSON(),
      });
      let body;
      if (path === "/auth/login")
        body = { token: "test-token", user: { name: "Admin Test", role } };
      else if (path === "/dashboard")
        body = {
          total: 1,
          active: 1,
          inactive: 0,
          courses: 1,
          groups: 1,
          recent: [student],
          ...(role !== "INSTRUCTOR"
            ? {
                financial: {
                  unpaid: 1,
                  paid: 0,
                  daily: "10.00",
                  monthly: "20.00",
                  yearly: "30.00",
                  outstanding: "50.00",
                  chart: [{ month: "2026-10", amount: "20.00" }],
                },
              }
            : {}),
        };
      else if (path === "/dashboard/payment-reminders")
        body = {
          upcoming: { total: 0, items: [] },
          overdue: { total: 0, items: [] },
        };
      else if (path === "/invoice-review/reminders")
        body = {
          current: { count: 0, period: "2026-10" },
          next: { count: 0, period: "2026-11" },
          total: 0,
        };
      else if (path === "/students" && req.method() === "POST")
        body = { ...student, ...req.postDataJSON(), id: "new-student" };
      else if (/^\/students\/[^/]+\/history$/.test(path))
        body = { enrollments: [], invoices: [], payments: [] };
      else if (path.startsWith("/students/"))
        body = { ...student, id: path.split("/")[2] };
      else if (path === "/students") body = list([student]);
      else if (path === "/courses") body = list([course]);
      else if (path === "/groups") body = list([group]);
      else if (path === "/enrollments") body = list([]);
      else if (path === "/reports/financial")
        body = {
          total: "20.00",
          rows: [],
          courses: [],
          groups: [],
          methods: [],
        };
      else if (path === "/reports/debts")
        body = {
          total: "50.00",
          items: [
            {
              studentId: student.id,
              studentName: "Arta Testi",
              amount: "50.00",
              invoices: [invoice],
            },
          ],
        };
      else if (path === "/invoices/invoice-1") body = invoice;
      else if (path === "/invoice-review/pending") body = list([]);
      else body = list([]);
      await route.fulfill({ json: body });
    });
    await page.goto(process.env.ERP_UI_URL ?? "http://127.0.0.1:5178");
    await page.getByLabel("Emaili", { exact: true }).fill("admin@test.invalid");
    await page.getByLabel("Fjalëkalimi", { exact: true }).fill("test-password");
    await page.getByRole("button", { name: "Kyçu në platformë" }).click();
    await page.getByRole("heading", { name: /Mirë se erdhe/ }).waitFor();
    assert.equal(
      await page
        .getByRole("region", { name: "Puna për sot", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Regjistrim i plotë", exact: true })
        .count(),
      0,
    );
    assert.equal(await page.locator(".registration-progress").count(), 0);
    await page
      .getByRole("button", {
        name: "Nxënës aktivë: 1. Hap listën",
        exact: true,
      })
      .click();
    assert.equal(
      await page.getByLabel("Filtro statusin").inputValue(),
      "ACTIVE",
    );
    await page.getByRole("button", { name: "Kthehu", exact: true }).click();
    await page.getByRole("heading", { name: /Mirë se erdhe/ }).waitFor();
    const search = page.getByLabel("Kërko nxënës nga çdo faqe");
    await page.keyboard.press("Control+k");
    assert.equal(
      await search.evaluate((el) => el === document.activeElement),
      true,
    );
    await search.fill("044123456");
    await page
      .locator(".quick-results")
      .getByRole("button", { name: /Arta Testi/ })
      .click();
    await page.getByRole("dialog", { name: "Profili · Arta Testi" }).waitFor();
    if (role !== "INSTRUCTOR") {
      await page
        .getByRole("button", { name: "Regjistro në kurs / grup" })
        .click();
      assert.equal(
        await page
          .getByRole("dialog")
          .getByLabel("Nxënësi", { exact: true })
          .inputValue(),
        `${student.firstName} ${student.lastName}`,
      );
      await page
        .getByRole("dialog")
        .getByLabel("Grupi", { exact: true })
        .selectOption(group.id);
      assert.equal(
        await page
          .getByRole("dialog")
          .getByLabel("Grupi", { exact: true })
          .locator("option:checked")
          .textContent(),
        "Grupi A · Instruktori",
      );
      assert.equal(
        await page
          .getByRole("dialog")
          .getByText("Instruktori: Instruktori", { exact: true })
          .count(),
        1,
      );
      assert.equal(
        await page
          .getByRole("dialog")
          .getByLabel("Çmimi individual mujor EUR")
          .inputValue(),
        "0.00",
      );
      await page.getByRole("button", { name: "Anulo", exact: true }).click();
    } else {
      assert.equal(
        await page
          .getByRole("button", { name: "Regjistro në kurs / grup" })
          .count(),
        0,
      );
      assert.equal(
        await page.getByRole("button", { name: "Veprim i ri" }).count(),
        0,
      );
    }
    await page
      .getByRole("button", { name: "Mbyll historikun", exact: true })
      .click();
    if (role !== "INSTRUCTOR") {
      await page.getByRole("button", { name: "Arkëtimet sot" }).click();
      assert.equal(
        await page.getByLabel("Nga data").inputValue(),
        calendarDay(),
      );
      await search.fill("Arta");
      await page
        .getByRole("button", { name: "Shiko listën e plotë →" })
        .click();
      assert.equal(
        await page.getByLabel("Kërko nxënës", { exact: true }).inputValue(),
        "Arta",
      );
      await page.getByRole("button", { name: "Veprim i ri" }).click();
      await page
        .locator("#quick-create-actions")
        .getByRole("button", { name: "Regjistro nxënës", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      for (const [label, value] of [
        ["Emri", "Arta"],
        ["Mbiemri", "Testi"],
        ["Data e lindjes", "2013-01-15"],
        ["Emri i prindit / kujdestarit", "Prindi Test"],
        ["Telefoni i prindit", "044123456"],
      ])
        await dialog.getByLabel(label, { exact: true }).fill(value);
      await dialog.getByRole("button", { name: "Ruaj nxënësin" }).click();
      await page
        .getByRole("dialog", { name: "Profili · Arta Testi" })
        .waitFor();
      assert(requests.some((r) => r.path === "/students/new-student"));
      await page.getByRole("button", { name: "Mbyll historikun" }).click();
      await page.getByRole("button", { name: "Veprim i ri" }).click();
      await page
        .locator("#quick-create-actions")
        .getByRole("button", { name: "Regjistro faturën", exact: true })
        .click();
      await page.getByRole("dialog", { name: "Regjistro faturën" }).waitFor();
      await page.getByRole("button", { name: "Anulo", exact: true }).click();
      await page.getByRole("button", { name: "Veprim i ri" }).click();
      await page
        .locator("#quick-create-actions")
        .getByRole("button", { name: "Regjistro pagesë", exact: true })
        .click();
      await page.getByRole("heading", { name: "Regjistro pagesë" }).waitFor();
      await page.getByRole("button", { name: "Anulo", exact: true }).click();
      await page
        .locator("nav")
        .getByRole("button", { name: "Përmbledhja", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Kurset: 1. Hap listën", exact: true })
        .click();
      await page
        .getByRole("button", { name: course.name, exact: true })
        .click();
      await page
        .getByRole("status")
        .filter({ hasText: "Regjistrimet: Programimi" })
        .waitFor();
      await page.getByText("Nuk u gjetën regjistrime.").waitFor();
      assert(
        requests.some(
          (r) =>
            r.path === "/enrollments" && r.query.includes("courseId=course-1"),
        ),
      );
      await page
        .locator("nav")
        .getByRole("button", { name: "Përmbledhja", exact: true })
        .click();
      await page.getByRole("button", { name: "Borxhi total" }).click();
      await page.getByRole("button", { name: /F-001 · 2026-10/ }).click();
      await page.getByRole("heading", { name: "Fatura F-001" }).waitFor();
      await page
        .getByRole("button", { name: "Regjistro pagesën", exact: true })
        .click();
      assert.equal(
        await page.getByLabel("Shuma e pagesës EUR").inputValue(),
        "50.00",
      );
      await page
        .getByRole("button", { name: "Mbyll faturën", exact: true })
        .click();
    }
    await page
      .locator("nav")
      .getByRole("button", { name: "Përmbledhja", exact: true })
      .click();
    await mkdir("output/admin-usability", { recursive: true });
    if (role === "ADMIN") {
      await page.screenshot({
        path: "output/admin-usability/dashboard.png",
        fullPage: true,
      });
      await page.getByRole("button", { name: "Ndrysho temën" }).click();
      await page.screenshot({
        path: "output/admin-usability/dashboard-dark.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 800, height: 1000 });
      await page.screenshot({
        path: "output/admin-usability/compact.png",
        fullPage: true,
      });
    }
    assert.deepEqual(errors, []);
    console.log(`${role}: navigation, search and permitted actions passed`);
    await page.close();
  }
} finally {
  await browser.close();
}

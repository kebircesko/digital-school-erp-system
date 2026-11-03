import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { Prisma } from "@prisma/client";
import translation from "../packages/shared/src/translate.cjs";
import server from "../apps/api/src/common/i18n.js";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const catalog = require("../packages/shared/src/en.json");
const { translate: t, translateMessage: tm } = translation;

test("Albanian is the default and unsupported languages fall back to Albanian", () => {
  assert.equal(t("Nxënësit"), "Nxënësit");
  assert.equal(t("Nxënësit", [], "de"), "Nxënësit");
  assert.equal(t("Nxënësit", [], "en"), "Students");
  assert.equal(server.requestLanguage(), "sq");
  assert.equal(server.requestLanguage("de-DE"), "sq");
  assert.equal(server.requestLanguage("en-US,en;q=0.9,sq;q=0.5"), "en");
  assert.equal(server.requestLanguage("en;q=0,sq;q=0.9"), "sq");
  assert.equal(server.requestLanguage("en;q=0.2,sq-AL;q=1"), "sq");
});
test("every English entry preserves all interpolation placeholders", () => {
  const placeholders = (text) =>
    [...text.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort();
  for (const [sq, en] of Object.entries(catalog)) {
    assert.ok(en.trim(), `Empty translation: ${sq}`);
    assert.deepEqual(placeholders(sq), placeholders(en), sq);
  }
});
test("translations preserve whitespace, interpolated names and fallback content", () => {
  assert.equal(t(" Fatura ", [], "en"), " Invoice ");
  assert.equal(
    t("Profili · {0}", ["Arbër Gashi"], "en"),
    "Profile · Arbër Gashi",
  );
  assert.equal(t("Unknown literal", [], "en"), "Unknown literal");
  assert.equal(t("__proto__", [], "en"), "__proto__");
  assert.equal(tm("constructor", "en"), "constructor");
  assert.equal(
    tm("Settle month 2026-10 (FAT-12) first. Balance: 20.00 EUR.", "sq"),
    "Mbyllni fillimisht muajin 2026-10 (FAT-12). Mbetja: 20.00 EUR.",
  );
  assert.equal(
    tm("Mbyllni fillimisht muajin 2026-10 (FAT-12). Mbetja: 20.00 EUR.", "en"),
    "Settle month 2026-10 (FAT-12) first. Balance: 20.00 EUR.",
  );
});
test("response localization preserves names, notes, dates, decimals and protocol values", () => {
  const row = {
    studentName: "Aktiv",
    notes: "Fatura",
    amount: new Prisma.Decimal("40.00"),
    issuedAt: new Date(),
    status: "UNPAID",
    errors: [{ row: 2, message: "Nxënësi nuk u gjet." }],
  };
  const result = server.localizeMessages(row, "en");
  assert.equal(result.studentName, "Aktiv");
  assert.equal(result.notes, "Fatura");
  assert.equal(result.amount, row.amount);
  assert.equal(result.issuedAt, row.issuedAt);
  assert.equal(result.status, "UNPAID");
  assert.equal(result.errors[0].message, "Student not found.");
  assert.equal(JSON.parse(JSON.stringify(result)).amount, "40");
  assert.equal(row.errors[0].message, "Nxënësi nuk u gjet.");
});
test("parallel requests keep their own language and localize JSON messages", async () => {
  async function request(language, pause) {
    const headers = {};
    const res = {
      setHeader: (k, v) => {
        headers[k] = v;
      },
      vary: (k) => {
        headers.Vary = k;
      },
      json: (body) => body,
    };
    return new Promise((resolve, reject) =>
      server.languageMiddleware(
        { headers: { "accept-language": language } },
        res,
        async () => {
          try {
            await delay(pause);
            resolve({
              label: server.t("Fatura"),
              body: res.json({ message: "Fatura nuk u gjet." }),
              headers,
            });
          } catch (e) {
            reject(e);
          }
        },
      ),
    );
  }
  const [en, sq] = await Promise.all([request("en", 15), request("sq", 1)]);
  assert.equal(en.label, "Invoice");
  assert.equal(en.body.message, "Invoice not found.");
  assert.equal(sq.label, "Fatura");
  assert.equal(sq.body.message, "Fatura nuk u gjet.");
  assert.equal(en.headers["Content-Language"], "en");
  assert.equal(sq.headers["Content-Language"], "sq");
  assert.equal(en.headers.Vary, "Accept-Language");
  assert.equal(server.t("Fatura"), "Fatura");
});

test("English attendance templates round-trip in either UI language without changing data", async () => {
  const ExcelJS = require("exceljs");
  const {
    AttendanceController,
    parseAttendance,
  } = require("../apps/api/src/attendance/attendance.js");
  const ids = [
    "18a6091e-663e-4eaa-a2ae-4d5c22ac7a92",
    "6cbda035-c285-44bb-b439-bc39c935248f",
  ];
  const controller = new AttendanceController({
    enrollment: {
      findMany: async () => [
        {
          studentId: ids[0],
          courseId: ids[1],
          student: { firstName: "Arbër", lastName: "Gashi" },
          course: { name: "Programim" },
        },
      ],
    },
  });
  let buffer;
  const res = {
    type() {
      return this;
    },
    attachment() {
      return this;
    },
    send(data) {
      buffer = data;
    },
  };
  await server.locale.run("en", () =>
    controller.template({ period: "2025-10" }, res),
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  assert.equal(sheet.name, "Absences");
  assert.equal(sheet.getCell("A1").value, "Student ID");
  assert.equal(sheet.getCell("F1").value, "Total lessons");
  assert.equal(sheet.getCell("B2").value, "Arbër Gashi");
  assert.equal(sheet.getCell("D2").value, "Programim");
  sheet.getCell("F2").value = 8;
  sheet.getCell("G2").value = 2;
  sheet.getCell("H2").value = 1;
  const encoded = Buffer.from(await workbook.xlsx.writeBuffer()).toString(
    "base64",
  );
  for (const language of ["sq", "en"]) {
    const parsed = await server.locale.run(language, () =>
      parseAttendance(encoded),
    );
    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.rows[0].studentId, ids[0]);
    assert.equal(parsed.rows[0].totalLessons, 8);
    assert.equal(parsed.rows[0].absences, 2);
  }
});

test("financial Excel headers and payment methods follow the selected language", async () => {
  const ExcelJS = require("exceljs");
  const { ReportsController } = require("../apps/api/src/reports/reports.js");
  const controller = new ReportsController({
    financial: async () => ({
      rows: [
        {
          payment: "PAG-TEST",
          invoice: "FAT-TEST",
          student: "Arbër Gashi",
          course: "Programim",
          group: "Grupi A",
          date: "2025-10-01",
          method: "CASH",
          amount: "40.00",
          user: "Admin Test",
        },
      ],
    }),
  });
  for (const [language, title, method] of [
    ["sq", "Pagesat", "Para të gatshme"],
    ["en", "Payments", "Cash"],
  ]) {
    let buffer;
    const res = {
      type() {
        return this;
      },
      attachment() {
        return this;
      },
      send(value) {
        buffer = value;
      },
    };
    await server.locale.run(language, () => controller.workbook({}, res));
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    assert.equal(sheet.name, title);
    assert.equal(
      sheet.getCell("A1").value,
      language === "en" ? "Payment" : "Pagesa",
    );
    assert.equal(sheet.getCell("C2").value, "Arbër Gashi");
    assert.equal(sheet.getCell("G2").value, method);
    assert.equal(sheet.getCell("H2").value, "40.00");
  }
});

import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import review from "../apps/api/src/invoices/review.js";
import finance from "../apps/api/src/common/finance.js";
const { InvoiceReviewController, shiftPeriod } = review;
const current = finance.today().slice(0, 7);
function controller(period) {
  const names = ["Ana", "Besa", "Cora", "Dora"];
  const attendance = (i, month, absences) => ({
    studentId: `s${i}`,
    courseId: "course",
    period: month,
    totalLessons: 8,
    absences,
    excusedAbsences: 0,
    sourceFile: i < 2 ? "demo.xlsx" : "other.xlsx",
    updatedAt: new Date(),
  });
  return new InvoiceReviewController({
    enrollment: {
      findMany: async () =>
        names.map((name, i) => ({
          id: `e${i}`,
          studentId: `s${i}`,
          courseId: "course",
          version: 1,
          startDate: new Date(`${period}-01T12:00:00Z`),
          monthlyPrice: new Prisma.Decimal(40),
          discount: new Prisma.Decimal(0),
          student: { firstName: name, lastName: "Test" },
          course: { name: "Programim" },
          group: { name: i === 0 ? "Grupi A" : "Grupi B" },
        })),
    },
    invoice: { findMany: async () => [] },
    invoicePriceDraft: { findMany: async () => [] },
    monthlyAttendance: {
      findMany: async () => [
        attendance(0, period, 2),
        attendance(1, period, 0),
        attendance(3, shiftPeriod(period, -1), 1),
      ],
    },
  });
}
test("monthly filters apply before pagination and summaries cover the whole search", async () => {
  const api = controller(current);
  const result = await api.pending({
    period: current,
    page: 1,
    limit: 1,
    status: "absences",
  });
  assert.equal(result.total, 2);
  assert.equal(result.pages, 2);
  assert.equal(result.items[0].studentName, "Ana Test");
  assert.deepEqual(result.summary, {
    all: 4,
    absences: 2,
    missing: 1,
    regular: 1,
  });
  const missing = await api.pending({
    period: current,
    page: 1,
    limit: 20,
    status: "missing",
  });
  assert.deepEqual(
    missing.items.map((r) => r.studentName),
    ["Cora Test"],
  );
  const regular = await api.pending({
    period: current,
    page: 1,
    limit: 20,
    status: "regular",
  });
  assert.deepEqual(
    regular.items.map((r) => r.studentName),
    ["Besa Test"],
  );
  const search = await api.pending({
    period: current,
    page: 1,
    limit: 20,
    search: "grupi a",
  });
  assert.equal(search.total, 1);
  assert.equal(search.summary.all, 1);
  assert.equal(search.items[0].suggestedAmount, "40.00");
});
test("future month review uses previous attendance, matching the invoice table", async () => {
  const period = shiftPeriod(current, 1);
  const api = controller(period);
  const missing = await api.pending({
    period,
    page: 1,
    limit: 20,
    status: "missing",
  });
  assert.equal(missing.total, 3);
  const absent = await api.pending({
    period,
    page: 1,
    limit: 20,
    status: "absences",
  });
  assert.deepEqual(
    absent.items.map((r) => r.studentName),
    ["Dora Test"],
  );
});

test("monthly invoice sorting applies to all candidates before pagination", async () => {
  const api = controller(current);
  const original = api.db.enrollment.findMany;
  api.db.enrollment.findMany = async () =>
    (await original()).map((row, i) => ({
      ...row,
      createdAt: new Date(Date.UTC(2026, 9, i + 1)),
      monthlyPrice: new Prisma.Decimal([100, 2, 40, 10][i]),
    }));
  const query = { period: current, page: 2, limit: 1 };
  assert.equal(
    (await api.pending({ ...query, sort: "createdAt:desc" })).items[0]
      .studentName,
    "Cora Test",
  );
  assert.equal(
    (await api.pending({ ...query, sort: "createdAt:asc" })).items[0]
      .studentName,
    "Besa Test",
  );
  assert.equal(
    (await api.pending({ ...query, sort: "suggestedAmount:asc" })).items[0]
      .suggestedAmount,
    "10.00",
  );
  assert.equal(
    (await api.pending({ ...query, sort: "suggestedAmount:desc" })).items[0]
      .suggestedAmount,
    "40.00",
  );
  assert.equal(
    (await api.pending({ ...query, page: 1, sort: "absences:desc" })).items[0]
      .studentName,
    "Ana Test",
  );
  assert.equal(
    (await api.pending({ ...query, page: 4, sort: "absences:asc" })).items[0]
      .studentName,
    "Cora Test",
  );
  assert.equal(
    (await api.pending({ ...query, page: 1, sort: "studentName:desc" }))
      .items[0].studentName,
    "Dora Test",
  );
  await assert.rejects(() => api.pending({ ...query, sort: "userName:asc" }));
});

test("import file filtering applies before pagination and attendance summaries", async () => {
  const api = controller(current);
  const result = await api.pending({
    period: current,
    sourceFile: "demo.xlsx",
    page: 2,
    limit: 1,
  });
  assert.equal(result.total, 2);
  assert.equal(result.items[0].studentName, "Besa Test");
  assert.deepEqual(result.summary, {
    all: 2,
    absences: 1,
    regular: 1,
    missing: 0,
  });
  const empty = await api.pending({
    period: current,
    sourceFile: "unknown.xlsx",
    page: 1,
    limit: 20,
  });
  assert.equal(empty.total, 0);
  const future = shiftPeriod(current, 1);
  const previous = await controller(future).pending({
    period: future,
    sourceFile: "other.xlsx",
    page: 1,
    limit: 20,
  });
  assert.equal(previous.total, 1);
  assert.equal(previous.items[0].studentName, "Dora Test");
});

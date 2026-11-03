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

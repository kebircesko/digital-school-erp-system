import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import attendance from "../apps/api/src/attendance/attendance.js";
import review from "../apps/api/src/invoices/review.js";
import finance from "../apps/api/src/common/finance.js";

test("import billing statuses match next-month eligibility instead of labeling the attendance month", async () => {
  const current = finance.today().slice(0, 7);
  const next = review.shiftPeriod(current, 1);
  const names = [
    "Paid",
    "Unpaid",
    "Missing",
    "Ended",
    "Inactive",
    "New",
    "Invoiced",
  ];
  const rows = names.map((name, i) => ({
    id: `a${i}`,
    studentId: `s${i}`,
    courseId: "course",
    period: current,
    sourceFile: "demo.xlsx",
    student: {
      firstName: name,
      lastName: "Test",
      status: i === 4 ? "INACTIVE" : "ACTIVE",
    },
    course: { name: "Code" },
    totalLessons: 8,
    absences: 1,
    excusedAbsences: 0,
    updatedAt: new Date(),
  }));
  const enrollments = rows.map((row, i) => ({
    id: `e${i}`,
    studentId: row.studentId,
    courseId: row.courseId,
    student: row.student,
    course: row.course,
    group: { name: "Group" },
    startDate: new Date(`${i === 5 ? next : current}-01T00:00:00Z`),
    endDate: i === 3 ? new Date(`${current}-02T00:00:00Z`) : null,
    monthlyPrice: new Prisma.Decimal(40),
    discount: new Prisma.Decimal(0),
    version: 1,
  }));
  const invoices = [
    {
      id: "paid",
      studentId: "s0",
      courseId: "course",
      period: current,
      status: "PAID",
      paidAmount: new Prisma.Decimal(40),
    },
    {
      id: "unpaid",
      studentId: "s1",
      courseId: "course",
      period: current,
      status: "UNPAID",
      paidAmount: new Prisma.Decimal(0),
    },
    {
      id: "existing-next",
      studentId: "s6",
      courseId: "course",
      period: next,
      status: "VOID",
      paidAmount: new Prisma.Decimal(0),
    },
  ];
  const db = {
    monthlyAttendance: { findMany: async () => rows },
    enrollment: {
      findMany: async ({ where }) =>
        enrollments.filter(
          (e) =>
            e.startDate <= where.startDate.lte &&
            (!e.endDate || e.endDate >= where.OR[1].endDate.gte) &&
            (!where.student || e.student.status === where.student.status),
        ),
    },
    invoice: {
      findMany: async ({ where }) => {
        assert.deepEqual(where.period.in, [next, current]);
        return invoices;
      },
    },
    invoicePriceDraft: { findMany: async () => [] },
  };
  const files = await new attendance.AttendanceController(db).imports({
    period: current,
    billingPeriod: next,
  });
  const imported = files.items[0].items;
  assert.deepEqual(
    Object.fromEntries(
      imported.map((row) => [row.studentId, row.billingStatus]),
    ),
    {
      s3: "NO_ENROLLMENT",
      s4: "INACTIVE",
      s6: "INVOICED",
      s2: "PREVIOUS_MISSING",
      s5: "READY",
      s0: "READY",
      s1: "PREVIOUS_UNPAID",
    },
  );
  assert.equal(
    imported.find((row) => row.studentId === "s1").previousInvoice.id,
    "unpaid",
  );
  assert.equal(imported.find((row) => row.studentId === "s0").invoice, null);
  assert.ok(
    imported.every(
      (row) => row.period === current && row.billingPeriod === next,
    ),
  );
  const pending = await review.pendingFor(db, next);
  assert.deepEqual(
    pending.map((row) => row.studentId).sort(),
    imported
      .filter((row) => row.billingStatus === "READY")
      .map((row) => row.studentId)
      .sort(),
  );
});

test("a missing prior invoice does not block billing for the current month", () => {
  const period = finance.today().slice(0, 7);
  assert.equal(
    review.billingStatus({
      enrollment: {
        startDate: new Date(`${review.shiftPeriod(period, -1)}-01T00:00:00Z`),
      },
      period,
    }),
    "READY",
  );
});

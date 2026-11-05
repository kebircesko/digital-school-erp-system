import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import gaps from "../apps/api/src/common/invoice-gaps.js";
import students from "../apps/api/src/students/students.js";
const { invoiceGaps } = gaps;
const enrollment = (start, end = null, courseId = "code") => ({
  courseId,
  startDate: new Date(start),
  endDate: end ? new Date(end) : null,
  course: { name: courseId },
});

test("historical gaps include enrollment months and compress consecutive missing months", () => {
  const invoices = [
    "2011-01",
    ...Array.from(
      { length: 11 },
      (_, i) => `2026-${String(i + 1).padStart(2, "0")}`,
    ),
  ].map((period) => ({ courseId: "code", period }));
  assert.deepEqual(
    invoiceGaps([enrollment("2010-11-03")], invoices, "2026-11-05"),
    {
      total: 181,
      courses: [
        {
          courseId: "code",
          courseName: "code",
          total: 181,
          ranges: [
            { from: "2010-11", to: "2010-12", count: 2 },
            { from: "2011-02", to: "2025-12", count: 179 },
          ],
        },
      ],
    },
  );
});

test("transfers and overlaps do not duplicate months, invoices in another course do not cover them, and void invoices are already registered", () => {
  const result = invoiceGaps(
    [
      enrollment("2026-01-15", "2026-02-01"),
      enrollment("2026-02-01", "2026-03-31"),
      enrollment("2026-05-01"),
      enrollment("2026-04-20", null, "future"),
    ],
    [
      { courseId: "code", period: "2026-02", status: "VOID" },
      { courseId: "other", period: "2026-01" },
    ],
    "2026-04-15",
  );
  assert.deepEqual(result, {
    total: 2,
    courses: [
      {
        courseId: "code",
        courseName: "code",
        total: 2,
        ranges: [
          { from: "2026-01", to: "2026-01", count: 1 },
          { from: "2026-03", to: "2026-03", count: 1 },
        ],
      },
    ],
  });
  assert.deepEqual(invoiceGaps([], [], "2026-11-05"), {
    total: 0,
    courses: [],
  });
});

test("student history exposes missing months only to financial roles and preserves invoices", async () => {
  const invoices = [
    {
      courseId: "code",
      period: "2026-01",
      amount: "35.00",
      paidAmount: "35.00",
      status: "PAID",
    },
  ];
  let reads = 0;
  const controller = new students.StudentsController({
    enrollment: {
      findMany: async () => [enrollment("2026-01-01", "2026-03-31")],
    },
    invoice: {
      findMany: async () => {
        reads++;
        return invoices;
      },
    },
    payment: { findMany: async () => [] },
  });
  const financial = await controller.history("student", {
    user: { role: "ADMIN" },
  });
  assert.equal(financial.missingInvoices.total, 2);
  assert.deepEqual(financial.invoices, invoices);
  const instructor = await controller.history("student", {
    user: { role: "INSTRUCTOR", id: "teacher" },
  });
  assert.equal(instructor.missingInvoices, undefined);
  assert.equal(instructor.invoices, undefined);
  assert.equal(reads, 1);
});

test("missing-invoice list filters and paginates month rows without inventing invoice amounts", async () => {
  let requested;
  const db = {
    student: {
      findMany: async (args) => {
        requested = args;
        return [
          {
            id: "edin",
            firstName: "Edin",
            lastName: "Grazhda",
            enrollments: [
              {
                id: "old",
                ...enrollment("2010-11-03", "2019-12-31"),
                group: { name: "Old group" },
              },
              {
                id: "new",
                ...enrollment("2020-01-01", "2025-12-31"),
                group: { name: "New group" },
              },
            ],
            invoices: [{ courseId: "code", period: "2011-01", status: "VOID" }],
          },
        ];
      },
    },
  };
  const query = {
    search: "edin grazhda",
    status: "MISSING",
    sort: "createdAt:desc",
    page: 2,
    limit: 2,
  };
  const result = await gaps.missingInvoiceList(db, query);
  assert.equal(requested.where.status, "ACTIVE");
  assert.equal(requested.where.AND.length, 2);
  assert.equal(result.total, 181);
  assert.deepEqual(
    result.items.map((row) => row.period),
    ["2025-10", "2025-09"],
  );
  assert.equal(result.items[0].groupName, "New group");
  assert.equal(result.items[0].amount, undefined);
  assert.equal(result.totalBalance, undefined);
  assert.equal(result.items[0].student.id, "edin");
  const filtered = await gaps.missingInvoiceList(db, {
    ...query,
    period: "2018-04",
    page: 1,
  });
  assert.equal(filtered.total, 1);
  assert.equal(filtered.items[0].period, "2018-04");
  assert.equal(filtered.items[0].groupName, "Old group");
  const registered = await gaps.missingInvoiceList(db, {
    ...query,
    period: "2011-01",
    page: 1,
  });
  assert.equal(registered.total, 0);
  await assert.rejects(() =>
    gaps.missingInvoiceList(db, { ...query, sort: "amount:desc" }),
  );
});

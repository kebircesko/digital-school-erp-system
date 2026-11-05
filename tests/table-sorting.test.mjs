import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import students from "../apps/api/src/students/students.js";
import reminders from "../apps/api/src/dashboard/payment-reminders.js";

test("student groups sort before pagination in both directions, including missing groups", async () => {
  const rows = [
    { id: "1", enrollments: [{ group: { name: "Grupi 10" } }] },
    { id: "2", enrollments: [] },
    { id: "3", enrollments: [{ group: { name: "Grupi 2" } }] },
  ];
  const db = {
    student: {
      count: () => rows.length,
      findMany: (args) => {
        assert.equal(args.take, undefined);
        assert.equal(args.skip, undefined);
        return [...rows];
      },
    },
    $transaction: (queries) => Promise.all(queries),
  };
  const controller = new students.StudentsController(db);
  const query = { sort: "group:asc", page: 2, limit: 1 };
  assert.equal((await controller.list(query)).items[0].id, "3");
  assert.equal(
    (await controller.list({ ...query, sort: "group:desc", page: 1 })).items[0]
      .id,
    "1",
  );
  db.student.findMany = (args) => {
    assert.deepEqual(args.orderBy, [{ birthDate: "desc" }, { id: "asc" }]);
    assert.equal(args.skip, 1);
    assert.equal(args.take, 1);
    return [];
  };
  await controller.list({ ...query, sort: "birthDate:desc" });
});

test("reminder balances sort numerically across all invoices before the twenty-row limit", async () => {
  const rows = Array.from({ length: 25 }, (_, i) => ({
    id: String(i),
    amount: new Prisma.Decimal(`${i}.20`),
    paidAmount: new Prisma.Decimal("0.10"),
  }));
  const db = {
    invoice: {
      count: () => rows.length,
      findMany: (args) => {
        assert.equal(args.take, undefined);
        return [...rows];
      },
    },
  };
  const descending = await reminders.paymentReminders(
    db,
    "2026-11-04",
    "balance:desc",
  );
  assert.equal(descending.upcoming.total, 25);
  assert.equal(descending.upcoming.items.length, 20);
  assert.equal(descending.upcoming.items[0].balance, "24.10");
  assert.equal(descending.upcoming.items[19].balance, "5.10");
  const ascending = await reminders.paymentReminders(
    db,
    "2026-11-04",
    "balance:asc",
  );
  assert.equal(ascending.overdue.items[0].balance, "0.10");
  await assert.rejects(() =>
    reminders.paymentReminders(db, "2026-11-04", "bad:asc"),
  );
  db.invoice.findMany = (args) => {
    assert.deepEqual(args.orderBy, [{ dueDate: "desc" }, { id: "asc" }]);
    assert.equal(args.take, 20);
    return [];
  };
  await reminders.paymentReminders(db, "2026-11-04", "days:desc");
});

test("payment sorting uses related names, dates, amounts and status before pagination", async () => {
  const { PaymentsController } =
    await import("../apps/api/src/payments/payments.js");
  let requested;
  const db = {
    payment: {
      count: () => 25,
      findMany: (args) => {
        requested = args;
        return [];
      },
    },
    $transaction: (queries) => Promise.all(queries),
  };
  const controller = new PaymentsController(db);
  const query = { page: 2, limit: 10, search: "Ana" };
  for (const key of ["createdAt", "number", "amount", "paidAt"]) {
    for (const direction of ["asc", "desc"]) {
      await controller.list({ ...query, sort: `${key}:${direction}` });
      assert.deepEqual(requested.orderBy, [
        { [key]: direction },
        { id: "asc" },
      ]);
      assert.equal(requested.skip, 10);
      assert.equal(requested.take, 10);
      assert.ok(requested.where.OR);
    }
  }
  await controller.list({ ...query, sort: "studentName:asc" });
  assert.deepEqual(requested.orderBy, [
    { student: { firstName: "asc" } },
    { student: { lastName: "asc" } },
    { id: "asc" },
  ]);
  await controller.list({ ...query, sort: "userName:desc" });
  assert.deepEqual(requested.orderBy, [
    { user: { name: "desc" } },
    { id: "asc" },
  ]);
  await controller.list({ ...query, sort: "status:asc" });
  assert.deepEqual(requested.orderBy[0], {
    reversedAt: { sort: "asc", nulls: "first" },
  });
  await assert.rejects(() =>
    controller.list({ ...query, sort: "courseName:asc" }),
  );
});

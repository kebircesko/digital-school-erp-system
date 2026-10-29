import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import reminders from "../apps/api/src/dashboard/payment-reminders.js";
import {
  calendarDay,
  paymentDeadline,
} from "../apps/desktop/src/services/format.js";

test("deadlines follow school calendar days across DST and year boundaries", () => {
  const invoice = { status: "PARTIAL", dueDate: "2026-10-26T00:00:00Z" };
  assert.equal(paymentDeadline(invoice, "2026-10-24").days, 2);
  assert.equal(paymentDeadline(invoice, "2026-10-25").label, "Mbetet 1 ditë");
  assert.equal(paymentDeadline(invoice, "2026-10-26").label, "Afati sot");
  assert.equal(paymentDeadline(invoice, "2026-10-27").label, "Vonesë 1 ditë");
  assert.equal(
    paymentDeadline({ ...invoice, dueDate: "2027-01-01" }, "2026-12-31").days,
    1,
  );
  const localDay = calendarDay(new Date("2026-10-24T22:30:00Z"));
  assert.equal(paymentDeadline(invoice, localDay).days, 1);
  assert.equal(
    paymentDeadline({ ...invoice, dueDate: "2026-11-02" }, "2026-10-25").tone,
    "later",
  );
  for (const status of ["PAID", "VOID"])
    assert.equal(paymentDeadline({ ...invoice, status }, "2026-10-27"), null);
});

test("reminders include today and day seven, exclude settled invoices, and retain partial balance", async () => {
  const rows = [
    ["old", "2026-10-24", "UNPAID"],
    ["today", "2026-10-25", "PARTIAL"],
    ["last", "2026-11-01", "UNPAID"],
    ["later", "2026-11-02", "UNPAID"],
    ["paid", "2026-10-25", "PAID"],
    ["void", "2026-10-24", "VOID"],
  ].map(([id, day, status]) => ({
    id,
    dueDate: new Date(day),
    status,
    amount: new Prisma.Decimal("70"),
    paidAmount: new Prisma.Decimal(status === "PARTIAL" ? "20" : "0"),
  }));
  function matching({ where }) {
    return rows.filter(
      (r) =>
        where.status.in.includes(r.status) &&
        Object.entries(where.dueDate).every(([operator, value]) =>
          operator === "lt"
            ? r.dueDate < value
            : operator === "gte"
              ? r.dueDate >= value
              : r.dueDate <= value,
        ),
    );
  }
  const db = {
    invoice: {
      count: async (query) => matching(query).length,
      findMany: async (query) => matching(query).slice(0, query.take),
    },
  };
  const result = await reminders.paymentReminders(db, "2026-10-25");
  assert.equal(result.upcoming.total, 2);
  assert.deepEqual(
    result.upcoming.items.map((i) => i.id),
    ["today", "last"],
  );
  assert.equal(result.upcoming.items[0].balance, "50.00");
  assert.equal(result.overdue.total, 1);
  assert.equal(result.overdue.items[0].id, "old");
});

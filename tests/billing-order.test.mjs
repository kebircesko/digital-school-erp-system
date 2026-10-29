import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import billing from "../apps/api/src/common/billing.js";
const { registrationDeadline, checkOldestMonths } = billing;
test("registration deadlines follow the start day, clamp short months and retain UTC date", () => {
  assert.equal(registrationDeadline("2026-10", "2026-09-29"), "2026-10-29");
  assert.equal(registrationDeadline("2026-02", "2025-01-31"), "2026-02-28");
  assert.equal(registrationDeadline("2024-02", "2023-12-31"), "2024-02-29");
  assert.equal(
    registrationDeadline("2026-04", "2026-01-31T00:00:00Z"),
    "2026-04-30",
  );
  assert.throws(() => registrationDeadline("2026-13", "2026-01-29"));
});
test("newer payments require all older months across courses to be settled in the same transaction", () => {
  const dec = (value) => new Prisma.Decimal(value);
  const invoices = [
    {
      id: "septA",
      number: "S-1",
      period: "2026-09",
      amount: dec(80),
      paidAmount: dec(30),
    },
    {
      id: "septB",
      number: "S-2",
      period: "2026-09",
      amount: dec(20),
      paidAmount: dec(0),
    },
    {
      id: "oct",
      number: "T-1",
      period: "2026-10",
      amount: dec(80),
      paidAmount: dec(0),
    },
  ];
  const alloc = (id, amount) => ({ invoiceId: id, amount: dec(amount) });
  assert.throws(
    () => checkOldestMonths(invoices, [alloc("oct", 10)]),
    /2026-09/,
  );
  assert.throws(() =>
    checkOldestMonths(invoices, [
      alloc("septA", 49),
      alloc("septB", 20),
      alloc("oct", 10),
    ]),
  );
  assert.throws(() =>
    checkOldestMonths(invoices, [alloc("septA", 50), alloc("oct", 10)]),
  );
  assert.doesNotThrow(() =>
    checkOldestMonths(invoices, [
      alloc("oct", 10),
      alloc("septA", 50),
      alloc("septB", 20),
    ]),
  );
  assert.doesNotThrow(() => checkOldestMonths(invoices, [alloc("septB", 5)]));
});

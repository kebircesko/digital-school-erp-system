import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import invoices from "../apps/api/src/invoices/invoices.js";

test("invoice totals retain filters, exclude voids and cover every page with exact decimals", async () => {
  const query = {
    period: "2026-06",
    status: "PARTIAL",
    search: "Era",
    page: 2,
    limit: 1,
  };
  const where = invoices.invoiceWhere(query);
  const db = {
    invoice: {
      count: ({ where: filter }) => {
        assert.deepEqual(filter, where);
        return 3;
      },
      groupBy: (args) => {
        assert.deepEqual(args, {
          by: ["status"],
          where,
          _count: { _all: true },
        });
        return [{ status: "PARTIAL", _count: { _all: 3 } }];
      },
      findMany: ({ skip, take }) => {
        assert.equal(skip, 1);
        assert.equal(take, 1);
        return [
          {
            amount: new Prisma.Decimal("0.20"),
            paidAmount: new Prisma.Decimal("0.10"),
            allocations: [],
          },
        ];
      },
      aggregate: (args) => {
        assert.deepEqual(args, {
          where: { AND: [where, { status: { not: "VOID" } }] },
          _sum: { amount: true, paidAmount: true },
        });
        return {
          _sum: {
            amount: new Prisma.Decimal("0.60"),
            paidAmount: new Prisma.Decimal("0.30"),
          },
        };
      },
    },
    $transaction: (queries) => Promise.all(queries),
  };
  const controller = new invoices.InvoicesController(db);
  const result = await controller.list(query);
  assert.equal(result.totalBalance, "0.30");
  assert.equal(result.totalAmount, "0.60");
  assert.equal(result.totalPaid, "0.30");
  assert.deepEqual(result.statusCounts, { PARTIAL: 3 });
  assert.equal(result.items[0].balance, "0.10");
  db.invoice.aggregate = () => ({ _sum: { amount: null, paidAmount: null } });
  assert.equal((await controller.list(query)).totalBalance, "0.00");
});

test("invoice sorting orders exact balances before pagination and retains native date ordering", async () => {
  const rows = ["10.00", "2.00", "100.00"].map((value, id) => ({
    id,
    amount: new Prisma.Decimal(value),
    paidAmount: new Prisma.Decimal("0.10"),
    allocations: [],
  }));
  const db = {
    invoice: {
      count: () => rows.length,
      groupBy: () => [],
      aggregate: () => ({ _sum: { amount: null, paidAmount: null } }),
      findMany: (args) => {
        assert.equal(args.take, undefined);
        assert.equal(args.skip, undefined);
        return [...rows];
      },
    },
    $transaction: (queries) => Promise.all(queries),
  };
  const controller = new invoices.InvoicesController(db);
  const query = { sort: "balance:asc", page: 2, limit: 1 };
  assert.equal((await controller.list(query)).items[0].balance, "9.90");
  assert.equal(
    (await controller.list({ ...query, sort: "balance:desc", page: 1 }))
      .items[0].balance,
    "99.90",
  );
  db.invoice.findMany = (args) => {
    assert.deepEqual(args.orderBy, [{ issuedAt: "desc" }, { id: "asc" }]);
    assert.equal(args.skip, 1);
    assert.equal(args.take, 1);
    return [];
  };
  await controller.list({ ...query, sort: "issuedAt:desc" });
});

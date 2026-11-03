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
  assert.equal(result.items[0].balance, "0.10");
  db.invoice.aggregate = () => ({ _sum: { amount: null, paidAmount: null } });
  assert.equal((await controller.list(query)).totalBalance, "0.00");
});

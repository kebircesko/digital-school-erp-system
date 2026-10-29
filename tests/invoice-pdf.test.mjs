import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import invoiceTools from "../apps/api/src/reports/invoice.js";
const decimal = (value) => new Prisma.Decimal(value);
const sample = {
  number: "TEST-2026-001",
  studentName: "Nxënës Sintetik",
  student: { address: "Prizren" },
  courseName: "Programim",
  period: "2026-10",
  issuedAt: new Date("2026-10-01"),
  dueDate: new Date("2026-10-15"),
  subtotal: decimal(100),
  discount: decimal(0),
  amount: decimal(100),
  paidAmount: decimal(0),
  status: "UNPAID",
  allocations: [],
};
const pages = (buffer) =>
  (buffer.toString("latin1").match(/\/Type \/Page\b/g) || []).length;
test("ordinary invoice remains one A4 page", async () => {
  const pdf = await invoiceTools.invoicePdf(sample);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.equal(pages(pdf), 1);
});
test("long names and many payments paginate without creating empty footer pages", async () => {
  const pdf = await invoiceTools.invoicePdf({
    ...sample,
    studentName: "Arbër ".repeat(20),
    student: { address: "Adresë e gjatë për kontroll. ".repeat(10) },
    courseName:
      "Programim dhe zhvillim i aplikacioneve në internet për nxënës fillestarë dhe të avancuar",
    paidAmount: decimal(32),
    status: "PARTIAL",
    allocations: Array.from({ length: 32 }, () => ({
      amount: decimal(1),
      payment: {
        paidAt: new Date("2026-10-10"),
        method: "CASH",
        reversedAt: null,
      },
    })),
  });
  assert.ok(pages(pdf) > 1);
  assert.ok(pages(pdf) <= 3, `Unexpected empty pages: ${pages(pdf)}`);
});

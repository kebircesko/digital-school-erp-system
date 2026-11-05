import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import helpers from "../apps/api/src/students/helpers.js";
import tools from "../apps/api/src/admin-tools/admin-tools.js";
import {
  whatsappPhone,
  whatsappUrl,
} from "../apps/desktop/src/services/payment-reminder.js";
import { moneyCents, centsMoney } from "../apps/desktop/src/services/money.mjs";
import snapshot from "../apps/api/src/backups/snapshot.js";

test("WhatsApp reminders normalize Kosovo and international phones and safely encode editable text", () => {
  for (const value of ["044 123-456", "+383 44 123456", "00383 44 123456"])
    assert.equal(whatsappPhone(value), "38344123456");
  assert.equal(whatsappPhone("+49 151 12345678"), "4915112345678");
  for (const value of [
    "",
    "123",
    "0000000000",
    "letters38344123456",
    "+383/44123456",
    null,
  ])
    assert.equal(whatsappPhone(value), null);
  const message = "Prindi & Arta: 30.10 €?\nAfati: 04.11.2026";
  const url = new URL(whatsappUrl("044123456", message));
  assert.equal(url.hostname, "wa.me");
  assert.equal(url.searchParams.get("text"), message);
  assert.equal(whatsappUrl("123", message), null);
});

test("cash preview and server totals keep cents exact and fingerprint distinguishes edited receipts", async () => {
  assert.equal(centsMoney(moneyCents("0.10") + moneyCents("0.20")), "0.30");
  assert.equal(centsMoney(moneyCents("30.00") - moneyCents("31.10")), "-1.10");
  for (const value of ["NaN", "-1", "1.001", "1e3"])
    assert.equal(moneyCents(value), null);
  const payments = [
    { id: "1", method: "CASH", amount: new Prisma.Decimal("0.10") },
    { id: "2", method: "CASH", amount: new Prisma.Decimal("0.20") },
    { id: "3", method: "BANK", amount: new Prisma.Decimal("10.10") },
  ];
  const db = {
    payment: {
      findMany: ({ where }) => {
        assert.equal(where.reversedAt, null);
        return payments;
      },
    },
  };
  const result = await tools.cashSummary(db, "2026-11-04");
  assert.equal(result.cashTotal, "0.30");
  assert.equal(result.bankTotal, "10.10");
  assert.equal(result.total, "10.40");
  payments[0].method = "BANK";
  assert.notEqual(
    (await tools.cashSummary(db, "2026-11-04")).fingerprint,
    result.fingerprint,
  );
});

test("data checks flag incomplete phone numbers and ending-date filters are bounded", async () => {
  assert.equal(helpers.incompletePhone("123456"), true);
  assert.equal(helpers.incompletePhone("111111111"), true);
  assert.equal(helpers.incompletePhone("+383 44 123456"), false);
  const [ending] = await helpers.studentFilters({}, { filter: "endingSoon" });
  const dates = ending.enrollments.some.endDate;
  assert.equal(dates.lte - dates.gte, 30 * 86400000);
  const [filter] = await helpers.studentFilters(
    {
      student: {
        findMany: () => [
          { id: "bad", parentPhone: "123456" },
          { id: "ok", parentPhone: "044123456" },
        ],
      },
    },
    { filter: "incompletePhone" },
  );
  assert.deepEqual(filter, { id: { in: ["bad"] } });
});

test("workflow DTOs reject invalid versions, non-booleans and blank task titles", async () => {
  const dto = plainToInstance(tools.TaskDto, {
    title: "   ",
    notes: "",
    dueDate: "2026-11-04",
  });
  assert.ok((await validate(dto)).some((e) => e.property === "title"));
  const update = plainToInstance(tools.TaskUpdateDto, {
    title: "Call",
    notes: "",
    dueDate: "2026-11-04",
    version: 0,
    completed: "true",
  });
  assert.deepEqual((await validate(update)).map((e) => e.property).sort(), [
    "completed",
    "version",
  ]);
});

test("backups preserve new records and still read older encrypted backups", () => {
  const key = "1".repeat(64);
  const records = Object.fromEntries(
    snapshot.tables
      .filter((t) => !["adminTask", "cashClosure"].includes(t))
      .map((t) => [t, []]),
  );
  const old = snapshot.decrypt(
    snapshot.encrypt({ format: 1, records }, key),
    key,
  );
  assert.deepEqual(old.records.adminTask, []);
  assert.deepEqual(old.records.cashClosure, []);
});

test("new-student filter uses creation time, independently of enrollment end dates", async () => {
  const [recent] = await helpers.studentFilters({}, { filter: "recent" });
  assert.equal(recent.createdAt.lte - recent.createdAt.gte, 30 * 86400000);
  assert.ok(recent.createdAt.lte <= new Date());
  assert.equal(recent.enrollments, undefined);
  const [ending] = await helpers.studentFilters({}, { filter: "endingSoon" });
  assert.equal(ending.enrollments.some.status, "ACTIVE");
  assert.ok(ending.enrollments.some.endDate.gte instanceof Date);
  assert.equal(ending.createdAt, undefined);
});

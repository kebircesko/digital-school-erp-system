import { test } from "node:test";
import assert from "node:assert/strict";
import finance from "../apps/api/dist/common/finance.js";
test("money remains exact and rejects unsupported precision and negative values", () => {
  assert.equal(
    finance.money("0.10").plus(finance.money("0.20")).toFixed(2),
    "0.30",
  );
  for (const value of ["1.001", "-1.00", "NaN", "1e3", "1000000000.00", 1.2])
    assert.throws(() => finance.money(value));
  assert.throws(() => finance.money("0", true));
});
test("billing dates reject rollover and account for leap years", () => {
  assert.equal(
    finance.periodDates("2024-02").last.toISOString().slice(0, 10),
    "2024-02-29",
  );
  assert.equal(
    finance.periodDates("2025-02").last.toISOString().slice(0, 10),
    "2025-02-28",
  );
  for (const value of ["2025-02-29", "2026-13-01", "2026-02-30"])
    assert.throws(() => finance.calendarDate(value));
  assert.throws(() => finance.periodDates("2026-00"));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarDay } from "../apps/desktop/src/services/format.js";
test("payment and report dates use the same school calendar across midnight", () => {
  assert.equal(calendarDay(new Date("2026-10-20T22:30:00Z")), "2026-10-21");
  assert.equal(calendarDay(new Date("2026-12-31T23:30:00Z")), "2027-01-01");
});

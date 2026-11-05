import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseDateInput,
  displayInputDate,
  calendarCells,
  changeMonth,
} from "../apps/desktop/src/services/date-input.mjs";

test("date inputs display day/month/year and preserve ISO values for API requests", () => {
  assert.equal(displayInputDate("2026-11-04"), "04/11/2026");
  assert.equal(parseDateInput("04/11/2026"), "2026-11-04");
  assert.equal(parseDateInput("4/1/2026"), "2026-01-04");
  assert.equal(parseDateInput("2026-11-04"), "2026-11-04");
  assert.equal(displayInputDate(""), "");
  assert.equal(parseDateInput("29/02/2024"), "2024-02-29");
  assert.equal(parseDateInput("29/02/2000"), "2000-02-29");
  for (const invalid of [
    "31/02/2026",
    "29/02/1900",
    "04/13/2026",
    "00/11/2026",
    "11/04/26",
    "2026-02-30",
    "01/01/1899",
  ])
    assert.equal(parseDateInput(invalid), null, invalid);
});
test("every calendar week starts on Monday across month, year and DST boundaries", () => {
  for (const month of ["2026-11", "2026-10", "2026-03", "2027-01", "2024-02"]) {
    const cells = calendarCells(month);
    assert.equal(cells.length, 42);
    assert.equal(new Date(cells[0] + "T12:00:00Z").getUTCDay(), 1);
    for (let i = 1; i < cells.length; i++)
      assert.equal(Date.parse(cells[i]) - Date.parse(cells[i - 1]), 86400000);
  }
  assert.equal(calendarCells("2026-11")[0], "2026-10-26");
  assert.equal(calendarCells("2026-11")[6], "2026-11-01");
  assert.equal(changeMonth("2026-01", -1), "2025-12");
  assert.equal(changeMonth("2026-12", 1), "2027-01");
});

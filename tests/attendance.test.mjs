import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import attendance from "../apps/api/src/attendance/attendance.js";
import review from "../apps/api/src/invoices/review.js";
const ids = [
  "18a6091e-663e-4eaa-a2ae-4d5c22ac7a92",
  "6cbda035-c285-44bb-b439-bc39c935248f",
];
async function file(
  rows,
  headers = [
    "ID nxënësit",
    "ID kursit",
    "Muaji",
    "Orë gjithsej",
    "Mungesa",
    "Me arsye",
  ],
) {
  const book = new ExcelJS.Workbook();
  const s = book.addWorksheet("Mungesat");
  s.addRow(headers);
  rows.forEach((r) => s.addRow(r));
  return Buffer.from(await book.xlsx.writeBuffer()).toString("base64");
}
test("attendance parser accepts counts without changing money", async () => {
  const parsed = await attendance.parseAttendance(
    await file([[...ids, "2025-10", 8, 3, 1]]),
  );
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.rows[0].absences, 3);
  assert.equal(parsed.rows[0].excusedAbsences, 1);
});
test("duplicate pupil/course/month is rejected", async () => {
  const r = [...ids, "2025-10", 8, 3, 1];
  const parsed = await attendance.parseAttendance(await file([r, r]));
  assert.equal(parsed.errors.length, 1);
  assert.equal(parsed.errors[0].row, 3);
});
test("invalid counts and fractional hours are rejected", async () => {
  for (const counts of [
    [8, 9, 0],
    [8, 2, 3],
    [8, 1.5, 0],
    [-1, 0, 0],
    [8, null, 0],
  ]) {
    const p = await attendance.parseAttendance(
      await file([[...ids, "2025-10", ...counts]]),
    );
    assert.equal(p.errors.length, 1);
  }
});
test("formulas are rejected even with a cached result", async () => {
  const p = await attendance.parseAttendance(
    await file([[...ids, "2025-10", 8, { formula: "1+1", result: 2 }, 0]]),
  );
  assert.equal(p.errors.length, 1);
});
test("missing headers and malformed workbooks fail", async () => {
  await assert.rejects(attendance.parseAttendance(await file([[1]], ["Emri"])));
  await assert.rejects(
    attendance.parseAttendance(Buffer.from("invalid").toString("base64")),
  );
});
test("calendar month rollover handles years and leap years", () => {
  assert.equal(review.shiftPeriod("2026-12", 1), "2027-01");
  assert.equal(review.shiftPeriod("2024-03", -1), "2024-02");
  assert.throws(() => review.shiftPeriod("2026-13", 1));
});

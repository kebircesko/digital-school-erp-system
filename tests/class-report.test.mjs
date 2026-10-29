import { test } from "node:test";
import assert from "node:assert/strict";
import report from "../apps/api/src/attendance/class-report.js";
import {
  presentCount,
  otherAttendance,
} from "../apps/desktop/src/services/attendance.js";
const word = (text, x, y, width = 6) =>
  `<word xMin="${x}" xMax="${x + width}" yMin="${y}" yMax="${y + 7}">${text}</word>`;
function page(rows) {
  let xml = word("STUDENT", 8, 20, 28);
  for (let d = 1; d <= 31; d++)
    xml += word(String(d).padStart(2, "0"), 57 + (d - 1) * 15, 20);
  for (const [i, row] of rows.entries()) {
    const y = 55 + i * 85;
    row.name.forEach((part, n) => (xml += word(part, 12, y - 15 + n * 10, 20)));
    for (let d = 1; d <= 31; d++)
      xml += word(row.marks[d] ?? "-", 57 + (d - 1) * 15, y);
  }
  return `<page>${xml}</page>`;
}
function fixture() {
  return `<doc><title>Class Report - September26 - Test group</title><page>${word("Period:", 5, 20)}${word("October", 65, 20)}${word("2026", 120, 20)}${word("LESSONS", 5, 60)}${word("3", 65, 60)}${word("total", 80, 60)}</page>${page(
    [
      { name: ["An", "a", "Te", "st"], marks: { 2: "P", 9: "P", 16: "U" } },
      { name: ["Be", "n"], marks: { 2: "A", 9: "A", 16: "T" } },
    ],
  )}${page([{ name: ["No", "Da", "ta"], marks: {} }])}</doc>`;
}
function database(students, existing = []) {
  const group = {
    id: "group",
    courseId: "course",
    name: "Test group",
    version: 1,
  };
  const enrollments = students.map((s, i) => ({
    id: `e${i}`,
    version: 1,
    student: s,
  }));
  return {
    group: { findUnique: async () => group },
    enrollment: { findMany: async () => enrollments },
    monthlyAttendance: { findMany: async () => existing },
  };
}
test("multi-page DSOS report reads Period rather than class name and counts P/A/U/T separately", () => {
  const parsed = report.parseClassReportXml(fixture());
  assert.equal(parsed.report.period, "2026-10");
  assert.equal(parsed.report.students, 3);
  assert.equal(parsed.report.totalLessons, 3);
  assert.deepEqual(
    parsed.rows.map((r) => [
      r.reportName,
      r.sourceCounts.present,
      r.absences,
      r.sourceCounts.undefined,
      r.sourceCounts.tardy,
      r.sourceCounts.noAttendance,
    ]),
    [
      ["AnaTest", 2, 0, 1, 0, 0],
      ["Ben", 0, 2, 0, 1, 0],
      ["NoData", 0, 0, 0, 0, 3],
    ],
  );
  assert.equal(presentCount(parsed.rows[0]), 2);
  assert.equal(otherAttendance(parsed.rows[0]), "U: 1");
  assert.equal(presentCount({ totalLessons: 8, absences: 3 }), 5);
  assert.equal(presentCount(parsed.rows[2]), 0);
});
test("unknown codes, missing columns, unreadable PDFs, future months and inconsistent lesson counts fail", async () => {
  for (const xml of [
    fixture().replace(">U</word>", ">X</word>"),
    fixture().replace(">31</word>", ">32</word>"),
    fixture().replace(">2026</word>", ">2099</word>"),
    fixture().replace(">3</word>", ">4</word>"),
    "<doc/>",
  ])
    assert.throws(() => report.parseClassReportXml(xml));
  await assert.rejects(
    report.parseClassReport(Buffer.from("not a PDF").toString("base64")),
  );
});
test("names auto-match uniquely; ambiguous or unmapped names and duplicate mappings block confirmation", async () => {
  const parsed = report.parseClassReportXml(fixture());
  const students = [
    { id: "a", firstName: "Ana", lastName: "Test", version: 1 },
    { id: "b", firstName: "B", lastName: "en", version: 1 },
    { id: "c", firstName: "No", lastName: "Data", version: 1 },
  ];
  const db = database(students);
  const dto = { groupId: "group", content: "fixture" };
  const valid = await report.previewClassReport(db, parsed, dto);
  assert.equal(valid.valid, true);
  assert.equal(valid.items[0].studentId, "a");
  const ambiguous = await report.previewClassReport(
    database([...students, { ...students[0], id: "a2" }]),
    parsed,
    dto,
  );
  assert.equal(ambiguous.valid, false);
  assert.equal(ambiguous.items[0].studentId, null);
  const resolved = await report.previewClassReport(
    database([...students, { ...students[0], id: "a2" }]),
    parsed,
    { ...dto, matches: [{ row: 1, studentId: "a" }] },
  );
  assert.equal(resolved.valid, true);
  const duplicate = await report.previewClassReport(db, parsed, {
    ...dto,
    matches: [{ row: 2, studentId: "a" }],
  });
  assert.equal(duplicate.valid, false);
  const outside = await report.previewClassReport(db, parsed, {
    ...dto,
    matches: [{ row: 1, studentId: "outside" }],
  });
  assert.equal(outside.valid, false);
  await assert.rejects(
    report.previewClassReport(db, parsed, { content: "fixture" }),
  );
  await assert.rejects(
    report.previewClassReport(db, parsed, {
      ...dto,
      matches: [
        { row: 1, studentId: "a" },
        { row: 1, studentId: "a" },
      ],
    }),
  );
});
test("preview token changes with existing revisions, member changes and mappings; cross-group overwrite blocked", async () => {
  const parsed = report.parseClassReportXml(fixture());
  const students = [
    { id: "a", firstName: "Ana", lastName: "Test", version: 1 },
    { id: "b", firstName: "B", lastName: "en", version: 1 },
    { id: "c", firstName: "No", lastName: "Data", version: 1 },
  ];
  const dto = { groupId: "group", content: "fixture" };
  const before = await report.previewClassReport(
    database(students),
    parsed,
    dto,
  );
  const after = await report.previewClassReport(
    database(students, [{ studentId: "a", updatedAt: new Date("2026-10-22") }]),
    parsed,
    dto,
  );
  assert.notEqual(before.previewToken, after.previewToken);
  assert.equal(after.items[0].replacesExisting, true);
  const changed = await report.previewClassReport(
    database(students.map((s) => ({ ...s, version: 2 }))),
    parsed,
    dto,
  );
  assert.notEqual(changed.previewToken, before.previewToken);
  const cross = await report.previewClassReport(
    database(students, [
      {
        studentId: "a",
        updatedAt: new Date(),
        sourceCounts: { groupId: "other" },
      },
    ]),
    parsed,
    dto,
  );
  assert.equal(cross.valid, false);
});

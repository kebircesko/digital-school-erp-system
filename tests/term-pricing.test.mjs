import { test } from "node:test";
import assert from "node:assert/strict";
import {
  groupTerm,
  termPlan,
  TERM_RULES,
} from "../scripts/apply-term-pricing.mjs";
const member = (id, extra = {}) => ({
  id,
  studentId: id,
  status: "ACTIVE",
  version: 1,
  monthlyPrice: "65",
  discount: "5",
  student: { status: "ACTIVE" },
  ...extra,
});
const group = (term, members = []) => ({
  id: `g${term}`,
  name: `TEST · Web · ${term}`,
  courseId: "course",
  startTime: "12:00",
  version: 1,
  capacity: 1,
  days: [1, 3],
  durationMinutes: 90,
  enrollments: members,
});
test("A/B/C weekday, duration and base price rules are explicit", () => {
  assert.equal(groupTerm("TEST · Web · A"), "A");
  assert.equal(groupTerm("TEST · Web · B"), "B");
  assert.equal(groupTerm("TEST · Web · C"), "C");
  assert.equal(groupTerm("10:00-11:20A HTML CSS JS"), "A");
  assert.equal(groupTerm("TEST · Web · D"), null);
  assert.deepEqual(TERM_RULES.B, {
    days: [2, 4],
    durationMinutes: 80,
    monthlyPrice: "40.00",
  });
  assert.deepEqual(TERM_RULES.C, {
    days: [5],
    durationMinutes: 120,
    monthlyPrice: "30.00",
  });
});
test("D joins A only with matching course and start time; capacity and prices include transferred members", () => {
  const data = [
    group("A", [member("a")]),
    group("B", [member("b")]),
    group("C", [member("c")]),
    group("D", [member("d")]),
  ];
  const before = JSON.stringify(data);
  const plan = termPlan(data);
  assert.equal(plan.changes.length, 3);
  assert.equal(plan.merges.length, 1);
  assert.equal(plan.skipped.length, 0);
  assert.equal(plan.merges[0].targetId, "gA");
  assert.deepEqual(
    plan.changes.find((g) => g.term === "A").enrollments.map((e) => e.id),
    ["a", "d"],
  );
  assert.equal(plan.changes.find((g) => g.term === "A").after.capacity, 2);
  assert.deepEqual(
    plan.changes.find((g) => g.term === "C").enrollments[0].after,
    { monthlyPrice: "30.00", discount: "0.00" },
  );
  assert.equal(JSON.stringify(data), before);
});
test("ended and inactive registrations are not repriced; ambiguous merges and duplicate membership fail", () => {
  const c = group("C", [
    member("a"),
    member("ended", { status: "ENDED" }),
    member("inactive", { student: { status: "INACTIVE" } }),
  ]);
  assert.deepEqual(
    termPlan([c]).changes[0].enrollments.map((e) => e.id),
    ["a"],
  );
  assert.throws(() => termPlan([group("D")]));
  assert.throws(() =>
    termPlan([group("A"), { ...group("D"), startTime: "14:00" }]),
  );
  assert.throws(() =>
    termPlan([group("A", [member("same")]), group("D", [member("same")])]),
  );
  assert.throws(() =>
    termPlan([group("A"), { ...group("A"), id: "otherA" }, group("D")]),
  );
  assert.equal(
    termPlan([{ ...group("X"), name: "Pa termin" }]).skipped.length,
    1,
  );
});

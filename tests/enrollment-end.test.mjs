import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import enrollments from "../apps/api/src/enrollments/enrollments.js";
import helpers from "../apps/api/src/students/helpers.js";

test("removing a group ends only its enrollment and preserves other memberships and invoices", async () => {
  const rows = ["first", "second"].map((id) => ({
    id,
    version: 1,
    status: "ACTIVE",
    startDate: new Date("2026-11-02T00:00:00Z"),
  }));
  const invoices = [
    { enrollmentId: "first", period: "2026-11", amount: "40.00" },
  ];
  const audits = [];
  const tx = {
    enrollment: {
      findUnique: async ({ where }) => rows.find((row) => row.id === where.id),
      updateMany: async ({ where, data }) => {
        const row = rows.find(
          (row) =>
            row.id === where.id &&
            row.version === where.version &&
            row.status === where.status,
        );
        if (!row) return { count: 0 };
        Object.assign(row, data, {
          version: row.version + data.version.increment,
        });
        return { count: 1 };
      },
    },
    invoice: { findFirst: async () => invoices[0] },
    auditLog: { create: async ({ data }) => audits.push(data) },
  };
  const controller = new enrollments.EnrollmentsController({
    $transaction: (work) => work(tx),
  });
  const request = { user: { id: "admin" } };
  await controller.end("first", { endDate: "2026-11-05", version: 1 }, request);
  assert.equal(rows[0].status, "ENDED");
  assert.equal(rows[0].version, 2);
  assert.equal(rows[1].status, "ACTIVE");
  assert.deepEqual(invoices, [
    { enrollmentId: "first", period: "2026-11", amount: "40.00" },
  ]);
  assert.deepEqual(audits, [
    { userId: "admin", action: "ENROLLMENT_END", entityId: "first" },
  ]);
  assert.equal(helpers.activeEnrollment("2026-11-05").status, "ACTIVE");
  await assert.rejects(() =>
    controller.end("first", { endDate: "2026-11-05", version: 1 }, request),
  );
});

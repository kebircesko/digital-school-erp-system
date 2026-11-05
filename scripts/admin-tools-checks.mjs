import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import financeTools from "../apps/api/src/common/finance.js";
import snapshotTools from "../apps/api/src/backups/snapshot.js";

export async function adminToolsChecks({
  request,
  admin,
  finance,
  instructor,
  db,
}) {
  const day = financeTools.today();
  const end = new Date(day + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + 5);
  const teacher = await db.user.findUniqueOrThrow({
    where: { email: "instructor@test.invalid" },
  });
  const course = await request(
    "/courses",
    "POST",
    {
      name: "Admin workflow course",
      description: "Test",
      monthlyPrice: "40.10",
      durationMonths: 6,
      status: "ACTIVE",
    },
    admin,
    201,
  );
  const group = await request(
    "/groups",
    "POST",
    {
      name: "Admin workflow group",
      courseId: course.id,
      instructorId: teacher.id,
      days: [1, 3],
      startTime: "10:00",
      durationMinutes: 80,
      capacity: 2,
      status: "ACTIVE",
    },
    admin,
    201,
  );
  const body = {
    firstName: "Arta",
    lastName: "Workflow",
    birthDate: "2014-03-02",
    parentName: "Prindi",
    parentPhone: "044123456",
    status: "ACTIVE",
    notes: "Profile notes remain intact",
  };
  const plain = await request(
    "/students",
    "POST",
    { ...body, firstName: "NoGroup", parentPhone: "123456" },
    admin,
    201,
  );
  const duplicate = await request(
    `/admin-tools/duplicates?${new URLSearchParams({ firstName: "nogroup", lastName: "Workflow", birthDate: body.birthDate })}`,
    "GET",
    undefined,
    admin,
  );
  assert.equal(duplicate[0].id, plain.id);
  await request(
    "/students",
    "POST",
    { ...body, firstName: "NoGroup" },
    admin,
    409,
  );
  await request(
    "/admin-tools/duplicates?firstName=Arta",
    "GET",
    undefined,
    finance,
    400,
  );
  const onboarding = {
    ...body,
    requestId: randomUUID(),
    groupId: group.id,
    startDate: day,
    endDate: end.toISOString().slice(0, 10),
    monthlyPrice: "40.10",
    discount: "10.00",
    offer: "Registration offer",
    issueInvoice: true,
  };
  await request("/admin-tools/onboard", "POST", onboarding, instructor, 403);
  await request("/admin-tools/onboard", "POST", onboarding, finance, 403);
  const [created, concurrentReplay] = await Promise.all(
    [1, 2].map(() =>
      request("/admin-tools/onboard", "POST", onboarding, admin, 201),
    ),
  );
  assert.equal(concurrentReplay.student.id, created.student.id);
  assert.equal(created.invoice.amount, "30.1");
  assert.equal(created.enrollment.studentId, created.student.id);
  const replay = await request(
    "/admin-tools/onboard",
    "POST",
    onboarding,
    admin,
    201,
  );
  assert.equal(replay.student.id, created.student.id);
  assert.equal(replay.invoice.id, created.invoice.id);
  assert.equal(
    await db.invoice.count({ where: { studentId: created.student.id } }),
    1,
  );
  const drafted = await request(
    "/admin-tools/onboard",
    "POST",
    {
      ...onboarding,
      firstName: "Draft",
      requestId: randomUUID(),
      issueInvoice: false,
    },
    finance,
    201,
  );
  assert.equal(drafted.invoice, null);
  await request(
    `/enrollments/${drafted.enrollment.id}/end`,
    "PATCH",
    { endDate: end.toISOString().slice(0, 10), version: 1 },
    admin,
    200,
  );
  const futureStart = new Date(day + "T00:00:00Z");
  futureStart.setUTCMonth(futureStart.getUTCMonth() + 2);
  const future = await request(
    "/admin-tools/onboard",
    "POST",
    {
      ...onboarding,
      firstName: "Future",
      requestId: randomUUID(),
      startDate: futureStart.toISOString().slice(0, 10),
      endDate: undefined,
      issueInvoice: false,
    },
    admin,
    201,
  );
  assert.equal(future.invoice, null);
  assert.equal(
    (
      await db.invoicePriceDraft.findFirstOrThrow({
        where: { enrollmentId: drafted.enrollment.id },
      })
    ).amount.toFixed(2),
    "30.10",
  );
  await request(
    "/admin-tools/onboard",
    "POST",
    { ...onboarding, firstName: "Capacity", requestId: randomUUID() },
    admin,
    409,
  );
  assert.equal(
    await db.student.count({
      where: { firstName: "Capacity", lastName: "Workflow" },
    }),
    0,
  );
  for (const [filter, includes, excludes] of [
    ["noGroup", plain.id, created.student.id],
    ["debt", created.student.id, plain.id],
    ["incompletePhone", plain.id, created.student.id],
    ["endingSoon", created.student.id, plain.id],
  ]) {
    const list = await request(
      `/students?filter=${filter}`,
      "GET",
      undefined,
      admin,
    );
    assert.ok(
      list.items.some((s) => s.id === includes),
      filter,
    );
    assert.ok(!list.items.some((s) => s.id === excludes), filter);
  }
  const filtered = await request(
    `/students?courseId=${course.id}&groupId=${group.id}&search=Arta`,
    "GET",
    undefined,
    finance,
  );
  assert.deepEqual(
    filtered.items.map((s) => s.id),
    [created.student.id],
  );
  await request("/students?filter=debt", "GET", undefined, instructor, 403);
  await request("/students?filter=unknown", "GET", undefined, admin, 400);
  const quality = await request(
    "/admin-tools/data-quality",
    "GET",
    undefined,
    admin,
  );
  assert.ok(quality.noGroup.items.some((s) => s.id === plain.id));
  assert.ok(quality.incompletePhone.items.some((s) => s.id === plain.id));
  assert.equal(quality.endingSoon.total, 2);
  const details = await request(
    `/invoices/${created.invoice.id}`,
    "GET",
    undefined,
    finance,
  );
  assert.equal(details.student.parentPhone, body.parentPhone);
  assert.equal(details.balance, "30.10");
  const taskBody = {
    studentId: created.student.id,
    title: "  Kontakto prindin  ",
    notes: "Friday follow-up",
    dueDate: day,
  };
  await request("/admin-tools/tasks", "POST", taskBody, finance, 403);
  await request("/admin-tools/tasks", "GET", undefined, instructor, 403);
  const task = await request(
    "/admin-tools/tasks",
    "POST",
    taskBody,
    admin,
    201,
  );
  assert.equal(task.title, "Kontakto prindin");
  assert.equal(
    (
      await request(
        `/admin-tools/tasks?studentId=${created.student.id}`,
        "GET",
        undefined,
        admin,
      )
    )[0].id,
    task.id,
  );
  const done = await request(
    `/admin-tools/tasks/${task.id}`,
    "PATCH",
    { ...taskBody, version: 1, completed: true },
    admin,
  );
  assert.ok(done.completedAt);
  await request(
    `/admin-tools/tasks/${task.id}`,
    "PATCH",
    { ...taskBody, version: 1, completed: false },
    admin,
    409,
  );
  assert.equal(
    (await request(`/students/${created.student.id}`, "GET", undefined, admin))
      .notes,
    body.notes,
  );
  const reopened = await request(
    `/admin-tools/tasks/${task.id}`,
    "PATCH",
    { ...taskBody, version: 2, completed: false },
    admin,
  );
  assert.equal(reopened.completedAt, null);
  async function pay(amount, method) {
    return request(
      "/payments",
      "POST",
      {
        studentId: created.student.id,
        idempotencyKey: randomUUID(),
        amount,
        method,
        paidAt: day,
        notes: "Cash closing test",
        allocations: [{ invoiceId: created.invoice.id, amount }],
      },
      finance,
      201,
    );
  }
  const cash = await pay("10.10", "CASH");
  await pay("5.00", "BANK");
  const summary = await request(
    `/admin-tools/cash?day=${day}`,
    "GET",
    undefined,
    finance,
  );
  assert.equal(summary.cashTotal, "10.10");
  assert.equal(summary.bankTotal, "5.00");
  assert.equal(summary.total, "15.10");
  assert.equal(summary.paymentCount, 2);
  const closeBody = {
    day,
    openingCash: "20.00",
    countedCash: "30.00",
    notes: "",
    revision: 0,
    fingerprint: summary.fingerprint,
  };
  await request("/admin-tools/cash/close", "POST", closeBody, instructor, 403);
  await request("/admin-tools/cash/close", "POST", closeBody, finance, 400);
  await pay("1.00", "CASH");
  await request(
    "/admin-tools/cash/close",
    "POST",
    { ...closeBody, notes: "Counted discrepancy" },
    finance,
    409,
  );
  const refreshed = await request(
    `/admin-tools/cash?day=${day}`,
    "GET",
    undefined,
    finance,
  );
  const closed = await request(
    "/admin-tools/cash/close",
    "POST",
    {
      ...closeBody,
      notes: "Counted discrepancy",
      fingerprint: refreshed.fingerprint,
    },
    finance,
    201,
  );
  assert.equal(Number(closed.expectedCash), 31.1);
  assert.equal(Number(closed.difference), -1.1);
  await request(
    "/admin-tools/cash/close",
    "POST",
    {
      ...closeBody,
      notes: "Duplicate closure",
      fingerprint: refreshed.fingerprint,
    },
    finance,
    409,
  );
  await request(
    `/payments/${cash.id}/reverse`,
    "POST",
    { reason: "Reverse test receipt" },
    admin,
    201,
  );
  const changed = await request(
    `/admin-tools/cash?day=${day}`,
    "GET",
    undefined,
    admin,
  );
  assert.equal(changed.changedSinceClose, true);
  assert.equal(changed.history[0].id, closed.id);
  await request(
    "/admin-tools/cash/close",
    "POST",
    { ...closeBody, revision: 1, fingerprint: changed.fingerprint },
    admin,
    400,
  );
  const correction = await request(
    "/admin-tools/cash/close",
    "POST",
    {
      ...closeBody,
      countedCash: "21.00",
      notes: "Reversed receipt",
      revision: 1,
      fingerprint: changed.fingerprint,
    },
    admin,
    201,
  );
  assert.equal(correction.revision, 2);
  assert.equal(Number(correction.difference), 0);
  const history = await request(
    `/admin-tools/cash?day=${day}`,
    "GET",
    undefined,
    admin,
  );
  assert.equal(history.history.length, 2);
  assert.equal(history.changedSinceClose, false);
  const snapshot = await snapshotTools.snapshot(db);
  assert.equal(snapshot.records.adminTask.length, 1);
  assert.equal(snapshot.records.cashClosure.length, 2);
  console.log(
    "PASS: student filters, duplicate warning, atomic onboarding and replay, invoice preparation, parent contact, task permissions/versioning, cash closing, stale summaries, reversals, corrections and backup coverage.",
  );
  return {
    groupId: group.id,
    courseId: course.id,
    invoiceNumber: created.invoice.number,
    teacherId: teacher.id,
  };
}

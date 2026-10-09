import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { PrismaClient, Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import snapshotTools from "../apps/api/dist/backups/snapshot.js";
export async function erpChecks({
  request,
  admin,
  finance,
  instructor,
  db,
  pg,
  url,
  base,
  loginPassword,
}) {
  const instructorToken = (
    await request(
      "/auth/login",
      "POST",
      { email: "instructor@test.invalid", password: loginPassword },
      undefined,
      201,
    )
  ).token;
  const instructorUser = await db.user.findUnique({
    where: { email: "instructor@test.invalid" },
  });
  const month = new Date().toISOString().slice(0, 7),
    current = month + "-01";
  const prior = new Date(current + "T00:00:00Z");
  prior.setUTCMonth(prior.getUTCMonth() - 1);
  const previous = prior.toISOString().slice(0, 7);
  const courseBody = {
    name: "Kurs Sintetik",
    description: "Vetëm për testim",
    monthlyPrice: "100.10",
    durationMonths: 12,
    status: "ACTIVE",
  };
  await request("/courses", "POST", courseBody, instructorToken, 403);
  await request(
    "/courses",
    "POST",
    { ...courseBody, monthlyPrice: "1.001" },
    admin,
    400,
  );
  await request("/courses", "POST", { ...courseBody, name: "   " }, admin, 400);
  await request("/courses?status=PAID", "GET", undefined, admin, 400);
  await request("/groups?status=invalid", "GET", undefined, admin, 400);
  const course = await request("/courses", "POST", courseBody, admin, 201);
  const changed = await request(
    "/courses/" + course.id,
    "PATCH",
    { ...courseBody, version: 1 },
    admin,
  );
  await request(
    "/courses/" + course.id,
    "PATCH",
    { ...courseBody, version: 1 },
    finance,
    409,
  );
  const groups = [];
  for (let i = 1; i <= 2; i++)
    groups.push(
      await request(
        "/groups",
        "POST",
        {
          name: "Grup Sintetik " + i,
          courseId: course.id,
          instructorId: instructorUser.id,
          days: [1, 3],
          startTime: "16:00",
          durationMinutes: 90,
          capacity: 1,
          status: "ACTIVE",
        },
        admin,
        201,
      ),
    );
  const makeStudent = (firstName) =>
    request(
      "/students",
      "POST",
      {
        firstName,
        lastName: "Sintetik",
        birthDate: "2012-06-10",
        parentName: "Prind Sintetik",
        parentPhone: "+383 44000000",
        address: "Test",
        notes: "Sintetik",
        status: "ACTIVE",
      },
      admin,
      201,
    );
  const student = await makeStudent("Nxënës Financiar"),
    second = await makeStudent("Nxënës Kapaciteti");
  const enrollmentBody = {
    studentId: student.id,
    groupId: groups[0].id,
    startDate: previous + "-01",
    monthlyPrice: "100.10",
    discount: "0.10",
    offer: "Ofertë testimi",
  };
  const enrollment = await request(
    "/enrollments",
    "POST",
    enrollmentBody,
    admin,
    201,
  );
  await request("/enrollments", "POST", enrollmentBody, finance, 409);
  await request(
    "/enrollments",
    "POST",
    { ...enrollmentBody, studentId: second.id },
    admin,
    409,
  );
  await request(
    "/enrollments",
    "POST",
    {
      ...enrollmentBody,
      studentId: second.id,
      groupId: groups[1].id,
      discount: "101.00",
    },
    admin,
    400,
  );
  const generated = await Promise.all([
    request("/invoices/generate", "POST", { period: month }, admin, 201),
    request("/invoices/generate", "POST", { period: month }, finance, 201),
  ]);
  assert.equal(
    generated.reduce((sum, r) => sum + r.created, 0),
    1,
  );
  assert.equal(
    (
      await request(
        "/invoices/generate",
        "POST",
        { period: previous },
        admin,
        201,
      )
    ).created,
    1,
  );
  assert.equal(
    (await request("/invoices/generate", "POST", { period: month }, admin, 201))
      .created,
    0,
  );
  const invoices = (
    await request(
      "/invoices?studentId=" + student.id,
      "GET",
      undefined,
      finance,
    )
  ).items;
  assert.equal(invoices.length, 2);
  assert.ok(invoices.every((i) => new Prisma.Decimal(i.amount).eq("100.00")));
  const currentInvoice = invoices.find((i) => i.period === month),
    previousInvoice = invoices.find((i) => i.period === previous);
  const payment = (i, amount, key = randomUUID()) => ({
    studentId: student.id,
    idempotencyKey: key,
    amount,
    method: "CASH",
    paidAt: current,
    notes: "Test financiar",
    allocations: [{ invoiceId: i.id, amount }],
  });
  const partial = payment(previousInvoice, "30.00");
  const paid = await request("/payments", "POST", partial, finance, 201);
  const replay = await request("/payments", "POST", partial, finance, 201);
  assert.equal(replay.id, paid.id);
  await request(
    "/payments",
    "POST",
    { ...partial, notes: "Ndryshuar" },
    finance,
    409,
  );
  await request(
    "/payments",
    "POST",
    { ...payment(previousInvoice, "10.00"), amount: "11.00" },
    finance,
    400,
  );
  await request(
    "/payments",
    "POST",
    { ...payment(previousInvoice, "10.00"), studentId: second.id },
    finance,
    400,
  );
  await request(
    "/payments",
    "POST",
    payment(previousInvoice, "100.00"),
    finance,
    409,
  );
  const concurrent = await Promise.all([
    fetch(base + "/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + finance,
      },
      body: JSON.stringify(payment(currentInvoice, "80.00")),
    }),
    fetch(base + "/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + admin,
      },
      body: JSON.stringify(payment(currentInvoice, "80.00")),
    }),
  ]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [201, 409]);
  const allocated = await request(
    "/payments",
    "POST",
    {
      studentId: student.id,
      idempotencyKey: randomUUID(),
      amount: "30.00",
      method: "BANK",
      paidAt: current,
      notes: "Dy fatura",
      allocations: [
        { invoiceId: previousInvoice.id, amount: "10.00" },
        { invoiceId: currentInvoice.id, amount: "20.00" },
      ],
    },
    finance,
    201,
  );
  const updated = await db.invoice.findUnique({
    where: { id: currentInvoice.id },
  });
  assert.equal(updated.status, "PAID");
  assert.ok(updated.paidAmount.eq(100));
  const debts = await request(
    "/reports/debts?studentId=" + student.id,
    "GET",
    undefined,
    admin,
  );
  assert.equal(debts.total, "60.00");
  const report = await request(
    `/reports/financial?from=${current}&to=${current}&courseId=${course.id}`,
    "GET",
    undefined,
    finance,
  );
  assert.equal(report.total, "140.00");
  assert.equal(report.methods.find((m) => m.name === "BANK").amount, "30.00");
  const history = await request(
    "/students/" + student.id + "/history",
    "GET",
    undefined,
    finance,
  );
  assert.equal(history.enrollments.length, 1);
  assert.equal(history.invoices.length, 2);
  assert.equal(history.payments.length, 3);
  for (const endpoint of [
    "/invoices",
    "/payments",
    "/reports/debts",
    "/reports/financial",
    "/users",
    "/backups",
    "/audit",
  ])
    await request(endpoint, "GET", undefined, instructorToken, 403);
  const instructorDashboard = await request(
    "/dashboard",
    "GET",
    undefined,
    instructorToken,
  );
  assert.equal(instructorDashboard.financial, undefined);
  const instructorCourses = await request(
    "/courses",
    "GET",
    undefined,
    instructorToken,
  );
  assert.ok(instructorCourses.items.every((c) => !("monthlyPrice" in c)));
  const instructorEnrollments = await request(
    "/enrollments",
    "GET",
    undefined,
    instructorToken,
  );
  assert.ok(
    instructorEnrollments.items.every(
      (e) => !("discount" in e) && !("monthlyPrice" in e),
    ),
  );
  const transferred = await request(
    "/enrollments/" + enrollment.id + "/transfer",
    "POST",
    { groupId: groups[1].id, startDate: current, version: 1 },
    admin,
    201,
  );
  assert.equal(transferred.previousId, enrollment.id);
  assert.equal(
    (await request("/invoices/generate", "POST", { period: month }, admin, 201))
      .created,
    0,
  );
  await request(
    "/enrollments/" + enrollment.id + "/end",
    "PATCH",
    { endDate: current, version: 1 },
    admin,
    409,
  );
  await request("/students/" + student.id, "DELETE", undefined, admin, 409);
  await request("/courses/" + course.id, "DELETE", undefined, admin, 409);
  await request(
    "/payments/" + paid.id + "/reverse",
    "POST",
    { reason: "Korrigjim sintetik" },
    finance,
    403,
  );
  await request(
    "/payments/" + paid.id + "/reverse",
    "POST",
    { reason: "Korrigjim sintetik" },
    admin,
    201,
  );
  await request(
    "/payments/" + paid.id + "/reverse",
    "POST",
    { reason: "Përsëritje" },
    admin,
    409,
  );
  assert.equal(
    (
      await request(
        "/reports/debts?studentId=" + student.id,
        "GET",
        undefined,
        finance,
      )
    ).total,
    "90.00",
  );
  await request(
    "/invoices/" + currentInvoice.id + "/void",
    "POST",
    { reason: "Nuk lejohet e paguar" },
    admin,
    400,
  );
  await assert.rejects(
    db.invoice.update({
      where: { id: currentInvoice.id },
      data: { paidAmount: "100.01" },
    }),
  );
  const auditor = await request(
    "/audit?search=PAYMENT",
    "GET",
    undefined,
    admin,
  );
  assert.ok(auditor.items.length >= 4);
  await mkdir("tests/artifacts", { recursive: true });
  let extra = 6;
  for (const [path, name] of [
    [`/invoices/${currentInvoice.id}/pdf`, "invoice"],
    [`/payments/${allocated.id}/pdf`, "receipt"],
    [`/reports/financial.pdf?from=${current}&to=${current}`, "report"],
    ["/reports/debts.pdf", "debts"],
  ]) {
    const res = await fetch(base + path, {
      headers: { Authorization: "Bearer " + admin },
    });
    assert.equal(res.status, 200);
    const data = Buffer.from(await res.arrayBuffer());
    assert.equal(data.subarray(0, 5).toString(), "%PDF-");
    assert.ok(data.length > 5000);
    await writeFile(`tests/artifacts/${name}.pdf`, data);
    extra++;
  }
  const xlsx = await fetch(
    base + `/reports/financial.xlsx?from=${current}&to=${current}`,
    { headers: { Authorization: "Bearer " + admin } },
  );
  assert.equal(xlsx.status, 200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await xlsx.arrayBuffer()));
  assert.equal(workbook.worksheets[0].getRow(1).getCell(8).value, "Shuma EUR");
  assert.ok(workbook.worksheets[0].rowCount >= 4);
  extra++;

  const freeCourse = await request(
    "/courses",
    "POST",
    { ...courseBody, name: "Kurs automatik falas", monthlyPrice: "0.00" },
    admin,
    201,
  );
  const freeGroup = await request(
    "/groups",
    "POST",
    {
      name: "Grup automatik",
      courseId: freeCourse.id,
      instructorId: instructorUser.id,
      days: [2],
      startTime: "15:00",
      durationMinutes: 60,
      capacity: 5,
      status: "ACTIVE",
    },
    admin,
    201,
  );
  await request(
    "/enrollments",
    "POST",
    {
      ...enrollmentBody,
      studentId: second.id,
      groupId: freeGroup.id,
      startDate: current,
      monthlyPrice: "0.00",
      discount: "0.00",
    },
    admin,
    201,
  );
  await request(
    "/enrollments",
    "POST",
    {
      ...enrollmentBody,
      studentId: student.id,
      groupId: freeGroup.id,
      startDate: current,
      monthlyPrice: "0.00",
      discount: "0.00",
    },
    admin,
    201,
  );
  await request(
    "/groups/" + freeGroup.id,
    "PATCH",
    {
      name: freeGroup.name,
      courseId: freeGroup.courseId,
      instructorId: freeGroup.instructorId,
      days: freeGroup.days,
      startTime: freeGroup.startTime,
      durationMinutes: freeGroup.durationMinutes,
      capacity: 1,
      status: "ACTIVE",
      version: freeGroup.version,
    },
    admin,
    409,
  );
  const { InvoiceService } =
    await import("../apps/api/dist/invoices/invoices.js");
  const autoSetting = process.env.AUTO_INVOICES;
  process.env.AUTO_INVOICES = "true";
  try {
    await new InvoiceService(db).scheduled();
  } finally {
    if (autoSetting === undefined) delete process.env.AUTO_INVOICES;
    else process.env.AUTO_INVOICES = autoSetting;
  }
  const automatic = await db.invoice.findFirst({
    where: { courseId: freeCourse.id, period: month },
  });
  assert.equal(automatic.status, "PAID");
  assert.ok(automatic.amount.eq(0));
  extra++;
  const invoiceCount = await db.invoice.count();
  const backup = await request("/backups", "POST", {}, admin, 201);
  const backupRes = await fetch(base + "/backups/" + backup.name, {
    headers: { Authorization: "Bearer " + admin },
  });
  const encrypted = Buffer.from(await backupRes.arrayBuffer());
  assert.equal(encrypted.subarray(0, 8).toString(), "ERPBACK1");
  const saved = snapshotTools.decrypt(
    encrypted,
    process.env.ERP_TEST_BACKUP_KEY,
  );
  assert.equal(saved.records.invoice.length, invoiceCount);
  assert.throws(() =>
    snapshotTools.decrypt(encrypted, randomBytes(32).toString("hex")),
  );
  const tampered = Buffer.from(encrypted);
  tampered[tampered.length - 1] ^= 1;
  assert.throws(() =>
    snapshotTools.decrypt(tampered, process.env.ERP_TEST_BACKUP_KEY),
  );
  extra += 3;
  await pg.createDatabase("erp_restore");
  const restoreUrl = url.replace("/erp_test", "/erp_restore");
  const restored = new PrismaClient({
    datasources: { db: { url: restoreUrl } },
  });
  try {
    // Build the same schema in a completely separate database.
    const { spawnSync } = await import("node:child_process");
    const migration = spawnSync(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "db:migrate"],
      {
        shell: process.platform === "win32",
        env: { ...process.env, DATABASE_URL: restoreUrl },
        encoding: "utf8",
      },
    );
    assert.equal(migration.status, 0, migration.stderr);
    await snapshotTools.restore(restored, saved);
    assert.equal(await restored.invoice.count(), invoiceCount);
    assert.equal(await restored.payment.count(), 3);
    assert.equal(await restored.session.count(), 0);
    assert.ok(
      (
        await restored.invoice.findUnique({ where: { id: currentInvoice.id } })
      ).paidAmount.eq(100),
    );
    const invalid = JSON.parse(JSON.stringify(saved));
    invalid.records.payment[0].amount = "-1.00";
    await assert.rejects(snapshotTools.restore(restored, invalid));
    assert.equal(await restored.invoice.count(), invoiceCount);
    extra += 4;
  } finally {
    await restored.$disconnect();
  }
  const additional = await request(
    "/users",
    "POST",
    {
      name: "Admin Dytë",
      email: "second-admin@test.invalid",
      password: loginPassword,
      role: "ADMIN",
      active: true,
    },
    admin,
    201,
  );
  await request(
    "/users/" + additional.id,
    "PATCH",
    {
      name: additional.name,
      email: additional.email,
      role: "ADMIN",
      active: false,
    },
    admin,
  );
  const originalAdmin = await db.user.findUnique({
    where: { email: "admin@test.invalid" },
  });
  await request(
    "/users/" + originalAdmin.id,
    "PATCH",
    {
      name: originalAdmin.name,
      email: originalAdmin.email,
      role: "FINANCE",
      active: true,
    },
    admin,
    409,
  );
  await request(
    "/users/" + instructorUser.id,
    "PATCH",
    {
      name: instructorUser.name,
      email: instructorUser.email,
      role: "INSTRUCTOR",
      active: false,
    },
    admin,
    400,
  );
  const userList = await request("/users", "GET", undefined, admin);
  assert.ok(userList.items.every((u) => !("passwordHash" in u)));
  const financeUser = await db.user.findUnique({
    where: { email: "finance@test.invalid" },
  });
  await request(
    "/users/" + financeUser.id,
    "PATCH",
    {
      name: financeUser.name,
      email: financeUser.email,
      role: "FINANCE",
      active: true,
      password: randomBytes(18).toString("hex"),
    },
    admin,
  );
  await request("/invoices", "GET", undefined, finance, 401);
  console.log(
    "ERP: kurset, grupet, regjistrimet, transferimi, financat Decimal, konkurrenca, PDF/Excel, rolet, backup dhe rikthimi kaluan.",
  );
  return extra;
}

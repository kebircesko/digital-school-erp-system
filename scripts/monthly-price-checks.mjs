import assert from "node:assert/strict";
export async function monthlyPriceChecks({
  request,
  admin,
  finance,
  instructorToken,
  instructorUser,
  db,
  nextMonth,
}) {
  const course = await request(
    "/courses",
    "POST",
    {
      name: "Çmimi Mujor Test",
      description: "Sintetik",
      monthlyPrice: "40.00",
      durationMonths: 12,
      status: "ACTIVE",
    },
    admin,
    201,
  );
  const group = await request(
    "/groups",
    "POST",
    {
      name: "Çmimi Test",
      courseId: course.id,
      instructorId: instructorUser.id,
      days: [1, 3],
      startTime: "17:00",
      durationMinutes: 90,
      capacity: 10,
      status: "ACTIVE",
    },
    admin,
    201,
  );
  const student = await request(
    "/students",
    "POST",
    {
      firstName: "Çmimi",
      lastName: "Test",
      birthDate: "2012-06-10",
      parentName: "Prind Test",
      parentPhone: "044123456",
      status: "ACTIVE",
    },
    admin,
    201,
  );
  const enrollment = await request(
    "/enrollments",
    "POST",
    {
      studentId: student.id,
      groupId: group.id,
      startDate: nextMonth + "-01",
      monthlyPrice: "40.00",
      discount: "0.00",
      offer: "",
    },
    admin,
    201,
  );
  const pending = async () =>
    (
      await request(
        `/invoice-review/pending?period=${nextMonth}&studentId=${student.id}`,
        "GET",
        undefined,
        admin,
      )
    ).items[0];
  const original = await pending();
  const body = {
    enrollmentId: enrollment.id,
    period: nextMonth,
    amount: "30.00",
    notes: "4 mungesa, vendim i adminit",
    reviewToken: original.reviewToken,
  };
  for (const token of [finance, instructorToken])
    await request("/invoice-review/price", "POST", body, token, 403);
  for (const amount of ["40.01", "-1", "3.001"])
    await request(
      "/invoice-review/price",
      "POST",
      { ...body, amount },
      admin,
      400,
    );
  await request(
    "/invoice-review/price",
    "POST",
    { ...body, notes: "" },
    admin,
    400,
  );
  const saved = await request(
    "/invoice-review/price",
    "POST",
    body,
    admin,
    201,
  );
  assert.equal(saved.suggestedAmount, "30.00");
  assert.equal(saved.defaultAmount, "40.00");
  assert.equal(saved.priceDraft.version, 1);
  assert.notEqual(saved.reviewToken, original.reviewToken);
  assert.equal(
    await db.invoice.count({ where: { studentId: student.id } }),
    0,
    "Saving the price never issues an invoice",
  );
  assert.equal(
    (
      await db.enrollment.findUnique({ where: { id: enrollment.id } })
    ).monthlyPrice.toFixed(2),
    "40.00",
  );
  assert.equal(
    (
      await db.course.findUnique({ where: { id: course.id } })
    ).monthlyPrice.toFixed(2),
    "40.00",
  );
  assert.equal(
    (await pending()).suggestedAmount,
    "30.00",
    "Saved price survives a separate fetch",
  );
  await request("/invoice-review/price", "POST", body, admin, 409);
  await request("/invoice-review/approve", "POST", body, admin, 409);
  const revised = await request(
    "/invoice-review/price",
    "POST",
    { ...body, amount: "25.00", reviewToken: saved.reviewToken },
    admin,
    201,
  );
  assert.equal(revised.priceDraft.version, 2);
  const restored = await request(
    "/invoice-review/price",
    "POST",
    { ...body, amount: "40.00", notes: "", reviewToken: revised.reviewToken },
    admin,
    201,
  );
  assert.equal(restored.suggestedAmount, "40.00");
  const final = await request(
    "/invoice-review/price",
    "POST",
    { ...body, reviewToken: restored.reviewToken },
    admin,
    201,
  );
  const invoice = await request(
    "/invoice-review/approve",
    "POST",
    { ...body, notes: "", reviewToken: final.reviewToken },
    admin,
    201,
  );
  assert.equal(Number(invoice.amount), 30);
  assert.equal(Number(invoice.discount), 10);
  assert.equal(
    invoice.approvalNotes,
    body.notes,
    "Approval retains the saved reason",
  );
  assert.equal(
    (
      await db.invoicePriceDraft.findUnique({
        where: {
          enrollmentId_period: {
            enrollmentId: enrollment.id,
            period: nextMonth,
          },
        },
      })
    ).amount.toFixed(2),
    "30.00",
  );
  await request(
    "/invoice-review/price",
    "POST",
    { ...body, reviewToken: final.reviewToken },
    admin,
    409,
  );
  assert.equal(
    await db.auditLog.count({
      where: {
        action: "INVOICE_PRICE_UPDATE",
        userId: (
          await db.invoicePriceDraft.findFirst({
            where: { enrollmentId: enrollment.id },
          })
        ).updatedById,
      },
    }),
    4,
  );
  return 14;
}

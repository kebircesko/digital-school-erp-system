const { number, today, calendarDate, audit } = require("../common/finance");
async function issueInvoice(tx, enrollment, details, amount, notes, userId) {
  const invoice = await tx.invoice.create({
    data: {
      number: await number(tx, "FAT", Number(details.period.slice(0, 4))),
      studentId: enrollment.studentId,
      enrollmentId: enrollment.id,
      courseId: enrollment.courseId,
      groupId: enrollment.groupId,
      period: details.period,
      issuedAt: calendarDate(today()),
      dueDate: calendarDate(details.dueDate),
      subtotal: enrollment.monthlyPrice,
      discount: enrollment.monthlyPrice.minus(amount),
      amount,
      status: amount.eq(0) ? "PAID" : "UNPAID",
      studentName: details.studentName,
      courseName: details.courseName,
      groupName: details.groupName,
      approvalNotes: notes,
      ...(details.attendance ? { attendanceSnapshot: details.attendance } : {}),
    },
  });
  await audit(tx, userId, "INVOICE_APPROVE", invoice.id);
  return invoice;
}
module.exports = { issueInvoice };

"use strict";
const { registrationDeadline } = require("../common/billing");
const { createHash } = require("node:crypto");
const {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  BadRequestException,
  ConflictException,
} = require("@nestjs/common");
const { IsString, IsUUID, MaxLength, Matches } = require("class-validator");
const { __decorate, __metadata, __param } = require("tslib");
const { Roles } = require("../auth/auth");
const { PrismaService } = require("../common/prisma.service");
const { ListQuery, pagination } = require("../common/query");
const {
  periodDates,
  today,
  calendarDate,
  atomic,
  money,
  number,
  audit,
} = require("../common/finance");

function shiftPeriod(period, months) {
  const { first } = periodDates(period);
  first.setUTCMonth(first.getUTCMonth() + months);
  return first.toISOString().slice(0, 7);
}
function checkPeriod(period) {
  const dates = periodDates(period);
  if (period > shiftPeriod(today().slice(0, 7), 1))
    throw new BadRequestException(
      "Mund të përgatitni faturat deri në muajin e ardhshëm.",
    );
  return dates;
}
function attendanceData(row) {
  return row
    ? {
        period: row.period,
        totalLessons: row.totalLessons,
        absences: row.absences,
        excusedAbsences: row.excusedAbsences,
        sourceCounts: row.sourceCounts ?? null,
        updatedAt: row.updatedAt.toISOString(),
      }
    : null;
}
async function pendingFor(db, period) {
  const { first, last } = checkPeriod(period);
  const previousPeriod = shiftPeriod(period, -1);
  const enrollments = await db.enrollment.findMany({
    where: {
      startDate: { lte: last },
      OR: [{ endDate: null }, { endDate: { gte: first } }],
      student: { status: "ACTIVE" },
    },
    include: { student: true, course: true, group: true },
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
  });
  if (!enrollments.length) return [];
  const studentIds = [...new Set(enrollments.map((e) => e.studentId))];
  const [invoices, attendance] = await Promise.all([
    db.invoice.findMany({
      where: {
        studentId: { in: studentIds },
        period: { in: [period, previousPeriod] },
      },
    }),
    db.monthlyAttendance.findMany({
      where: {
        studentId: { in: studentIds },
        period: { in: [period, previousPeriod] },
      },
    }),
  ]);
  const invoiceMap = new Map(
    invoices.map((i) => [`${i.studentId}:${i.courseId}:${i.period}`, i]),
  );
  const attendanceMap = new Map(
    attendance.map((a) => [`${a.studentId}:${a.courseId}:${a.period}`, a]),
  );
  const seen = new Set(),
    result = [];
  for (const e of enrollments) {
    const key = `${e.studentId}:${e.courseId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (invoiceMap.has(`${key}:${period}`)) continue; // Includes void invoices: period numbers cannot be reused.
    const previous = invoiceMap.get(`${key}:${previousPeriod}`);
    const previousPaid = previous?.status === "PAID";
    const firstMonth = e.startDate.toISOString().slice(0, 7) === period;
    if (period > today().slice(0, 7) && !previousPaid && !firstMonth) continue;
    const currentAttendance = attendanceData(
      attendanceMap.get(`${key}:${period}`),
    );
    const previousAttendance = attendanceData(
      attendanceMap.get(`${key}:${previousPeriod}`),
    );
    const snapshot = {
      current: currentAttendance,
      previous: previousAttendance,
    };
    const reviewToken = createHash("sha256")
      .update(
        JSON.stringify({
          id: e.id,
          version: e.version,
          price: e.monthlyPrice.toFixed(2),
          discount: e.discount.toFixed(2),
          snapshot,
          previous: previous
            ? [previous.id, previous.status, previous.paidAmount.toFixed(2)]
            : null,
        }),
      )
      .digest("hex");
    result.push({
      enrollmentId: e.id,
      studentId: e.studentId,
      courseId: e.courseId,
      studentName: `${e.student.firstName} ${e.student.lastName}`,
      courseName: e.course.name,
      groupName: e.group.name,
      period,
      dueDate: registrationDeadline(period, e.startDate),
      monthlyPrice: e.monthlyPrice.toFixed(2),
      suggestedAmount: e.monthlyPrice.minus(e.discount).toFixed(2),
      previousPeriod,
      previousStatus: previous?.status ?? "NONE",
      previousPaid,
      firstMonth,
      attendance: snapshot,
      reviewToken,
    });
  }
  return result.sort((a, b) =>
    a.studentName.localeCompare(b.studentName, "sq"),
  );
}

class ApproveInvoice {
  period;
  enrollmentId;
  amount;
  notes;
  reviewToken;
}
for (const field of ["period", "amount", "notes", "reviewToken"])
  __decorate(
    [
      IsString(),
      MaxLength(field === "notes" ? 500 : 100),
      __metadata("design:type", String),
    ],
    ApproveInvoice.prototype,
    field,
  );
__decorate(
  [IsUUID(), __metadata("design:type", String)],
  ApproveInvoice.prototype,
  "enrollmentId",
);
__decorate(
  [Matches(/^[a-f0-9]{64}$/)],
  ApproveInvoice.prototype,
  "reviewToken",
);

class InvoiceReviewController {
  constructor(db) {
    this.db = db;
  }
  async pending(q) {
    const period = q.period ?? today().slice(0, 7);
    let rows = await pendingFor(this.db, period);
    if (q.search)
      rows = rows.filter((r) =>
        `${r.studentName} ${r.courseName} ${r.groupName}`
          .toLocaleLowerCase()
          .includes(q.search.toLocaleLowerCase()),
      );
    if (q.studentId) rows = rows.filter((r) => r.studentId === q.studentId);
    return {
      ...pagination(
        rows.length,
        q,
        rows.slice((q.page - 1) * q.limit, q.page * q.limit),
      ),
      period,
    };
  }
  async reminders() {
    const current = today().slice(0, 7),
      next = shiftPeriod(current, 1);
    const [a, b] = await Promise.all([
      pendingFor(this.db, current),
      pendingFor(this.db, next),
    ]);
    return {
      current: { period: current, count: a.length },
      next: { period: next, count: b.length },
      total: a.length + b.length,
    };
  }
  async approve(dto, req) {
    const amount = money(dto.amount);
    checkPeriod(dto.period);
    return atomic(this.db, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(612040)`;
      const pending = (await pendingFor(tx, dto.period)).find(
        (r) => r.enrollmentId === dto.enrollmentId,
      );
      if (!pending)
        throw new ConflictException(
          "Regjistrimi nuk është më për aprovim. Rifreskoni listën.",
        );
      if (pending.reviewToken !== dto.reviewToken)
        throw new ConflictException(
          "Mungesat ose regjistrimi kanë ndryshuar. Rifreskoni dhe kontrolloni sërish.",
        );
      if (amount.gt(pending.monthlyPrice))
        throw new BadRequestException(
          "Shuma nuk mund të tejkalojë çmimin mujor.",
        );
      if (!amount.eq(pending.suggestedAmount) && !dto.notes.trim())
        throw new BadRequestException(
          "Shkruani arsyen e ndryshimit të shumës.",
        );
      const e = await tx.enrollment.findUniqueOrThrow({
        where: { id: dto.enrollmentId },
      });
      const invoice = await tx.invoice.create({
        data: {
          number: await number(tx, "FAT", Number(dto.period.slice(0, 4))),
          studentId: e.studentId,
          enrollmentId: e.id,
          courseId: e.courseId,
          groupId: e.groupId,
          period: dto.period,
          issuedAt: calendarDate(today()),
          dueDate: calendarDate(pending.dueDate),
          subtotal: e.monthlyPrice,
          discount: e.monthlyPrice.minus(amount),
          amount,
          status: amount.eq(0) ? "PAID" : "UNPAID",
          studentName: pending.studentName,
          courseName: pending.courseName,
          groupName: pending.groupName,
          approvalNotes: dto.notes.trim(),
          attendanceSnapshot: pending.attendance,
        },
      });
      await audit(tx, req.user.id, "INVOICE_APPROVE", invoice.id);
      return invoice;
    });
  }
}
__decorate(
  [
    Get("pending"),
    __param(0, Query()),
    __metadata("design:paramtypes", [ListQuery]),
  ],
  InvoiceReviewController.prototype,
  "pending",
  null,
);
__decorate(
  [Get("reminders")],
  InvoiceReviewController.prototype,
  "reminders",
  null,
);
__decorate(
  [
    Post("approve"),
    Roles("ADMIN"),
    __param(0, Body()),
    __param(1, Req()),
    __metadata("design:paramtypes", [ApproveInvoice, Object]),
  ],
  InvoiceReviewController.prototype,
  "approve",
  null,
);
__decorate(
  [
    Controller("invoice-review"),
    Roles("ADMIN", "FINANCE"),
    __metadata("design:paramtypes", [PrismaService]),
  ],
  InvoiceReviewController,
);
module.exports = { InvoiceReviewController, pendingFor, shiftPeriod };

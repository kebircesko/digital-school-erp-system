const { createHash } = require("node:crypto");
const {
  Controller,
  Get,
  Post,
  Patch,
  Query,
  Body,
  Param,
  Req,
  ParseUUIDPipe,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} = require("@nestjs/common");
const {
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  MaxLength,
  MinLength,
  IsIn,
  Matches,
} = require("class-validator");
const { Transform } = require("class-transformer");
const { __decorate, __metadata, __param } = require("tslib");
const { Prisma } = require("@prisma/client");
const { PrismaService } = require("../common/prisma.service");
const { Roles } = require("../auth/auth");
const {
  atomic,
  audit,
  money,
  today,
  calendarDate,
} = require("../common/finance");
const { StudentDto, studentData } = require("../students/students");
const {
  studentFilters,
  duplicates,
  checkDuplicate,
} = require("../students/helpers");
const { createEnrollment } = require("../enrollments/enrollments");
const { issueInvoice } = require("../invoices/issue");
const { checkPeriod } = require("../invoices/review");
const { registrationDeadline } = require("../common/billing");
const { invoiceGaps } = require("../common/invoice-gaps");

function field(cls, name, validators, type = String) {
  __decorate(
    [...validators, __metadata("design:type", type)],
    cls.prototype,
    name,
    void 0,
  );
}
class DuplicateQuery {}
for (const key of ["firstName", "lastName"])
  field(DuplicateQuery, key, [IsString(), MinLength(1), MaxLength(80)]);
field(DuplicateQuery, "birthDate", [IsString()]);
field(DuplicateQuery, "excludeId", [IsOptional(), IsUUID()]);
field(DuplicateQuery, "requestId", [IsOptional(), IsUUID()]);
class OnboardingDto extends StudentDto {}
for (const key of ["requestId", "groupId"])
  field(OnboardingDto, key, [IsUUID()]);
field(OnboardingDto, "startDate", [IsString()]);
field(OnboardingDto, "endDate", [IsOptional(), IsString()]);
for (const key of ["monthlyPrice", "discount"])
  field(OnboardingDto, key, [IsString()]);
field(OnboardingDto, "offer", [IsString(), MaxLength(300)]);
field(OnboardingDto, "issueInvoice", [IsBoolean()], Boolean);
class TaskQuery {
  status = "open";
}
field(TaskQuery, "status", [IsIn(["open", "done", "all"])]);
field(TaskQuery, "studentId", [IsOptional(), IsUUID()]);
class TaskDto {}
field(TaskDto, "title", [
  Transform(({ value }) => (typeof value === "string" ? value.trim() : value)),
  IsString(),
  MinLength(1),
  MaxLength(160),
]);
field(TaskDto, "notes", [IsString(), MaxLength(2000)]);
field(TaskDto, "studentId", [IsOptional(), IsUUID()]);
field(TaskDto, "dueDate", [IsString()]);
class TaskUpdateDto extends TaskDto {}
field(TaskUpdateDto, "version", [IsInt(), Min(1)], Number);
field(TaskUpdateDto, "completed", [IsBoolean()], Boolean);
class DayQuery {
  day = today();
}
field(DayQuery, "day", [IsString()]);
class CloseCashDto extends DayQuery {}
for (const key of ["openingCash", "countedCash"])
  field(CloseCashDto, key, [IsString()]);
field(CloseCashDto, "notes", [IsString(), MaxLength(2000)]);
field(CloseCashDto, "fingerprint", [Matches(/^[a-f0-9]{64}$/)]);
field(CloseCashDto, "revision", [IsInt(), Min(0)], Number);

async function cashSummary(db, day) {
  const date = calendarDate(day);
  const payments = await db.payment.findMany({
    where: { paidAt: date, reversedAt: null },
    orderBy: { id: "asc" },
    select: { id: true, amount: true, method: true },
  });
  let cash = new Prisma.Decimal(0),
    bank = new Prisma.Decimal(0);
  for (const p of payments) {
    if (p.method === "CASH") cash = cash.plus(p.amount);
    else bank = bank.plus(p.amount);
  }
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify(
        payments.map((p) => [p.id, p.method, p.amount.toFixed(2)]),
      ),
    )
    .digest("hex");
  return {
    day,
    cashTotal: cash.toFixed(2),
    bankTotal: bank.toFixed(2),
    total: cash.plus(bank).toFixed(2),
    paymentCount: payments.length,
    fingerprint,
  };
}
class AdminToolsController {
  constructor(db) {
    this.db = db;
  }
  duplicates(query) {
    return duplicates(this.db, query, query.excludeId);
  }
  async onboard(dto, req) {
    if (dto.issueInvoice && req.user.role !== "ADMIN")
      throw new ForbiddenException();
    return atomic(this.db, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(612041)`;
      const existing = await tx.student.findUnique({
        where: { registrationKey: dto.requestId },
      });
      if (existing)
        return {
          student: existing,
          invoice: await tx.invoice.findFirst({
            where: { studentId: existing.id },
            orderBy: { createdAt: "asc" },
          }),
        };
      await checkDuplicate(tx, dto);
      const student = await tx.student.create({
        data: { ...studentData(dto), registrationKey: dto.requestId },
      });
      const enrollment = await createEnrollment(tx, {
        ...dto,
        studentId: student.id,
      });
      await audit(tx, req.user.id, "STUDENT_CREATE", student.id);
      await audit(tx, req.user.id, "ENROLLMENT_CREATE", enrollment.id);
      const period = dto.startDate.slice(0, 7),
        amount = enrollment.monthlyPrice.minus(enrollment.discount);
      let invoice = null;
      if (dto.issueInvoice) {
        checkPeriod(period);
        const group = await tx.group.findUniqueOrThrow({
          where: { id: enrollment.groupId },
          include: { course: true },
        });
        invoice = await issueInvoice(
          tx,
          enrollment,
          {
            period,
            dueDate: registrationDeadline(period, enrollment.startDate),
            studentName: `${student.firstName} ${student.lastName}`,
            courseName: group.course.name,
            groupName: group.name,
          },
          amount,
          dto.offer,
          req.user.id,
        );
      } else {
        await tx.invoicePriceDraft.create({
          data: {
            enrollmentId: enrollment.id,
            period,
            amount,
            notes: dto.offer,
            updatedById: req.user.id,
          },
        });
      }
      return { student, enrollment, invoice };
    });
  }
  async quality() {
    const result = {};
    for (const filter of [
      "noGroup",
      "incompletePhone",
      "endingSoon",
      "recent",
    ]) {
      const filters = await studentFilters(this.db, { filter });
      const where = { status: "ACTIVE", AND: filters };
      const [total, items] = await Promise.all([
        this.db.student.count({ where }),
        this.db.student.findMany({
          where,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            parentPhone: true,
          },
          take: 10,
          orderBy:
            filter === "recent"
              ? [{ createdAt: "desc" }, { id: "asc" }]
              : [{ lastName: "asc" }, { id: "asc" }],
        }),
      ]);
      result[filter] = { total, items };
    }
    const students = await this.db.student.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        enrollments: {
          select: {
            courseId: true,
            startDate: true,
            endDate: true,
            course: { select: { name: true } },
          },
        },
        invoices: { select: { courseId: true, period: true } },
      },
      orderBy: [{ lastName: "asc" }, { id: "asc" }],
    });
    const items = students
      .map(({ enrollments, invoices, ...student }) => ({
        ...student,
        missingInvoices: invoiceGaps(enrollments, invoices),
      }))
      .filter((student) => student.missingInvoices.total > 0);
    result.missingInvoices = {
      total: items.length,
      totalMonths: items.reduce(
        (sum, student) => sum + student.missingInvoices.total,
        0,
      ),
      items,
    };
    return result;
  }
  tasks(query) {
    return this.db.adminTask.findMany({
      where: {
        ...(query.studentId ? { studentId: query.studentId } : {}),
        ...(query.status === "open"
          ? { completedAt: null }
          : query.status === "done"
            ? { completedAt: { not: null } }
            : {}),
      },
      include: {
        student: { select: { firstName: true, lastName: true } },
        user: { select: { name: true } },
      },
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    });
  }
  async createTask(dto, req) {
    return atomic(this.db, async (tx) => {
      const task = await tx.adminTask.create({
        data: {
          title: dto.title,
          notes: dto.notes,
          dueDate: calendarDate(dto.dueDate),
          studentId: dto.studentId,
          userId: req.user.id,
        },
      });
      await audit(tx, req.user.id, "TASK_CREATE", task.id);
      return task;
    });
  }
  async updateTask(id, dto, req) {
    return atomic(this.db, async (tx) => {
      const row = await tx.adminTask.findUnique({ where: { id } });
      if (!row) throw new NotFoundException("Detyra nuk u gjet.");
      if (row.version !== dto.version)
        throw new ConflictException("Detyra ka ndryshuar. Rifreskoni listën.");
      const task = await tx.adminTask.update({
        where: { id },
        data: {
          title: dto.title,
          notes: dto.notes,
          dueDate: calendarDate(dto.dueDate),
          studentId: dto.studentId ?? null,
          completedAt: dto.completed ? (row.completedAt ?? new Date()) : null,
          version: { increment: 1 },
        },
      });
      await audit(tx, req.user.id, "TASK_UPDATE", id);
      return task;
    });
  }
  cash(query) {
    return this.db.$transaction(
      async (tx) => {
        const summary = await cashSummary(tx, query.day);
        const history = await tx.cashClosure.findMany({
          where: { day: calendarDate(query.day) },
          include: { user: { select: { name: true } } },
          orderBy: { revision: "desc" },
        });
        return {
          ...summary,
          history: history.map((row) => ({
            ...row,
            ...Object.fromEntries(
              [
                "openingCash",
                "cashTotal",
                "bankTotal",
                "expectedCash",
                "countedCash",
                "difference",
              ].map((key) => [key, row[key].toFixed(2)]),
            ),
          })),
          changedSinceClose: Boolean(
            history[0] && history[0].fingerprint !== summary.fingerprint,
          ),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  closeCash(dto, req) {
    const opening = money(dto.openingCash),
      counted = money(dto.countedCash);
    if (dto.day > today())
      throw new BadRequestException(
        "Nuk mund të mbyllni arkën për një ditë të ardhshme.",
      );
    return atomic(this.db, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(612042)`;
      const summary = await cashSummary(tx, dto.day);
      const latest = await tx.cashClosure.findFirst({
        where: { day: calendarDate(dto.day) },
        orderBy: { revision: "desc" },
      });
      if (
        summary.fingerprint !== dto.fingerprint ||
        (latest?.revision ?? 0) !== dto.revision
      )
        throw new ConflictException(
          "Pagesat ose mbyllja kanë ndryshuar. Rifreskoni përmbledhjen.",
        );
      const expected = opening.plus(summary.cashTotal),
        difference = counted.minus(expected);
      if ((latest || !difference.eq(0)) && !dto.notes.trim())
        throw new BadRequestException(
          "Shkruani arsyen e diferencës ose korrigjimit.",
        );
      const closure = await tx.cashClosure.create({
        data: {
          day: calendarDate(dto.day),
          revision: dto.revision + 1,
          userId: req.user.id,
          openingCash: opening,
          cashTotal: summary.cashTotal,
          bankTotal: summary.bankTotal,
          expectedCash: expected,
          countedCash: counted,
          difference,
          paymentCount: summary.paymentCount,
          fingerprint: summary.fingerprint,
          notes: dto.notes.trim(),
        },
      });
      await audit(tx, req.user.id, "CASH_CLOSE", closure.id);
      return closure;
    });
  }
}
function route(method, path, name, types, params, roles) {
  __decorate(
    [
      method(path),
      ...(roles ? [Roles(...roles)] : []),
      ...params.map((p, i) => __param(i, p)),
      __metadata("design:paramtypes", types),
    ],
    AdminToolsController.prototype,
    name,
    null,
  );
}
route(Get, "duplicates", "duplicates", [DuplicateQuery], [Query()]);
route(Post, "onboard", "onboard", [OnboardingDto, Object], [Body(), Req()]);
route(Get, "data-quality", "quality", [], []);
route(Get, "tasks", "tasks", [TaskQuery], [Query()], ["ADMIN"]);
route(
  Post,
  "tasks",
  "createTask",
  [TaskDto, Object],
  [Body(), Req()],
  ["ADMIN"],
);
route(
  Patch,
  "tasks/:id",
  "updateTask",
  [String, TaskUpdateDto, Object],
  [Param("id", ParseUUIDPipe), Body(), Req()],
  ["ADMIN"],
);
route(Get, "cash", "cash", [DayQuery], [Query()]);
route(Post, "cash/close", "closeCash", [CloseCashDto, Object], [Body(), Req()]);
__decorate(
  [
    Controller("admin-tools"),
    Roles("ADMIN", "FINANCE"),
    __metadata("design:paramtypes", [PrismaService]),
  ],
  AdminToolsController,
);
module.exports = {
  AdminToolsController,
  cashSummary,
  OnboardingDto,
  TaskDto,
  TaskUpdateDto,
  CloseCashDto,
};

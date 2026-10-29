"use strict";
var _a, _b, _c, _d, _e, _f;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnrollmentsController =
  exports.EnrollmentTransfer =
  exports.EnrollmentEnd =
  exports.EnrollmentDto =
    void 0;
exports.createEnrollment = createEnrollment;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const prisma_service_1 = require("../common/prisma.service");
const auth_1 = require("../auth/auth");
const finance_1 = require("../common/finance");
const query_1 = require("../common/query");
class EnrollmentDto {
  studentId;
  groupId;
  startDate;
  endDate;
  monthlyPrice;
  discount;
  offer;
}
exports.EnrollmentDto = EnrollmentDto;
tslib_1.__decorate(
  [(0, class_validator_1.IsUUID)(), tslib_1.__metadata("design:type", String)],
  EnrollmentDto.prototype,
  "studentId",
  void 0,
);
tslib_1.__decorate(
  [(0, class_validator_1.IsUUID)(), tslib_1.__metadata("design:type", String)],
  EnrollmentDto.prototype,
  "groupId",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String),
  ],
  EnrollmentDto.prototype,
  "startDate",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String),
  ],
  EnrollmentDto.prototype,
  "endDate",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String),
  ],
  EnrollmentDto.prototype,
  "monthlyPrice",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String),
  ],
  EnrollmentDto.prototype,
  "discount",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    tslib_1.__metadata("design:type", String),
  ],
  EnrollmentDto.prototype,
  "offer",
  void 0,
);
class EnrollmentEnd {
  endDate;
  version;
}
exports.EnrollmentEnd = EnrollmentEnd;
tslib_1.__decorate(
  [
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String),
  ],
  EnrollmentEnd.prototype,
  "endDate",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    tslib_1.__metadata("design:type", Number),
  ],
  EnrollmentEnd.prototype,
  "version",
  void 0,
);
class EnrollmentTransfer {
  groupId;
  startDate;
  version;
}
exports.EnrollmentTransfer = EnrollmentTransfer;
tslib_1.__decorate(
  [(0, class_validator_1.IsUUID)(), tslib_1.__metadata("design:type", String)],
  EnrollmentTransfer.prototype,
  "groupId",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String),
  ],
  EnrollmentTransfer.prototype,
  "startDate",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    tslib_1.__metadata("design:type", Number),
  ],
  EnrollmentTransfer.prototype,
  "version",
  void 0,
);
async function createEnrollment(tx, dto, previousId) {
  const startDate = (0, finance_1.calendarDate)(dto.startDate),
    endDate = dto.endDate ? (0, finance_1.calendarDate)(dto.endDate) : null;
  if (endDate && endDate < startDate)
    throw new common_1.BadRequestException(
      "Data e përfundimit duhet të jetë pas fillimit.",
    );
  const price = (0, finance_1.money)(dto.monthlyPrice),
    discount = (0, finance_1.money)(dto.discount);
  if (discount.gt(price))
    throw new common_1.BadRequestException(
      "Zbritja nuk mund ta tejkalojë çmimin.",
    );
  const student = await tx.student.findUnique({ where: { id: dto.studentId } });
  const group = await tx.group.findUnique({
    where: { id: dto.groupId },
    include: { course: true },
  });
  if (
    !student ||
    student.status !== "ACTIVE" ||
    !group ||
    group.status !== "ACTIVE" ||
    group.course.status !== "ACTIVE"
  )
    throw new common_1.BadRequestException(
      "Nxënësi, grupi dhe kursi duhet të jenë aktivë.",
    );
  const overlap = await tx.enrollment.count({
    where: {
      studentId: student.id,
      courseId: group.courseId,
      startDate: { lte: endDate ?? new Date("9999-12-31") },
      OR: [{ endDate: null }, { endDate: { gte: startDate } }],
    },
  });
  if (overlap)
    throw new common_1.ConflictException(
      "Nxënësi ka një regjistrim të mbivendosur në këtë kurs.",
    );
  const existing = await tx.enrollment.findMany({
    where: {
      groupId: group.id,
      startDate: { lte: endDate ?? new Date("9999-12-31") },
      OR: [{ endDate: null }, { endDate: { gte: startDate } }],
    },
    select: { startDate: true, endDate: true },
  });
  const events = existing
    .flatMap((e) => [
      { time: Math.max(e.startDate.getTime(), startDate.getTime()), change: 1 },
      ...(e.endDate
        ? [{ time: e.endDate.getTime() + 86400000, change: -1 }]
        : []),
    ])
    .sort((a, b) => a.time - b.time || a.change - b.change);
  let occupancy = 0;
  for (const event of events) {
    occupancy += event.change;
    if (occupancy >= group.capacity)
      throw new common_1.ConflictException(
        "Grupi ka arritur kapacitetin në periudhën e zgjedhur.",
      );
  }
  return tx.enrollment.create({
    data: {
      studentId: student.id,
      groupId: group.id,
      courseId: group.courseId,
      startDate,
      endDate,
      monthlyPrice: price,
      discount,
      offer: dto.offer,
      previousId,
    },
  });
}
let EnrollmentsController = class EnrollmentsController {
  db;
  constructor(db) {
    this.db = db;
  }
  async list(q, req) {
    const where = {
      ...(q.studentId ? { studentId: q.studentId } : {}),
      ...(q.search
        ? {
            OR: [
              {
                student: {
                  firstName: { contains: q.search, mode: "insensitive" },
                },
              },
              {
                student: {
                  lastName: { contains: q.search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
      ...(q.courseId ? { courseId: q.courseId } : {}),
      ...(q.groupId ? { groupId: q.groupId } : {}),
      ...(req.user.role === "INSTRUCTOR"
        ? { group: { instructorId: req.user.id } }
        : {}),
    };
    const [total, items] = await this.db.$transaction([
      this.db.enrollment.count({ where }),
      this.db.enrollment.findMany({
        where,
        orderBy: { startDate: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: {
          student: { select: { firstName: true, lastName: true } },
          course: { select: { name: true } },
          group: { select: { name: true } },
        },
      }),
    ]);
    return (0, query_1.pagination)(
      total,
      q,
      items.map((e) =>
        req.user.role === "INSTRUCTOR"
          ? {
              ...e,
              monthlyPrice: undefined,
              discount: undefined,
              offer: undefined,
            }
          : e,
      ),
    );
  }
  create(dto, req) {
    return (0, finance_1.atomic)(this.db, async (tx) => {
      const result = await createEnrollment(tx, dto);
      await (0, finance_1.audit)(
        tx,
        req.user.id,
        "ENROLLMENT_CREATE",
        result.id,
      );
      return result;
    });
  }
  end(id, dto, req) {
    return (0, finance_1.atomic)(this.db, async (tx) => {
      const old = await tx.enrollment.findUnique({ where: { id } });
      if (!old) throw new common_1.NotFoundException("Regjistrimi nuk u gjet.");
      const endDate = (0, finance_1.calendarDate)(dto.endDate);
      if (endDate < old.startDate)
        throw new common_1.BadRequestException(
          "Përfundimi nuk mund të jetë para fillimit.",
        );
      const latest = await tx.invoice.findFirst({
        where: { enrollmentId: id, status: { not: "VOID" } },
        orderBy: { period: "desc" },
      });
      if (latest && dto.endDate.slice(0, 7) < latest.period)
        throw new common_1.BadRequestException(
          "Përfundimi është para muajit të faturuar.",
        );
      const result = await tx.enrollment.updateMany({
        where: { id, version: dto.version, status: "ACTIVE" },
        data: { endDate, status: "ENDED", version: { increment: 1 } },
      });
      if (!result.count)
        throw new common_1.ConflictException(
          "Regjistrimi u ndryshua ose është përfunduar.",
        );
      await (0, finance_1.audit)(tx, req.user.id, "ENROLLMENT_END", id);
      return tx.enrollment.findUnique({ where: { id } });
    });
  }
  transfer(id, dto, req) {
    return (0, finance_1.atomic)(this.db, async (tx) => {
      const old = await tx.enrollment.findUnique({ where: { id } });
      if (!old) throw new common_1.NotFoundException("Regjistrimi nuk u gjet.");
      const startDate = (0, finance_1.calendarDate)(dto.startDate);
      if (
        startDate.getUTCDate() !== 1 ||
        startDate <= old.startDate ||
        old.groupId === dto.groupId
      )
        throw new common_1.BadRequestException(
          "Ndërrimi fillon më datën 1 të një muaji pas fillimit.",
        );
      const target = await tx.group.findUnique({ where: { id: dto.groupId } });
      if (!target || target.courseId !== old.courseId)
        throw new common_1.BadRequestException(
          "Zgjidhni grup tjetër të të njëjtit kurs.",
        );
      const endDate = new Date(startDate.getTime() - 86400000);
      const result = await tx.enrollment.updateMany({
        where: { id, version: dto.version, status: "ACTIVE" },
        data: { status: "ENDED", endDate, version: { increment: 1 } },
      });
      if (!result.count)
        throw new common_1.ConflictException(
          "Regjistrimi është ndryshuar ose përfunduar.",
        );
      const next = await createEnrollment(
        tx,
        {
          studentId: old.studentId,
          groupId: dto.groupId,
          startDate: dto.startDate,
          endDate: old.endDate?.toISOString().slice(0, 10),
          monthlyPrice: old.monthlyPrice.toFixed(2),
          discount: old.discount.toFixed(2),
          offer: old.offer,
        },
        id,
      );
      await (0, finance_1.audit)(
        tx,
        req.user.id,
        "ENROLLMENT_TRANSFER",
        next.id,
      );
      return next;
    });
  }
};
exports.EnrollmentsController = EnrollmentsController;
tslib_1.__decorate(
  [
    (0, common_1.Get)(),
    tslib_1.__param(0, (0, common_1.Query)()),
    tslib_1.__param(1, (0, common_1.Req)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_b =
        typeof query_1.ListQuery !== "undefined" && query_1.ListQuery) ===
      "function"
        ? _b
        : Object,
      typeof (_c =
        typeof auth_1.AuthRequest !== "undefined" && auth_1.AuthRequest) ===
      "function"
        ? _c
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  EnrollmentsController.prototype,
  "list",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Post)(),
    (0, auth_1.Roles)("ADMIN", "FINANCE"),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__param(1, (0, common_1.Req)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      EnrollmentDto,
      typeof (_d =
        typeof auth_1.AuthRequest !== "undefined" && auth_1.AuthRequest) ===
      "function"
        ? _d
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", void 0),
  ],
  EnrollmentsController.prototype,
  "create",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Patch)(":id/end"),
    (0, auth_1.Roles)("ADMIN", "FINANCE"),
    tslib_1.__param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    tslib_1.__param(1, (0, common_1.Body)()),
    tslib_1.__param(2, (0, common_1.Req)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      String,
      EnrollmentEnd,
      typeof (_e =
        typeof auth_1.AuthRequest !== "undefined" && auth_1.AuthRequest) ===
      "function"
        ? _e
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", void 0),
  ],
  EnrollmentsController.prototype,
  "end",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Post)(":id/transfer"),
    (0, auth_1.Roles)("ADMIN", "FINANCE"),
    tslib_1.__param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    tslib_1.__param(1, (0, common_1.Body)()),
    tslib_1.__param(2, (0, common_1.Req)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      String,
      EnrollmentTransfer,
      typeof (_f =
        typeof auth_1.AuthRequest !== "undefined" && auth_1.AuthRequest) ===
      "function"
        ? _f
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", void 0),
  ],
  EnrollmentsController.prototype,
  "transfer",
  null,
);
exports.EnrollmentsController = EnrollmentsController = tslib_1.__decorate(
  [
    (0, common_1.Controller)("enrollments"),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_a =
        typeof prisma_service_1.PrismaService !== "undefined" &&
        prisma_service_1.PrismaService) === "function"
        ? _a
        : Object,
    ]),
  ],
  EnrollmentsController,
);

"use strict";
var _a, _b, _c, _d, _e, _f, _g;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupsController = exports.GroupUpdate = exports.GroupDto = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../common/prisma.service");
const auth_1 = require("../auth/auth");
const finance_1 = require("../common/finance");
const query_1 = require("../common/query");
const class_transformer_1 = require("class-transformer");
class GroupDto {
  name;
  courseId;
  instructorId;
  days;
  startTime;
  durationMinutes;
  capacity;
  status;
}
exports.GroupDto = GroupDto;
tslib_1.__decorate(
  [
    (0, class_transformer_1.Transform)(({ value }) =>
      typeof value === "string" ? value.trim() : value,
    ),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    tslib_1.__metadata("design:type", String),
  ],
  GroupDto.prototype,
  "name",
  void 0,
);
tslib_1.__decorate(
  [(0, class_validator_1.IsUUID)(), tslib_1.__metadata("design:type", String)],
  GroupDto.prototype,
  "courseId",
  void 0,
);
tslib_1.__decorate(
  [(0, class_validator_1.IsUUID)(), tslib_1.__metadata("design:type", String)],
  GroupDto.prototype,
  "instructorId",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_validator_1.IsInt)({ each: true }),
    (0, class_validator_1.Min)(1, { each: true }),
    (0, class_validator_1.Max)(7, { each: true }),
    tslib_1.__metadata("design:type", Array),
  ],
  GroupDto.prototype,
  "days",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.Matches)(/^([01]\d|2[0-3]):[0-5]\d$/),
    tslib_1.__metadata("design:type", String),
  ],
  GroupDto.prototype,
  "startTime",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(15),
    (0, class_validator_1.Max)(480),
    tslib_1.__metadata("design:type", Number),
  ],
  GroupDto.prototype,
  "durationMinutes",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(500),
    tslib_1.__metadata("design:type", Number),
  ],
  GroupDto.prototype,
  "capacity",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsEnum)(client_1.ActivityStatus),
    tslib_1.__metadata(
      "design:type",
      typeof (_a =
        typeof client_1.ActivityStatus !== "undefined" &&
        client_1.ActivityStatus) === "function"
        ? _a
        : Object,
    ),
  ],
  GroupDto.prototype,
  "status",
  void 0,
);
class GroupUpdate extends GroupDto {
  version;
}
exports.GroupUpdate = GroupUpdate;
tslib_1.__decorate(
  [
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    tslib_1.__metadata("design:type", Number),
  ],
  GroupUpdate.prototype,
  "version",
  void 0,
);
let GroupsController = class GroupsController {
  db;
  constructor(db) {
    this.db = db;
  }
  async list(q, req) {
    if (q.status && !Object.values(client_1.ActivityStatus).includes(q.status))
      throw new common_1.BadRequestException("Statusi është i pavlefshëm.");
    const where = {
      ...(req.user.role === "INSTRUCTOR" ? { instructorId: req.user.id } : {}),
      ...(q.courseId ? { courseId: q.courseId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.search
        ? { name: { contains: q.search, mode: "insensitive" } }
        : {}),
    };
    const active = {
      startDate: { lte: (0, finance_1.calendarDate)((0, finance_1.today)()) },
      OR: [
        { endDate: null },
        {
          endDate: { gte: (0, finance_1.calendarDate)((0, finance_1.today)()) },
        },
      ],
    };
    const [total, items] = await this.db.$transaction([
      this.db.group.count({ where }),
      this.db.group.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { name: "asc" },
        include: {
          course: { select: { id: true, name: true } },
          instructor: { select: { id: true, name: true } },
          _count: { select: { enrollments: { where: active } } },
        },
      }),
    ]);
    return (0, query_1.pagination)(total, q, items);
  }
  create(dto, req) {
    return (0, finance_1.atomic)(this.db, async (tx) => {
      const instructor = await tx.user.findUnique({
        where: { id: dto.instructorId },
      });
      if (!instructor?.active || instructor.role !== "INSTRUCTOR")
        throw new common_1.BadRequestException(
          "Zgjidhni një instruktor aktiv.",
        );
      const course = await tx.course.findUnique({
        where: { id: dto.courseId },
      });
      if (!course || course.status !== "ACTIVE")
        throw new common_1.BadRequestException("Zgjidhni një kurs aktiv.");
      const group = await tx.group.create({ data: dto });
      await (0, finance_1.audit)(tx, req.user.id, "GROUP_CREATE", group.id);
      return group;
    });
  }
  update(id, dto, req) {
    return (0, finance_1.atomic)(this.db, async (tx) => {
      const old = await tx.group.findUnique({
        where: { id },
        include: { _count: { select: { enrollments: true } } },
      });
      if (!old) throw new common_1.NotFoundException("Grupi nuk u gjet.");
      if (old.courseId !== dto.courseId && old._count.enrollments)
        throw new common_1.BadRequestException(
          "Kursi i grupit me regjistrime nuk mund të ndryshohet.",
        );
      const instructor = await tx.user.findUnique({
        where: { id: dto.instructorId },
      });
      if (!instructor?.active || instructor.role !== "INSTRUCTOR")
        throw new common_1.BadRequestException(
          "Instruktori duhet të jetë aktiv.",
        );
      if (dto.capacity < old.capacity) {
        const start = (0, finance_1.calendarDate)(
          (0, finance_1.today)(),
        ).getTime();
        const enrollments = await tx.enrollment.findMany({
          where: {
            groupId: id,
            OR: [{ endDate: null }, { endDate: { gte: new Date(start) } }],
          },
          select: { startDate: true, endDate: true },
        });
        const events = enrollments
          .flatMap((e) => [
            { time: Math.max(start, e.startDate.getTime()), change: 1 },
            ...(e.endDate
              ? [{ time: e.endDate.getTime() + 86400000, change: -1 }]
              : []),
          ])
          .sort((a, b) => a.time - b.time || a.change - b.change);
        let occupancy = 0;
        for (const event of events) {
          occupancy += event.change;
          if (occupancy > dto.capacity)
            throw new common_1.ConflictException(
              "Kapaciteti nuk mund të jetë më i vogël se regjistrimet ekzistuese ose të ardhshme.",
            );
        }
      }
      const { version, ...data } = dto;
      const updated = await tx.group.updateMany({
        where: { id, version },
        data: { ...data, version: { increment: 1 } },
      });
      if (!updated.count)
        throw new common_1.ConflictException(
          "Grupi është ndryshuar. Rifreskoni listën.",
        );
      await (0, finance_1.audit)(tx, req.user.id, "GROUP_UPDATE", id);
      return tx.group.findUnique({ where: { id } });
    });
  }
  remove(id, req) {
    return (0, finance_1.atomic)(this.db, async (tx) => {
      if (
        (await tx.enrollment.count({ where: { groupId: id } })) ||
        (await tx.invoice.count({ where: { groupId: id } }))
      )
        throw new common_1.ConflictException(
          "Grupi ka historik të lidhur. Çaktivizojeni në vend të fshirjes.",
        );
      await tx.group.delete({ where: { id } });
      await (0, finance_1.audit)(tx, req.user.id, "GROUP_DELETE", id);
      return { message: "Grupi u fshi." };
    });
  }
  async instructors() {
    return this.db.user.findMany({
      where: { role: "INSTRUCTOR", active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }
};
exports.GroupsController = GroupsController;
tslib_1.__decorate(
  [
    (0, common_1.Get)(),
    tslib_1.__param(0, (0, common_1.Query)()),
    tslib_1.__param(1, (0, common_1.Req)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_c =
        typeof query_1.ListQuery !== "undefined" && query_1.ListQuery) ===
      "function"
        ? _c
        : Object,
      typeof (_d =
        typeof auth_1.AuthRequest !== "undefined" && auth_1.AuthRequest) ===
      "function"
        ? _d
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  GroupsController.prototype,
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
      GroupDto,
      typeof (_e =
        typeof auth_1.AuthRequest !== "undefined" && auth_1.AuthRequest) ===
      "function"
        ? _e
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", void 0),
  ],
  GroupsController.prototype,
  "create",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Patch)(":id"),
    (0, auth_1.Roles)("ADMIN", "FINANCE"),
    tslib_1.__param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    tslib_1.__param(1, (0, common_1.Body)()),
    tslib_1.__param(2, (0, common_1.Req)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      String,
      GroupUpdate,
      typeof (_f =
        typeof auth_1.AuthRequest !== "undefined" && auth_1.AuthRequest) ===
      "function"
        ? _f
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", void 0),
  ],
  GroupsController.prototype,
  "update",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Delete)(":id"),
    (0, auth_1.Roles)("ADMIN"),
    tslib_1.__param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    tslib_1.__param(1, (0, common_1.Req)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      String,
      typeof (_g =
        typeof auth_1.AuthRequest !== "undefined" && auth_1.AuthRequest) ===
      "function"
        ? _g
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", void 0),
  ],
  GroupsController.prototype,
  "remove",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Get)("instructors"),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", []),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  GroupsController.prototype,
  "instructors",
  null,
);
exports.GroupsController = GroupsController = tslib_1.__decorate(
  [
    (0, common_1.Controller)("groups"),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_b =
        typeof prisma_service_1.PrismaService !== "undefined" &&
        prisma_service_1.PrismaService) === "function"
        ? _b
        : Object,
    ]),
  ],
  GroupsController,
);

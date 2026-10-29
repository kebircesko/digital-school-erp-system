"use strict";
var _a, _b, _c, _d, _e, _f, _g;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoursesController = exports.CourseUpdate = exports.CourseDto = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../common/prisma.service");
const auth_1 = require("../auth/auth");
const finance_1 = require("../common/finance");
const query_1 = require("../common/query");
const class_transformer_1 = require("class-transformer");
class CourseDto {
  name;
  description;
  monthlyPrice;
  durationMonths;
  status;
}
exports.CourseDto = CourseDto;
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
  CourseDto.prototype,
  "name",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(3000),
    tslib_1.__metadata("design:type", String),
  ],
  CourseDto.prototype,
  "description",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsString)(),
    tslib_1.__metadata("design:type", String),
  ],
  CourseDto.prototype,
  "monthlyPrice",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(120),
    tslib_1.__metadata("design:type", Number),
  ],
  CourseDto.prototype,
  "durationMonths",
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
  CourseDto.prototype,
  "status",
  void 0,
);
class CourseUpdate extends CourseDto {
  version;
}
exports.CourseUpdate = CourseUpdate;
tslib_1.__decorate(
  [
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    tslib_1.__metadata("design:type", Number),
  ],
  CourseUpdate.prototype,
  "version",
  void 0,
);
let CoursesController = class CoursesController {
  db;
  constructor(db) {
    this.db = db;
  }
  async list(q, req) {
    if (q.status && !Object.values(client_1.ActivityStatus).includes(q.status))
      throw new common_1.BadRequestException("Statusi është i pavlefshëm.");
    const where = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.search
        ? { name: { contains: q.search, mode: "insensitive" } }
        : {}),
    };
    const [total, items] = await this.db.$transaction([
      this.db.course.count({ where }),
      this.db.course.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { _count: { select: { groups: true, enrollments: true } } },
      }),
    ]);
    return (0, query_1.pagination)(
      total,
      q,
      items.map((c) =>
        req.user.role === "INSTRUCTOR" ? { ...c, monthlyPrice: undefined } : c,
      ),
    );
  }
  create(dto, req) {
    return (0, finance_1.atomic)(this.db, async (tx) => {
      const result = await tx.course.create({
        data: {
          ...dto,
          name: dto.name.trim(),
          monthlyPrice: (0, finance_1.money)(dto.monthlyPrice),
        },
      });
      await (0, finance_1.audit)(tx, req.user.id, "COURSE_CREATE", result.id);
      return result;
    });
  }
  update(id, dto, req) {
    return (0, finance_1.atomic)(this.db, async (tx) => {
      const { version, ...data } = dto;
      const result = await tx.course.updateMany({
        where: { id, version },
        data: {
          ...data,
          name: data.name.trim(),
          monthlyPrice: (0, finance_1.money)(data.monthlyPrice),
          version: { increment: 1 },
        },
      });
      if (!result.count)
        throw new common_1.ConflictException(
          "Kursi u ndryshua ose nuk ekziston. Rifreskoni listën.",
        );
      await (0, finance_1.audit)(tx, req.user.id, "COURSE_UPDATE", id);
      return tx.course.findUnique({ where: { id } });
    });
  }
  remove(id, req) {
    return (0, finance_1.atomic)(this.db, async (tx) => {
      if (
        (await tx.group.count({ where: { courseId: id } })) ||
        (await tx.enrollment.count({ where: { courseId: id } })) ||
        (await tx.invoice.count({ where: { courseId: id } }))
      )
        throw new common_1.ConflictException(
          "Kursi ka historik të lidhur. Çaktivizojeni në vend të fshirjes.",
        );
      const result = await tx.course.deleteMany({ where: { id } });
      if (!result.count)
        throw new common_1.NotFoundException("Kursi nuk u gjet.");
      await (0, finance_1.audit)(tx, req.user.id, "COURSE_DELETE", id);
      return { message: "Kursi u fshi." };
    });
  }
};
exports.CoursesController = CoursesController;
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
  CoursesController.prototype,
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
      CourseDto,
      typeof (_e =
        typeof auth_1.AuthRequest !== "undefined" && auth_1.AuthRequest) ===
      "function"
        ? _e
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", void 0),
  ],
  CoursesController.prototype,
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
      CourseUpdate,
      typeof (_f =
        typeof auth_1.AuthRequest !== "undefined" && auth_1.AuthRequest) ===
      "function"
        ? _f
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", void 0),
  ],
  CoursesController.prototype,
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
  CoursesController.prototype,
  "remove",
  null,
);
exports.CoursesController = CoursesController = tslib_1.__decorate(
  [
    (0, common_1.Controller)("courses"),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_b =
        typeof prisma_service_1.PrismaService !== "undefined" &&
        prisma_service_1.PrismaService) === "function"
        ? _b
        : Object,
    ]),
  ],
  CoursesController,
);

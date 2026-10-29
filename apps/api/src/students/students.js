"use strict";
var _a, _b, _c, _d, _e, _f, _g;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentsController =
  exports.UpdateStudentDto =
  exports.StudentDto =
    void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../common/prisma.service");
const auth_1 = require("../auth/auth");
class StudentDto {
  firstName;
  lastName;
  birthDate;
  parentName;
  parentPhone;
  address;
  notes;
  status;
}
exports.StudentDto = StudentDto;
tslib_1.__decorate(
  [
    (0, class_transformer_1.Transform)(({ value }) =>
      typeof value === "string" ? value.trim() : value,
    ),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(80),
    tslib_1.__metadata("design:type", String),
  ],
  StudentDto.prototype,
  "firstName",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_transformer_1.Transform)(({ value }) =>
      typeof value === "string" ? value.trim() : value,
    ),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(80),
    tslib_1.__metadata("design:type", String),
  ],
  StudentDto.prototype,
  "lastName",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/),
    tslib_1.__metadata("design:type", String),
  ],
  StudentDto.prototype,
  "birthDate",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_transformer_1.Transform)(({ value }) =>
      typeof value === "string" ? value.trim() : value,
    ),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(160),
    tslib_1.__metadata("design:type", String),
  ],
  StudentDto.prototype,
  "parentName",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.Matches)(/^\+?[0-9 ()-]{6,30}$/),
    tslib_1.__metadata("design:type", String),
  ],
  StudentDto.prototype,
  "parentPhone",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    tslib_1.__metadata("design:type", String),
  ],
  StudentDto.prototype,
  "address",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    tslib_1.__metadata("design:type", String),
  ],
  StudentDto.prototype,
  "notes",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsEnum)(client_1.StudentStatus),
    tslib_1.__metadata(
      "design:type",
      typeof (_a =
        typeof client_1.StudentStatus !== "undefined" &&
        client_1.StudentStatus) === "function"
        ? _a
        : Object,
    ),
  ],
  StudentDto.prototype,
  "status",
  void 0,
);
class UpdateStudentDto extends StudentDto {
  version;
}
exports.UpdateStudentDto = UpdateStudentDto;
tslib_1.__decorate(
  [
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    tslib_1.__metadata("design:type", Number),
  ],
  UpdateStudentDto.prototype,
  "version",
  void 0,
);
class StudentQuery {
  search;
  status;
  page = 1;
  limit = 12;
  sort = "name";
}
tslib_1.__decorate(
  [
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    tslib_1.__metadata("design:type", String),
  ],
  StudentQuery.prototype,
  "search",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.StudentStatus),
    tslib_1.__metadata(
      "design:type",
      typeof (_b =
        typeof client_1.StudentStatus !== "undefined" &&
        client_1.StudentStatus) === "function"
        ? _b
        : Object,
    ),
  ],
  StudentQuery.prototype,
  "status",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    tslib_1.__metadata("design:type", Object),
  ],
  StudentQuery.prototype,
  "page",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    tslib_1.__metadata("design:type", Object),
  ],
  StudentQuery.prototype,
  "limit",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)({ name: "name", newest: "newest" }),
    tslib_1.__metadata("design:type", String),
  ],
  StudentQuery.prototype,
  "sort",
  void 0,
);
function data(dto) {
  const birthDate = new Date(dto.birthDate + "T00:00:00Z");
  if (
    !Number.isFinite(birthDate.getTime()) ||
    birthDate.toISOString().slice(0, 10) !== dto.birthDate ||
    birthDate > new Date() ||
    birthDate.getUTCFullYear() < 1900
  )
    throw new common_1.BadRequestException(
      "Data e lindjes është e pavlefshme.",
    );
  return {
    firstName: dto.firstName,
    lastName: dto.lastName,
    birthDate,
    parentName: dto.parentName,
    parentPhone: dto.parentPhone,
    address: dto.address ?? null,
    notes: dto.notes ?? null,
    status: dto.status,
  };
}
let StudentsController = class StudentsController {
  db;
  constructor(db) {
    this.db = db;
  }
  async list(query) {
    const where = {
      status: query.status,
      ...(query.search?.trim()
        ? {
            AND: query.search
              .trim()
              .split(/\s+/)
              .map((term) => ({
                OR: ["firstName", "lastName", "parentName", "parentPhone"].map(
                  (key) => ({
                    [key]: { contains: term, mode: "insensitive" },
                  }),
                ),
              })),
          }
        : {}),
    };
    const [total, items] = await this.db.$transaction(
      [
        this.db.student.count({ where }),
        this.db.student.findMany({
          where,
          orderBy:
            query.sort === "newest"
              ? [{ createdAt: "desc" }, { id: "asc" }]
              : [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
      ],
      {
        isolationLevel:
          client_1.Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
    return {
      items,
      total,
      page: query.page,
      pages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }
  async history(id, req) {
    const financial = req.user.role !== "INSTRUCTOR";
    const enrollments = await this.db.enrollment.findMany({
      where: {
        studentId: id,
        ...(!financial ? { group: { instructorId: req.user.id } } : {}),
      },
      include: {
        course: { select: { name: true } },
        group: { select: { name: true } },
      },
      orderBy: { startDate: "desc" },
    });
    return {
      enrollments: enrollments.map((e) =>
        financial
          ? e
          : {
              ...e,
              monthlyPrice: undefined,
              discount: undefined,
              offer: undefined,
            },
      ),
      ...(financial
        ? {
            invoices: await this.db.invoice.findMany({
              where: { studentId: id },
              orderBy: { period: "desc" },
            }),
            payments: await this.db.payment.findMany({
              where: { studentId: id },
              orderBy: { paidAt: "desc" },
              include: { user: { select: { name: true } } },
            }),
          }
        : {}),
    };
  }
  async get(id) {
    const student = await this.db.student.findUnique({ where: { id } });
    if (!student) throw new common_1.NotFoundException("Nxënësi nuk u gjet.");
    return student;
  }
  async create(dto, req) {
    return this.db.$transaction(async (tx) => {
      const student = await tx.student.create({ data: data(dto) });
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: "STUDENT_CREATE",
          entityId: student.id,
        },
      });
      return student;
    });
  }
  async update(id, dto, req) {
    return this.db.$transaction(async (tx) => {
      const result = await tx.student.updateMany({
        where: { id, version: dto.version },
        data: { ...data(dto), version: { increment: 1 } },
      });
      if (!result.count) {
        if (!(await tx.student.findUnique({ where: { id } })))
          throw new common_1.NotFoundException("Nxënësi nuk u gjet.");
        throw new common_1.ConflictException(
          "Të dhënat u ndryshuan nga një përdorues tjetër. Rifreskoni listën.",
        );
      }
      await tx.auditLog.create({
        data: { userId: req.user.id, action: "STUDENT_UPDATE", entityId: id },
      });
      return tx.student.findUnique({ where: { id } });
    });
  }
  async remove(id, req) {
    return this.db.$transaction(async (tx) => {
      if (
        (await tx.enrollment.count({ where: { studentId: id } })) ||
        (await tx.invoice.count({ where: { studentId: id } })) ||
        (await tx.payment.count({ where: { studentId: id } }))
      )
        throw new common_1.ConflictException(
          "Nxënësi ka historik. Çaktivizojeni në vend të fshirjes.",
        );
      const result = await tx.student.deleteMany({ where: { id } });
      if (!result.count)
        throw new common_1.NotFoundException("Nxënësi nuk u gjet.");
      await tx.auditLog.create({
        data: { userId: req.user.id, action: "STUDENT_DELETE", entityId: id },
      });
      return { message: "Nxënësi u fshi." };
    });
  }
};
exports.StudentsController = StudentsController;
tslib_1.__decorate(
  [
    (0, common_1.Get)(),
    tslib_1.__param(0, (0, common_1.Query)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [StudentQuery]),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  StudentsController.prototype,
  "list",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Get)(":id/history"),
    tslib_1.__param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    tslib_1.__param(1, (0, common_1.Req)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      String,
      typeof (_d =
        typeof auth_1.AuthRequest !== "undefined" && auth_1.AuthRequest) ===
      "function"
        ? _d
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  StudentsController.prototype,
  "history",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Get)(":id"),
    tslib_1.__param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [String]),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  StudentsController.prototype,
  "get",
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
      StudentDto,
      typeof (_e =
        typeof auth_1.AuthRequest !== "undefined" && auth_1.AuthRequest) ===
      "function"
        ? _e
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  StudentsController.prototype,
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
      UpdateStudentDto,
      typeof (_f =
        typeof auth_1.AuthRequest !== "undefined" && auth_1.AuthRequest) ===
      "function"
        ? _f
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  StudentsController.prototype,
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
    tslib_1.__metadata("design:returntype", Promise),
  ],
  StudentsController.prototype,
  "remove",
  null,
);
exports.StudentsController = StudentsController = tslib_1.__decorate(
  [
    (0, common_1.Controller)("students"),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_c =
        typeof prisma_service_1.PrismaService !== "undefined" &&
        prisma_service_1.PrismaService) === "function"
        ? _c
        : Object,
    ]),
  ],
  StudentsController,
);

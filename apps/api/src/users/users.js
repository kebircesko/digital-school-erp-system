"use strict";
var _a, _b, _c, _d, _e, _f, _g;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditController = exports.UsersController = exports.UserDto = void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../common/prisma.service");
const finance_1 = require("../common/finance");
const auth_1 = require("../auth/auth");
const password_1 = require("../auth/password");
const query_1 = require("../common/query");
const class_transformer_1 = require("class-transformer");
class UserDto {
  name;
  email;
  role;
  active;
  password;
}
exports.UserDto = UserDto;
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
  UserDto.prototype,
  "name",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(254),
    tslib_1.__metadata("design:type", String),
  ],
  UserDto.prototype,
  "email",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsEnum)(client_1.Role),
    tslib_1.__metadata(
      "design:type",
      typeof (_a = typeof client_1.Role !== "undefined" && client_1.Role) ===
        "function"
        ? _a
        : Object,
    ),
  ],
  UserDto.prototype,
  "role",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsBoolean)(),
    tslib_1.__metadata("design:type", Boolean),
  ],
  UserDto.prototype,
  "active",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(12),
    (0, class_validator_1.MaxLength)(128),
    tslib_1.__metadata("design:type", String),
  ],
  UserDto.prototype,
  "password",
  void 0,
);
const select = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
};
let UsersController = class UsersController {
  db;
  constructor(db) {
    this.db = db;
  }
  async list(q) {
    const where = q.search
      ? {
          OR: [
            { name: { contains: q.search, mode: "insensitive" } },
            { email: { contains: q.search, mode: "insensitive" } },
          ],
        }
      : {};
    const [total, items] = await this.db.$transaction([
      this.db.user.count({ where }),
      this.db.user.findMany({
        where,
        select,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { name: "asc" },
      }),
    ]);
    return (0, query_1.pagination)(total, q, items);
  }
  create(dto, req) {
    if (!dto.password)
      throw new common_1.BadRequestException(
        "Fjalëkalimi është i detyrueshëm.",
      );
    return (0, finance_1.atomic)(this.db, async (tx) => {
      const { password, ...data } = dto;
      const user = await tx.user.create({
        data: {
          ...data,
          email: dto.email.trim().toLowerCase(),
          passwordHash: (0, password_1.hashPassword)(password),
        },
        select,
      });
      await (0, finance_1.audit)(tx, req.user.id, "USER_CREATE", user.id);
      return user;
    });
  }
  update(id, dto, req) {
    return (0, finance_1.atomic)(this.db, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(612041)`;
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw new common_1.NotFoundException("Përdoruesi nuk u gjet.");
      if (
        user.role === "ADMIN" &&
        user.active &&
        (!dto.active || dto.role !== "ADMIN")
      ) {
        const admins = await tx.user.count({
          where: { role: "ADMIN", active: true },
        });
        if (admins <= 1)
          throw new common_1.ConflictException(
            "Duhet të mbetet të paktën një administrator aktiv.",
          );
      }
      if (
        (!dto.active || dto.role !== "INSTRUCTOR") &&
        (await tx.group.count({
          where: { instructorId: id, status: "ACTIVE" },
        }))
      )
        throw new common_1.BadRequestException(
          "Caktoni instruktor tjetër në grupet aktive para ndryshimit.",
        );
      const { password, ...data } = dto;
      const result = await tx.user.update({
        where: { id },
        data: {
          ...data,
          email: data.email.trim().toLowerCase(),
          ...(password
            ? { passwordHash: (0, password_1.hashPassword)(password) }
            : {}),
        },
        select,
      });
      if (password || user.active !== dto.active || user.role !== dto.role)
        await tx.session.deleteMany({ where: { userId: id } });
      await (0, finance_1.audit)(tx, req.user.id, "USER_UPDATE", id);
      return result;
    });
  }
};
exports.UsersController = UsersController;
tslib_1.__decorate(
  [
    (0, common_1.Get)(),
    tslib_1.__param(0, (0, common_1.Query)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_c =
        typeof query_1.ListQuery !== "undefined" && query_1.ListQuery) ===
      "function"
        ? _c
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  UsersController.prototype,
  "list",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Post)(),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__param(1, (0, common_1.Req)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      UserDto,
      typeof (_d =
        typeof auth_1.AuthRequest !== "undefined" && auth_1.AuthRequest) ===
      "function"
        ? _d
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", void 0),
  ],
  UsersController.prototype,
  "create",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Patch)(":id"),
    tslib_1.__param(0, (0, common_1.Param)("id", common_1.ParseUUIDPipe)),
    tslib_1.__param(1, (0, common_1.Body)()),
    tslib_1.__param(2, (0, common_1.Req)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      String,
      UserDto,
      typeof (_e =
        typeof auth_1.AuthRequest !== "undefined" && auth_1.AuthRequest) ===
      "function"
        ? _e
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", void 0),
  ],
  UsersController.prototype,
  "update",
  null,
);
exports.UsersController = UsersController = tslib_1.__decorate(
  [
    (0, common_1.Controller)("users"),
    (0, auth_1.Roles)("ADMIN"),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_b =
        typeof prisma_service_1.PrismaService !== "undefined" &&
        prisma_service_1.PrismaService) === "function"
        ? _b
        : Object,
    ]),
  ],
  UsersController,
);
let AuditController = class AuditController {
  db;
  constructor(db) {
    this.db = db;
  }
  async list(q) {
    const where = q.search
      ? { action: { contains: q.search, mode: "insensitive" } }
      : {};
    const [total, items] = await this.db.$transaction([
      this.db.auditLog.count({ where }),
      this.db.auditLog.findMany({
        where,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, email: true } } },
      }),
    ]);
    return (0, query_1.pagination)(total, q, items);
  }
};
exports.AuditController = AuditController;
tslib_1.__decorate(
  [
    (0, common_1.Get)(),
    tslib_1.__param(0, (0, common_1.Query)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_g =
        typeof query_1.ListQuery !== "undefined" && query_1.ListQuery) ===
      "function"
        ? _g
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  AuditController.prototype,
  "list",
  null,
);
exports.AuditController = AuditController = tslib_1.__decorate(
  [
    (0, common_1.Controller)("audit"),
    (0, auth_1.Roles)("ADMIN"),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_f =
        typeof prisma_service_1.PrismaService !== "undefined" &&
        prisma_service_1.PrismaService) === "function"
        ? _f
        : Object,
    ]),
  ],
  AuditController,
);

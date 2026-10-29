"use strict";
var _a, _b, _c, _d, _e;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController =
  exports.AuthGuard =
  exports.LoginDto =
  exports.Roles =
    void 0;
const tslib_1 = require("tslib");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const class_validator_1 = require("class-validator");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../common/prisma.service");
const password_1 = require("./password");
const Roles = (...roles) => (0, common_1.SetMetadata)("roles", roles);
exports.Roles = Roles;
class LoginDto {
  email;
  password;
}
exports.LoginDto = LoginDto;
tslib_1.__decorate(
  [
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(254),
    tslib_1.__metadata("design:type", String),
  ],
  LoginDto.prototype,
  "email",
  void 0,
);
tslib_1.__decorate(
  [
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(128),
    tslib_1.__metadata("design:type", String),
  ],
  LoginDto.prototype,
  "password",
  void 0,
);
const dummyHash = (0, password_1.hashPassword)(
  (0, node_crypto_1.randomBytes)(32).toString("hex"),
);
let AuthGuard = class AuthGuard {
  db;
  reflector;
  constructor(db, reflector) {
    this.db = db;
    this.reflector = reflector;
  }
  async canActivate(ctx) {
    if (this.reflector.get("public", ctx.getHandler())) return true;
    const req = ctx.switchToHttp().getRequest();
    const token = req.headers.authorization?.match(
      /^Bearer ([a-f0-9]{64})$/,
    )?.[1];
    if (!token) throw new common_1.UnauthorizedException("Ju lutemi kyçuni.");
    const session = await this.db.session.findUnique({
      where: { tokenHash: (0, password_1.hashToken)(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date() || !session.user.active)
      throw new common_1.UnauthorizedException("Sesioni ka skaduar.");
    req.user = session.user;
    req.session = session;
    const roles = this.reflector.getAllAndOverride("roles", [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (roles && !roles.includes(req.user.role))
      throw new common_1.ForbiddenException("Nuk keni leje për këtë veprim.");
    return true;
  }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = tslib_1.__decorate(
  [
    (0, common_1.Injectable)(),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_a =
        typeof prisma_service_1.PrismaService !== "undefined" &&
        prisma_service_1.PrismaService) === "function"
        ? _a
        : Object,
      typeof (_b =
        typeof core_1.Reflector !== "undefined" && core_1.Reflector) ===
      "function"
        ? _b
        : Object,
    ]),
  ],
  AuthGuard,
);
let AuthController = class AuthController {
  db;
  constructor(db) {
    this.db = db;
  }
  async login(dto) {
    const user = await this.db.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    const valid = (0, password_1.verifyPassword)(
      dto.password,
      user?.passwordHash ?? dummyHash,
    );
    if (!user || !user.active || !valid)
      throw new common_1.UnauthorizedException(
        "Emaili ose fjalëkalimi është i pasaktë.",
      );
    const token = (0, node_crypto_1.randomBytes)(32).toString("hex");
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await this.db.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      await tx.session.create({
        data: {
          tokenHash: (0, password_1.hashToken)(token),
          userId: user.id,
          expiresAt,
        },
      });
      await tx.auditLog.create({ data: { userId: user.id, action: "LOGIN" } });
    });
    return {
      token,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
  me(req) {
    const { id, email, name, role } = req.user;
    return { id, email, name, role };
  }
  async logout(req) {
    await this.db.$transaction([
      this.db.session.deleteMany({ where: { id: req.session.id } }),
      this.db.auditLog.create({
        data: { userId: req.user.id, action: "LOGOUT" },
      }),
    ]);
    return { message: "U çkyçët me sukses." };
  }
};
exports.AuthController = AuthController;
tslib_1.__decorate(
  [
    (0, common_1.Post)("login"),
    (0, common_1.SetMetadata)("public", true),
    tslib_1.__param(0, (0, common_1.Body)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [LoginDto]),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  AuthController.prototype,
  "login",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Get)("me"),
    tslib_1.__param(0, (0, common_1.Req)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_d = typeof AuthRequest !== "undefined" && AuthRequest) ===
      "function"
        ? _d
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", void 0),
  ],
  AuthController.prototype,
  "me",
  null,
);
tslib_1.__decorate(
  [
    (0, common_1.Post)("logout"),
    tslib_1.__param(0, (0, common_1.Req)()),
    tslib_1.__metadata("design:type", Function),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_e = typeof AuthRequest !== "undefined" && AuthRequest) ===
      "function"
        ? _e
        : Object,
    ]),
    tslib_1.__metadata("design:returntype", Promise),
  ],
  AuthController.prototype,
  "logout",
  null,
);
exports.AuthController = AuthController = tslib_1.__decorate(
  [
    (0, common_1.Controller)("auth"),
    tslib_1.__metadata("design:paramtypes", [
      typeof (_c =
        typeof prisma_service_1.PrismaService !== "undefined" &&
        prisma_service_1.PrismaService) === "function"
        ? _c
        : Object,
    ]),
  ],
  AuthController,
);

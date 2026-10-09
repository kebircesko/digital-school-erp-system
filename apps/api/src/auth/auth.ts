import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  CanActivate,
  ExecutionContext,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../common/prisma.service";
import { hashToken, verifyPassword, hashPassword } from "./password";
import { Role, Session, User } from "@prisma/client";
import { Request } from "express";
export type AuthRequest = Request & { user: User; session: Session };
export const Roles = (...roles: Role[]) => SetMetadata("roles", roles);
export class LoginDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(1) @MaxLength(128) password!: string;
}
const dummyHash = hashPassword(randomBytes(32).toString("hex"));
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private db: PrismaService,
    private reflector: Reflector,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    if (this.reflector.get<boolean>("public", ctx.getHandler())) return true;
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    const token = req.headers.authorization?.match(
      /^Bearer ([a-f0-9]{64})$/,
    )?.[1];
    if (!token) throw new UnauthorizedException("Ju lutemi kyçuni.");
    const session = await this.db.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt <= new Date() || !session.user.active)
      throw new UnauthorizedException("Sesioni ka skaduar.");
    req.user = session.user;
    req.session = session;
    const roles = this.reflector.getAllAndOverride<Role[]>("roles", [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (roles && !roles.includes(req.user.role))
      throw new ForbiddenException("Nuk keni leje për këtë veprim.");
    return true;
  }
}
@Controller("auth")
export class AuthController {
  constructor(private db: PrismaService) {}
  @Post("login")
  @SetMetadata("public", true)
  async login(@Body() dto: LoginDto) {
    const user = await this.db.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    const valid = verifyPassword(dto.password, user?.passwordHash ?? dummyHash);
    if (!user || !user.active || !valid)
      throw new UnauthorizedException(
        "Emaili ose fjalëkalimi është i pasaktë.",
      );
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await this.db.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      await tx.session.create({
        data: { tokenHash: hashToken(token), userId: user.id, expiresAt },
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
  @Get("me") me(@Req() req: AuthRequest) {
    const { id, email, name, role } = req.user;
    return { id, email, name, role };
  }
  @Post("logout") async logout(@Req() req: AuthRequest) {
    await this.db.$transaction([
      this.db.session.deleteMany({ where: { id: req.session.id } }),
      this.db.auditLog.create({
        data: { userId: req.user.id, action: "LOGOUT" },
      }),
    ]);
    return { message: "U çkyçët me sukses." };
  }
}

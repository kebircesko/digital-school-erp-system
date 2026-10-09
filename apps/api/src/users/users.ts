import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import {
  IsString,
  IsEmail,
  MaxLength,
  MinLength,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
} from "class-validator";
import { Role } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { atomic, audit } from "../common/finance";
import { AuthRequest, Roles } from "../auth/auth";
import { hashPassword } from "../auth/password";
import { ListQuery, pagination } from "../common/query";
import { Transform } from "class-transformer";
export class UserDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsEnum(Role) role!: Role;
  @IsBoolean() active!: boolean;
  @IsOptional() @IsString() @MinLength(12) @MaxLength(128) password?: string;
}
const select = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
};
@Controller("users")
@Roles("ADMIN")
export class UsersController {
  constructor(private db: PrismaService) {}
  @Get() async list(@Query() q: ListQuery) {
    const where = q.search
      ? {
          OR: [
            { name: { contains: q.search, mode: "insensitive" as const } },
            { email: { contains: q.search, mode: "insensitive" as const } },
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
    return pagination(total, q, items);
  }
  @Post() create(@Body() dto: UserDto, @Req() req: AuthRequest) {
    if (!dto.password)
      throw new BadRequestException("Fjalëkalimi është i detyrueshëm.");
    return atomic(this.db, async (tx) => {
      const { password, ...data } = dto;
      const user = await tx.user.create({
        data: {
          ...data,
          email: dto.email.trim().toLowerCase(),
          passwordHash: hashPassword(password!),
        },
        select,
      });
      await audit(tx, req.user.id, "USER_CREATE", user.id);
      return user;
    });
  }
  @Patch(":id") update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UserDto,
    @Req() req: AuthRequest,
  ) {
    return atomic(this.db, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(612041)`;
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw new NotFoundException("Përdoruesi nuk u gjet.");
      if (
        user.role === "ADMIN" &&
        user.active &&
        (!dto.active || dto.role !== "ADMIN")
      ) {
        const admins = await tx.user.count({
          where: { role: "ADMIN", active: true },
        });
        if (admins <= 1)
          throw new ConflictException(
            "Duhet të mbetet të paktën një administrator aktiv.",
          );
      }
      if (
        (!dto.active || dto.role !== "INSTRUCTOR") &&
        (await tx.group.count({
          where: { instructorId: id, status: "ACTIVE" },
        }))
      )
        throw new BadRequestException(
          "Caktoni instruktor tjetër në grupet aktive para ndryshimit.",
        );
      const { password, ...data } = dto;
      const result = await tx.user.update({
        where: { id },
        data: {
          ...data,
          email: data.email.trim().toLowerCase(),
          ...(password ? { passwordHash: hashPassword(password) } : {}),
        },
        select,
      });
      if (password || user.active !== dto.active || user.role !== dto.role)
        await tx.session.deleteMany({ where: { userId: id } });
      await audit(tx, req.user.id, "USER_UPDATE", id);
      return result;
    });
  }
}
@Controller("audit")
@Roles("ADMIN")
export class AuditController {
  constructor(private db: PrismaService) {}
  @Get() async list(@Query() q: ListQuery) {
    const where = q.search
      ? { action: { contains: q.search, mode: "insensitive" as const } }
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
    return pagination(total, q, items);
  }
}

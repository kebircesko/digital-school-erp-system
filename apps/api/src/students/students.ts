import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import {
  IsString,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
  Matches,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { Prisma, StudentStatus } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { Roles, AuthRequest } from "../auth/auth";
export class StudentDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) birthDate!: string;
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  parentName!: string;
  @Matches(/^\+?[0-9 ()-]{6,30}$/) parentPhone!: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsEnum(StudentStatus) status!: StudentStatus;
}
export class UpdateStudentDto extends StudentDto {
  @IsInt() @Min(1) version!: number;
}
class StudentQuery {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsEnum(StudentStatus) status?: StudentStatus;
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 12;
  @IsOptional() @IsEnum({ name: "name", newest: "newest" }) sort:
    "name" | "newest" = "name";
}
function data(dto: StudentDto) {
  const birthDate = new Date(dto.birthDate + "T00:00:00Z");
  if (
    !Number.isFinite(birthDate.getTime()) ||
    birthDate.toISOString().slice(0, 10) !== dto.birthDate ||
    birthDate > new Date() ||
    birthDate.getUTCFullYear() < 1900
  )
    throw new BadRequestException("Data e lindjes është e pavlefshme.");
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
@Controller("students")
export class StudentsController {
  constructor(private db: PrismaService) {}
  @Get() async list(@Query() query: StudentQuery) {
    const where: Prisma.StudentWhereInput = {
      status: query.status,
      ...(query.search
        ? {
            OR: ["firstName", "lastName", "parentName", "parentPhone"].map(
              (key) => ({
                [key]: { contains: query.search, mode: "insensitive" },
              }),
            ),
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
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      items,
      total,
      page: query.page,
      pages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  @Get(":id/history") async history(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ) {
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
  @Get(":id") async get(@Param("id", ParseUUIDPipe) id: string) {
    const student = await this.db.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException("Nxënësi nuk u gjet.");
    return student;
  }
  @Post() @Roles("ADMIN", "FINANCE") async create(
    @Body() dto: StudentDto,
    @Req() req: AuthRequest,
  ) {
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
  @Patch(":id") @Roles("ADMIN", "FINANCE") async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentDto,
    @Req() req: AuthRequest,
  ) {
    return this.db.$transaction(async (tx) => {
      const result = await tx.student.updateMany({
        where: { id, version: dto.version },
        data: { ...data(dto), version: { increment: 1 } },
      });
      if (!result.count) {
        if (!(await tx.student.findUnique({ where: { id } })))
          throw new NotFoundException("Nxënësi nuk u gjet.");
        throw new ConflictException(
          "Të dhënat u ndryshuan nga një përdorues tjetër. Rifreskoni listën.",
        );
      }
      await tx.auditLog.create({
        data: { userId: req.user.id, action: "STUDENT_UPDATE", entityId: id },
      });
      return tx.student.findUnique({ where: { id } });
    });
  }
  @Delete(":id") @Roles("ADMIN") async remove(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ) {
    return this.db.$transaction(async (tx) => {
      if (
        (await tx.enrollment.count({ where: { studentId: id } })) ||
        (await tx.invoice.count({ where: { studentId: id } })) ||
        (await tx.payment.count({ where: { studentId: id } }))
      )
        throw new ConflictException(
          "Nxënësi ka historik. Çaktivizojeni në vend të fshirjes.",
        );
      const result = await tx.student.deleteMany({ where: { id } });
      if (!result.count) throw new NotFoundException("Nxënësi nuk u gjet.");
      await tx.auditLog.create({
        data: { userId: req.user.id, action: "STUDENT_DELETE", entityId: id },
      });
      return { message: "Nxënësi u fshi." };
    });
  }
}

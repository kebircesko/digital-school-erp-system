"use strict";
const ExcelJS = require("exceljs");
const { Prisma } = require("@prisma/client");
const { Type } = require("class-transformer");
const { parseClassReport, previewClassReport } = require("./class-report");
const { attendanceSummary } = require("./summary");
const { createHash } = require("node:crypto");
const {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  Res,
  BadRequestException,
  ConflictException,
} = require("@nestjs/common");
const {
  IsString,
  MaxLength,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsInt,
  Min,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
} = require("class-validator");
const { __decorate, __metadata, __param } = require("tslib");
const { PrismaService } = require("../common/prisma.service");
const { Roles } = require("../auth/auth");
const { ListQuery } = require("../common/query");
const { periodDates, today, atomic, audit } = require("../common/finance");
const HEADERS = [
  "ID nxënësit",
  "Nxënësi",
  "ID kursit",
  "Kursi",
  "Muaji",
  "Orë gjithsej",
  "Mungesa",
  "Me arsye",
];
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
class AttendanceMatch {
  row;
  studentId;
}
__decorate(
  [IsInt(), Min(1), __metadata("design:type", Number)],
  AttendanceMatch.prototype,
  "row",
);
__decorate(
  [IsUUID(), __metadata("design:type", String)],
  AttendanceMatch.prototype,
  "studentId",
);
class AttendanceUpload {
  filename;
  content;
  commit = false;
  previewToken;
  groupId;
  matches;
}
__decorate(
  [IsOptional(), IsUUID(), __metadata("design:type", String)],
  AttendanceUpload.prototype,
  "groupId",
);
__decorate(
  [
    IsOptional(),
    IsArray(),
    ArrayMaxSize(2000),
    ValidateNested({ each: true }),
    Type(() => AttendanceMatch),
  ],
  AttendanceUpload.prototype,
  "matches",
);
for (const field of ["filename", "content", "previewToken"])
  __decorate(
    [
      ...(field === "previewToken" ? [IsOptional()] : []),
      IsString(),
      MaxLength(field === "content" ? 2800000 : 200),
      __metadata("design:type", String),
    ],
    AttendanceUpload.prototype,
    field,
  );
__decorate(
  [IsBoolean(), __metadata("design:type", Boolean)],
  AttendanceUpload.prototype,
  "commit",
);

function cellValue(cell) {
  if (typeof cell.value === "object" && cell.value !== null)
    throw new Error(
      "Nuk lejohen formula ose qeliza të përbëra në kolonat e importit.",
    );
  return cell.value;
}
function integer(value) {
  if (
    !/^\d+$/.test(String(value ?? "")) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) > 1000
  )
    throw new Error(
      "Orët dhe mungesat duhet të jenë numra të plotë nga 0 deri 1000.",
    );
  return Number(value);
}
async function parseAttendance(content) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(content) || content.length > 2800000)
    throw new BadRequestException(
      "Skedari është i pavlefshëm ose tejkalon 2 MB.",
    );
  const buffer = Buffer.from(content, "base64");
  if (buffer.length > 2 * 1024 * 1024)
    throw new BadRequestException("Skedari tejkalon 2 MB.");
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new BadRequestException(
      "Ngarkoni një skedar Excel .xlsx të vlefshëm.",
    );
  }
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount > 2001)
    throw new BadRequestException(
      "Lejohen deri në 2000 rreshta në fletën e parë.",
    );
  const columns = new Map();
  sheet
    .getRow(1)
    .eachCell((cell, index) => columns.set(normalize(cell.text), index));
  for (const header of [HEADERS[0], HEADERS[2], ...HEADERS.slice(4)])
    if (!columns.has(normalize(header)))
      throw new BadRequestException(
        `Mungon kolona: ${header}. Përdorni modelin Excel.`,
      );
  const rows = [],
    errors = [],
    seen = new Set();
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    if (!row.hasValues) continue;
    try {
      const get = (header) =>
        cellValue(row.getCell(columns.get(normalize(header))));
      const studentId = String(get(HEADERS[0]) ?? "")
        .trim()
        .toLowerCase();
      const courseId = String(get(HEADERS[2]) ?? "")
        .trim()
        .toLowerCase();
      const period = String(get(HEADERS[4]) ?? "").trim();
      if (!uuid.test(studentId) || !uuid.test(courseId))
        throw new Error("ID e nxënësit ose kursit është e pavlefshme.");
      periodDates(period);
      if (period > today().slice(0, 7))
        throw new Error("Nuk importohen mungesa për muaj të ardhshëm.");
      const totalLessons = integer(get(HEADERS[5])),
        absences = integer(get(HEADERS[6])),
        excusedAbsences = integer(get(HEADERS[7]));
      if (absences > totalLessons || excusedAbsences > absences)
        throw new Error(
          "Mungesat nuk mund të tejkalojnë orët; ato me arsye janë pjesë e mungesave.",
        );
      const key = `${studentId}:${courseId}:${period}`;
      if (seen.has(key))
        throw new Error("Nxënësi dhe kursi përsëriten për të njëjtin muaj.");
      seen.add(key);
      rows.push({
        row: i,
        studentId,
        courseId,
        period,
        totalLessons,
        absences,
        excusedAbsences,
      });
    } catch (e) {
      errors.push({ row: i, message: e.message });
    }
  }
  if (!rows.length && !errors.length)
    throw new BadRequestException(
      "Plotësoni orët dhe mungesat në modelin Excel.",
    );
  return { rows, errors };
}
async function previewAttendance(db, parsed, content) {
  const { rows } = parsed,
    errors = [...parsed.errors];
  const studentIds = [...new Set(rows.map((r) => r.studentId))];
  const [enrollments, existing] = studentIds.length
    ? await Promise.all([
        db.enrollment.findMany({
          where: { studentId: { in: studentIds } },
          include: { student: true, course: true },
        }),
        db.monthlyAttendance.findMany({
          where: { studentId: { in: studentIds } },
        }),
      ])
    : [[], []];
  const items = rows.map((row) => {
    const { first, last } = periodDates(row.period);
    const e = enrollments.find(
      (e) =>
        e.studentId === row.studentId &&
        e.courseId === row.courseId &&
        e.startDate <= last &&
        (!e.endDate || e.endDate >= first),
    );
    if (!e)
      errors.push({
        row: row.row,
        message: "Nxënësi nuk ka regjistrim në këtë kurs për muajin e shënuar.",
      });
    const before = existing.find(
      (a) =>
        a.studentId === row.studentId &&
        a.courseId === row.courseId &&
        a.period === row.period,
    );
    return {
      ...row,
      studentName: e
        ? `${e.student.firstName} ${e.student.lastName}`
        : "I panjohur",
      courseName: e?.course.name ?? "I panjohur",
      replacesExisting: !!before,
      previous: before
        ? {
            totalLessons: before.totalLessons,
            absences: before.absences,
            excusedAbsences: before.excusedAbsences,
            sourceCounts: before.sourceCounts ?? null,
          }
        : null,
      revision: before?.updatedAt.toISOString() ?? null,
    };
  });
  const previewToken = createHash("sha256")
    .update(content)
    .update(JSON.stringify(items))
    .digest("hex");
  return {
    items,
    errors,
    previewToken,
    valid: errors.length === 0,
    count: items.length,
  };
}
class AttendanceController {
  constructor(db) {
    this.db = db;
  }
  summary(query) {
    return attendanceSummary(this.db, query);
  }
  async upload(dto, req) {
    const pdf = /\.pdf$/i.test(dto.filename);
    if (!/\.(xlsx|pdf)$/i.test(dto.filename))
      throw new BadRequestException(
        "Lejohen skedarë .xlsx ose raporti DSOS .pdf.",
      );
    const parsed = pdf
      ? await parseClassReport(dto.content)
      : await parseAttendance(dto.content);
    const previewFor = (db) =>
      pdf
        ? previewClassReport(db, parsed, dto)
        : previewAttendance(db, parsed, dto.content);
    if (!dto.commit) return previewFor(this.db);
    return atomic(this.db, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(612040)`;
      const preview = await previewFor(tx);
      if (!preview.valid)
        throw new BadRequestException(
          "Korrigjoni gabimet e skedarit para importit.",
        );
      if (!dto.previewToken || preview.previewToken !== dto.previewToken)
        throw new ConflictException(
          "Të dhënat kanë ndryshuar. Shikoni sërish parashikimin para ruajtjes.",
        );
      for (const row of pdf ? preview.items : parsed.rows) {
        const data = {
          studentId: row.studentId,
          courseId: row.courseId,
          period: row.period,
          totalLessons: row.totalLessons,
          absences: row.absences,
          excusedAbsences: row.excusedAbsences,
          sourceCounts: row.sourceCounts ?? Prisma.DbNull,
        };
        await tx.monthlyAttendance.upsert({
          where: {
            studentId_courseId_period: {
              studentId: data.studentId,
              courseId: data.courseId,
              period: data.period,
            },
          },
          create: { ...data, sourceFile: dto.filename },
          update: { ...data, sourceFile: dto.filename },
        });
      }
      await audit(
        tx,
        req.user.id,
        "ATTENDANCE_IMPORT",
        `${dto.filename}:${parsed.rows.length}`,
      );
      return { imported: parsed.rows.length };
    });
  }
  async template(q, res) {
    const period = q.period ?? today().slice(0, 7),
      { first, last } = periodDates(period);
    const enrollments = await this.db.enrollment.findMany({
      where: {
        startDate: { lte: last },
        OR: [{ endDate: null }, { endDate: { gte: first } }],
        student: { status: "ACTIVE" },
      },
      include: { student: true, course: true },
      orderBy: [{ studentId: "asc" }, { courseId: "asc" }],
    });
    const book = new ExcelJS.Workbook(),
      sheet = book.addWorksheet("Mungesat");
    sheet.addRow(HEADERS);
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF00004E" },
    };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    const seen = new Set();
    for (const e of enrollments) {
      const key = `${e.studentId}:${e.courseId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sheet.addRow([
        e.studentId,
        `${e.student.firstName} ${e.student.lastName}`,
        e.courseId,
        e.course.name,
        period,
        null,
        null,
        0,
      ]);
    }
    [38, 28, 38, 28, 14, 18, 14, 14].forEach((width, i) => {
      sheet.getColumn(i + 1).width = width;
    });
    res
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .attachment(`mungesat-${period}.xlsx`)
      .send(Buffer.from(await book.xlsx.writeBuffer()));
  }
}
__decorate(
  [
    Get("summary"),
    Roles("ADMIN", "FINANCE"),
    __param(0, Query()),
    __metadata("design:paramtypes", [ListQuery]),
  ],
  AttendanceController.prototype,
  "summary",
  null,
);
__decorate(
  [
    Post("import"),
    __param(0, Body()),
    __param(1, Req()),
    __metadata("design:paramtypes", [AttendanceUpload, Object]),
  ],
  AttendanceController.prototype,
  "upload",
  null,
);
__decorate(
  [
    Get("template.xlsx"),
    __param(0, Query()),
    __param(1, Res()),
    __metadata("design:paramtypes", [ListQuery, Object]),
  ],
  AttendanceController.prototype,
  "template",
  null,
);
__decorate(
  [
    Controller("attendance"),
    Roles("ADMIN"),
    __metadata("design:paramtypes", [PrismaService]),
  ],
  AttendanceController,
);
module.exports = { AttendanceController, parseAttendance, previewAttendance };

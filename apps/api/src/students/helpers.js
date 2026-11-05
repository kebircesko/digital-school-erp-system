const { ConflictException } = require("@nestjs/common");
const { calendarDate, today } = require("../common/finance");

function activeEnrollment(day = today()) {
  const date = calendarDate(day);
  return {
    status: "ACTIVE",
    startDate: { lte: date },
    OR: [{ endDate: null }, { endDate: { gte: date } }],
  };
}
function incompletePhone(phone) {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length < 8 || digits.length > 15 || /^(\d)\1+$/.test(digits);
}
async function studentFilters(db, query) {
  const active = activeEnrollment();
  const filters = [];
  if (query.filter === "recent") {
    const to = new Date();
    filters.push({
      createdAt: { gte: new Date(to.getTime() - 30 * 86400000), lte: to },
    });
  }
  if (query.courseId || query.groupId)
    filters.push({
      enrollments: {
        some: {
          ...active,
          ...(query.courseId ? { courseId: query.courseId } : {}),
          ...(query.groupId ? { groupId: query.groupId } : {}),
        },
      },
    });
  if (query.filter === "noGroup")
    filters.push({ enrollments: { none: active } });
  if (query.filter === "debt")
    filters.push({
      invoices: { some: { status: { in: ["UNPAID", "PARTIAL"] } } },
    });
  if (query.filter === "endingSoon") {
    const from = calendarDate(today()),
      to = new Date(from.getTime() + 30 * 86400000);
    filters.push({
      enrollments: { some: { ...active, endDate: { gte: from, lte: to } } },
    });
  }
  if (query.filter === "incompletePhone") {
    const rows = await db.student.findMany({
      select: { id: true, parentPhone: true },
    });
    filters.push({
      id: {
        in: rows.filter((s) => incompletePhone(s.parentPhone)).map((s) => s.id),
      },
    });
  }
  return filters;
}
async function duplicates(db, dto, excludeId) {
  return db.student.findMany({
    where: {
      firstName: { equals: dto.firstName.trim(), mode: "insensitive" },
      lastName: { equals: dto.lastName.trim(), mode: "insensitive" },
      birthDate: calendarDate(dto.birthDate),
      ...(dto.requestId
        ? {
            OR: [
              { registrationKey: null },
              { registrationKey: { not: dto.requestId } },
            ],
          }
        : {}),
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      parentName: true,
      parentPhone: true,
    },
    orderBy: { createdAt: "asc" },
    take: 10,
  });
}
async function checkDuplicate(tx, dto, excludeId) {
  // Serialize writes to make the warning reliable even for concurrent submissions.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(612041)`;
  const matches = await duplicates(tx, dto, excludeId);
  if (matches.length && dto.allowDuplicate !== true)
    throw new ConflictException({
      message: "Ekziston nxënës me të njëjtin emër dhe datëlindje.",
      duplicates: matches,
    });
}
module.exports = {
  activeEnrollment,
  incompletePhone,
  studentFilters,
  duplicates,
  checkDuplicate,
};

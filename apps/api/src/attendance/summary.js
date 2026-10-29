const { BadRequestException } = require("@nestjs/common");
const { periodDates } = require("../common/finance");
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

async function attendanceSummary(db, query) {
  if (
    !uuid.test(query.studentId ?? "") ||
    (query.courseId && !uuid.test(query.courseId))
  )
    throw new BadRequestException("Zgjidhni nxënësin dhe kursin e vlefshëm.");
  periodDates(query.period);
  const rows = await db.monthlyAttendance.findMany({
    where: {
      studentId: query.studentId,
      period: query.period,
      ...(query.courseId ? { courseId: query.courseId } : {}),
    },
    include: { course: { select: { name: true } } },
    orderBy: { courseId: "asc" },
  });
  return {
    studentId: query.studentId,
    period: query.period,
    items: rows.map((row) => ({
      courseId: row.courseId,
      courseName: row.course.name,
      totalLessons: row.totalLessons,
      sourceFile: row.sourceFile,
      updatedAt: row.updatedAt,
      hasStatusBreakdown: !!row.sourceCounts,
      counts: {
        P: row.sourceCounts?.present ?? row.totalLessons - row.absences,
        A: row.absences,
        U: row.sourceCounts?.undefined ?? null,
        T: row.sourceCounts?.tardy ?? null,
        unmarked: row.sourceCounts?.noAttendance ?? null,
      },
    })),
  };
}

module.exports = { attendanceSummary };

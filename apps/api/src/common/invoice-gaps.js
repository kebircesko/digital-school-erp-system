const { today, calendarDate, periodDates } = require("./finance");
const { pagination } = require("./query");
const { BadRequestException } = require("@nestjs/common");

function invoiceGaps(enrollments, invoices, day = today()) {
  const current = day.slice(0, 7);
  const registered = new Set(
    invoices.map((row) => `${row.courseId}:${row.period}`),
  );
  const courses = new Map();
  for (const enrollment of enrollments) {
    const start = new Date(enrollment.startDate).toISOString().slice(0, 10);
    if (start > day) continue;
    const end = enrollment.endDate
      ? new Date(enrollment.endDate).toISOString().slice(0, 7)
      : current;
    const last = end < current ? end : current;
    const first = start.slice(0, 7);
    if (!courses.has(enrollment.courseId))
      courses.set(enrollment.courseId, {
        courseId: enrollment.courseId,
        courseName: enrollment.course.name,
        periods: new Set(),
      });
    const course = courses.get(enrollment.courseId);
    let [year, month] = first.split("-").map(Number);
    for (
      let period = first;
      period <= last;
      period = `${year}-${String(month).padStart(2, "0")}`
    ) {
      if (!registered.has(`${enrollment.courseId}:${period}`))
        course.periods.add(period);
      if (++month > 12) {
        month = 1;
        year++;
      }
    }
  }
  const items = [];
  for (const course of courses.values()) {
    const periods = [...course.periods].sort();
    if (!periods.length) continue;
    const ranges = [];
    for (const period of periods) {
      const previous = ranges.at(-1);
      const [year, month] = period.split("-").map(Number);
      const prior = `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, "0")}`;
      if (previous?.to === prior) {
        previous.to = period;
        previous.count++;
      } else ranges.push({ from: period, to: period, count: 1 });
    }
    items.push({
      courseId: course.courseId,
      courseName: course.courseName,
      total: periods.length,
      ranges,
    });
  }
  return {
    total: items.reduce((sum, course) => sum + course.total, 0),
    courses: items,
  };
}

async function missingInvoiceList(db, query) {
  if (query.period) periodDates(query.period);
  const sort = query.sort ?? "createdAt:desc";
  if (!/^(createdAt|studentName|courseName|period):(asc|desc)$/.test(sort))
    throw new BadRequestException("Renditja është e pavlefshme.");
  const day = today();
  const students = await db.student.findMany({
    where: {
      status: "ACTIVE",
      ...(query.studentId ? { id: query.studentId } : {}),
      ...(query.search?.trim()
        ? {
            AND: query.search
              .trim()
              .split(/\s+/)
              .map((term) => ({
                OR: ["firstName", "lastName"].map((key) => ({
                  [key]: { contains: term, mode: "insensitive" },
                })),
              })),
          }
        : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      enrollments: {
        where: {
          startDate: { lte: calendarDate(day) },
          ...(query.courseId ? { courseId: query.courseId } : {}),
          ...(query.groupId ? { groupId: query.groupId } : {}),
        },
        select: {
          id: true,
          courseId: true,
          startDate: true,
          endDate: true,
          course: { select: { name: true } },
          group: { select: { name: true } },
        },
        orderBy: [{ startDate: "asc" }, { id: "asc" }],
      },
      invoices: { select: { courseId: true, period: true } },
    },
  });
  const rows = [];
  for (const student of students) {
    const gaps = invoiceGaps(student.enrollments, student.invoices, day);
    for (const course of gaps.courses) {
      for (const range of course.ranges) {
        const date = calendarDate(`${range.from}-01`);
        for (
          let period = range.from;
          period <= range.to;
          date.setUTCMonth(date.getUTCMonth() + 1),
            period = date.toISOString().slice(0, 7)
        ) {
          if (query.period && period !== query.period) continue;
          const { first, last } = periodDates(period);
          const enrollment = student.enrollments.find(
            (e) =>
              e.courseId === course.courseId &&
              e.startDate <= last &&
              (!e.endDate || e.endDate >= first),
          );
          rows.push({
            id: `${student.id}:${course.courseId}:${period}`,
            studentId: student.id,
            studentName: `${student.firstName} ${student.lastName}`,
            student: {
              id: student.id,
              firstName: student.firstName,
              lastName: student.lastName,
            },
            courseId: course.courseId,
            courseName: course.courseName,
            groupName: enrollment?.group.name ?? "",
            period,
            status: "MISSING",
          });
        }
      }
    }
  }
  const [key, direction] = sort.split(":");
  const field = key === "createdAt" ? "period" : key;
  rows.sort(
    (a, b) =>
      String(a[field]).localeCompare(String(b[field]), "sq", {
        numeric: true,
      }) * (direction === "asc" ? 1 : -1) || a.id.localeCompare(b.id),
  );
  return {
    ...pagination(
      rows.length,
      query,
      rows.slice((query.page - 1) * query.limit, query.page * query.limit),
    ),
    missing: true,
  };
}

module.exports = { invoiceGaps, missingInvoiceList };

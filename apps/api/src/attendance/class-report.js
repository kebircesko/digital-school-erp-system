const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { mkdtemp, writeFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createHash } = require("node:crypto");
const { BadRequestException } = require("@nestjs/common");
const { periodDates, today } = require("../common/finance");
const run = promisify(execFile);
const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const decode = (value) =>
  value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
    if (entity[0] === "#")
      return String.fromCodePoint(
        entity[1].toLowerCase() === "x"
          ? parseInt(entity.slice(2), 16)
          : Number(entity.slice(1)),
      );
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[entity];
  });
const fail = (message) => {
  throw new BadRequestException(message);
};

function lines(words) {
  const result = [];
  for (const word of [...words].sort((a, b) => a.y - b.y || a.x - b.x)) {
    let line = result.find((row) => Math.abs(row.y - word.y) < 2.5);
    if (!line) {
      line = { y: word.y, words: [] };
      result.push(line);
    }
    line.words.push(word);
  }
  return result.map((line) => ({
    ...line,
    words: line.words.sort((a, b) => a.x - b.x),
  }));
}

// Poppler emits escaped XML. Read coordinates rather than treating a wrapped
// name or a repeated page heading as another student's attendance row.
function parseClassReportXml(xml) {
  const pages = [...xml.matchAll(/<page\b[^>]*>([\s\S]*?)<\/page>/g)].map(
    (page) =>
      [...page[1].matchAll(/<word\s+([^>]+)>([\s\S]*?)<\/word>/g)].map(
        (match) => {
          const attrs = Object.fromEntries(
            [...match[1].matchAll(/(\w+)="([^"]+)"/g)].map((a) => [
              a[1],
              Number(a[2]),
            ]),
          );
          return {
            text: decode(match[2]),
            x: attrs.xMin,
            right: attrs.xMax,
            y: attrs.yMin,
            bottom: attrs.yMax,
          };
        },
      ),
  );
  if (!pages.length || pages.length > 40)
    fail("PDF-ja duhet të ketë tekst të lexueshëm dhe deri në 40 faqe.");
  const firstLines = lines(pages[0])
    .map((line) => line.words.map((w) => w.text).join(" "))
    .join("\n");
  const title = decode(xml.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
  const className = title.replace(/^Class Report\s*-\s*/i, "").trim();
  const periodMatch = firstLines.match(/Period:\s*(\w+)\s+(\d{4})/i);
  const month = months.findIndex(
    (value) => value.toLowerCase() === periodMatch?.[1].toLowerCase(),
  );
  if (!/^Class Report\s*-/i.test(title) || !periodMatch || month < 0)
    fail("Nuk u gjetën klasa dhe periudha në raportin DSOS.");
  const period = `${periodMatch[2]}-${String(month + 1).padStart(2, "0")}`;
  periodDates(period);
  if (period > today().slice(0, 7))
    fail("Nuk importohet vijueshmëri për muaj të ardhshëm.");
  const lessonCount = Number(firstLines.match(/LESSONS\s+(\d+)\s+total/i)?.[1]);
  if (!Number.isInteger(lessonCount) || lessonCount < 1 || lessonCount > 1000)
    fail("Nuk u lexua numri i orëve te LESSONS.");
  const daysInMonth = new Date(
    Date.UTC(Number(periodMatch[2]), month + 1, 0),
  ).getUTCDate();
  const rows = [];
  const markedDays = new Set();
  for (const words of pages) {
    const header = words.find((w) => w.text === "STUDENT");
    if (!header) continue;
    const columns = words
      .filter((w) => Math.abs(w.y - header.y) < 3 && /^\d{2}$/.test(w.text))
      .sort((a, b) => a.x - b.x);
    if (
      columns.length !== daysInMonth ||
      columns.some((w, i) => Number(w.text) !== i + 1)
    )
      fail("Kolonat e ditëve në PDF janë të paplota.");
    const centers = columns.map((w) => (w.x + w.right) / 2);
    const step = centers[1] - centers[0];
    const left = centers[0] - step / 2;
    const legend = words.find((w) => w.text === "Present" && w.y > header.y);
    const bottom = legend?.y ?? Infinity;
    const tableWords = words.filter(
      (w) => w.y > header.bottom && w.y < bottom - 2,
    );
    const statusRows = lines(tableWords.filter((w) => w.x >= left)).filter(
      (line) => line.words.length >= daysInMonth * 0.7,
    );
    const nameLines = lines(tableWords.filter((w) => w.right < left));
    const names = [];
    for (const line of nameLines) {
      const height = Math.max(...line.words.map((w) => w.bottom - w.y));
      const previous = names.at(-1);
      if (!previous || line.y - previous.lastY > height * 2)
        names.push({
          y: line.y,
          bottom: Math.max(...line.words.map((w) => w.bottom)),
          lastY: line.y,
          parts: line.words.map((w) => w.text),
        });
      else {
        previous.parts.push(...line.words.map((w) => w.text));
        previous.lastY = line.y;
        previous.bottom = Math.max(...line.words.map((w) => w.bottom));
      }
    }
    if (names.length !== statusRows.length)
      fail(
        "Emrat dhe rreshtat e vijueshmërisë nuk përputhen. Eksportoni sërish PDF-në.",
      );
    for (let i = 0; i < statusRows.length; i++) {
      const line = statusRows[i];
      if (
        line.words.length !== daysInMonth ||
        line.y < names[i].y - 10 ||
        line.y > names[i].bottom + 10
      )
        fail("Rresht i paplotë ose emër i paqartë në PDF.");
      const counts = {
        present: 0,
        absent: 0,
        tardy: 0,
        undefined: 0,
        noAttendance: 0,
      };
      line.words.forEach((word, day) => {
        if (
          Math.abs((word.x + word.right) / 2 - centers[day]) > step / 3 ||
          !/^[PAUT-]$/.test(word.text)
        )
          fail("Shënim i panjohur ose kolonë e paqartë në PDF.");
        const key = {
          P: "present",
          A: "absent",
          T: "tardy",
          U: "undefined",
          "-": "noAttendance",
        }[word.text];
        counts[key]++;
        if (word.text !== "-") markedDays.add(day + 1);
      });
      const recorded =
        counts.present + counts.absent + counts.tardy + counts.undefined;
      if (recorded > lessonCount)
        fail("Shënimet e vijueshmërisë tejkalojnë numrin e orëve në raport.");
      rows.push({
        row: rows.length + 1,
        reportName: names[i].parts.join(""),
        totalLessons: lessonCount,
        absences: counts.absent,
        excusedAbsences: 0,
        sourceCounts: {
          ...counts,
          noAttendance: lessonCount - recorded,
          className,
          period,
        },
        period,
      });
    }
  }
  if (!rows.length || rows.length > 2000)
    fail("Raporti duhet të ketë 1 deri në 2000 nxënës me vijueshmëri.");
  if (markedDays.size !== lessonCount)
    fail(
      "Raporti ditor nuk dallon të gjitha orët e listuara. Nevojitet eksport me një shënim për secilën orë.",
    );
  return {
    rows,
    errors: [],
    report: {
      className,
      period,
      totalLessons: lessonCount,
      students: rows.length,
    },
  };
}

async function parseClassReport(content) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(content) || content.length > 2800000)
    fail("Ngarkoni një PDF deri në 2 MB.");
  const buffer = Buffer.from(content, "base64");
  if (
    buffer.length > 2 * 1024 * 1024 ||
    !buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))
  )
    fail("Skedari PDF është i pavlefshëm ose tejkalon 2 MB.");
  const directory = await mkdtemp(join(tmpdir(), "erp-attendance-"));
  try {
    const path = join(directory, "report.pdf");
    await writeFile(path, buffer);
    const { stdout } = await run("pdftotext", ["-bbox-layout", path, "-"], {
      timeout: 15000,
      maxBuffer: 20 * 1024 * 1024,
    });
    return parseClassReportXml(stdout);
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    fail(
      error.code === "ENOENT"
        ? "Serveri kërkon poppler-utils për importin PDF."
        : "PDF-ja nuk u lexua. Eksportoni raportin origjinal nga DSOS.",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const nameKey = (name) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s'-]/g, "");

async function previewClassReport(db, parsed, dto) {
  if (!dto.groupId) fail("Zgjidhni grupin e këtij raporti para ngarkimit.");
  const group = await db.group.findUnique({ where: { id: dto.groupId } });
  if (!group) fail("Grupi nuk u gjet.");
  const { first, last } = periodDates(parsed.report.period);
  const enrollments = await db.enrollment.findMany({
    where: {
      groupId: group.id,
      startDate: { lte: last },
      OR: [{ endDate: null }, { endDate: { gte: first } }],
    },
    include: { student: true },
    orderBy: { id: "asc" },
  });
  const students = [
    ...new Map(enrollments.map((e) => [e.student.id, e.student])).values(),
  ];
  const existing = await db.monthlyAttendance.findMany({
    where: {
      courseId: group.courseId,
      period: parsed.report.period,
      studentId: { in: students.map((s) => s.id) },
    },
  });
  const errors = [];
  const mapping = new Map();
  for (const entry of dto.matches ?? []) {
    if (mapping.has(entry.row) || !parsed.rows.some((r) => r.row === entry.row))
      fail("Lidhje e pavlefshme e rreshtave të PDF-së.");
    mapping.set(entry.row, entry.studentId);
  }
  const seen = new Set();
  const items = parsed.rows.map((row) => {
    const candidates = students.filter(
      (s) =>
        nameKey(`${s.firstName} ${s.lastName}`) === nameKey(row.reportName),
    );
    const student = mapping.has(row.row)
      ? students.find((s) => s.id === mapping.get(row.row))
      : candidates.length === 1
        ? candidates[0]
        : null;
    if (!student)
      errors.push({
        row: row.row,
        message:
          "Lidheni emrin e raportit me një nxënës të regjistruar në këtë grup për këtë muaj.",
      });
    if (student && seen.has(student.id))
      errors.push({
        row: row.row,
        message:
          "I njëjti nxënës është lidhur me dy rreshta. Kontrolloni emrat.",
      });
    if (student) seen.add(student.id);
    const before = existing.find((a) => a.studentId === student?.id);
    if (
      before?.sourceCounts?.groupId &&
      before.sourceCounts.groupId !== group.id
    )
      errors.push({
        row: row.row,
        message:
          "Ka vijueshmëri nga një grup tjetër për këtë nxënës dhe kurs në këtë muaj. Kërkohet kontroll para bashkimit.",
      });
    return {
      ...row,
      sourceCounts: { ...row.sourceCounts, groupId: group.id },
      studentId: student?.id ?? null,
      studentName: student
        ? `${student.firstName} ${student.lastName}`
        : row.reportName,
      courseId: group.courseId,
      replacesExisting: !!before,
      revision: before?.updatedAt.toISOString() ?? null,
    };
  });
  const previewToken = createHash("sha256")
    .update(dto.content)
    .update(
      JSON.stringify({
        group,
        enrollments: enrollments.map((e) => [
          e.id,
          e.version,
          e.student.id,
          e.student.version,
        ]),
        items,
      }),
    )
    .digest("hex");
  return {
    items,
    errors,
    previewToken,
    valid: errors.length === 0,
    count: items.length,
    report: { ...parsed.report, groupName: group.name },
    students: students.map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
    })),
  };
}

module.exports = { parseClassReport, parseClassReportXml, previewClassReport };

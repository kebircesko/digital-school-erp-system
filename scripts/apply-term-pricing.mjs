import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient, Prisma } from "@prisma/client";
import dotenv from "dotenv";
import backups from "../apps/api/src/backups/snapshot.js";
import finance from "../apps/api/src/common/finance.js";

export const TERM_RULES = {
  A: { days: [1, 3], durationMinutes: 80, monthlyPrice: "40.00" },
  B: { days: [2, 4], durationMinutes: 80, monthlyPrice: "40.00" },
  C: { days: [5], durationMinutes: 120, monthlyPrice: "30.00" },
};

export function groupTerm(name) {
  // Explicit letters take precedence over the incorrect legacy weekday defaults.
  const suffix = name.match(/(?:^|[·\s-])([A-D])\s*$/i)?.[1];
  if (suffix) return suffix.toUpperCase() === "D" ? null : suffix.toUpperCase();
  return name.match(/\d{1,2}:\d{2}([ABC])\b/i)?.[1].toUpperCase() ?? null;
}

function enrollmentPlan(e, rule) {
  return {
    id: e.id,
    studentId: e.studentId,
    version: e.version,
    before: {
      monthlyPrice: String(e.monthlyPrice),
      discount: String(e.discount),
    },
    after: { monthlyPrice: rule.monthlyPrice, discount: "0.00" },
  };
}
export function termPlan(groups) {
  const changes = [],
    skipped = [],
    merges = [];
  for (const group of groups) {
    const term = groupTerm(group.name);
    if (!term) continue;
    const rule = TERM_RULES[term];
    changes.push({
      id: group.id,
      name: group.name,
      term,
      version: group.version,
      before: {
        days: group.days,
        durationMinutes: group.durationMinutes,
        capacity: group.capacity,
      },
      after: { ...rule, capacity: group.capacity },
      enrollments: group.enrollments
        .filter((e) => e.status === "ACTIVE" && e.student.status === "ACTIVE")
        .map((e) => enrollmentPlan(e, rule)),
    });
  }
  for (const group of groups.filter((g) => !groupTerm(g.name))) {
    if (!/(?:^|[·\s-])D\s*$/i.test(group.name)) {
      skipped.push({ id: group.id, name: group.name });
      continue;
    }
    const candidates = groups.filter(
      (g) =>
        g.courseId === group.courseId &&
        groupTerm(g.name) === "A" &&
        g.startTime === group.startTime,
    );
    if (
      candidates.length !== 1 ||
      JSON.stringify([...group.days].sort()) !== "[1,3]"
    )
      throw new Error(
        `Cannot unambiguously merge ${group.name} into A with the same course, weekdays and start time.`,
      );
    const target = candidates[0],
      targetPlan = changes.find((g) => g.id === target.id);
    const members = group.enrollments.filter((e) => e.status === "ACTIVE");
    const targetMembers = new Set(
      target.enrollments
        .filter((e) => e.status === "ACTIVE")
        .map((e) => e.studentId),
    );
    if (members.some((e) => targetMembers.has(e.studentId)))
      throw new Error(
        `Duplicate active student in ${group.name} and ${target.name}.`,
      );
    targetPlan.enrollments.push(
      ...members
        .filter((e) => e.student.status === "ACTIVE")
        .map((e) => enrollmentPlan(e, TERM_RULES.A)),
    );
    targetPlan.after.capacity = Math.max(
      targetPlan.after.capacity,
      target.enrollments.length + members.length,
    );
    merges.push({
      id: group.id,
      name: group.name,
      version: group.version,
      targetId: target.id,
      targetName: target.name,
      enrollments: members.map((e) => ({
        id: e.id,
        version: e.version,
        studentId: e.studentId,
      })),
    });
  }
  return { changes, merges, skipped };
}

async function readPlan(db) {
  return termPlan(
    await db.group.findMany({
      where: { status: "ACTIVE" },
      include: {
        enrollments: {
          include: { student: { select: { status: true } } },
          orderBy: { id: "asc" },
        },
      },
      orderBy: { name: "asc" },
    }),
  );
}
function summary(plan) {
  return Object.fromEntries(
    Object.keys(TERM_RULES).map((term) => {
      const groups = plan.changes.filter((g) => g.term === term);
      return [
        term,
        {
          ...TERM_RULES[term],
          groups: groups.length,
          students: new Set(
            groups.flatMap((g) => g.enrollments.map((e) => e.studentId)),
          ).size,
          enrollments: groups.reduce(
            (count, g) => count + g.enrollments.length,
            0,
          ),
        },
      ];
    }),
  );
}
async function main() {
  const root = resolve(import.meta.dirname, "..");
  const env = dotenv.parse(await readFile(resolve(root, "apps/api/.env")));
  const url = new URL(env.DATABASE_URL);
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "55432" ||
    url.pathname !== "/digital_school"
  )
    throw new Error(
      "This task script only supports the verified local development database.",
    );
  const db = new PrismaClient({
    datasources: { db: { url: env.DATABASE_URL } },
  });
  try {
    const plan = await readPlan(db);
    if (!process.argv.includes("--apply")) {
      console.log(
        JSON.stringify(
          {
            mode: "preview",
            terms: summary(plan),
            skipped: plan.skipped,
            merges: plan.merges.map((m) => ({
              from: m.name,
              to: m.targetName,
              enrollments: m.enrollments.length,
            })),
          },
          null,
          2,
        ),
      );
      return;
    }
    if (!/^[a-f0-9]{64}$/i.test(env.BACKUP_KEY ?? ""))
      throw new Error(
        "An encrypted backup key is required before applying this data correction.",
      );
    const admins = await db.user.findMany({
      where: { active: true, role: "ADMIN" },
      select: { id: true },
    });
    if (admins.length !== 1)
      throw new Error("Expected one local administrator for the audit trail.");
    const directory = resolve(root, "output/term-pricing");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = resolve(directory, `before-${stamp}.erp`);
    await writeFile(
      backupPath,
      backups.encrypt(await backups.snapshot(db), env.BACKUP_KEY),
      { mode: 0o600, flag: "wx" },
    );
    const result = await finance.atomic(db, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(612040)`;
      const current = await readPlan(tx);
      if (JSON.stringify(plan) !== JSON.stringify(current))
        throw new Error(
          "Group or enrollment data changed; preview the correction again.",
        );
      let groupsUpdated = 0,
        enrollmentsUpdated = 0,
        enrollmentsMoved = 0;
      for (const group of current.changes) {
        if (
          JSON.stringify([...group.before.days].sort()) !==
            JSON.stringify(group.after.days) ||
          group.before.durationMinutes !== group.after.durationMinutes ||
          group.before.capacity !== group.after.capacity
        ) {
          const update = await tx.group.updateMany({
            where: { id: group.id, version: group.version },
            data: {
              days: group.after.days,
              durationMinutes: group.after.durationMinutes,
              capacity: group.after.capacity,
              version: { increment: 1 },
            },
          });
          if (update.count !== 1)
            throw new Error("A group changed concurrently.");
          await finance.audit(
            tx,
            admins[0].id,
            "TERM_SCHEDULE_CORRECT",
            group.id,
          );
          groupsUpdated++;
        }
        for (const enrollment of group.enrollments) {
          if (
            new Prisma.Decimal(enrollment.before.monthlyPrice).eq(
              enrollment.after.monthlyPrice,
            ) &&
            new Prisma.Decimal(enrollment.before.discount).eq(0)
          )
            continue;
          const update = await tx.enrollment.updateMany({
            where: {
              id: enrollment.id,
              version: enrollment.version,
              status: "ACTIVE",
            },
            data: {
              monthlyPrice: enrollment.after.monthlyPrice,
              discount: "0.00",
              version: { increment: 1 },
            },
          });
          if (update.count !== 1)
            throw new Error("An enrollment changed concurrently.");
          await finance.audit(
            tx,
            admins[0].id,
            "TERM_PRICE_CORRECT",
            enrollment.id,
          );
          enrollmentsUpdated++;
        }
      }
      for (const merge of current.merges) {
        for (const enrollment of merge.enrollments) {
          const pricing = current.changes
            .find((g) => g.id === merge.targetId)
            .enrollments.find((e) => e.id === enrollment.id);
          const wasRepriced =
            pricing &&
            !(
              new Prisma.Decimal(pricing.before.monthlyPrice).eq(
                pricing.after.monthlyPrice,
              ) && new Prisma.Decimal(pricing.before.discount).eq(0)
            );
          const update = await tx.enrollment.updateMany({
            where: {
              id: enrollment.id,
              groupId: merge.id,
              status: "ACTIVE",
              version: enrollment.version + (wasRepriced ? 1 : 0),
            },
            data: { groupId: merge.targetId, version: { increment: 1 } },
          });
          if (update.count !== 1)
            throw new Error("A D-group membership changed concurrently.");
          await finance.audit(
            tx,
            admins[0].id,
            "TERM_D_MERGE_A",
            enrollment.id,
          );
          enrollmentsMoved++;
        }
        const archive = await tx.group.updateMany({
          where: { id: merge.id, version: merge.version, status: "ACTIVE" },
          data: { status: "INACTIVE", version: { increment: 1 } },
        });
        if (archive.count !== 1)
          throw new Error("A D group changed concurrently.");
        await finance.audit(tx, admins[0].id, "TERM_D_ARCHIVE", merge.id);
      }
      return {
        groupsUpdated,
        enrollmentsUpdated,
        enrollmentsMoved,
        groupsMerged: current.merges.length,
        terms: summary(current),
        skipped: current.skipped,
      };
    });
    const reportPath = resolve(directory, `applied-${stamp}.json`);
    await writeFile(
      reportPath,
      JSON.stringify(
        { appliedAt: new Date().toISOString(), backupPath, ...result, plan },
        null,
        2,
      ),
      { mode: 0o600, flag: "wx" },
    );
    console.log(JSON.stringify({ ...result, backupPath, reportPath }, null, 2));
  } finally {
    await db.$disconnect();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });

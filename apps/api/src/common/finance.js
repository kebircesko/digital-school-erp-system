"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.money = money;
exports.calendarDate = calendarDate;
exports.today = today;
exports.periodDates = periodDates;
exports.atomic = atomic;
exports.audit = audit;
exports.number = number;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
function money(value, positive = false) {
  if (typeof value !== "string" || !/^\d{1,9}(\.\d{1,2})?$/.test(value))
    throw new common_1.BadRequestException(
      "Shuma duhet të ketë maksimum dy shifra pas presjes.",
    );
  const amount = new client_1.Prisma.Decimal(value);
  if (positive && amount.lte(0))
    throw new common_1.BadRequestException("Shuma duhet të jetë pozitive.");
  return amount;
}
function calendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new common_1.BadRequestException("Data është e pavlefshme.");
  const date = new Date(value + "T00:00:00Z");
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    date.getUTCFullYear() < 1900
  )
    throw new common_1.BadRequestException("Data është e pavlefshme.");
  return date;
}
function today() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Tirane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type) => parts.find((p) => p.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function periodDates(period) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))
    throw new common_1.BadRequestException("Muaji është i pavlefshëm.");
  const first = calendarDate(period + "-01");
  const last = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  );
  return { first, last };
}
async function atomic(db, work) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.$transaction(work, {
        isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30000,
        maxWait: 10000,
      });
    } catch (error) {
      if (
        error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        if (attempt < 4) continue;
        throw new common_1.ConflictException(
          "Veprimi është në konflikt me një përdorues tjetër. Provoni përsëri.",
        );
      }
      throw error;
    }
  }
  throw new common_1.ConflictException();
}
async function audit(tx, userId, action, entityId) {
  await tx.auditLog.create({ data: { userId, action, entityId } });
}
async function number(tx, prefix, year) {
  const key = `${prefix}-${year}`;
  const counter = await tx.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${key}-${String(counter.value).padStart(6, "0")}`;
}

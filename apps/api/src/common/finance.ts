import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "./prisma.service";
export function money(value: string, positive = false) {
  if (typeof value !== "string" || !/^\d{1,9}(\.\d{1,2})?$/.test(value))
    throw new BadRequestException(
      "Shuma duhet të ketë maksimum dy shifra pas presjes.",
    );
  const amount = new Prisma.Decimal(value);
  if (positive && amount.lte(0))
    throw new BadRequestException("Shuma duhet të jetë pozitive.");
  return amount;
}
export function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException("Data është e pavlefshme.");
  const date = new Date(value + "T00:00:00Z");
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    date.getUTCFullYear() < 1900
  )
    throw new BadRequestException("Data është e pavlefshme.");
  return date;
}
export function today() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Tirane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function periodDates(period: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))
    throw new BadRequestException("Muaji është i pavlefshëm.");
  const first = calendarDate(period + "-01");
  const last = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  );
  return { first, last };
}
export async function atomic<T>(
  db: PrismaService,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30000,
        maxWait: 10000,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        if (attempt < 4) continue;
        throw new ConflictException(
          "Veprimi është në konflikt me një përdorues tjetër. Provoni përsëri.",
        );
      }
      throw error;
    }
  }
  throw new ConflictException();
}
export async function audit(
  tx: Prisma.TransactionClient,
  userId: string | null,
  action: string,
  entityId?: string,
) {
  await tx.auditLog.create({ data: { userId, action, entityId } });
}
export async function number(
  tx: Prisma.TransactionClient,
  prefix: string,
  year: number,
) {
  const key = `${prefix}-${year}`;
  const counter = await tx.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${key}-${String(counter.value).padStart(6, "0")}`;
}

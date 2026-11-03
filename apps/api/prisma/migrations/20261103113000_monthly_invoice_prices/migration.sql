CREATE TABLE "InvoicePriceDraft" (
  "id" UUID NOT NULL PRIMARY KEY,
  "enrollmentId" UUID NOT NULL REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "period" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedById" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoicePriceDraft_amount_valid" CHECK ("amount" >= 0),
  CONSTRAINT "InvoicePriceDraft_version_valid" CHECK ("version" > 0),
  CONSTRAINT "InvoicePriceDraft_period_valid" CHECK ("period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
CREATE UNIQUE INDEX "InvoicePriceDraft_enrollmentId_period_key" ON "InvoicePriceDraft"("enrollmentId", "period");
CREATE INDEX "InvoicePriceDraft_period_idx" ON "InvoicePriceDraft"("period");

ALTER TABLE "Student" ADD COLUMN "registrationKey" UUID;
CREATE UNIQUE INDEX "Student_registrationKey_key" ON "Student"("registrationKey");

CREATE TABLE "AdminTask" (
  "id" UUID NOT NULL, "studentId" UUID, "userId" UUID NOT NULL,
  "title" TEXT NOT NULL, "notes" TEXT NOT NULL DEFAULT '',
  "dueDate" DATE NOT NULL, "completedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminTask_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AdminTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AdminTask_completedAt_dueDate_idx" ON "AdminTask"("completedAt", "dueDate");
CREATE INDEX "AdminTask_studentId_idx" ON "AdminTask"("studentId");

CREATE TABLE "CashClosure" (
  "id" UUID NOT NULL, "day" DATE NOT NULL, "revision" INTEGER NOT NULL,
  "userId" UUID NOT NULL, "openingCash" DECIMAL(12,2) NOT NULL,
  "cashTotal" DECIMAL(12,2) NOT NULL, "bankTotal" DECIMAL(12,2) NOT NULL,
  "expectedCash" DECIMAL(12,2) NOT NULL, "countedCash" DECIMAL(12,2) NOT NULL,
  "difference" DECIMAL(12,2) NOT NULL, "paymentCount" INTEGER NOT NULL,
  "fingerprint" TEXT NOT NULL, "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashClosure_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashClosure_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CashClosure_day_revision_key" ON "CashClosure"("day", "revision");

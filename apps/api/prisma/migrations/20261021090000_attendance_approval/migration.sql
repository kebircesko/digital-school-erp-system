ALTER TABLE "Invoice" ADD COLUMN "approvalNotes" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Invoice" ADD COLUMN "attendanceSnapshot" JSONB;

CREATE TABLE "MonthlyAttendance" (
  "id" UUID NOT NULL PRIMARY KEY,
  "studentId" UUID NOT NULL REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "courseId" UUID NOT NULL REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "period" TEXT NOT NULL,
  "totalLessons" INTEGER NOT NULL,
  "absences" INTEGER NOT NULL,
  "excusedAbsences" INTEGER NOT NULL DEFAULT 0,
  "sourceFile" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Attendance_counts_valid" CHECK (
    "totalLessons" BETWEEN 0 AND 1000 AND "absences" BETWEEN 0 AND "totalLessons"
    AND "excusedAbsences" BETWEEN 0 AND "absences"
  ),
  CONSTRAINT "Attendance_period_valid" CHECK ("period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
CREATE UNIQUE INDEX "MonthlyAttendance_studentId_courseId_period_key" ON "MonthlyAttendance"("studentId", "courseId", "period");
CREATE INDEX "MonthlyAttendance_period_idx" ON "MonthlyAttendance"("period");

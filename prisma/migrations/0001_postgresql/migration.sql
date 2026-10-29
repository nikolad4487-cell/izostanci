-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "dolaznost";

-- CreateTable
CREATE TABLE "dolaznost"."AcademicYear" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dolaznost"."Semester" (
    "id" TEXT NOT NULL,
    "yearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,

    CONSTRAINT "Semester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dolaznost"."Holiday" (
    "id" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dolaznost"."Course" (
    "id" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "professor" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#2563eb',
    "counting" TEXT NOT NULL DEFAULT 'DAY',
    "lectureHours" INTEGER NOT NULL DEFAULT 0,
    "exerciseHours" INTEGER NOT NULL DEFAULT 0,
    "seminarHours" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dolaznost"."TeachingGroup" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "plannedUnits" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TeachingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dolaznost"."AttendanceRule" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'PERCENT',
    "minimum" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "maximum" INTEGER NOT NULL DEFAULT 0,
    "extra" INTEGER NOT NULL DEFAULT 0,
    "partial" TEXT NOT NULL DEFAULT 'ABSENT',
    "partialWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "excusedCounts" BOOLEAN NOT NULL DEFAULT false,
    "consequence" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AttendanceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dolaznost"."WeeklySlot" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "hours" INTEGER NOT NULL,
    "room" TEXT NOT NULL DEFAULT '',
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,

    CONSTRAINT "WeeklySlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dolaznost"."Session" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "slotId" TEXT,
    "originalDate" TEXT,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "hours" INTEGER NOT NULL,
    "room" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'REGULAR',
    "state" TEXT NOT NULL DEFAULT 'PLANNED',
    "modified" BOOLEAN NOT NULL DEFAULT false,
    "unitId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dolaznost"."AttendanceUnit" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "date" TEXT NOT NULL,

    CONSTRAINT "AttendanceUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dolaznost"."Attendance" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dolaznost"."UserSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "minimum" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "extra" INTEGER NOT NULL DEFAULT 0,
    "counting" TEXT NOT NULL DEFAULT 'DAY',
    "partial" TEXT NOT NULL DEFAULT 'ABSENT',
    "partialWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "excusedCounts" BOOLEAN NOT NULL DEFAULT false,
    "warnings" BOOLEAN NOT NULL DEFAULT true,
    "theme" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_semesterId_date_key" ON "dolaznost"."Holiday"("semesterId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRule_groupId_key" ON "dolaznost"."AttendanceRule"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_slotId_originalDate_key" ON "dolaznost"."Session"("slotId", "originalDate");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_unitId_key" ON "dolaznost"."Attendance"("unitId");

-- AddForeignKey
ALTER TABLE "dolaznost"."Semester" ADD CONSTRAINT "Semester_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "dolaznost"."AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dolaznost"."Holiday" ADD CONSTRAINT "Holiday_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "dolaznost"."Semester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dolaznost"."Course" ADD CONSTRAINT "Course_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "dolaznost"."Semester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dolaznost"."TeachingGroup" ADD CONSTRAINT "TeachingGroup_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "dolaznost"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dolaznost"."AttendanceRule" ADD CONSTRAINT "AttendanceRule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "dolaznost"."TeachingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dolaznost"."WeeklySlot" ADD CONSTRAINT "WeeklySlot_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "dolaznost"."TeachingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dolaznost"."Session" ADD CONSTRAINT "Session_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "dolaznost"."TeachingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dolaznost"."Session" ADD CONSTRAINT "Session_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "dolaznost"."WeeklySlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dolaznost"."Session" ADD CONSTRAINT "Session_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "dolaznost"."AttendanceUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dolaznost"."AttendanceUnit" ADD CONSTRAINT "AttendanceUnit_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "dolaznost"."TeachingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dolaznost"."Attendance" ADD CONSTRAINT "Attendance_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "dolaznost"."AttendanceUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

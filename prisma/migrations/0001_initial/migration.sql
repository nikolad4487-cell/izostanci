-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Semester" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "yearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    CONSTRAINT "Semester_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "AcademicYear" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "semesterId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Holiday_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "semesterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "professor" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#2563eb',
    "counting" TEXT NOT NULL DEFAULT 'DAY',
    "lectureHours" INTEGER NOT NULL DEFAULT 0,
    "exerciseHours" INTEGER NOT NULL DEFAULT 0,
    "seminarHours" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Course_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeachingGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "plannedUnits" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TeachingGroup_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AttendanceRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'PERCENT',
    "minimum" REAL NOT NULL DEFAULT 80,
    "maximum" INTEGER NOT NULL DEFAULT 0,
    "extra" INTEGER NOT NULL DEFAULT 0,
    "partial" TEXT NOT NULL DEFAULT 'ABSENT',
    "partialWeight" REAL NOT NULL DEFAULT 0.5,
    "excusedCounts" BOOLEAN NOT NULL DEFAULT false,
    "consequence" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "AttendanceRule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TeachingGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklySlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "hours" INTEGER NOT NULL,
    "room" TEXT NOT NULL DEFAULT '',
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    CONSTRAINT "WeeklySlot_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TeachingGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "Session_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TeachingGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Session_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "WeeklySlot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Session_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "AttendanceUnit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AttendanceUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    CONSTRAINT "AttendanceUnit_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TeachingGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Attendance_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "AttendanceUnit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "minimum" REAL NOT NULL DEFAULT 80,
    "extra" INTEGER NOT NULL DEFAULT 0,
    "counting" TEXT NOT NULL DEFAULT 'DAY',
    "partial" TEXT NOT NULL DEFAULT 'ABSENT',
    "partialWeight" REAL NOT NULL DEFAULT 0.5,
    "excusedCounts" BOOLEAN NOT NULL DEFAULT false,
    "warnings" BOOLEAN NOT NULL DEFAULT true,
    "theme" TEXT NOT NULL DEFAULT 'system'
);

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_semesterId_date_key" ON "Holiday"("semesterId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRule_groupId_key" ON "AttendanceRule"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_slotId_originalDate_key" ON "Session"("slotId", "originalDate");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_unitId_key" ON "Attendance"("unitId");

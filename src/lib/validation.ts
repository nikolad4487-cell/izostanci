import { z } from "zod";
const id = z.string().min(1).max(200);
const text = z.string().max(5000);
const date = z.iso.date();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const int = z.number().int().min(0).max(100000);
const range = { start: date, end: date };
export const yearSchema = z.object({ id, name: z.string().min(1).max(100) });
export const semesterSchema = z
  .object({ id, yearId: id, name: z.string().min(1).max(100), ...range })
  .refine((v) => v.start <= v.end, "Početak mora biti prije završetka.");
export const holidaySchema = z.object({
  id,
  semesterId: id,
  date,
  name: z.string().min(1).max(200),
});
export const courseSchema = z.object({
  id,
  semesterId: id,
  name: z.string().min(1).max(200),
  professor: text,
  notes: text,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  counting: z.enum(["DAY", "SESSION"]),
  lectureHours: int,
  exerciseHours: int,
  seminarHours: int,
});
export const groupSchema = z.object({
  id,
  courseId: id,
  name: z.string().min(1).max(100),
  type: z.enum(["ALL", "P", "V", "S", "OTHER"]),
  plannedUnits: int,
});
export const ruleSchema = z.object({
  id,
  groupId: id,
  mode: z.enum(["PERCENT", "MAX", "AND", "OR", "NONE", "MANUAL"]),
  minimum: z.number().min(0).max(100).multipleOf(0.01),
  maximum: int,
  extra: int,
  partial: z.enum(["PRESENT", "ABSENT", "FRACTION"]),
  partialWeight: z.number().min(0).max(1).multipleOf(0.0001),
  excusedCounts: z.boolean(),
  consequence: text,
});
export const slotSchema = z
  .object({
    id,
    groupId: id,
    weekday: z.number().int().min(1).max(7),
    startTime: time,
    endTime: time,
    hours: int.min(1),
    room: text,
    ...range,
  })
  .refine(
    (v) => v.start <= v.end && v.startTime < v.endTime,
    "Provjerite datume i vremena.",
  );
export const sessionSchema = z
  .object({
    id,
    groupId: id,
    slotId: id.nullable(),
    originalDate: date.nullable(),
    date,
    startTime: time,
    endTime: time,
    hours: int.min(1),
    room: text,
    kind: z.enum(["REGULAR", "MAKEUP", "EXTRA"]),
    state: z.enum(["PLANNED", "CANCELLED", "NOT_HELD"]),
    modified: z.boolean(),
    unitId: id,
  })
  .refine((v) => v.startTime < v.endTime, "Završetak mora biti nakon početka.");
export const unitSchema = z.object({ id, groupId: id, date });
export const attendanceSchema = z.object({
  id,
  unitId: id,
  status: z.enum(["PRESENT", "ABSENT", "PARTIAL", "EXCUSED"]),
  note: text,
});
export const settingsSchema = z.object({
  id: z.literal("default"),
  minimum: z.number().min(0).max(100).multipleOf(0.01),
  extra: int,
  counting: z.enum(["DAY", "SESSION"]),
  partial: z.enum(["PRESENT", "ABSENT", "FRACTION"]),
  partialWeight: z.number().min(0).max(1).multipleOf(0.0001),
  excusedCounts: z.boolean(),
  warnings: z.boolean(),
  theme: z.enum(["light", "dark", "system"]),
});
export const backupSchema = z.object({
  version: z.literal(1),
  data: z.object({
    years: z.array(yearSchema),
    semesters: z.array(semesterSchema),
    holidays: z.array(holidaySchema),
    courses: z.array(courseSchema),
    groups: z.array(groupSchema),
    rules: z.array(ruleSchema),
    slots: z.array(slotSchema),
    sessions: z.array(sessionSchema),
    units: z.array(unitSchema),
    attendance: z.array(attendanceSchema),
    settings: settingsSchema,
  }),
});

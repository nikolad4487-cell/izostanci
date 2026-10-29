export type RuleMode = "PERCENT" | "MAX" | "AND" | "OR" | "NONE" | "MANUAL";
export type Status = "PRESENT" | "ABSENT" | "PARTIAL" | "EXCUSED";
export type Rule = {
  id: string;
  groupId: string;
  mode: RuleMode;
  minimum: number;
  maximum: number;
  extra: number;
  partial: "PRESENT" | "ABSENT" | "FRACTION";
  partialWeight: number;
  excusedCounts: boolean;
  consequence: string;
};
export type Year = { id: string; name: string };
export type Semester = {
  id: string;
  yearId: string;
  name: string;
  start: string;
  end: string;
};
export type Holiday = {
  id: string;
  semesterId: string;
  date: string;
  name: string;
};
export type Course = {
  id: string;
  semesterId: string;
  name: string;
  professor: string;
  notes: string;
  color: string;
  counting: "DAY" | "SESSION";
  lectureHours: number;
  exerciseHours: number;
  seminarHours: number;
};
export type Group = {
  id: string;
  courseId: string;
  name: string;
  type: "ALL" | "P" | "V" | "S" | "OTHER";
  plannedUnits: number;
};
export type Slot = {
  id: string;
  groupId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  hours: number;
  room: string;
  start: string;
  end: string;
};
export type Session = {
  id: string;
  groupId: string;
  slotId: string | null;
  originalDate: string | null;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  room: string;
  kind: "REGULAR" | "MAKEUP" | "EXTRA";
  state: "PLANNED" | "CANCELLED" | "NOT_HELD";
  modified: boolean;
  unitId: string;
};
export type Unit = { id: string; groupId: string; date: string };
export type Attendance = {
  id: string;
  unitId: string;
  status: Status;
  note: string;
};
export type Settings = {
  id: string;
  minimum: number;
  extra: number;
  counting: "DAY" | "SESSION";
  partial: Rule["partial"];
  partialWeight: number;
  excusedCounts: boolean;
  warnings: boolean;
  theme: string;
};
export type Data = {
  authEnabled?: boolean;
  years: Year[];
  semesters: Semester[];
  holidays: Holiday[];
  courses: Course[];
  groups: Group[];
  rules: Rule[];
  slots: Slot[];
  sessions: Session[];
  units: Unit[];
  attendance: Attendance[];
  settings: Settings;
};
export const statusLabels: Record<Status, string> = {
  PRESENT: "Prisutan",
  ABSENT: "Odsutan",
  PARTIAL: "Djelomično prisutan",
  EXCUSED: "Opravdani izostanak",
};
export const modeLabels: Record<RuleMode, string> = {
  PERCENT: "Minimalni postotak",
  MAX: "Maksimalni broj izostanaka",
  AND: "Postotak I maksimum",
  OR: "Postotak ILI maksimum",
  NONE: "Samo evidencija",
  MANUAL: "Ručno dopušteni izostanci",
};
export const exampleCourses = [
  "Osnove ekonomije",
  "Osnove turizma",
  "Poslovni engleski",
  "Poslovni njemački",
  "Primijenjena informatika",
  "Turistička resursna osnova",
  "Poslovna matematika I",
  "Uvod u stručni i znanstveni rad",
  "Tjelesna i zdravstvena kultura",
];

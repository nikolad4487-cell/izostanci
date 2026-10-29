import type { Data, Rule, Session, Status } from "../src/lib/types";
export function fixture(
  options: Partial<Rule> = {},
  count = 15,
  hours = 4,
): Data {
  const data: Data = {
    years: [{ id: "y", name: "2026./2027." }],
    semesters: [
      {
        id: "sem",
        yearId: "y",
        name: "Zimski",
        start: "2026-01-01",
        end: "2026-12-31",
      },
    ],
    holidays: [],
    courses: [
      {
        id: "c",
        semesterId: "sem",
        name: "Ekonomija",
        professor: "",
        notes: "",
        color: "#2563eb",
        counting: "DAY",
        lectureHours: 60,
        exerciseHours: 0,
        seminarHours: 0,
      },
    ],
    groups: [
      {
        id: "g",
        courseId: "c",
        name: "Predavanja",
        type: "P",
        plannedUnits: count,
      },
    ],
    rules: [
      {
        id: "r",
        groupId: "g",
        mode: "PERCENT",
        minimum: 80,
        maximum: 0,
        extra: 0,
        partial: "ABSENT",
        partialWeight: 0.5,
        excusedCounts: false,
        consequence: "",
        ...options,
      },
    ],
    slots: [],
    sessions: [],
    units: [],
    attendance: [],
    settings: {
      id: "default",
      minimum: 80,
      extra: 0,
      counting: "DAY",
      partial: "ABSENT",
      partialWeight: 0.5,
      excusedCounts: false,
      warnings: true,
      theme: "system",
    },
  };
  for (let i = 0; i < count; i++) {
    const date = `2026-10-${String(i + 1).padStart(2, "0")}`;
    data.units.push({ id: `u${i}`, groupId: "g", date });
    data.sessions.push({
      id: `s${i}`,
      groupId: "g",
      slotId: null,
      originalDate: null,
      date,
      startTime: "09:00",
      endTime: "12:00",
      hours,
      room: "",
      kind: "REGULAR",
      state: "PLANNED",
      modified: false,
      unitId: `u${i}`,
    });
  }
  return data;
}
export function mark(d: Data, i: number, status: Status) {
  d.attendance.push({ id: `a${i}`, unitId: `u${i}`, status, note: "" });
  return d;
}
export function session(d: Data, i: number, patch: Partial<Session>) {
  Object.assign(d.sessions[i], patch);
  return d;
}

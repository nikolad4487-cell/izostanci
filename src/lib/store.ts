import { authRequired } from "./auth";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { eachDayOfInterval, format, getISODay, parseISO } from "date-fns";
import { todayZagreb } from "./attendance";
import type { Data, Session } from "./types";
import { backupSchema } from "./validation";
type Tx = Prisma.TransactionClient;
export async function getData(): Promise<Data> {
  const [
    years,
    semesters,
    holidays,
    courses,
    groups,
    rules,
    slots,
    sessions,
    units,
    attendance,
    settings,
  ] = await Promise.all([
    db.academicYear.findMany(),
    db.semester.findMany(),
    db.holiday.findMany(),
    db.course.findMany(),
    db.teachingGroup.findMany(),
    db.attendanceRule.findMany(),
    db.weeklySlot.findMany(),
    db.session.findMany(),
    db.attendanceUnit.findMany(),
    db.attendance.findMany(),
    db.userSettings.upsert({
      where: { id: "default" },
      create: { id: "default" },
      update: {},
    }),
  ]);
  return {
    authEnabled: authRequired(),
    years,
    semesters,
    holidays,
    courses,
    groups,
    rules,
    slots,
    sessions,
    units,
    attendance,
    settings,
  } as Data;
}
export const uid = () => crypto.randomUUID();
export async function attachUnit(
  tx: Tx,
  s: Pick<Session, "id" | "groupId" | "date">,
) {
  const group = await tx.teachingGroup.findUniqueOrThrow({
    where: { id: s.groupId },
    include: { course: true },
  });
  const existing =
    group.course.counting === "DAY"
      ? await tx.attendanceUnit.findFirst({
          where: { groupId: s.groupId, date: s.date },
          orderBy: { id: "asc" },
        })
      : null;
  const unitId =
    existing?.id ??
    (group.course.counting === "DAY"
      ? `${s.groupId}:${s.date}`
      : `session:${s.id}`);
  await tx.attendanceUnit.upsert({
    where: { id: unitId },
    create: { id: unitId, groupId: s.groupId, date: s.date },
    update: { date: s.date },
  });
  return unitId;
}
export async function saveSession(tx: Tx, s: Session) {
  const old = await tx.session.findUnique({
    where: { id: s.id },
    include: { unit: { include: { attendance: true, sessions: true } } },
  });
  if (old && old.groupId !== s.groupId)
    throw new Error(
      "Postojeći termin ne može promijeniti skupinu. Dodajte novi termin u odgovarajuću skupinu.",
    );
  const unitId = await attachUnit(tx, s);
  if (old && old.unitId !== unitId && old.unit.attendance) {
    const other = await tx.attendance.findUnique({ where: { unitId } });
    if (other && other.status !== old.unit.attendance.status)
      throw new Error(
        "Na novom datumu već postoji drugačija evidencija. Najprije uskladite statuse.",
      );
    await tx.attendance.upsert({
      where: { unitId },
      create: {
        id: uid(),
        unitId,
        status: old.unit.attendance.status,
        note: old.unit.attendance.note,
      },
      update: {
        note: [
          ...new Set([other?.note, old.unit.attendance.note].filter(Boolean)),
        ].join(" · "),
      },
    });
  }
  await tx.session.upsert({
    where: { id: s.id },
    create: { ...s, unitId },
    update: { ...s, unitId },
  });
  await tx.attendanceUnit.deleteMany({
    where: { sessions: { none: {} }, attendance: null },
  });
  if (old && old.unitId !== unitId) {
    const count = await tx.session.count({ where: { unitId: old.unitId } });
    if (!count)
      await tx.attendanceUnit.deleteMany({ where: { id: old.unitId } });
  }
}
export async function generateSlot(tx: Tx, slotId: string) {
  const slot = await tx.weeklySlot.findUniqueOrThrow({
    where: { id: slotId },
    include: {
      group: {
        include: {
          course: { include: { semester: { include: { holidays: true } } } },
        },
      },
    },
  });
  const semester = slot.group.course.semester;
  const start = slot.start > semester.start ? slot.start : semester.start;
  const end = slot.end < semester.end ? slot.end : semester.end;
  if (start > end) throw new Error("Ponavljanje mora biti unutar semestra.");
  const dates = eachDayOfInterval({
    start: parseISO(start),
    end: parseISO(end),
  })
    .filter((d) => getISODay(d) === slot.weekday)
    .map((d) => format(d, "yyyy-MM-dd"))
    .filter((d) => !semester.holidays.some((h) => h.date === d));
  if (dates.length > 400) throw new Error("Prevelik raspon ponavljanja.");
  const existing = await tx.session.findMany({
    where: { slotId },
    include: { unit: { include: { attendance: true } } },
  });
  for (const s of existing) {
    if (
      s.date >= todayZagreb() &&
      !s.modified &&
      !s.unit.attendance &&
      !dates.includes(s.originalDate!)
    )
      await tx.session.delete({ where: { id: s.id } });
  }
  for (const date of dates) {
    const old = existing.find((s) => s.originalDate === date);
    if (
      old &&
      (old.modified || old.unit.attendance || old.date < todayZagreb())
    )
      continue;
    const s: Session = {
      id: old?.id ?? uid(),
      groupId: slot.groupId,
      slotId,
      originalDate: date,
      date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      hours: slot.hours,
      room: slot.room,
      kind: "REGULAR",
      state: "PLANNED",
      modified: false,
      unitId: "",
    };
    await saveSession(tx, s);
  }
  await tx.attendanceUnit.deleteMany({
    where: { sessions: { none: {} }, attendance: null },
  });
}
export function validateRelations(data: Data) {
  const collections = [
    data.years,
    data.semesters,
    data.holidays,
    data.courses,
    data.groups,
    data.rules,
    data.slots,
    data.sessions,
    data.units,
    data.attendance,
  ];
  for (const list of collections)
    if (new Set(list.map((x) => x.id)).size !== list.length)
      throw new Error("Sigurnosna kopija sadrži duple identifikatore.");
  const has = (list: { id: string }[], id: string) =>
    list.some((x) => x.id === id);
  const require = (ok: boolean) => {
    if (!ok) throw new Error("Sigurnosna kopija sadrži neispravne relacije.");
  };
  data.semesters.forEach((s) => require(has(data.years, s.yearId)));
  data.holidays.forEach((h) =>
    require(
      data.semesters.some(
        (s) => s.id === h.semesterId && h.date >= s.start && h.date <= s.end,
      ),
    ),
  );
  data.courses.forEach((c) => require(has(data.semesters, c.semesterId)));
  data.groups.forEach((g) =>
    require(
      has(data.courses, g.courseId) &&
        data.rules.filter((r) => r.groupId === g.id).length === 1,
    ),
  );
  data.rules.forEach((r) => require(has(data.groups, r.groupId)));
  data.slots.forEach((s) => require(has(data.groups, s.groupId)));
  data.units.forEach((u) => require(has(data.groups, u.groupId)));
  data.sessions.forEach((s) =>
    require(
      data.units.some(
        (u) =>
          u.id === s.unitId && u.groupId === s.groupId && u.date === s.date,
      ) &&
        (!s.slotId ||
          data.slots.some((x) => x.id === s.slotId && x.groupId === s.groupId)),
    ),
  );
  data.attendance.forEach((a) => require(has(data.units, a.unitId)));
  require(
    new Set(data.attendance.map((a) => a.unitId)).size ===
      data.attendance.length,
  );
  for (const g of data.groups) {
    const c = data.courses.find((c) => c.id === g.courseId)!;
    const live = data.units.filter(
      (u) => u.groupId === g.id && data.sessions.some((s) => s.unitId === u.id),
    );
    if (c.counting === "DAY")
      require(new Set(live.map((u) => u.date)).size === live.length);
    else
      require(
        live.every(
          (u) => data.sessions.filter((s) => s.unitId === u.id).length === 1,
        ),
      );
  }
}
export async function restore(input: unknown) {
  const { data } = backupSchema.parse(input);
  validateRelations(data);
  await db.$transaction(
    async (tx) => {
      await tx.attendance.deleteMany();
      await tx.session.deleteMany();
      await tx.attendanceUnit.deleteMany();
      await tx.weeklySlot.deleteMany();
      await tx.attendanceRule.deleteMany();
      await tx.teachingGroup.deleteMany();
      await tx.course.deleteMany();
      await tx.holiday.deleteMany();
      await tx.semester.deleteMany();
      await tx.academicYear.deleteMany();
      await tx.academicYear.createMany({ data: data.years });
      await tx.semester.createMany({ data: data.semesters });
      await tx.holiday.createMany({ data: data.holidays });
      await tx.course.createMany({ data: data.courses });
      await tx.teachingGroup.createMany({ data: data.groups });
      await tx.attendanceRule.createMany({ data: data.rules });
      await tx.weeklySlot.createMany({ data: data.slots });
      await tx.attendanceUnit.createMany({ data: data.units });
      await tx.session.createMany({ data: data.sessions });
      await tx.attendance.createMany({ data: data.attendance });
      await tx.userSettings.upsert({
        where: { id: "default" },
        create: data.settings,
        update: data.settings,
      });
    },
    { timeout: 30000 },
  );
}

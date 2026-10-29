import type { Data, Rule } from "./types";
export function todayZagreb(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zagreb",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function timeZagreb(now = new Date()) {
  return new Intl.DateTimeFormat("hr-HR", {
    timeZone: "Europe/Zagreb",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}
export function unitPending(
  date: string,
  sessions: { state: string; endTime: string }[],
  today = todayZagreb(),
  time = timeZagreb(),
) {
  return (
    date > today ||
    (date === today &&
      sessions.some((s) => s.state === "PLANNED" && s.endTime > time))
  );
}
export function requiredVisits(total: number, minimum: number) {
  // Postotak se pretvara u cijele stotinke prije množenja.
  return Math.ceil((total * Math.round(minimum * 100)) / 10000);
}
export function allowedAbsences(total: number, rule: Rule) {
  const percent = total - requiredVisits(total, rule.minimum);
  const max = Math.min(total, rule.maximum);
  let base: number | null = percent;
  if (rule.mode === "NONE") base = null;
  if (rule.mode === "MAX" || rule.mode === "MANUAL") base = max;
  if (rule.mode === "AND") base = Math.min(percent, max);
  if (rule.mode === "OR") base = Math.max(percent, max);
  return {
    base,
    extra: rule.extra,
    total: base === null ? null : Math.min(total, base + rule.extra),
    required: requiredVisits(total, rule.minimum),
  };
}
export function summarize(
  data: Data,
  groupId: string,
  today = todayZagreb(),
  time = timeZagreb(),
) {
  const group = data.groups.find((g) => g.id === groupId)!;
  const rule = data.rules.find((r) => r.groupId === groupId)!;
  const units = data.units.filter((u) => u.groupId === groupId);
  let cancelled = 0,
    exempt = 0,
    active = 0,
    recorded = 0,
    present = 0,
    absent = 0,
    excused = 0,
    missing = 0,
    future = 0,
    missedHours = 0,
    held = 0;
  const history: { date: string; present: number; absent: number }[] = [];
  for (const unit of units) {
    const sessions = data.sessions.filter((s) => s.unitId === unit.id);
    if (!sessions.length) continue;
    const live = sessions.filter((s) => s.state === "PLANNED");
    if (!live.length) {
      cancelled++;
      continue;
    }
    const a = data.attendance.find((a) => a.unitId === unit.id);
    if (unitPending(unit.date, live, today, time)) {
      active++;
      future++;
      continue;
    }
    held++;
    if (a?.status === "EXCUSED") {
      excused++;
      if (!rule.excusedCounts) {
        exempt++;
        missedHours += live.reduce((n, s) => n + s.hours, 0);
        continue;
      }
    }
    active++;
    if (!a) {
      missing++;
      continue;
    }
    recorded++;
    let weight = 0;
    if (a.status === "PRESENT") weight = 1;
    if (a.status === "PARTIAL")
      weight =
        rule.partial === "PRESENT"
          ? 1
          : rule.partial === "ABSENT"
            ? 0
            : rule.partialWeight;
    present += Math.round(weight * 10000);
    absent += 10000 - Math.round(weight * 10000);
    missedHours += live.reduce((n, s) => n + s.hours, 0) * (1 - weight);
    history.push({ date: unit.date, present: weight, absent: 1 - weight });
  }
  present /= 10000;
  absent /= 10000;
  const planned = Math.max(active, group.plannedUnits - cancelled - exempt, 0);
  const allowance = allowedAbsences(planned, rule);
  const remaining =
    allowance.total === null
      ? null
      : Math.round((allowance.total - absent) * 10000) / 10000;
  const course = data.courses.find((c) => c.id === group.courseId)!;
  const declaredHours =
    group.type === "ALL"
      ? course.lectureHours + course.exerciseHours + course.seminarHours
      : group.type === "P"
        ? course.lectureHours
        : group.type === "V"
          ? course.exerciseHours
          : group.type === "S"
            ? course.seminarHours
            : 0;
  const scheduledHours = data.sessions
    .filter((s) => s.groupId === groupId)
    .reduce((n, s) => n + s.hours, 0);
  const scheduleIncomplete =
    scheduledHours < declaredHours ||
    active < Math.max(0, group.plannedUnits - cancelled - exempt);
  const incomplete =
    scheduleIncomplete ||
    planned === 0 ||
    missing > 0 ||
    active < Math.max(0, group.plannedUnits - cancelled - exempt);
  const current = recorded ? (present / recorded) * 100 : null;
  const projected = planned
    ? ((present + Math.max(0, planned - recorded)) / planned) * 100
    : null;
  const severity =
    planned === 0 || (scheduleIncomplete && group.plannedUnits === 0)
      ? "unknown"
      : remaining === null
        ? "safe"
        : remaining < 0
          ? "danger"
          : remaining === 0
            ? "limit"
            : remaining <= 1
              ? "warning"
              : "safe";
  const warning =
    severity === "danger"
      ? `Prekoračili ste dopušteni broj izostanaka: ${group.name}.${rule.consequence ? ` Prema unesenom pravilu: ${rule.consequence}.` : ""}`
      : severity === "limit"
        ? `Dosegnuli ste maksimalni broj izostanaka: ${group.name}.${rule.consequence ? ` Sljedeći izostanak može značiti: ${rule.consequence}.` : ""}`
        : severity === "warning"
          ? `Pažnja! Preostao je još ${remaining} dopušten izostanak: ${group.name}.`
          : "";
  return {
    group,
    rule,
    planned,
    held,
    recorded,
    present,
    absent,
    excused,
    cancelled,
    missing,
    future,
    missedHours,
    current,
    projected,
    remaining,
    incomplete,
    scheduledHours,
    declaredHours,
    scheduleIncomplete,
    allowance,
    severity,
    warning,
    history: history.sort((a, b) => a.date.localeCompare(b.date)),
    remainingPlanned: Math.max(0, planned - held + exempt),
  };
}

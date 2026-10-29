import { describe, it, expect } from "vitest";
import {
  requiredVisits,
  summarize,
  todayZagreb,
  allowedAbsences,
} from "../src/lib/attendance";
import { fixture, mark, session } from "./fixtures";
const summary = (d: ReturnType<typeof fixture>) =>
  summarize(d, "g", "2026-10-29");
describe("Izračuni dolaznosti — traženi scenariji", () => {
  it("1: 15 termina, 80% → 12 dolazaka i 3 izostanka", () => {
    const s = summary(fixture());
    expect(s.allowance).toMatchObject({ required: 12, base: 3, total: 3 });
  });
  it("2: dodatni izostanak povećava limit na 4, bez promjene 80%", () => {
    const s = summary(fixture({ extra: 1 }));
    expect(s.allowance.total).toBe(4);
    expect(s.rule.minimum).toBe(80);
  });
  it("3: četiri sata su jedan izostanak i četiri propuštena sata", () => {
    const s = summary(mark(fixture(), 0, "ABSENT"));
    expect(s.absent).toBe(1);
    expect(s.missedHours).toBe(4);
  });
  it("4: tri sata su jedan izostanak", () => {
    const s = summary(mark(fixture({}, 15, 3), 0, "ABSENT"));
    expect(s.absent).toBe(1);
    expect(s.missedHours).toBe(3);
  });
  it("5: odvojene vježbe ne povećavaju izostanke s predavanja", () => {
    const d = fixture();
    d.groups.push({ ...d.groups[0], id: "v", name: "Vježbe", type: "V" });
    d.rules.push({ ...d.rules[0], id: "rv", groupId: "v" });
    d.units[0].groupId = "v";
    d.sessions[0].groupId = "v";
    mark(d, 0, "ABSENT");
    expect(summary(d).absent).toBe(0);
    expect(summarize(d, "v", "2026-10-29").absent).toBe(1);
  });
  it("6: drugi izostanak prekoračuje maksimum 1 i prikazuje samo unesenu posljedicu", () => {
    const d = mark(
      mark(
        fixture({
          mode: "MAX",
          maximum: 1,
          consequence: "ponovno upisivanje kolegija",
        }),
        0,
        "ABSENT",
      ),
      1,
      "ABSENT",
    );
    expect(summary(d)).toMatchObject({ remaining: -1, severity: "danger" });
    expect(summary(d).warning).toContain("ponovno upisivanje");
    d.rules[0].consequence = "";
    expect(summary(d).warning).not.toContain("ponovno upisivanje");
  });
  it("7: otkazana i neodržana nastava nisu izostanci i smanjuju plan", () => {
    const d = session(mark(fixture(), 0, "ABSENT"), 0, { state: "CANCELLED" });
    session(d, 1, { state: "NOT_HELD" });
    expect(summary(d)).toMatchObject({ absent: 0, cancelled: 2, planned: 13 });
  });
  it("8: trenutnih 100% nakon dva dolaska razlikuje se od uvjetne projekcije", () => {
    const s = summary(mark(mark(fixture(), 0, "PRESENT"), 1, "PRESENT"));
    expect(s.current).toBe(100);
    expect(s.recorded).toBe(2);
    expect(s.planned).toBe(15);
    expect(s.missing).toBe(13);
    expect(s.projected).toBe(100);
    expect(s.incomplete).toBe(true);
  });
  it("10: dva termina iste dnevne jedinice ne stvaraju dva izostanka", () => {
    const d = mark(fixture(), 0, "ABSENT");
    d.sessions[0].hours = 2;
    d.sessions.push({
      ...d.sessions[0],
      id: "other",
      startTime: "13:00",
      endTime: "14:30",
    });
    expect(summary(d)).toMatchObject({
      absent: 1,
      missedHours: 4,
      planned: 15,
    });
  });
});
describe("Rubni slučajevi i pravila", () => {
  it.each([
    [15, 80, 12],
    [3, 66.67, 3],
    [3, 66.66, 2],
    [7, 85, 6],
    [15, 0, 0],
    [15, 100, 15],
    [10, 90.01, 10],
  ])("ceil(%i × %f%%) = %i", (total, min, expected) =>
    expect(requiredVisits(total, min)).toBe(expected),
  );
  it("nepotpun raspored zadržava deklarirani plan i označava procjenu", () => {
    const d = fixture();
    d.sessions = d.sessions.slice(0, 2);
    d.units = d.units.slice(0, 2);
    expect(summary(d)).toMatchObject({ planned: 15, incomplete: true });
  });
  it("budući termini i nepoznati statusi ne ulaze u ostvarenu dolaznost", () => {
    const d = mark(fixture(), 1, "ABSENT");
    const s = summarize(d, "g", "2026-09-30");
    expect(s).toMatchObject({
      current: null,
      absent: 0,
      future: 15,
      recorded: 0,
    });
  });
  it("opravdani izostanak može biti izuzet iz oba nazivnika", () => {
    const d = mark(fixture(), 0, "EXCUSED");
    expect(summary(d)).toMatchObject({
      excused: 1,
      absent: 0,
      planned: 14,
      recorded: 0,
      missedHours: 4,
    });
    d.rules[0].excusedCounts = true;
    expect(summary(d)).toMatchObject({
      excused: 1,
      absent: 1,
      planned: 15,
      recorded: 1,
    });
  });
  it.each([
    ["PRESENT", 1, 0],
    ["ABSENT", 0, 1],
    ["FRACTION", 0.5, 0.5],
  ] as const)("djelomična prisutnost %s", (partial, present, absent) => {
    expect(summary(mark(fixture({ partial }), 0, "PARTIAL"))).toMatchObject({
      present,
      absent,
    });
  });
  it("dodatni izostanci ne stvaraju limit veći od plana", () =>
    expect(summary(fixture({ extra: 100 })).allowance.total).toBe(15));
  it("I zahtijeva stroži, ILI dopušta blaži od dvaju uvjeta", () => {
    const d = fixture({ mode: "AND", minimum: 80, maximum: 1 });
    expect(summary(d).allowance.total).toBe(1);
    d.rules[0].mode = "OR";
    expect(summary(d).allowance.total).toBe(3);
  });
  it("ručni limit i evidencija bez ograničenja", () => {
    const d = fixture({ mode: "MANUAL", maximum: 2 });
    expect(summary(d).remaining).toBe(2);
    d.rules[0].mode = "NONE";
    expect(summary(d).remaining).toBeNull();
  });
  it("promjena pravila preračunava stare statuse, ne briše ih", () => {
    const d = mark(fixture(), 0, "ABSENT");
    expect(summary(d).remaining).toBe(2);
    d.rules[0].minimum = 100;
    expect(summary(d).remaining).toBe(-1);
    expect(d.attendance).toHaveLength(1);
  });
  it("nadoknada povećava stvarni plan i ostaje pojedinačan dolazak", () => {
    const d = fixture();
    d.units.push({ id: "makeup", groupId: "g", date: "2026-10-20" });
    d.sessions.push({
      ...d.sessions[0],
      id: "makeup",
      unitId: "makeup",
      date: "2026-10-20",
      kind: "MAKEUP",
    });
    expect(summary(d).planned).toBe(16);
  });
  it("novi semestar ne miješa evidenciju prethodnog", () => {
    const d = mark(fixture(), 0, "ABSENT");
    d.semesters.push({ ...d.semesters[0], id: "summer", name: "Ljetni" });
    d.courses.push({ ...d.courses[0], id: "c2", semesterId: "summer" });
    d.groups.push({ ...d.groups[0], id: "g2", courseId: "c2" });
    d.rules.push({ ...d.rules[0], id: "r2", groupId: "g2" });
    expect(summarize(d, "g2").absent).toBe(0);
    expect(summary(d).absent).toBe(1);
  });
  it("Zagreb datumi ostaju ispravni na UTC ponoći i DST prijelazu", () => {
    expect(todayZagreb(new Date("2026-10-28T23:30:00Z"))).toBe("2026-10-29");
    expect(todayZagreb(new Date("2026-03-29T22:30:00Z"))).toBe("2026-03-30");
  });
  it("tolerancija za postotak ne zaokružuje dopuštene izostanke prema gore", () => {
    const d = fixture({ minimum: 66.67 }, 3);
    const a = allowedAbsences(3, d.rules[0]);
    expect(a.total).toBe(0);
  });
  it("neuneseni plan nema lažno siguran status ni upozorenje o dosegnutoj granici", () => {
    const s = summary(fixture({}, 0));
    expect(s.severity).toBe("unknown");
    expect(s.warning).toBe("");
    expect(s.incomplete).toBe(true);
  });
  it("današnji budući termin ne ulazi u održanu i evidentiranu dolaznost", () => {
    const d = mark(fixture({}, 1), 0, "ABSENT");
    const s = summarize(d, "g", "2026-10-01", "08:00");
    expect(s).toMatchObject({ held: 0, absent: 0, recorded: 0, future: 1 });
    expect(summarize(d, "g", "2026-10-01", "13:00")).toMatchObject({
      held: 1,
      absent: 1,
    });
  });
});

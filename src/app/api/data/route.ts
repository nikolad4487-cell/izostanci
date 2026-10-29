import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getData, generateSlot, saveSession, restore, uid } from "@/lib/store";
import {
  yearSchema,
  semesterSchema,
  holidaySchema,
  courseSchema,
  groupSchema,
  ruleSchema,
  slotSchema,
  sessionSchema,
  attendanceSchema,
  settingsSchema,
} from "@/lib/validation";
import { requireSession } from "@/lib/access";
import { unitPending } from "@/lib/attendance";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const denied = requireSession(request);
  if (denied) return denied;
  return NextResponse.json(await getData(), {
    headers: { "Cache-Control": "no-store" },
  });
}
export async function POST(request: NextRequest) {
  const denied = requireSession(request);
  if (denied) return denied;
  try {
    // Osobna lokalna aplikacija: odbija mutacije iz drugog web-izvora.
    const origin = request.headers.get("origin");
    if (
      origin &&
      new URL(origin).host !== request.headers.get("host") &&
      new URL(origin).host !== request.headers.get("x-forwarded-host")
    )
      return NextResponse.json(
        { error: "Nedopušten izvor zahtjeva." },
        { status: 403 },
      );
    if (Number(request.headers.get("content-length") ?? 0) > 4_000_000)
      throw new Error("Datoteka smije imati najviše 4 MB.");
    const body = await request.json();
    if (body.action === "restore") {
      if (body.confirm !== true) throw new Error("Potvrdite zamjenu podataka.");
      await restore(body.backup);
    } else
      await db.$transaction(
        async (tx) => {
          switch (body.action) {
            case "year": {
              const v = yearSchema.parse(body.value);
              await tx.academicYear.upsert({
                where: { id: v.id },
                create: v,
                update: v,
              });
              break;
            }
            case "semester": {
              const v = semesterSchema.parse(body.value);
              await tx.semester.upsert({
                where: { id: v.id },
                create: v,
                update: v,
              });
              break;
            }
            case "holiday": {
              const v = holidaySchema.parse(body.value);
              const sem = await tx.semester.findUniqueOrThrow({
                where: { id: v.semesterId },
              });
              if (v.date < sem.start || v.date > sem.end)
                throw new Error("Praznik mora biti unutar semestra.");
              await tx.holiday.upsert({
                where: { id: v.id },
                create: v,
                update: v,
              });
              break;
            }
            case "course": {
              const v = courseSchema.parse(body.value);
              const old = await tx.course.findUnique({
                where: { id: v.id },
                include: { groups: true },
              });
              await tx.course.upsert({
                where: { id: v.id },
                create: v,
                update: v,
              });
              if (old && old.counting !== v.counting) {
                const sessions = await tx.session.findMany({
                  where: { groupId: { in: old.groups.map((g) => g.id) } },
                });
                for (const session of sessions)
                  await saveSession(tx, sessionSchema.parse(session));
              }
              if (!old) {
                const group = groupSchema.parse(body.group);
                const rule = ruleSchema.parse(body.rule);
                if (group.courseId !== v.id || rule.groupId !== group.id)
                  throw new Error("Neispravna skupina.");
                await tx.teachingGroup.create({ data: group });
                await tx.attendanceRule.create({ data: rule });
              }
              break;
            }
            case "group": {
              const g = groupSchema.parse(body.value),
                r = ruleSchema.parse(body.rule);
              if (g.id !== r.groupId) throw new Error("Neispravno pravilo.");
              const previous = await tx.teachingGroup.findUnique({
                where: { id: g.id },
              });
              if (previous && previous.courseId !== g.courseId)
                throw new Error(
                  "Skupina se ne može premjestiti u drugi kolegij.",
                );
              await tx.teachingGroup.upsert({
                where: { id: g.id },
                create: g,
                update: g,
              });
              await tx.attendanceRule.upsert({
                where: { groupId: g.id },
                create: r,
                update: { ...r, id: undefined },
              });
              break;
            }
            case "slot": {
              const v = slotSchema.parse(body.value);
              const previous = await tx.weeklySlot.findUnique({
                where: { id: v.id },
              });
              if (previous && previous.groupId !== v.groupId)
                throw new Error(
                  "Postojeće ponavljanje ne može promijeniti skupinu. Dodajte novo ponavljanje.",
                );
              await tx.weeklySlot.upsert({
                where: { id: v.id },
                create: v,
                update: v,
              });
              await generateSlot(tx, v.id);
              break;
            }
            case "generate": {
              const id = z.string().parse(body.id);
              await generateSlot(tx, id);
              break;
            }
            case "session": {
              const v = sessionSchema.parse(body.value);
              await saveSession(tx, { ...v, modified: true });
              break;
            }
            case "attendance": {
              const v = attendanceSchema.parse(body.value);
              const unit = await tx.attendanceUnit.findUniqueOrThrow({
                where: { id: v.unitId },
                include: { sessions: true },
              });
              if (unitPending(unit.date, unit.sessions))
                throw new Error(
                  "Dolaznost se može evidentirati tek nakon završetka nastave te evidencijske jedinice.",
                );
              if (!unit.sessions.some((s) => s.state === "PLANNED"))
                throw new Error(
                  "Za otkazanu ili neodržanu nastavu nije moguće evidentirati dolaznost.",
                );
              await tx.attendance.upsert({
                where: { unitId: v.unitId },
                create: v,
                update: { status: v.status, note: v.note },
              });
              break;
            }
            case "clearAttendance": {
              await tx.attendance.deleteMany({
                where: { unitId: z.string().parse(body.id) },
              });
              break;
            }
            case "settings": {
              const v = settingsSchema.parse(body.value);
              await tx.userSettings.upsert({
                where: { id: "default" },
                create: v,
                update: v,
              });
              break;
            }
            case "delete": {
              if (body.confirm !== true) throw new Error("Potvrdite brisanje.");
              const id = z.string().parse(body.id);
              switch (body.entity) {
                case "course":
                  await tx.course.delete({ where: { id } });
                  break;
                case "group":
                  await tx.teachingGroup.delete({ where: { id } });
                  break;
                case "year":
                  await tx.academicYear.delete({ where: { id } });
                  break;
                case "semester":
                  await tx.semester.delete({ where: { id } });
                  break;
                case "holiday":
                  await tx.holiday.delete({ where: { id } });
                  break;
                case "session":
                  await tx.session.delete({ where: { id } });
                  await tx.attendanceUnit.deleteMany({
                    where: { sessions: { none: {} } },
                  });
                  break;
                case "slot":
                  await tx.weeklySlot.delete({ where: { id } });
                  break;
                default:
                  throw new Error("Nepoznata vrsta zapisa.");
              }
              break;
            }
            case "examples": {
              const { exampleCourses } = await import("@/lib/types");
              const semesterId = z.string().parse(body.semesterId);
              const settings = await tx.userSettings.upsert({
                where: { id: "default" },
                create: { id: "default" },
                update: {},
              });
              for (const name of exampleCourses) {
                if (await tx.course.findFirst({ where: { name, semesterId } }))
                  continue;
                const courseId = uid(),
                  groupId = uid();
                await tx.course.create({
                  data: {
                    id: courseId,
                    semesterId,
                    name,
                    counting: settings.counting,
                    notes:
                      "Primjer kolegija. Unesite stvarnu satnicu, raspored i pravila; zadane vrijednosti nisu službene.",
                  },
                });
                await tx.teachingGroup.create({
                  data: {
                    id: groupId,
                    courseId,
                    name: "Zajednička evidencija",
                    type: "ALL",
                  },
                });
                await tx.attendanceRule.create({
                  data: {
                    id: uid(),
                    groupId,
                    minimum: settings.minimum,
                    extra: settings.extra,
                    partial: settings.partial,
                    partialWeight: settings.partialWeight,
                    excusedCounts: settings.excusedCounts,
                  },
                });
              }
              break;
            }
            default:
              throw new Error("Nepoznata radnja.");
          }
        },
        { timeout: 30000 },
      );
    return NextResponse.json(await getData());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "Provjerite sva obavezna polja, datume i raspone brojeva."
        : error instanceof Error && !error.message.includes("prisma")
          ? error.message
          : "Spremanje nije uspjelo. Provjerite povezane podatke ili pokušajte ponovno.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

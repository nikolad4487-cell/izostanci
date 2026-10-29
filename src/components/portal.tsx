"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster, toast } from "sonner";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  eachDayOfInterval,
} from "date-fns";
import { hr } from "date-fns/locale";
import {
  LogOut,
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  Clock3,
  BarChart3,
  Settings2,
  GraduationCap,
  Plus,
  Search,
  Bell,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  AlertTriangle,
  Menu,
  Moon,
  Sun,
  Download,
  Upload,
  FileText,
  Trash2,
  Pencil,
  MapPin,
  Info,
  CalendarCheck,
  ShieldCheck,
  X,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import { Button } from "./ui/button";
import { FormDialog, type Field, type FormConfig } from "./form-dialog";
import { AttendanceChart, TrendChart } from "./charts";
import { summarize, todayZagreb, unitPending } from "@/lib/attendance";
import { backupSchema } from "@/lib/validation";
import { exportCSV, exportJSON, exportPDF } from "@/lib/exports";
import {
  modeLabels,
  statusLabels,
  type Data,
  type Course,
  type Group,
  type Semester,
  type Session,
  type Slot,
  type Year,
  type Rule,
  type Settings,
} from "@/lib/types";
const pages = [
  { id: "dashboard", label: "Nadzorna ploča", icon: LayoutDashboard },
  { id: "courses", label: "Moji kolegiji", icon: BookOpen },
  { id: "calendar", label: "Kalendar", icon: CalendarDays },
  { id: "schedule", label: "Tjedni raspored", icon: Clock3 },
  { id: "statistics", label: "Statistika", icon: BarChart3 },
  { id: "settings", label: "Postavke", icon: Settings2 },
];
const days = [
  "Ponedjeljak",
  "Utorak",
  "Srijeda",
  "Četvrtak",
  "Petak",
  "Subota",
  "Nedjelja",
];
const fmt = (date: string) => format(parseISO(date), "dd.MM.yyyy.");
const num = (n: number | null) =>
  n === null
    ? "—"
    : new Intl.NumberFormat("hr-HR", { maximumFractionDigits: 2 }).format(n);
const percent = (n: number | null) => (n === null ? "—" : `${num(n)}%`);
const uuid = () => crypto.randomUUID();
const field = (
  name: string,
  label: string,
  type: Field["type"] = "text",
  extra: Partial<Field> = {},
): Field => ({ name, label, type, ...extra });
const opt = (value: string, label: string) => ({ value, label });
const boolOptions = [opt("false", "Ne"), opt("true", "Da")];
const partialOptions = [
  opt("ABSENT", "Računa se kao izostanak"),
  opt("PRESENT", "Računa se kao dolazak"),
  opt("FRACTION", "Djelomična vrijednost"),
];
const ruleFields: Field[] = [
  field("name", "Naziv skupine", "text", { required: true }),
  field("type", "Vrsta nastave", "select", {
    options: [
      opt("ALL", "Zajednička evidencija (P + V + S)"),
      opt("P", "Predavanja"),
      opt("V", "Vježbe"),
      opt("S", "Seminari"),
      opt("OTHER", "Druga skupina"),
    ],
  }),
  field("plannedUnits", "Planirani broj evidencijskih jedinica", "number", {
    min: 0,
    max: 100000,
    help: "0 = izračun iz rasporeda. Po danu: broj različitih dana, ne sati.",
  }),
  field("mode", "Pravilo dolaznosti", "select", {
    options: Object.entries(modeLabels).map(([v, l]) => opt(v, l)),
  }),
  field("minimum", "Minimalna dolaznost (%)", "number", {
    min: 0,
    max: 100,
    step: "0.01",
  }),
  field("maximum", "Maksimalno / ručno dopuštenih izostanaka", "number", {
    min: 0,
    help: "Primjenjuje se za maksimum, ručno te I/ILI pravila.",
  }),
  field("extra", "Dodatni izostanci koje odobrava profesor", "number", {
    min: 0,
    help: "Zasebna iznimka; ne mijenja osnovni postotak.",
  }),
  field("partial", "Djelomična prisutnost", "select", {
    options: partialOptions,
  }),
  field("partialWeight", "Udio dolaska kod djelomične vrijednosti", "number", {
    min: 0,
    max: 1,
    step: "0.0001",
    help: "Primjer: 0,5 znači pola dolaska i pola izostanka.",
  }),
  field(
    "excusedCounts",
    "Opravdani izostanak troši dopuštene izostanke",
    "select",
    { options: boolOptions },
  ),
  field("consequence", "Posljedica prekoračenja (neobavezno)", "textarea", {
    help: "Samo pravilo koje ste sami provjerili; npr. ponovno upisivanje kolegija.",
  }),
];
export function Portal() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <PortalContent />
      <Toaster richColors position="bottom-right" />
    </ThemeProvider>
  );
}
function PortalContent() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null),
    [loadError, setLoadError] = useState(""),
    [page, setPage] = useState("dashboard"),
    [courseId, setCourseId] = useState<string | null>(null),
    [semesterId, setSemesterId] = useState(""),
    [yearFilter, setYearFilter] = useState(""),
    [statsCourse, setStatsCourse] = useState(""),
    [search, setSearch] = useState(""),
    [menu, setMenu] = useState(false),
    [modal, setModal] = useState<FormConfig | null>(null),
    [calendarDate, setCalendarDate] = useState(todayZagreb()),
    [view, setView] = useState<"month" | "week" | "day">("month");
  const { theme, setTheme } = useTheme();
  const fileInput = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/data", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/prijava");
        throw new Error("Prijavite se ponovno.");
      }
      if (!res.ok)
        throw new Error(
          "Baza nije dostupna. Provjerite DATABASE_URL i pokrenite npm run db:push.",
        );
      const d: Data = await res.json();
      setData(d);
      setTheme(d.settings.theme);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Učitavanje nije uspjelo.");
    }
  }, [setTheme, router]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/data", { cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/prijava");
          throw new Error("Prijavite se ponovno.");
        }
        if (!res.ok)
          throw new Error("Baza nije dostupna. Pokrenite npm run db:push.");
        return res.json() as Promise<Data>;
      })
      .then((result) => {
        setData(result);
        setTheme(result.settings.theme);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setLoadError(
            e instanceof Error ? e.message : "Učitavanje nije uspjelo.",
          );
      });
    return () => controller.abort();
  }, [setTheme, router]);
  async function mutate(payload: Record<string, unknown>) {
    const r = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await r.json();
    if (r.status === 401) {
      router.replace("/prijava");
      throw new Error("Prijavite se ponovno.");
    }
    if (!r.ok) throw new Error(result.error ?? "Spremanje nije uspjelo.");
    setData(result);
    setSemesterId((previous) =>
      previous && !result.semesters.some((s: Semester) => s.id === previous)
        ? ""
        : previous,
    );
    toast.success("Promjene su spremljene.");
  }
  function act(payload: Record<string, unknown>) {
    void mutate(payload).catch((e) => toast.error(e.message));
  }
  function navigate(id: string) {
    setPage(id);
    setCourseId(null);
    setMenu(false);
  }
  function openCourse(id: string) {
    setCourseId(id);
    setPage("detail");
    setMenu(false);
  }
  function remove(entity: string, id: string, label: string) {
    if (
      window.confirm(
        `Želite li izbrisati ${label}? Povezana evidencija bit će trajno izbrisana. Prije brisanja možete izvesti sigurnosnu kopiju.`,
      )
    )
      act({ action: "delete", entity, id, confirm: true });
  }
  if (!data)
    return (
      <div className="loading">
        <div className="loading-inner">
          <div className="brand-mark">
            <GraduationCap />
          </div>
          <h2>Dolaznost</h2>
          {loadError ? (
            <>
              <p role="alert">{loadError}</p>
              <Button onClick={() => void load()}>Pokušaj ponovno</Button>
            </>
          ) : (
            <>
              <div className="spinner" />
              <p className="muted">Pripremamo vaš studentski planer…</p>
            </>
          )}
        </div>
      </div>
    );
  const d = data;
  const currentSemester = d.semesters.find((s) => s.id === semesterId);
  const visibleCourses = d.courses.filter(
    (c) =>
      (!semesterId || c.semesterId === semesterId) &&
      c.name.toLocaleLowerCase("hr").includes(search.toLocaleLowerCase("hr")),
  );
  const visibleGroupIds = d.groups
    .filter((g) => visibleCourses.some((c) => c.id === g.courseId))
    .map((g) => g.id);
  const summaries = visibleGroupIds.map((id) => summarize(d, id));
  const absences = summaries.reduce((n, s) => n + s.absent, 0);
  const limitCourses = visibleCourses.filter((c) =>
    summaries.some((s) => s.group.courseId === c.id && s.severity === "limit"),
  );
  const dangerCourses = visibleCourses.filter((c) =>
    summaries.some((s) => s.group.courseId === c.id && s.severity === "danger"),
  );
  const warnings = summaries.filter((s) => s.warning);
  const today = todayZagreb();
  const liveSessions = d.sessions
    .filter((s) => visibleGroupIds.includes(s.groupId) && s.state === "PLANNED")
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
    );
  const todaySessions = liveSessions.filter((s) => s.date === today);
  const upcoming = liveSessions.find(
    (s) =>
      s.date > today ||
      (s.date === today &&
        s.startTime >=
          new Intl.DateTimeFormat("hr-HR", {
            timeZone: "Europe/Zagreb",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(new Date())),
  );
  const course = d.courses.find((c) => c.id === courseId);
  function defaultRule(groupId: string): Rule {
    return {
      id: uuid(),
      groupId,
      mode: "PERCENT",
      minimum: d.settings.minimum,
      maximum: 0,
      extra: d.settings.extra,
      partial: d.settings.partial,
      partialWeight: d.settings.partialWeight,
      excusedCounts: d.settings.excusedCounts,
      consequence: "",
    };
  }
  function editYear(year?: Year) {
    const id = year?.id ?? uuid();
    setModal({
      title: year ? "Uredi akademsku godinu" : "Nova akademska godina",
      fields: [
        field("name", "Akademska godina", "text", {
          required: true,
          help: "Primjer: 2026./2027.",
        }),
      ],
      initial: year ?? { name: "" },
      submit: async (v) => {
        await mutate({ action: "year", value: { ...v, id } });
      },
    });
  }
  function editSemester(sem?: Semester) {
    if (!d.years.length) {
      toast.info("Najprije dodajte akademsku godinu.");
      editYear();
      return;
    }
    const id = sem?.id ?? uuid();
    setModal({
      title: sem ? "Uredi semestar" : "Novi semestar",
      description: "Datumi su lokalni datumi u zoni Europe/Zagreb.",
      fields: [
        field("yearId", "Akademska godina", "select", {
          options: d.years.map((y) => opt(y.id, y.name)),
          required: true,
        }),
        field("name", "Naziv semestra", "text", { required: true }),
        field("start", "Početak nastave", "date", { required: true }),
        field("end", "Završetak nastave", "date", { required: true }),
      ],
      initial: sem ?? {
        yearId: d.years[0].id,
        name: "Zimski semestar",
        start: today,
        end: format(addMonths(parseISO(today), 4), "yyyy-MM-dd"),
      },
      submit: async (v) => {
        await mutate({ action: "semester", value: { ...v, id } });
        setSemesterId(id);
      },
    });
  }
  function editCourse(c?: Course) {
    if (!d.semesters.length) {
      toast.info("Najprije dodajte semestar.");
      editSemester();
      return;
    }
    const id = c?.id ?? uuid();
    const groupId = uuid();
    setModal({
      title: c ? "Uredi kolegij" : "Dodaj kolegij",
      description:
        "Unesite provjerene podatke. Zadane postavke nisu službena pravila fakulteta.",
      fields: [
        field("name", "Naziv kolegija", "text", { required: true }),
        field("semesterId", "Semestar", "select", {
          options: d.semesters.map((s) =>
            opt(
              s.id,
              `${d.years.find((y) => y.id === s.yearId)?.name} · ${s.name}`,
            ),
          ),
        }),
        field("professor", "Profesor / profesorica"),
        field("color", "Boja kolegija", "color"),
        field("lectureHours", "Ukupna satnica predavanja (P)", "number", {
          min: 0,
        }),
        field("exerciseHours", "Ukupna satnica vježbi (V)", "number", {
          min: 0,
        }),
        field("seminarHours", "Ukupna satnica seminara (S)", "number", {
          min: 0,
        }),
        field("counting", "Način brojanja unutar svake skupine", "select", {
          options: [
            opt("DAY", "Po danu — jedan dnevni dolazak"),
            opt("SESSION", "Po pojedinačnom terminu"),
          ],
          help: "Za posebna pravila dodajte zasebne skupine P, V i S. Promjena preračunava postojeću evidenciju: razdvaja ili objedinjuje jedinice. Različite statuse istog dana morate prvo uskladiti. Provjerite i planirani broj jedinica.",
        }),
        ...(!c
          ? [
              field("minimum", "Minimalna dolaznost (%)", "number", {
                min: 0,
                max: 100,
                step: "0.01",
              }),
              field("extra", "Dodatno dopušteni izostanci", "number", {
                min: 0,
              }),
              field("plannedUnits", "Planirani broj dana / termina", "number", {
                min: 0,
                help: "Ako unesete 0, koristi se generirani raspored. 60 sati po 4 sata = 15 termina.",
              }),
            ]
          : []),
        field("notes", "Napomene", "textarea"),
      ],
      initial: c ?? {
        semesterId: semesterId || d.semesters[0].id,
        name: "",
        professor: "",
        color: "#2563eb",
        lectureHours: 0,
        exerciseHours: 0,
        seminarHours: 0,
        counting: d.settings.counting,
        minimum: d.settings.minimum,
        extra: d.settings.extra,
        plannedUnits: 0,
        notes: "",
      },
      submit: async (v) => {
        const { minimum, extra, plannedUnits, ...value } = v;
        await mutate({
          action: "course",
          value: { ...value, id },
          group: {
            id: groupId,
            courseId: id,
            name: "Zajednička evidencija",
            type: "ALL",
            plannedUnits,
          },
          rule: { ...defaultRule(groupId), minimum, extra },
        });
      },
    });
  }
  function editGroup(c: Course, g?: Group) {
    const id = g?.id ?? uuid();
    const r = g ? d.rules.find((r) => r.groupId === id)! : defaultRule(id);
    setModal({
      title: g ? "Uredi skupinu i pravila" : "Nova skupina dolaznosti",
      description:
        "Svaka skupina zasebno broji izostanke. Svi uvjeti svih skupina moraju biti zadovoljeni. Promjena pravila odmah preračunava cijeli semestar; zapisi ostaju sačuvani.",
      fields: ruleFields,
      initial: { ...r, ...(g ?? { name: "", type: "V", plannedUnits: 0 }) },
      submit: async (v) => {
        const { name, type, plannedUnits, ...rule } = v;
        await mutate({
          action: "group",
          value: { id, courseId: c.id, name, type, plannedUnits },
          rule: { ...rule, id: r.id, groupId: id },
        });
      },
    });
  }
  function groupOptions() {
    return d.groups
      .filter(
        (g) =>
          !semesterId ||
          d.courses.find((c) => c.id === g.courseId)?.semesterId === semesterId,
      )
      .map((g) =>
        opt(
          g.id,
          `${d.courses.find((c) => c.id === g.courseId)?.name} · ${g.name}`,
        ),
      );
  }
  function editSlot(slot?: Slot) {
    if (!d.groups.length) {
      toast.info("Najprije dodajte kolegij.");
      editCourse();
      return;
    }
    const groupId =
      slot?.groupId ??
      d.groups.find((g) => g.courseId === courseId)?.id ??
      groupOptions()[0]?.value ??
      d.groups[0].id;
    const c = d.courses.find(
      (c) => c.id === d.groups.find((g) => g.id === groupId)?.courseId,
    )!;
    const sem = d.semesters.find((s) => s.id === c.semesterId)!;
    setModal({
      title: slot ? "Uredi tjedno ponavljanje" : "Dodaj tjedni termin",
      description:
        "Spremanje generira nastavu za raspon datuma, preskačući praznike. Evidentirani, ručno uređeni i prošli termini ostaju sačuvani.",
      fields: [
        field("groupId", "Kolegij i skupina", "select", {
          options: slot
            ? groupOptions().filter((o) => o.value === slot.groupId)
            : groupOptions(),
          required: true,
        }),
        field("weekday", "Dan u tjednu", "select", {
          options: days.map((n, i) => opt(String(i + 1), n)),
        }),
        field("startTime", "Početak", "time", { required: true }),
        field("endTime", "Završetak", "time", { required: true }),
        field("hours", "Nastavnih sati po terminu", "number", {
          min: 1,
          max: 24,
        }),
        field("room", "Prostorija"),
        field("start", "Ponavljanje od", "date", { required: true }),
        field("end", "Ponavljanje do", "date", { required: true }),
      ],
      initial: slot ?? {
        groupId,
        weekday: 1,
        startTime: "09:00",
        endTime: "10:30",
        hours: 2,
        room: "",
        start: sem.start,
        end: sem.end,
      },
      submit: async (v) => {
        await mutate({
          action: "slot",
          value: { ...v, id: slot?.id ?? uuid(), weekday: Number(v.weekday) },
        });
      },
    });
  }
  function editSession(s?: Session, date?: string) {
    if (!d.groups.length) {
      toast.info("Najprije dodajte kolegij.");
      editCourse();
      return;
    }
    const groups = groupOptions();
    const groupId =
      s?.groupId ??
      d.groups.find((g) => g.courseId === courseId)?.id ??
      groups[0]?.value ??
      d.groups[0].id;
    setModal({
      title: s ? "Uredi pojedinačni termin" : "Dodaj termin / nadoknadu",
      description:
        "Izmjena se odnosi samo na ovaj termin. Dolaznost se bilježi zasebno nakon održavanja. Premještanje zadržava uneseni status; premještanje dijela dnevne nastave na drugi dan može stvoriti novu dnevnu jedinicu.",
      fields: [
        field("groupId", "Kolegij i skupina", "select", {
          options: s
            ? [
                opt(
                  s.groupId,
                  `${d.courses.find((c) => c.id === d.groups.find((g) => g.id === s.groupId)?.courseId)?.name} · ${d.groups.find((g) => g.id === s.groupId)?.name}`,
                ),
              ]
            : groups,
        }),
        field("date", "Datum", "date", { required: true }),
        field("startTime", "Početak", "time", { required: true }),
        field("endTime", "Završetak", "time", { required: true }),
        field("hours", "Broj nastavnih sati", "number", { min: 1, max: 24 }),
        field("room", "Prostorija"),
        field("kind", "Vrsta termina", "select", {
          options: [
            opt("REGULAR", "Redovni termin"),
            opt("MAKEUP", "Nadoknada nastave"),
            opt("EXTRA", "Izvanredna nastava"),
          ],
        }),
        field("state", "Održavanje", "select", {
          options: [
            opt("PLANNED", "Planirana / održana nastava"),
            opt("CANCELLED", "Nastava otkazana"),
            opt("NOT_HELD", "Nastava nije održana"),
          ],
        }),
      ],
      initial: s ?? {
        groupId,
        date: date ?? today,
        startTime: "09:00",
        endTime: "10:30",
        hours: 2,
        room: "",
        kind: "EXTRA",
        state: "PLANNED",
      },
      submit: async (v) => {
        await mutate({
          action: "session",
          value: {
            ...v,
            id: s?.id ?? uuid(),
            slotId: s?.slotId ?? null,
            originalDate: s?.originalDate ?? null,
            modified: true,
            unitId: s?.unitId ?? uuid(),
          },
        });
      },
    });
  }
  function editHoliday() {
    if (!d.semesters.length) {
      editSemester();
      return;
    }
    setModal({
      title: "Dodaj praznik / neradni dan",
      description:
        "Praznici se preskaču pri generiranju rasporeda. Za postojeći raspored nakon dodavanja kliknite „Osvježi termine”; postojeća evidencija ostaje sačuvana.",
      fields: [
        field("semesterId", "Semestar", "select", {
          options: d.semesters.map((s) => opt(s.id, s.name)),
        }),
        field("date", "Datum", "date", { required: true }),
        field("name", "Naziv", "text", { required: true }),
      ],
      initial: {
        semesterId: semesterId || d.semesters[0].id,
        date: today,
        name: "",
      },
      submit: async (v) => {
        await mutate({ action: "holiday", value: { ...v, id: uuid() } });
      },
    });
  }
  function editSettings() {
    setModal({
      title: "Zadane postavke",
      description:
        "Primjenjuju se na nove kolegije i skupine. Postojeća pravila uredite na kolegiju.",
      fields: [
        field("minimum", "Zadana minimalna dolaznost (%)", "number", {
          min: 0,
          max: 100,
          step: "0.01",
        }),
        field("extra", "Zadani dodatni izostanci", "number", { min: 0 }),
        field("counting", "Zadano brojanje", "select", {
          options: [opt("DAY", "Po danu"), opt("SESSION", "Po terminu")],
        }),
        field("partial", "Djelomična prisutnost", "select", {
          options: partialOptions,
        }),
        field("partialWeight", "Djelomični udio dolaska", "number", {
          min: 0,
          max: 1,
          step: "0.0001",
        }),
        field(
          "excusedCounts",
          "Opravdani izostanci računaju se kao izostanci",
          "select",
          { options: boolOptions },
        ),
        field("warnings", "Prikaz upozorenja", "select", {
          options: boolOptions,
        }),
        field("theme", "Tema", "select", {
          options: [
            opt("system", "Prema sustavu"),
            opt("light", "Svijetla"),
            opt("dark", "Tamna"),
          ],
        }),
      ],
      initial: d.settings,
      submit: async (v) => {
        await mutate({ action: "settings", value: { ...v, id: "default" } });
        setTheme(v.theme as string);
      },
    });
  }
  function attendanceSelect(s: Session) {
    const a = d.attendance.find((a) => a.unitId === s.unitId);
    return (
      <select
        aria-label={`Dolaznost ${s.date} ${s.startTime}`}
        className="attendance-select"
        value={a?.status ?? ""}
        disabled={
          unitPending(
            s.date,
            d.sessions.filter((x) => x.unitId === s.unitId),
          ) || s.state !== "PLANNED"
        }
        onChange={(e) =>
          e.target.value
            ? act({
                action: "attendance",
                value: {
                  id: a?.id ?? uuid(),
                  unitId: s.unitId,
                  status: e.target.value,
                  note: a?.note ?? "",
                },
              })
            : act({ action: "clearAttendance", id: s.unitId })
        }
      >
        <option value="">Nije evidentirano</option>
        {Object.entries(statusLabels).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    );
  }
  function attendanceNote(s: Session) {
    const a = d.attendance.find((a) => a.unitId === s.unitId);
    if (!a) {
      toast.info("Najprije odaberite status dolaznosti.");
      return;
    }
    setModal({
      title: "Napomena uz evidenciju",
      fields: [field("note", "Napomena", "textarea")],
      initial: { note: a.note },
      submit: async (v) => {
        await mutate({ action: "attendance", value: { ...a, note: v.note } });
      },
    });
  }
  function sessionTable(sessions: Session[]) {
    return sessions.length ? (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Datum i vrijeme</th>
              <th>Kolegij / skupina</th>
              <th>Sati</th>
              <th>Dolaznost</th>
              <th>Radnje</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => {
              const g = d.groups.find((g) => g.id === s.groupId)!;
              const c = d.courses.find((c) => c.id === g.courseId)!;
              return (
                <tr key={s.id}>
                  <td>
                    {fmt(s.date)}
                    <small className="muted">
                      {s.startTime} – {s.endTime} {s.room && `· ${s.room}`}
                    </small>
                    {s.kind !== "REGULAR" && (
                      <span className="badge warning">
                        {s.kind === "MAKEUP" ? "Nadoknada" : "Izvanredna"}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn-ghost"
                      onClick={() => openCourse(c.id)}
                    >
                      {c.name}
                    </button>
                    <small className="muted">{g.name}</small>
                  </td>
                  <td>{s.hours}</td>
                  <td>
                    {s.state === "PLANNED" ? (
                      attendanceSelect(s)
                    ) : (
                      <span className="badge">
                        {s.state === "CANCELLED"
                          ? "Nastava otkazana"
                          : "Nije održana"}
                      </span>
                    )}
                    {d.attendance.find((a) => a.unitId === s.unitId)?.note && (
                      <small className="muted">
                        {d.attendance.find((a) => a.unitId === s.unitId)?.note}
                      </small>
                    )}
                    <small className="muted">
                      {c.counting === "DAY"
                        ? "Zajednički status skupine za ovaj dan"
                        : "Zaseban status termina"}
                    </small>
                  </td>
                  <td>
                    <div className="actions">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Uredi termin"
                        onClick={() => editSession(s)}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Napomena uz evidenciju"
                        onClick={() => attendanceNote(s)}
                      >
                        <FileText size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Izbriši termin"
                        onClick={() => remove("session", s.id, "ovaj termin")}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        icon="calendar"
        title="Još nema termina"
        text="Dodajte tjedno ponavljanje ili pojedinačni termin za evidenciju dolaznosti."
        action={
          <Button size="sm" onClick={() => editSession()}>
            Dodaj termin
          </Button>
        }
      />
    );
  }
  function courseCard(c: Course) {
    const groups = d.groups.filter((g) => g.courseId === c.id);
    const ss = groups.map((g) => summarize(d, g.id));
    const sem = d.semesters.find((s) => s.id === c.semesterId)!;
    return (
      <article
        className="course-card"
        style={{ "--course-color": c.color } as React.CSSProperties}
        key={c.id}
      >
        <div className="course-title">
          <div
            className="actions"
            style={{ flexWrap: "nowrap", alignItems: "flex-start" }}
          >
            <div className="course-symbol">
              <BookOpen size={19} />
            </div>
            <button onClick={() => openCourse(c.id)}>
              <h3>{c.name}</h3>
              <p className="muted">{c.professor || "Profesor nije unesen"}</p>
            </button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Otvori ${c.name}`}
            onClick={() => openCourse(c.id)}
          >
            <ArrowUpRight size={16} />
          </Button>
        </div>
        <div className="course-meta">
          <span>
            <CalendarDays size={12} className="mini-icon" />
            {sem.name}
          </span>
          <span>
            {c.lectureHours + c.exerciseHours + c.seminarHours} nastavnih sati
          </span>
        </div>
        {ss.map((s) => (
          <div className="group-row" key={s.group.id}>
            <div className="group-label">
              <span>
                {groups.length > 1 ? s.group.name : modeLabels[s.rule.mode]}{" "}
                {s.rule.mode !== "NONE" &&
                  s.rule.mode !== "MAX" &&
                  s.rule.mode !== "MANUAL" &&
                  `· ${num(s.rule.minimum)}%`}
              </span>
              <span className={`badge ${s.severity}`}>
                {s.severity === "unknown"
                  ? "Unesite plan"
                  : s.severity === "danger"
                    ? "Prekoračeno"
                    : s.severity === "limit"
                      ? "Granica dosegnuta"
                      : s.severity === "warning"
                        ? "Još jedan izostanak"
                        : "Sigurno"}
              </span>
            </div>
            <div className="progress-track">
              <div
                className={`progress-fill ${s.severity}`}
                style={{
                  width: `${s.allowance.total === null ? 0 : s.allowance.total === 0 ? (s.absent ? 100 : 0) : Math.min(100, (s.absent / s.allowance.total) * 100)}%`,
                }}
              />
            </div>
            <div className="course-numbers">
              <div>
                <strong>
                  {s.allowance.total === null ? "∞" : num(s.allowance.total)}
                </strong>
                Dopušteno
              </div>
              <div>
                <strong>{num(s.absent)}</strong>Iskorišteno
              </div>
              <div>
                <strong
                  style={{
                    color: s.severity === "danger" ? "#dc5555" : undefined,
                  }}
                >
                  {s.remaining === null ? "∞" : num(s.remaining)}
                </strong>
                Preostalo
              </div>
            </div>
            {s.incomplete && (
              <small className="muted">Nepotpuna evidencija ili raspored</small>
            )}
          </div>
        ))}
        {!groups.length && (
          <p className="muted">Dodajte skupinu i pravila dolaznosti.</p>
        )}
        <div className="course-footer">
          <span className="muted">
            {ss.reduce((n, s) => n + s.planned, 0)} evidencijskih jedinica ·{" "}
            {c.counting === "DAY" ? "po danu" : "po terminu"}
          </span>
          <Button variant="ghost" size="sm" onClick={() => openCourse(c.id)}>
            Detalji kolegija <ChevronRight size={13} />
          </Button>
        </div>
      </article>
    );
  }
  const statCards = [
    {
      title: "Aktivni kolegiji",
      value: visibleCourses.length,
      description: "U odabranom razdoblju",
      icon: BookOpen,
      color: "blue",
    },
    {
      title: "Ukupno izostanaka",
      value: num(absences),
      description: "Evidencijske jedinice, ne sati",
      icon: CalendarCheck,
      color: "blue",
    },
    {
      title: "Dosegnuta granica",
      value: limitCourses.length,
      description: "Kolegiji bez preostalih izostanaka",
      icon: AlertTriangle,
      color: "orange",
    },
    {
      title: "Prekoračena granica",
      value: dangerCourses.length,
      description: "Provjerite pravila kolegija",
      icon: ShieldCheck,
      color: "red",
    },
  ];
  function statsCards() {
    return (
      <div className="stats-grid">
        {statCards.map((s) => (
          <div className="stat-card" key={s.title}>
            <div className="stat-top">
              <span>{s.title}</span>
              <span
                className={`stat-icon ${s.color === "orange" ? "limit" : s.color === "red" ? "danger" : ""}`}
              >
                <s.icon size={18} />
              </span>
            </div>
            <div className="stat-value">{s.value}</div>
            <small>{s.description}</small>
          </div>
        ))}
      </div>
    );
  }
  function backupButtons(id?: string) {
    return (
      <div className="actions">
        <Button variant="outline" size="sm" onClick={() => exportCSV(d, id)}>
          <Download size={13} />
          CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            void exportPDF(d, id).catch((e) => toast.error(e.message))
          }
        >
          <FileText size={13} />
          PDF
        </Button>
      </div>
    );
  }
  function quickAttendance(status: "PRESENT" | "ABSENT", c: Course) {
    const units = d.units
      .filter(
        (u) =>
          d.groups.some((g) => g.id === u.groupId && g.courseId === c.id) &&
          !unitPending(
            u.date,
            d.sessions.filter((s) => s.unitId === u.id),
          ) &&
          d.sessions.some((s) => s.unitId === u.id && s.state === "PLANNED"),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
    if (!units.length) {
      toast.info("Najprije dodajte termin na datum održane nastave.");
      editSession();
      return;
    }
    setModal({
      title:
        status === "PRESENT" ? "Evidentiraj dolazak" : "Evidentiraj izostanak",
      fields: [
        field("unitId", "Dan / termin i skupina", "select", {
          options: units.map((u) => {
            const session = d.sessions.find((s) => s.unitId === u.id)!;
            const old = d.attendance.find((a) => a.unitId === u.id);
            return opt(
              u.id,
              `${fmt(u.date)} ${c.counting === "SESSION" ? session.startTime : ""} · ${d.groups.find((g) => g.id === u.groupId)?.name}${old ? ` (${statusLabels[old.status]})` : ""}`,
            );
          }),
        }),
        field("note", "Napomena", "textarea"),
      ],
      initial: {
        unitId:
          units.find((u) => !d.attendance.some((a) => a.unitId === u.id))?.id ??
          units[0].id,
        note: "",
      },
      submit: async (v) => {
        await mutate({
          action: "attendance",
          value: { ...v, id: uuid(), status },
        });
      },
    });
  }
  function renderDashboard() {
    return (
      <>
        <div className="page-head">
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Tvoj semestar, pod kontrolom
            </div>
            <h1>Pregled dolaznosti</h1>
            <p className="muted">
              Prati nastavu. Planiraj izostanke. Ostani korak ispred.
            </p>
          </div>
          <Button onClick={() => editCourse()}>
            <Plus size={16} />
            Dodaj kolegij
          </Button>
        </div>
        {statsCards()}
        {!d.courses.length && (
          <div className="welcome-banner">
            <h2>Dobro došli u svoj studentski planer</h2>
            <p>
              Započnite akademskom godinom i semestrom, dodajte kolegije te
              unesite pravila dolaznosti koja vrijede za vas.
            </p>
            <div className="actions" style={{ marginTop: 16 }}>
              <Button
                variant="outline"
                onClick={() =>
                  d.semesters.length ? editCourse() : editSemester()
                }
              >
                <Plus size={14} />
                {d.semesters.length ? "Dodaj prvi kolegij" : "Postavi semestar"}
              </Button>
            </div>
          </div>
        )}
        <div className="dashboard-columns">
          <div>
            <div className="section-title">
              <h2>
                Moji kolegiji <small>({visibleCourses.length})</small>
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("courses")}
              >
                Svi kolegiji <ArrowUpRight size={13} />
              </Button>
            </div>
            {visibleCourses.length ? (
              <div className="course-grid">
                {visibleCourses.map(courseCard)}
              </div>
            ) : (
              <div className="panel">
                <Empty
                  title="Vaši kolegiji čekaju na vas"
                  text="Dodajte kolegij i točna pravila. Četiri nastavna sata u jednom danu mogu predstavljati samo jedan izostanak."
                  action={
                    <Button size="sm" onClick={() => editCourse()}>
                      <Plus size={14} />
                      Dodaj kolegij
                    </Button>
                  }
                />
              </div>
            )}
            <div className="notice" style={{ marginTop: 22 }}>
              <Info size={18} />
              <div>
                <strong>Sati nisu isto što i izostanci.</strong>
                <p>
                  Kod dnevnog brojanja sva nastava iste skupine u jednom danu
                  čini jednu evidencijsku jedinicu. Predavanja i vježbe možete
                  pratiti zasebno.
                </p>
              </div>
            </div>
          </div>
          <aside className="dashboard-aside">
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h3>Današnji raspored</h3>
                  <p className="muted">
                    {format(parseISO(today), "EEEE, d. MMMM", { locale: hr })}
                  </p>
                </div>
                <CalendarDays size={18} className="muted" />
              </div>
              {todaySessions.length ? (
                todaySessions.map((s) => (
                  <div className="schedule-item" key={s.id}>
                    <div className="schedule-time">
                      {s.startTime}
                      <br />
                      {s.endTime}
                    </div>
                    <div className="schedule-item-content">
                      <h3>
                        {
                          d.courses.find(
                            (c) =>
                              c.id ===
                              d.groups.find((g) => g.id === s.groupId)
                                ?.courseId,
                          )?.name
                        }
                      </h3>
                      <p>
                        {d.groups.find((g) => g.id === s.groupId)?.name} ·{" "}
                        {s.hours} sata
                      </p>
                      {s.room && (
                        <p>
                          <MapPin size={10} className="mini-icon" />
                          {s.room}
                        </p>
                      )}
                      <div style={{ marginTop: 8 }}>{attendanceSelect(s)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p
                  className="muted"
                  style={{ fontSize: 12, padding: "10px 0 20px" }}
                >
                  Danas nema planirane nastave.
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                style={{ width: "100%", marginTop: 10 }}
                onClick={() => {
                  navigate("calendar");
                  setCalendarDate(today);
                  setView("day");
                }}
              >
                Otvori kalendar <ChevronRight size={13} />
              </Button>
            </div>
            <div className="panel">
              <div className="panel-heading">
                <h3>Važno za tebe</h3>
                <Bell size={17} className="muted" />
              </div>
              {d.settings.warnings && warnings.length ? (
                warnings.map((s) => (
                  <div className="warning-item" key={s.group.id}>
                    <AlertTriangle size={16} />
                    <div>
                      <strong>
                        {d.courses.find((c) => c.id === s.group.courseId)?.name}
                      </strong>
                      <p>{s.warning}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="warning-item">
                  <CheckCircle2 size={18} />
                  <p>
                    {d.settings.warnings
                      ? "Nema upozorenja prema unesenim pravilima."
                      : "Upozorenja su isključena u postavkama."}
                  </p>
                </div>
              )}
              {upcoming && (
                <div style={{ paddingTop: 15 }}>
                  <div className="eyebrow">Sljedeća nastava</div>
                  <p style={{ fontSize: 12, marginTop: 7 }}>
                    {
                      d.courses.find(
                        (c) =>
                          c.id ===
                          d.groups.find((g) => g.id === upcoming.groupId)
                            ?.courseId,
                      )?.name
                    }
                  </p>
                  <small className="muted">
                    {fmt(upcoming.date)} · {upcoming.startTime}
                  </small>
                </div>
              )}
            </div>
          </aside>
        </div>
      </>
    );
  }
  function renderCourses() {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Moji kolegiji</h1>
            <p className="muted">
              Pravila dolaznosti prilagođena svakom kolegiju.
            </p>
          </div>
          <div className="actions">
            <Button
              variant="outline"
              onClick={() => {
                if (!d.semesters.length) {
                  editSemester();
                  return;
                }
                if (
                  window.confirm(
                    "Dodati devet primjera kolegija? Satnice i rasporedi ostaju prazni, a pravila preuzimaju vaše zadane postavke.",
                  )
                )
                  act({
                    action: "examples",
                    semesterId: semesterId || d.semesters[0].id,
                  });
              }}
            >
              Dodaj primjere
            </Button>
            <Button onClick={() => editCourse()}>
              <Plus size={15} />
              Novi kolegij
            </Button>
          </div>
        </div>
        <div className="filters">
          <input
            aria-label="Filtriraj kolegije"
            placeholder="Pretraži kolegije…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {visibleCourses.length ? (
          <div className="course-grid">{visibleCourses.map(courseCard)}</div>
        ) : (
          <div className="panel">
            <Empty
              title="Nema kolegija u ovom prikazu"
              text="Dodajte novi kolegij ili promijenite filtar semestra i pretragu."
              action={
                <Button onClick={() => editCourse()}>Dodaj kolegij</Button>
              }
            />
          </div>
        )}
      </>
    );
  }
  function renderDetail() {
    if (!course)
      return (
        <Empty
          title="Kolegij nije pronađen"
          text="Vratite se na popis kolegija."
          action={
            <Button onClick={() => navigate("courses")}>Moji kolegiji</Button>
          }
        />
      );
    const c = course;
    const sem = d.semesters.find((s) => s.id === c.semesterId)!;
    const groups = d.groups.filter((g) => g.courseId === c.id);
    const ss = groups.map((g) => summarize(d, g.id));
    const sessions = d.sessions
      .filter((s) => groups.some((g) => g.id === s.groupId))
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.startTime.localeCompare(b.startTime),
      );
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("courses")}
          style={{ marginBottom: 15 }}
        >
          <ArrowLeft size={14} />
          Svi kolegiji
        </Button>
        <div className="page-head">
          <div>
            <h1>{c.name}</h1>
            <p className="muted">
              {c.professor || "Profesor nije unesen"} ·{" "}
              {d.years.find((y) => y.id === sem.yearId)?.name} · {sem.name}
            </p>
          </div>
          <div className="actions">
            <Button variant="outline" onClick={() => editCourse(c)}>
              <Pencil size={14} />
              Uredi kolegij
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Izbriši kolegij"
              onClick={() => remove("course", c.id, c.name)}
            >
              <Trash2 size={17} />
            </Button>
          </div>
        </div>
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Evidencija i pravila</h2>
              <p className="muted">
                {c.lectureHours} P + {c.exerciseHours} V + {c.seminarHours} S ={" "}
                {c.lectureHours + c.exerciseHours + c.seminarHours} sati ·
                Brojanje{" "}
                {c.counting === "DAY" ? "po danu unutar skupine" : "po terminu"}
              </p>
            </div>
            {backupButtons(c.id)}
          </div>
          <div className="actions">
            <Button onClick={() => quickAttendance("PRESENT", c)}>
              <Check size={14} />
              Evidentiraj dolazak
            </Button>
            <Button
              variant="outline"
              onClick={() => quickAttendance("ABSENT", c)}
            >
              <X size={14} />
              Evidentiraj izostanak
            </Button>
            <Button variant="outline" onClick={() => editSession()}>
              <Plus size={14} />
              Dodaj termin
            </Button>
            <Button variant="outline" onClick={() => editGroup(c)}>
              <Settings2 size={14} />
              Nova skupina / pravilo
            </Button>
          </div>
          {c.notes && (
            <p className="alert" style={{ background: "var(--background)" }}>
              {c.notes}
            </p>
          )}
        </div>
        {ss.map((s) => (
          <div className="panel" key={s.group.id}>
            <div className="panel-heading">
              <div>
                <h2>
                  {s.group.name}{" "}
                  <span
                    className={`badge ${s.severity}`}
                    style={{ marginLeft: 8 }}
                  >
                    {s.severity === "unknown"
                      ? "Unesite plan"
                      : s.severity === "danger"
                        ? "Prekoračenje"
                        : s.severity === "limit"
                          ? "Granica"
                          : s.severity === "warning"
                            ? "Oprez"
                            : "Sigurno"}
                  </span>
                </h2>
                <p className="muted">
                  {modeLabels[s.rule.mode]}
                  {["PERCENT", "AND", "OR"].includes(s.rule.mode)
                    ? ` · najmanje ${num(s.rule.minimum)}%`
                    : ""}
                  {["MAX", "MANUAL", "AND", "OR"].includes(s.rule.mode)
                    ? ` · najviše ${s.rule.maximum} izostanaka`
                    : ""}
                  {s.rule.extra
                    ? ` · +${s.rule.extra} dodatnih izostanaka`
                    : ""}
                </p>
              </div>
              <div className="actions">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => editGroup(c, s.group)}
                >
                  Uredi pravila
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Izbriši skupinu"
                  onClick={() => remove("group", s.group.id, s.group.name)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
            <dl className="details-grid">
              {[
                ["Planirane jedinice", s.planned],
                ["Održani dani / termini", s.held],
                ["Evidentirani dolasci", num(s.present)],
                ["Izostanci", num(s.absent)],
                ["Opravdani izostanci", s.excused],
                ["Otkazano / neodržano", s.cancelled],
                ["Trenutna dolaznost", percent(s.current)],
                ["Potrebni dolasci po postotku", s.allowance.required],
                [
                  "Standardno dopušteno",
                  s.allowance.base === null
                    ? "Bez ograničenja"
                    : s.allowance.base,
                ],
                ["Dodatno odobreno", s.rule.extra],
                [
                  "Ukupno dopušteno",
                  s.allowance.total === null
                    ? "Bez ograničenja"
                    : s.allowance.total,
                ],
                [
                  "Preostali izostanci",
                  s.remaining === null ? "Bez ograničenja" : num(s.remaining),
                ],
                ["Preostale planirane jedinice", s.remainingPlanned],
                ["Neevidentirano u prošlosti", s.missing],
                ["Propušteni nastavni sati", num(s.missedHours)],
                ["Projekcija na kraju", percent(s.projected)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="muted" style={{ fontSize: 11, marginTop: 15 }}>
              Projekcija pretpostavlja dolazak na sve preostale i neevidentirane
              termine; nije ostvarena dolaznost. Nepoznati statusi ne ulaze u
              trenutni postotak. Za otkazanu nastavu i izuzete opravdane
              izostanke plan se umanjuje.
            </p>
            {s.incomplete && (
              <p className="alert warning">
                Procjena je nepotpuna: nedostaju termini u rasporedu ili
                evidencija održane nastave. Raspored sadrži {s.scheduledHours}{" "}
                od {s.declaredHours} deklariranih nastavnih sati.
              </p>
            )}
            {s.current !== null && s.rule.mode !== "NONE" && (
              <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                Odstupanje od osnovnog postotka:{" "}
                {num(s.current - s.rule.minimum)} postotnih bodova. Dodatno
                odobreni izostanci ne mijenjaju propisani minimum.
              </p>
            )}
            {d.settings.warnings && s.warning && (
              <p role="alert" className={`alert ${s.severity}`}>
                {s.warning}
              </p>
            )}
            {s.rule.consequence && (
              <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                Posljedica prema vašem unosu: {s.rule.consequence}
              </p>
            )}
            <TrendChart
              rows={s.history.map((h, i, all) => ({
                name: fmt(h.date),
                dolaznost:
                  (all.slice(0, i + 1).reduce((n, r) => n + r.present, 0) /
                    (i + 1)) *
                  100,
              }))}
            />
          </div>
        ))}
        <div className="panel">
          <div className="panel-heading">
            <h2>Sva održavanja nastave</h2>
            <Button variant="outline" size="sm" onClick={() => editSlot()}>
              <Plus size={13} />
              Tjedno ponavljanje
            </Button>
          </div>
          {sessionTable(sessions)}
        </div>
      </>
    );
  }
  function renderCalendar() {
    const date = parseISO(calendarDate);
    const start =
      view === "month"
        ? startOfWeek(startOfMonth(date), { weekStartsOn: 1 })
        : startOfWeek(date, { weekStartsOn: 1 });
    const end =
      view === "month"
        ? endOfWeek(endOfMonth(date), { weekStartsOn: 1 })
        : endOfWeek(date, { weekStartsOn: 1 });
    const dates = eachDayOfInterval({ start, end });
    const sessions = d.sessions.filter((s) =>
      visibleGroupIds.includes(s.groupId),
    );
    const selected = sessions
      .filter((s) => s.date === calendarDate)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Kalendar nastave</h1>
            <p className="muted">
              Planiraj nastavu i evidentiraj svaki dolazak.
            </p>
          </div>
          <Button onClick={() => editSession(undefined, calendarDate)}>
            <Plus size={15} />
            Dodaj termin
          </Button>
        </div>
        <div className="panel calendar-panel">
          <div className="calendar-toolbar">
            <div className="actions">
              <Button
                variant="outline"
                size="icon"
                aria-label="Prethodno razdoblje"
                onClick={() =>
                  setCalendarDate(
                    format(
                      view === "month"
                        ? addMonths(date, -1)
                        : view === "week"
                          ? addWeeks(date, -1)
                          : addDays(date, -1),
                      "yyyy-MM-dd",
                    ),
                  )
                }
              >
                <ChevronLeft size={17} />
              </Button>
              <h2>
                {view === "day"
                  ? fmt(calendarDate)
                  : format(date, "LLLL yyyy.", { locale: hr })}
              </h2>
              <Button
                variant="outline"
                size="icon"
                aria-label="Sljedeće razdoblje"
                onClick={() =>
                  setCalendarDate(
                    format(
                      view === "month"
                        ? addMonths(date, 1)
                        : view === "week"
                          ? addWeeks(date, 1)
                          : addDays(date, 1),
                      "yyyy-MM-dd",
                    ),
                  )
                }
              >
                <ChevronRight size={17} />
              </Button>
            </div>
            <div className="actions">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCalendarDate(today)}
              >
                Danas
              </Button>
              <div className="segmented">
                {(["day", "week", "month"] as const).map((v) => (
                  <button
                    key={v}
                    className={view === v ? "active" : ""}
                    onClick={() => setView(v)}
                  >
                    {v === "day" ? "Dan" : v === "week" ? "Tjedan" : "Mjesec"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {view !== "day" ? (
            <div className="calendar-grid">
              {days.map((n) => (
                <div className="calendar-weekday" key={n}>
                  {n.slice(0, 3)}
                </div>
              ))}
              {dates.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const holiday = d.holidays.find(
                  (h) =>
                    h.date === key &&
                    (!semesterId || h.semesterId === semesterId),
                );
                return (
                  <div
                    key={key}
                    className={`calendar-day ${key === today ? "today" : ""} ${!isSameMonth(day, date) && view === "month" ? "outside" : ""}`}
                  >
                    <button
                      className="calendar-date"
                      onClick={() => {
                        setCalendarDate(key);
                        setView("day");
                      }}
                      aria-label={`Otvori ${fmt(key)}`}
                    >
                      {format(day, "d.")}
                    </button>
                    {holiday && (
                      <small className="text-danger" style={{ fontSize: 9 }}>
                        {holiday.name}
                      </small>
                    )}
                    {sessions
                      .filter((s) => s.date === key)
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                      .map((s) => {
                        const g = d.groups.find((g) => g.id === s.groupId)!;
                        const c = d.courses.find((c) => c.id === g.courseId)!;
                        return (
                          <button
                            className={`calendar-event ${s.state !== "PLANNED" ? "cancelled" : ""}`}
                            key={s.id}
                            onClick={() => {
                              setCalendarDate(key);
                              setView("day");
                            }}
                            title={`${c.name} · ${g.name} · ${s.hours} sata`}
                          >
                            <strong>{s.startTime}</strong> {c.name}
                            <br />
                            {g.type === "ALL" ? "Nastava" : g.name} · {s.hours}{" "}
                            sata
                          </button>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div className="filters">
                <input
                  aria-label="Odaberi datum"
                  type="date"
                  value={calendarDate}
                  onChange={(e) =>
                    e.target.value && setCalendarDate(e.target.value)
                  }
                />
              </div>
              {sessionTable(selected)}
            </>
          )}
        </div>
      </>
    );
  }
  function renderSchedule() {
    const slots = d.slots.filter((s) => visibleGroupIds.includes(s.groupId));
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Tjedni raspored</h1>
            <p className="muted">
              Ponavljanja koja automatski stvaraju kalendar semestra.
            </p>
          </div>
          <Button onClick={() => editSlot()}>
            <Plus size={15} />
            Dodaj ponavljanje
          </Button>
        </div>
        <div className="notice">
          <Info size={18} />
          <p>
            Promjena ponavljanja ažurira samo buduće, neevidentirane i ručno
            neizmijenjene termine. Raniji dolasci i izostanci ostaju sačuvani.
            Brisanje ponavljanja zadržava već generirane termine.
          </p>
        </div>
        {!slots.length ? (
          <div className="panel">
            <Empty
              icon="calendar"
              title="Složite svoj tjedan"
              text="Odaberite kolegij, dan, vrijeme i broj sati. Aplikacija će generirati termine unutar semestra."
              action={
                <Button onClick={() => editSlot()}>
                  Dodaj prvi tjedni termin
                </Button>
              }
            />
          </div>
        ) : (
          <div className="weekday-grid">
            {days.map((day, i) => (
              <div className="weekday-column" key={day}>
                <h3>{day}</h3>
                {slots
                  .filter((s) => s.weekday === i + 1)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((s) => (
                    <div className="slot-card" key={s.id}>
                      <span className="muted">
                        {s.startTime} – {s.endTime}
                      </span>
                      <strong>
                        {
                          d.courses.find(
                            (c) =>
                              c.id ===
                              d.groups.find((g) => g.id === s.groupId)
                                ?.courseId,
                          )?.name
                        }
                      </strong>
                      <p>
                        {d.groups.find((g) => g.id === s.groupId)?.name} ·{" "}
                        {s.hours} sata
                      </p>
                      {s.room && <p className="muted">{s.room}</p>}
                      <small className="muted">
                        {fmt(s.start)} – {fmt(s.end)}
                      </small>
                      <div className="actions" style={{ marginTop: 9 }}>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Uredi ponavljanje"
                          onClick={() => editSlot(s)}
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Osvježi termine"
                          title="Osvježi termine"
                          onClick={() => act({ action: "generate", id: s.id })}
                        >
                          <RefreshCw size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Izbriši ponavljanje"
                          onClick={() => {
                            if (
                              window.confirm(
                                "Izbrisati tjedno ponavljanje? Generirani termini i evidencija ostaju sačuvani.",
                              )
                            )
                              act({
                                action: "delete",
                                entity: "slot",
                                id: s.id,
                                confirm: true,
                              });
                          }}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        )}
      </>
    );
  }
  function renderStatistics() {
    const cs = visibleCourses.filter(
      (c) =>
        (!yearFilter ||
          d.semesters.find((s) => s.id === c.semesterId)?.yearId ===
            yearFilter) &&
        (!statsCourse || c.id === statsCourse),
    );
    const ss = d.groups
      .filter((g) => cs.some((c) => c.id === g.courseId))
      .map((g) => summarize(d, g.id));
    const totalRecorded = ss.reduce((n, s) => n + s.recorded, 0),
      totalPresent = ss.reduce((n, s) => n + s.present, 0);
    const monthly: Record<
      string,
      { present: number; absent: number; count: number }
    > = {};
    for (const s of ss)
      for (const h of s.history) {
        const m = h.date.slice(0, 7);
        monthly[m] ??= { present: 0, absent: 0, count: 0 };
        monthly[m].present += h.present;
        monthly[m].absent += h.absent;
        monthly[m].count++;
      }
    const rows = cs.map((c) => {
      const groups = ss.filter((s) => s.group.courseId === c.id);
      return {
        name: c.name,
        dolaznost: groups.reduce((n, s) => n + s.present, 0),
        izostanci: groups.reduce((n, s) => n + s.absent, 0),
      };
    });
    const sorted = [...rows].sort((a, b) => a.izostanci - b.izostanci);
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Statistika</h1>
            <p className="muted">
              Stvarni dolasci i izostanci, bez pretpostavljanja nepoznatih
              statusa.
            </p>
          </div>
          {backupButtons()}
        </div>
        <div className="filters">
          <select
            aria-label="Akademska godina statistike"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="">Sve akademske godine</option>
            {d.years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Kolegij statistike"
            value={statsCourse}
            onChange={(e) => setStatsCourse(e.target.value)}
          >
            <option value="">Svi kolegiji</option>
            {visibleCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="stats-grid">
          {[
            [
              "Ukupna dolaznost",
              percent(
                totalRecorded ? (totalPresent / totalRecorded) * 100 : null,
              ),
            ],
            ["Ukupno izostanaka", num(ss.reduce((n, s) => n + s.absent, 0))],
            ["Najviše izostanaka", sorted.at(-1)?.name ?? "—"],
            ["Najmanje izostanaka", sorted[0]?.name ?? "—"],
          ].map(([l, v]) => (
            <div className="stat-card" key={l}>
              <p className="muted">{l}</p>
              <strong
                style={{
                  fontSize:
                    l.includes("izostanaka") && l !== "Ukupno izostanaka"
                      ? 15
                      : 26,
                  display: "block",
                  marginTop: 10,
                }}
              >
                {v}
              </strong>
            </div>
          ))}
        </div>
        {!totalRecorded && (
          <div className="notice">
            <Info size={18} />
            <p>
              Još nema evidentirane nastave za odabrane filtre. Grafovi ne
              pretpostavljaju prisutnost na nepoznatim terminima.
            </p>
          </div>
        )}
        <div className="chart-grid">
          <div className="panel">
            <h2>Dolaznost po kolegijima</h2>
            <AttendanceChart rows={rows} />
          </div>
          <div className="panel">
            <h2>Dolaznost po vrstama nastave</h2>
            <AttendanceChart
              rows={["ALL", "P", "V", "S", "OTHER"].map((type) => ({
                name:
                  type === "ALL"
                    ? "Zajednički"
                    : type === "OTHER"
                      ? "Ostalo"
                      : type === "P"
                        ? "Predavanja"
                        : type === "V"
                          ? "Vježbe"
                          : "Seminari",
                dolaznost: ss
                  .filter((s) => s.group.type === type)
                  .reduce((n, s) => n + s.present, 0),
                izostanci: ss
                  .filter((s) => s.group.type === type)
                  .reduce((n, s) => n + s.absent, 0),
              }))}
            />
          </div>
          <div className="panel">
            <h2>Izostanci po mjesecima</h2>
            <AttendanceChart
              rows={Object.entries(monthly)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([m, v]) => ({
                  name: format(parseISO(m + "-01"), "MMM yyyy.", {
                    locale: hr,
                  }),
                  dolaznost: v.present,
                  izostanci: v.absent,
                }))}
            />
          </div>
          <div className="panel">
            <h2>Dolaznost kroz semestar</h2>
            <TrendChart
              rows={Object.entries(monthly)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([m, v]) => ({
                  name: format(parseISO(m + "-01"), "MMM yyyy.", {
                    locale: hr,
                  }),
                  dolaznost: (v.present / v.count) * 100,
                }))}
            />
          </div>
        </div>
        <div className="panel">
          <h2>Usporedba semestara</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Godina / semestar</th>
                  <th>Evidentirano</th>
                  <th>Izostanci</th>
                  <th>Dolaznost</th>
                </tr>
              </thead>
              <tbody>
                {d.semesters
                  .filter(
                    (s) =>
                      (!yearFilter || s.yearId === yearFilter) &&
                      (!semesterId || s.id === semesterId),
                  )
                  .map((s) => {
                    const gs = ss.filter(
                      (g) =>
                        cs.find((c) => c.id === g.group.courseId)
                          ?.semesterId === s.id,
                    );
                    const count = gs.reduce((n, g) => n + g.recorded, 0);
                    return (
                      <tr key={s.id}>
                        <td>
                          {d.years.find((y) => y.id === s.yearId)?.name} ·{" "}
                          {s.name}
                        </td>
                        <td>{count}</td>
                        <td>{num(gs.reduce((n, g) => n + g.absent, 0))}</td>
                        <td>
                          {percent(
                            count
                              ? (gs.reduce((n, g) => n + g.present, 0) /
                                  count) *
                                  100
                              : null,
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <h2>Dolaznost po kolegijima — detalji</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kolegij / skupina</th>
                  <th>Trenutno</th>
                  <th>Izostanci</th>
                  <th>Preostalo</th>
                  <th>Projekcija*</th>
                </tr>
              </thead>
              <tbody>
                {ss.map((s) => (
                  <tr key={s.group.id}>
                    <td>
                      {cs.find((c) => c.id === s.group.courseId)?.name}
                      <small className="muted">{s.group.name}</small>
                    </td>
                    <td>{percent(s.current)}</td>
                    <td>{num(s.absent)}</td>
                    <td>{s.remaining === null ? "∞" : num(s.remaining)}</td>
                    <td>
                      {percent(s.projected)}
                      {s.incomplete ? " · nepotpuno" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <small className="muted">
            * Uz pretpostavku dolaska na sve preostale i neevidentirane termine.
          </small>
        </div>
      </>
    );
  }
  function renderSettings() {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Postavke</h1>
            <p className="muted">Tvoja pravila, akademske godine i podaci.</p>
          </div>
        </div>
        <div className="settings-grid">
          <div>
            <div className="panel">
              <div className="panel-heading">
                <h2>Osobne postavke</h2>
                <Button variant="outline" size="sm" onClick={editSettings}>
                  Uredi
                </Button>
              </div>
              {[
                [
                  "Tema",
                  theme === "dark"
                    ? "Tamna"
                    : theme === "light"
                      ? "Svijetla"
                      : "Prema sustavu",
                ],
                ["Jezik", "Hrvatski"],
                ["Vremenska zona", "Europe/Zagreb"],
                ["Zadana minimalna dolaznost", percent(d.settings.minimum)],
                ["Dodatno dopušteni izostanci", String(d.settings.extra)],
                [
                  "Zadano brojanje",
                  d.settings.counting === "DAY" ? "Po danu" : "Po terminu",
                ],
                [
                  "Djelomična prisutnost",
                  partialOptions.find((p) => p.value === d.settings.partial)
                    ?.label,
                ],
                ["Udio djelomičnog dolaska", num(d.settings.partialWeight)],
                [
                  "Opravdani izostanci",
                  d.settings.excusedCounts
                    ? "Troše izostanke"
                    : "Izuzeti iz izračuna",
                ],
                [
                  "Upozorenja",
                  d.settings.warnings ? "Uključena" : "Isključena",
                ],
              ].map(([l, v]) => (
                <div className="list-row" key={l}>
                  <p className="muted">{l}</p>
                  <p>{v}</p>
                </div>
              ))}
            </div>
            <div className="panel">
              <div className="panel-heading">
                <h2>Sigurnosne kopije i izvoz</h2>
                <ShieldCheck size={18} className="muted" />
              </div>
              <p className="muted" style={{ fontSize: 12, marginBottom: 18 }}>
                Podaci se trajno čuvaju u SQLite bazi na poslužitelju. Preuzmite
                JSON sigurnosnu kopiju prije većih izmjena ili brisanja.
              </p>
              <div className="actions">
                <Button onClick={() => exportJSON(d)}>
                  <Download size={14} />
                  Sigurnosna kopija (JSON)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload size={14} />
                  Uvoz / vraćanje
                </Button>
              </div>
              <div style={{ marginTop: 15 }}>{backupButtons()}</div>
              <p className="muted" style={{ fontSize: 11, marginTop: 15 }}>
                Uvoz provjerava strukturu i veze, traži potvrdu te zamjenjuje
                sve podatke u jednoj transakciji. CSV i PDF izvoze sve termine;
                ponovljeni ID jedinice označava isti dnevni dolazak.
              </p>
              <input
                ref={fileInput}
                hidden
                type="file"
                accept=".json,application/json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (file.size > 4_000_000) {
                    toast.error("Datoteka smije imati najviše 4 MB.");
                    return;
                  }
                  try {
                    const input: unknown = JSON.parse(await file.text());
                    const result = backupSchema.safeParse(input);
                    if (!result.success)
                      throw new Error(
                        "Neispravna sigurnosna kopija. Potreban je JSON iz ove aplikacije, verzija 1.",
                      );
                    if (
                      !window.confirm(
                        `Uvoz će ZAMIJENITI sve podatke s ${result.data.data.courses.length} kolegija iz datoteke. Jeste li preuzeli sigurnosnu kopiju i želite li nastaviti?`,
                      )
                    )
                      return;
                    await mutate({
                      action: "restore",
                      backup: result.data,
                      confirm: true,
                    });
                    setTheme(result.data.data.settings.theme);
                    setSemesterId("");
                    setCourseId(null);
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Uvoz nije uspio.",
                    );
                  }
                }}
              />
            </div>
          </div>
          <div>
            <div className="panel">
              <div className="panel-heading">
                <h2>Akademske godine</h2>
                <Button size="sm" onClick={() => editYear()}>
                  <Plus size={13} />
                  Dodaj
                </Button>
              </div>
              {d.years.length ? (
                d.years.map((y) => (
                  <div className="list-row" key={y.id}>
                    <p>{y.name}</p>
                    <div className="actions">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Uredi godinu"
                        onClick={() => editYear(y)}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Izbriši godinu"
                        onClick={() =>
                          remove(
                            "year",
                            y.id,
                            `godinu ${y.name} i sve povezane semestre`,
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">Još nema akademskih godina.</p>
              )}
            </div>
            <div className="panel">
              <div className="panel-heading">
                <h2>Semestri</h2>
                <Button size="sm" onClick={() => editSemester()}>
                  <Plus size={13} />
                  Dodaj
                </Button>
              </div>
              {d.semesters.length ? (
                d.semesters.map((s) => (
                  <div className="list-row" key={s.id}>
                    <div>
                      <p>
                        <strong>{s.name}</strong> ·{" "}
                        {d.years.find((y) => y.id === s.yearId)?.name}
                      </p>
                      <small className="muted">
                        {fmt(s.start)} – {fmt(s.end)}
                      </small>
                    </div>
                    <div className="actions">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Uredi semestar"
                        onClick={() => editSemester(s)}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Izbriši semestar"
                        onClick={() =>
                          remove("semester", s.id, `semestar ${s.name}`)
                        }
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">Dodajte prvi semestar.</p>
              )}
            </div>
            <div className="panel">
              <div className="panel-heading">
                <h2>Praznici i neradni dani</h2>
                <Button variant="outline" size="sm" onClick={editHoliday}>
                  <Plus size={13} />
                  Dodaj
                </Button>
              </div>
              {d.holidays.length ? (
                d.holidays
                  .filter((h) => !semesterId || h.semesterId === semesterId)
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((h) => (
                    <div className="list-row" key={h.id}>
                      <div>
                        <p>{h.name}</p>
                        <small className="muted">
                          {fmt(h.date)} ·{" "}
                          {d.semesters.find((s) => s.id === h.semesterId)?.name}
                        </small>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Izbriši praznik"
                        onClick={() => remove("holiday", h.id, h.name)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))
              ) : (
                <p className="muted">Nema unesenih praznika.</p>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }
  return (
    <div className="app">
      <button
        aria-label="Zatvori navigaciju"
        className={`backdrop ${menu ? "visible" : ""}`}
        onClick={() => setMenu(false)}
      />
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <button
          className="brand"
          style={{ border: 0, background: "none", color: "inherit" }}
          onClick={() => navigate("dashboard")}
        >
          <span className="brand-mark">
            <GraduationCap size={24} />
          </span>
          dolaznost<span style={{ color: "var(--primary)" }}>.</span>
        </button>
        <div className="brand-sub">TVOJ STUDENTSKI PLANER</div>
        <div className="eyebrow nav-label">Radni prostor</div>
        <nav aria-label="Glavna navigacija">
          {pages.map((p) => (
            <button
              key={p.id}
              className={`nav-item ${page === p.id || (page === "detail" && p.id === "courses") ? "active" : ""}`}
              onClick={() => navigate(p.id)}
              aria-current={page === p.id ? "page" : undefined}
            >
              <p.icon />
              {p.label}
              {p.id === "courses" && d.courses.length > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 10 }}>
                  {d.courses.length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <ShieldCheck
              size={20}
              style={{ color: "var(--primary)", marginBottom: 7 }}
            />
            <strong style={{ display: "block", marginBottom: 4 }}>
              Mali pregled. Velika sigurnost.
            </strong>
            <p className="muted">
              Provjeri dolaznost danas i mirnije planiraj ostatak semestra.
            </p>
          </div>
          <div className="profile">
            <div className="avatar">S</div>
            <div>
              <strong style={{ fontSize: 12 }}>Studentski prostor</strong>
              <p className="muted" style={{ fontSize: 10 }}>
                Osobna evidencija
              </p>
            </div>
            <CheckCircle2
              size={16}
              style={{ marginLeft: "auto", color: "#27a66c" }}
            />
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <Button
            variant="ghost"
            size="icon"
            className="mobile-menu"
            aria-label="Otvori navigaciju"
            onClick={() => setMenu(true)}
          >
            <Menu size={21} />
          </Button>
          <div className="search-box">
            <Search size={17} />
            <input
              aria-label="Pretraži kolegije"
              placeholder="Pretraži svoje kolegije…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (page !== "dashboard" && page !== "courses")
                  navigate("courses");
              }}
            />
          </div>
          <div className="topbar-right">
            <select
              aria-label="Odaberi semestar"
              value={semesterId}
              onChange={(e) => setSemesterId(e.target.value)}
            >
              <option value="">Svi semestri</option>
              {d.semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {d.years.find((y) => y.id === s.yearId)?.name}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Promijeni temu"
              onClick={() => {
                const next = theme === "dark" ? "light" : "dark";
                setTheme(next);
                act({
                  action: "settings",
                  value: { ...d.settings, theme: next } as Settings,
                });
              }}
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Otvori upozorenja"
              onClick={() => navigate("dashboard")}
            >
              <Bell size={18} />
              {d.settings.warnings && warnings.length > 0 && (
                <span className="badge danger" style={{ padding: "0 4px" }}>
                  {warnings.length}
                </span>
              )}
            </Button>
            {d.authEnabled && (
              <form action="/api/auth/logout" method="post">
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  aria-label="Odjavi se"
                >
                  <LogOut size={18} />
                </Button>
              </form>
            )}
            <div className="avatar" aria-label="Studentski prostor">
              S
            </div>
          </div>
        </header>
        <div className="content">
          {currentSemester && (
            <div className="eyebrow" style={{ marginBottom: 16 }}>
              {currentSemester.name} ·{" "}
              {d.years.find((y) => y.id === currentSemester.yearId)?.name}
            </div>
          )}
          {page === "dashboard"
            ? renderDashboard()
            : page === "courses"
              ? renderCourses()
              : page === "detail"
                ? renderDetail()
                : page === "calendar"
                  ? renderCalendar()
                  : page === "schedule"
                    ? renderSchedule()
                    : page === "statistics"
                      ? renderStatistics()
                      : renderSettings()}
          <footer className="footer">
            Dolaznost · Tvoj prostor za organiziraniji semestar · Europe/Zagreb
            <br />
            Osobna evidencija prema unesenim pravilima kolegija.
          </footer>
        </div>
      </main>
      {modal && (
        <FormDialog
          key={modal.title + JSON.stringify(modal.initial)}
          config={modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
function Empty({
  title,
  text,
  action,
  icon = "book",
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
  icon?: "book" | "calendar";
}) {
  const Icon = icon === "book" ? BookOpen : CalendarDays;
  return (
    <div className="empty">
      <Icon size={36} strokeWidth={1.3} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

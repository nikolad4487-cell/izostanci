import type { Data } from "./types";
import { statusLabels } from "./types";
import { summarize } from "./attendance";
export function download(
  content: string | Blob,
  name: string,
  type = "application/json",
) {
  const blob =
    typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportJSON(data: Data) {
  download(
    JSON.stringify(
      { version: 1, exportedAt: new Date().toISOString(), data },
      null,
      2,
    ),
    `dolaznost-sigurnosna-kopija-${new Date().toISOString().slice(0, 10)}.json`,
  );
}
export function rowsForExport(data: Data, courseId?: string) {
  return data.sessions
    .filter(
      (s) =>
        !courseId ||
        data.groups.find((g) => g.id === s.groupId)?.courseId === courseId,
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
    )
    .map((s) => {
      const g = data.groups.find((g) => g.id === s.groupId)!;
      const c = data.courses.find((c) => c.id === g.courseId)!;
      const a = data.attendance.find((a) => a.unitId === s.unitId);
      return [
        c.name,
        g.name,
        s.date,
        s.startTime,
        s.endTime,
        String(s.hours),
        s.state === "CANCELLED"
          ? "Nastava otkazana"
          : s.state === "NOT_HELD"
            ? "Nastava nije održana"
            : a
              ? statusLabels[a.status]
              : "Nije evidentirano",
        s.unitId,
        a?.note ?? "",
      ];
    });
}
export function exportCSV(data: Data, courseId?: string) {
  const rows = [
    [
      "Kolegij",
      "Skupina",
      "Datum",
      "Početak",
      "Završetak",
      "Nastavni sati",
      "Status",
      "Evidencijska jedinica (ne zbrajati ponovljene ID-eve)",
      "Napomena",
    ],
    ...rowsForExport(data, courseId),
  ];
  const cell = (s: string) =>
    '"' + (/^[=+@\-\t\r]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"';
  download(
    "\ufeff" + rows.map((r) => r.map(cell).join(";")).join("\r\n"),
    "evidencija.csv",
    "text/csv;charset=utf-8",
  );
}
export async function exportPDF(data: Data, courseId?: string) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape" });
  const res = await fetch("/fonts/DejaVuSans.ttf");
  if (!res.ok) throw new Error("Nije moguće učitati font za PDF.");
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  doc.addFileToVFS("DejaVuSans.ttf", btoa(binary));
  doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  doc.setFont("DejaVu");
  doc.setFontSize(18);
  doc.text("Evidencija dolaznosti", 14, 18);
  doc.setFontSize(9);
  doc.text(
    "Brojanje se temelji na evidencijskim jedinicama, ne na nastavnim satima. Vremenska zona: Europe/Zagreb.",
    14,
    26,
  );
  const summaries = data.groups
    .filter((g) => !courseId || g.courseId === courseId)
    .map((g) => {
      const s = summarize(data, g.id);
      return [
        data.courses.find((c) => c.id === g.courseId)!.name,
        g.name,
        String(s.planned),
        String(s.absent),
        s.remaining === null ? "Bez ograničenja" : String(s.remaining),
      ];
    });
  autoTable(doc, {
    startY: 32,
    head: [["Kolegij", "Skupina", "Termini", "Izostanci", "Preostalo"]],
    body: summaries,
    styles: { font: "DejaVu", fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.addPage();
  doc.setFontSize(14);
  doc.text(
    "Pojedinačni termini — isti ID jedinice broji se samo jednom",
    14,
    18,
  );
  autoTable(doc, {
    startY: 25,
    head: [
      [
        "Kolegij",
        "Skupina",
        "Datum",
        "Od",
        "Do",
        "Sati",
        "Status",
        "Jedinica",
        "Napomena",
      ],
    ],
    body: rowsForExport(data, courseId),
    styles: { font: "DejaVu", fontSize: 7 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save("evidencija-dolaznosti.pdf");
}

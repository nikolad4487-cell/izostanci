import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import type { Data, Session } from "../src/lib/types";
import { fixture } from "./fixtures";
let db: (typeof import("../src/lib/db"))["db"];
let store: typeof import("../src/lib/store");
let post: (typeof import("../src/app/api/data/route"))["POST"];
const dir = mkdtempSync(join(tmpdir(), "dolaznost-test-"));
beforeAll(async () => {
  process.env.TURSO_DATABASE_URL = "";
  process.env.TURSO_AUTH_TOKEN = "";
  process.env.APP_PASSWORD = "";
  process.env.VERCEL = "";
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`;
  execFileSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"],
    { env: process.env, stdio: "pipe" },
  );
  ({ db } = await import("../src/lib/db"));
  store = await import("../src/lib/store");
  ({ POST: post } = await import("../src/app/api/data/route"));
  const d = fixture();
  d.sessions = [];
  d.units = [];
  await store.restore({ version: 1, data: d });
});
afterAll(async () => {
  await db?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});
async function action(payload: Record<string, unknown>) {
  return post(
    new NextRequest("http://localhost:3000/api/data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify(payload),
    }),
  );
}
async function ok(payload: Record<string, unknown>): Promise<Data> {
  const r = await action(payload);
  const body = await r.json();
  expect(r.status, JSON.stringify(body)).toBe(200);
  return body;
}
describe.sequential("SQLite, API, raspored i sigurnosne kopije", () => {
  it("generira ponavljanje bez praznika i ponovljena generacija je idempotentna", async () => {
    await ok({
      action: "holiday",
      value: {
        id: "h",
        semesterId: "sem",
        name: "Praznik",
        date: "2026-10-08",
      },
    });
    const slot = {
      id: "slot",
      groupId: "g",
      weekday: 4,
      startTime: "09:00",
      endTime: "12:00",
      hours: 4,
      room: "A1",
      start: "2026-10-01",
      end: "2026-11-12",
    };
    const d = await ok({ action: "slot", value: slot });
    expect(d.sessions).toHaveLength(6);
    expect(d.sessions.some((s) => s.date === "2026-10-08")).toBe(false);
    const again = await ok({ action: "generate", id: "slot" });
    expect(again.sessions).toHaveLength(6);
    expect(again.units).toHaveLength(6);
  });
  it("9: promjena rasporeda ne briše stare dolaske i izostanke", async () => {
    const d = await store.getData();
    const s = d.sessions.find((s) => s.date === "2026-10-01")!;
    await ok({
      action: "attendance",
      value: { id: "a", unitId: s.unitId, status: "ABSENT", note: "Sačuvaj" },
    });
    const edited = await ok({
      action: "slot",
      value: {
        ...d.slots[0],
        startTime: "10:00",
        endTime: "13:00",
        weekday: 5,
      },
    });
    expect(edited.attendance.find((a) => a.unitId === s.unitId)).toMatchObject({
      status: "ABSENT",
      note: "Sačuvaj",
    });
    expect(edited.sessions.find((x) => x.id === s.id)?.startTime).toBe("09:00");
    expect(edited.sessions.some((x) => x.date === "2026-11-06")).toBe(true);
  });
  it("10: dva termina istog dana upotrebljavaju jednu jedinicu u bazi", async () => {
    const d = await store.getData();
    const s = d.sessions.find((s) => s.date === "2026-10-01")!;
    const next = await ok({
      action: "session",
      value: {
        ...s,
        id: "second",
        slotId: null,
        originalDate: null,
        startTime: "14:00",
        endTime: "15:30",
        hours: 2,
      },
    });
    expect(next.sessions.find((s) => s.id === "second")?.unitId).toBe(s.unitId);
    expect(next.units.filter((u) => u.date === "2026-10-01")).toHaveLength(1);
  });
  it("premještanje jedinog evidentiranog termina čuva njegov status", async () => {
    const d = await store.getData();
    const base = d.sessions.find((s) => s.id === "second")!;
    const moved: Session = {
      ...base,
      id: "move",
      slotId: null,
      originalDate: null,
      date: "2026-10-20",
    };
    const created = await ok({ action: "session", value: moved });
    const original = created.sessions.find((s) => s.id === "move")!;
    await ok({
      action: "attendance",
      value: {
        id: "amove",
        unitId: original.unitId,
        status: "PRESENT",
        note: "Premješteno",
      },
    });
    const updated = await ok({
      action: "session",
      value: { ...original, date: "2026-10-21" },
    });
    const target = updated.sessions.find((s) => s.id === "move")!;
    expect(
      updated.attendance.find((a) => a.unitId === target.unitId),
    ).toMatchObject({ status: "PRESENT", note: "Premješteno" });
    expect(updated.units.some((u) => u.id === original.unitId)).toBe(false);
  });
  it("uređivanje kolegija i pravila čuva evidenciju", async () => {
    const before = await store.getData();
    await ok({
      action: "course",
      value: { ...before.courses[0], name: "Osnove ekonomije" },
    });
    await ok({
      action: "group",
      value: before.groups[0],
      rule: { ...before.rules[0], minimum: 90, extra: 1 },
    });
    const after = await store.getData();
    expect(after.attendance).toEqual(before.attendance);
    expect(after.rules[0]).toMatchObject({ minimum: 90, extra: 1 });
  });
  it("buduća i otkazana nastava odbija evidenciju", async () => {
    const d = await store.getData();
    const future = d.sessions.find((s) => s.date === "2026-11-06")!;
    expect(
      (
        await action({
          action: "attendance",
          value: {
            id: "afuture",
            unitId: future.unitId,
            status: "ABSENT",
            note: "",
          },
        })
      ).status,
    ).toBe(400);
    await ok({ action: "session", value: { ...future, state: "CANCELLED" } });
    expect(
      (
        await action({
          action: "attendance",
          value: {
            id: "afuture",
            unitId: future.unitId,
            status: "ABSENT",
            note: "",
          },
        })
      ).status,
    ).toBe(400);
  });
  it("JSON kružni uvoz čuva sve relacije i zapise", async () => {
    const before = await store.getData();
    await ok({
      action: "restore",
      backup: JSON.parse(JSON.stringify({ version: 1, data: before })),
      confirm: true,
    });
    const after = await store.getData();
    for (const key of Object.keys(before) as (keyof Data)[]) {
      expect(JSON.stringify(after[key])).toBe(JSON.stringify(before[key]));
    }
  });
  it("neispravni uvoz, duple jedinice i uvoz bez potvrde ne mijenjaju bazu", async () => {
    const before = await store.getData();
    const bad = structuredClone(before);
    bad.courses[0].semesterId = "missing";
    expect(
      (
        await action({
          action: "restore",
          backup: { version: 1, data: bad },
          confirm: true,
        })
      ).status,
    ).toBe(400);
    const duplicate = structuredClone(before);
    duplicate.units.push({ ...duplicate.units[0], id: "duplicate" });
    const s = duplicate.sessions[0];
    duplicate.sessions.push({
      ...s,
      id: "duplicate-session",
      slotId: null,
      unitId: "duplicate",
    });
    expect(
      (
        await action({
          action: "restore",
          backup: { version: 1, data: duplicate },
          confirm: true,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await action({
          action: "restore",
          backup: { version: 1, data: before },
        })
      ).status,
    ).toBe(400);
    expect((await store.getData()).attendance).toEqual(before.attendance);
  });
  it("promjena načina brojanja razdvaja i ponovno objedinjuje postojeće statuse bez gubitka", async () => {
    const before = await store.getData();
    let d = await ok({
      action: "course",
      value: { ...before.courses[0], counting: "SESSION" },
    });
    const sameDay = d.sessions.filter((s) => s.date === "2026-10-01");
    expect(new Set(sameDay.map((s) => s.unitId)).size).toBe(2);
    expect(
      sameDay.every(
        (s) =>
          d.attendance.find((a) => a.unitId === s.unitId)?.status === "ABSENT",
      ),
    ).toBe(true);
    await ok({
      action: "attendance",
      value: {
        id: "conflict",
        unitId: sameDay[1].unitId,
        status: "PRESENT",
        note: "Drugi status",
      },
    });
    expect(
      (
        await action({
          action: "course",
          value: { ...before.courses[0], counting: "DAY" },
        })
      ).status,
    ).toBe(400);
    expect((await store.getData()).courses[0].counting).toBe("SESSION");
    await ok({
      action: "attendance",
      value: {
        id: "conflict",
        unitId: sameDay[1].unitId,
        status: "ABSENT",
        note: "Druga napomena",
      },
    });
    d = await ok({
      action: "course",
      value: { ...before.courses[0], counting: "DAY" },
    });
    expect(d.units.filter((u) => u.date === "2026-10-01")).toHaveLength(1);
    const unit = d.units.find((u) => u.date === "2026-10-01")!;
    expect(d.attendance.find((a) => a.unitId === unit.id)?.note).toContain(
      "Druga napomena",
    );
    store.validateRelations(d);
  });
  it("brisanje kolegija zahtijeva potvrdu, a zatim briše povezane zapise", async () => {
    expect(
      (await action({ action: "delete", entity: "course", id: "c" })).status,
    ).toBe(400);
    const d = await ok({
      action: "delete",
      entity: "course",
      id: "c",
      confirm: true,
    });
    expect(d.courses).toHaveLength(0);
    expect(d.attendance).toHaveLength(0);
    expect(d.sessions).toHaveLength(0);
    expect(d.years).toHaveLength(1);
  });
  it("mutacije s drugog web-izvora su odbijene", async () => {
    const r = await post(
      new NextRequest("http://localhost:3000/api/data", {
        method: "POST",
        headers: {
          origin: "https://other.example",
          host: "localhost:3000",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "examples", semesterId: "sem" }),
      }),
    );
    expect(r.status).toBe(403);
  });
});

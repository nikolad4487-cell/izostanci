import { it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import { deployDatabase } from "../scripts/deploy-db.mjs";
it("Vercel migracija priprema cijelu bazu i ponavljanje čuva postojeće podatke", async () => {
  const dir = mkdtempSync(join(tmpdir(), "dolaznost-migration-"));
  const url = `file:${join(dir, "test.db")}`;
  const db = new PrismaClient({ adapter: new PrismaLibSQL({ url }) });
  try {
    await deployDatabase({ url });
    await db.academicYear.create({
      data: { id: "persist", name: "2026./2027." },
    });
    await deployDatabase({ url });
    expect(await db.academicYear.count()).toBe(1);
    expect(
      await db.userSettings.create({ data: { id: "default" } }),
    ).toMatchObject({ minimum: 80 });
    const c = createClient({ url });
    try {
      const applied = await c.execute('SELECT * FROM "_AppMigration"');
      expect(applied.rows).toHaveLength(1);
    } finally {
      c.close();
    }
  } finally {
    await db.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  }
});

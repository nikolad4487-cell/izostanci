import { it, expect } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { deployDatabase } from "../scripts/deploy-db.mjs";
import { createTestDatabase } from "../scripts/test-db.mjs";
it("PostgreSQL migracije čuvaju podatke, izoliraju shemu i uključuju RLS", async () => {
  const isolated = await createTestDatabase();
  const db = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: isolated.connectionString },
      { schema: "dolaznost" },
    ),
  });
  const c = new pg.Pool({
    connectionString: isolated.connectionString,
    max: 1,
  });
  try {
    await db.academicYear.create({
      data: { id: "persist", name: "2026./2027." },
    });
    await deployDatabase({ connectionString: isolated.connectionString });
    expect(await db.academicYear.count()).toBe(1);
    expect(
      await db.userSettings.create({ data: { id: "default" } }),
    ).toMatchObject({ minimum: 80 });
    const applied = await c.query('SELECT * FROM "dolaznost"."_AppMigration"');
    expect(applied.rows).toHaveLength(2);
    const tables = await c.query(
      "SELECT relname,relrowsecurity FROM pg_class JOIN pg_namespace ON pg_namespace.oid=relnamespace WHERE nspname='dolaznost' AND relkind='r'",
    );
    expect(tables.rows.length).toBeGreaterThan(10);
    expect(tables.rows.every((r) => r.relrowsecurity)).toBe(true);
    const role = `dolaznost_anon_${randomUUID().replaceAll("-", "")}`;
    const client = await c.connect();
    try {
      await client.query("BEGIN");
      await client.query(`CREATE ROLE "${role}" NOLOGIN`);
      await client.query(`GRANT USAGE ON SCHEMA "dolaznost" TO "${role}"`);
      await client.query(
        `GRANT SELECT ON "dolaznost"."AcademicYear" TO "${role}"`,
      );
      await client.query(`SET LOCAL ROLE "${role}"`);
      expect(
        (await client.query('SELECT * FROM "dolaznost"."AcademicYear"')).rows,
      ).toHaveLength(0);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }

    expect(
      (
        await c.query(
          "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name='AcademicYear'",
        )
      ).rows[0].n,
    ).toBe(0);
  } finally {
    await db.$disconnect();
    await c.end();
    await isolated.dispose();
  }
});
it("neuspjela PostgreSQL migracija atomarno vraća izmjene i ne dira postojeću evidenciju", async () => {
  const isolated = await createTestDatabase();
  const dir = mkdtempSync(join(tmpdir(), "dolaznost-bad-migration-"));
  mkdirSync(join(dir, "0003_failed"));
  writeFileSync(
    join(dir, "0003_failed/migration.sql"),
    'CREATE TABLE "dolaznost"."TemporaryChange" (id TEXT); SELECT * FROM "dolaznost"."NonexistentTable";',
  );
  const c = new pg.Pool({
    connectionString: isolated.connectionString,
    max: 1,
  });
  try {
    await c.query(
      'INSERT INTO "dolaznost"."AcademicYear" (id,name) VALUES ($1,$2)',
      ["saved", "2026./2027."],
    );
    await expect(
      deployDatabase({
        connectionString: isolated.connectionString,
        folder: dir,
      }),
    ).rejects.toThrow();
    expect(
      (
        await c.query(
          "SELECT to_regclass('dolaznost.\"TemporaryChange\"') AS name",
        )
      ).rows[0].name,
    ).toBeNull();
    expect(
      (await c.query('SELECT * FROM "dolaznost"."AcademicYear"')).rows,
    ).toHaveLength(1);
  } finally {
    await c.end();
    await isolated.dispose();
    rmSync(dir, { recursive: true, force: true });
  }
});
it("odbijena je izmjena već primijenjene PostgreSQL migracije", async () => {
  const isolated = await createTestDatabase();
  const dir = mkdtempSync(join(tmpdir(), "dolaznost-checksum-"));
  mkdirSync(join(dir, "0001_postgresql"));
  const sql = readFileSync(
    new URL(
      "../prisma/migrations/0001_postgresql/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  writeFileSync(
    join(dir, "0001_postgresql/migration.sql"),
    sql + "\n-- promjena",
  );
  try {
    await expect(
      deployDatabase({
        connectionString: isolated.connectionString,
        folder: dir,
      }),
    ).rejects.toThrow("izmijenjena");
  } finally {
    await isolated.dispose();
    rmSync(dir, { recursive: true, force: true });
  }
});

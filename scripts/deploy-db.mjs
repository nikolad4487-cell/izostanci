import "dotenv/config";
import pg from "pg";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
export async function deployDatabase({
  connectionString,
  folder = fileURLToPath(new URL("../prisma/migrations/", import.meta.url)),
}) {
  let protocol;
  try {
    protocol = new URL(connectionString).protocol;
  } catch {
    throw new Error(
      "Postavite ispravan PostgreSQL connection string u DATABASE_URL ili DIRECT_URL.",
    );
  }
  if (protocol !== "postgresql:" && protocol !== "postgres:")
    throw new Error("Baza mora biti PostgreSQL (postgresql://).");
  const pool = new pg.Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 15000,
  });
  let client;
  const applied = [];
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '30s'");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('dolaznost-migrations'))",
    );
    await client.query('CREATE SCHEMA IF NOT EXISTS "dolaznost"');
    await client.query(
      'CREATE TABLE IF NOT EXISTS "dolaznost"."_AppMigration" ("name" TEXT PRIMARY KEY NOT NULL, "checksum" TEXT NOT NULL, "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)',
    );
    await client.query(
      'ALTER TABLE "dolaznost"."_AppMigration" ENABLE ROW LEVEL SECURITY',
    );
    for (const name of readdirSync(folder)
      .filter((n) => /^\d+_/.test(n))
      .sort()) {
      const sql = readFileSync(`${folder}/${name}/migration.sql`, "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const previous = await client.query(
        'SELECT "checksum" FROM "dolaznost"."_AppMigration" WHERE "name"=$1',
        [name],
      );
      if (previous.rows.length) {
        if (previous.rows[0].checksum !== checksum)
          throw new Error(`Migracija ${name} izmijenjena je nakon primjene.`);
        continue;
      }
      await client.query(sql);
      await client.query(
        'INSERT INTO "dolaznost"."_AppMigration" ("name","checksum") VALUES ($1,$2)',
        [name, checksum],
      );
      applied.push(name);
    }
    await client.query("COMMIT");
    for (const name of applied) console.log(`Primijenjena migracija: ${name}`);
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      "Za db:deploy postavite DATABASE_URL; opcionalno DIRECT_URL za migracije.",
    );
    process.exit(1);
  }
  await deployDatabase({ connectionString });
}

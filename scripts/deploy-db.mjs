import "dotenv/config";
import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
export async function deployDatabase(config) {
  const client = createClient(config);
  try {
    await client.execute(
      'CREATE TABLE IF NOT EXISTS "_AppMigration" ("name" TEXT PRIMARY KEY NOT NULL, "checksum" TEXT NOT NULL, "appliedAt" TEXT NOT NULL)',
    );
    const folder = fileURLToPath(
      new URL("../prisma/migrations/", import.meta.url),
    );
    for (const name of readdirSync(folder)
      .filter((n) => /^\d+_/.test(n))
      .sort()) {
      const sql = readFileSync(`${folder}/${name}/migration.sql`, "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const tx = await client.transaction("write");
      try {
        const previous = await tx.execute({
          sql: 'SELECT "checksum" FROM "_AppMigration" WHERE "name" = ?',
          args: [name],
        });
        if (previous.rows.length) {
          if (previous.rows[0].checksum !== checksum)
            throw new Error(`Migracija ${name} izmijenjena je nakon primjene.`);
          await tx.commit();
          continue;
        }
        await tx.executeMultiple(sql);
        await tx.execute({
          sql: 'INSERT INTO "_AppMigration" ("name","checksum","appliedAt") VALUES (?,?,?)',
          args: [name, checksum, new Date().toISOString()],
        });
        await tx.commit();
        console.log(`Primijenjena migracija: ${name}`);
      } catch (error) {
        await tx.rollback();
        throw error;
      } finally {
        tx.close();
      }
    }
  } finally {
    client.close();
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    console.error(
      "Za db:deploy postavite TURSO_DATABASE_URL i TURSO_AUTH_TOKEN.",
    );
    process.exit(1);
  }
  await deployDatabase({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

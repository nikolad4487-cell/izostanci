import pg from "pg";
import { randomUUID } from "node:crypto";
import { deployDatabase } from "./deploy-db.mjs";
export async function createTestDatabase() {
  // DATABASE_URL se namjerno ne čita: testovi ne smiju koristiti korisničku bazu.
  const base =
    process.env.TEST_DATABASE_URL ||
    "postgresql://dolaznost:dolaznost_local@127.0.0.1:54329/dolaznost";
  const name = `dolaznost_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Pool({
    connectionString: base,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  let created = false;
  async function dispose() {
    try {
      if (created) {
        await admin.query(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",
          [name],
        );
        await admin.query(`DROP DATABASE "${name}"`);
        created = false;
      }
    } finally {
      await admin.end();
    }
  }
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    const url = new URL(base);
    url.pathname = `/${name}`;
    const connectionString = url.href;
    await deployDatabase({ connectionString });
    return { connectionString, dispose };
  } catch (error) {
    await dispose().catch(() => {});
    throw error;
  }
}

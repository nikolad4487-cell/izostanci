import "dotenv/config";
import { execFileSync } from "node:child_process";
const required = ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "APP_PASSWORD"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(
    `U Vercel Environment Variables dodajte: ${missing.join(", ")}. Zatim pokrenite Redeploy.`,
  );
  process.exit(1);
}
if (
  !/^(libsql|https):\/\//.test(process.env.TURSO_DATABASE_URL) ||
  process.env.APP_PASSWORD.length < 16
) {
  console.error(
    "TURSO_DATABASE_URL mora biti udaljeni libsql:// ili https:// URL; APP_PASSWORD mora imati najmanje 16 znakova.",
  );
  process.exit(1);
}
execFileSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "generate"],
  { stdio: "inherit" },
);
execFileSync(process.execPath, ["scripts/deploy-db.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
  stdio: "inherit",
});

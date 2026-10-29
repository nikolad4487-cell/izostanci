import "dotenv/config";
import { execFileSync } from "node:child_process";
const missing = ["DATABASE_URL", "APP_PASSWORD"].filter(
  (name) => !process.env[name],
);
if (missing.length) {
  console.error(
    `U Vercel Environment Variables dodajte: ${missing.join(", ")}. DATABASE_URL je PostgreSQL veza iz Supabase Connect (ne Project URL/anon ključ). Zatim pokrenite Redeploy.`,
  );
  process.exit(1);
}
function postgresUrl(value) {
  try {
    return ["postgres:", "postgresql:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
if (
  !postgresUrl(process.env.DATABASE_URL) ||
  (process.env.DIRECT_URL && !postgresUrl(process.env.DIRECT_URL)) ||
  process.env.APP_PASSWORD.length < 16
) {
  console.error(
    "DATABASE_URL i opcionalni DIRECT_URL moraju biti PostgreSQL connection stringovi; APP_PASSWORD mora imati najmanje 16 znakova.",
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

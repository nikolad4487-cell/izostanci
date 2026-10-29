import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawn } from "node:child_process";
const dir = mkdtempSync(join(tmpdir(), "dolaznost-browser-"));
const env = {
  ...process.env,
  APP_PASSWORD: "e2e-local-test-password-2026",
  TURSO_DATABASE_URL: "",
  TURSO_AUTH_TOKEN: "",
  VERCEL: "",
  DATABASE_URL: `file:${join(dir, "browser.db")}`,
};
execFileSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"],
  { env, stdio: "inherit" },
);
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3100",
  ],
  { env, stdio: "inherit" },
);
let stopping = false;
function stop() {
  if (!stopping) {
    stopping = true;
    child.kill("SIGTERM");
  }
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => {
  rmSync(dir, { recursive: true, force: true });
  process.exit(stopping ? 0 : (code ?? 1));
});

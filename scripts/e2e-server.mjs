import { spawn } from "node:child_process";
import { createTestDatabase } from "./test-db.mjs";
const isolated = await createTestDatabase();
const env = {
  ...process.env,
  APP_PASSWORD: "e2e-local-test-password-2026",
  VERCEL: "",
  DATABASE_URL: isolated.connectionString,
  DIRECT_URL: "",
};
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
child.on("exit", async (code) => {
  await isolated.dispose();
  process.exit(stopping ? 0 : (code ?? 1));
});

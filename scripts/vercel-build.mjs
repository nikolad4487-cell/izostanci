import "dotenv/config";
import { execFileSync } from "node:child_process";
import { deploymentEnvErrors } from "./deployment-env.mjs";
const errors = deploymentEnvErrors();
if (errors.length) {
  console.error(
    "Provjerite Vercel → Settings → Environment Variables (Production):",
  );
  for (const error of errors) console.error(`- ${error}`);
  console.error(
    "Nakon spremanja pokrenite Redeploy najnovijeg commita. Vrijednosti lozinki i URL-ova nisu ispisane.",
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

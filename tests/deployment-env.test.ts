import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { deploymentEnvErrors } from "../scripts/deployment-env.mjs";
const valid = {
  DATABASE_URL:
    "postgresql://postgres.project:test-password@pooler.example:5432/postgres?sslmode=verify-full",
  APP_PASSWORD: "test-app-password-2026",
};
describe("Jasne i sigurne Vercel konfiguracijske pogreške", () => {
  it("prihvaća Session pooler i opcionalni DIRECT_URL", () => {
    expect(deploymentEnvErrors(valid)).toEqual([]);
    expect(
      deploymentEnvErrors({
        ...valid,
        DATABASE_URL: valid.DATABASE_URL.replace("5432", "6543"),
        DIRECT_URL: valid.DATABASE_URL,
      }),
    ).toEqual([]);
    expect(deploymentEnvErrors({ ...valid, DIRECT_URL: "" })).toEqual([]);
  });
  it("kratku lozinku prijavljuje kao problem APP_PASSWORD, bez krivog upozorenja za bazu", () => {
    const errors = deploymentEnvErrors({ ...valid, APP_PASSWORD: "short" });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^APP_PASSWORD:/);
    expect(errors[0]).toContain("16");
    expect(errors[0]).not.toContain("short");
  });
  it("razlikuje pogrešan DATABASE_URL od pogrešnog DIRECT_URL", () => {
    expect(
      deploymentEnvErrors({
        ...valid,
        DATABASE_URL: "https://project.supabase.co",
      }),
    ).toEqual([expect.stringMatching(/^DATABASE_URL:/)]);
    expect(
      deploymentEnvErrors({
        ...valid,
        DIRECT_URL: "https://project.supabase.co",
      }),
    ).toEqual([expect.stringMatching(/^DIRECT_URL:/)]);
  });
  it.each([
    '"postgresql://user:secret@db.example/postgres"',
    "DATABASE_URL=postgresql://user:secret@db.example/postgres",
    " postgresql://user:secret@db.example/postgres",
  ])("prepoznaje navodnike, prefiks i razmake u vrijednosti", (value) => {
    expect(deploymentEnvErrors({ ...valid, DATABASE_URL: value })[0]).toContain(
      "bez navodnika",
    );
  });
  it("navodi sve nedostajuće ili pogrešne varijable bez njihovih vrijednosti", () => {
    expect(deploymentEnvErrors({})).toHaveLength(2);
    const env = {
      DATABASE_URL: "https://private-url-sentinel.example",
      DIRECT_URL: "https://direct-secret-sentinel.example",
      APP_PASSWORD: "secret-short",
    };
    const output = deploymentEnvErrors(env).join("\n");
    expect(output).toContain("DATABASE_URL:");
    expect(output).toContain("DIRECT_URL:");
    expect(output).toContain("APP_PASSWORD:");
    for (const value of Object.values(env)) expect(output).not.toContain(value);
  });
  it("build prekida prije migracija i ispisuje samo precizne upute", () => {
    let output = "";
    let status = 0;
    try {
      execFileSync(process.execPath, ["scripts/vercel-build.mjs"], {
        env: {
          ...process.env,
          DATABASE_URL: "https://sentinel-secret.example",
          DIRECT_URL: "",
          APP_PASSWORD: "short",
        },
        stdio: "pipe",
      });
    } catch (error) {
      const failure = error as { status: number; stderr: Buffer };
      status = failure.status;
      output = failure.stderr.toString();
    }
    expect(status).toBe(1);
    expect(output).toContain("DATABASE_URL:");
    expect(output).toContain("APP_PASSWORD:");
    expect(output).not.toContain("sentinel-secret");
    expect(output).not.toContain("Primijenjena migracija");
  });
});

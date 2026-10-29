import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
process.env.DATABASE_URL ||=
  "postgresql://dolaznost:dolaznost_local@127.0.0.1:54329/dolaznost";
// Generiranje i provjera sheme koriste JS engine. Bazu priprema db:deploy.
export default defineConfig({
  schema: "prisma/schema.prisma",
  experimental: { adapter: true },
  engine: "js",
  adapter: async () =>
    new PrismaPg(
      {
        connectionString:
          process.env.DIRECT_URL ||
          process.env.DATABASE_URL ||
          "postgresql://dolaznost:dolaznost_local@127.0.0.1:54329/dolaznost",
        max: 1,
      },
      { schema: "dolaznost" },
    ),
});

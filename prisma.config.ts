import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
// db:push je namijenjen lokalnom razvoju. Vercel koristi db:deploy s verzioniranim migracijama.
export default defineConfig({
  schema: "prisma/schema.prisma",
  experimental: { adapter: true },
  engine: "js",
  adapter: async () =>
    new PrismaLibSQL({
      url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
    }),
});

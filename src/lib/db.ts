import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export const db =
  globalDb.prisma ??
  new PrismaClient({
    adapter: new PrismaLibSQL({
      url:
        process.env.TURSO_DATABASE_URL ||
        process.env.DATABASE_URL ||
        "file:./prisma/dev.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
  });
if (process.env.NODE_ENV !== "production") globalDb.prisma = db;

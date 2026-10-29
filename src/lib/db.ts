import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export const db =
  globalDb.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(
      {
        connectionString:
          process.env.DATABASE_URL ||
          "postgresql://dolaznost:dolaznost_local@127.0.0.1:54329/dolaznost",
        max: 3,
        connectionTimeoutMillis: 15000,
        idleTimeoutMillis: 30000,
      },
      { schema: "dolaznost" },
    ),
  });
if (process.env.NODE_ENV !== "production") globalDb.prisma = db;

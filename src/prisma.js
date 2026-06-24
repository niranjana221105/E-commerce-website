/**
 * Prisma Client Singleton
 *
 * Why a singleton?
 * PrismaClient opens a connection pool to the database.
 * Creating multiple instances (e.g. one per request) wastes connections.
 * In dev, hot-reload can create many instances — the global trick prevents that.
 */

const { PrismaClient } = require("@prisma/client");

// In production, always create a fresh client.
// In development, reuse the existing global instance across hot reloads.
const prisma =
  global.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

module.exports = prisma;

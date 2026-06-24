/**
 * Vercel Serverless Entry Point
 * Exports the Express app as a serverless function.
 * Vercel handles the HTTP server — we just export the app.
 */

const express = require("express");
const path    = require("path");
const prisma  = require("../src/prisma");
const productsRouter = require("../src/routes/products");
const adminRouter    = require("../src/routes/admin");
const errorHandler   = require("../src/middleware/errorHandler");

const app = express();

app.use(express.json());

// Serve static files from src/public
app.use(express.static(path.join(__dirname, "../src/public")));

// Health check
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "error", message: "Database unreachable" });
  }
});

app.use("/products",  productsRouter);
app.use("/admin/api", adminRouter);

// Admin panel page
app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "../src/public/admin.html"));
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use(errorHandler);

module.exports = app;

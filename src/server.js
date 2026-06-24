/**
 * Express Server Entry Point
 */

const express = require("express");
const path = require("path");
const prisma = require("./prisma");
const productsRouter = require("./routes/products");
const adminRouter    = require("./routes/admin");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json());

// Serve static frontend
app.use(express.static(path.join(__dirname, "public")));

// Basic request logger (replace with a proper logger like pino in prod)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/health", async (_req, res) => {
  try {
    // Lightweight DB liveness check
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "error", message: "Database unreachable" });
  }
});

app.use("/products", productsRouter);
app.use("/admin/api", adminRouter);

// Serve admin panel
app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// 404 handler for unmatched routes
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Error handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────

async function start() {
  try {
    await prisma.$connect();
    console.log("✅ Database connected");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log(`   Products: http://localhost:${PORT}/products`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received — closing database connection");
  await prisma.$disconnect();
  process.exit(0);
});

start();

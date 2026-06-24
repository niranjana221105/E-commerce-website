/**
 * Central Error Handler Middleware
 *
 * Express calls this when next(err) is called from any route.
 * Keeping error formatting in one place ensures a consistent API response shape.
 */

const { Prisma } = require("@prisma/client");

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, err);

  // Prisma known request errors (e.g. record not found, unique constraint)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Product not found" });
    }
    return res.status(400).json({ error: "Database request error", code: err.code });
  }

  // Prisma validation errors (e.g. invalid data types)
  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({ error: "Invalid data provided" });
  }

  // Custom application errors with a status code
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  // Fallback: unexpected server error
  res.status(500).json({ error: "Internal server error" });
}

module.exports = errorHandler;

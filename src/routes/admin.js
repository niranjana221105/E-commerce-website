/**
 * Admin Routes
 * Protected by a simple API-key header (X-Admin-Key).
 * In production, replace with proper JWT/session auth.
 */

const { Router } = require("express");
const { body, query, validationResult } = require("express-validator");
const prisma = require("../prisma");

const router = Router();

const ADMIN_KEY = process.env.ADMIN_KEY || "admin123";

// ─── Auth middleware ───────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const key = req.headers["x-admin-key"] || req.query.adminKey;
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

router.use(requireAdmin);

// ─── GET /admin/stats ──────────────────────────────────────────────────────────
router.get("/stats", async (_req, res, next) => {
  try {
    const [totalProducts, categoryBreakdown] = await Promise.all([
      prisma.product.count(),
      prisma.product.groupBy({
        by: ["category"],
        _count: { id: true },
        _avg:   { price: true },
        _min:   { price: true },
        _max:   { price: true },
        orderBy: { _count: { id: "desc" } },
      }),
    ]);

    res.json({
      totalProducts,
      categoryBreakdown: categoryBreakdown.map(c => ({
        category: c.category,
        count:    c._count.id,
        avgPrice: parseFloat((c._avg.price || 0).toFixed(2)),
        minPrice: parseFloat(c._min.price || 0),
        maxPrice: parseFloat(c._max.price || 0),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /admin/products ───────────────────────────────────────────────────────
router.get("/products", async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page)  || 1);
    const limit    = Math.min(50, parseInt(req.query.limit) || 20);
    const category = req.query.category || undefined;
    const search   = req.query.search   || "";
    const skip     = (page - 1) * limit;

    const where = {
      ...(category ? { category } : {}),
      ...(search   ? { name: { contains: search, mode: "insensitive" } } : {}),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products: products.map(p => ({
        ...p,
        price: parseFloat(p.price),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /admin/products/:id ────────────────────────────────────────────────
router.delete("/products/:id", async (req, res, next) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── GET /admin/orders ─────────────────────────────────────────────────────────
// Orders are stored client-side in localStorage, so this endpoint
// accepts a POST with the orders array and returns enriched analytics.
router.post("/orders/sync", async (req, res) => {
  // Just echo back with server timestamp — real app would persist these
  const orders = Array.isArray(req.body.orders) ? req.body.orders : [];
  const revenue  = orders.reduce((s, o) => s + (o.total || 0), 0);
  const statuses = {};
  orders.forEach(o => {
    const s = o.status || "ordered";
    statuses[s] = (statuses[s] || 0) + 1;
  });
  res.json({ count: orders.length, revenue: +revenue.toFixed(2), statuses, orders });
});

module.exports = router;

/**
 * Products Router
 *
 * Routes:
 *   GET  /products        — list products (cursor paginated, optional category filter)
 *   POST /products        — create a product
 *   PATCH /products/:id   — update a product (bumps updatedAt automatically)
 *
 * Pagination Strategy — Keyset / Cursor Pagination:
 * ─────────────────────────────────────────────────
 * We sort by (updatedAt DESC, id DESC). The `id` tiebreaker is critical:
 * two products can share the same updatedAt timestamp (especially after bulk
 * updates). Without a secondary sort key, the boundary between pages is
 * ambiguous — products can be duplicated or skipped.
 *
 * The WHERE clause for "next page" is:
 *   (updated_at, id) < (cursor.updatedAt, cursor.id)
 *   i.e.: updated_at < cursor_date
 *      OR (updated_at = cursor_date AND id < cursor_id)
 *
 * This is a strict less-than on the composite key, so:
 * - If 50 new/updated products appear BEFORE the current page (newer updatedAt),
 *   they shift into earlier pages. The current cursor is unaffected — we still
 *   land in exactly the right spot.
 * - If products are updated AFTER the cursor position, they move to earlier
 *   pages and won't appear again on later pages.
 * → No duplicates. No skips.
 */

const { Router } = require("express");
const { body, query, param, validationResult } = require("express-validator");
const { v4: uuidv4 } = require("uuid");
const prisma = require("../prisma");
const { encodeCursor, decodeCursor } = require("../lib/cursor");

const router = Router();

const VALID_CATEGORIES = [
  "Electronics",
  "Books",
  "Clothing",
  "Home",
  "Sports",
  "Beauty",
  "Toys",
  "Automotive",
  "Garden",
  "Food & Grocery",
  "Health",
  "Music",
  "Office",
  "Pets",
  "Travel",
];
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ─── Validation helpers ────────────────────────────────────────────────────────

/** Extracts express-validator errors and throws a 400 if any exist. */
function assertValid(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new Error(errors.array()[0].msg);
    err.status = 400;
    throw err;
  }
}

// ─── GET /products ─────────────────────────────────────────────────────────────

router.get(
  "/",
  [
    query("limit")
      .optional()
      .isInt({ min: 1, max: MAX_LIMIT })
      .withMessage(`limit must be an integer between 1 and ${MAX_LIMIT}`)
      .toInt(),
    query("cursor").optional().isString().withMessage("cursor must be a string"),
    query("category")
      .optional()
      .isIn(VALID_CATEGORIES)
      .withMessage(`category must be one of: ${VALID_CATEGORIES.join(", ")}`),
  ],
  async (req, res, next) => {
    try {
      assertValid(req);

      const limit = req.query.limit ?? DEFAULT_LIMIT;
      const { cursor: rawCursor, category } = req.query;

      // Decode the opaque cursor into { updatedAt, id } or null (first page)
      const cursor = decodeCursor(rawCursor);

      // If a cursor string was provided but failed to decode, it's malformed
      if (rawCursor && !cursor) {
        return res.status(400).json({ error: "Invalid cursor" });
      }

      /**
       * Build the WHERE clause.
       *
       * Keyset condition for page > 1:
       *   (updatedAt < cursor.updatedAt)
       *   OR (updatedAt = cursor.updatedAt AND id < cursor.id)
       *
       * Prisma doesn't natively support OR across composite fields with
       * inequalities, so we use a raw condition via `AND`/`OR` nesting.
       *
       * The composite index (updatedAt DESC, id DESC) — or
       * (category, updatedAt DESC, id DESC) when filtering — allows Postgres
       * to evaluate this condition as an index range scan, not a filter
       * on top of a full sort.
       */
      const cursorWhere = cursor
        ? {
            OR: [
              // All rows with an older updatedAt
              { updatedAt: { lt: cursor.updatedAt } },
              // Same updatedAt, but smaller id (lexicographic order on UUID)
              { updatedAt: { equals: cursor.updatedAt }, id: { lt: cursor.id } },
            ],
          }
        : {};

      const categoryWhere = category ? { category } : {};

      const where = { ...categoryWhere, ...cursorWhere };

      // Fetch limit + 1 so we know whether a next page exists
      const products = await prisma.product.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        select: {
          id: true,
          name: true,
          category: true,
          price: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // If we got limit+1 results, there IS a next page
      const hasNextPage = products.length > limit;
      if (hasNextPage) products.pop(); // remove the probe item

      // Build the cursor from the LAST item on this page
      const nextCursor =
        hasNextPage && products.length > 0
          ? encodeCursor(products[products.length - 1].updatedAt, products[products.length - 1].id)
          : null;

      res.json({
        products: products.map(formatProduct),
        nextCursor,
        // Convenience metadata (not required by spec but useful for clients)
        meta: {
          count: products.length,
          hasNextPage,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /products ────────────────────────────────────────────────────────────

router.post(
  "/",
  [
    body("name").trim().notEmpty().withMessage("name is required"),
    body("category")
      .isIn(VALID_CATEGORIES)
      .withMessage(`category must be one of: ${VALID_CATEGORIES.join(", ")}`),
    body("price")
      .isFloat({ min: 0 })
      .withMessage("price must be a non-negative number")
      .toFloat(),
  ],
  async (req, res, next) => {
    try {
      assertValid(req);

      const { name, category, price } = req.body;

      const product = await prisma.product.create({
        data: {
          id: uuidv4(), // explicit UUID so it's consistent with cursor logic
          name: name.trim(),
          category,
          price,
        },
      });

      res.status(201).json(formatProduct(product));
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /products/:id ───────────────────────────────────────────────────────

router.patch(
  "/:id",
  [
    param("id").isUUID().withMessage("id must be a valid UUID"),
    body("name").optional().trim().notEmpty().withMessage("name cannot be empty"),
    body("category")
      .optional()
      .isIn(VALID_CATEGORIES)
      .withMessage(`category must be one of: ${VALID_CATEGORIES.join(", ")}`),
    body("price")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("price must be a non-negative number")
      .toFloat(),
  ],
  async (req, res, next) => {
    try {
      assertValid(req);

      const { id } = req.params;
      const { name, category, price } = req.body;

      // Build only the fields that were actually sent
      const data = {};
      if (name !== undefined) data.name = name.trim();
      if (category !== undefined) data.category = category;
      if (price !== undefined) data.price = price;

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: "No fields to update" });
      }

      /**
       * updatedAt is automatically set by Prisma's @updatedAt.
       * This means a PATCH moves the product to the TOP of the sorted list,
       * which is the expected behaviour for "newest first" ordering.
       * The cursor for any in-progress pagination session remains valid
       * because it only cares about items that come AFTER the cursor position.
       */
      const product = await prisma.product.update({
        where: { id },
        data,
      });

      res.json(formatProduct(product));
    } catch (err) {
      next(err);
    }
  }
);

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalize a Prisma product record for API output.
 * Converts Decimal to number and formats dates as ISO strings.
 */
function formatProduct(product) {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    price: parseFloat(product.price), // Prisma returns Decimal object
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

module.exports = router;

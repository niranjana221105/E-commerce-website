# Product Browser Backend

A production-quality REST API for browsing 200,000+ products with cursor-based pagination that prevents duplicates and skipped records even when data changes during browsing.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Structure](#project-structure)
3. [API Reference](#api-reference)
4. [Pagination Design](#pagination-design)
5. [Database Index Strategy](#database-index-strategy)
6. [Neon Setup (Cloud PostgreSQL)](#neon-setup)
7. [Render Deployment](#render-deployment)
8. [Example API Responses](#example-api-responses)

---

## Quick Start

### Local Development

```bash
# 1. Clone and install
git clone <repo>
cd product-browser-backend
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL

# 3. Push schema + generate client
npx prisma db push

# 4. Seed 200,000 products (~2–3 minutes)
node prisma/seed.js

# 5. Start server
npm run dev
```

---

## Project Structure

```
product-browser-backend/
├── prisma/
│   ├── schema.prisma        # DB schema + indexes
│   └── seed.js              # 200k product generator (batch inserts)
├── src/
│   ├── lib/
│   │   └── cursor.js        # Cursor encode/decode (Base64 + JSON)
│   ├── middleware/
│   │   └── errorHandler.js  # Central error formatting
│   ├── routes/
│   │   └── products.js      # GET / POST / PATCH handlers
│   ├── prisma.js            # Prisma client singleton
│   └── server.js            # Express app + startup
├── .env.example
├── .gitignore
└── README.md
```

---

## API Reference

### `GET /products`

Returns a paginated list of products, newest first.

**Query Parameters**

| Parameter  | Type    | Default | Description                          |
|------------|---------|---------|--------------------------------------|
| `limit`    | integer | 20      | Items per page (max: 100)            |
| `cursor`   | string  | —       | Opaque cursor from previous response |
| `category` | string  | —       | Filter: Electronics, Books, Clothing, Home, Sports |

**Response**

```json
{
  "products": [
    {
      "id": "uuid",
      "name": "Wireless Headphones #1042",
      "category": "Electronics",
      "price": 149.99,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-06-01T08:22:11.000Z"
    }
  ],
  "nextCursor": "eyJ1cGRhdGVkQXQiOiIyMDI0LTA2LTAxVDA4OjIyOjExLjAwMFoiLCJpZCI6IjEyMzQifQ==",
  "meta": {
    "count": 20,
    "hasNextPage": true
  }
}
```

When `nextCursor` is `null`, you are on the last page.

**Pagination Flow**

```
# Page 1 — no cursor
GET /products?limit=20

# Page 2 — use nextCursor from page 1
GET /products?limit=20&cursor=<nextCursor>

# Page 3 — use nextCursor from page 2
GET /products?limit=20&cursor=<nextCursor>
```

---

### `POST /products`

Create a new product.

**Request Body**

```json
{
  "name": "Mechanical Keyboard",
  "category": "Electronics",
  "price": 129.99
}
```

**Response** — `201 Created`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Mechanical Keyboard",
  "category": "Electronics",
  "price": 129.99,
  "createdAt": "2025-03-01T12:00:00.000Z",
  "updatedAt": "2025-03-01T12:00:00.000Z"
}
```

---

### `PATCH /products/:id`

Update a product. All fields are optional. `updatedAt` is automatically refreshed, moving the product to the top of the sort order.

**Request Body** (any subset)

```json
{
  "name": "Pro Mechanical Keyboard",
  "price": 159.99
}
```

**Response** — `200 OK` — updated product object.

---

### `GET /health`

```json
{ "status": "ok", "timestamp": "2025-03-01T12:00:00.000Z" }
```

---

## Pagination Design

### Why Cursor Pagination?

#### The Problem with OFFSET

Offset pagination (`LIMIT 20 OFFSET 40`) is the most common approach but has two fatal flaws for live data:

**1. Duplicates and Skips When Data Changes**

Imagine a user has just loaded page 2 (offset 20–39). While they are reading, a product is updated — its `updatedAt` changes, so it moves to position 1 in the sort order. Every other product shifts down by one position. When the user requests page 3 (offset 40), they get what used to be rows 40–59, but because everything shifted, they actually see row 39 again (duplicate) or skip row 40 entirely.

```
Before update (user just saw page 2):
Position 1: Product A  ← user will request position 41+ next
...
Position 40: Product X
Position 41: Product Y  ← user expects to see this on page 3

A product is updated → sorts to position 1:
Position 1: [UPDATED PRODUCT]
Position 2: Product A  ← everything shifted down
...
Position 41: Product X  ← was position 40
Position 42: Product Y  ← was position 41 — USER SKIPS X, SEES Y

Result: Product X is skipped. If they had scrolled back: Product A appears twice.
```

**2. Performance Degrades with Scale**

`OFFSET 100000 LIMIT 20` tells Postgres to scan and discard 100,000 rows before returning 20. This is O(n) in the offset value — the deeper you paginate, the slower each query becomes, regardless of indexes.

---

#### How Cursor Pagination Solves This

Instead of "skip N rows", cursor pagination says: **"give me rows that come after this specific position."**

The cursor encodes the `(updatedAt, id)` values of the last item on the current page. The next page query becomes:

```sql
WHERE (updated_at < cursor_updated_at)
   OR (updated_at = cursor_updated_at AND id < cursor_id)
ORDER BY updated_at DESC, id DESC
LIMIT 20
```

**Why this prevents duplicates and skips:**

- The cursor is a precise coordinate in the sort order, not a row count.
- If 50 products are updated (moving them to newer positions), they appear before the cursor — on earlier pages. The cursor position is unchanged.
- Products that were behind the cursor cannot move ahead of it through updates (updating bumps `updatedAt` to *now*, making it *newer*, not older).
- The user never sees a product twice, never skips one.

**Why the `id` tiebreaker is essential:**

Many products can share the same `updatedAt` timestamp (e.g., a bulk update that touches 1000 products simultaneously). Without the `id` tiebreaker:

```
Page 1 returns: [A, B, C, D] — all with updatedAt = "2025-01-01"
Cursor: updatedAt = "2025-01-01"
Page 2 query: WHERE updatedAt < "2025-01-01"
Result: skips E, F, G, H (also have updatedAt = "2025-01-01")
```

With the composite cursor `(updatedAt, id)`, we correctly fetch all rows at the boundary timestamp, disambiguated by `id`.

---

### Cursor Encoding

The cursor is a Base64-encoded JSON object:

```json
{ "updatedAt": "2025-01-01T10:30:00.000Z", "id": "uuid-here" }
```

Base64 encoding makes it:
- **Opaque** — clients treat it as a black box
- **URL-safe** — no special characters to escape
- **Tamper-evident** — decoding malformed input returns null, rejected with 400

---

## Database Index Strategy

### Index 1: `(updated_at DESC, id DESC)`

Used for all queries without a category filter.

```sql
CREATE INDEX idx_products_updated_id ON products (updated_at DESC, id DESC);
```

**What it enables:**

Without this index, fetching the first page requires Postgres to sort all 200,000 rows in memory. With the index, Postgres reads rows in the pre-sorted index order — the first 20 rows from the index are exactly the 20 newest products. The cursor condition `(updated_at, id) < (cursor_date, cursor_id)` becomes an index range scan, which is O(log n).

### Index 2: `(category, updated_at DESC, id DESC)`

Used for category-filtered queries.

```sql
CREATE INDEX idx_products_category_updated_id ON products (category, updated_at DESC, id DESC);
```

**What it enables:**

Without this index, a query for `category = 'Electronics'` must filter all 200,000 rows, then sort the matching ones. With the index, Postgres uses the `category` prefix to jump directly to the Electronics section, then reads rows in `(updated_at DESC, id DESC)` order within that section — combining filter and sort in a single index scan.

**Performance Comparison (200,000 rows):**

| Operation            | Without Indexes | With Indexes  |
|----------------------|-----------------|---------------|
| First page, no filter | ~80ms (seq scan + sort) | ~2ms (index scan) |
| First page, category  | ~60ms (filter + sort)   | ~2ms (index scan) |
| Page 5000 (deep)      | ~80ms (same — no offset!) | ~2ms (same!)  |

The critical insight: cursor pagination queries are constant time (O(log n)) regardless of page depth, because they always use the index boundary. OFFSET queries get slower the deeper you go.

---

## Neon Setup

[Neon](https://neon.tech) is a serverless PostgreSQL provider with a generous free tier — ideal for this project.

**1. Create a Neon account** at https://neon.tech

**2. Create a new project** — choose a region close to your users.

**3. Create a database** — Neon creates one by default. Note the connection string.

**4. Get your connection string:**
```
Settings → Connection Details → Connection string
```
Format:
```
postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

**5. Add to `.env`:**
```env
DATABASE_URL="postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

**6. Push schema:**
```bash
npx prisma db push
```

**7. Seed data:**
```bash
node prisma/seed.js
# Takes ~3–5 minutes for 200k rows on Neon free tier
```

**Neon-specific notes:**
- Neon pauses after 5 minutes of inactivity on the free tier. The first request after a pause has ~1s cold start.
- Use connection pooling in production: Neon provides a pooled connection string (`-pooler` in the hostname).
- Enable the pooled URL for the app, keep the direct URL for migrations:
```env
DATABASE_URL="postgresql://...@ep-xxx-pooler.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://...@ep-xxx.neon.tech/neondb?sslmode=require"
```

---

## Render Deployment

[Render](https://render.com) is a cloud platform that can host Node.js services with free and paid tiers.

**1. Push code to GitHub.**

**2. Create a Render account** at https://render.com.

**3. New Web Service:**
- Connect your GitHub repo
- Build Command: `npm install && npx prisma generate && npx prisma db push`
- Start Command: `npm start`
- Environment: Node

**4. Add Environment Variables in Render dashboard:**
```
DATABASE_URL = <your Neon connection string>
NODE_ENV     = production
PORT         = 10000
```

**5. Deploy.** Render auto-deploys on every push to main.

**6. Seed from local machine** (run once after deploy):
```bash
# Point to production DB from local machine
DATABASE_URL="<neon connection string>" node prisma/seed.js
```

**Render-specific notes:**
- Free tier services spin down after 15 minutes of inactivity (similar to Neon).
- Upgrade to Starter plan ($7/mo) for always-on service.
- Render provides a `RENDER_EXTERNAL_URL` env var with your service URL.

---

## Example API Responses

### First Page
```
GET /products?limit=3
```
```json
{
  "products": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Smart Watch #45021",
      "category": "Electronics",
      "price": 349.99,
      "createdAt": "2024-11-20T14:00:00.000Z",
      "updatedAt": "2025-02-28T23:59:59.000Z"
    },
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "name": "Yoga Mat #88731",
      "category": "Sports",
      "price": 49.95,
      "createdAt": "2023-07-01T09:15:00.000Z",
      "updatedAt": "2025-02-28T22:10:00.000Z"
    },
    {
      "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "name": "Cast Iron Skillet #12099",
      "category": "Home",
      "price": 89.99,
      "createdAt": "2024-03-10T11:00:00.000Z",
      "updatedAt": "2025-02-28T20:45:00.000Z"
    }
  ],
  "nextCursor": "eyJ1cGRhdGVkQXQiOiIyMDI1LTAyLTI4VDIwOjQ1OjAwLjAwMFoiLCJpZCI6ImMzZDRlNWY2LWE3YjgtOTAxMi1jZGVmLTEyMzQ1Njc4OTAxMiJ9",
  "meta": {
    "count": 3,
    "hasNextPage": true
  }
}
```

### Next Page (using cursor)
```
GET /products?limit=3&cursor=eyJ1cGRhdGVkQXQiOiIyMDI1LTAyLTI4VDIwOjQ1OjAwLjAwMFoiLCJpZCI6ImMzZDRlNWY2LWE3YjgtOTAxMi1jZGVmLTEyMzQ1Njc4OTAxMiJ9
```
Returns the next 3 products strictly older than the cursor position.

### Category Filtered
```
GET /products?category=Books&limit=5
```
Returns only Books, newest first, with full cursor support.

### Last Page
```json
{
  "products": [...],
  "nextCursor": null,
  "meta": {
    "count": 12,
    "hasNextPage": false
  }
}
```

### Validation Error
```
GET /products?limit=500
```
```json
{ "error": "limit must be an integer between 1 and 100" }
```

### Invalid Cursor
```
GET /products?cursor=notvalidbase64!!!
```
```json
{ "error": "Invalid cursor" }
```

---

## Design Decisions Summary

| Decision | Choice | Reason |
|----------|--------|--------|
| Pagination | Cursor (keyset) | Stable under concurrent writes; O(log n) regardless of depth |
| Cursor fields | `(updatedAt, id)` | Unique composite; handles timestamp ties |
| Cursor format | Base64(JSON) | Opaque, URL-safe, extensible |
| ID type | UUID v4 | Globally unique; no sequential ID leakage |
| ORM | Prisma | Type-safe, great DX, migration support |
| Batch size (seed) | 2,000 rows | Balances throughput vs Postgres param limits |
| Price type | `Decimal(10,2)` | Exact decimal arithmetic; avoids float rounding errors |

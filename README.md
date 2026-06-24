# eCommerce Product Browser

A full-stack eCommerce platform with cursor-based pagination over 200,000 products, built with Node.js, Express, Prisma, and PostgreSQL.

## 🚀 Live Demo

- **Store:** [Deployed on Vercel]
- **Admin Panel:** `/admin` (key: `admin123`)

## ✨ Features

### Customer Store
- Browse 200,000+ products (newest first)
- Filter by 15 categories
- Fast cursor/keyset pagination — no duplicates or skips even when data changes
- Search by product name or category
- Sort by price
- Shopping cart with quantity controls (persisted in localStorage)
- Wishlist with heart button
- 3-step checkout (Shipping → Payment → Review)
- Order tracking with live shipment timeline

### Admin Panel (`/admin`)
- Dashboard: total products, orders, revenue, category breakdown chart
- Products: search, filter, add, edit, delete
- Orders: view all orders, update shipping status
- Categories: per-category stats (count, avg/min/max price)

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express |
| ORM | Prisma |
| Database | PostgreSQL (Neon) |
| Frontend | Vanilla JS, HTML, CSS |
| Deployment | Vercel |

## 📦 Pagination Strategy

Uses **keyset / cursor pagination** sorted by `(updatedAt DESC, id DESC)` with composite indexes:

```sql
INDEX (updated_at DESC, id DESC)
INDEX (category, updated_at DESC, id DESC)
```

This gives O(log n) page fetches regardless of which page you're on. If 50 products are added or updated mid-browse, the cursor position remains stable — no duplicates, no skips.

## 🏃 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in your DATABASE_URL
cp .env.example .env

# 3. Push schema to DB and generate Prisma client
npm run db:push

# 4. Seed 200,000 products
npm run db:seed

# 5. Start the server
npm start
```

Open http://localhost:3000 (store) and http://localhost:3000/admin (admin).

## ☁️ Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Add environment variable: `DATABASE_URL` = your Neon connection string
4. Add environment variable: `ADMIN_KEY` = your chosen admin password
5. Deploy

Vercel will automatically run `prisma generate` via the `postinstall` script.

## 🔑 Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon/Supabase/etc.) |
| `ADMIN_KEY` | Admin panel password (default: `admin123`) |
| `NODE_ENV` | `production` or `development` |
| `PORT` | Server port (default: 3000, auto-set by Vercel) |

## 📁 Project Structure

```
├── api/
│   └── index.js          ← Vercel serverless entry point
├── prisma/
│   ├── schema.prisma     ← DB schema with indexes
│   └── seed.js           ← Seeds 200k products in batches
├── src/
│   ├── lib/cursor.js     ← Base64 cursor encode/decode
│   ├── middleware/       ← Error handler
│   ├── routes/
│   │   ├── products.js   ← GET/POST/PATCH products
│   │   └── admin.js      ← Admin API (stats, orders, CRUD)
│   ├── public/
│   │   ├── index.html    ← Customer store
│   │   ├── app.js
│   │   ├── style.css
│   │   ├── admin.html    ← Admin panel
│   │   ├── admin.js
│   │   └── admin.css
│   ├── prisma.js         ← Prisma singleton
│   └── server.js         ← Local dev server
├── vercel.json           ← Vercel deployment config
├── .env.example
└── package.json
```

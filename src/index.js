// 1 OF 1 store — Cloudflare Worker.
// Serves the site from static assets and handles the order API under /api/*.
// Bindings (wrangler.jsonc): ASSETS (the site), DB (D1 "oneofone-store").
// Secret set in the dashboard: ADMIN_PASSWORD.

const STATUSES = ["new", "confirmed", "delivered", "cancelled"];
const FIRST_ORDER_DISCOUNT = 0.15; // 15% off a customer's first order (by phone number)

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

function isAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const real = env.ADMIN_PASSWORD || "";
  if (!real || given.length !== real.length) return false;
  let diff = 0;
  for (let i = 0; i < real.length; i++) diff |= real.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

async function loadCatalog(request, env) {
  const r = await env.ASSETS.fetch(new URL("/products.json", request.url));
  const d = await r.json();
  const byId = {};
  d.categories.forEach(c => c.items.forEach(it => { byId[it.id] = it; }));
  return byId;
}

// Works out the price for a bag: subtotal from products.json, minus 15% if this
// phone number has never ordered before (cancelled orders don't count).
async function price(request, env, ids, phone) {
  const catalog = await loadCatalog(request, env);
  const items = ids.map(id => catalog[id]).filter(it => it && !it.sold)
    .map(it => ({ id: it.id, brand: it.brand, name: it.name, price: it.price }));
  const subtotal = items.reduce((s, i) => s + i.price, 0);
  let firstOrder = false;
  if (phone) {
    const prev = await env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE phone = ? AND status != 'cancelled'").bind(phone).first();
    firstOrder = !prev || prev.n === 0;
  }
  const discount = firstOrder ? Math.round(subtotal * FIRST_ORDER_DISCOUNT) : 0;
  return { items, subtotal, discount, total: subtotal - discount, firstOrder };
}

async function quote(request, env) {
  let b; try { b = await request.json(); } catch { b = {}; }
  const phone = String(b.phone || "").replace(/\D/g, "");
  const ids = Array.isArray(b.items) ? [...new Set(b.items.map(String))].slice(0, 20) : [];
  const q = await price(request, env, ids, phone.length >= 9 ? phone : "");
  return json({ ok: true, subtotal: q.subtotal, discount: q.discount, total: q.total, firstOrder: q.firstOrder });
}

// Customer places an order. Prices come from products.json on the server.
async function createOrder(request, env) {
  let b;
  try { b = await request.json(); } catch { return json({ ok: false, error: "Bad request" }, 400); }
  const name = String(b.name || "").trim().slice(0, 80);
  const phone = String(b.phone || "").replace(/\D/g, "");
  const delivery = String(b.delivery || "").slice(0, 80);
  const note = String(b.note || "").trim().slice(0, 400);
  const ids = Array.isArray(b.items) ? [...new Set(b.items.map(String))].slice(0, 20) : [];
  if (name.length < 2) return json({ ok: false, error: "Name required" }, 400);
  if (phone.length < 9 || phone.length > 15) return json({ ok: false, error: "Invalid phone" }, 400);
  if (!ids.length) return json({ ok: false, error: "Bag is empty" }, 400);

  const q = await price(request, env, ids, phone);
  if (!q.items.length) return json({ ok: false, error: "These pieces are no longer available" }, 409);
  const token = crypto.randomUUID().replace(/-/g, "");
  const res = await env.DB.prepare(
    "INSERT INTO orders (name, phone, delivery, note, items, subtotal_aed, discount_aed, total_aed, token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(name, phone, delivery, note, JSON.stringify(q.items), q.subtotal, q.discount, q.total, token).run();
  return json({ ok: true, id: res.meta.last_row_id, token, subtotal: q.subtotal, discount: q.discount, total: q.total });
}

// Customer's own orders. The browser keeps each order's private token from checkout,
// so only that browser can read them back (no one can look up orders by phone number).
async function myOrders(request, env) {
  let b; try { b = await request.json(); } catch { b = {}; }
  const refs = Array.isArray(b.orders) ? b.orders.slice(0, 100) : [];
  const out = [];
  for (const r of refs) {
    const id = Number(r && r.id), token = String((r && r.token) || "");
    if (!Number.isInteger(id) || !/^[a-f0-9]{32}$/.test(token)) continue;
    const row = await env.DB.prepare(
      "SELECT id, created_at, items, subtotal_aed, discount_aed, total_aed, status, delivery FROM orders WHERE id = ? AND token = ?"
    ).bind(id, token).first();
    if (row) out.push(row);
  }
  out.sort((a, b) => b.id - a.id);
  return json({ ok: true, orders: out });
}

async function listOrders(request, env) {
  if (!isAdmin(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);
  const { results } = await env.DB.prepare("SELECT id, created_at, name, phone, delivery, note, items, subtotal_aed, discount_aed, total_aed, status FROM orders ORDER BY id DESC LIMIT 500").all();
  return json({ ok: true, orders: results });
}

async function setStatus(request, env, id) {
  if (!isAdmin(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);
  let b; try { b = await request.json(); } catch { b = {}; }
  if (!Number.isInteger(id) || !STATUSES.includes(b.status)) return json({ ok: false, error: "Bad request" }, 400);
  await env.DB.prepare("UPDATE orders SET status = ? WHERE id = ?").bind(b.status, id).run();
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      if (!env.DB) return json({ ok: false, error: "Database not connected" }, 500);
      try {
        if (url.pathname === "/api/my-orders" && request.method === "POST") return await myOrders(request, env);
        if (url.pathname === "/api/quote" && request.method === "POST") return await quote(request, env);
        if (url.pathname === "/api/orders" && request.method === "POST") return await createOrder(request, env);
        if (url.pathname === "/api/orders" && request.method === "GET") return await listOrders(request, env);
        const m = url.pathname.match(/^\/api\/orders\/(\d+)$/);
        if (m && request.method === "PATCH") return await setStatus(request, env, Number(m[1]));
        return json({ ok: false, error: "Not found" }, 404);
      } catch (e) {
        return json({ ok: false, error: "Server error" }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};

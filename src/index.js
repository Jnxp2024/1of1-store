// 1 OF 1 store — Cloudflare Worker.
// Serves the site from static assets and handles the order API under /api/*.
// Bindings (wrangler.jsonc): ASSETS (the site), DB (D1 "oneofone-store").
// Secret set in the dashboard: ADMIN_PASSWORD.

const STATUSES = ["new", "confirmed", "delivered", "cancelled"];

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

  const catalog = await loadCatalog(request, env);
  const items = ids.map(id => catalog[id]).filter(it => it && !it.sold)
    .map(it => ({ id: it.id, brand: it.brand, name: it.name, price: it.price }));
  if (!items.length) return json({ ok: false, error: "These pieces are no longer available" }, 409);
  const total = items.reduce((s, i) => s + i.price, 0);

  const res = await env.DB.prepare(
    "INSERT INTO orders (name, phone, delivery, note, items, total_aed) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(name, phone, delivery, note, JSON.stringify(items), total).run();
  return json({ ok: true, id: res.meta.last_row_id, total });
}

async function listOrders(request, env) {
  if (!isAdmin(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);
  const { results } = await env.DB.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 500").all();
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

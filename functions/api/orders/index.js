import { json, isAdmin, loadCatalog } from "../_shared.js";

// Customer places an order. Prices are re-read from products.json on the server,
// so nobody can change a price in their browser.
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ ok: false, error: "Database not connected" }, 500);
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

// Admin: list orders
export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);
  const { results } = await env.DB.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 500").all();
  return json({ ok: true, orders: results });
}

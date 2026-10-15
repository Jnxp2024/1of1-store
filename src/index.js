import { serveSite } from "./seo.js";
// 1 OF 1 store — Cloudflare Worker.
// Serves the site from static assets and handles the order API under /api/*.
// Bindings (wrangler.jsonc): ASSETS (the site), DB (D1 "oneofone-store").
// Secret set in the dashboard: ADMIN_PASSWORD.

const STATUSES = ["pending", "shipped", "delivered", "cancelled"];
const PAID_METHODS = ["cash", "card", "online", "applepay"];
const FIRST_ORDER_DISCOUNT = 0.15; // 15% off a customer's first order (by phone number)
// Loyalty: every AED 5,000 of delivered spend earns one 15% coupon for a future order.
const LOYALTY_STEP = 5000, LOYALTY_DISCOUNT = 0.15;
const DISCOUNT_LABEL = { welcome: "Welcome 15% · first order", loyalty: "Level-up reward · 15% off" };

// Where a customer stands: welcome bonus, loyalty coupons earned/used/available, progress.
async function rewards(env, phone) {
  const r = await env.DB.prepare(`SELECT
      COUNT(CASE WHEN status != 'cancelled' THEN 1 END) AS live,
      COALESCE(SUM(CASE WHEN status = 'delivered' THEN total_aed END), 0) AS spent,
      COUNT(CASE WHEN status != 'cancelled' AND discount_kind = 'loyalty' THEN 1 END) AS used
    FROM orders WHERE phone = ?`).bind(phone).first();
  const spent = r ? r.spent : 0, earned = Math.floor(spent / LOYALTY_STEP), used = r ? r.used : 0;
  return {
    welcome: !r || r.live === 0,
    spent, earned, used, available: Math.max(0, earned - used),
    next: (earned + 1) * LOYALTY_STEP, toNext: (earned + 1) * LOYALTY_STEP - spent
  };
}

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


/* ---------------- customer accounts ---------------- */
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const randHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));
const cleanPhone = v => String(v || "").replace(/\D/g, "");

async function hashPassword(password, saltHex) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256);
  return hex(bits);
}
function sameHex(a, b) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function newSession(env, customerId) {
  const token = randHex(24);
  await env.DB.prepare("INSERT INTO sessions (token, customer_id) VALUES (?, ?)").bind(token, customerId).run();
  return token;
}
async function currentCustomer(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Session ") ? auth.slice(8) : "";
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  return await env.DB.prepare(
    "SELECT c.id, c.name, c.phone, c.avatar, c.address FROM sessions s JOIN customers c ON c.id = s.customer_id WHERE s.token = ? AND s.created_at > datetime('now', '-180 days')"
  ).bind(token).first();
}

// Is this number already registered? (decides "sign in" vs "create account")
async function authCheck(request, env) {
  let b; try { b = await request.json(); } catch { b = {}; }
  const phone = cleanPhone(b.phone);
  if (phone.length < 9 || phone.length > 15) return json({ ok: false, error: "Invalid phone" }, 400);
  const row = await env.DB.prepare("SELECT id FROM customers WHERE phone = ?").bind(phone).first();
  return json({ ok: true, exists: !!row });
}

async function authRegister(request, env) {
  let b; try { b = await request.json(); } catch { b = {}; }
  const name = String(b.name || "").trim().slice(0, 80);
  const phone = cleanPhone(b.phone);
  const password = String(b.password || "");
  if (name.length < 2) return json({ ok: false, error: "Enter your full name." }, 400);
  if (phone.length < 9 || phone.length > 15) return json({ ok: false, error: "Enter a valid mobile number." }, 400);
  if (password.length < 6 || password.length > 128) return json({ ok: false, error: "Password must be at least 6 characters." }, 400);
  const exists = await env.DB.prepare("SELECT id FROM customers WHERE phone = ?").bind(phone).first();
  if (exists) return json({ ok: false, error: "This number already has an account. Sign in instead.", exists: true }, 409);
  const salt = randHex(16);
  const hash = await hashPassword(password, salt);
  const res = await env.DB.prepare("INSERT INTO customers (name, phone, pass_hash, salt) VALUES (?, ?, ?, ?)").bind(name, phone, hash, salt).run();
  const token = await newSession(env, res.meta.last_row_id);
  return json({ ok: true, token, name, phone });
}

async function authLogin(request, env) {
  let b; try { b = await request.json(); } catch { b = {}; }
  const phone = cleanPhone(b.phone);
  const password = String(b.password || "");
  const c = await env.DB.prepare("SELECT id, name, phone, pass_hash, salt, failed, locked_until FROM customers WHERE phone = ?").bind(phone).first();
  const now = Math.floor(Date.now() / 1000);
  if (!c) return json({ ok: false, error: "No account with this number. Create one instead." }, 404);
  if (c.locked_until > now) return json({ ok: false, error: "Too many attempts. Try again in 15 minutes." }, 429);
  const hash = await hashPassword(password, c.salt);
  if (!sameHex(hash, c.pass_hash)) {
    const failed = c.failed + 1;
    await env.DB.prepare("UPDATE customers SET failed = ?, locked_until = ? WHERE id = ?")
      .bind(failed >= 5 ? 0 : failed, failed >= 5 ? now + 900 : 0, c.id).run();
    return json({ ok: false, error: "Wrong password." }, 401);
  }
  await env.DB.prepare("UPDATE customers SET failed = 0, locked_until = 0 WHERE id = ?").bind(c.id).run();
  const token = await newSession(env, c.id);
  return json({ ok: true, token, name: c.name, phone: c.phone });
}

async function authLogout(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Session ") ? auth.slice(8) : "";
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  return json({ ok: true });
}

// Account page: profile, every order on this number, totals and coupon status.
async function me(request, env) {
  const c = await currentCustomer(request, env);
  if (!c) return json({ ok: false, error: "Signed out" }, 401);
  const { results } = await env.DB.prepare(
    "SELECT id, created_at, name, phone, items, subtotal_aed, discount_aed, total_aed, status, delivery, note, lat, lng, payment, paid, paid_method, paid_at, status_at, discount_kind FROM orders WHERE phone = ? ORDER BY id DESC LIMIT 200"
  ).bind(c.phone).all();
  const live = results.filter(o => o.status !== "cancelled");
  const rw = await rewards(env, c.phone);
  return json({
    ok: true,
    customer: { name: c.name, phone: c.phone, avatar: c.avatar || null, address: c.address ? JSON.parse(c.address) : null },
    orders: results,
    spent: live.reduce((s, o) => s + o.total_aed, 0),
    saved: live.reduce((s, o) => s + (o.discount_aed || 0), 0),
    rewards: rw,
    coupons: [
      { code: "WELCOME15", percent: 15, label: "Off your first order", active: rw.welcome },
      ...Array.from({ length: rw.earned }, (_, i) => ({ code: "LOYAL15-" + (i + 1), percent: 15, label: `Reward for AED ${((i + 1) * LOYALTY_STEP).toLocaleString("en-US")} spent`, active: i >= rw.used }))
    ]
  });
}

async function setAvatar(request, env) {
  const c = await currentCustomer(request, env);
  if (!c) return json({ ok: false, error: "Signed out" }, 401);
  let b; try { b = await request.json(); } catch { b = {}; }
  const img = b.avatar === null ? null : String(b.avatar || "");
  if (img !== null && (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(img) || img.length > 120000))
    return json({ ok: false, error: "Image too large" }, 400);
  await env.DB.prepare("UPDATE customers SET avatar = ? WHERE id = ?").bind(img, c.id).run();
  return json({ ok: true });
}

// Works out the price for a bag: subtotal from products.json, minus 15% if this
// phone number has never ordered before (cancelled orders don't count).
async function price(request, env, ids, phone) {
  const catalog = await loadCatalog(request, env);
  const items = ids.map(id => catalog[id]).filter(it => it && !it.sold)
    .map(it => ({ id: it.id, brand: it.brand, name: it.name, price: it.price }));
  const subtotal = items.reduce((s, i) => s + i.price, 0);
  let kind = null;
  if (phone) {
    const rw = await rewards(env, phone);
    kind = rw.welcome ? "welcome" : rw.available > 0 ? "loyalty" : null;
  }
  const firstOrder = kind === "welcome";
  const discount = kind ? Math.round(subtotal * (kind === "welcome" ? FIRST_ORDER_DISCOUNT : LOYALTY_DISCOUNT)) : 0;
  return { items, subtotal, discount, total: subtotal - discount, firstOrder, kind, label: kind ? DISCOUNT_LABEL[kind] : null };
}

async function quote(request, env) {
  let b; try { b = await request.json(); } catch { b = {}; }
  const phone = String(b.phone || "").replace(/\D/g, "");
  const ids = Array.isArray(b.items) ? [...new Set(b.items.map(String))].slice(0, 20) : [];
  const q = await price(request, env, ids, phone.length >= 9 ? phone : "");
  return json({ ok: true, subtotal: q.subtotal, discount: q.discount, total: q.total, firstOrder: q.firstOrder, kind: q.kind, label: q.label });
}

// Customer places an order. Prices come from products.json on the server.
async function createOrder(request, env) {
  let b;
  try { b = await request.json(); } catch { return json({ ok: false, error: "Bad request" }, 400); }
  const who = await currentCustomer(request, env);
  const name = who ? who.name : String(b.name || "").trim().slice(0, 80);
  const phone = who ? who.phone : String(b.phone || "").replace(/\D/g, "");
  const delivery = String(b.delivery || "").slice(0, 80);
  const note = String(b.note || "").trim().slice(0, 400);
  const ids = Array.isArray(b.items) ? [...new Set(b.items.map(String))].slice(0, 20) : [];
  if (name.length < 2) return json({ ok: false, error: "Name required" }, 400);
  if (phone.length < 9 || phone.length > 15) return json({ ok: false, error: "Invalid phone" }, 400);
  if (!ids.length) return json({ ok: false, error: "Bag is empty" }, 400);

  // only cash on delivery for now; card and Apple Pay are "coming soon" in the checkout
  const payment = "cod";
  if (b.payment && b.payment !== "cod") return json({ ok: false, error: "Only cash on delivery is available right now." }, 400);
  let lat = Number(b.lat), lng = Number(b.lng);
  if (!(Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) { lat = null; lng = null; }
  else { lat = Math.round(lat * 1e6) / 1e6; lng = Math.round(lng * 1e6) / 1e6; }
  if (!note && lat === null) return json({ ok: false, error: "Add your delivery address or share your location." }, 400);

  const q = await price(request, env, ids, phone);
  if (!q.items.length) return json({ ok: false, error: "These pieces are no longer available" }, 409);
  const token = crypto.randomUUID().replace(/-/g, "");
  const res = await env.DB.prepare(
    "INSERT INTO orders (name, phone, delivery, note, items, subtotal_aed, discount_aed, total_aed, token, lat, lng, payment, discount_kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(name, phone, delivery, note, JSON.stringify(q.items), q.subtotal, q.discount, q.total, token, lat, lng, payment, q.kind).run();
  if (who && b.saveAddress) {
    const saved = JSON.stringify({ zone: String(b.zone || "uae").slice(0, 10), text: note, lat, lng });
    await env.DB.prepare("UPDATE customers SET address = ? WHERE id = ?").bind(saved, who.id).run();
  }
  return json({ ok: true, id: res.meta.last_row_id, token, subtotal: q.subtotal, discount: q.discount, total: q.total, label: q.label });
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
      "SELECT id, created_at, name, phone, items, subtotal_aed, discount_aed, total_aed, status, delivery, note, lat, lng, payment, paid, paid_method, paid_at, status_at, discount_kind FROM orders WHERE id = ? AND token = ?"
    ).bind(id, token).first();
    if (row) out.push(row);
  }
  out.sort((a, b) => b.id - a.id);
  return json({ ok: true, orders: out });
}

async function listOrders(request, env) {
  if (!isAdmin(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);
  const { results } = await env.DB.prepare("SELECT id, created_at, name, phone, delivery, note, items, subtotal_aed, discount_aed, total_aed, status, lat, lng, payment, paid, paid_method, paid_at, status_at, discount_kind FROM orders ORDER BY id DESC LIMIT 500").all();
  return json({ ok: true, orders: results });
}

// Admin: change delivery status and/or record the payment.
async function setStatus(request, env, id) {
  if (!isAdmin(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);
  let b; try { b = await request.json(); } catch { b = {}; }
  if (!Number.isInteger(id)) return json({ ok: false, error: "Bad request" }, 400);
  const row = await env.DB.prepare("SELECT id FROM orders WHERE id = ?").bind(id).first();
  if (!row) return json({ ok: false, error: "Not found" }, 404);
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return json({ ok: false, error: "Bad status" }, 400);
    await env.DB.prepare("UPDATE orders SET status = ?, status_at = datetime('now') WHERE id = ?").bind(b.status, id).run();
  }
  if (b.paid_method !== undefined) {
    if (b.paid_method === null || b.paid_method === "") {
      await env.DB.prepare("UPDATE orders SET paid = 0, paid_method = NULL, paid_at = NULL WHERE id = ?").bind(id).run();
    } else if (PAID_METHODS.includes(b.paid_method)) {
      await env.DB.prepare("UPDATE orders SET paid = 1, paid_method = ?, paid_at = datetime('now') WHERE id = ?").bind(b.paid_method, id).run();
    } else return json({ ok: false, error: "Bad payment method" }, 400);
  }
  const o = await env.DB.prepare("SELECT status, paid, paid_method, paid_at, status_at, discount_kind FROM orders WHERE id = ?").bind(id).first();
  return json({ ok: true, order: o });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      if (!env.DB) return json({ ok: false, error: "Database not connected" }, 500);
      try {
        if (request.method === "POST" && url.pathname === "/api/auth/check") return await authCheck(request, env);
        if (request.method === "POST" && url.pathname === "/api/auth/register") return await authRegister(request, env);
        if (request.method === "POST" && url.pathname === "/api/auth/login") return await authLogin(request, env);
        if (request.method === "POST" && url.pathname === "/api/auth/logout") return await authLogout(request, env);
        if (request.method === "GET" && url.pathname === "/api/me") return await me(request, env);
        if (request.method === "POST" && url.pathname === "/api/me/avatar") return await setAvatar(request, env);
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
    return serveSite(request, env);
  },
};

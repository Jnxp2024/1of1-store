import { json, isAdmin } from "../_shared.js";

const STATUSES = ["new", "confirmed", "delivered", "cancelled"];

// Admin: change an order's status
export async function onRequestPatch({ request, env, params }) {
  if (!isAdmin(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);
  const id = Number(params.id);
  let b; try { b = await request.json(); } catch { b = {}; }
  if (!Number.isInteger(id) || !STATUSES.includes(b.status)) return json({ ok: false, error: "Bad request" }, 400);
  await env.DB.prepare("UPDATE orders SET status = ? WHERE id = ?").bind(b.status, id).run();
  return json({ ok: true });
}

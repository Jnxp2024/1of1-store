// Helpers shared by the API routes. Bindings set in Cloudflare Pages settings:
//   DB              → D1 database "oneofone-store"
//   ADMIN_PASSWORD  → secret used by /admin.html
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export function isAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const real = env.ADMIN_PASSWORD || "";
  if (!real || given.length !== real.length) return false;
  let diff = 0;
  for (let i = 0; i < real.length; i++) diff |= real.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

export async function loadCatalog(request, env) {
  const r = await env.ASSETS.fetch(new URL("/products.json", request.url));
  const d = await r.json();
  const byId = {};
  d.categories.forEach(c => c.items.forEach(it => { byId[it.id] = it; }));
  return byId;
}

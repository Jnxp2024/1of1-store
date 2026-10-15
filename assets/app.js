// 1 OF 1 — shared code for every page
const STORE = {
  name: "1 OF 1",
  whatsapp: "971562422121",
  phoneLocal: "056 242 2121",
  email: "info@1of1.ae",
  instagram: "1of1.uae",
  tiktok: "1of1.uae",
  snapchat: "uae.1of1",
  // Approximate rates from 1 AED. Customers always pay in AED.
  rates: { AED: 1, USD: 0.2723, EUR: 0.235, GBP: 0.205, SAR: 1.021, KWD: 0.0835, QAR: 0.991, BHD: 0.1026, OMR: 0.1048, INR: 23.0, RUB: 22.0, CNY: 1.95 }
};

/* ---------- safe storage ---------- */
const _mem = {};
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return k in _mem ? _mem[k] : d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { _mem[k] = v; } }
};
const getCart = () => store.get("oo_cart", []);
const setCart = c => { store.set("oo_cart", c); paintCount(); };
const getFavs = () => store.get("oo_favs", []);
const getUser = () => store.get("oo_user", null);
const setUser = u => store.set("oo_user", u);

/* ---------- formatting ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const getCur = () => { const c = store.get("oo_cur", "AED"); return STORE.rates[c] ? c : "AED"; };
const money = n => {
  const c = getCur(), v = Number(n) * STORE.rates[c];
  return c + " " + v.toLocaleString("en-US", { maximumFractionDigits: c === "AED" || v >= 100 ? 0 : 2 });
};
const aed = n => "AED " + Number(n).toLocaleString("en-US");
function normPhone(raw) {
  let d = String(raw).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (/^05\d{8}$/.test(d)) d = "971" + d.slice(1);
  if (/^5\d{8}$/.test(d)) d = "971" + d;
  return d.length >= 9 && d.length <= 15 ? d : null;
}
const prettyPhone = d => d && d.startsWith("971") && d.length === 12 ? `+971 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : "+" + d;

/* ---------- icons ---------- */
const sv = (p, s = 18, fill = "none", sw = 1.4) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="${sw}" aria-hidden="true">${p}</svg>`;
const I = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  bag: '<path d="M5 8h14l-1.2 13H6.2L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  heart: '<path d="M12 20s-7-4.3-9.2-8.8A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 9.2 5.2C19 15.7 12 20 12 20z"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  left: '<path d="m15 6-6 6 6 6"/>', right: '<path d="m9 6 6 6-6 6"/>',
  truck: '<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'
};
const CAT_ICON = {
  bag: '<path d="M12 24h40l-3 30H15z"/><path d="M22 24v-6a10 10 0 0 1 20 0v6"/><path d="M28 34h8v5h-8z"/>',
  watch: '<rect x="24" y="4" width="16" height="14" rx="2"/><rect x="24" y="46" width="16" height="14" rx="2"/><circle cx="32" cy="32" r="14"/><path d="M32 24v8l6 4"/><path d="M46 30h3v4h-3"/>',
  jewel: '<circle cx="32" cy="38" r="16"/><path d="M24 16h16l5 7-13 9-13-9z"/>',
  shoe: '<path d="M8 40c0-8 2-18 6-18 6 0 8 8 18 12 10 4 20 4 24 10v6H8z"/><path d="M8 50h48"/>',
  shades: '<path d="M6 28h52"/><path d="M8 28c0 10 4 14 11 14s10-5 10-14"/><path d="M35 28c0 9 3 14 10 14s11-4 11-14"/><path d="M29 30q3-3 6 0"/>',
  wallet: '<rect x="8" y="18" width="48" height="32" rx="3"/><path d="M8 26h48"/><rect x="40" y="32" width="16" height="10" rx="2"/>',
  coat: '<path d="M24 8 14 14 8 34l6 2 4-12v32h28V24l4 12 6-2-6-20-10-6-8 10z"/><path d="M32 18v38"/>',
  belt: '<path d="M4 26h56v12H4z"/><rect x="22" y="22" width="20" height="20" rx="3"/><path d="M32 26v12"/>'
};
const catIcon = k => `<svg class="ic" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">${CAT_ICON[k] || CAT_ICON.bag}</svg>`;
const MONO = '<svg viewBox="0 0 100 100" aria-hidden="true"><line x1="25" y1="82" x2="75" y2="18" stroke="#c9ad7f" stroke-width="2.2"/><path d="M27 22 L35 14 V50 M63 58 L71 50 V86" fill="none" stroke="#efe9df" stroke-width="3" stroke-linecap="square"/></svg>';

/* ---------- products ---------- */
let _data;
async function loadProducts() {
  if (_data) return _data;
  const r = await fetch("/products.json", { cache: "no-cache" });
  _data = await r.json();
  _data.byId = {};
  _data.categories.forEach(c => c.items.forEach(it => { it.cat = c; _data.byId[it.id] = it; }));
  return _data;
}
const media = (it, big) => it.image
  ? `<img src="${esc(it.image)}" alt="${esc(it.brand + " " + it.name)}" loading="${big ? "eager" : "lazy"}">`
  : catIcon(it.cat.icon);

function cardHTML(it) {
  const fav = getFavs().includes(it.id);
  return `<article class="card" data-id="${esc(it.id)}">
    <a class="ph" href="/product.html?id=${encodeURIComponent(it.id)}" aria-label="${esc(it.brand + " " + it.name)}">
      ${media(it)}
      ${it.tag ? `<span class="tag">${esc(it.tag)}</span>` : ""}
      <span class="auth">${sv(I.check, 11, "none", 2)}Authenticated</span>
      ${it.sold ? '<span class="sold">SOLD</span>' : ""}
    </a>
    <button class="fav${fav ? " on" : ""}" aria-label="Save ${esc(it.brand)}"></button>
    <a class="meta" href="/product.html?id=${encodeURIComponent(it.id)}">
      <span class="brandname">${esc(it.brand)}</span>
      <span class="pname">${esc(it.name)}</span>
      <span class="price"><b>${money(it.price)}</b>${it.was ? `<s>${money(it.was)}</s>` : ""}</span>
    </a>
  </article>`;
}

/* ---------- chrome: header + footer ---------- */
function renderHeader(opts = {}) {
  const u = getUser();
  const el = document.getElementById("hdr");
  el.className = "top";
  el.innerHTML = `
  <div class="ship">UAE <b>·</b> Same-day delivery &nbsp;&nbsp;&nbsp; Worldwide <b>·</b> Within a week &nbsp;&nbsp;&nbsp; Every piece <b>·</b> Authenticated &nbsp;&nbsp;&nbsp; <a href="tel:+971562422121">056 242 2121</a> <b>·</b> <a href="mailto:info@1of1.ae">info@1of1.ae</a></div>
  <div class="gut">
    <div class="bar">
      <a class="brand" href="/" aria-label="1 OF 1 home">${MONO}<span>1 OF 1</span></a>
      ${opts.search ? `<label class="search" for="q">${sv(I.search, 16)}<input id="q" type="search" placeholder="Search Rolex, Hermès, Cartier…" autocomplete="off"></label>` : '<div style="flex:1"></div>'}
      <div class="tools">
        <select class="cur" id="cur" aria-label="Currency">${Object.keys(STORE.rates).map(c => `<option${c === getCur() ? " selected" : ""}>${c}</option>`).join("")}</select>
        <a class="who" href="/login.html">${u ? esc(u.name.split(" ")[0]) : "Sign in"}</a>
        <a class="icon-btn" href="/login.html" aria-label="Account" style="display:none" id="acct">${sv(I.user, 20)}</a>
        <a class="icon-btn" href="/cart.html" aria-label="Your bag">${sv(I.bag, 20)}<span class="n" id="bagN" hidden>0</span></a>
      </div>
    </div>
    ${opts.chips ? `<nav class="chips" aria-label="Categories">${opts.chips.map(c => `<a href="${c.href}"${c.on ? ' class="on"' : ""}>${esc(c.title)}</a>`).join("")}</nav>` : ""}
  </div>`;
  if (matchMedia("(max-width:760px)").matches) document.getElementById("acct").style.display = "grid";
  document.getElementById("cur").onchange = e => { store.set("oo_cur", e.target.value); location.reload(); };
  paintCount();
}
function paintCount() {
  const n = document.getElementById("bagN"); if (!n) return;
  const c = getCart().length; n.textContent = c; n.hidden = !c;
}
function renderFooter() {
  const f = document.getElementById("ftr"); if (!f) return;
  f.className = "foot";
  f.innerHTML = `<div class="gut">
    <div class="fgrid">
      <div><b>Delivery</b><p>UAE · Same-day delivery<br>Worldwide · Within a week, insured</p></div>
      <div><b>Authenticated</b><p>Every piece checked by hand before it ships. Condition graded honestly.</p></div>
      <div><b>Sourcing</b><p>Show us the piece you want. We find it, often in under a day.</p></div>
      <div><b>Contact</b><p><a href="tel:+${STORE.whatsapp}">Call ${STORE.phoneLocal}</a><br><a href="https://wa.me/${STORE.whatsapp}" target="_blank" rel="noopener">WhatsApp ${STORE.phoneLocal}</a><br><a href="mailto:${STORE.email}">${STORE.email}</a></p></div>
      <div><b>Follow</b><p><a href="https://instagram.com/${STORE.instagram}" target="_blank" rel="noopener">Instagram @${STORE.instagram}</a><br><a href="https://www.tiktok.com/@${STORE.tiktok}" target="_blank" rel="noopener">TikTok @${STORE.tiktok}</a><br><a href="https://www.snapchat.com/add/${STORE.snapchat}" target="_blank" rel="noopener">Snapchat @${STORE.snapchat}</a></p></div>
    </div>
    <div class="legal">© ${new Date().getFullYear()} 1 OF 1 · Dubai, United Arab Emirates · Prices in AED</div>
  </div>`;
}

/* ---------- card interactions (favourite) ---------- */
function bindCards(root) {
  root.querySelectorAll(".card").forEach(card => {
    const b = card.querySelector(".fav");
    b.innerHTML = sv(I.heart, 18, b.classList.contains("on") ? "currentColor" : "none");
  });
  root.addEventListener("click", e => {
    const b = e.target.closest(".fav"); if (!b) return;
    e.preventDefault();
    const id = b.closest(".card").dataset.id;
    let f = getFavs(); f = f.includes(id) ? f.filter(x => x !== id) : [...f, id];
    store.set("oo_favs", f);
    const on = f.includes(id); b.classList.toggle("on", on); b.innerHTML = sv(I.heart, 18, on ? "currentColor" : "none");
  });
}

document.addEventListener("DOMContentLoaded", renderFooter);

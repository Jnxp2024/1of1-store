// SEO layer: per-page titles, descriptions, canonical URLs, social cards and
// structured data (JSON-LD), plus robots.txt and sitemap.xml.
// Only 1of1.ae is indexable. The workers.dev preview always answers "noindex".

const SITE = "https://1of1.ae";
const LIVE = new Set(["1of1.ae", "www.1of1.ae"]);
const OG_IMAGE = SITE + "/images/og.jpg";
const BRAND = "1 OF 1";
const SAME_AS = [
  "https://www.instagram.com/1of1.uae",
  "https://www.tiktok.com/@1of1.uae",
  "https://www.snapchat.com/add/uae.1of1"
];
const PRIVATE = new Set(["cart", "login", "admin", "404"]);

// Words people actually type, per category (used in titles and descriptions).
const CAT_SEO = {
  watches: { h: "Pre-Owned Luxury Watches in Dubai", k: "pre-owned Rolex, Patek Philippe, Audemars Piguet and Richard Mille with box and papers" },
  bags: { h: "Pre-Owned Designer Bags in Dubai", k: "preloved Hermès Birkin and Kelly, Chanel, Louis Vuitton and Dior handbags" },
  shoes: { h: "Pre-Owned Designer Shoes & Sneakers in Dubai", k: "designer heels, loafers and sneakers from Louboutin, Dior, Hermès and Gucci" },
  travel: { h: "Luxury Travel Bags & Luggage in Dubai", k: "pre-owned Louis Vuitton Keepall, Rimowa, Goyard luggage, duffles and backpacks" },
  jewelry: { h: "Pre-Owned Fine Jewellery in Dubai", k: "Cartier Love and Juste un Clou, Van Cleef & Arpels Alhambra and Bulgari gold jewellery" },
  eyewear: { h: "Designer Sunglasses in Dubai", k: "pre-owned designer sunglasses with case" },
  slg: { h: "Designer Wallets & Card Holders in Dubai", k: "pre-owned designer wallets, card holders and small leather goods" },
  clothing: { h: "Pre-Owned Designer Clothing in Dubai", k: "preloved designer coats, jackets and ready-to-wear" },
  acc: { h: "Designer Belts & Scarves in Dubai", k: "Hermès belts, silk carrés and designer scarves" },
  home: { h: "Luxury Home Décor in Dubai", k: "Hermès blankets and tableware, Baccarat and Lalique crystal, Fornasetti" }
};

const HOME_FAQ = [
  ["Are your pieces authentic?", "Yes. Every piece is checked by hand before it ships and its condition is graded honestly, so you know exactly what you are getting."],
  ["How fast is delivery in the UAE?", "Same-day delivery across the UAE. Worldwide orders arrive within a week."],
  ["Can you find a piece you don't have listed?", "Yes. Show us the watch, bag or item you want and we find it, often in under a day. Message us on WhatsApp at +971 56 242 2121."],
  ["How do I pay?", "Pay on delivery, in cash or by card / online payment at the door. Card and Apple Pay checkout online are coming soon."],
  ["Is there a discount on my first order?", "Yes. Create an account and get 15% off your first order, applied automatically at checkout."]
];

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ld = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;
const abs = p => (p && /^https?:/.test(p) ? p : SITE + (p || ""));
const aed = n => "AED " + Number(n || 0).toLocaleString("en-US");

function pageKey(pathname) {
  const p = pathname.replace(/\/+$/, "").replace(/\.html$/, "").replace(/^\//, "");
  return p === "" || p === "index" ? "home" : p;
}

async function catalog(request, env) {
  const r = await env.ASSETS.fetch(new Request(new URL("/products.json", request.url)));
  const d = await r.json();
  const byId = {};
  d.categories.forEach(c => c.items.forEach(it => { byId[it.id] = { ...it, cat: c }; }));
  return { cats: d.categories, byId };
}

const brandsOf = items => [...new Set(items.map(i => i.brand))].slice(0, 5);

const ORG = {
  "@type": "OnlineStore",
  "@id": SITE + "/#store",
  name: BRAND,
  alternateName: ["1of1", "One of One", "1 OF 1 UAE"],
  url: SITE + "/",
  logo: SITE + "/favicon-512.png",
  image: OG_IMAGE,
  description: "Authentic pre-owned luxury in Dubai: watches, designer bags, shoes, jewellery, travel and home. One-of-one pieces, same-day UAE delivery, worldwide shipping.",
  email: "info@1of1.ae",
  telephone: "+971562422121",
  areaServed: [{ "@type": "Country", name: "United Arab Emirates" }, "Worldwide"],
  address: { "@type": "PostalAddress", addressLocality: "Dubai", addressCountry: "AE" },
  currenciesAccepted: "AED",
  sameAs: SAME_AS
};

// Builds the SEO block for a page. Returns null for pages we leave alone.
async function seoFor(url, request, env) {
  const key = pageKey(url.pathname);
  if (PRIVATE.has(key)) return { robots: "noindex, nofollow" };

  if (key === "home") {
    const { cats } = await catalog(request, env);
    return {
      title: "1 OF 1 | Pre-Owned Luxury Watches & Designer Bags in Dubai",
      desc: "Shop authentic 1 of 1 pre-owned luxury in Dubai: Rolex, Hermès, Chanel, Louis Vuitton and more. Best-condition pieces checked by hand. Same-day UAE delivery, worldwide shipping.",
      canonical: SITE + "/",
      ld: [
        ORG,
        { "@type": "WebSite", "@id": SITE + "/#site", name: BRAND, url: SITE + "/", publisher: { "@id": SITE + "/#store" },
          potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: SITE + "/?q={search_term_string}" }, "query-input": "required name=search_term_string" } },
        { "@type": "FAQPage", mainEntity: HOME_FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
        { "@type": "ItemList", name: "Categories", itemListElement: cats.filter(c => c.items.length).map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.title, url: `${SITE}/category?c=${c.id}` })) }
      ]
    };
  }

  if (key === "category") {
    const id = url.searchParams.get("c");
    const { cats } = await catalog(request, env);
    const c = cats.find(x => x.id === id);
    if (!c) return { robots: "noindex, follow" };
    const s = CAT_SEO[c.id] || { h: `Pre-Owned ${c.title} in Dubai`, k: `pre-owned designer ${c.title.toLowerCase()}` };
    const canon = `${SITE}/category?c=${c.id}`;
    return {
      title: `${s.h} | ${BRAND}`,
      desc: `Shop ${s.k}. Authentic 1 of 1 pieces in the best condition${c.items.length ? `, including ${brandsOf(c.items).join(", ")}` : ""}. Same-day UAE delivery, worldwide shipping.`,
      canonical: canon,
      ld: [
        { "@type": "CollectionPage", name: s.h, url: canon, isPartOf: { "@id": SITE + "/#site" } },
        { "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: BRAND, item: SITE + "/" },
          { "@type": "ListItem", position: 2, name: c.title, item: canon }] },
        { "@type": "ItemList", itemListElement: c.items.map((it, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/product?id=${encodeURIComponent(it.id)}`, name: `${it.brand} ${it.name}` })) }
      ]
    };
  }

  if (key === "product") {
    const id = url.searchParams.get("id");
    const { byId } = await catalog(request, env);
    const it = byId[id];
    if (!it) return { robots: "noindex, follow" };
    const canon = `${SITE}/product?id=${encodeURIComponent(it.id)}`;
    const name = `${it.brand} ${it.name}`;
    const img = it.image ? abs(it.image) : OG_IMAGE;
    return {
      title: `${name} | Pre-Owned ${it.cat.title} Dubai | ${BRAND}`,
      desc: `Authentic pre-owned ${name}, condition: ${it.condition || "excellent"}. ${it.sold ? "Sold, ask us to source another." : aed(it.price) + "."} 1 of 1 piece, checked by hand. Same-day UAE delivery, worldwide shipping.`,
      canonical: canon,
      image: img,
      type: "product",
      ld: [
        { "@type": "Product", name, brand: { "@type": "Brand", name: it.brand }, category: it.cat.title, sku: it.id,
          description: `Pre-owned ${name}. Condition: ${it.condition || "excellent"}. Checked by hand before it ships.`,
          ...(it.image ? { image: [img] } : {}),
          offers: { "@type": "Offer", url: canon, priceCurrency: "AED", price: it.price,
            availability: it.sold ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
            itemCondition: "https://schema.org/UsedCondition", seller: { "@id": SITE + "/#store" },
            shippingDetails: { "@type": "OfferShippingDetails", shippingDestination: { "@type": "DefinedRegion", addressCountry: "AE" },
              shippingRate: { "@type": "MonetaryAmount", value: 0, currency: "AED" },
              deliveryTime: { "@type": "ShippingDeliveryTime", handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 0, unitCode: "DAY" }, transitTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" } } } } },
        { "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: BRAND, item: SITE + "/" },
          { "@type": "ListItem", position: 2, name: it.cat.title, item: `${SITE}/category?c=${it.cat.id}` },
          { "@type": "ListItem", position: 3, name, item: canon }] }
      ]
    };
  }

  if (key === "paddock") {
    return {
      title: "F1 Paddock Club Tickets Abu Dhabi 2026 | Pre-Book | 1 OF 1",
      desc: "Pre-book Abu Dhabi Grand Prix 2026 hospitality: Paddock Club, F1 Garage, team suites and Champions Club at Yas Marina, 4–6 December. Send an inquiry and we hold your ticket.",
      canonical: SITE + "/paddock",
      ld: [{ "@type": "WebPage", name: "Abu Dhabi Grand Prix 2026 paddock tickets", url: SITE + "/paddock", isPartOf: { "@id": SITE + "/#site" } }]
    };
  }
  return null;
}

function rewrite(res, s, indexable) {
  if (!s) return res;
  const robots = !indexable ? "noindex, nofollow" : s.robots;
  const head = [];
  if (robots) head.push(`<meta name="robots" content="${robots}">`);
  if (s.canonical) {
    head.push(`<link rel="canonical" href="${esc(s.canonical)}">`,
      `<meta property="og:site_name" content="${BRAND}">`, `<meta property="og:locale" content="en_AE">`,
      `<meta property="og:type" content="${s.type || "website"}">`, `<meta property="og:url" content="${esc(s.canonical)}">`,
      `<meta property="og:title" content="${esc(s.title)}">`, `<meta property="og:description" content="${esc(s.desc)}">`,
      `<meta property="og:image" content="${esc(s.image || OG_IMAGE)}">`,
      `<meta name="twitter:card" content="summary_large_image">`, `<meta name="twitter:title" content="${esc(s.title)}">`,
      `<meta name="twitter:description" content="${esc(s.desc)}">`, `<meta name="twitter:image" content="${esc(s.image || OG_IMAGE)}">`,
      `<meta name="geo.region" content="AE-DU">`, `<meta name="geo.placename" content="Dubai">`);
  }
  if (s.ld) head.push(ld({ "@context": "https://schema.org", "@graph": s.ld }));
  let rw = new HTMLRewriter().on("head", { element(e) { e.append(head.join(""), { html: true }); } });
  if (s.title) rw = rw.on("title", { element(e) { e.setInnerContent(s.title); } });
  if (s.desc) rw = rw.on('meta[name="description"]', { element(e) { e.setAttribute("content", s.desc); } });
  return rw.transform(res);
}

async function sitemap(request, env) {
  const { cats } = await catalog(request, env);
  const urls = [[SITE + "/", "1.0", "daily"], [SITE + "/paddock", "0.8", "weekly"]];
  cats.filter(c => c.items.length).forEach(c => {
    urls.push([`${SITE}/category?c=${c.id}`, "0.9", "daily"]);
    c.items.forEach(it => urls.push([`${SITE}/product?id=${encodeURIComponent(it.id)}`, it.sold ? "0.3" : "0.7", "weekly"]));
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(([u, p, f]) => `  <url><loc>${esc(u)}</loc><changefreq>${f}</changefreq><priority>${p}</priority></url>`).join("\n") + "\n</urlset>\n";
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}

export async function serveSite(request, env) {
  const url = new URL(request.url);
  const live = LIVE.has(url.hostname);
  if (url.hostname === "www.1of1.ae") return Response.redirect(SITE + url.pathname + url.search, 301);

  if (url.pathname === "/robots.txt") {
    const body = live
      ? `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /cart\nDisallow: /login\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`
      : "User-agent: *\nDisallow: /\n";
    return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (url.pathname === "/sitemap.xml") return sitemap(request, env);

  let res = await env.ASSETS.fetch(request);
  const html = (res.headers.get("Content-Type") || "").includes("text/html");
  if (html && res.status === 200) {
    let s = null;
    try { s = await seoFor(url, request, env); } catch { s = null; }
    res = rewrite(res, s || {}, live);
  }
  if (!live) {
    res = new Response(res.body, res);
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
}

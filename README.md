# 1 OF 1 — store

Static site + a Cloudflare Worker (`src/index.js`) for the order API. Every push to `main` deploys automatically (Workers Builds).

- `index.html` — home, categories as swipeable rows
- `category.html?c=watches` — all pieces in a category, filter by house, sort by price
- `product.html?id=…` — one piece
- `login.html` — name + mobile number
- `cart.html` — bag and checkout
- `admin.html` — orders (password = `ADMIN_PASSWORD`)
- `products.json` — every product. Add `"image": "/images/xxx.jpg"`, set `"sold": true` when sold.
- `src/index.js` — order API, stored in D1 (binding `DB` in `wrangler.jsonc`)

Secret to set in the Worker's Settings → Variables and Secrets: `ADMIN_PASSWORD`.
Site is `noindex` (hidden from Google) until launch — remove `X-Robots-Tag` in `_headers` to go public.

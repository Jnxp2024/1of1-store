# 1 OF 1 — store

Static site + Cloudflare Pages Functions. Every push to `main` deploys automatically.

- `index.html` — home, categories as swipeable rows
- `category.html?c=watches` — all pieces in a category, filter by house, sort by price
- `product.html?id=…` — one piece
- `login.html` — name + mobile number
- `cart.html` — bag and checkout
- `admin.html` — orders (password = `ADMIN_PASSWORD`)
- `products.json` — every product. Add `"image": "/images/xxx.jpg"`, set `"sold": true` when sold.
- `functions/api/` — order API, stored in D1

Cloudflare Pages settings: build command none, output directory `/`.
Bindings: D1 `DB` → `oneofone-store`. Variable (secret): `ADMIN_PASSWORD`.

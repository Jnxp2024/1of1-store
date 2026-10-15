// Crypto payments straight to the store's own wallets (wallets.json).
// USDT is priced off the AED/USD peg; BTC and ETH use a live AED price, locked for 30 minutes.
// Every order gets a slightly unique amount so a payment can be matched to its order.
// USDT on TRON is checked automatically on-chain (TronGrid); other coins are confirmed by the admin.

const AED_PER_USD = 3.6725;
const LOCK_MS = 30 * 60 * 1000;
const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const DECIMALS = { "usdt-trc20": 2, "usdt-erc20": 2, btc: 8, eth: 6 };
const GECKO = { btc: "bitcoin", eth: "ethereum" };
export const EXPLORER = {
  "usdt-trc20": tx => `https://tronscan.org/#/transaction/${tx}`,
  "usdt-erc20": tx => `https://etherscan.io/tx/${tx}`,
  eth: tx => `https://etherscan.io/tx/${tx}`,
  btc: tx => `https://mempool.space/tx/${tx}`
};

export async function wallets(request, env) {
  try {
    const r = await env.ASSETS.fetch(new Request(new URL("/wallets.json", request.url)));
    const d = await r.json();
    return (d.wallets || []).filter(w => w.address && String(w.address).trim().length > 20);
  } catch { return []; }
}

async function aedPrice(id) {
  const cache = caches.default, key = new Request("https://cache.1of1/price/" + id);
  const hit = await cache.match(key);
  if (hit) return Number(await hit.text());
  let p = 0;
  try { // CoinGecko (AED), then Coinbase (USD x peg) as a fallback
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${GECKO[id]}&vs_currencies=aed`, { headers: { accept: "application/json" } });
    if (r.ok) p = Number((await r.json())[GECKO[id]]?.aed);
  } catch {}
  if (!(p > 0)) {
    try {
      const r = await fetch(`https://api.coinbase.com/v2/prices/${id.toUpperCase()}-USD/spot`, { headers: { accept: "application/json" } });
      if (r.ok) p = Number((await r.json()).data?.amount) * AED_PER_USD;
    } catch {}
  }
  if (!(p > 0)) throw new Error("price");
  await cache.put(key, new Response(String(p), { headers: { "Cache-Control": "max-age=60" } }));
  return p;
}

// Amount of coin for an AED total, nudged up by a tiny random tag so each order is unique.
export async function quoteCrypto(id, totalAed) {
  const dec = DECIMALS[id];
  const base = id.startsWith("usdt") ? totalAed / AED_PER_USD : totalAed / (await aedPrice(id));
  const unit = 10 ** dec;
  const tag = 1 + Math.floor(Math.random() * 99); // 0.01–0.99 USDT, or a few satoshi / gwei-scale units
  const amount = (Math.ceil(base * unit) + tag) / unit;
  return { amount: amount.toFixed(dec), expires: id.startsWith("usdt") ? null : Date.now() + LOCK_MS };
}

// Looks for a matching USDT (TRC20) transfer to our address since the order was placed.
export async function findTrc20(address, amount, sinceMs) {
  const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?only_to=true&limit=100&contract_address=${USDT_TRC20_CONTRACT}&min_timestamp=${sinceMs}`;
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) return null;
  const d = await r.json();
  const want = BigInt(Math.round(Number(amount) * 1e6));
  const hit = (d.data || []).find(t => t.to === address && BigInt(t.value) === want);
  return hit ? hit.transaction_id : null;
}

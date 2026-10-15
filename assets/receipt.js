/* 1 OF 1 · order status labels + PDF receipt (shared by account page and admin) */
const ORDER_STATUS = {
  pending: "Pending", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled",
  new: "Pending", confirmed: "Shipped" // older rows
};
const PAID_LABEL = { cash: "Cash", card: "Card at the door", online: "Online payment", applepay: "Apple Pay", crypto: "Crypto" };

function statusLabel(s) { return ORDER_STATUS[s] || s; }

// One line about money for an order, e.g. "Paid · Cash" or "Due on delivery".
function paymentLine(o) {
  if (!o.paid && o.payment === "crypto" && o.status !== "cancelled") return "Awaiting crypto payment · " + (o.crypto_amount || "") + " " + String(o.crypto_coin || "").split("-")[0].toUpperCase();
  if (o.paid) return "Paid · " + (PAID_LABEL[o.paid_method] || "Received");
  if (o.status === "cancelled") return "Not charged";
  return "Due on delivery · cash or card / online";
}

function _dt(s, withTime) {
  if (!s) return "";
  const d = new Date(String(s).replace(" ", "T") + "Z");
  const o = { timeZone: "Asia/Dubai", day: "numeric", month: "short", year: "numeric" };
  if (withTime) { o.hour = "2-digit"; o.minute = "2-digit"; }
  return d.toLocaleString("en-GB", o);
}

let _jspdf;
function _loadPdf() {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  return _jspdf || (_jspdf = new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = "/assets/vendor/jspdf.umd.min.js";
    s.onload = () => ok(window.jspdf); s.onerror = () => { _jspdf = null; no(new Error("load")); };
    document.head.appendChild(s);
  }));
}

const _aed = n => "AED " + Number(n || 0).toLocaleString("en-US");
const _phone = p => (typeof prettyPhone === "function" ? prettyPhone(p) : "+" + p);

async function downloadReceipt(o, btn) {
  const label = btn && btn.textContent;
  if (btn) { btn.disabled = true; btn.textContent = "Preparing…"; }
  try {
    const { jsPDF } = await _loadPdf();
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const W = 595, L = 56, R = W - 56;
    const ink = [17, 17, 17], dim = [120, 120, 120], gold = [176, 141, 87], line = [225, 225, 225];
    let y = 70;
    const txt = (t, x, yy, opt = {}) => { doc.setTextColor(...(opt.c || ink)); doc.setFont("helvetica", opt.b ? "bold" : "normal"); doc.setFontSize(opt.s || 10); doc.text(String(t), x, yy, opt.a ? { align: opt.a } : undefined); };
    const rule = yy => { doc.setDrawColor(...line); doc.setLineWidth(0.6); doc.line(L, yy, R, yy); };

    // header
    txt("1 OF 1", L, y, { s: 26, b: true });
    txt("RECEIPT", R, y - 8, { s: 11, b: true, a: "right", c: gold });
    txt("Order #" + o.id, R, y + 8, { s: 10, a: "right" });
    y += 18; txt("One of one  ·  1of1.ae", L, y, { s: 9, c: dim });
    y += 24; rule(y);

    // meta
    y += 26;
    const status = statusLabel(o.status);
    const cols = [["Date", _dt(o.created_at, true)], ["Delivery status", status], ["Payment", o.paid ? "PAID" : (o.status === "cancelled" ? "NOT CHARGED" : "DUE ON DELIVERY")]];
    cols.forEach(([k, v], i) => { const x = L + i * 165; txt(k.toUpperCase(), x, y, { s: 7.5, c: dim }); txt(v, x, y + 15, { s: 10.5, b: k === "Payment", c: k === "Payment" && o.paid ? [46, 125, 50] : ink }); });
    y += 44;

    // customer + address
    txt("BILLED TO", L, y, { s: 7.5, c: dim }); txt("DELIVER TO", L + 250, y, { s: 7.5, c: dim });
    y += 15;
    txt(o.name || "", L, y, { s: 10.5 }); txt(_phone(o.phone || ""), L, y + 14, { s: 10, c: dim });
    const addr = [o.delivery || "", ...(o.note ? doc.splitTextToSize(o.note, R - (L + 250)) : [])];
    if (o.lat != null) addr.push("Pinned location: " + Number(o.lat).toFixed(5) + ", " + Number(o.lng).toFixed(5));
    addr.forEach((t, i) => txt(t, L + 250, y + i * 14, { s: 10, c: i ? dim : ink }));
    y += Math.max(28, addr.length * 14) + 20;

    // items
    rule(y); y += 18;
    txt("ITEM", L, y, { s: 7.5, c: dim }); txt("PRICE", R, y, { s: 7.5, c: dim, a: "right" });
    y += 10; rule(y);
    const items = typeof o.items === "string" ? JSON.parse(o.items || "[]") : (o.items || []);
    items.forEach(it => {
      y += 22;
      const nm = doc.splitTextToSize(((it.brand || "") + "  " + (it.name || "")).trim(), R - L - 110);
      nm.forEach((t, i) => txt(t, L, y + i * 13, { s: 10.5 }));
      txt(_aed(it.price), R, y, { s: 10.5, a: "right" });
      y += (nm.length - 1) * 13 + 10; rule(y);
    });

    // totals
    y += 24;
    const sub = o.subtotal_aed || o.total_aed;
    const row = (k, v, opt = {}) => { txt(k, R - 200, y, { s: opt.s || 10, b: opt.b, c: opt.c || dim }); txt(v, R, y, { s: opt.s || 10, b: opt.b, a: "right", c: opt.vc || ink }); y += opt.gap || 18; };
    row("Subtotal", _aed(sub));
    if (o.discount_aed) row(o.discount_kind === "loyalty" ? "Level-up reward 10%" : "First order 15%", "- " + _aed(o.discount_aed), { vc: gold });
    row("Delivery", "Free");
    doc.setDrawColor(...ink); doc.setLineWidth(0.8); doc.line(R - 200, y - 6, R, y - 6); y += 10;
    row("Total", _aed(o.total_aed), { s: 13, b: true, c: ink, gap: 34 });

    // payment box
    const boxH = 58;
    doc.setFillColor(...(o.paid ? [237, 247, 238] : [248, 245, 239])); doc.rect(L, y, R - L, boxH, "F");
    let pTitle, pSub;
    if (o.paid) { pTitle = "Payment received · " + (PAID_LABEL[o.paid_method] || "Paid"); pSub = "Paid " + _dt(o.paid_at, true) + "  ·  Amount " + _aed(o.total_aed); }
    else if (o.status === "cancelled") { pTitle = "Order cancelled"; pSub = "No payment was taken for this order."; }
    else { pTitle = "Payment due on delivery"; pSub = "Pay at the door in cash, or by card / online payment.  Amount " + _aed(o.total_aed); }
    txt(pTitle, L + 16, y + 24, { s: 11, b: true, c: o.paid ? [46, 125, 50] : ink });
    txt(pSub, L + 16, y + 41, { s: 9.5, c: dim });
    y += boxH + 18;
    if (o.status === "delivered") { txt("Delivered" + (o.status_at ? " " + _dt(o.status_at, true) : "") + ".", L, y, { s: 9.5, c: dim }); y += 14; }

    // footer
    const fy = 790;
    rule(fy - 18);
    txt("Thank you for shopping with 1 OF 1.", L, fy, { s: 9, c: dim });
    txt("info@1of1.ae  ·  +971 56 242 2121  ·  Instagram @1of1.uae", L, fy + 14, { s: 9, c: dim });

    doc.save(`1OF1-receipt-${o.id}.pdf`);
  } catch (e) {
    alert("Couldn't create the receipt. Please try again.");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }
}

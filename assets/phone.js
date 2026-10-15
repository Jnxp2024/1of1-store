// 1 OF 1 — country code picker + live phone formatting (no flags, searchable by name or code)
const COUNTRIES = [
  ["United Arab Emirates","AE","971",[2,3,4]],["Saudi Arabia","SA","966",[2,3,4]],["Qatar","QA","974",[4,4]],["Kuwait","KW","965",[4,4]],
  ["Bahrain","BH","973",[4,4]],["Oman","OM","968",[4,4]],["Jordan","JO","962",[1,4,4]],["Lebanon","LB","961",[2,3,3]],["Egypt","EG","20",[3,3,4]],
  ["Iraq","IQ","964",[3,3,4]],["Iran","IR","98",[3,3,4]],["Afghanistan","AF","93",[2,3,4]],["Pakistan","PK","92",[3,7]],["India","IN","91",[5,5]],
  ["Bangladesh","BD","880",[4,6]],["Sri Lanka","LK","94",[2,3,4]],["Nepal","NP","977",[3,7]],["Philippines","PH","63",[3,3,4]],["Indonesia","ID","62",[3,4,4]],
  ["Malaysia","MY","60",[2,3,4]],["Singapore","SG","65",[4,4]],["Thailand","TH","66",[2,3,4]],["Vietnam","VN","84",[3,3,3]],["China","CN","86",[3,4,4]],
  ["Hong Kong","HK","852",[4,4]],["Taiwan","TW","886",[3,3,3]],["Japan","JP","81",[2,4,4]],["South Korea","KR","82",[2,4,4]],["Australia","AU","61",[3,3,3]],
  ["New Zealand","NZ","64",[2,3,4]],["United Kingdom","GB","44",[4,6]],["Ireland","IE","353",[2,3,4]],["France","FR","33",[1,2,2,2,2]],["Germany","DE","49",[3,4,4]],
  ["Italy","IT","39",[3,3,4]],["Spain","ES","34",[3,3,3]],["Portugal","PT","351",[3,3,3]],["Netherlands","NL","31",[1,4,4]],["Belgium","BE","32",[3,2,2,2]],
  ["Switzerland","CH","41",[2,3,2,2]],["Austria","AT","43",[3,4,4]],["Sweden","SE","46",[2,3,2,2]],["Norway","NO","47",[3,2,3]],["Denmark","DK","45",[2,2,2,2]],
  ["Finland","FI","358",[2,3,4]],["Poland","PL","48",[3,3,3]],["Czech Republic","CZ","420",[3,3,3]],["Greece","GR","30",[3,3,4]],["Cyprus","CY","357",[2,6]],
  ["Turkey","TR","90",[3,3,2,2]],["Russia","RU","7",[3,3,2,2]],["Ukraine","UA","380",[2,3,2,2]],["Kazakhstan","KZ","7",[3,3,2,2]],["Azerbaijan","AZ","994",[2,3,2,2]],
  ["Georgia","GE","995",[3,2,2,2]],["Armenia","AM","374",[2,3,3]],["Uzbekistan","UZ","998",[2,3,2,2]],["Tajikistan","TJ","992",[2,3,4]],
  ["Israel","IL","972",[2,3,4]],["Syria","SY","963",[3,3,3]],["Yemen","YE","967",[3,3,3]],["Morocco","MA","212",[3,2,2,2]],["Algeria","DZ","213",[3,2,2,2]],
  ["Tunisia","TN","216",[2,3,3]],["Libya","LY","218",[2,3,4]],["Sudan","SD","249",[2,3,4]],["Ethiopia","ET","251",[2,3,4]],["Kenya","KE","254",[3,3,3]],
  ["Nigeria","NG","234",[3,3,4]],["Ghana","GH","233",[2,3,4]],["South Africa","ZA","27",[2,3,4]],["Tanzania","TZ","255",[3,3,3]],["Uganda","UG","256",[3,3,3]],
  ["United States","US","1",[3,3,4]],["Canada","CA","1",[3,3,4]],["Mexico","MX","52",[2,4,4]],["Brazil","BR","55",[2,5,4]],["Argentina","AR","54",[2,4,4]],
  ["Colombia","CO","57",[3,3,4]],["Chile","CL","56",[1,4,4]],["Peru","PE","51",[3,3,3]],["Maldives","MV","960",[3,4]],["Mauritius","MU","230",[4,4]],
  ["Seychelles","SC","248",[1,2,2,2]],["Monaco","MC","377",[2,2,2,2]],["Luxembourg","LU","352",[3,3,3]],["Hungary","HU","36",[2,3,4]],["Romania","RO","40",[3,3,3]],
  ["Bulgaria","BG","359",[2,3,4]],["Serbia","RS","381",[2,3,4]],["Croatia","HR","385",[2,3,4]]
].map(([name, iso, dial, groups]) => ({ name, iso, dial, groups }));

const findCountry = iso => COUNTRIES.find(c => c.iso === iso) || COUNTRIES[0];
function countryForNumber(digits) {
  // longest dial-code match; +1 → United States, +7 → Russia
  let best = null;
  for (const c of COUNTRIES) if (digits.startsWith(c.dial) && (!best || c.dial.length > best.dial.length)) best = c;
  return best;
}
// Format national digits by the country's grouping. A leading 0 (as people type in the UAE) is kept and grouped with the next digits: 056 242 2121.
function formatNational(country, digits) {
  let lead = "";
  if (digits.startsWith("0") && country.iso !== "IT") { lead = "0"; digits = digits.slice(1); }
  const out = []; let i = 0;
  const groups = [...country.groups];
  for (let g = 0; i < digits.length; g++) {
    const size = groups[g] ?? 3;
    out.push(digits.slice(i, i + size)); i += size;
  }
  if (lead && out.length) out[0] = lead + out[0];
  else if (lead) out.push(lead);
  return out.join(" ");
}
function toInternational(country, national) {
  let d = String(national).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith(country.dial) && d.length > country.dial.length + 6) d = d.slice(country.dial.length);
  if (d.startsWith("0") && country.iso !== "IT") d = d.slice(1);
  const full = country.dial + d;
  return d.length >= 6 && full.length <= 15 ? full : null;
}
// "+971 56 242 2121" style display for a stored number
function prettyIntl(full) {
  const d = String(full || "").replace(/\D/g, ""), c = countryForNumber(d);
  if (!c) return "+" + d;
  return "+" + c.dial + " " + formatNational(c, d.slice(c.dial.length));
}

// Builds the picker inside `host`. Returns { value(): full digits or null, set(full), lock(bool), focus() }.
function phoneField(host, opts = {}) {
  let country = findCountry(store.get("oo_country", "AE"));
  host.classList.add("pf");
  host.innerHTML = `
    <button type="button" class="pf-code" aria-haspopup="listbox" aria-expanded="false"><span class="pf-cc"></span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
    <input class="in pf-num" type="tel" inputmode="tel" autocomplete="tel-national" id="${opts.id || "phone"}" placeholder="">
    <div class="pf-pop" hidden>
      <input class="pf-search" type="search" placeholder="Search country or code" aria-label="Search country or code" autocomplete="off">
      <ul class="pf-list" role="listbox"></ul>
    </div>`;
  const btn = host.querySelector(".pf-code"), num = host.querySelector(".pf-num"), pop = host.querySelector(".pf-pop"),
        q = host.querySelector(".pf-search"), list = host.querySelector(".pf-list");
  const example = c => formatNational(c, c.iso === "AE" ? "0562422121" : "5".padEnd(c.groups.reduce((a, b) => a + b, 0), "0"));
  const paintCode = () => {
    host.querySelector(".pf-cc").textContent = `${country.iso} +${country.dial}`;
    btn.setAttribute("aria-label", `Country code: ${country.name} +${country.dial}`);
    num.placeholder = example(country);
  };
  const reformat = () => {
    const digits = num.value.replace(/\D/g, "").slice(0, 15);
    const pos = num.selectionStart, before = num.value.slice(0, pos).replace(/\D/g, "").length;
    num.value = formatNational(country, digits);
    let n = 0, p = 0; while (p < num.value.length && n < before) { if (/\d/.test(num.value[p])) n++; p++; }
    try { num.setSelectionRange(p, p); } catch {}
  };
  const drawList = () => {
    const t = q.value.trim().toLowerCase().replace(/^\+/, "");
    const items = COUNTRIES.filter(c => !t || c.name.toLowerCase().includes(t) || c.dial.startsWith(t) || c.iso.toLowerCase() === t);
    list.innerHTML = items.map(c => `<li role="option" tabindex="-1" data-iso="${c.iso}" aria-selected="${c.iso === country.iso}"><span>${c.name}</span><b>+${c.dial}</b></li>`).join("") || '<li class="pf-none">No match</li>';
  };
  const open = () => { if (num.readOnly) return; pop.hidden = false; btn.setAttribute("aria-expanded", "true"); q.value = ""; drawList(); q.focus(); };
  const close = () => { pop.hidden = true; btn.setAttribute("aria-expanded", "false"); };
  btn.onclick = () => (pop.hidden ? open() : close());
  q.oninput = drawList;
  q.onkeydown = e => {
    if (e.key === "Escape") { close(); btn.focus(); }
    if (e.key === "Enter") { e.preventDefault(); const f = list.querySelector("li[data-iso]"); if (f) pick(f.dataset.iso); }
    if (e.key === "ArrowDown") { e.preventDefault(); const f = list.querySelector("li[data-iso]"); if (f) f.focus(); }
  };
  list.onkeydown = e => {
    const li = e.target.closest("li[data-iso]"); if (!li) return;
    if (e.key === "ArrowDown") { e.preventDefault(); (li.nextElementSibling || li).focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); (li.previousElementSibling || q).focus(); }
    if (e.key === "Enter") { e.preventDefault(); pick(li.dataset.iso); }
    if (e.key === "Escape") { close(); btn.focus(); }
  };
  const pick = iso => { country = findCountry(iso); store.set("oo_country", iso); paintCode(); reformat(); close(); num.focus(); };
  list.onclick = e => { const li = e.target.closest("li[data-iso]"); if (li) pick(li.dataset.iso); };
  document.addEventListener("click", e => { if (!host.contains(e.target)) close(); });
  num.addEventListener("input", () => {
    // pasted "+44 7700 900123" or "00971…": switch country automatically
    const raw = num.value.trim();
    if (/^(\+|00)\d{4,}/.test(raw.replace(/\s/g, ""))) {
      const d = raw.replace(/\D/g, "").replace(/^00/, ""), c = countryForNumber(d);
      if (c) { country = c; store.set("oo_country", c.iso); paintCode(); num.value = d.slice(c.dial.length); }
    }
    reformat();
  });
  paintCode();
  return {
    value: () => toInternational(country, num.value),
    set: full => { const d = String(full).replace(/\D/g, ""), c = countryForNumber(d); if (c) { country = c; paintCode(); num.value = formatNational(c, d.slice(c.dial.length)); } },
    lock: on => { num.readOnly = on; btn.disabled = on; host.classList.toggle("locked", on); },
    focus: () => num.focus(),
    input: num
  };
}

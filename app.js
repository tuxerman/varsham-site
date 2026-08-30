/* Malayalam Calendar — static frontend.
 *
 * Reads data/index.json for the available month range, then data/<YYYY-MM>.json
 * per month. Renders the Editorial-grid month view on wide screens and a
 * one-row-per-day list on phones (same data, CSS + a couple of markup hooks
 * do the switch). Tapping a day opens the detail dialog.
 *
 * URL state lives in the hash: #/2026-01
 */

(() => {
  "use strict";

  const WD_FULL = {
    Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
    Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
  };
  const WD_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const PAKSHA_ML = { shukla: "ശുക്ല പക്ഷം", krishna: "കൃഷ്ണ പക്ഷം" };

  const app = document.getElementById("app");
  const dlg = document.getElementById("day-detail");

  let INDEX = null;      // { months: [...], build: "..." }
  let current = null;    // "YYYY-MM"
  const cache = new Map(); // month -> parsed json

  // ---------------------------------------------------------------- helpers

  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  const dataUrl = (name) =>
    `data/${name}.json` + (INDEX && INDEX.build ? `?v=${INDEX.build}` : "");

  async function loadMonth(month) {
    if (cache.has(month)) return cache.get(month);
    const res = await fetch(dataUrl(month));
    if (!res.ok) throw new Error(`${month}: ${res.status}`);
    const doc = await res.json();
    cache.set(month, doc);
    return doc;
  }

  function neighbours(month) {
    const i = INDEX.months.indexOf(month);
    return {
      prev: i > 0 ? INDEX.months[i - 1] : null,
      next: i >= 0 && i < INDEX.months.length - 1 ? INDEX.months[i + 1] : null,
    };
  }

  const MOON = {
    full: '<svg class="moon" viewBox="0 0 20 20" width="16" height="16"><circle cx="10" cy="10" r="7" fill="none" stroke="#262019" stroke-width="1.8"/></svg>',
    new:  '<svg class="moon" viewBox="0 0 20 20" width="16" height="16"><circle cx="10" cy="10" r="7.5" fill="#262019"/></svg>',
  };
  const HALF_MOON =
    '<svg viewBox="0 0 20 20" width="14" height="14"><path d="M10 2 a8 8 0 0 1 0 16 a5.5 8 0 0 0 0 -16" fill="#262019"/><circle cx="10" cy="10" r="8" fill="none" stroke="#262019" stroke-width="1"/></svg>';

  const festText = (d) =>
    (d.festivalsMl && d.festivalsMl.length ? d.festivalsMl
      : (d.festivalsEn && d.festivalsEn.length ? d.festivalsEn
        : (d.events || []))).join(", ");

  // ------------------------------------------------------------- rendering

  function render(doc) {
    const ml = doc.malayalam;
    const nb = neighbours(doc.month);
    const spanned = ml.monthsSpanned;
    const mlMonthText = spanned.map((m) => m.ml).join(" – ");
    const years = ml.kollavarshamYears.join("–");

    app.innerHTML = "";
    app.removeAttribute("aria-busy");
    const wrap = el("div", "wrap");

    // masthead
    const mast = el("div", "masthead");
    mast.appendChild(el("div", "stack-left",
      `<div class="era">Kollavarsham ${years}</div>` +
      `<h1 class="disp">${doc.gregorian.replace(/ (\d{4})$/, ' <em>$1</em>')}</h1>`
    ));
    mast.appendChild(el("div", "ml-months ml",
      `<div>${mlMonthText}</div><div class="yr disp">${years}</div>`
    ));
    wrap.appendChild(mast);

    // month nav
    const nav = el("div", "monthnav");
    const bPrev = el("button", null, "‹"); bPrev.disabled = !nb.prev;
    bPrev.addEventListener("click", () => { if (nb.prev) location.hash = `#/${nb.prev}`; });
    const bNext = el("button", null, "›"); bNext.disabled = !nb.next;
    bNext.addEventListener("click", () => { if (nb.next) location.hash = `#/${nb.next}`; });
    const mid = el("div", "middle");
    mid.appendChild(el("div", "cur disp", `${doc.gregorian} · ${mlMonthText}`));
    nav.append(bPrev, mid, bNext);
    wrap.appendChild(nav);

    // weekday header (Monday-start; Sat + Sun flagged)
    const wk = el("div", "weekdays");
    WD_ORDER.forEach((w) => {
      const s = el("span", (w === "Sat" || w === "Sun") ? "wknd" : null, w);
      wk.appendChild(s);
    });
    wrap.appendChild(wk);

    // grid / list
    const grid = el("div", "grid");
    for (let i = 0; i < ml.firstWeekday; i++) grid.appendChild(el("div", "cell empty"));
    ml.days.forEach((d, idx) => grid.appendChild(dayCell(d, idx === 0, doc)));
    wrap.appendChild(grid);

    // legend
    const leg = el("div", "legend disp");
    leg.innerHTML =
      `<span class="item">${MOON.full} Pournami</span>` +
      `<span class="item">${MOON.new} Amavasi</span>` +
      `<span>Kollavarsham date &amp; festivals in vermilion</span>` +
      `<span class="push">Tithi &amp; nakshatram end in nazhika–vinazhika from sunrise</span>`;
    wrap.appendChild(leg);

    app.appendChild(wrap);
  }

  function dayCell(d, isFirst, doc) {
    const wknd = d.wd === "Sun" ? "sun" : (d.wd === "Sat" ? "sat" : "");
    const cell = el("div", `cell clickable ${wknd}${d.monthStart ? " month-start" : ""}`);
    cell.addEventListener("click", () => openDetail(d, doc));

    const moon = d.moon ? MOON[d.moon] : "";
    const fest = festText(d);
    const festHtml = fest ? `<span class="fest ml">${esc(fest)}</span>` : "";

    // month tag: bold on a real month-start, muted label on the grid's first day
    let tag = "";
    if (d.monthStart) tag = `<span class="mtag">${esc(d.kvMonth.ml)} 1</span>`;
    else if (isFirst) tag = `<span class="mtag muted">${esc(d.kvMonth.ml)}</span>`;
    const kvHtml = d.monthStart ? "" : `<span class="kv">${d.kv}</span>`;

    // One structure. CSS reflows it per breakpoint:
    //  desktop -> .head above, .num left / .aside right, .pan pinned bottom
    //  phone   -> .num becomes the left date column, .head + .pan sit in a right block
    cell.innerHTML =
      `<div class="head">${kvHtml}${tag}</div>` +
      `<div class="num">` +
        `<span class="wd">${d.wd}</span>` +
        `<span class="date disp">${d.g}</span>` +
        `<span class="kv-b">${d.monthStart ? esc(d.kvMonth.ml) + " 1" : d.kv}</span>` +
      `</div>` +
      `<div class="aside">${moon}${festHtml}</div>` +
      `<div class="pan">` +
        `<div class="nak ml">${esc(d.nak.ml)} <span class="nz">${d.nak.endNazhika}</span>` +
          (moon ? `<span class="moon-slot">${moon}</span>` : "") +
        `</div>` +
        `<div class="tithi ml">${esc(d.tithi.ml)} <span class="nz">${d.tithi.endNazhika}</span></div>` +
        (fest ? `<div class="fest-line ml">${esc(fest)}</div>` : "") +
      `</div>`;
    return cell;
  }

  // ------------------------------------------------------------- detail

  function openDetail(d, doc) {
    const paksha = PAKSHA_ML[d.tithi.paksha] || "";
    const [gMonth, gYear] = doc.gregorian.split(" ");
    const nak2 = d.nak2
      ? `<div class="dd-row"><span class="k">Second nakshatram</span>` +
        `<span class="v"><span class="ml">${esc(d.nak2.ml)}</span> ` +
        `<span class="tl">ends ${d.nak2.endNazhika}</span></span></div>`
      : "";
    const fest = festText(d);
    const holiday = d.publicHoliday
      ? "Public holiday" : (d.bankHoliday ? "Bank holiday" : "—");

    dlg.innerHTML =
      `<button class="dd-close" aria-label="Close">×</button>` +
      `<div class="dd-head">` +
        `<div class="wd"><span class="disp">${WD_FULL[d.wd]}</span> · ` +
          `<span class="ml">${esc(d.wdMl)}</span></div>` +
        `<div class="big"><span class="date disp">${d.g}</span>` +
          `<span class="mo disp">${gMonth}<br>${gYear}</span></div>` +
      `</div>` +
      `<div class="dd-body">` +

        `<div class="dd-feature">` +
          `<div class="icon"><svg viewBox="0 0 40 40" width="26" height="26">` +
            `<path d="M20 2 L23.6 14.5 L36.5 14.5 L26 22.3 L29.8 34.8 L20 27 L10.2 34.8 L14 22.3 L3.5 14.5 L16.4 14.5 Z" fill="#262019"/>` +
          `</svg></div>` +
          `<div class="grow"><div class="lab">Nakshatram</div>` +
            `<div class="name">${esc(d.nak.ml)}</div></div>` +
          `<div class="end"><div class="n">${fmtNazhika(d.nak.endNazhika)}</div>` +
            `<div class="u">nazhika · vinazhika</div></div>` +
        `</div>` +

        `<div class="dd-feature">` +
          `<div class="icon"><svg viewBox="0 0 40 40" width="32" height="32">` +
            `<circle cx="20" cy="20" r="15.5" fill="none" stroke="#262019" stroke-width="1.2"/>` +
            `<path d="M20 6 a14 14 0 0 1 0 28 a9 14 0 0 0 0 -28" fill="#262019"/>` +
          `</svg></div>` +
          `<div class="grow"><div class="lab">Tithi ` +
            `<span class="ml">· ${paksha}</span></div>` +
            `<div class="name">${esc(d.tithi.ml)}</div></div>` +
          `<div class="end"><div class="n">${fmtNazhika(d.tithi.endNazhika)}</div>` +
            `<div class="u">nazhika · vinazhika</div></div>` +
        `</div>` +

        `<div class="dd-row"><span class="k">Malayalam month</span>` +
          `<span class="v"><span class="ml">${esc(d.kvMonth.ml)}</span> ` +
          `<span class="tl">${d.kvMonth.en}</span></span></div>` +
        `<div class="dd-row"><span class="k">Kollavarsham date</span>` +
          `<span class="v" style="color:var(--vermilion);font-family:Fraunces,Georgia,serif;font-size:17px">` +
          `${doc.malayalam.kollavarshamYears.join("–")} · ${d.kv}</span></div>` +
        `<div class="dd-row"><span class="k">Tithi number</span>` +
          `<span class="v disp">${d.tithi.num} <span style="color:var(--faint)">/ 30</span></span></div>` +
        `<div class="dd-row"><span class="k">Nakshatram (English)</span>` +
          `<span class="v disp">${d.nak.en}</span></div>` +
        nak2 +
        `<div class="dd-row"><span class="k">Tithi (English)</span>` +
          `<span class="v disp">${d.tithi.en}</span></div>` +
        `<div class="dd-row"><span class="k">Moon phase</span>` +
          `<span class="v" style="display:flex;align-items:center;gap:8px">` +
          `${HALF_MOON}<span class="disp" style="font-size:14px;color:#423b30">${moonText(d)}</span></span></div>` +
        `<div class="dd-row"><span class="k">Observances</span>` +
          `<span class="v ml" style="color:var(--vermilion);font-size:16px">${fest ? esc(fest) : "—"}</span></div>` +
        `<div class="dd-row"><span class="k">Bank / public holiday</span>` +
          `<span class="v disp" style="color:var(--muted);font-size:14px">${holiday}</span></div>` +

        `<div class="dd-foot"><div class="line"></div>` +
          `<span class="orn">&#10086;</span><div class="line"></div></div>` +
      `</div>`;

    dlg.querySelector(".dd-close").addEventListener("click", () => dlg.close());
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
  }

  dlg.addEventListener("click", (e) => {
    // click on the backdrop (outside the dialog's own box) closes it
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      dlg.close();
    }
  });

  function moonText(d) {
    if (d.moon === "full") return "Pournami · full moon";
    if (d.moon === "new") return "Amavasi · new moon";
    return d.tithi.paksha === "shukla" ? "Waxing" : "Waning";
  }

  const fmtNazhika = (s) =>
    (s || "").replace("-", '<span style="color:#c3b8a0">–</span>');

  const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  // ------------------------------------------------------------- routing

  function hashMonth() {
    const m = (location.hash || "").replace(/^#\/?/, "");
    return /^\d{4}-\d{2}$/.test(m) ? m : null;
  }

  function defaultMonth() {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return INDEX.months.includes(key) ? key : INDEX.months[0];
  }

  async function route() {
    const want = hashMonth() || defaultMonth();
    if (want === current && app.querySelector(".grid")) return;
    if (!INDEX.months.includes(want)) {
      app.innerHTML = `<div class="loading">No data for ${want}.</div>`;
      return;
    }
    current = want;
    if (dlg.open) dlg.close();
    try {
      const doc = await loadMonth(want);
      render(doc);
      // prefetch neighbours
      const nb = neighbours(want);
      [nb.prev, nb.next].forEach((m) => { if (m && !cache.has(m)) loadMonth(m).catch(() => {}); });
    } catch (err) {
      app.innerHTML = `<div class="loading">Could not load ${want}.<br>${esc(err.message)}</div>`;
    }
  }

  window.addEventListener("hashchange", route);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && dlg.open) dlg.close(); });

  // ------------------------------------------------------------- boot

  (async () => {
    try {
      const res = await fetch("data/index.json");
      INDEX = await res.json();
    } catch (err) {
      app.innerHTML = `<div class="loading">Could not load the calendar index.</div>`;
      return;
    }
    if (!hashMonth()) {
      history.replaceState(null, "", `#/${defaultMonth()}`);
    }
    route();
  })();
})();

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
    const lunarText = (ml.lunarMonthsSpanned || []).join(" – ");

    app.innerHTML = "";
    app.removeAttribute("aria-busy");
    const wrap = el("div", "wrap");

    // masthead — on mobile this is the dark header band with ‹ ›
    const mast = el("div", "masthead");
    const mhPrev = el("button", "mh-prev", "‹"); mhPrev.disabled = !nb.prev;
    mhPrev.title = "Previous month";
    mhPrev.addEventListener("click", () => { if (nb.prev) location.hash = `#/${nb.prev}`; });
    const mhNext = el("button", "mh-next", "›"); mhNext.disabled = !nb.next;
    mhNext.title = "Next month";
    mhNext.addEventListener("click", () => { if (nb.next) location.hash = `#/${nb.next}`; });
    mast.appendChild(mhPrev);
    mast.appendChild(el("div", "stack-left",
      `<h1 class="disp">${doc.gregorian.replace(/ (\d{4})$/, ' <em>$1</em>')}</h1>`
    ));
    mast.appendChild(el("div", "ml-months ml",
      `<span class="names">${mlMonthText}</span>` +
      (lunarText ? `<span class="lunar">${esc(lunarText)}</span>` : "") +
      `<span class="yr">${years}</span>`
    ));
    mast.appendChild(mhNext);
    wrap.appendChild(mast);

    // month nav — two rows:
    //   row 1:  ‹   August 2026 · <ML>   ›
    //   row 2:  [Today]   dd / mm / yyyy  [Go]
    const nav = el("div", "monthnav");

    const r1 = el("div", "nav-row nav-months");
    const bPrev = el("button", "arrow arrow-prev", "‹"); bPrev.disabled = !nb.prev;
    bPrev.title = "Previous month";
    bPrev.addEventListener("click", () => { if (nb.prev) location.hash = `#/${nb.prev}`; });
    const bNext = el("button", "arrow arrow-next", "›"); bNext.disabled = !nb.next;
    bNext.title = "Next month";
    bNext.addEventListener("click", () => { if (nb.next) location.hash = `#/${nb.next}`; });
    r1.append(bPrev, el("div", "cur",
      `<span class="disp">${doc.gregorian}</span>` +
      `<span class="dot">·</span>` +
      `<span class="ml">${esc(mlMonthText)}</span>`
    ), bNext);

    const r2 = el("div", "nav-row nav-jump");
    if (INDEX.months.includes(todayISO().slice(0, 7))) {
      const bToday = el("button", "today-btn disp", "Today");
      bToday.addEventListener("click", () => {
        if (location.hash.toLowerCase() === "#/today") route();  // re-route even if same month
        else location.hash = "#/today";
      });
      r2.appendChild(bToday);
    }
    r2.appendChild(buildGoto());

    nav.append(r1, r2);
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
    const cell = el("div", `cell clickable ${wknd}${d.monthStart ? " month-start" : ""}${d.date === todayISO() ? " today" : ""}`);
    // navigate to the day so the URL is shareable; route() opens the detail
    cell.addEventListener("click", () => { location.hash = `#/${d.date}`; });

    const moon = d.moon ? MOON[d.moon] : "";
    const fest = festText(d);
    const festHtml = fest ? `<span class="fest ml">${esc(fest)}</span>` : "";
    // Same text, second slot: the desktop cell shows it in .aside (top-right);
    // the phone list has no .aside, so it rides at the top of .pan in vermilion.
    const panFestHtml = fest ? `<div class="pan-fest ml">${esc(fest)}</div>` : "";
    // Sanskrit amanta lunar-month name, only on the day the month begins.
    const lunarHtml = d.lunarMonthStart
      ? `<span class="lunar-month">${esc(d.lunarMonthStart)}</span>` : "";

    // On a KV month-start day the KV date rides up to a strip in the content
    // column ("കുംഭം 1"), aligned with the nakshatram; the date column then
    // shows only the weekday + big Gregorian number. Every other day keeps the
    // KV day number under the big date in the date column.
    //  (grid's first day: also show the in-progress month, muted, no border.)
    let monthStrip = "";
    if (d.monthStart) {
      monthStrip = `<div class="mstrip ml">${esc(d.kvMonth.ml)} 1</div>`;
    } else if (isFirst) {
      monthStrip = `<div class="mstrip muted ml">${esc(d.kvMonth.ml)} ${d.kv}</div>`;
    }
    const kvUnderDate = (d.monthStart || isFirst) ? "" : `<span class="kv-b">${d.kv}</span>`;

    // month tag kept for the DESKTOP grid (top-right of the cell)
    let tag = "";
    if (d.monthStart) tag = `<span class="mtag">${esc(d.kvMonth.ml)} 1</span>`;
    else if (isFirst) tag = `<span class="mtag muted">${esc(d.kvMonth.ml)}</span>`;
    const kvHtml = d.monthStart ? "" : `<span class="kv">${d.kv}</span>`;

    // One structure, reflowed per breakpoint by CSS.
    cell.innerHTML =
      `<div class="head">${kvHtml}${tag}</div>` +
      `<div class="num">` +
        `<span class="wd">${d.wd}</span>` +
        `<span class="date disp">${d.g}</span>` +
        kvUnderDate +
      `</div>` +
      `<div class="aside">${lunarHtml}${moon}${festHtml}</div>` +
      `<div class="pan">` +
        monthStrip +
        (d.lunarMonthStart ? `<div class="pan-lunar">${esc(d.lunarMonthStart)}</div>` : "") +
        panFestHtml +
        `<div class="nak ml">${esc(d.nak.ml)} <span class="nz">${d.nak.endNazhika}</span>` +
          (moon ? `<span class="moon-slot">${moon}</span>` : "") +
        `</div>` +
        `<div class="tithi ml">${esc(d.tithi.ml)} <span class="nz">${d.tithi.endNazhika}</span></div>` +
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
            `<div class="name">${esc(d.nak.ml)}` +
              (d.nak.en ? ` <span class="en">${esc(d.nak.en)}</span>` : "") +
            `</div></div>` +
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
            `<div class="name">${esc(d.tithi.ml)}` +
              (d.tithi.en ? ` <span class="en">${esc(d.tithi.en)}</span>` : "") +
            `</div></div>` +
          `<div class="end"><div class="n">${fmtNazhika(d.tithi.endNazhika)}</div>` +
            `<div class="u">nazhika · vinazhika</div></div>` +
        `</div>` +

        `<div class="dd-row"><span class="k">Malayalam month</span>` +
          `<span class="v"><span class="ml">${esc(d.kvMonth.ml)}</span> ` +
          `<span class="tl">${d.kvMonth.en}</span></span></div>` +
        (d.lunarMonth
          ? `<div class="dd-row"><span class="k">Lunar month</span>` +
            `<span class="v disp">${esc(d.lunarMonth)}</span></div>`
          : "") +
        `<div class="dd-row"><span class="k">Kollavarsham date</span>` +
          `<span class="v" style="color:var(--vermilion);font-family:Fraunces,Georgia,serif;font-size:17px">` +
          `${doc.malayalam.kollavarshamYears.join("–")} · ${d.kv}</span></div>` +
        `<div class="dd-row"><span class="k">Tithi number</span>` +
          `<span class="v disp">${d.tithi.num} <span style="color:var(--faint)">/ 30</span></span></div>` +
        nak2 +
        `<div class="dd-row"><span class="k">Moon phase</span>` +
          `<span class="v" style="display:flex;align-items:center;gap:8px">` +
          `${HALF_MOON}<span class="disp" style="font-size:14px;color:#423b30">${moonText(d)}</span></span></div>` +
        `<div class="dd-row"><span class="k">Observances</span>` +
          `<span class="v ml" style="color:var(--vermilion);font-size:16px">${fest ? esc(fest) : "—"}</span></div>` +
        `<div class="dd-row"><span class="k">Bank / public holiday</span>` +
          `<span class="v disp" style="color:var(--muted);font-size:14px">${holiday}</span></div>` +
        `<div class="dd-back">` +
          `<button class="today-btn disp" type="button">&#8249;&nbsp; Back to calendar</button>` +
        `</div>` +
      `</div>`;

    dlg.querySelector(".dd-close").addEventListener("click", closeDetail);
    dlg.querySelector(".dd-back .today-btn").addEventListener("click", closeDetail);
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
  }

  // Closing the day view returns the URL to the month (so a shared #/today link
  // still lands on the day, but the browser Back button and the × both step out).
  function closeDetail() {
    if (current && parseHash().day) {
      history.replaceState(null, "", `#/${current}`);
    }
    dlg.close();
  }

  dlg.addEventListener("click", (e) => {
    // click on the backdrop (outside the dialog's own box) closes it
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      closeDetail();
    }
  });
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); closeDetail(); });

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

  const todayISO = () => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}` +
           `-${String(n.getDate()).padStart(2, "0")}`;
  };

  // Parse the hash into { month, day? }.
  //   #/2026-01        -> a month
  //   #/2026-01-15     -> a month + a day to open
  //   #/today          -> today's date, resolved now
  function parseHash() {
    let h = (location.hash || "").replace(/^#\/?/, "").trim().toLowerCase();
    if (h === "today") h = todayISO();
    let m = /^(\d{4}-\d{2})-(\d{2})$/.exec(h);
    if (m) return { month: m[1], day: `${m[1]}-${m[2]}` };
    if (/^\d{4}-\d{2}$/.test(h)) return { month: h, day: null };
    return { month: null, day: null };
  }

  function hashMonth() {
    return parseHash().month;
  }

  // d, m, y numbers -> "YYYY-MM-DD", or null if not a real calendar date
  function toISO(d, m, y) {
    if (y < 100) y += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2999) return null;
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // <form class="goto"> with dd / mm / yyyy fields.
  // Auto-advance when a field fills, auto-retreat on backspace in an empty field.
  function buildGoto() {
    const f = el("form", "goto");
    f.innerHTML =
      `<input class="gd" type="text" inputmode="numeric" autocomplete="off" ` +
        `maxlength="2" placeholder="dd" aria-label="Day">` +
      `<span class="sep">/</span>` +
      `<input class="gm" type="text" inputmode="numeric" autocomplete="off" ` +
        `maxlength="2" placeholder="mm" aria-label="Month">` +
      `<span class="sep">/</span>` +
      `<input class="gy" type="text" inputmode="numeric" autocomplete="off" ` +
        `maxlength="4" placeholder="yyyy" aria-label="Year">` +
      `<button type="submit" class="disp">Go</button>`;
    const fields = [...f.querySelectorAll("input")];

    f.addEventListener("input", (e) => {
      const inp = e.target;
      inp.value = inp.value.replace(/\D/g, "");           // digits only
      f.classList.remove("bad");
      const i = fields.indexOf(inp);
      if (inp.value.length >= inp.maxLength && i < fields.length - 1) {
        fields[i + 1].focus();
        fields[i + 1].select();
      }
    });
    f.addEventListener("keydown", (e) => {
      const inp = e.target;
      const i = fields.indexOf(inp);
      if (i < 0) return;
      if (e.key === "Backspace" && inp.selectionStart === 0 && inp.selectionEnd === 0 && i > 0) {
        e.preventDefault();
        const prev = fields[i - 1];
        prev.focus();
        prev.setSelectionRange(prev.value.length, prev.value.length);
      } else if (e.key === "ArrowLeft" && inp.selectionStart === 0 && i > 0) {
        fields[i - 1].focus();
      } else if (e.key === "ArrowRight" && inp.selectionStart === inp.value.length && i < fields.length - 1) {
        fields[i + 1].focus();
      }
    });
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const [d, m, y] = fields.map((x) => Number(x.value));
      const iso = fields.every((x) => x.value) ? toISO(d, m, y) : null;
      if (!iso) { f.classList.add("bad"); fields[0].focus(); return; }
      fields.forEach((x) => (x.value = ""));
      fields[0].focus();
      location.hash = `#/${iso}`;
    });
    return f;
  }

  function defaultMonth() {
    const key = todayISO().slice(0, 7);
    return INDEX.months.includes(key) ? key : INDEX.months[0];
  }

  async function route() {
    const { month, day } = parseHash();
    const want = month || defaultMonth();
    if (!INDEX.months.includes(want)) {
      const lo = INDEX.months[0], hi = INDEX.months[INDEX.months.length - 1];
      app.innerHTML =
        `<div class="loading">No calendar data for ${esc(day || want)}.<br>` +
        `Available: ${esc(lo)} to ${esc(hi)}.</div>`;
      return;
    }

    const monthChanged = want !== current || !app.querySelector(".grid");
    current = want;

    try {
      const doc = await loadMonth(want);
      if (monthChanged) {
        if (dlg.open) dlg.close();
        render(doc);
        const nb = neighbours(want);
        [nb.prev, nb.next].forEach((m) => { if (m && !cache.has(m)) loadMonth(m).catch(() => {}); });
      }
      // open a specific day if the hash named one
      if (day) {
        const rec = (doc.malayalam.days || []).find((d) => d.date === day);
        if (rec) openDetail(rec, doc);
        else if (dlg.open) dlg.close();
      } else if (dlg.open) {
        dlg.close();
      }
    } catch (err) {
      app.innerHTML = `<div class="loading">Could not load ${esc(want)}.<br>${esc(err.message)}</div>`;
    }
  }

  window.addEventListener("hashchange", route);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && dlg.open) closeDetail(); });

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

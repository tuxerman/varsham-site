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

  // English gloss for the observances row, only when it differs from the
  // Malayalam text we're already showing.
  const festTextEn = (d) => {
    if (!(d.festivalsMl && d.festivalsMl.length)) return "";
    if (!(d.festivalsEn && d.festivalsEn.length)) return "";
    const en = d.festivalsEn.join(", ");
    return en === d.festivalsMl.join(", ") ? "" : en;
  };

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

    // month nav — one row, all controls equal weight:
    //   ‹   [Today]   [ September 2026 · <ML> ▾ ]   ›
    // The middle button opens a month/year picker (buildMonthPicker) instead
    // of the old dd/mm/yyyy triplet. Today sits beside it, same pill style,
    // so the row reads as one "jump to" cluster rather than a stray link.
    // A future free-text search slots in here too, as another equal pill.
    const nav = el("div", "monthnav");
    const r1 = el("div", "nav-row nav-jump");

    const bPrev = el("button", "arrow arrow-prev", "‹"); bPrev.disabled = !nb.prev;
    bPrev.title = "Previous month";
    bPrev.addEventListener("click", () => { if (nb.prev) location.hash = `#/${nb.prev}`; });
    const bNext = el("button", "arrow arrow-next", "›"); bNext.disabled = !nb.next;
    bNext.title = "Next month";
    bNext.addEventListener("click", () => { if (nb.next) location.hash = `#/${nb.next}`; });

    r1.appendChild(bPrev);

    if (INDEX.months.includes(todayISO().slice(0, 7))) {
      const bToday = el("button", "today-btn disp", "Today");
      bToday.addEventListener("click", () => {
        if (location.hash.toLowerCase() === "#/today") route();  // re-route even if same month
        else location.hash = "#/today";
      });
      r1.appendChild(bToday);
    }

    r1.appendChild(buildMonthPicker(doc.month, doc.gregorian, mlMonthText));
    r1.appendChild(bNext);

    nav.appendChild(r1);
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
      `<span class="item">${MOON.full} Purnima</span>` +
      `<span class="item">${MOON.new} Amavasya</span>` +
      `<span>Kollavarsham date &amp; festivals in vermilion</span>` +
      `<span class="push">Tithi &amp; nakshatram end in nazhika–vinazhika from sunrise</span>`;
    wrap.appendChild(leg);

    app.appendChild(wrap);
  }

  function dayCell(d, isFirst, doc) {
    const wknd = d.wd === "Sun" ? "sun" : (d.wd === "Sat" ? "sat" : "");
    const cell = el("div", `cell clickable ${wknd}${d.monthStart ? " month-start" : ""}${d.lunarMonthStart ? " lunar-start" : ""}${d.date === todayISO() ? " today" : ""}`);
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
      ? `<div class="dd-row wide sep"><span class="k">Second nakshatram</span>` +
        `<span class="v"><span class="ml">${esc(d.nak2.ml)}</span>` +
        (d.nak2.en ? ` <span class="en">${esc(d.nak2.en)}</span>` : "") +
        ` <span class="tl">ends ${d.nak2.endNazhika}</span></span></div>`
      : "";
    const fest = festText(d);
    const festEn = festTextEn(d);
    const holiday = d.publicHoliday
      ? "Public" : (d.bankHoliday ? "Bank" : "—");

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
            `</div>` +
            `<div class="meta">` +
              `<div class="mrow"><span class="n">${fmtNazhika(d.nak.endNazhika)}</span> ` +
                `<span class="u">nazhika · vinazhika</span></div>` +
              `<div class="ends">${nazhikaToHM(d.nak.endNazhika)}</div>` +
            `</div></div>` +
        `</div>` +

        `<div class="dd-feature">` +
          `<div class="icon"><svg viewBox="0 0 40 40" width="30" height="30">` +
            `<circle cx="20" cy="20" r="14" fill="none" stroke="#262019" stroke-width="1.5"/>` +
            `<circle cx="15" cy="16" r="2.2" fill="#262019"/>` +
            `<circle cx="24" cy="22" r="3" fill="#262019"/>` +
            `<circle cx="18" cy="26" r="1.6" fill="#262019"/>` +
          `</svg></div>` +
          `<div class="grow"><div class="lab">Tithi</div>` +
            `<div class="name">${esc(d.tithi.ml)}` +
              (d.tithi.en ? ` <span class="en">${esc(d.tithi.en)}</span>` : "") +
              (paksha ? ` <span class="paksha ml">· ${paksha}</span>` : "") +
            `</div>` +
            `<div class="meta">` +
              `<div class="mrow"><span class="n">${fmtNazhika(d.tithi.endNazhika)}</span> ` +
                `<span class="u">nazhika · vinazhika</span></div>` +
              `<div class="ends">${nazhikaToHM(d.tithi.endNazhika)}</div>` +
            `</div></div>` +
        `</div>` +

        `<div class="dd-grid">` +
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
          `<span class="v disp">${d.tithi.num} <span style="color:var(--faint)">/ 30</span>` +
          `<span class="tl"> · ${moonPhaseShort(d)}</span></span></div>` +
        nak2 +
        `<div class="dd-row wide${d.nak2 ? "" : " sep"}"><span class="k">Observances</span>` +
          `<span class="v ml" style="color:var(--vermilion);font-size:16px">${fest ? esc(fest) : "—"}` +
          (festEn ? ` <span class="en">${esc(festEn)}</span>` : "") +
          `</span></div>` +
        `<div class="dd-row wide"><span class="k">Holiday</span>` +
          `<span class="v disp" style="color:var(--muted);font-size:14px">${holiday}</span></div>` +
        `</div>` +
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
    if (d.moon === "full") return "Purnima · full moon";
    if (d.moon === "new") return "Amavasya · new moon";
    return d.tithi.paksha === "shukla" ? "Waxing" : "Waning";
  }

  // short phase for the inline "tithi number" cell: no "· full moon" tail
  function moonPhaseShort(d) {
    if (d.moon === "full") return "Purnima";
    if (d.moon === "new") return "Amavasya";
    return d.tithi.paksha === "shukla" ? "waxing" : "waning";
  }

  const fmtNazhika = (s) =>
    (s || "").replace("-", '<span style="color:#c3b8a0">–</span>');

  // "NN-VV" nazhika–vinazhika is a pure duration after sunrise:
  //   1 nazhika = 24 min, 1 vinazhika = 24 s (1/60 nazhika).
  // So this converts to clock hours/minutes without needing the sunrise time.
  // (The Malayalam day runs sunrise-to-sunrise, so a value past ~18h ends
  // after midnight, still before the next sunrise.)
  function nazhikaHM(s) {
    const m = /^(\d+)-(\d+)$/.exec((s || "").trim());
    if (!m) return "";
    const mins = Math.round((+m[1]) * 24 + (+m[2]) * 0.4);
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }
  const nazhikaToHM = (s) =>
    nazhikaHM(s) ? `Ends ${nazhikaHM(s)} after sunrise` : "";

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

  const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Which picker tab the trigger last opened. Kept across renders so someone
  // who thinks in Kollavarsham isn't re-picking "Malayalam" every time.
  let pickerTab = "en";  // "en" | "ml" | "lunar"

  // Malayalam solar month number (Chingam = 1) — only used to work out which
  // Kollavarsham year a month-start day belongs to for its caption.
  const ML_MONTH_NO = {
    Chingam: 1, Kanni: 2, Thulam: 3, Vrischikam: 4, Dhanu: 5, Makaram: 6,
    Kumbham: 7, Meenam: 8, Medam: 9, Edavam: 10, Mithunam: 11, Karkidakam: 12,
  };

  // ---- month-start index (built lazily, per Gregorian year) -----------------
  //
  // All three tabs navigate to a Gregorian "YYYY-MM" and all three step by
  // Gregorian year — the English tab directly, the other two by "the Gregorian
  // month this Malayalam / lunar month begins in". That mapping isn't in
  // index.json, but every month file already carries it per-day (d.monthStart
  // + d.kvMonth, d.lunarMonthStart), so we derive it: on first open of a
  // non-English tab for year Y we fetch that year's ~12 month files (tiny, and
  // cached for calendar nav anyway) and scan their days. Both lists come out
  // in Gregorian-date order. Result shape, cached in monthStarts.get(Y):
  //   { ml:    [{ date, monthKey, en, ml, kvYear }],   // KV solar months
  //     lunar: [{ date, monthKey, name, adhika }] }      // Sanskrit amanta
  const monthStarts = new Map();

  async function buildYearStarts(year) {
    if (monthStarts.has(year)) return monthStarts.get(year);
    const keys = INDEX.months.filter((m) => m.startsWith(String(year) + "-"));
    const docs = await Promise.all(keys.map((k) => loadMonth(k).catch(() => null)));
    const ml = [], lunar = [];
    const seenLunar = new Set();
    docs.forEach((doc) => {
      if (!doc) return;
      const kvSpan = doc.malayalam.kollavarshamYears || [];
      (doc.malayalam.days || []).forEach((d) => {
        if (d.monthStart && d.kvMonth) {
          // KV year shown as an inline caption only (no grouping). A KV year
          // runs Chingam→Karkidakam, so in a file spanning two (…, N+1) the
          // month is the later year iff it's Chingam or after.
          const later = ML_MONTH_NO[d.kvMonth.en] >= ML_MONTH_NO.Chingam;
          const kvYear = kvSpan.length === 2 ? (later ? kvSpan[1] : kvSpan[0]) : kvSpan[0];
          ml.push({ date: d.date, monthKey: doc.month, ml: d.kvMonth.ml, kvYear });
        }
        if (d.lunarMonthStart) {
          // An adhika masa repeats the name within the year; tag the 2nd+.
          const adhika = seenLunar.has(d.lunarMonthStart);
          seenLunar.add(d.lunarMonthStart);
          lunar.push({ date: d.date, monthKey: doc.month, name: d.lunarMonthStart, adhika });
        }
      });
    });
    ml.sort((a, b) => a.date < b.date ? -1 : 1);
    lunar.sort((a, b) => a.date < b.date ? -1 : 1);
    const out = { ml, lunar };
    monthStarts.set(year, out);
    return out;
  }

  const fmtStartWhen = (iso) => {
    const [, mm, dd] = iso.split("-");
    return `${MONTH_ABBR[Number(mm) - 1]} <em>${Number(dd)}</em>`;
  };

  // Trigger button + popover that replaces the old dd/mm/yyyy typing form.
  // Trigger shows the current month (Gregorian + Malayalam, same info the
  // masthead already states); the popover has three tabs — English (a 3x4
  // Gregorian-month grid, clamped to what INDEX has), Malayalam (Kollavarsham
  // months as a list), Lunar (Sanskrit amanta months as a list). Picking any
  // entry routes to a Gregorian "YYYY-MM". On phones the panel is a bottom
  // sheet (see .picker-panel in the max-width:640px block).
  function buildMonthPicker(monthKey, gregorianText, mlText) {
    const wrap = el("div", "picker");
    const trigger = el("button", "picker-trigger disp", "");
    trigger.type = "button";
    trigger.setAttribute("aria-haspopup", "true");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML =
      `<span class="pt-main">${esc(gregorianText)}</span>` +
      `<span class="pt-dot">•</span>` +
      `<span class="pt-ml ml">${esc(mlText)}</span>` +
      `<svg class="pt-caret" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`;
    wrap.appendChild(trigger);

    let panel = null, scrim = null;
    let panelYear = Number(monthKey.slice(0, 4));

    const closePanel = () => {
      if (!panel) return;
      panel.remove();
      if (scrim) { scrim.remove(); scrim = null; }
      panel = null;
      document.body.classList.remove("sheet-open");
      trigger.setAttribute("aria-expanded", "false");
      document.removeEventListener("mousedown", onOutside, true);
      document.removeEventListener("keydown", onKey, true);
    };
    const onOutside = (e) => {
      if (!wrap.contains(e.target) && !(scrim && scrim.contains(e.target) && e.target !== scrim)) {
        if (!panel || !panel.contains(e.target)) closePanel();
      }
    };
    const onKey = (e) => { if (e.key === "Escape") { closePanel(); trigger.focus(); } };

    const go = (key) => { closePanel(); location.hash = `#/${key}`; };

    const renderHead = (label) => {
      const hasPrev = INDEX.months.some((m) => Number(m.slice(0, 4)) < panelYear);
      const hasNext = INDEX.months.some((m) => Number(m.slice(0, 4)) > panelYear);
      const head = el("div", "picker-head");
      const yPrev = el("button", "picker-yr-nav", "‹"); yPrev.type = "button"; yPrev.disabled = !hasPrev;
      const yNext = el("button", "picker-yr-nav", "›"); yNext.type = "button"; yNext.disabled = !hasNext;
      yPrev.addEventListener("click", () => { panelYear -= 1; renderBody(); });
      yNext.addEventListener("click", () => { panelYear += 1; renderBody(); });
      head.append(yPrev, el("span", "picker-yr disp", label), yNext);
      return head;
    };

    const renderEnglish = (body) => {
      const yearMonths = INDEX.months.filter((m) => m.startsWith(String(panelYear) + "-"));
      body.appendChild(renderHead(String(panelYear)));
      const grid = el("div", "picker-grid");
      for (let mo = 1; mo <= 12; mo++) {
        const key = `${panelYear}-${String(mo).padStart(2, "0")}`;
        const has = yearMonths.includes(key);
        const btn = el("button", `picker-mo disp${key === monthKey ? " current" : ""}`, MONTH_ABBR[mo - 1]);
        btn.type = "button";
        if (!has) btn.disabled = true;
        else btn.addEventListener("click", () => go(key));
        grid.appendChild(btn);
      }
      body.appendChild(grid);
    };

    const renderList = (body, kind) => {
      body.appendChild(renderHead(String(panelYear)));
      const list = el("div", "picker-list");
      list.appendChild(el("div", "picker-loading disp", "Loading…"));
      body.appendChild(list);
      buildYearStarts(panelYear).then((starts) => {
        // guard against a fast year-flick landing an old result
        if (!panel || !body.isConnected) return;
        const rows = kind === "ml" ? starts.ml : starts.lunar;
        list.innerHTML = "";
        if (!rows.length) {
          list.appendChild(el("div", "picker-loading disp", "No data for this year."));
          return;
        }
        rows.forEach((r) => {
          const row = el("button",
            `picker-row${r.monthKey === monthKey ? " current" : ""}${r.adhika ? " adhika" : ""}`);
          row.type = "button";
          const name = kind === "ml"
            ? `<span class="r-name ml">${esc(r.ml)}</span>`
            : `<span class="r-name latin disp">${esc(r.name)}</span>`;
          const kv = (kind === "ml" && r.kvYear)
            ? `<span class="r-kv disp">${esc(String(r.kvYear))}</span>` : "";
          row.innerHTML =
            `<span class="r-lead">${name}${kv}</span>` +
            `<span class="r-when disp">${fmtStartWhen(r.date)}</span>`;
          row.addEventListener("click", () => go(r.monthKey));
          list.appendChild(row);
        });
        // bring the current month into view (the list can be a screenful)
        const cur = list.querySelector(".picker-row.current");
        if (cur) cur.scrollIntoView({ block: "center" });
      });
    };

    const renderBody = () => {
      const body = panel.querySelector(".picker-body");
      body.innerHTML = "";
      if (pickerTab === "ml") renderList(body, "ml");
      else if (pickerTab === "lunar") renderList(body, "lunar");
      else renderEnglish(body);
    };

    const renderPanel = () => {
      panel.innerHTML = "";
      if (scrim) panel.appendChild(el("div", "sheet-grip"));
      if (scrim) panel.appendChild(el("div", "sheet-title disp", "Jump to month"));

      const tabs = el("div", "picker-tabs");
      tabs.setAttribute("role", "tablist");
      const TABDEF = [
        { id: "en", label: "English" },
        { id: "ml", label: "Malayalam" },
        { id: "lunar", label: "Lunar" },
      ];
      TABDEF.forEach((t) => {
        const b = el("button", "picker-tab disp", esc(t.label));
        b.type = "button";
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", String(pickerTab === t.id));
        b.addEventListener("click", () => {
          if (pickerTab === t.id) return;
          pickerTab = t.id;
          panelYear = Number(monthKey.slice(0, 4));
          tabs.querySelectorAll(".picker-tab").forEach((x, i) =>
            x.setAttribute("aria-selected", String(TABDEF[i].id === pickerTab)));
          renderBody();
        });
        tabs.appendChild(b);
      });
      panel.appendChild(tabs);

      panel.appendChild(el("div", "picker-body"));
      renderBody();

      if (scrim) {
        const close = el("button", "sheet-close disp", "Close");
        close.type = "button";
        close.addEventListener("click", () => { closePanel(); trigger.focus(); });
        panel.appendChild(close);
      }
    };

    trigger.addEventListener("click", () => {
      if (panel) { closePanel(); return; }
      panelYear = Number(monthKey.slice(0, 4));
      const sheet = window.matchMedia("(max-width: 640px)").matches;
      if (sheet) {
        // Bottom sheet: scrim + panel both live inside .picker so every
        // existing `.monthnav .picker-*` rule still applies; the sheet CSS
        // (in the max-width:640px block) makes the scrim position:fixed.
        scrim = el("div", "picker-scrim");
        scrim.addEventListener("click", (e) => { if (e.target === scrim) { closePanel(); trigger.focus(); } });
        panel = el("div", "picker-panel is-sheet");
        scrim.appendChild(panel);
        wrap.appendChild(scrim);
        document.body.classList.add("sheet-open");
      } else {
        panel = el("div", "picker-panel");
        wrap.appendChild(panel);
      }
      renderPanel();
      trigger.setAttribute("aria-expanded", "true");
      document.addEventListener("mousedown", onOutside, true);
      document.addEventListener("keydown", onKey, true);
    });

    return wrap;
  }

  function defaultMonth() {
    const key = todayISO().slice(0, 7);
    return INDEX.months.includes(key) ? key : INDEX.months[0];
  }

  // On phones the day list is long; after rendering the current month with no
  // Phone-only list positioning after a month renders:
  //   - current month, no day open -> glide today's row under the pinned band
  //   - any other month            -> return to the top (Today / month picker)
  // Desktop grid barely scrolls, so this is a no-op there.
  function positionMonthList(want, hasDay) {
    if (!window.matchMedia("(max-width: 640px)").matches) return;
    if (want !== todayISO().slice(0, 7) || hasDay) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const cell = app.querySelector(".cell.today");
    if (!cell) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const header = document.querySelector(".site-header");
    const band = document.querySelector(".masthead");
    const pinned =
      (header ? header.getBoundingClientRect().height : 0) +
      (band ? band.getBoundingClientRect().height : 0);
    const y = cell.getBoundingClientRect().top + window.scrollY - pinned - 8;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }

  async function route(isBoot) {
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
      // on phones, re-position the freshly rendered month list (scroll to
      // today for the current month, back to the top for any other).
      if ((isBoot || monthChanged) && !day) {
        requestAnimationFrame(() => positionMonthList(want, false));
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
    route(true);
  })();
})();

/* ==========================================================================
   UK Grid: Live+ - shared behaviour
   ========================================================================== */

(function () {
  "use strict";

  /* ---------- Theme: follows the system by default, with a Light/Dark override ----------
     Three states cycled by the toggle button: "system" (default - follows the OS/browser
     colour-scheme preference and updates live if it changes) → "light" → "dark" → back to
     "system". Only "light"/"dark" are ever persisted; "system" means no stored preference. */
  const THEME_KEY = "grid-live-theme";
  const THEME_ORDER = ["system", "light", "dark"];
  const THEME_LABEL = { system: "System", light: "Light mode", dark: "Dark mode" };
  const root = document.documentElement;
  let currentTheme = "system";

  function systemPrefersDark() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function applyTheme(theme) {
    if (!THEME_ORDER.includes(theme)) theme = "system";
    currentTheme = theme;
    if (theme === "dark" || theme === "light") {
      root.setAttribute("data-theme", theme);
    } else {
      root.removeAttribute("data-theme");
    }
    const btn = document.querySelector("[data-theme-toggle]");
    if (btn) {
      const isDark = theme === "dark" || (theme === "system" && systemPrefersDark());
      btn.removeAttribute("aria-pressed"); // not a true binary toggle - 3 states, conveyed via the visible/announced label
      btn.dataset.themeActive = isDark ? "dark" : "light";
      btn.dataset.themeState = theme;
      const label = btn.querySelector("[data-theme-label]");
      if (label) {
        label.textContent = THEME_LABEL[theme];
        label.setAttribute("aria-live", "polite");
      }
    }
  }

  function initTheme() {
    let stored = localStorage.getItem(THEME_KEY);
    if (stored !== "light" && stored !== "dark") stored = "system";
    applyTheme(stored);

    const btn = document.querySelector("[data-theme-toggle]");
    if (btn) {
      btn.addEventListener("click", () => {
        const idx = THEME_ORDER.indexOf(currentTheme);
        const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
        if (next === "system") localStorage.removeItem(THEME_KEY);
        else localStorage.setItem(THEME_KEY, next);
        applyTheme(next);
        if (window.GridPreview && window.GridPreview.redrawAll) {
          setTimeout(window.GridPreview.redrawAll, 50);
        }
      });
    }

    // Live-update when following the system and the OS preference changes mid-session
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (currentTheme === "system") {
        applyTheme("system");
        if (window.GridPreview && window.GridPreview.redrawAll) {
          setTimeout(window.GridPreview.redrawAll, 50);
        }
      }
    };
    if (mql.addEventListener) mql.addEventListener("change", onSystemChange);
    else if (mql.addListener) mql.addListener(onSystemChange); // older Safari
  }

  /* ---------- Site navigation: hamburger + grouped dropdown/accordion ---------- */
  function initNav() {
    const navToggle = document.querySelector("[data-nav-toggle]");
    const navList = document.querySelector("[data-nav-list]");
    const groupToggles = Array.from(document.querySelectorAll("[data-nav-group]"));
    const navEl = document.querySelector(".site-nav");

    function closeAllGroups(exceptBtn) {
      groupToggles.forEach((btn) => {
        if (btn === exceptBtn) return;
        const menu = document.getElementById(btn.getAttribute("aria-controls"));
        btn.setAttribute("aria-expanded", "false");
        if (menu) menu.classList.remove("is-open");
      });
    }

    function closeMobileNav() {
      closeAllGroups();
      if (!navToggle || !navList) return;
      navToggle.setAttribute("aria-expanded", "false");
      navList.classList.remove("is-open");
    }

    if (navToggle && navList) {
      navToggle.addEventListener("click", () => {
        const isOpen = !navList.classList.contains("is-open");
        navList.classList.toggle("is-open", isOpen);
        navToggle.setAttribute("aria-expanded", String(isOpen));
        if (!isOpen) closeAllGroups();
      });
    }

    groupToggles.forEach((btn) => {
      const menu = document.getElementById(btn.getAttribute("aria-controls"));
      if (!menu) return;
      btn.addEventListener("click", () => {
        const willOpen = !menu.classList.contains("is-open");
        closeAllGroups(willOpen ? btn : undefined);
        menu.classList.toggle("is-open", willOpen);
        btn.setAttribute("aria-expanded", String(willOpen));
      });
    });

    document.addEventListener("click", (e) => {
      if (navEl && !navEl.contains(e.target)) {
        closeMobileNav();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const openGroupBtn = groupToggles.find((b) => b.getAttribute("aria-expanded") === "true");
      if (openGroupBtn) {
        closeAllGroups();
        openGroupBtn.focus();
      } else if (navToggle && navToggle.getAttribute("aria-expanded") === "true") {
        closeMobileNav();
        navToggle.focus();
      }
    });

    let navResizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(navResizeTimer);
      navResizeTimer = setTimeout(closeMobileNav, 150);
    });
  }

  /* ---------- Accessible tabs (time ranges) ---------- */
  function initTabs() {
    document.querySelectorAll("[data-tablist]").forEach((tablist) => {
      const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
      const panels = tabs.map((tab) =>
        document.getElementById(tab.getAttribute("aria-controls"))
      );

      function select(index) {
        tabs.forEach((tab, i) => {
          const selected = i === index;
          tab.setAttribute("aria-selected", String(selected));
          tab.tabIndex = selected ? 0 : -1;
          if (panels[i]) panels[i].hidden = !selected;
        });
        tabs[index].focus();
        const range = tabs[index].getAttribute("data-range");
        tablist.dispatchEvent(
          new CustomEvent("rangechange", { detail: { range }, bubbles: true })
        );
      }

      tabs.forEach((tab, i) => {
        tab.addEventListener("click", () => {
          tabs.forEach((t, j) => {
            t.setAttribute("aria-selected", String(j === i));
            t.tabIndex = j === i ? 0 : -1;
            if (panels[j]) panels[j].hidden = j !== i;
          });
          const range = tab.getAttribute("data-range");
          tablist.dispatchEvent(
            new CustomEvent("rangechange", { detail: { range }, bubbles: true })
          );
        });
        tab.addEventListener("keydown", (e) => {
          let newIndex = null;
          if (e.key === "ArrowRight") newIndex = (i + 1) % tabs.length;
          if (e.key === "ArrowLeft") newIndex = (i - 1 + tabs.length) % tabs.length;
          if (e.key === "Home") newIndex = 0;
          if (e.key === "End") newIndex = tabs.length - 1;
          if (newIndex !== null) {
            e.preventDefault();
            select(newIndex);
          }
        });
      });
    });
  }

  /* ---------- Placeholder data generation (used before live data exists) ---------- */
  const RANGE_CONFIG = {
    "3hour": { points: 13, label: "Last 3 hours", stepMs: 15 * 60 * 1000, fmt: "time" },
    day: { points: 48, label: "Past day", stepMs: 30 * 60 * 1000, fmt: "time" },
    week: { points: 56, label: "Past week", stepMs: 3 * 60 * 60 * 1000, fmt: "day" },
    month: { points: 30, label: "Past month", stepMs: 24 * 60 * 60 * 1000, fmt: "date" },
    season: { points: 13, label: "Past season", stepMs: 7 * 24 * 60 * 60 * 1000, fmt: "date" },
    year: { points: 52, label: "Past year", stepMs: 7 * 24 * 60 * 60 * 1000, fmt: "month" },
    "5year": { points: 60, label: "Past 5 years", stepMs: 30 * 24 * 60 * 60 * 1000, fmt: "yearmonth" },
    "10year": { points: 40, label: "Past 10 years", stepMs: 91 * 24 * 60 * 60 * 1000, fmt: "year" },
    all: { points: 15, label: "All time", stepMs: 365 * 24 * 60 * 60 * 1000, fmt: "year" },
  };

  /**
   * The UK meteorological season containing `now` (Met Office definition:
   * Winter = Dec-Feb, Spring = Mar-May, Summer = Jun-Aug, Autumn = Sep-Nov).
   * Winter's label spans both calendar years it covers ("Winter 2025/26"),
   * matching the convention already used for the winter peak-demand record
   * on the homepage. Keep in sync with ukgrid_current_uk_season() in
   * api/_bootstrap.php - the "Season" range tab uses this on the frontend
   * for labels and mock/illustrative data, while the backend uses its own
   * copy to bound the real SQL query, so the two must agree.
   */
  function getCurrentUkSeason(now) {
    return getUkSeasonBounds(0, now);
  }

  /**
   * Generalised version of getCurrentUkSeason(): the UK meteorological
   * season containing `now`, shifted back by `yearOffset` whole years
   * (0 = the current season in progress, -1 = the same season last year,
   * etc). Used by the History page's "compare seasons" checkbox to fetch
   * and label a prior year's equivalent season. For yearOffset === 0 the
   * season is still in progress, so `end` is just `now`; for any other
   * offset the season has already fully elapsed, so `end` is that
   * season's own natural close (the moment before the next season
   * begins). Keep in sync with ukgrid_uk_season_bounds() in
   * api/_bootstrap.php.
   */
  function getUkSeasonBounds(yearOffset, now) {
    yearOffset = yearOffset || 0;
    const d = now ? new Date(now) : new Date();
    const m = d.getMonth() + 1; // 1-12
    const y = d.getFullYear();
    let name, startYear, startMonth;
    if (m === 12 || m <= 2) {
      name = "Winter";
      startYear = m === 12 ? y : y - 1;
      startMonth = 12;
    } else if (m <= 5) {
      name = "Spring"; startYear = y; startMonth = 3;
    } else if (m <= 8) {
      name = "Summer"; startYear = y; startMonth = 6;
    } else {
      name = "Autumn"; startYear = y; startMonth = 9;
    }
    startYear += yearOffset;
    const start = new Date(startYear, startMonth - 1, 1, 0, 0, 0);
    let nextStartMonth = startMonth + 3;
    let nextStartYear = startYear;
    if (nextStartMonth > 12) { nextStartMonth -= 12; nextStartYear += 1; }
    const nextStart = new Date(nextStartYear, nextStartMonth - 1, 1, 0, 0, 0);
    const end = yearOffset === 0 ? d : new Date(Math.min(nextStart.getTime() - 1000, d.getTime()));
    const label = name === "Winter"
      ? `Winter ${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`
      : `${name} ${startYear}`;
    return { name, label, start: start.getTime(), end: end.getTime() };
  }

  function seededRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function formatLabel(date, fmt) {
    const d = new Date(date);
    switch (fmt) {
      case "time":
        return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      case "day":
        return d.toLocaleDateString([], { weekday: "short" });
      case "date":
        return d.toLocaleDateString([], { day: "numeric", month: "short" });
      case "month":
        return d.toLocaleDateString([], { month: "short" });
      case "yearmonth":
        return d.toLocaleDateString([], { month: "short", year: "2-digit" });
      case "year":
        return d.getFullYear().toString();
      default:
        return d.toLocaleDateString();
    }
  }

  function buildSeries(range, base, amplitude, seed, opts) {
    opts = opts || {};
    const cfg = RANGE_CONFIG[range];
    const rand = seededRandom(seed);
    const now = Date.now();

    // "season" is calendar-anchored to the current UK meteorological season
    // (see getCurrentUkSeason()) rather than a fixed rolling window, so its
    // point count and step size are derived here instead of read straight
    // from RANGE_CONFIG - a season only a few days old should produce a
    // short chart, not one padded out to a full 13 weeks.
    let points = cfg.points;
    let stepMs = cfg.stepMs;
    if (range === "season") {
      const season = getCurrentUkSeason(now);
      const elapsedMs = Math.max(cfg.stepMs, now - season.start);
      points = Math.max(2, Math.min(20, Math.ceil(elapsedMs / cfg.stepMs) + 1));
      stepMs = elapsedMs / (points - 1);
    }

    const labels = [];
    const times = [];
    const values = [];
    for (let i = points - 1; i >= 0; i--) {
      const t = now - i * stepMs;
      labels.push(formatLabel(t, cfg.fmt));
      times.push(new Date(t).toISOString());
      const trend = opts.trend ? opts.trend * (points - 1 - i) : 0;
      const cyclic = Math.sin((i / points) * Math.PI * (opts.cycles || 2)) * amplitude * 0.5;
      const noise = (rand() - 0.5) * amplitude;
      let v = base + trend + cyclic + noise;
      if (opts.min !== undefined) v = Math.max(opts.min, v);
      if (opts.max !== undefined) v = Math.min(opts.max, v);
      values.push(Math.round(v * 100) / 100);
    }
    return { labels, times, values };
  }

  /* Human-readable calendar period covered by a range, e.g. "3 – 9 Aug 2026".
     Used anywhere the site needs to show *which* dates a tab's chart covers,
     not just the abstract range name. */
  function getRangePeriodLabel(range) {
    const cfg = RANGE_CONFIG[range];
    if (!cfg) return "";
    const end = new Date();
    const dOpts = { day: "numeric", month: "short", year: "numeric" };

    if (range === "season") {
      const season = getCurrentUkSeason(end.getTime());
      const start = new Date(season.start);
      const sameYear = start.getFullYear() === end.getFullYear();
      const startStr = start.toLocaleDateString([], sameYear ? { day: "numeric", month: "short" } : dOpts);
      const endStr = end.toLocaleDateString([], dOpts);
      return `${season.label}: ${startStr} – ${endStr}`;
    }

    const start = new Date(end.getTime() - (cfg.points - 1) * cfg.stepMs);

    if (range === "day") {
      const tOpts = { hour: "numeric", minute: "2-digit" };
      const shortDate = { day: "numeric", month: "short" };
      if (start.toDateString() === end.toDateString()) {
        return `${start.toLocaleDateString([], dOpts)}, ${start.toLocaleTimeString([], tOpts)} – ${end.toLocaleTimeString([], tOpts)}`;
      }
      return `${start.toLocaleDateString([], shortDate)}, ${start.toLocaleTimeString([], tOpts)} – ${end.toLocaleDateString([], dOpts)}, ${end.toLocaleTimeString([], tOpts)}`;
    }
    if (start.toDateString() === end.toDateString()) {
      return start.toLocaleDateString([], dOpts);
    }
    const sameYear = start.getFullYear() === end.getFullYear();
    const startStr = start.toLocaleDateString([], sameYear ? { day: "numeric", month: "short" } : dOpts);
    const endStr = end.toLocaleDateString([], dOpts);
    return `${startStr} – ${endStr}`;
  }

  window.GridPreview = {
    RANGE_CONFIG,
    buildSeries,
    getRangePeriodLabel,
    formatLabel,
    getCurrentUkSeason,
    getUkSeasonBounds,
  };

  function themeAwareColors() {
    const dark =
      root.getAttribute("data-theme") === "dark" ||
      (!root.getAttribute("data-theme") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    return {
      dark: dark,
      grid: dark ? "rgba(255,255,255,0.08)" : "rgba(20,24,33,0.08)",
      guide: dark ? "rgba(255,255,255,0.4)" : "rgba(20,24,33,0.4)",
      text: dark ? "#a2a8b6" : "#5b6270",
      // Actual --bg-elevated / --border custom-property values, read live so
      // the canvas-drawn hover tooltip always matches the current theme
      // exactly rather than approximating it with a second hardcoded palette.
      panelBg: getComputedStyle(root).getPropertyValue("--bg-elevated").trim() || (dark ? "#1c1f27" : "#ffffff"),
      panelBorder: getComputedStyle(root).getPropertyValue("--border").trim() || (dark ? "#333846" : "#dde1e7"),
    };
  }
  window.GridPreview.themeAwareColors = themeAwareColors;

  /* ==========================================================================
     Chart rendering - plain Canvas 2D, no external library.
     Self-contained on purpose: charts must show example data even with no
     network access (blocked CDN, offline preview, strict corporate proxy).
     ========================================================================== */

  const chartRegistry = [];

  function registerChart(canvas, draw) {
    draw();
    // Every render*Chart function funnels through here, so this is the one
    // place that reliably clears the "is-loading" shimmer skeleton
    // (assets/style.css's .chart-wrap.is-loading::before) once a chart has
    // actually drawn something. Individual pages' success paths only ever
    // called the equivalent of this by hand in some places (e.g. the
    // 24-hour mix-stack charts) and not others (every History-section
    // line chart drawn via drawRange()) - the omission meant those charts
    // rendered real data underneath a shimmer overlay that never went
    // away, i.e. they looked permanently stuck loading even though the
    // data was right there. showChartError() already did this on the
    // failure path; this mirrors it for every success path in one spot
    // instead of requiring every call site to remember it individually.
    const wrap = canvas.closest(".chart-wrap");
    if (wrap) wrap.classList.remove("is-loading");
    chartRegistry.push({ canvas, draw });
  }

  function redrawAll() {
    chartRegistry.forEach((entry) => {
      if (entry.canvas.isConnected && entry.canvas.offsetParent !== null) {
        entry.draw();
      }
    });
  }
  window.GridPreview = window.GridPreview || {};
  window.GridPreview.redrawAll = redrawAll;

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(redrawAll, 120);
  });

  function prepareCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || canvas.parentElement.clientWidth || 300;
    const cssH = canvas.clientHeight || canvas.parentElement.clientHeight || 200;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.font = '12px "Open Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
    return { ctx, w: cssW, h: cssH };
  }

  function hexToRgba(hex, alpha) {
    if (!hex || hex[0] !== "#") return hex;
    let h = hex.slice(1);
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function formatAxisValue(v, unit) {
    const rounded = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
    return `${rounded}${unit || ""}`;
  }

  // Full precision date + time for hover tooltips - deliberately independent
  // of a chart's axis-label format (RANGE_CONFIG's "fmt"), which is often
  // coarser than a single data point (e.g. a "year" range axis label is just
  // a month). The tooltip should always be able to answer "exactly when was
  // this point recorded?" regardless of range.
  function formatTooltipDateTime(t) {
    const d = new Date(t);
    if (isNaN(d.getTime())) return "";
    const datePart = d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    const timePart = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return `${datePart}, ${timePart}`;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const rad = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    const x0 = w < 0 ? x + w : x;
    const w0 = Math.abs(w);
    ctx.beginPath();
    ctx.moveTo(x0 + rad, y);
    ctx.arcTo(x0 + w0, y, x0 + w0, y + h, rad);
    ctx.arcTo(x0 + w0, y + h, x0, y + h, rad);
    ctx.arcTo(x0, y + h, x0, y, rad);
    ctx.arcTo(x0, y, x0 + w0, y, rad);
    ctx.closePath();
  }

  function pickTickIndices(n, count) {
    const c = Math.max(2, Math.min(count, n));
    const out = [];
    for (let i = 0; i < c; i++) out.push(Math.round((i * (n - 1)) / (c - 1)));
    return Array.from(new Set(out));
  }

  function buildLegend(target, labels, colors, values, unit) {
    const el = typeof target === "string" ? document.getElementById(target) : target;
    if (!el) return;
    el.innerHTML = labels
      .map((l, i) => {
        const v = values ? ` <strong>${formatAxisValue(values[i], unit)}</strong>` : "";
        return `<li><span class="swatch" style="background:${colors[i]}"></span>${l}${v}</li>`;
      })
      .join("");
  }
  window.GridPreview.buildLegend = buildLegend;

  /* ---------- Line / area chart ---------- */
  function renderLineChart(canvas, series, opts) {
    opts = opts || {};
    const color = opts.color || "#0a6e5c";
    let layout = null; // latest draw()'s geometry, read by the hover handler below

    function draw() {
      const { ctx, w, h } = prepareCanvas(canvas);
      const colors = themeAwareColors();
      const values = series.values;
      const n = values.length;
      const pad = { l: 42, r: 12, t: 12, b: 22 };

      // Optional second series (e.g. the History page's "compare seasons"
      // checkbox), drawn as a dashed overlay line aligned by index rather
      // than by calendar date - point i of the compare series lines up
      // with point i of the primary series ("the same week of the season",
      // not "the same calendar day"), which is what makes a year-on-year
      // comparison actually readable. Truncated to the primary series'
      // length so an in-progress current season compares against the same
      // elapsed portion of a prior, already-complete one rather than
      // stretching the whole prior season across the same width.
      const compare = opts.compareSeries;
      const compareValues = compare && compare.values && compare.values.length
        ? compare.values.slice(0, n)
        : null;

      let min = Math.min(...values, ...(compareValues || []));
      let max = Math.max(...values, ...(compareValues || []));
      if (min === max) { min -= 1; max += 1; }
      const span = max - min;
      min -= span * 0.1;
      max += span * 0.1;
      const plotW = w - pad.l - pad.r;
      const plotH = h - pad.t - pad.b;
      const xAt = (i) => pad.l + (n > 1 ? plotW * (i / (n - 1)) : plotW / 2);
      const yAt = (v) => pad.t + plotH - plotH * ((v - min) / (max - min));

      // gridlines + y labels
      ctx.strokeStyle = colors.grid;
      ctx.fillStyle = colors.text;
      ctx.lineWidth = 1;
      const yTicks = 4;
      for (let i = 0; i <= yTicks; i++) {
        const v = min + ((max - min) * i) / yTicks;
        const y = yAt(v);
        ctx.beginPath();
        ctx.moveTo(pad.l, Math.round(y) + 0.5);
        ctx.lineTo(w - pad.r, Math.round(y) + 0.5);
        ctx.stroke();
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(formatAxisValue(v, opts.unit), pad.l - 8, y);
      }

      // x labels
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      pickTickIndices(n, 5).forEach((idx) => {
        ctx.fillText(series.labels[idx], xAt(idx), h - pad.b + 5);
      });

      // area fill
      const grad = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
      grad.addColorStop(0, hexToRgba(color, 0.28));
      grad.addColorStop(1, hexToRgba(color, 0.02));
      ctx.beginPath();
      values.forEach((v, i) => {
        const x = xAt(i), y = yAt(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.lineTo(xAt(n - 1), pad.t + plotH);
      ctx.lineTo(xAt(0), pad.t + plotH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // line
      ctx.beginPath();
      values.forEach((v, i) => {
        const x = xAt(i), y = yAt(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();

      // last-point dot
      ctx.beginPath();
      ctx.arc(xAt(n - 1), yAt(values[n - 1]), 3.2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Compare-season overlay line: dashed, muted, no fill, drawn on top
      // of the primary line/area so both are readable at once.
      if (compareValues && compareValues.length) {
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        compareValues.forEach((v, i) => {
          const x = xAt(i), y = yAt(v);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = hexToRgba(color, 0.55);
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      }

      // Geometry snapshot for the hover handler - re-captured on every
      // draw() (including the redraws triggered by resize/theme-change via
      // redrawAll()), so hover hit-testing is always in sync with whatever
      // is actually on screen right now.
      layout = { ctx, w, h, pad, plotW, plotH, n, values, xAt, yAt, colors, compareValues };
    }

    registerChart(canvas, draw);
    bindLineChartHover(canvas, () => layout, series, opts, color, draw);

    if (!opts.noExport) {
      const columns = [{ name: opts.label || "Value", unit: series.unit || opts.unit, color: opts.color, values: series.values }];
      if (opts.compareSeries && opts.compareSeries.values && opts.compareSeries.values.length) {
        columns.push({
          name: opts.compareLabel || "Comparison",
          unit: series.unit || opts.unit,
          color: color, // same hue as the primary line (drawn as a lighter dashed overlay on-canvas) - reused here just to distinguish the two legend entries, not to imply a second true colour
          values: opts.compareSeries.values.slice(0, series.values.length),
        });
      }
      attachChartExport(canvas, {
        title: opts.exportTitle,
        kind: "series",
        data: { times: series.times, labels: series.labels, columns },
      });
    }
  }
  window.GridPreview.renderLineChart = renderLineChart;

  /* Hover interaction for renderLineChart: tracks the pointer, finds the
     nearest data point, and redraws the base chart plus a dashed guide line
     from that point straight down to the x-axis, a marker dot, and a small
     tooltip with the exact date/time and value.

     The pointer listeners are attached once per canvas (guarded via a
     dataset flag), but the state they read - getLayout/series/opts/color/
     draw - is refreshed on EVERY call via canvas._lineHoverState instead of
     being captured once in the closure and then ignored on later calls.
     That distinction matters once a canvas can be re-rendered with new
     data after its first render (e.g. the History page's "compare
     seasons" checkbox calling renderLineChart a second time on the same
     canvas with a compareSeries added) - without it, hover would keep
     showing whichever series/opts happened to be bound first, regardless
     of what's actually on screen. */
  function bindLineChartHover(canvas, getLayout, series, opts, color, draw) {
    canvas._lineHoverState = { getLayout, series, opts, color, draw };
    if (canvas.dataset.hoverBound) return;
    canvas.dataset.hoverBound = "1";
    canvas.style.cursor = "crosshair";

    let hoverIndex = null;
    let rafId = null;

    function nearestIndex(mouseX) {
      const layout = canvas._lineHoverState.getLayout();
      if (!layout || layout.n === 0) return null;
      if (layout.n === 1) return 0;
      const ratio = (mouseX - layout.pad.l) / layout.plotW;
      const idx = Math.round(ratio * (layout.n - 1));
      return Math.max(0, Math.min(layout.n - 1, idx));
    }

    function drawOverlay(idx) {
      const { series, opts, color } = canvas._lineHoverState;
      const layout = canvas._lineHoverState.getLayout();
      if (!layout || idx == null) return;
      const { ctx, w, h, pad, xAt, yAt, values, colors, compareValues } = layout;
      const x = xAt(idx);
      const y = yAt(values[idx]);

      // Guide line from the point down to the bottom axis.
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = colors.guide;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, y);
      ctx.lineTo(Math.round(x) + 0.5, h - pad.b);
      ctx.stroke();
      ctx.restore();

      // Point marker.
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = colors.panelBg;
      ctx.stroke();

      // Compare-series marker, same x position, its own value's y.
      const hasCompare = compareValues && compareValues[idx] != null;
      if (hasCompare) {
        const cy = yAt(compareValues[idx]);
        ctx.beginPath();
        ctx.arc(x, cy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(color, 0.55);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = colors.panelBg;
        ctx.stroke();
      }

      // Tooltip: metric value on top, compare value (if active) below
      // that, exact recorded date/time last.
      const valueLine = opts.label
        ? `${opts.label}: ${formatAxisValue(values[idx], series.unit || opts.unit)}`
        : formatAxisValue(values[idx], series.unit || opts.unit);
      const compareLine = hasCompare
        ? `${opts.compareLabel || "Comparison"}: ${formatAxisValue(compareValues[idx], series.unit || opts.unit)}`
        : null;
      const timeLine = (series.times && series.times[idx])
        ? formatTooltipDateTime(series.times[idx])
        : (series.labels[idx] || "");

      ctx.font = '700 12px "Open Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
      let maxW = ctx.measureText(valueLine).width;
      ctx.font = '11px "Open Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
      maxW = Math.max(maxW, ctx.measureText(timeLine).width);
      if (compareLine) maxW = Math.max(maxW, ctx.measureText(compareLine).width);
      const boxW = maxW + 20;
      const lineH = 16;
      const boxH = compareLine ? 40 + lineH : 40;

      let boxX = x + 10;
      if (boxX + boxW > w - pad.r) boxX = x - boxW - 10;
      boxX = Math.max(pad.l, Math.min(boxX, w - pad.r - boxW));
      let boxY = y - boxH - 10;
      if (boxY < pad.t) boxY = Math.min(y + 10, h - pad.b - boxH);

      ctx.save();
      roundRectPath(ctx, boxX, boxY, boxW, boxH, 6);
      ctx.fillStyle = colors.panelBg;
      ctx.fill();
      ctx.strokeStyle = colors.panelBorder;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = color;
      ctx.font = '700 12px "Open Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(valueLine, boxX + 10, boxY + 7);

      let nextY = boxY + 23;
      if (compareLine) {
        ctx.fillStyle = colors.text;
        ctx.font = '700 11px "Open Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(compareLine, boxX + 10, nextY);
        nextY += lineH;
      }
      ctx.fillStyle = colors.text;
      ctx.font = '11px "Open Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(timeLine, boxX + 10, nextY);
    }

    function scheduleOverlay() {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        canvas._lineHoverState.draw();
        drawOverlay(hoverIndex);
      });
    }

    function handleMove(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      // Ignore pointer positions outside the canvas's own box (can happen
      // with pointer capture during a touch drag).
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        handleLeave();
        return;
      }
      const idx = nearestIndex(clientX - rect.left);
      if (idx === null || idx === hoverIndex) return;
      hoverIndex = idx;
      scheduleOverlay();
    }

    function handleLeave() {
      if (hoverIndex === null) return;
      hoverIndex = null;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      canvas._lineHoverState.draw();
    }

    canvas.addEventListener("pointermove", (e) => handleMove(e.clientX, e.clientY));
    canvas.addEventListener("pointerleave", handleLeave);
    canvas.addEventListener("pointercancel", handleLeave);
  }

  /* ---------- Stacked area chart (generation mix over time) ----------
     series: [{ name, color, values }], all sharing the same times/labels.
     Renders each series as a band stacked on top of the previous one
     (bottom-up) rather than overlapping lines, so the filled area at any
     x-position always sums to the period's total. Hover shows every
     series' individual value plus the total, not just one number. */
  function renderStackedAreaChart(canvas, times, labels, series, opts) {
    opts = opts || {};
    let layout = null;

    function draw() {
      const { ctx, w, h } = prepareCanvas(canvas);
      const colors = themeAwareColors();
      const n = labels.length;
      const pad = { l: 42, r: 12, t: 12, b: 22 };

      // Running cumulative totals per series, per point - cum[s][i] is the
      // top edge of series s's band at point i (series 0's band sits on
      // the zero baseline; each later series stacks on top of the last).
      const cum = [];
      let runningMax = 0;
      for (let s = 0; s < series.length; s++) {
        cum.push(new Array(n));
        for (let i = 0; i < n; i++) {
          const prev = s === 0 ? 0 : cum[s - 1][i];
          const v = series[s].values[i] || 0;
          cum[s][i] = prev + v;
          if (cum[s][i] > runningMax) runningMax = cum[s][i];
        }
      }
      let max = runningMax > 0 ? runningMax * 1.1 : 1;
      const min = 0;
      const plotW = w - pad.l - pad.r;
      const plotH = h - pad.t - pad.b;
      const xAt = (i) => pad.l + (n > 1 ? plotW * (i / (n - 1)) : plotW / 2);
      const yAt = (v) => pad.t + plotH - plotH * ((v - min) / (max - min));

      // gridlines + y labels
      ctx.strokeStyle = colors.grid;
      ctx.fillStyle = colors.text;
      ctx.lineWidth = 1;
      const yTicks = 4;
      for (let i = 0; i <= yTicks; i++) {
        const v = min + ((max - min) * i) / yTicks;
        const y = yAt(v);
        ctx.beginPath();
        ctx.moveTo(pad.l, Math.round(y) + 0.5);
        ctx.lineTo(w - pad.r, Math.round(y) + 0.5);
        ctx.stroke();
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(formatAxisValue(v, opts.unit), pad.l - 8, y);
      }

      // x labels
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      pickTickIndices(n, 5).forEach((idx) => {
        ctx.fillText(labels[idx], xAt(idx), h - pad.b + 5);
      });

      // stacked bands, bottom-up - each band fades top-to-bottom the same
      // way renderLineChart's single-series area does (hexToRgba(color,
      // 0.28) → hexToRgba(color, 0.02)), but anchored to that band's OWN
      // vertical extent rather than the whole chart height. Anchoring every
      // band to the full plot height would leave the bottom band (which
      // never reaches near the top of the chart) looking permanently faint
      // regardless of its actual values - each type gets its own equivalent
      // fade, from its own top edge down to its own bottom edge.
      for (let s = 0; s < series.length; s++) {
        const baseline = s === 0 ? null : cum[s - 1];
        const topYs = cum[s].map((v) => yAt(v));
        const bottomYs = baseline ? baseline.map((v) => yAt(v)) : cum[s].map(() => yAt(0));
        const bandTopY = Math.min(...topYs);
        const bandBottomY = Math.max(...bottomYs);

        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const x = xAt(i), y = topYs[i];
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        for (let i = n - 1; i >= 0; i--) {
          ctx.lineTo(xAt(i), bottomYs[i]);
        }
        ctx.closePath();
        const grad = bandBottomY > bandTopY
          ? ctx.createLinearGradient(0, bandTopY, 0, bandBottomY)
          : ctx.createLinearGradient(0, bandTopY - 1, 0, bandTopY + 1);
        grad.addColorStop(0, hexToRgba(series[s].color, 0.6));
        grad.addColorStop(1, hexToRgba(series[s].color, 0.18));
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const x = xAt(i), y = yAt(cum[s][i]);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = series[s].color;
        ctx.lineWidth = 1.25;
        ctx.lineJoin = "round";
        ctx.stroke();
      }

      layout = { ctx, w, h, pad, plotW, plotH, n, cum, xAt, yAt, colors };
    }

    registerChart(canvas, draw);
    bindStackedAreaHover(canvas, () => layout, times, labels, series, opts, draw);
    if (opts.legendTarget) buildLegend(opts.legendTarget, series.map((s) => s.name), series.map((s) => s.color));

    if (!opts.noExport) {
      attachChartExport(canvas, {
        title: opts.exportTitle,
        kind: "series",
        data: {
          times,
          labels,
          columns: series.map((s) => ({ name: s.name, unit: opts.unit, color: s.color, values: s.values })),
        },
      });
    }
  }
  window.GridPreview.renderStackedAreaChart = renderStackedAreaChart;

  /* Hover interaction for renderStackedAreaChart - same pointer-tracking
     approach as bindLineChartHover, but the tooltip lists every series'
     individual value at that point plus the running total, since a stacked
     chart's visual height at any x is a sum, not a single number. */
  function bindStackedAreaHover(canvas, getLayout, times, labels, series, opts, draw) {
    if (canvas.dataset.hoverBound) return;
    canvas.dataset.hoverBound = "1";
    canvas.style.cursor = "crosshair";

    let hoverIndex = null;
    let rafId = null;

    function nearestIndex(mouseX) {
      const layout = getLayout();
      if (!layout || layout.n === 0) return null;
      if (layout.n === 1) return 0;
      const ratio = (mouseX - layout.pad.l) / layout.plotW;
      const idx = Math.round(ratio * (layout.n - 1));
      return Math.max(0, Math.min(layout.n - 1, idx));
    }

    function drawOverlay(idx) {
      const layout = getLayout();
      if (!layout || idx == null) return;
      const { ctx, w, h, pad, xAt, yAt, cum, colors } = layout;
      const x = xAt(idx);
      const topY = yAt(cum[cum.length - 1][idx]);

      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = colors.guide;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, topY);
      ctx.lineTo(Math.round(x) + 0.5, h - pad.b);
      ctx.stroke();
      ctx.restore();

      for (let s = 0; s < series.length; s++) {
        const y = yAt(cum[s][idx]);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = series[s].color;
        ctx.fill();
      }

      const timeLine = (times && times[idx]) ? formatTooltipDateTime(times[idx]) : (labels[idx] || "");
      const rows = series.map((s) => ({ text: `${s.name}: ${formatAxisValue(s.values[idx], opts.unit)}`, color: s.color }));
      rows.push({ text: `Total: ${formatAxisValue(cum[cum.length - 1][idx], opts.unit)}`, color: colors.text });

      ctx.font = '700 11px "Open Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
      let maxTextW = ctx.measureText(timeLine).width;
      ctx.font = '11px "Open Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
      rows.forEach((r) => { maxTextW = Math.max(maxTextW, ctx.measureText(r.text).width + 14); });
      const boxW = maxTextW + 20;
      const lineH = 16;
      const boxH = 14 + rows.length * lineH + 6;

      let boxX = x + 10;
      if (boxX + boxW > w - pad.r) boxX = x - boxW - 10;
      boxX = Math.max(pad.l, Math.min(boxX, w - pad.r - boxW));
      const boxY = Math.max(pad.t, Math.min(pad.t, h - pad.b - boxH));

      ctx.save();
      roundRectPath(ctx, boxX, boxY, boxW, boxH, 6);
      ctx.fillStyle = colors.panelBg;
      ctx.fill();
      ctx.strokeStyle = colors.panelBorder;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = colors.text;
      ctx.font = '700 11px "Open Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(timeLine, boxX + 10, boxY + 7);

      ctx.font = '11px "Open Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
      rows.forEach((r, i) => {
        const rowY = boxY + 7 + 16 + i * lineH;
        ctx.fillStyle = r.color;
        ctx.fillText("●", boxX + 10, rowY);
        ctx.fillStyle = colors.text;
        ctx.fillText(r.text, boxX + 22, rowY);
      });
    }

    function scheduleOverlay() {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        draw();
        drawOverlay(hoverIndex);
      });
    }

    function handleMove(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        handleLeave();
        return;
      }
      const idx = nearestIndex(clientX - rect.left);
      if (idx === null || idx === hoverIndex) return;
      hoverIndex = idx;
      scheduleOverlay();
    }

    function handleLeave() {
      if (hoverIndex === null) return;
      hoverIndex = null;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      draw();
    }

    canvas.addEventListener("pointermove", (e) => handleMove(e.clientX, e.clientY));
    canvas.addEventListener("pointerleave", handleLeave);
    canvas.addEventListener("pointercancel", handleLeave);
  }

  /* ---------- Sparkline (mini trend, no axes) ---------- */
  function renderSparkline(canvas, values, color) {
    function draw() {
      const { ctx, w, h } = prepareCanvas(canvas);
      const n = values.length;
      let min = Math.min(...values);
      let max = Math.max(...values);
      if (min === max) { min -= 1; max += 1; }
      const xAt = (i) => (n > 1 ? w * (i / (n - 1)) : w / 2);
      const yAt = (v) => h - h * ((v - min) / (max - min));

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, hexToRgba(color, 0.35));
      grad.addColorStop(1, hexToRgba(color, 0.02));
      ctx.beginPath();
      values.forEach((v, i) => {
        const x = xAt(i), y = yAt(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.lineTo(xAt(n - 1), h);
      ctx.lineTo(xAt(0), h);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      values.forEach((v, i) => {
        const x = xAt(i), y = yAt(v);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.75;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
    }
    registerChart(canvas, draw);
  }
  window.GridPreview.renderSparkline = renderSparkline;

  /* ---------- Live-data error states ----------
     Used wherever a page has a real backend to talk to (the GB status strip
     and History charts on index.html, the Ireland status strip on
     pages/ireland.html) so that when the backend genuinely can't be reached,
     the page says so plainly instead of quietly drawing illustrative data
     in its place. This is deliberately NOT used on sections that were never
     wired to a live source in the first place (the generation-mix donuts,
     SEM price, and every page with no backend at all) - those stay on
     illustrative data by design, not because something's broken; see
     pages/data-sources.html for which is which. */

  /** Shows (or updates) a page-level banner just below the hero section. */
  function showLiveDataBanner(message) {
    let banner = document.getElementById("live-data-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "live-data-banner";
      banner.className = "live-data-banner";
      banner.setAttribute("role", "alert");
      const hero = document.querySelector(".hero");
      if (hero && hero.parentNode) {
        hero.parentNode.insertBefore(banner, hero.nextSibling);
      } else {
        const wrap = document.querySelector("main .wrap");
        if (wrap) wrap.insertBefore(banner, wrap.firstChild);
      }
    }
    banner.textContent = message;
    banner.hidden = false;
  }
  window.GridPreview.showLiveDataBanner = showLiveDataBanner;

  function hideLiveDataBanner() {
    const banner = document.getElementById("live-data-banner");
    if (banner) banner.hidden = true;
  }
  window.GridPreview.hideLiveDataBanner = hideLiveDataBanner;

  /**
   * For pages that combine more than one independent upstream API (the GB
   * status strip on index.html: Elexon/Carbon Intensity/NESO; the Ireland
   * status strip: EirGrid/ENTSO-E) - checks api/status.php and returns a
   * ready-to-show banner message naming exactly which source(s) currently
   * have a failing ingest run, or null if none do.
   *
   * This is deliberately separate from showLiveDataBanner's existing
   * all-or-nothing use (called when a page's own fetch* call came back
   * completely empty): a source can still be serving stale-but-present data
   * from an earlier successful run while its MOST RECENT ingest attempt is
   * erroring - that's a real, current API problem worth surfacing, but
   * "the figures below could not be loaded" would be wrong to say since
   * they did load, just not freshly. Callers pass a map of the exact
   * ingest_log source keys that feed their page to a short label describing
   * what each one powers there, e.g. { ELEXON: "demand, price and
   * transmission generation" }.
   *
   * A source with no entry at all in status.php's response (never logged a
   * run - e.g. EIA/ENTSOE before an API key is configured) is NOT treated
   * as an issue here, same as status.php's own "overall" semantics - that's
   * "illustrative by design", not "broken".
   */
  async function buildApiIssueBanner(sourceLabels) {
    const status = window.GridData ? await window.GridData.fetchStatus() : null;
    if (!status || !status.sources) return null; // status.php itself unreachable - can't tell either way, so say nothing
    const broken = Object.keys(sourceLabels).filter((key) => {
      const s = status.sources[key];
      return s && s.status !== "OK";
    });
    if (!broken.length) return null;
    const labels = broken.map((key) => sourceLabels[key]);
    return (
      (broken.length === 1 ? "One of this page's live data sources is" : "Some of this page's live data sources are") +
      " currently having trouble: " + labels.join("; ") + ". Affected figures may be showing stale data until it recovers - see the footer for pipeline status."
    );
  }
  window.GridPreview.buildApiIssueBanner = buildApiIssueBanner;

  /**
   * Marks one chart/sparkline as unavailable instead of drawing anything
   * into it. Pass message === null to just hide the canvas with no overlay
   * text - for small sparklines there isn't room for a message, and the
   * page-level banner (showLiveDataBanner) already explains why.
   */
  function showChartError(canvas, message) {
    if (!canvas) return;
    const wrap = canvas.closest(".chart-wrap");
    if (!wrap) return;
    wrap.classList.remove("is-loading");
    wrap.classList.add("has-error");
    const ctx = canvas.getContext && canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (message === null) return;
    let msg = wrap.querySelector(".chart-error-msg");
    if (!msg) {
      msg = document.createElement("p");
      msg.className = "chart-error-msg";
      wrap.appendChild(msg);
    }
    msg.textContent = message || "Live data unavailable.";
  }
  window.GridPreview.showChartError = showChartError;

  /** Marks one status-strip stat's value as unavailable rather than a mock number. */
  function showStatError(id) {
    const el = document.getElementById(id);
    if (el) el.textContent = "-";
  }
  window.GridPreview.showStatError = showStatError;

  /**
   * Builds the two-line HTML for the "Data as of" stat used at the top of
   * every live-wired page (index.html, ireland.html, and each ENTSO-E
   * country page): the visitor's own local time with its timezone name on
   * the first line, and UK time on a smaller line below.
   *
   * This matters because the first line's timezone is whatever the
   * visitor's own browser/OS is set to, NOT necessarily UK time - a site
   * called "UK Grid: Live+" showing "2:32pm" with no timezone attached is
   * ambiguous for anyone not physically in the UK right now (a reader
   * abroad, or checking a non-GB country page where it'd be easy to assume
   * the time shown is that country's local time instead). Labelling the
   * first line's timezone and always anchoring a second line to actual UK
   * time removes that ambiguity without needing to know or guess where the
   * visitor is.
   *
   * extraOptions lets usa.html add month/day (its EIA data can be the best
   * part of a day old, so the date matters there in a way it doesn't for
   * the near-real-time GB/Ireland/ENTSO-E pages).
   */
  function formatAsOfHtml(tsIso, extraOptions) {
    const d = new Date(tsIso);
    const base = Object.assign({ hour: "numeric", minute: "2-digit" }, extraOptions || {});
    const localStr = d.toLocaleTimeString([], Object.assign({ timeZoneName: "short" }, base));
    const ukStr = d.toLocaleTimeString([], Object.assign({ timeZone: "Europe/London" }, base));
    return localStr + '<br><small class="stat-time-uk">' + ukStr + " UK time</small>";
  }
  window.GridPreview.formatAsOfHtml = formatAsOfHtml;

  /** Same "Data as of" slot, but for a page's first paint from cached data
      rather than a confirmed-fresh fetch - "Showing: 14:32" rather than the
      normal two-line local+UK time. Deliberately plainer than
      formatAsOfHtml (no UK-time subline) since this is a transient state:
      it's replaced by formatAsOfHtml the moment the real fetch resolves. */
  function formatShowingHtml(tsIso) {
    const d = new Date(tsIso);
    const str = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    return "Showing: " + str + ' <small class="stat-time-uk">last update - refreshing…</small>';
  }
  window.GridPreview.formatShowingHtml = formatShowingHtml;

  /** Carbon-intensity traffic-light band, in gCO2/kWh. Thresholds match
      the National Energy System Operator's own published Carbon Intensity
      API bands (carbonintensity.org.uk), not a figure invented for this
      site, so the label carries real meaning rather than an arbitrary cut-off. */
  function carbonBand(gco2) {
    if (gco2 == null || isNaN(gco2)) return null;
    if (gco2 < 50) return { label: "Very low", cls: "band-verygood" };
    if (gco2 < 150) return { label: "Low", cls: "band-good" };
    if (gco2 < 250) return { label: "Moderate", cls: "band-average" };
    if (gco2 < 350) return { label: "High", cls: "band-bad" };
    return { label: "Very high", cls: "band-verybad" };
  }
  window.GridPreview.carbonBand = carbonBand;

  /** Wholesale price traffic-light band, in £/MWh. Unlike carbon intensity,
      there's no official public banding for GB wholesale price, so these
      are rough, disclosed thresholds based on the typical range seen in
      this site's own recorded price history (roughly -£20 to £250/MWh) -
      not a claim of any official "cheap/expensive" standard. */
  function priceBand(gbpMwh) {
    if (gbpMwh == null || isNaN(gbpMwh)) return null;
    if (gbpMwh < 40) return { label: "Low", cls: "band-good" };
    if (gbpMwh < 100) return { label: "Average", cls: "band-average" };
    return { label: "High", cls: "band-bad" };
  }
  window.GridPreview.priceBand = priceBand;

  /** Generic 5-tier traffic-light band from a value's position within a
      rough [low, high] reference range - shared by every region page's
      demand/generation stat cards. Unlike carbonBand's NESO-official
      thresholds, there's no official "low/high demand" standard for any
      grid, so - like priceBand - each page passes its own rough,
      disclosed-as-not-official round-number reference points (typically an
      approximate summer-overnight low and a recent winter-evening peak for
      that specific grid - see each page's own call site for its source).
      Deliberately a magnitude indicator ("how close to this grid's own
      typical peak is it right now?"), not a "good/bad" moral judgment the
      way the price/carbon bands are - framed as Low/Average/High rather
      than good/bad wording for that reason. */
  function bandFromRange(value, low, high) {
    if (value == null || isNaN(value) || !(high > low)) return null;
    const frac = (value - low) / (high - low);
    if (frac < 0.2) return { label: "Low", cls: "band-verygood" };
    if (frac < 0.45) return { label: "Below average", cls: "band-good" };
    if (frac < 0.7) return { label: "Average", cls: "band-average" };
    if (frac < 0.9) return { label: "High", cls: "band-bad" };
    return { label: "Very high", cls: "band-verybad" };
  }
  window.GridPreview.bandFromRange = bandFromRange;

  /** Net interconnector flow traffic-light band, in MW - positive means
      this grid is importing, negative means it's exporting (see
      pages/interconnectors.html's own "positive = importing, negative =
      exporting" convention note, which this matches). Framed as a neutral
      trade status rather than a moral "good/bad": exporting reads as the
      calmest state (green) since it means this grid has spare capacity,
      but importing isn't inherently bad - it's ordinary cross-border
      trading - so it only escalates toward amber/red as the volume grows,
      reflecting heavier reliance on neighbouring grids rather than
      wrongdoing. Thresholds are round, disclosed-as-rough reference points
      scaled to a single interconnector's typical capacity (roughly
      1-2GW), not official. */
  function transfersBand(mw) {
    if (mw == null || isNaN(mw)) return null;
    if (mw <= 0) return { label: "Exporting", cls: "band-verygood" };
    if (mw < 1000) return { label: "Light imports", cls: "band-good" };
    if (mw < 3000) return { label: "Importing", cls: "band-average" };
    if (mw < 5000) return { label: "Heavy imports", cls: "band-bad" };
    return { label: "Very heavy imports", cls: "band-verybad" };
  }
  window.GridPreview.transfersBand = transfersBand;

  /** Applies a computed band {label, cls} (or null) to a small indicator
      element next to a stat value - sets the CSS class that drives its
      colour/dot and a text label plus a title tooltip explaining what it
      means, so the signal isn't colour-only (accessibility). Clears the
      indicator entirely (no dot, no text) when band is null, e.g. while a
      value is unavailable. */
  function setStatBand(id, band, tooltipSuffix) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = "stat-band" + (band ? " " + band.cls : "");
    el.textContent = band ? band.label : "";
    el.title = band ? band.label + (tooltipSuffix || "") : "";
    el.hidden = !band;
  }
  window.GridPreview.setStatBand = setStatBand;

  /**
   * Shows a page's last successfully-fetched data immediately from
   * localStorage (if any) while the real network fetch is still in
   * flight, then replaces it once that fetch resolves - so a repeat
   * visitor sees real numbers straight away instead of a blank "Loading
   * live data…" placeholder every time, even on a slow connection.
   *
   * cacheKey: namespaces the localStorage entry, e.g. "gb-current",
   *   "ireland-current", "country-current-FR" - one per distinct fetch
   *   this page makes that this pattern applies to.
   * fetchFn(): the page's own fetchXCurrent()-shaped call - must resolve
   *   to null on any failure (every fetch* function in assets/data.js
   *   already does this), never reject.
   * renderFn(data, isCached): called synchronously with the cached data
   *   (if any) before this function returns, and again with the fresh
   *   data once fetchFn() resolves (only if it didn't resolve to null -
   *   a failed fetch leaves whatever renderFn(cached, true) already drew
   *   as the final on-screen state, rather than blanking it out).
   *
   * Returns { usedCache, promise } - usedCache is known synchronously
   * (was there anything to show immediately?), promise resolves to
   * fetchFn()'s own result so callers can still chain sparklines, banners,
   * etc. after it the same way they did before this wrapper existed.
   * localStorage is wrapped in try/catch throughout - private browsing,
   * disabled storage, or a quota error should degrade to "no cache
   * available", never break the page.
   */
  function withCachedFallback(cacheKey, fetchFn, renderFn) {
    const storageKey = "ukgl-cache-" + cacheKey;
    let usedCache = false;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        renderFn(JSON.parse(raw), true);
        usedCache = true;
      }
    } catch (e) {
      // Corrupt cache entry, storage disabled, or private-browsing quota -
      // proceed exactly as if there were no cache.
    }
    const promise = fetchFn().then((fresh) => {
      if (fresh) {
        renderFn(fresh, false);
        try {
          localStorage.setItem(storageKey, JSON.stringify(fresh));
        } catch (e) {
          // Storage full or disabled - caching is a nicety, never fatal.
        }
      }
      return fresh;
    });
    return { usedCache, promise };
  }
  window.GridPreview.withCachedFallback = withCachedFallback;

  /** Raw read/write for the same localStorage-backed cache
      withCachedFallback uses - for pages like ireland.html that combine
      two independent sources (EirGrid + ENTSO-E) into one rendered view
      and need to read/write each source's cache entry on their own
      schedule rather than through the single-source wrapper above. */
  function cacheGet(cacheKey) {
    try {
      const raw = localStorage.getItem("ukgl-cache-" + cacheKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function cacheSet(cacheKey, data) {
    try {
      localStorage.setItem("ukgl-cache-" + cacheKey, JSON.stringify(data));
    } catch (e) {
      // Storage full or disabled - caching is a nicety, never fatal.
    }
  }
  window.GridPreview.cacheGet = cacheGet;
  window.GridPreview.cacheSet = cacheSet;

  /* ---------- Stacked area chart ---------- */
  function renderStackedArea(canvas, labels, datasets, opts) {
    opts = opts || {};
    function draw() {
      const { ctx, w, h } = prepareCanvas(canvas);
      const colors = themeAwareColors();
      const n = labels.length;
      const pad = { l: 42, r: 12, t: 12, b: 22 };
      const plotW = w - pad.l - pad.r;
      const plotH = h - pad.t - pad.b;
      const xAt = (i) => pad.l + (n > 1 ? plotW * (i / (n - 1)) : plotW / 2);

      const cum = new Array(n).fill(0);
      const layers = datasets.map((d) => {
        const bottom = cum.slice();
        for (let i = 0; i < n; i++) cum[i] += d.data[i];
        return { bottom, top: cum.slice(), color: d.color };
      });
      const maxV = Math.max(...cum, 0.0001) * 1.08;
      const yAt = (v) => pad.t + plotH - plotH * (v / maxV);

      ctx.strokeStyle = colors.grid;
      ctx.fillStyle = colors.text;
      const yTicks = 4;
      for (let i = 0; i <= yTicks; i++) {
        const v = (maxV * i) / yTicks;
        const y = yAt(v);
        ctx.beginPath();
        ctx.moveTo(pad.l, Math.round(y) + 0.5);
        ctx.lineTo(w - pad.r, Math.round(y) + 0.5);
        ctx.stroke();
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(formatAxisValue(v, opts.unit), pad.l - 8, y);
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      pickTickIndices(n, 6).forEach((idx) => ctx.fillText(labels[idx], xAt(idx), h - pad.b + 5));

      layers.forEach((layer) => {
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const x = xAt(i), y = yAt(layer.top[i]);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        for (let i = n - 1; i >= 0; i--) {
          ctx.lineTo(xAt(i), yAt(layer.bottom[i]));
        }
        ctx.closePath();
        ctx.fillStyle = hexToRgba(layer.color, 0.82);
        ctx.fill();
        ctx.strokeStyle = layer.color;
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }
    registerChart(canvas, draw);
    if (opts.legendTarget) {
      buildLegend(opts.legendTarget, datasets.map((d) => d.label), datasets.map((d) => d.color));
    }
  }
  window.GridPreview.renderStackedArea = renderStackedArea;

  /* ---------- Bar chart (horizontal by default) ---------- */
  function renderBarChart(canvas, labels, values, colorsInput, opts) {
    opts = opts || {};
    const horizontal = opts.horizontal !== false;
    function draw() {
      const { ctx, w, h } = prepareCanvas(canvas);
      const colors = themeAwareColors();
      const n = values.length;
      const colorFor = (i) => (Array.isArray(colorsInput) ? colorsInput[i] : colorsInput);

      if (horizontal) {
        ctx.font = '12px "Open Sans", sans-serif';
        const labelW = Math.min(110, Math.max(...labels.map((l) => ctx.measureText(l).width)) + 4);
        const pad = { l: labelW + 12, r: 46, t: 8, b: 8 };
        const plotW = w - pad.l - pad.r;
        const plotH = h - pad.t - pad.b;
        const maxV = Math.max(...values, 0.0001) * 1.08;
        const gap = plotH / n;
        const barH = Math.min(opts.thickness || 18, gap - 8);
        values.forEach((v, i) => {
          const y = pad.t + i * gap + (gap - barH) / 2;
          const bw = Math.max(plotW * (v / maxV), 2);
          const barColor = colorFor(i);
          // Fade toward the axis (zero) the same way the line/area charts
          // fade toward their baseline - full colour at the tip (the
          // actual value), lighter back at the zero end.
          const grad = ctx.createLinearGradient(pad.l + bw, 0, pad.l, 0);
          grad.addColorStop(0, barColor);
          grad.addColorStop(1, hexToRgba(barColor, 0.5));
          ctx.fillStyle = grad;
          roundRectPath(ctx, pad.l, y, bw, barH, 4);
          ctx.fill();
          ctx.fillStyle = colors.text;
          ctx.textAlign = "right";
          ctx.textBaseline = "middle";
          ctx.fillText(labels[i], pad.l - 8, y + barH / 2);
          ctx.textAlign = "left";
          ctx.fillText(formatAxisValue(v, opts.unit), pad.l + bw + 6, y + barH / 2);
        });
      } else {
        const pad = { l: 40, r: 10, t: 16, b: 24 };
        const plotW = w - pad.l - pad.r;
        const plotH = h - pad.t - pad.b;
        const maxV = Math.max(...values, 0.0001) * 1.12;
        const gap = plotW / n;
        const barW = Math.min(opts.thickness || 30, gap - 10);
        values.forEach((v, i) => {
          const bh = plotH * (v / maxV);
          const x = pad.l + i * gap + (gap - barW) / 2;
          const y = pad.t + plotH - bh;
          const barColor = colorFor(i);
          // Same "full colour at the value, fading toward the baseline"
          // treatment as the horizontal bars above and the line/area charts.
          const grad = ctx.createLinearGradient(0, y, 0, pad.t + plotH);
          grad.addColorStop(0, barColor);
          grad.addColorStop(1, hexToRgba(barColor, 0.5));
          ctx.fillStyle = grad;
          roundRectPath(ctx, x, y, barW, bh, 4);
          ctx.fill();
          ctx.fillStyle = colors.text;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(labels[i], x + barW / 2, pad.t + plotH + 5);
          ctx.textBaseline = "bottom";
          ctx.fillText(formatAxisValue(v, opts.unit), x + barW / 2, y - 4);
        });
      }
    }
    registerChart(canvas, draw);

    if (!opts.noExport) {
      const colorArr = Array.isArray(colorsInput) ? colorsInput : labels.map(() => colorsInput);
      attachChartExport(canvas, {
        title: opts.exportTitle,
        kind: "categories",
        data: { labels, values, colors: colorArr, unit: opts.unit },
      });
    }
  }
  window.GridPreview.renderBarChart = renderBarChart;

  /* ---------- Donut chart (2026 redesign) ----------
     Every donut on the site now shares one interaction model - the same one
     the overview page's two mix donuts pioneered: hovering (or, on touch
     devices, tapping) a segment pops it out, gives it a soft colour-matched
     glow, dims the rest, swaps the centre readout to that segment's own
     label/value/share, and opens a floating tooltip anchored to the pointer
     - the same rounded, theme-aware tooltip box style used by the line
     charts (see drawOverlay() above), so every chart on the site now shares
     one tooltip look. This replaces the old opts.leaderLines mode, which
     drew each label directly on the canvas next to its segment: elegant on
     a wide desktop panel, but the horizontal leader-line + text run wasn't
     bounded by the canvas's own width, so it clipped off-canvas on phones
     and the cramped two-column tablet band (see the mobile fix this
     replaces). A pointer-anchored tooltip has no such failure mode - it's
     always positioned and clamped against the canvas it's drawn on - so
     every donut can now safely have the same rich hover treatment the
     overview page used to reserve for just its two largest charts.
     Segments are drawn with a small angular gap between them (rather than
     one continuous ring) so each slice reads as a distinct piece at a
     glance, before you've hovered anything - still filled with the same
     centre-to-rim radial gradient every other chart on the site uses. */
  function renderDonutChart(canvas, labels, values, colors, opts) {
    opts = opts || {};
    // Hover state deliberately lives ON THE CANVAS ELEMENT, not as a local
    // variable in this function's closure. Several pages (every ENTSO-E
    // country page via renderPsrMixSection, plus any page that draws an
    // illustrative donut first and a live one later) call renderDonutChart
    // a SECOND time on the very same <canvas> once live data arrives. The
    // mousemove/touchstart listeners below are only ever bound ONCE per
    // canvas (see the canvas._donutHoverBound guard) - they were written
    // against THIS call's hoverIndex/pointer. But canvas._donutDraw gets
    // reassigned to the newest call's draw() on every re-render. A local
    // `let hoverIndex/pointer` here meant the first call's listeners kept
    // mutating the FIRST closure's variables while canvas._donutDraw()
    // invoked the SECOND (or later) closure's draw() - which read its OWN
    // always-(-1/null) hoverIndex/pointer instead, so the hover glow and
    // tooltip silently stopped appearing after any re-render (bug report:
    // "the donut in Ireland doesn't allow hover over" - reproducible on
    // every page using renderPsrMixSection, not just Ireland). Storing this
    // state on the canvas itself means every draw() call - whichever
    // render "owns" canvas._donutDraw at the time - reads and writes the
    // same shared state the listeners update.
    if (canvas._donutHoverIndex === undefined) canvas._donutHoverIndex = -1;
    if (canvas._donutPointer === undefined) canvas._donutPointer = null; // {x, y} in canvas-local CSS px - drives the floating tooltip

    function draw() {
      const { ctx, w, h } = prepareCanvas(canvas);
      const total = values.reduce((a, b) => a + Math.max(b, 0), 0) || 1;
      const cx = w / 2, cy = h / 2;
      const outerR = Math.max(10, Math.min(w, h) / 2 - 4);
      const innerR = outerR * 0.6;
      // A small fixed gap between segments (in radians), capped so it can
      // never eat more than a fifth of any one segment's own sweep - keeps
      // very thin slices (a 1% interconnector sliver, say) from vanishing
      // into the gap either side of them.
      const rawGap = values.length > 1 ? 0.05 : 0;
      const themeColors = themeAwareColors();
      let start = -Math.PI / 2;
      const arcs = [];
      values.forEach((v, i) => {
        const frac = Math.max(v, 0) / total;
        const sweep = frac * Math.PI * 2;
        const end = start + sweep;
        const gap = Math.min(rawGap, sweep * 0.2);
        const segStart = start + gap / 2;
        const segEnd = Math.max(segStart + 0.001, end - gap / 2);
        const isHover = i === canvas._donutHoverIndex;
        const r = isHover ? outerR + 6 : outerR;

        ctx.save();
        ctx.globalAlpha = canvas._donutHoverIndex === -1 || isHover ? 1 : 0.32;
        if (isHover) {
          ctx.shadowColor = hexToRgba(colors[i], 0.6);
          ctx.shadowBlur = 16;
        }
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(segStart) * innerR, cy + Math.sin(segStart) * innerR);
        ctx.arc(cx, cy, r, segStart, segEnd);
        ctx.arc(cx, cy, innerR, segEnd, segStart, true);
        ctx.closePath();
        // Radial fade from the hole outward - lighter near the centre, full
        // colour at the rim - the same treatment used by every other chart
        // type on the site (lines, stacked areas, bars).
        const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, r);
        grad.addColorStop(0, hexToRgba(colors[i], 0.5));
        grad.addColorStop(1, colors[i]);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();

        arcs.push({ start, end, mid: (start + end) / 2, color: colors[i], label: labels[i], value: v, frac, index: i });
        start = end;
      });

      ctx.fillStyle = themeColors.text;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = '600 13px "Open Sans", sans-serif';
      if (canvas._donutHoverIndex !== -1) {
        const a = arcs[canvas._donutHoverIndex];
        ctx.fillText(a.label, cx, cy - 6);
        ctx.font = '11px "Open Sans", sans-serif';
        ctx.fillText(`${formatAxisValue(a.value, opts.unit)} · ${Math.round(a.frac * 100)}%`, cx, cy + 12);
      } else {
        if (opts.centerLabel) ctx.fillText(opts.centerLabel, cx, cy - 6);
        if (opts.centerSub) {
          ctx.font = '11px "Open Sans", sans-serif';
          ctx.fillText(opts.centerSub, cx, cy + 12);
        }
      }

      // Floating tooltip, anchored to the pointer and clamped inside the
      // canvas - same box style as the line charts' hover tooltip.
      if (canvas._donutHoverIndex !== -1 && canvas._donutPointer) {
        const a = arcs[canvas._donutHoverIndex];
        const pointer = canvas._donutPointer;
        const labelLine = a.label;
        const valueLine = `${formatAxisValue(a.value, opts.unit)} · ${Math.round(a.frac * 100)}%`;
        ctx.font = '700 12px "Open Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
        let boxW = ctx.measureText(labelLine).width;
        ctx.font = '11px "Open Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
        boxW = Math.max(boxW, ctx.measureText(valueLine).width) + 20;
        const boxH = 40;

        let boxX = pointer.x + 12;
        if (boxX + boxW > w - 4) boxX = pointer.x - boxW - 12;
        boxX = Math.max(4, Math.min(boxX, w - boxW - 4));
        let boxY = pointer.y - boxH - 12;
        if (boxY < 4) boxY = Math.min(pointer.y + 12, h - boxH - 4);

        ctx.save();
        roundRectPath(ctx, boxX, boxY, boxW, boxH, 6);
        ctx.fillStyle = themeColors.panelBg;
        ctx.fill();
        ctx.strokeStyle = themeColors.panelBorder;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = a.color;
        ctx.font = '700 12px "Open Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(labelLine, boxX + 10, boxY + 7);
        ctx.fillStyle = themeColors.text;
        ctx.font = '11px "Open Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(valueLine, boxX + 10, boxY + 23);
      }

      canvas._donutArcs = arcs;
      canvas._donutCenter = { cx, cy, outerR, innerR };
    }

    registerChart(canvas, draw);
    if (opts.legendTarget) buildLegend(opts.legendTarget, labels, colors, values, opts.unit);

    if (!opts.noExport) {
      attachChartExport(canvas, {
        title: opts.exportTitle,
        kind: "categories",
        data: { labels, values, colors, unit: opts.unit },
      });
    }

    if (!canvas._donutHoverBound) {
      canvas._donutHoverBound = true;

      function hitTest(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left, y = clientY - rect.top;
        const arcs = canvas._donutArcs, c = canvas._donutCenter;
        if (!arcs || !c) return -1;
        const dx = x - c.cx, dy = y - c.cy;
        const dist = Math.hypot(dx, dy);
        if (dist < c.innerR || dist > c.outerR + 6) return -1;
        let angle = Math.atan2(dy, dx);
        if (angle < -Math.PI / 2) angle += Math.PI * 2;
        for (const a of arcs) {
          if (angle >= a.start && angle < a.end) return a.index;
        }
        return -1;
      }

      canvas.addEventListener("mousemove", (e) => {
        const rect = canvas.getBoundingClientRect();
        const idx = hitTest(e.clientX, e.clientY);
        canvas.style.cursor = idx === -1 ? "default" : "pointer";
        canvas._donutPointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        if (idx !== canvas._donutHoverIndex) {
          canvas._donutHoverIndex = idx;
          canvas._donutDraw && canvas._donutDraw();
        } else if (idx !== -1) {
          // Same segment, pointer moved - redraw so the tooltip follows it.
          canvas._donutDraw && canvas._donutDraw();
        }
      });
      canvas.addEventListener("mouseleave", () => {
        canvas.style.cursor = "default";
        canvas._donutPointer = null;
        if (canvas._donutHoverIndex !== -1) {
          canvas._donutHoverIndex = -1;
          canvas._donutDraw && canvas._donutDraw();
        }
      });

      // Touch devices get no hover event at all, so a tap has to do the
      // same job: identify the segment under the finger, show its glow +
      // tooltip, and leave it showing (rather than needing a held touch)
      // until the visitor taps elsewhere. Deliberately only handled on
      // touchstart, not touchmove, so this never has to call
      // preventDefault() and never interferes with ordinary page scrolling.
      canvas.addEventListener("touchstart", (e) => {
        const t = e.changedTouches[0];
        if (!t) return;
        const rect = canvas.getBoundingClientRect();
        const idx = hitTest(t.clientX, t.clientY);
        canvas._donutPointer = { x: t.clientX - rect.left, y: t.clientY - rect.top };
        canvas._donutHoverIndex = idx;
        canvas._donutDraw && canvas._donutDraw();
      }, { passive: true });

      document.addEventListener("touchstart", (e) => {
        if (canvas._donutHoverIndex === -1 || e.target === canvas) return;
        canvas._donutHoverIndex = -1;
        canvas._donutPointer = null;
        canvas._donutDraw && canvas._donutDraw();
      }, { passive: true });
    }
    canvas._donutDraw = draw;
  }
  window.GridPreview.renderDonutChart = renderDonutChart;

  /**
   * Replaces a "generation mix right now" section's table/donut/bar with an
   * explicit "No data available" state, rather than leaving old illustrative
   * numbers on screen looking like they might be current. Shared by
   * renderPsrMixSection below and by callers that already know up front
   * they have nothing to show (e.g. a totally failed fetch with no cache).
   */
  function showNoMixData(opts, message) {
    const msg = message || "No data available";
    const tbody = document.getElementById(opts.tbodyId);
    if (tbody) {
      const colCount = tbody.closest("table") ? tbody.closest("table").querySelectorAll("thead th").length : 3;
      tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align:center;padding:1.5rem 0;color:var(--text-muted);">${msg}</td></tr>`;
    }
    const donutCanvas = document.getElementById(opts.donutId);
    if (donutCanvas) showChartError(donutCanvas, msg);
    const barCanvas = document.getElementById(opts.barId);
    if (barCanvas) showChartError(barCanvas, msg);
    if (opts.legendId) {
      const legend = document.getElementById(opts.legendId);
      if (legend) legend.innerHTML = "";
    }
    if (opts.donutCaptionId) {
      const el = document.getElementById(opts.donutCaptionId);
      if (el) el.textContent = msg + ".";
    }
    if (opts.statusCaptionId) {
      const el = document.getElementById(opts.statusCaptionId);
      if (el) el.textContent = msg + " - see data sources below.";
    }
  }
  window.GridPreview.showNoMixData = showNoMixData;

  /**
   * Rebuilds a "generation mix right now" section (grouped table + donut +
   * bar) from a live ENTSO-E psrType -> MW breakdown (see
   * assets/data.js's summarizeEntsoeMix()) - shared by pages/ireland.html
   * and every ENTSO-E-sourced country page (France, Netherlands, Belgium,
   * Norway, Denmark, Germany, Spain, Italy, Sweden, Portugal) so this logic
   * exists exactly once rather than once per page. Replaces the page's
   * markup with an explicit "No data available" state (via showNoMixData
   * above) rather than leaving old illustrative numbers in place, if
   * there's nothing usable to render.
   *
   * opts:
   *   tbodyId, donutId, legendId, barId  - element IDs (required)
   *   donutCaptionId, statusCaptionId    - element IDs (optional)
   *   statusCaptionHtml                  - HTML for statusCaptionId once live (optional)
   *   sourceLabel                        - e.g. "ENTSO-E Transparency Platform (France bidding zone)", used in the default donut caption
   *   extraLine                          - { label, mw, color } - one additional row/wedge appended after the psrType groups, e.g. Ireland's EirGrid-sourced GB interconnection figure (optional)
   */
  function renderPsrMixSection(mixMw, opts) {
    if (!window.GridData || typeof window.GridData.summarizeEntsoeMix !== "function") { showNoMixData(opts); return false; }
    const summary = window.GridData.summarizeEntsoeMix(mixMw || {});
    if (!summary.entries.length) { showNoMixData(opts); return false; }

    const tbody = document.getElementById(opts.tbodyId);
    if (!tbody) return false;

    const extraMw = (opts.extraLine && opts.extraLine.mw) ? Math.abs(opts.extraLine.mw) : 0;
    const totalMw = summary.totalMw + extraMw;
    const gw = (mw) => (mw / 1000).toFixed(2);
    const pct = (mw) => totalMw > 0 ? (mw / totalMw * 100).toFixed(1) : "0.0";

    const GROUP_META = {
      renewable: { label: "Renewables", color: "var(--renewable)" },
      fossil: { label: "Fossil fuels", color: "var(--fossil)" },
      nuclear: { label: "Nuclear", color: "var(--other)" },
      other: { label: "Other & storage", color: "var(--other)" },
    };
    const groupMw = { renewable: summary.renewableMw, fossil: summary.fossilMw, nuclear: summary.nuclearMw, other: summary.otherMw };

    tbody.innerHTML = "";
    ["renewable", "fossil", "nuclear", "other"].forEach((groupKey) => {
      if (groupMw[groupKey] <= 0) return;
      const meta = GROUP_META[groupKey];
      const groupRow = document.createElement("tr");
      groupRow.className = "group-row";
      groupRow.innerHTML = `<th scope="row"><span class="swatch" style="background:${meta.color}"></span>${meta.label}</th><td class="num">${gw(groupMw[groupKey])}</td><td class="num">${pct(groupMw[groupKey])}</td>`;
      tbody.appendChild(groupRow);
      summary.entries.filter((e) => e.group === groupKey).forEach((e) => {
        const row = document.createElement("tr");
        row.innerHTML = `<td>${e.label}</td><td class="num">${gw(e.mw)}</td><td class="num">${pct(e.mw)}</td>`;
        tbody.appendChild(row);
      });
    });
    if (extraMw > 0 && opts.extraLine) {
      const row = document.createElement("tr");
      row.className = "group-row";
      row.innerHTML = `<th scope="row"><span class="swatch" style="background:${opts.extraLine.color}"></span>${opts.extraLine.label}</th><td class="num">${gw(extraMw)}</td><td class="num">${pct(extraMw)}</td>`;
      tbody.appendChild(row);
    }

    const labels = summary.entries.map((e) => e.label);
    const values = summary.entries.map((e) => e.mw / 1000);
    const colors = summary.entries.map((e) => (window.GridData.ENTSOE_PSR_COLORS && window.GridData.ENTSOE_PSR_COLORS[e.code]) || "#7a7a7a");
    if (extraMw > 0 && opts.extraLine) {
      labels.push(opts.extraLine.label);
      values.push(extraMw / 1000);
      colors.push(opts.extraLine.color);
    }

    const donutCanvas = document.getElementById(opts.donutId);
    if (donutCanvas) {
      renderDonutChart(donutCanvas, labels, values, colors, {
        legendTarget: opts.legendId, unit: "GW", centerLabel: gw(summary.totalMw) + "GW", centerSub: "generated",
      });
    }
    const barCanvas = document.getElementById(opts.barId);
    if (barCanvas) {
      const paired = labels.map((l, i) => ({ l, v: values[i], c: colors[i] })).sort((a, b) => b.v - a.v);
      renderBarChart(barCanvas, paired.map((p) => p.l), paired.map((p) => p.v), paired.map((p) => p.c), { unit: "GW" });
    }

    if (opts.donutCaptionId) {
      const el = document.getElementById(opts.donutCaptionId);
      if (el) {
        el.textContent = `Generation ${gw(summary.totalMw)}GW` + (extraMw > 0 ? ` plus ${gw(extraMw)}GW imported` : "") + `, live from the ${opts.sourceLabel || "ENTSO-E Transparency Platform"}.`;
      }
    }
    if (opts.statusCaptionId && opts.statusCaptionHtml) {
      const el = document.getElementById(opts.statusCaptionId);
      if (el) el.innerHTML = opts.statusCaptionHtml;
    }
    return true;
  }
  window.GridPreview.renderPsrMixSection = renderPsrMixSection;

  /* ==========================================================================
     Universal chart export toolbar - Copy as text / Download PNG / Download CSV
     ==========================================================================
     Attached automatically by renderLineChart, renderStackedAreaChart,
     renderBarChart and renderDonutChart below, rather than requiring every
     page to hand-wire its own buttons - that's what makes "every graph and
     donut on the site" tractable: enhance the ~5 shared render functions
     once, and every one of the ~100 chart calls across every page picks it
     up automatically. Two exclusions, both automatic:
       - a canvas marked aria-hidden="true" (the small inline sparklines
         next to the headline stats) has nothing meaningful to export, so
         it's skipped;
       - a call that passes opts.noExport (e.g. history.html's charts,
         which already have their own more capable per-metric Copy data
         button plus a combined whole-range CSV/JSON download - adding a
         second, near-duplicate toolbar there would just be clutter).
     A page can still pass opts.exportTitle for a nicer label; if it
     doesn't, deriveChartTitle() below finds one from the page's own
     heading structure, which every page already has consistently (an <h2>
     for the section, an <h3> inside chart-card for an individual metric).
  */

  /** Finds a human title for a chart with no explicit opts.exportTitle, by
      walking up from the canvas to the nearest heading, prefixed with the
      page's own <h1> so "Demand" (say) doesn't read as ambiguous once
      copied/downloaded somewhere that's lost the page context. */
  function deriveChartTitle(canvas) {
    const card = canvas.closest(".chart-card");
    const cardHeading = card && card.querySelector("h3, h4");
    const section = canvas.closest("section, .panel");
    const sectionHeading = section && section.querySelector("h2");
    const heading = cardHeading || sectionHeading;
    const h1 = document.querySelector("h1");
    const pageTitle = (h1 && h1.textContent.trim()) || document.title.split("|")[0].trim();
    const sectionTitle = heading ? heading.textContent.trim() : "";
    return sectionTitle && sectionTitle !== pageTitle ? `${pageTitle} – ${sectionTitle}` : pageTitle;
  }

  function slugify(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "") || "chart";
  }

  function todayStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  /** Same narrative style as mixTableToText (e.g. "Wind: 10.33 GW - 35.8%"),
      but built straight from the arrays already in hand at chart-render
      time rather than re-parsing an HTML table - works for any donut/bar
      snapshot, not just the one page with a matching <table>. Deliberately
      plain text with no markdown syntax (no *bold*, no #headings|), so it
      pastes cleanly into a forum/social comment box or a plain-text email
      exactly as written, rather than leaving stray asterisks visible on a
      site that doesn't render markdown. */
  function categoriesToText(labels, values, unit, title) {
    const lines = [];
    if (title) lines.push(title, "");
    const total = values.reduce((a, b) => a + Math.max(Number(b) || 0, 0), 0) || 1;
    labels.forEach((l, i) => {
      const v = values[i];
      const pct = ((Math.max(Number(v) || 0, 0) / total) * 100).toFixed(1);
      lines.push(`${l}: ${formatAxisValue(v, unit)} (${pct}%)`);
    });
    lines.push("", "Source: https://ukgridlive.info/");
    return lines.join("\n");
  }

  function categoriesToCsv(labels, values, unit) {
    const header = ["label", unit ? `value (${unit})` : "value", "share of total (%)"];
    const total = values.reduce((a, b) => a + Math.max(Number(b) || 0, 0), 0) || 1;
    const lines = [header.map(csvField).join(",")];
    labels.forEach((l, i) => {
      const pct = ((Math.max(Number(values[i]) || 0, 0) / total) * 100).toFixed(1);
      lines.push([l, values[i], pct].map(csvField).join(","));
    });
    return lines.join("\r\n");
  }

  /** Legend entries for the PNG card - one swatch + label per category
      (donut/bar), or one swatch + series name per line in a multi-column
      time series (stacked area, or a line chart with a compare overlay).
      A single-column time series (the common case: one metric, one line)
      gets no legend at all - there's nothing to distinguish, and the
      chart's own title already says what it is. */
  function buildLegendEntries(spec) {
    if (spec.kind === "categories") {
      const { labels, values, colors, unit } = spec.data;
      const total = (values || []).reduce((a, b) => a + Math.max(Number(b) || 0, 0), 0) || 1;
      return labels.map((l, i) => ({
        color: (colors && colors[i]) || "#7a7a7a",
        text: `${l}: ${formatAxisValue(values[i], unit)} (${Math.round((Math.max(Number(values[i]) || 0, 0) / total) * 100)}%)`,
      }));
    }
    const cols = (spec.data.columns || []).filter((c) => c && c.color);
    if (cols.length > 1) {
      return cols.map((c) => ({ color: c.color, text: c.name }));
    }
    return [];
  }

  /** Wraps legend entries into as many rows as the card's width actually
      needs, measured with real canvas text metrics rather than guessing a
      fixed row length - this is what keeps every category's key legible
      on the exported image regardless of how many there are (checked
      against the site's own worst cases: Australia's ~10 fuel-type
      categories including both battery directions, and GB's own
      multi-row generation-mix table) instead of a fixed-height legend
      area that would clip or overlap once a page has more categories
      than whichever count the layout happened to be eyeballed against. */
  function layoutLegendRows(ctx, entries, maxWidth) {
    const rows = [];
    let row = [];
    let rowW = 0;
    const gap = 20;
    entries.forEach((e) => {
      const w = 16 + ctx.measureText(e.text).width + gap;
      if (row.length && rowW + w > maxWidth) {
        rows.push(row);
        row = [];
        rowW = 0;
      }
      row.push(e);
      rowW += w;
    });
    if (row.length) rows.push(row);
    return rows;
  }

  function drawLegendRows(ctx, rows, x0, y0, rowH, palette) {
    ctx.font = '600 13px "Open Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textBaseline = "middle";
    rows.forEach((row, ri) => {
      let x = x0;
      const y = y0 + ri * rowH + rowH / 2;
      row.forEach((e) => {
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(x + 5, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = palette.text;
        ctx.fillText(e.text, x + 16, y + 1);
        x += 16 + ctx.measureText(e.text).width + 20;
      });
    });
  }

  /** Fits a title onto one line, truncating with an ellipsis only in the
      rare case a page heading plus section heading combined don't fit -
      simpler and more predictable than wrapping to a second line and
      having to recompute every other element's y-offset underneath it. */
  function fitTitleLine(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
    return t + "…";
  }

  /**
   * Renders a shareable PNG of a live chart: the chart's own current canvas
   * pixels (already theme-correct, already showing real data - captured via
   * drawImage rather than redrawn from scratch, so this works identically
   * for every chart type without reimplementing each one's drawing code a
   * second time) plus a title/timestamp header, a legend sized to fit every
   * category, and a source footer. Card height is computed AFTER measuring
   * how many legend rows are actually needed, so nothing is ever clipped -
   * see layoutLegendRows() above.
   */
  function downloadChartSnapshotPng(canvas, spec) {
    const scale = 2;
    const cardW = 900;
    const pad = 28;
    const dark = themeAwareColors().dark;
    const palette = dark
      ? { bg: "#14161c", border: "#333846", text: "#edeef2", muted: "#a2a8b6" }
      : { bg: "#ffffff", border: "#dde1e7", text: "#171a21", muted: "#5b6270" };

    const srcW = canvas.clientWidth || canvas.width || 600;
    const srcH = canvas.clientHeight || canvas.height || 330;
    const chartW = cardW - pad * 2;
    const chartH = Math.round(chartW * Math.min(srcH / srcW, 0.75));

    const measureCanvas = document.createElement("canvas");
    const mctx = measureCanvas.getContext("2d");
    mctx.font = '600 13px "Open Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
    const legendEntries = buildLegendEntries(spec);
    const legendRows = layoutLegendRows(mctx, legendEntries, chartW);

    const headerH = 74;
    const legendRowH = 24;
    const legendH = legendRows.length ? legendRows.length * legendRowH + 14 : 0;
    const footerH = 30;
    const cardH = headerH + chartH + legendH + footerH + pad;

    const out = document.createElement("canvas");
    out.width = cardW * scale;
    out.height = cardH * scale;
    const ctx = out.getContext("2d");
    ctx.scale(scale, scale);

    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, cardW, cardH);

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = palette.text;
    ctx.font = '700 18px "Open Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(fitTitleLine(ctx, spec.title || "UK Grid: Live+", cardW - pad * 2), pad, 32);
    ctx.fillStyle = palette.muted;
    ctx.font = '500 12px "Open Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillText("ukgridlive.info – as of " + new Date().toLocaleString(), pad, 52);
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, headerH - 8);
    ctx.lineTo(cardW - pad, headerH - 8);
    ctx.stroke();

    ctx.drawImage(canvas, pad, headerH, chartW, chartH);

    if (legendRows.length) {
      drawLegendRows(ctx, legendRows, pad, headerH + chartH + 14, legendRowH, palette);
    }

    ctx.fillStyle = palette.muted;
    ctx.font = '400 11px "Open Sans", -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillText("Source: https://ukgridlive.info/", pad, cardH - 12);

    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ukgridlive-${spec.base}-${todayStamp()}.png`;
      a.style.position = "fixed";
      a.style.opacity = "0";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }
  window.GridPreview.downloadChartSnapshotPng = downloadChartSnapshotPng;

  /** Creates (once) the Copy as text / Download PNG / Download CSV row for
      a chart, inserted as a sibling right after its .chart-wrap - not
      inside it, since .chart-wrap has its own fixed aspect-ratio/height
      CSS plus the is-loading::before shimmer overlay, and sibling buttons
      inside that box would get squeezed or clipped by that layout. */
  function ensureChartToolbar(canvas) {
    if (canvas._exportToolbar) return canvas._exportToolbar;
    const wrap = canvas.closest(".chart-wrap") || canvas.parentElement;
    const toolbar = document.createElement("div");
    toolbar.className = "chart-toolbar";
    toolbar.innerHTML = [
      ["copy", "Copy as text"],
      ["png", "Download PNG"],
      ["csv", "Download CSV"],
    ].map(([action, label]) => (
      `<button type="button" class="copy-btn chart-toolbar__btn" data-chart-action="${action}">` +
      `<span data-copy-label>${label}</span></button>`
    )).join("");
    wrap.insertAdjacentElement("afterend", toolbar);
    canvas._exportToolbar = toolbar;
    return toolbar;
  }

  /** The single entry point every render*Chart function below calls. Safe
      to call on every (re-)render of the same canvas: toolbar creation and
      button wiring happen once (guarded by toolbar.dataset.wired), while
      canvas._exportSpec - what the buttons actually read when clicked - is
      refreshed every time, so a chart that's re-rendered with new data
      (illustrative placeholder swapped for live data, a range-tab switch
      reusing the same canvas) always exports what's currently on screen. */
  function attachChartExport(canvas, spec) {
    if (!spec || spec.noExport) return;
    if (canvas.getAttribute("aria-hidden") === "true") return;
    const title = spec.title || deriveChartTitle(canvas);
    const base = spec.filenameBase || slugify(title);
    canvas._exportSpec = Object.assign({}, spec, { title, base });

    const toolbar = ensureChartToolbar(canvas);
    if (toolbar.dataset.wired) return;
    toolbar.dataset.wired = "1";

    const copyBtn = toolbar.querySelector('[data-chart-action="copy"]');
    const pngBtn = toolbar.querySelector('[data-chart-action="png"]');
    const csvBtn = toolbar.querySelector('[data-chart-action="csv"]');

    copyBtn.addEventListener("click", () => {
      const s = canvas._exportSpec;
      const text = s.kind === "categories"
        ? categoriesToText(s.data.labels, s.data.values, s.data.unit, s.title)
        : seriesToText(s.data.times, s.data.labels, s.data.columns, { title: s.title });
      copyText(text).then(() => announceCopyResult(copyBtn, true)).catch(() => announceCopyResult(copyBtn, false));
    });

    csvBtn.addEventListener("click", () => {
      const s = canvas._exportSpec;
      const csv = s.kind === "categories"
        ? categoriesToCsv(s.data.labels, s.data.values, s.data.unit)
        : seriesToCsv(s.data.times, s.data.labels, s.data.columns, {});
      downloadTextFile(`ukgridlive-${s.base}-${todayStamp()}.csv`, csv, "text/csv");
      announceCopyResult(csvBtn, true);
    });

    pngBtn.addEventListener("click", () => {
      downloadChartSnapshotPng(canvas, canvas._exportSpec);
      announceCopyResult(pngBtn, true);
    });
  }
  window.GridPreview.attachChartExport = attachChartExport;

  /* ---------- External links: open in a new tab, mark it clearly ---------- */
  function externalizeLinks() {
    const here = window.location.hostname;
    document.querySelectorAll('a[href^="http://"], a[href^="https://"]').forEach((a) => {
      if (a.hostname && here && a.hostname === here) return; // internal absolute link
      if (a.dataset.extDone) return;
      a.dataset.extDone = "1";
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
      a.classList.add("ext-link");
      const icon = document.createElement("span");
      icon.className = "ext-link__icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = " ↗";
      const sr = document.createElement("span");
      sr.className = "visually-hidden";
      sr.textContent = " (opens in new window)";
      a.appendChild(icon);
      a.appendChild(sr);
    });
  }

  /* ---------- Copy-table-as-text buttons ---------- */
  // Turns a .mix table (Source / GW / % - or similar 2-3 column layout) into
  // a plain-text block using its <thead> labels as units, so copied text
  // reads naturally (e.g. "Wind: 10.33 GW - 35.8%") rather than dumping
  // raw HTML. Indents non-group rows under their group-row parent.
  function mixTableToText(table, title) {
    const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.trim());
    const lines = [];
    if (title) lines.push(title, '');
    table.querySelectorAll('tbody tr').forEach((tr) => {
      const cells = Array.from(tr.children).map((c) => c.textContent.replace(/\s+/g, ' ').trim());
      if (!cells[0]) return;
      const indent = tr.classList.contains('group-row') ? '' : '  ';
      const valueParts = [];
      for (let i = 1; i < cells.length; i++) {
        if (cells[i] === '' || cells[i] === '-' || cells[i] === '-') continue;
        const unit = headers[i] || '';
        valueParts.push(unit === '%' ? `${cells[i]}%` : `${cells[i]}${unit ? ' ' + unit : ''}`);
      }
      lines.push(indent + cells[0] + (valueParts.length ? ': ' + valueParts.join(' - ') : ''));
    });
    lines.push('', 'Source: https://ukgridlive.info/');
    return lines.join('\n');
  }
  window.GridPreview.mixTableToText = mixTableToText;

  /** Turns any data table (thead th headers + tbody rows) into a CSV
      string - a generic counterpart to mixTableToText above, used by
      [data-csv-table] buttons wherever a page shows a table but has no
      backing labels/values array in JS to hand to categoriesToCsv
      directly (the Records/Context and Notable moments tables, e.g.,
      exist only as server-rendered/DOM content, not JS arrays). */
  function tableToCsv(table) {
    const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.trim());
    const lines = [headers.map(csvField).join(',')];
    table.querySelectorAll('tbody tr').forEach((tr) => {
      const cells = Array.from(tr.children).map((c) => c.textContent.replace(/\s+/g, ' ').trim());
      if (!cells[0]) return;
      lines.push(cells.map(csvField).join(','));
    });
    return lines.join('\r\n');
  }
  window.GridPreview.tableToCsv = tableToCsv;

  /** Same job as mixTableToText/tableToCsv above, but for a Records/Context
      or Notable moments list (<ul class="records-list"><li><span>label</span>
      <strong>value</strong></li>...</ul>) rather than a <table> - shared by
      every "Copy as text" button on those sections, sitewide. */
  function listToText(ul, title) {
    const lines = [];
    if (title) lines.push(title, "");
    ul.querySelectorAll("li").forEach((li) => {
      const label = li.querySelector("span");
      const value = li.querySelector("strong");
      if (!label) return;
      const labelText = label.textContent.replace(/\s+/g, " ").trim();
      const valueText = value ? value.textContent.replace(/\s+/g, " ").trim() : "";
      lines.push(valueText ? `${labelText}: ${valueText}` : labelText);
    });
    lines.push("", "Source: https://ukgridlive.info/");
    return lines.join("\n");
  }
  window.GridPreview.listToText = listToText;

  function listToCsv(ul) {
    const lines = ["label,value"];
    ul.querySelectorAll("li").forEach((li) => {
      const label = li.querySelector("span");
      const value = li.querySelector("strong");
      if (!label) return;
      const labelText = label.textContent.replace(/\s+/g, " ").trim();
      const valueText = value ? value.textContent.replace(/\s+/g, " ").trim() : "";
      lines.push([labelText, valueText].map(csvField).join(","));
    });
    return lines.join("\r\n");
  }
  window.GridPreview.listToCsv = listToCsv;

  /* Turns one or more time-series columns into a tab-separated block, one
     row per timestamp - pastes straight into a spreadsheet as proper
     columns, unlike mixTableToText's narrative style above (which is meant
     for the single-snapshot mix table, not a run of data points). Used by
     the History page's "Copy data" buttons.
       times/labels: parallel arrays of ISO timestamps / axis labels - times
         is preferred (full precision); labels is the fallback.
       columns: [{ name, unit, values }, ...] - one or more series sharing
         the same times/labels.
     Returns a string ready for copyText(). */
  function seriesToText(times, labels, columns, opts) {
    opts = opts || {};
    const lines = [];
    if (opts.title) lines.push(opts.title, '');
    const header = ['Date/time', ...columns.map((c) => (c.unit ? `${c.name} (${c.unit})` : c.name))];
    lines.push(header.join('\t'));
    const n = (times && times.length) || (labels && labels.length) || (columns[0] && columns[0].values.length) || 0;
    for (let i = 0; i < n; i++) {
      const when = (times && times[i]) ? formatTooltipDateTime(times[i]) : (labels ? labels[i] : '');
      const row = [when, ...columns.map((c) => (c.values[i] == null ? '' : c.values[i]))];
      lines.push(row.join('\t'));
    }
    lines.push('', 'Source: https://ukgridlive.info/');
    return lines.join('\n');
  }
  window.GridPreview.seriesToText = seriesToText;

  /** One CSV field, quoted (and internal quotes doubled) only if it actually needs it - commas, quotes or newlines. */
  function csvField(v) {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /** Same shape/inputs as seriesToText, but returns a proper CSV string (comma-separated, quoted where needed, ISO timestamps rather than formatted ones - a downloaded file is for feeding into another tool, not for reading on screen). */
  function seriesToCsv(times, labels, columns, opts) {
    opts = opts || {};
    const lines = [];
    const header = ['timestamp', ...columns.map((c) => (c.unit ? `${c.name} (${c.unit})` : c.name))];
    lines.push(header.map(csvField).join(','));
    const n = (times && times.length) || (labels && labels.length) || (columns[0] && columns[0].values.length) || 0;
    for (let i = 0; i < n; i++) {
      const when = (times && times[i]) || (labels ? labels[i] : '');
      const row = [when, ...columns.map((c) => (c.values[i] == null ? '' : c.values[i]))];
      lines.push(row.map(csvField).join(','));
    }
    return lines.join('\r\n');
  }
  window.GridPreview.seriesToCsv = seriesToCsv;

  /** Same shape/inputs as seriesToText, but returns a JSON string: one object per timestamp, one key per column (by name), plus a source/generated-at footer. */
  function seriesToJson(times, labels, columns, opts) {
    opts = opts || {};
    const n = (times && times.length) || (labels && labels.length) || (columns[0] && columns[0].values.length) || 0;
    const points = [];
    for (let i = 0; i < n; i++) {
      const point = { t: (times && times[i]) || (labels ? labels[i] : null) };
      columns.forEach((c) => { point[c.name] = c.values[i] == null ? null : c.values[i]; });
      points.push(point);
    }
    return JSON.stringify({
      title: opts.title || null,
      units: Object.fromEntries(columns.map((c) => [c.name, c.unit || null])),
      generatedAt: new Date().toISOString(),
      source: 'https://ukgridlive.info/',
      points,
    }, null, 2);
  }
  window.GridPreview.seriesToJson = seriesToJson;

  /**
   * Combines several independently-fetched series (each its own
   * {times, values, unit}, keyed by name) onto one shared, sorted time
   * axis - the shape seriesToCsv/seriesToJson expect. Each metric on a
   * History range panel is fetched as its own API call and can come back
   * with a slightly different point count/timing (a slow source, a gap in
   * one table but not another), so a naive index-by-index zip would
   * silently misalign values against the wrong timestamp. This instead
   * unions every series's own timestamps, sorts them, and looks each
   * metric's value up by its own timestamp for every row - metrics with no
   * point at a given timestamp just get a null in that cell rather than a
   * value borrowed from a neighbouring row.
   */
  function mergeSeriesByTime(seriesMap) {
    const allTimes = new Set();
    Object.keys(seriesMap).forEach((name) => {
      const s = seriesMap[name];
      if (s && s.times) s.times.forEach((t) => allTimes.add(t));
    });
    const times = Array.from(allTimes).sort();
    const columns = Object.keys(seriesMap).map((name) => {
      const s = seriesMap[name];
      const byTime = {};
      if (s && s.times) s.times.forEach((t, i) => { byTime[t] = s.values[i]; });
      return { name, unit: s && s.unit, values: times.map((t) => (t in byTime ? byTime[t] : null)) };
    });
    return { times, columns };
  }
  window.GridPreview.mergeSeriesByTime = mergeSeriesByTime;

  /** Turns a topic's own output series (e.g. fossil GW) plus the sitewide
      total generation series into a third series of that topic's %
      share of generation at each matching point in time - used by the
      "Explore by energy type" pages' "Share of total generation" charts.
      Matches points by their ISO timestamp (not array index): the two
      input series both come from api/series.php's identical bucketing
      logic over the same range, so their time-sets are normally the same,
      but matching by time rather than assuming index alignment is a small
      amount of extra safety for the rare bucket that only one of the two
      queries returns a row for (e.g. a fuel type with a single zero-mw
      reading that got excluded upstream). Returns null if either input is
      null, so callers can treat "can't compute a share" the same as any
      other "no data yet" case. */
  function computeShareSeries(partSeries, totalSeries) {
    if (!partSeries || !totalSeries) return null;
    const totalByTime = {};
    totalSeries.times.forEach((t, i) => { totalByTime[t] = totalSeries.values[i]; });
    const times = [];
    const labels = [];
    const values = [];
    partSeries.times.forEach((t, i) => {
      if (!(t in totalByTime)) return;
      const total = totalByTime[t];
      const part = partSeries.values[i];
      if (typeof total !== "number" || total <= 0 || typeof part !== "number") return;
      times.push(t);
      labels.push(partSeries.labels[i]);
      values.push((part / total) * 100);
    });
    if (!times.length) return null;
    return { times, labels, values, unit: "%" };
  }
  window.GridPreview.computeShareSeries = computeShareSeries;

  /** Triggers a browser download of in-memory text as a file - no server round trip, just a Blob + a momentary off-screen link click. Shared by every "download data" button on the site. */
  function downloadTextFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.position = 'fixed';
    a.style.opacity = '0';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoked after a tick rather than immediately - some browsers cancel
    // the download if the object URL disappears before the click finishes
    // being handled.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  window.GridPreview.downloadTextFile = downloadTextFile;

  /**
   * Renders a shareable PNG "snapshot card" - generation mix donut plus a
   * few headline stats - onto an off-screen canvas and triggers a
   * download. Deliberately uses a fixed dark brand palette rather than
   * the viewer's current light/dark theme: the image is meant to be
   * shared and viewed outside the site (social media, messaging apps),
   * where the local theme setting has no meaning.
   *
   * data shape: {
   *   title: "UK Grid: Live+",
   *   asOf: "as of 14:32, 16 Aug 2026",
   *   sourceLabels: [...], sourceValues: [...], sourceColors: [...],
   *   renewablePct: 42,
   *   stats: [{ label, value, unit }, ...] (up to 4),
   *   filename: "ukgridlive-snapshot-2026-08-16.png"
   * }
   */
  function downloadSnapshotCard(data) {
    const W = 1200, H = 630, scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    const bg = "#14161c", panel = "#1c1f27", border = "#333846";
    const text = "#edeef2", muted = "#a2a8b6", accent = "#35c299";

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = text;
    ctx.font = "700 30px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(data.title || "UK Grid: Live+", 48, 64);
    ctx.fillStyle = muted;
    ctx.font = "500 16px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText("ukgridlive.info", 48, 88);

    ctx.textAlign = "right";
    ctx.fillStyle = muted;
    ctx.font = "500 16px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(data.asOf || "", W - 48, 64);
    ctx.textAlign = "left";

    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(48, 108);
    ctx.lineTo(W - 48, 108);
    ctx.stroke();

    // Donut - left half, plain gradient fill (no hover state, this is a
    // static export), gap-segmented to match the site's on-page donuts.
    const cx = 250, cy = 380, outerR = 148, innerR = 90;
    const values = data.sourceValues || [];
    const labels = data.sourceLabels || [];
    const colors = data.sourceColors || [];
    const total = values.reduce((a, b) => a + b, 0) || 1;
    let angle = -Math.PI / 2;
    const rawGap = values.length > 1 ? 0.045 : 0;
    values.forEach((v, i) => {
      const sweep = (v / total) * Math.PI * 2;
      const gap = Math.min(rawGap, sweep * 0.2);
      const start = angle + gap / 2;
      const end = angle + sweep - gap / 2;
      if (end > start && v > 0) {
        const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
        grad.addColorStop(0, hexToRgba(colors[i], 0.55));
        grad.addColorStop(1, colors[i]);
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, start, end);
        ctx.arc(cx, cy, innerR, end, start, true);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }
      angle += sweep;
    });

    ctx.textAlign = "center";
    ctx.fillStyle = text;
    ctx.font = "700 26px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(Math.round(data.renewablePct || 0) + "%", cx, cy - 2);
    ctx.fillStyle = muted;
    ctx.font = "500 13px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText("renewable", cx, cy + 18);
    ctx.textAlign = "left";

    let ly = cy + outerR + 34;
    const lx0 = cx - outerR;
    labels.forEach((label, i) => {
      const pct = Math.round((values[i] / total) * 100);
      if (pct <= 0) return;
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.arc(lx0 + 6, ly - 5, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = text;
      ctx.font = "500 14px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText(label + " " + pct + "%", lx0 + 20, ly);
      ly += 22;
    });

    // Stat cards - right half, 2-column grid.
    const sx = 560, sw = W - 48 - sx, cols = 2;
    const cellW = sw / cols, cellH = 108;
    (data.stats || []).forEach((s, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = sx + col * cellW, y = 150 + row * cellH;
      const w = cellW - 16, h = cellH - 16;

      roundRectPath(ctx, x, y, w, h, 10);
      ctx.fillStyle = panel;
      ctx.fill();
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = muted;
      ctx.font = "600 12px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText(String(s.label || "").toUpperCase(), x + 18, y + 28);

      ctx.fillStyle = accent;
      ctx.font = "700 28px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.fillText(s.value, x + 18, y + 62);

      if (s.unit) {
        const valWidth = ctx.measureText(s.value).width;
        ctx.fillStyle = muted;
        ctx.font = "500 14px system-ui, -apple-system, Segoe UI, sans-serif";
        ctx.fillText(s.unit, x + 18 + valWidth + 6, y + 62);
      }
    });

    ctx.fillStyle = muted;
    ctx.font = "400 13px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText("Snapshot generated " + new Date().toLocaleString(), 48, H - 28);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || "ukgridlive-snapshot.png";
      a.style.position = "fixed";
      a.style.opacity = "0";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }
  window.GridPreview.downloadSnapshotCard = downloadSnapshotCard;

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    // Fallback for non-HTTPS/older browsers: a hidden, selected textarea + execCommand.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (!ok) throw new Error('execCommand copy failed');
  }
  window.GridPreview.copyText = copyText;

  function announceCopyResult(btn, ok) {
    const label = btn.querySelector('[data-copy-label]');
    const original = label ? label.getAttribute('data-original') || label.textContent : null;
    if (label && !label.getAttribute('data-original')) label.setAttribute('data-original', label.textContent);
    if (label) label.textContent = ok ? 'Copied!' : 'Copy failed';
    btn.classList.toggle('is-copied', ok);
    btn.classList.toggle('is-copy-failed', !ok);
    clearTimeout(btn._copyResetTimer);
    btn._copyResetTimer = setTimeout(() => {
      if (label && original) label.textContent = original;
      btn.classList.remove('is-copied', 'is-copy-failed');
    }, 1800);
  }
  window.GridPreview.announceCopyResult = announceCopyResult;

  function initCopyButtons() {
    document.querySelectorAll('[data-copy-table]').forEach((btn) => {
      const table = document.getElementById(btn.getAttribute('data-copy-table'));
      if (!table) return;
      btn.addEventListener('click', () => {
        const title = btn.getAttribute('data-copy-title') || '';
        const text = mixTableToText(table, title);
        copyText(text)
          .then(() => announceCopyResult(btn, true))
          .catch(() => announceCopyResult(btn, false));
      });
    });
    document.querySelectorAll('[data-csv-table]').forEach((btn) => {
      const table = document.getElementById(btn.getAttribute('data-csv-table'));
      if (!table) return;
      btn.addEventListener('click', () => {
        const csv = tableToCsv(table);
        const base = slugify(btn.getAttribute('data-csv-title') || table.id || 'table');
        downloadTextFile(`ukgridlive-${base}-${todayStamp()}.csv`, csv, 'text/csv');
        announceCopyResult(btn, true);
      });
    });
    document.querySelectorAll('[data-copy-list]').forEach((btn) => {
      const list = document.getElementById(btn.getAttribute('data-copy-list'));
      if (!list) return;
      btn.addEventListener('click', () => {
        const title = btn.getAttribute('data-copy-title') || '';
        const text = listToText(list, title);
        copyText(text)
          .then(() => announceCopyResult(btn, true))
          .catch(() => announceCopyResult(btn, false));
      });
    });
    document.querySelectorAll('[data-csv-list]').forEach((btn) => {
      const list = document.getElementById(btn.getAttribute('data-csv-list'));
      if (!list) return;
      btn.addEventListener('click', () => {
        const csv = listToCsv(list);
        const base = slugify(btn.getAttribute('data-csv-title') || list.id || 'list');
        downloadTextFile(`ukgridlive-${base}-${todayStamp()}.csv`, csv, 'text/csv');
        announceCopyResult(btn, true);
      });
    });
  }

  /* ---------- Toast notifications ----------
     A small, generic toast system - stacks in the bottom-right corner (full-
     width at the bottom on narrow screens), auto-dismisses, and can also be
     dismissed by hand. Used below by the data-pipeline status check to flag
     genuine problems and successful data updates without the user having to
     go looking at the small footer pill.

     showToast(message, type) - type is "success" | "error" | "info",
     defaulting to "info". Safe to call before the page has finished
     loading; the container is created lazily on first use. */
  let toastContainer = null;
  function showToast(message, type) {
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.className = "toast-container";
      toastContainer.setAttribute("aria-live", "polite");
      toastContainer.setAttribute("aria-atomic", "false");
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement("div");
    toast.className = "toast toast--" + (type || "info");
    toast.setAttribute("role", type === "error" ? "alert" : "status");

    const text = document.createElement("span");
    text.className = "toast__text";
    text.textContent = message;
    toast.appendChild(text);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "toast__close";
    closeBtn.setAttribute("aria-label", "Dismiss notification");
    closeBtn.innerHTML = "&times;";
    toast.appendChild(closeBtn);

    function remove() {
      toast.classList.add("is-leaving");
      toast.addEventListener("animationend", () => toast.remove(), { once: true });
      // Fallback in case animations are disabled/skipped for any reason.
      setTimeout(() => toast.remove(), 400);
    }
    closeBtn.addEventListener("click", remove);

    toastContainer.appendChild(toast);
    const autoDismissMs = type === "error" ? 9000 : 6000;
    setTimeout(remove, autoDismissMs);
  }

  /* Compares the data-pipeline status just fetched against what was seen on
     the previous page load (remembered in localStorage) and toasts on
     genuinely new-to-this-browser events - a fresh error, or a completed
     data update - rather than repeating the same toast on every single page
     load once things are stable.

     Deliberately toasts on the very FIRST check a browser ever makes too
     (there's nothing to compare against yet, so no prior state just counts
     as "different" from whatever's live now) - the alternative, requiring
     two page loads before ever showing a "live data updated" toast, means
     you'd never see confirmation right after the pipeline starts working,
     which defeats the point. After that first toast, it naturally settles
     into only firing on actual changes (a new last_run_at, a new error).

     Falls back to doing nothing if localStorage isn't available (private
     browsing, etc.); that's a minor loss of the "don't repeat" dedupe,
     never a functional problem. */
  function notifyPipelineChange(data) {
    const STORAGE_KEY = "ukgrid_pipeline_last_seen";
    let prev = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) prev = JSON.parse(raw);
    } catch (e) {
      /* ignore - treated as "no previous state known" below */
    }

    const current = { overall: data.overall, last_run_at: data.last_run_at || null };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch (e) {
      /* ignore - storage full/unavailable, notifications just won't dedupe */
    }

    const prevOverall = prev ? prev.overall : null;
    const prevLastRunAt = prev ? prev.last_run_at : null;

    if (data.overall === "fail" && prevOverall !== "fail") {
      const sources = data.sources || {};
      const failed = Object.keys(sources).filter((k) => sources[k] && sources[k].status !== "OK");
      showToast(
        "Data pipeline error" + (failed.length ? ": " + failed.join(", ") : "") + ". Check the footer for details.",
        "error"
      );
    } else if (data.overall === "error" && prevOverall !== "error") {
      showToast("Couldn't reach the data pipeline status check. The site may be showing illustrative data.", "error");
    } else if (data.overall === "success" && current.last_run_at && current.last_run_at !== prevLastRunAt) {
      showToast("Live data updated.", "success");
    }
  }

  /* ---------- Data-pipeline status pill (footer) ----------
     Reports whether the backend is actually pulling data from Elexon/NESO/
     Carbon Intensity and writing it to MySQL, by reading api/status.php
     (which reports the most recent ingest_log row per source). Injected via
     JS into every page's .site-footer so all 12+ pages get it without
     editing each footer template individually.

     Three real states, matching how api/status.php reports things, plus a
     transient "checking" state while the request is in flight:
       - "success" - the backend is reachable and every source that's run
         at least once last succeeded
       - "fail"    - the backend is reachable but at least one source's
         last run ended in ERROR (e.g. an API was down, NESO's schema
         changed) - hover/focus the pill for which source and why
       - "pending" - the backend is reachable but nothing has run yet
         (fresh install, on-demand refresh hasn't triggered yet)
       - "error"   - couldn't even reach/parse api/status.php (this preview
         build with no backend at all, a missing config.php, a database
         connection failure, network error, etc.)
     If there's no .site-footer on the page at all, this does nothing. */
  function initIngestStatusPill() {
    const footerWrap = document.querySelector(".site-footer .wrap");
    if (!footerWrap) return;

    const holder = document.createElement("p");
    holder.className = "ingest-status";
    holder.innerHTML =
      '<span class="status-pill" data-status="checking">' +
      '<span class="status-pill__dot" aria-hidden="true"></span>' +
      '<span class="status-pill__label">Checking data pipeline…</span>' +
      "</span>";
    footerWrap.appendChild(holder);

    const pill = holder.querySelector(".status-pill");
    const label = holder.querySelector(".status-pill__label");

    function setState(state, text, title) {
      pill.setAttribute("data-status", state);
      label.textContent = text;
      if (title) pill.setAttribute("title", title);
      else pill.removeAttribute("title");
    }

    function timeAgo(iso) {
      if (!iso) return "";
      const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
      if (mins < 1) return "just now";
      if (mins === 1) return "1 minute ago";
      if (mins < 60) return mins + " minutes ago";
      const hrs = Math.round(mins / 60);
      return hrs === 1 ? "1 hour ago" : hrs + " hours ago";
    }

    // Shared with buildApiIssueBanner()'s per-page checks below - fetchStatus()
    // caches the request, so this and any per-page banner check on the same
    // load hit api/status.php once between them, not twice.
    (window.GridData ? window.GridData.fetchStatus() : Promise.resolve(null)).then((data) => {
      if (!data) {
        setState("error", "Data pipeline: status unavailable");
        notifyPipelineChange({ overall: "error", last_run_at: null });
        return;
      }
      if (data.overall === "success") {
        setState("success", "Data pipeline: OK" + (data.last_run_at ? " - updated " + timeAgo(data.last_run_at) : ""));
      } else if (data.overall === "fail") {
        const sources = data.sources || {};
        const failed = Object.keys(sources).filter((k) => sources[k] && sources[k].status !== "OK");
        setState(
          "fail",
          "Data pipeline: error" + (failed.length ? " (" + failed.join(", ") + ")" : ""),
          failed.map((k) => k + ": " + (sources[k].message || "unknown error")).join("\n")
        );
      } else {
        setState("pending", "Data pipeline: no data yet");
      }
      notifyPipelineChange(data);
    });
  }

  /* ---------- Scroll-reveal animation for panels/cards ---------- */
  function initReveal() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = document.querySelectorAll(".panel, .source-card");
    if (reduceMotion || !("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (entry.isIntersecting) {
            entry.target.style.animationDelay = (i % 4) * 0.06 + "s";
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    targets.forEach((el) => io.observe(el));
  }

  /* Every page sets live figures by writing straight into an element whose
     id starts with "stat-" (id="stat-demand", id="stat-price", the "Data as
     of" id="stat-time" line, etc.) once a background fetch resolves. That's
     a silent DOM write - nothing tells the reader a number just moved. This
     watches every such element for a genuine text change and toggles
     .stat-refresh-pulse (see style.css) to give it a brief, self-clearing
     flash. Deliberately excludes ids ending "-band" (the traffic-light dot
     text, which toggles [hidden] rather than refreshing a value) since that
     already has its own visual treatment. */
  function initStatRefreshAnim() {
    const targets = Array.from(document.querySelectorAll('[id^="stat-"]')).filter(
      (el) => !/-band$/.test(el.id)
    );
    if (!targets.length) return;
    const lastText = new WeakMap();
    targets.forEach((el) => lastText.set(el, el.textContent));

    const flash = (el) => {
      el.classList.remove("stat-refresh-pulse");
      // Force a reflow so the animation restarts even if it's already
      // mid-flight from a very recent previous update.
      void el.offsetWidth;
      el.classList.add("stat-refresh-pulse");
    };

    const observer = new MutationObserver((mutations) => {
      const touched = new Set();
      mutations.forEach((m) => {
        let el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        while (el && !targets.includes(el)) el = el.parentElement;
        if (el) touched.add(el);
      });
      touched.forEach((el) => {
        const next = el.textContent;
        if (lastText.get(el) !== next) {
          lastText.set(el, next);
          flash(el);
        }
      });
    });
    targets.forEach((el) =>
      observer.observe(el, { characterData: true, childList: true, subtree: true })
    );
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initNav();
    initTabs();
    initReveal();
    initCopyButtons();
    initIngestStatusPill();
    initStatRefreshAnim();
    externalizeLinks();

    // Update aria-current year in footer
    document.querySelectorAll("[data-current-year]").forEach((el) => {
      el.textContent = new Date().getFullYear();
    });
  });
})();

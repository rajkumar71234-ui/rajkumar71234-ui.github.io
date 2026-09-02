/* =========================================================================
   Minimal Wealth Advisory — live index returns.
   One request to TradingView's public scanner, no key, nothing stored.
   Three, five and ten year figures are compounded annual returns.
   ========================================================================= */
(function () {
  "use strict";

  var ENDPOINT = "https://scanner.tradingview.com/global/scan";

  var ROWS = [
    { t: "NSE:NIFTY",        label: "Nifty 50",            note: "Large cap", k: "nifty50" },
    { t: "BSE:SENSEX",       label: "Sensex",              note: "30 companies" },
    { t: "NSE:MID150BEES",   label: "Nifty Midcap 150",    note: "Mid cap", k: "midcap150", etf: true },
    { t: "NSE:HDFCSML250",   label: "Nifty Smallcap 250",  note: "Small cap", k: "smallcap250", etf: true },
    { t: "NSE:CNX500",       label: "Nifty 500",           note: "The broad market", k: "nifty500" },
    { t: "TVC:GOLD",         label: "Gold",                note: "Spot, USD/oz" },
    { t: "MCX:GOLD1!",       label: "Gold (MCX)",          note: "Rupees, 10g" },
    { t: "NASDAQ:IXIC",      label: "Nasdaq Composite",    note: "United States" }
  ];

  /* order matters — it is the order the columns are drawn in */
  var COLUMNS = ["close", "change", "Perf.1M", "Perf.3M", "Perf.6M",
                 "Perf.YTD", "Perf.Y", "Perf.3Y", "Perf.5Y", "Perf.10Y"];

  var body  = document.getElementById("retbody");
  var stamp = document.getElementById("retstamp");
  if (!body) return;

  function level(n) {
    if (n == null || !isFinite(n)) return "&mdash;";
    return n.toLocaleString("en-IN", { maximumFractionDigits: n < 100 ? 2 : 0 });
  }

  /* a cumulative return over `years`, expressed as a compounded annual rate */
  function cagr(pct, years) {
    if (pct == null || !isFinite(pct)) return null;
    var growth = 1 + pct / 100;
    if (growth <= 0) return null;
    return (Math.pow(growth, 1 / years) - 1) * 100;
  }

  var HEADS = ["Level", "Today", "1M", "3M", "6M", "FY", "1Y",
               "3Y CAGR", "5Y CAGR", "10Y CAGR", "15Y CAGR", "25Y CAGR"];

  function cell(pct, head) {
    var lab = ' data-h="' + head + '"';
    if (pct == null || !isFinite(pct)) return '<td class="ret"' + lab + ">&mdash;</td>";
    var cls = pct > 0 ? "is-up" : (pct < 0 ? "is-down" : "");
    var sign = pct > 0 ? "+" : "";
    return '<td class="ret ' + cls + '"' + lab + ">" + sign + pct.toFixed(2) + "%</td>";
  }

  /* TradingView silently clamps a long window to however much history the
     instrument actually has, so an identical pair means the longer one is
     not real. Blank it rather than print a number that is not what it says. */
  function longRuns(d) {
    var y3 = d[7], y5 = d[8], y10 = d[9];
    var same = function (a, b) {
      return a != null && b != null && Math.abs(a - b) < 0.005;
    };
    if (same(y10, y5)) y10 = null;
    if (same(y5, y3)) y5 = null;
    return [cagr(y3, 3), cagr(y5, 5), cagr(y10, 10)];
  }

  /* Official NSE closes, refreshed daily into assets/data/indices.json, are
     used wherever we have them — they cover every window including the
     financial year and twenty-five years. The live feed fills the rest. */
  var OFFICIAL = null;

  function draw(map) {
    var html = "";
    ROWS.forEach(function (r) {
      var d = map[r.t];
      var o = (OFFICIAL && r.k && OFFICIAL.indices) ? OFFICIAL.indices[r.k] : null;

      html += "<tr>" +
        '<th scope="row"><span class="retname">' + r.label + "</span>" +
        '<span class="retnote2">' + r.note + "</span></th>";

      var lr = d ? longRuns(d) : [null, null, null];
      var v = o ? [
        o.level, o.today, o.m1, o.m3, o.m6, o.fy, o.y1,
        o.y3, o.y5, o.y10, o.y15, o.y25
      ] : [
        d ? d[0] : null, d ? d[1] : null, d ? d[2] : null, d ? d[3] : null,
        d ? d[4] : null, null, d ? d[6] : null,
        lr[0], lr[1], lr[2], null, null
      ];

      /* the live feed keeps the level and today's move current, but only
         where its ticker really is the index — for the two rows quoted off
         an ETF the index's own close is the honest number */
      if (d && !(o && r.etf)) { v[0] = d[0]; v[1] = d[1]; }

      html += '<td class="retlevel" data-h="Level">' + level(v[0]) + "</td>";
      for (var i = 1; i < HEADS.length; i++) html += cell(v[i], HEADS[i]);
      html += "</tr>";
    });
    body.innerHTML = html;
  }

  function fail() {
    body.innerHTML = '<tr><td colspan="11" class="retnote">' +
      "The live feed did not answer just now. Refresh in a moment." + "</td></tr>";
  }

  var tickers = ROWS.map(function (r) { return r.t; });

  function liveTable() { return fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      symbols: { tickers: tickers, query: { types: [] } },
      columns: COLUMNS
    })
  })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (j) {
      var map = {};
      (j.data || []).forEach(function (row) { map[row.s] = row.d; });
      draw(map);
      if (stamp) {
        stamp.innerHTML = "Live from the exchanges via " +
          '<a href="https://www.tradingview.com/" target="_blank" rel="noopener">TradingView</a>' +
          ", read at " + new Date().toLocaleString("en-IN", {
            day: "numeric", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit"
          }) + ". " + (OFFICIAL
            ? "Index returns are calculated from NSE's own published closes, refreshed after each session."
            : "A dash means the index has not existed that long.");
      }
    })
    .catch(fail); }

  fetch("assets/data/indices.json", { cache: "no-cache" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { OFFICIAL = j; })
    .catch(function () {})
    .then(liveTable);

  /* Our own month-end series for the BSE 500 — index level and trailing
     earnings per index point, back to 1999. It is the only place a real
     earnings history for the index exists, so the chart is drawn from it
     rather than from anything a data vendor will licence. */
  var CHART_DREW = false, OWN = null;
  fetch("assets/data/bse500.json", { cache: "no-cache" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j) return;
      OWN = j;
      var go = function () { CHART_DREW = drawIndexChart(j); };
      if (window.LightweightCharts) go();
      else window.addEventListener("load", go);
    })
    .catch(function () {});

  /* ------------------------------------------------- repo rates and CPI -- */

  var rateEls = document.querySelectorAll("[data-rate]");
  var rateTickers = Array.prototype.map.call(rateEls, function (el) {
    return el.getAttribute("data-rate");
  });

  if (rateTickers.length) fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      symbols: { tickers: rateTickers, query: { types: [] } },
      columns: ["close"]
    })
  })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (j) {
      var map = {};
      (j.data || []).forEach(function (row) { map[row.s] = row.d[0]; });
      Array.prototype.forEach.call(rateEls, function (el) {
        var v = map[el.getAttribute("data-rate")];
        el.textContent = (v == null || !isFinite(v)) ? "—" : v.toFixed(2) + "%";
      });
    })
    .catch(function () {});

  /* =======================================================================
     Small live charts. Data comes from the World Bank (annual, keyless and
     CORS-open) and the BIS policy-rate series via DBnomics. Nothing here is
     typed in by hand; if a feed is quiet the chart simply does not draw.
     ======================================================================= */

  var ACCENT = "#E0402B", BROWN = "#74604B";

  function svgChart(points, colour, opts) {
    opts = opts || {};
    if (!points || points.length < 2) return "";
    var W = 620, H = opts.tall ? 230 : 120, PL = 34, PR = 8, PT = 12, PB = 20;
    var vals = points.map(function (p) { return p.v; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (opts.zero && lo > 0) lo = 0;
    if (hi === lo) { hi = lo + 1; }
    var pad = (hi - lo) * 0.12; lo -= pad; hi += pad;

    var x = function (i) { return PL + (W - PL - PR) * (i / (points.length - 1)); };
    var y = function (v) { return PT + (H - PT - PB) * (1 - (v - lo) / (hi - lo)); };

    var line = points.map(function (p, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.v).toFixed(1); }).join(" ");
    var area = line + " L" + x(points.length - 1).toFixed(1) + " " + (H - PB) + " L" + x(0).toFixed(1) + " " + (H - PB) + " Z";

    var gid = "g" + Math.random().toString(36).slice(2, 8);
    var ticks = "";
    [hi - pad, lo + pad].forEach(function (v) {
      ticks += '<line x1="' + PL + '" y1="' + y(v).toFixed(1) + '" x2="' + (W - PR) + '" y2="' + y(v).toFixed(1) +
               '" stroke="#E4DFD6" stroke-width="1"/>' +
               '<text x="' + (PL - 6) + '" y="' + (y(v) + 3.5).toFixed(1) + '" text-anchor="end" class="cx-ax">' +
               v.toFixed(v > 100 ? 0 : 1) + "</text>";
    });
    if (opts.zero && lo < 0 && hi > 0) {
      ticks += '<line x1="' + PL + '" y1="' + y(0).toFixed(1) + '" x2="' + (W - PR) + '" y2="' + y(0).toFixed(1) +
               '" stroke="#C9C2B6" stroke-width="1"/>';
    }

    return '<svg class="cx" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img" aria-label="' +
      (opts.label || "history") + '">' +
      '<defs><linearGradient id="' + gid + '" x1="0" x2="0" y1="0" y2="1">' +
      '<stop offset="0%" stop-color="' + colour + '" stop-opacity="0.20"/>' +
      '<stop offset="100%" stop-color="' + colour + '" stop-opacity="0"/></linearGradient></defs>' +
      ticks +
      '<path d="' + area + '" fill="url(#' + gid + ')"/>' +
      '<path d="' + line + '" fill="none" stroke="' + colour + '" stroke-width="1.8" ' +
      'stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
      '<circle cx="' + x(points.length - 1).toFixed(1) + '" cy="' + y(points[points.length - 1].v).toFixed(1) +
      '" r="3" fill="' + colour + '"/>' +
      '<text x="' + PL + '" y="' + (H - 5) + '" class="cx-ax">' + points[0].t + "</text>" +
      '<text x="' + (W - PR) + '" y="' + (H - 5) + '" text-anchor="end" class="cx-ax">' +
      points[points.length - 1].t + "</text>" +
      "</svg>";
  }


  /* Five values read better as bars than as a line — one column a year. */
  function svgBars(points, colour, opts) {
    opts = opts || {};
    if (!points || !points.length) return "";
    var W = 620, H = 230, PL = 10, PR = 10, PT = 26, PB = 26;
    var vals = points.map(function (p) { return p.v; });
    var hi = Math.max.apply(null, vals), lo = Math.min.apply(null, vals);
    if (lo > 0) lo = 0;
    if (hi < 0) hi = 0;
    if (hi === lo) hi = lo + 1;
    var span = hi - lo, top = hi + span * 0.16, bot = lo - (lo < 0 ? span * 0.1 : 0);
    var y = function (v) { return PT + (H - PT - PB) * (1 - (v - bot) / (top - bot)); };
    var slot = (W - PL - PR) / points.length, bw = Math.min(64, slot * 0.56);
    var dense = points.length > 6 ? " cx-val--sm" : "";

    var out = "";
    var zero = y(0);
    out += '<line x1="' + PL + '" y1="' + zero.toFixed(1) + '" x2="' + (W - PR) +
           '" y2="' + zero.toFixed(1) + '" stroke="#C9C2B6" stroke-width="1"/>';
    points.forEach(function (p, i) {
      var cx = PL + slot * i + slot / 2, ytop = y(Math.max(p.v, 0)), ybot = y(Math.min(p.v, 0));
      out += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + ytop.toFixed(1) +
             '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, ybot - ytop).toFixed(1) +
             '" fill="' + colour + '" fill-opacity="' + (i === points.length - 1 ? "1" : "0.55") + '"/>' +
             '<text x="' + cx.toFixed(1) + '" y="' + (ytop - 7).toFixed(1) +
             '" text-anchor="middle" class="cx-val' + dense + '">' +
             (opts.fmt ? opts.fmt(p.v) : p.v.toFixed(1)) + "</text>" +
             '<text x="' + cx.toFixed(1) + '" y="' + (H - 7) +
             '" text-anchor="middle" class="cx-ax' + (dense ? " cx-ax--sm" : "") + '">' +
             (dense ? String(p.t).replace(/^(FY|20)/, "") : p.t) + "</text>";
    });
    return '<svg class="cx" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img" aria-label="' +
           (opts.label || "five years") + '">' + out + "</svg>";
  }

  function paintBars(el, points, colour, opts) {
    if (!el) return;
    var svg = svgBars(points, colour, opts);
    el.innerHTML = svg || '<span class="cx-none">Not available.</span>';
  }

  function paint(el, points, colour, opts) {
    if (!el) return;
    var svg = svgChart(points, colour, opts);
    if (!svg) { el.innerHTML = '<span class="cx-none">History not available.</span>'; return; }
    el.innerHTML = svg;
    var note = el.getAttribute("data-note-into");
    if (note) {
      var n = document.getElementById(note);
      if (n) n.textContent = points[points.length - 1].t;
    }
  }

  /* ---------------------------------------------------- world bank, annual */

  function worldBank(country, indicator, years) {
    var u = "https://api.worldbank.org/v2/country/" + country + "/indicator/" + indicator +
            "?format=json&per_page=" + years + "&mrv=" + years;
    return fetch(u).then(function (r) { return r.json(); }).then(function (j) {
      if (!Array.isArray(j) || !j[1]) return [];
      return j[1].filter(function (d) { return d.value != null; })
                 .map(function (d) { return { t: d.date, v: +d.value }; })
                 .reverse();
    });
  }

  /* ------------------------------------------- BIS policy rates, monthly */

  function bisPolicy(code, months) {
    var u = "https://api.db.nomics.world/v22/series/BIS/WS_CBPOL/M." + code + "?observations=1";
    return fetch(u).then(function (r) { return r.json(); }).then(function (j) {
      var d = j.series && j.series.docs && j.series.docs[0];
      if (!d) return [];
      var out = [];
      for (var i = 0; i < d.period.length; i++) {
        var v = d.value[i];
        if (typeof v === "number") out.push({ t: d.period[i], v: v });
      }
      return out.slice(-months);
    });
  }

  /* ------------------------------------------------------------- wiring */

  function chartEl(id) { return document.getElementById(id); }

  if (chartEl("cx-inrepo")) {
    bisPolicy("IN", 300).then(function (p) {
      paint(chartEl("cx-inrepo"), p, ACCENT, { label: "India policy rate" });
      var s = document.getElementById("cx-inrepo-last"); if (s && p.length) s.textContent = p[p.length - 1].t;
    }).catch(function () {});
    bisPolicy("US", 300).then(function (p) {
      paint(chartEl("cx-usrate"), p, BROWN, { label: "US policy rate" });
      var s = document.getElementById("cx-usrate-last"); if (s && p.length) s.textContent = p[p.length - 1].t;
    }).catch(function () {});

    worldBank("IND", "FP.CPI.TOTL.ZG", 30).then(function (p) {
      paint(chartEl("cx-incpi"), p, ACCENT, { label: "India inflation", zero: true });
      var s = document.getElementById("cx-incpi-last"); if (s && p.length) s.textContent = p[p.length - 1].t;
    }).catch(function () {});
    worldBank("USA", "FP.CPI.TOTL.ZG", 30).then(function (p) {
      paint(chartEl("cx-uscpi"), p, BROWN, { label: "US inflation", zero: true });
      var s = document.getElementById("cx-uscpi-last"); if (s && p.length) s.textContent = p[p.length - 1].t;
    }).catch(function () {});
  }

  if (chartEl("cx-ingdp")) {
    /* the last ten years, one bar a year */
    worldBank("IND", "NY.GDP.MKTP.KD.ZG", 10).then(function (p) {
      paintBars(chartEl("cx-ingdp"), p, ACCENT, {
        label: "India real GDP growth, last ten years",
        fmt: function (v) { return v.toFixed(1) + "%"; }
      });
      var l = document.getElementById("cx-ingdp-now");
      if (l && p.length) l.textContent = p[p.length - 1].v.toFixed(2) + "%";
      var d = document.getElementById("cx-ingdp-year");
      if (d && p.length) d.textContent = p[p.length - 1].t;
    }).catch(function () {});

    /* gross GST collections, financial year by financial year */
    fetch("assets/data/gst.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.rows) return;
        var pts = j.rows.map(function (r) { return { t: r[0], v: r[1] }; });
        paintBars(chartEl("cx-ingst"), pts, BROWN, {
          label: "India gross GST collections",
          fmt: function (v) { return v.toFixed(2); }
        });
        var l = document.getElementById("cx-ingst-now");
        if (l) l.textContent = "\u20B9" + pts[pts.length - 1].v.toFixed(2) + " lakh cr";
        var d = document.getElementById("cx-ingst-year");
        if (d) d.textContent = pts[pts.length - 1].t;
      }).catch(function () {});
  }


  /* ==================================================================
     India's economy against what India's listed companies actually earn.
     Profits are summed live from the 500 Nifty 500 constituents, by the
     fiscal year each company reported. GDP is the World Bank's series.
     Both are rebased to 100 so the two paths can be compared.
     ================================================================== */

  function svgDual(a, b, labelA, labelB) {
    if (!a.length || a.length !== b.length) return "";
    var W = 620, H = 250, PL = 38, PR = 10, PT = 14, PB = 26;
    var all = a.concat(b).map(function (p) { return p.v; });
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    var pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
    var x = function (i) { return PL + (W - PL - PR) * (i / (a.length - 1)); };
    var y = function (v) { return PT + (H - PT - PB) * (1 - (v - lo) / (hi - lo)); };
    var path = function (s) {
      return s.map(function (p, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.v).toFixed(1); }).join(" ");
    };
    var grid = "";
    [hi - pad, (hi + lo) / 2, lo + pad].forEach(function (v) {
      grid += '<line x1="' + PL + '" y1="' + y(v).toFixed(1) + '" x2="' + (W - PR) + '" y2="' + y(v).toFixed(1) +
              '" stroke="#E4DFD6" stroke-width="1"/>' +
              '<text x="' + (PL - 6) + '" y="' + (y(v) + 3.5).toFixed(1) + '" text-anchor="end" class="cx-ax">' +
              Math.round(v) + "</text>";
    });
    var ticks = "";
    a.forEach(function (p, i) {
      if (i === 0 || i === a.length - 1 || i === Math.floor(a.length / 2)) {
        ticks += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="' +
                 (i === 0 ? "start" : i === a.length - 1 ? "end" : "middle") + '" class="cx-ax">' + p.t + "</text>";
      }
    });
    return '<svg class="cx" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img" aria-label="' +
      labelA + " against " + labelB + '">' + grid + ticks +
      '<path d="' + path(b) + '" fill="none" stroke="' + BROWN + '" stroke-width="1.8" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
      '<path d="' + path(a) + '" fill="none" stroke="' + ACCENT + '" stroke-width="1.8" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
      '<circle cx="' + x(a.length - 1).toFixed(1) + '" cy="' + y(a[a.length - 1].v).toFixed(1) + '" r="3" fill="' + ACCENT + '"/>' +
      '<circle cx="' + x(b.length - 1).toFixed(1) + '" cy="' + y(b[b.length - 1].v).toFixed(1) + '" r="3" fill="' + BROWN + '"/>' +
      "</svg>";
  }

  function rebase(series) {
    var base = series[0].v;
    return series.map(function (p) { return { t: p.t, v: (p.v / base) * 100 }; });
  }

  function buildEarnings() {
    var host = document.getElementById("cx-gdpeps");     /* may be absent now */
    var anchor = document.getElementById("cx-n500pe");
    if (!host && !anchor) return;
    var fail = function (msg) { if (host) host.innerHTML = '<span class="cx-none">' + msg + "</span>"; };

    var profits = fetch(ENDPOINT.replace("/global/", "/india/"), {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        symbols: { query: { types: ["stock"] }, symbolset: ["SYML:BSE;BSE500"] },
        columns: ["fiscal_period_fy_h", "net_income_fy_h", "market_cap_basic", "net_income_ttm",
                   "sector", "Perf.3M", "total_revenue_fq_h"],
        range: [0, 500]
      })
    }).then(function (r) { return r.json(); });

    Promise.all([profits]).then(function (res) {
      var j = res[0];
      var by = {}, mcap = 0, nittm = 0;
      (j.data || []).forEach(function (row) {
        var ys = row.d[0] || [], vs = row.d[1] || [];
        for (var i = 0; i < ys.length; i++) {
          if (typeof ys[i] === "number" && typeof vs[i] === "number") {
            by[ys[i]] = by[ys[i]] || { s: 0, n: 0 };
            by[ys[i]].s += vs[i];
            by[ys[i]].n += 1;
          }
        }
        if (typeof row.d[2] === "number") mcap += row.d[2];
        if (typeof row.d[3] === "number") nittm += row.d[3];
      });

      /* live valuation of the whole index, from its own constituents */
      var pe = nittm > 0 ? mcap / nittm : null;
      var set = function (id, txt) { var e = document.getElementById(id); if (e) e.textContent = txt; };
      if (mcap > 0) {
        set("cx-n500mcap", "₹" + (mcap / 1e7 / 1e5).toFixed(2) + " lakh cr");
      }
      var lvlNow = (((OFFICIAL || {}).indices || {}).bse500 || {}).level;
      if (lvlNow) set("cx-n500lvl", Math.round(lvlNow).toLocaleString("en-IN"));

      /* earnings per index point come from our own series — the same figure
         the chart draws — so the panel and the chart never disagree */
      var ownEps = (OWN && OWN.rows && OWN.rows.length)
        ? OWN.rows[OWN.rows.length - 1][2] : null;
      if (ownEps) {
        set("cx-n500eps", "₹" + Math.round(ownEps).toLocaleString("en-IN"));
        var lv = lvlNow || OWN.rows[OWN.rows.length - 1][1];
        set("cx-n500pe", (lv / ownEps).toFixed(1) + "×");
      } else if (pe) {
        set("cx-n500pe", pe.toFixed(1) + "×");
      }
      var prEl = document.getElementById("cx-n500profit");
      var gdEl = document.getElementById("cx-gdpshare");

      sectorTable(j.data || []);

      /* only years where nearly every company has reported */
      var years = Object.keys(by).map(Number).sort(function (p, q) { return p - q; })
        .filter(function (y) { return by[y].n >= 400; });
      if (years.length < 4) { fail("Not enough reported years yet."); return; }

      /* the index's own close at the end of each financial year, written by
         the daily job into assets/data/indices.json */
      var idx = (OFFICIAL && OFFICIAL.indices) || {};
      var src = idx.bse500 || idx.nifty500 || {};
      var lvlBy = src.fyClose || {};

      var pts = [], gts = [];
      years.forEach(function (y) {
        var lv = lvlBy[String(y)];
        if (lv == null) return;
        var lab = "FY" + String(y).slice(2);
        pts.push({ t: lab, v: by[y].s });
        gts.push({ t: lab, v: +lv });
      });
      if (pts.length < 4) { fail("History not available."); return; }

      if (prEl) prEl.textContent = "₹" + (pts[pts.length - 1].v / 1e7 / 1e5).toFixed(2) + " lakh cr";
      if (gdEl) {
        var eg = pts[pts.length - 1].v / pts[0].v, pg = gts[gts.length - 1].v / gts[0].v;
        gdEl.textContent = (pg > eg ? "Price, by " : "Earnings, by ") +
          (Math.abs(pg / eg - 1) * 100).toFixed(0) + "%";
      }

      /* earnings expressed in index points: scale the combined profit so the
         latest year equals the index's own EPS today, then every earlier year
         sits on the same axis as the price */
      var lvlNow2 = (((OFFICIAL || {}).indices || {}).bse500 || {}).level;
      var epsNow = (lvlNow2 && pe) ? lvlNow2 / pe : null;
      var scale = (epsNow && pts.length) ? epsNow / pts[pts.length - 1].v : null;

      var epsSeries = [];
      if (scale) {
        years.forEach(function (y) {
          if (!by[y]) return;
          epsSeries.push({ time: y + "-03-31", value: +(by[y].s * scale).toFixed(2) });
        });
        epsSeries.sort(function (a, b) { return a.time < b.time ? -1 : 1; });
      }

      if (!CHART_DREW && host) {
        host.removeAttribute("hidden");
        host.innerHTML = svgDual(rebase(pts), rebase(gts),
                                 "BSE 500 earnings", "BSE 500 index");
      }
    }).catch(function () {
      fail("The feed did not answer. Refresh in a moment.");
    });
  }

  /* the constituent pull is the heaviest request on the page, so it goes
     last — after everything above has already painted */
  if (document.getElementById("cx-gdpeps") || document.getElementById("cx-n500pe")) {
    var go = function () { setTimeout(buildEarnings, 400); };
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go);
  }


  /* ------------------------------------------------- sectors of the 500 -- */

  function sectorTable(rows) {
    var body = document.getElementById("secbody");
    if (!body) return;

    var S = {}, total = 0;
    rows.forEach(function (row) {
      var d = row.d;
      var name = d[4] || "Other", mc = d[2];
      if (typeof mc !== "number") return;
      var s = S[name] = S[name] || { mc: 0, pw: 0, pn: 0, r0: 0, r1: 0, n: 0, rn: 0 };
      s.mc += mc; total += mc; s.n += 1;
      if (typeof d[5] === "number") { s.pw += d[5] * mc; s.pn += mc; }
      var rev = d[6] || [];
      if (typeof rev[0] === "number" && typeof rev[1] === "number") {
        s.r0 += rev[0]; s.r1 += rev[1]; s.rn += 1;
      }
    });

    var list = Object.keys(S).map(function (k) {
      var v = S[k];
      return {
        name: k, n: v.n,
        w: (v.mc / total) * 100,
        p3: v.pn ? v.pw / v.pn : null,
        q: v.r1 ? ((v.r0 - v.r1) / v.r1) * 100 : null
      };
    }).sort(function (a, b) { return b.w - a.w; });

    var html = list.map(function (r) {
      return "<tr>" +
        '<th scope="row"><span class="retname">' + r.name + "</span>" +
        '<span class="retnote2">' + r.n + " companies</span></th>" +
        '<td class="retlevel" data-h="Weight">' + r.w.toFixed(2) + "%</td>" +
        '<td class="secbar" data-h="Weight"><span style="width:' +
          Math.max(1, (r.w / list[0].w) * 100).toFixed(1) + '%"></span></td>' +
        cell(r.p3, "3M return") +
        cell(r.q, "QoQ sales") +
        "</tr>";
    }).join("");
    body.innerHTML = html;

    var st = document.getElementById("secstamp");
    if (st) st.textContent = list.length + " sectors, " +
      rows.length + " companies, weighted by market value.";
  }


  /* ------------------------------------------ quarterly GDP, India vs US -- */

  function oecdQuarterly(country, mode, n) {
    var code = "Q.Y." + country + ".S1.S1.B1GQ._Z._Z._Z.PC.L." + mode + ".T0102";
    var u = "https://api.db.nomics.world/v22/series/OECD/" +
            "DSD_NAMAIN1@DF_QNA_EXPENDITURE_GROWTH_G20/" + code + "?observations=1";
    return fetch(u).then(function (r) { return r.json(); }).then(function (j) {
      var d = j.series && j.series.docs && j.series.docs[0];
      if (!d) return [];
      var out = [];
      for (var i = 0; i < d.period.length; i++) {
        if (typeof d.value[i] === "number") {
          out.push({ t: d.period[i].replace("-Q", " Q"), v: d.value[i] });
        }
      }
      return out.slice(-n);
    });
  }

  function buildQuarterly() {
    var host = document.getElementById("cx-qgdp");
    if (!host) return;
    Promise.all([
      oecdQuarterly("IND", "G1", 24),
      oecdQuarterly("USA", "G1", 24),
      oecdQuarterly("IND", "GY", 1),
      oecdQuarterly("USA", "GY", 1)
    ]).then(function (r) {
      var a = r[0], b = r[1];
      var n = Math.min(a.length, b.length);
      if (n < 4) { host.innerHTML = '<span class="cx-none">History not available.</span>'; return; }
      a = a.slice(-n); b = b.slice(-n);
      host.innerHTML = svgDual(a, b, "India quarterly growth", "US quarterly growth");

      var set = function (id, txt) { var e = document.getElementById(id); if (e) e.textContent = txt; };
      set("cx-qgdp-in", a[n - 1].v.toFixed(2) + "%");
      set("cx-qgdp-us", b[n - 1].v.toFixed(2) + "%");
      set("cx-qgdp-q", a[n - 1].t);
      if (r[2].length) set("cx-qgdp-inyy", r[2][0].v.toFixed(2) + "%");
      if (r[3].length) set("cx-qgdp-usyy", r[3][0].v.toFixed(2) + "%");
      set("cx-qgdp-from", a[0].t);
    }).catch(function () {
      host.innerHTML = '<span class="cx-none">The feed did not answer. Refresh in a moment.</span>';
    });
  }

  if (document.getElementById("cx-qgdp")) buildQuarterly();


  /* ==================================================================
     One chart, two lines: the BSE 500 and the earnings underneath it.

     TradingView publishes no earnings series for an index, so their
     embed widget cannot show this. We use their charting library
     instead and supply both series ourselves — the index from its own
     month-end closes, the earnings from all 500 companies' filings,
     scaled so the latest point equals the index's actual EPS today.
     ================================================================== */

  function monthEndISO(y, m) {          /* m is 1-12 */
    var d = new Date(Date.UTC(y, m, 0));
    return d.toISOString().slice(0, 10);
  }

  /* the index and its own earnings, on two locked axes ------------------- */
  function drawIndexChart(own) {
    var el = document.getElementById("cx-lwc");
    if (!el || !window.LightweightCharts || !own || !own.rows || own.rows.length < 24) return false;
    var LC = window.LightweightCharts;

    var priceRaw = [], epsRaw = [];
    own.rows.forEach(function (r) {
      if (typeof r[1] === "number") priceRaw.push({ time: r[0], value: r[1] });
      if (typeof r[2] === "number") epsRaw.push({ time: r[0], value: r[2] });
    });
    if (priceRaw.length < 24 || epsRaw.length < 24) return false;

    /* Earnings read on the left scale, the index on the right, exactly as in
       the sheet: both plain (not logarithmic), both starting at zero, and the
       right scale always 22.5 times the left. Where the lines sit together the
       index is on 22.5 times earnings; where price runs above earnings the
       market is paying more than that, and below it, less. */
    var RATIO = 22.5;

    /* ---- the current financial year, carried forward as a dotted line ----
       Earnings are actual up to the last reported quarter. The rest of this
       financial year is continued at the pace earnings have actually grown
       over the past twelve months. It is an extrapolation, not a forecast,
       and it is drawn dotted so it never reads as fact. */
    var last  = epsRaw[epsRaw.length - 1];
    var lastD = new Date(last.time + "T00:00:00Z");
    var yrAgo = null;
    for (var i = epsRaw.length - 1; i >= 0; i--) {
      if ((lastD - new Date(epsRaw[i].time + "T00:00:00Z")) / 86400000 >= 360) {
        yrAgo = epsRaw[i]; break;
      }
    }
    var g = (yrAgo && yrAgo.value > 0) ? Math.pow(last.value / yrAgo.value, 1 / 12) : 1;
    if (!isFinite(g) || g <= 0) g = 1;

    var fyEnd = lastD.getUTCMonth() >= 3 ? lastD.getUTCFullYear() + 1 : lastD.getUTCFullYear();
    var proj = [{ time: last.time, value: last.value }];
    var cur = last.value, py = lastD.getUTCFullYear(), pm = lastD.getUTCMonth() + 1, guard = 0;
    while (!(py === fyEnd && pm === 3) && guard++ < 24) {
      pm += 1; if (pm > 12) { pm = 1; py += 1; }
      cur *= g;
      proj.push({ time: monthEndISO(py, pm), value: +cur.toFixed(2) });
    }

    /* ---- one price range, shared, so the ratio can never drift ----------
       Both scales start at zero and the top follows whatever period is on
       screen, so you can zoom into a few years and actually see them while
       the twenty-two-and-a-half to one relationship still holds. */
    var allEps = epsRaw.concat(proj.slice(1));
    var visFrom = priceRaw[0].time, visTo = allEps[allEps.length - 1].time;

    function spanIn(rows, mult) {
      var lo = Infinity, hi = -Infinity;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].time < visFrom || rows[i].time > visTo) continue;
        var v = rows[i].value * mult;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      return [lo, hi];
    }

    function bounds() {
      var a = spanIn(priceRaw, 1), b = spanIn(allEps, RATIO);
      var hi = Math.max(a[1], b[1]);
      if (!isFinite(hi) || hi <= 0) hi = 45000;
      return hi * 1.06;                        /* index units; zero at the foot */
    }

    /* left is earnings, right is the index — the sheet's own arrangement */
    function leftInfo()  { return { priceRange: { minValue: 0, maxValue: bounds() / RATIO } }; }
    function rightInfo() { return { priceRange: { minValue: 0, maxValue: bounds() } }; }

    var num = function (v) { return Math.round(v).toLocaleString("en-IN"); };
    var eps2 = function (v) { return v >= 100 ? num(v) : v.toFixed(1); };

    var chart = LC.createChart(el, {
      layout: { background: { color: "#FAF8F5" }, textColor: "#74604B", fontSize: 11,
                fontFamily: "Inter, system-ui, sans-serif", attributionLogo: false },
      grid: { vertLines: { color: "rgba(228,223,214,0.7)" },
              horzLines: { color: "rgba(228,223,214,0.7)" } },
      leftPriceScale:  { visible: true, mode: 0, borderColor: "#E4DFD6",
                         scaleMargins: { top: 0.08, bottom: 0.02 } },
      rightPriceScale: { visible: true, mode: 0, borderColor: "#E4DFD6",
                         scaleMargins: { top: 0.08, bottom: 0.02 } },
      timeScale: { borderColor: "#E4DFD6", rightOffset: 4, fixLeftEdge: true,
                   fixRightEdge: true, minBarSpacing: 0.02 },
      crosshair: { mode: 0, vertLine: { color: "#B9AF9F", labelBackgroundColor: "#74604B" },
                   horzLine: { color: "#B9AF9F", labelBackgroundColor: "#74604B" } },
      handleScale: { axisPressedMouseMove: { time: true, price: false }, pinch: true,
                     mouseWheel: true },
      handleScroll: true, autoSize: true
    });

    var priceS = chart.addLineSeries({
      priceScaleId: "right", color: "#74604B", lineWidth: 2, priceLineVisible: false,
      crosshairMarkerRadius: 3,
      priceFormat: { type: "custom", minMove: 1, formatter: num },
      autoscaleInfoProvider: rightInfo
    });
    var epsS = chart.addLineSeries({
      priceScaleId: "left", color: "#E0402B", lineWidth: 2, priceLineVisible: false,
      crosshairMarkerRadius: 3,
      priceFormat: { type: "custom", minMove: 1, formatter: eps2 },
      autoscaleInfoProvider: leftInfo
    });
    var projS = chart.addLineSeries({
      priceScaleId: "left", color: "#E0402B", lineWidth: 2, lineStyle: 1,
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      priceFormat: { type: "custom", minMove: 1, formatter: eps2 },
      autoscaleInfoProvider: leftInfo
    });

    priceS.setData(priceRaw);
    epsS.setData(epsRaw);
    if (proj.length > 1) projS.setData(proj);
    chart.timeScale().fitContent();

    /* re-fit the height to whatever period is on screen, keeping the lock */
    var iso = function (t) {
      if (typeof t === "string") return t;
      if (typeof t === "object" && t && t.year) {
        return t.year + "-" + String(t.month).padStart(2, "0") + "-" +
               String(t.day).padStart(2, "0");
      }
      if (typeof t === "number") return new Date(t * 1000).toISOString().slice(0, 10);
      return null;
    };
    var settling = false;
    chart.timeScale().subscribeVisibleTimeRangeChange(function (r) {
      if (!r || settling) return;
      var a = iso(r.from), b = iso(r.to);
      if (!a || !b || (a === visFrom && b === visTo)) return;
      visFrom = a; visTo = b;
      settling = true;
      chart.priceScale("left").applyOptions({ autoScale: true });
      chart.priceScale("right").applyOptions({ autoScale: true });
      settling = false;
    });

    /* the period buttons */
    var btns = document.getElementById("cx-lwc-range");
    if (btns) {
      var endT = allEps[allEps.length - 1].time;      /* the projected end */
      var show = function (years, el) {
        var from;
        if (years) {
          /* counted back from the last actual month, so "1Y" means the last
             twelve months of real data — the projection sits beyond it */
          from = new Date(last.time + "T00:00:00Z");
          from.setUTCFullYear(from.getUTCFullYear() - years);
          if (from < new Date(priceRaw[0].time + "T00:00:00Z")) years = 0;
        }
        if (!years) chart.timeScale().fitContent();
        else chart.timeScale().setVisibleRange({ from: from.toISOString().slice(0, 10),
                                                 to: endT });
        Array.prototype.forEach.call(btns.children, function (c) {
          c.classList.toggle("is-on", c === el);
        });
      };
      Array.prototype.forEach.call(btns.children, function (c) {
        c.addEventListener("click", function () {
          show(+c.getAttribute("data-y") || 0, c);
        });
      });
    }

    /* ---- the line of type under the chart ------------------------------ */
    var read = document.getElementById("cx-lwc-read");
    if (read) {
      var lastP = priceRaw[priceRaw.length - 1];
      var base = function () {
        var pe = last.value > 0 ? lastP.value / last.value : null;
        read.innerHTML = "Latest &nbsp;index <b>" + num(lastP.value) + "</b> &nbsp;·&nbsp; EPS <b>&#8377;" +
                         eps2(last.value) + "</b> &nbsp;·&nbsp; P/E <b>" +
                         (pe ? pe.toFixed(1) + "×" : "—") + "</b>";
      };
      base();
      chart.subscribeCrosshairMove(function (p) {
        if (!p || !p.time || !p.seriesData) { base(); return; }
        var a = p.seriesData.get(priceS),
            b = p.seriesData.get(epsS) || p.seriesData.get(projS);
        if (!a && !b) { base(); return; }
        var pe = (a && b && b.value > 0) ? a.value / b.value : null;
        read.innerHTML = "Index <b>" + (a ? num(a.value) : "—") +
                         "</b> &nbsp;·&nbsp; EPS <b>&#8377;" + (b ? eps2(b.value) : "—") +
                         "</b> &nbsp;·&nbsp; P/E <b>" + (pe ? pe.toFixed(1) + "×" : "—") + "</b>";
      });
    }

    /* the facts panel, filled from our own record straight away — the
       constituent pull below refreshes them a moment later */
    (function () {
      var lastP = priceRaw[priceRaw.length - 1];
      var put = function (id, txt) {
        var e = document.getElementById(id);
        if (e && (!e.textContent || e.textContent.trim() === "\u2014")) e.textContent = txt;
      };
      put("cx-n500lvl", num(lastP.value));
      put("cx-n500eps", "\u20B9" + num(last.value));
      if (last.value > 0) put("cx-n500pe", (lastP.value / last.value).toFixed(1) + "\u00D7");
    }());

    var fromEl = document.getElementById("cx-gdpeps-from");
    if (fromEl) {
      var f = function (iso) {
        var d = new Date(iso + "T00:00:00Z");
        return d.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
      };
      fromEl.textContent = f(priceRaw[0].time) + " to " + f(last.time);
    }
    return true;
  }

})();

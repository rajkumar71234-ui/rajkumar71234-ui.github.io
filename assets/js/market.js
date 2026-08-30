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
    { t: "NSE:NIFTYJR",      label: "Nifty Next 50",       note: "The next tier", k: "niftynext50" },
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
      if (map["NSE:CNX500"]) window.__n500level = map["NSE:CNX500"][0];
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
    worldBank("IND", "NY.GDP.MKTP.KD.ZG", 45).then(function (p) {
      paint(chartEl("cx-ingdp"), p, ACCENT, { label: "India real GDP growth", zero: true, tall: true });
      var l = document.getElementById("cx-ingdp-now");
      if (l && p.length) l.textContent = p[p.length - 1].v.toFixed(2) + "%";
      var d = document.getElementById("cx-ingdp-year");
      if (d && p.length) d.textContent = p[p.length - 1].t;
    }).catch(function () {});
    worldBank("USA", "NY.GDP.MKTP.KD.ZG", 45).then(function (p) {
      paint(chartEl("cx-usgdp"), p, BROWN, { label: "US real GDP growth", zero: true, tall: true });
      var l = document.getElementById("cx-usgdp-now");
      if (l && p.length) l.textContent = p[p.length - 1].v.toFixed(2) + "%";
      var d = document.getElementById("cx-usgdp-year");
      if (d && p.length) d.textContent = p[p.length - 1].t;
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
        symbols: { query: { types: ["stock"] }, symbolset: ["SYML:NSE;CNX500"] },
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
      var peEl = document.getElementById("cx-n500pe");
      if (peEl && pe) peEl.textContent = pe.toFixed(1) + "×";
      var epsEl = document.getElementById("cx-n500eps");
      var lvl = document.getElementById("cx-n500lvl");
      if (epsEl && pe && window.__n500level) {
        epsEl.textContent = "₹" + Math.round(window.__n500level / pe).toLocaleString("en-IN");
      }
      if (lvl && window.__n500level) {
        lvl.textContent = window.__n500level.toLocaleString("en-IN", { maximumFractionDigits: 0 });
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
      var lvlBy = (OFFICIAL && OFFICIAL.indices && OFFICIAL.indices.nifty500 &&
                   OFFICIAL.indices.nifty500.fyClose) || {};

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
      var fromEl = document.getElementById("cx-gdpeps-from");
      if (fromEl) fromEl.textContent = pts[0].t + " to " + pts[pts.length - 1].t;

      if (host) {
        host.innerHTML = svgDual(rebase(pts), rebase(gts),
                                 "Nifty 500 earnings", "Nifty 500 index");
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

})();

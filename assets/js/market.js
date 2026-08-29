/* =========================================================================
   Minimal Wealth Advisory — live index returns.
   One request to TradingView's public scanner, no key, nothing stored.
   Three, five and ten year figures are compounded annual returns.
   ========================================================================= */
(function () {
  "use strict";

  var ENDPOINT = "https://scanner.tradingview.com/global/scan";

  var ROWS = [
    { t: "NSE:NIFTY",        label: "Nifty 50",            note: "Large cap" },
    { t: "BSE:SENSEX",       label: "Sensex",              note: "30 companies" },
    { t: "NSE:NIFTYJR",      label: "Nifty Next 50",       note: "The next tier" },
    { t: "NSE:MID150BEES",   label: "Nifty Midcap 150",    note: "Mid cap — via its index ETF" },
    { t: "NSE:HDFCSML250",   label: "Nifty Smallcap 250",  note: "Small cap — via its index ETF" },
    { t: "NSE:CNX500",       label: "Nifty 500",           note: "The broad market" },
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

  var HEADS = ["Level", "Today", "1M", "3M", "6M", "CY", "1Y",
               "3Y CAGR", "5Y CAGR", "10Y CAGR"];

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

  function draw(map) {
    var html = "";
    ROWS.forEach(function (r) {
      var d = map[r.t];
      html += "<tr>" +
        '<th scope="row"><span class="retname">' + r.label + "</span>" +
        '<span class="retnote2">' + r.note + "</span></th>";
      if (!d) {
        html += '<td class="retlevel" data-h="Level">&mdash;</td>';
        for (var i = 1; i < HEADS.length; i++) html += cell(null, HEADS[i]);
      } else {
        var lr = longRuns(d);
        html += '<td class="retlevel" data-h="Level">' + level(d[0]) + "</td>" +
                cell(d[1], HEADS[1]) + cell(d[2], HEADS[2]) + cell(d[3], HEADS[3]) +
                cell(d[4], HEADS[4]) + cell(d[5], HEADS[5]) + cell(d[6], HEADS[6]) +
                cell(lr[0], HEADS[7]) + cell(lr[1], HEADS[8]) + cell(lr[2], HEADS[9]);
      }
      html += "</tr>";
    });
    body.innerHTML = html;
  }

  function fail() {
    body.innerHTML = '<tr><td colspan="11" class="retnote">' +
      "The live feed did not answer just now. Refresh in a moment." + "</td></tr>";
  }

  var tickers = ROWS.map(function (r) { return r.t; });

  fetch(ENDPOINT, {
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
          }) + ". A dash means the index has not existed that long.";
      }
    })
    .catch(fail);

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

})();

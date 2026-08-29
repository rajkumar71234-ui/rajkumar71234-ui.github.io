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

  function cell(pct) {
    if (pct == null || !isFinite(pct)) return '<td class="ret">&mdash;</td>';
    var cls = pct > 0 ? "is-up" : (pct < 0 ? "is-down" : "");
    var sign = pct > 0 ? "+" : "";
    return '<td class="ret ' + cls + '">' + sign + pct.toFixed(2) + "%</td>";
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
        html += '<td class="retlevel">&mdash;</td>';
        for (var i = 0; i < 9; i++) html += cell(null);
      } else {
        var lr = longRuns(d);
        html += '<td class="retlevel">' + level(d[0]) + "</td>" +
                cell(d[1]) + cell(d[2]) + cell(d[3]) + cell(d[4]) +
                cell(d[5]) + cell(d[6]) +
                cell(lr[0]) + cell(lr[1]) + cell(lr[2]);
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
  if (!rateEls.length) return;

  var rateTickers = Array.prototype.map.call(rateEls, function (el) {
    return el.getAttribute("data-rate");
  });

  fetch(ENDPOINT, {
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
})();

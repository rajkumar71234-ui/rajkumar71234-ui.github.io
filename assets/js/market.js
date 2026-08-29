/* =========================================================================
   Minimal Wealth Advisory — live index returns.
   One request to TradingView's public scanner, no key, nothing stored.
   Three and five year figures are converted to a compounded annual rate.
   ========================================================================= */
(function () {
  "use strict";

  var ENDPOINT = "https://scanner.tradingview.com/global/scan";

  var ROWS = [
    { group: "India" },
    { t: "NSE:NIFTY",        label: "Nifty 50",            note: "Large cap" },
    { t: "BSE:SENSEX",       label: "Sensex",              note: "30 companies" },
    { t: "NSE:NIFTYJR",      label: "Nifty Next 50",       note: "The next tier" },
    { t: "NSE:CNXMIDCAP",    label: "Nifty Midcap 100",    note: "Mid cap" },
    { t: "NSE:CNXSMALLCAP",  label: "Nifty Smallcap 100",  note: "Small cap" },
    { t: "NSE:CNX500",       label: "Nifty 500",           note: "The broad market" },
    { group: "Gold and global" },
    { t: "TVC:GOLD",         label: "Gold",                note: "Spot, USD/oz" },
    { t: "MCX:GOLD1!",       label: "Gold (MCX)",          note: "Rupees, 10g" },
    { t: "NASDAQ:IXIC",      label: "Nasdaq Composite",    note: "United States" }
  ];

  var COLUMNS = ["close", "change", "Perf.1M", "Perf.3M", "Perf.6M", "Perf.Y", "Perf.3Y", "Perf.5Y"];

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

  function draw(map) {
    var html = "";
    ROWS.forEach(function (r) {
      if (r.group) {
        html += '<tr class="retgroup"><th colspan="9" scope="colgroup">' + r.group + "</th></tr>";
        return;
      }
      var d = map[r.t];
      html += "<tr>" +
        '<th scope="row"><span class="retname">' + r.label + "</span>" +
        '<span class="retnote2">' + r.note + "</span></th>";
      if (!d) {
        html += '<td class="ret">&mdash;</td>' + cell(null) + cell(null) + cell(null) +
                cell(null) + cell(null) + cell(null) + cell(null);
      } else {
        html += '<td class="retlevel">' + level(d[0]) + "</td>" +
                cell(d[1]) + cell(d[2]) + cell(d[3]) + cell(d[4]) + cell(d[5]) +
                cell(cagr(d[6], 3)) + cell(cagr(d[7], 5));
      }
      html += "</tr>";
    });
    body.innerHTML = html;
  }

  function fail() {
    body.innerHTML = '<tr><td colspan="9" class="retnote">' +
      "The live feed did not answer just now. Refresh in a moment." + "</td></tr>";
  }

  var tickers = ROWS.filter(function (r) { return r.t; }).map(function (r) { return r.t; });

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
          }) + ".";
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
        el.textContent = (v == null || !isFinite(v)) ? "\u2014" : v.toFixed(2) + "%";
      });
    })
    .catch(function () {});
})();

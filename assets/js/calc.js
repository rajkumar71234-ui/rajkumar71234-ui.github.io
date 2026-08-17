/* =========================================================================
   Minimal Wealth Advisory — goal calculator
   Month-by-month projection. No backend, nothing leaves the browser.
   ========================================================================= */
(function () {
  "use strict";

  var form = document.getElementById("calc-form");
  if (!form) return;

  var $ = function (id) { return document.getElementById(id); };
  var num = function (id) { var v = parseFloat(($(id) || {}).value); return isNaN(v) ? 0 : v; };

  /* ------------------------------------------------------------ helpers -- */

  function rupees(n) {
    n = Math.round(n);
    var sign = n < 0 ? "-" : "";
    n = Math.abs(n);
    var s = String(n), last3 = s.slice(-3), rest = s.slice(0, -3);
    if (rest) last3 = "," + last3;
    rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    return sign + "₹" + rest + last3;
  }

  function shortRupees(n) {
    var a = Math.abs(n);
    if (a >= 1e7) return (n / 1e7).toFixed(2).replace(/\.00$/, "") + " cr";
    if (a >= 1e5) return (n / 1e5).toFixed(2).replace(/\.00$/, "") + " lakh";
    return rupees(n);
  }

  /* months from today (month 0 = this month) to a yyyy-mm value */
  function monthIndex(value) {
    if (!value) return -1;
    var p = value.split("-");
    if (p.length !== 2) return -1;
    var now = new Date();
    return (parseInt(p[0], 10) - now.getFullYear()) * 12 +
           (parseInt(p[1], 10) - 1 - now.getMonth());
  }

  /* ------------------------------------------------------------- engine -- */

  function project(o) {
    var r = Math.pow(1 + o.rate / 100, 1 / 12) - 1;
    var value = o.capital;
    var invested = o.capital;
    var series = [];
    var startYear = new Date().getFullYear();
    var startMonth = new Date().getMonth();

    for (var m = 1; m <= o.months; m++) {
      value *= (1 + r);

      if (o.sip > 0) { value += o.sip; invested += o.sip; }

      if (o.stp > 0 && m >= o.stpFrom) { value += o.stp; invested += o.stp; }

      if (o.add > 0 && m === o.addAt) { value += o.add; invested += o.add; }

      if (o.exit > 0 && m === o.exitAt) {
        var take = Math.min(o.exit, value);
        value -= take;
        invested -= take;               /* money taken back out */
      }

      if ((startMonth + m) % 12 === 11 || m === o.months) {
        series.push({
          year: startYear + Math.floor((startMonth + m) / 12),
          month: m,
          invested: invested,
          value: value
        });
      }
    }
    return { value: value, invested: invested, series: series };
  }

  /* smallest monthly SIP that reaches the target */
  function requiredSip(o, target) {
    var lo = 0, hi = 1000, base = JSON.parse(JSON.stringify(o));

    base.sip = hi;
    while (project(base).value < target && hi < 1e9) {
      hi *= 2;
      base.sip = hi;
    }
    if (hi >= 1e9) return null;

    for (var i = 0; i < 60; i++) {
      var mid = (lo + hi) / 2;
      base.sip = mid;
      if (project(base).value < target) lo = mid; else hi = mid;
    }
    return Math.ceil(hi / 100) * 100;
  }

  /* --------------------------------------------------- asset type → rate -- */

  var typeSel = $("c-type");
  var rateBox = $("c-rate");

  typeSel.addEventListener("change", function () {
    if (typeSel.value === "custom") { rateBox.focus(); return; }
    rateBox.value = typeSel.value;
    run();
  });

  rateBox.addEventListener("input", function () {
    var match = false;
    for (var i = 0; i < typeSel.options.length; i++) {
      if (typeSel.options[i].value === rateBox.value) { typeSel.selectedIndex = i; match = true; }
    }
    if (!match) typeSel.value = "custom";
  });

  /* ---------------------------------------------------------------- run -- */

  function run() {
    var years  = Math.max(1, Math.round(num("c-years")));
    var months = years * 12;

    var stpFrom = monthIndex($("c-stp-from").value);
    var addAt   = monthIndex($("c-add-when").value);
    var exitAt  = monthIndex($("c-exit-when").value);

    var o = {
      capital: num("c-capital"),
      sip:     num("c-sip"),
      stp:     num("c-stp"),
      stpFrom: stpFrom > 0 ? stpFrom : 1,
      add:     num("c-add"),
      addAt:   addAt > 0 ? addAt : -1,
      exit:    num("c-exit"),
      exitAt:  exitAt > 0 ? exitAt : -1,
      rate:    num("c-rate"),
      months:  months
    };

    var target = num("c-target") * Math.pow(1 + num("c-infl") / 100, years);
    var res = project(o);
    var gap = res.value - target;

    $("o-years").textContent    = String(years);
    $("o-target").textContent   = rupees(target);
    $("o-value").textContent    = rupees(res.value);
    $("o-gap").textContent      = (gap >= 0 ? "+" : "") + rupees(gap);
    $("o-gap").className        = gap >= 0 ? "is-good" : "is-short";
    $("o-invested").textContent = rupees(res.invested);
    $("o-growth").textContent   = rupees(res.value - res.invested);

    var need = requiredSip(o, target);
    $("o-need").textContent = need === null ? "Not reachable by SIP alone" : rupees(need) + " a month";

    var verdict = $("calc-verdict");
    if (gap >= 0) {
      verdict.className = "calc__verdict is-good";
      verdict.innerHTML = "<strong>You get there.</strong> On these assumptions the plan clears the " +
        "goal by about " + shortRupees(gap) + ".";
    } else {
      verdict.className = "calc__verdict is-short";
      verdict.innerHTML = "<strong>Short by about " + shortRupees(-gap) + ".</strong> " +
        (need === null
          ? "The gap is too wide for a monthly SIP alone — the goal, the years or the amount has to move."
          : "Raising the monthly SIP to " + rupees(need) + " closes it, if nothing else changes.");
    }

    var rows = $("calc-rows");
    rows.innerHTML = "";
    res.series.forEach(function (p, i) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + p.year + "</td><td>" + p.month + "</td><td>" +
                     rupees(p.invested) + "</td><td>" + rupees(p.value) + "</td>";
      rows.appendChild(tr);
    });
    $("calc-tablewrap").hidden = false;
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); run(); });
  form.addEventListener("input", function (e) {
    if (e.target.id !== "c-rate") run(); else run();
  });

  run();
})();

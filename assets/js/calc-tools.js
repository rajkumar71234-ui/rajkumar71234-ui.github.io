/* =========================================================================
   Minimal Wealth Advisory — lumpsum, step-up SIP and retirement/SWP tools.
   Standard time-value-of-money maths, run month by month in the browser.
   Nothing is sent anywhere.
   ========================================================================= */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var num = function (id) { var v = parseFloat(($(id) || {}).value); return isNaN(v) ? 0 : v; };
  var monthly = function (annualPct) { return Math.pow(1 + annualPct / 100, 1 / 12) - 1; };

  function rupees(n) {
    if (!isFinite(n)) return "—";
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

  function set(id, text) { var el = $(id); if (el) el.textContent = text; }

  function verdict(id, good, html) {
    var el = $(id);
    if (!el) return;
    el.className = "calc__verdict " + (good ? "is-good" : "is-short");
    el.innerHTML = html;
  }

  /* ------------------------------------------------------------- tabs -- */

  var tabs = document.querySelectorAll(".ctab");
  Array.prototype.forEach.call(tabs, function (t) {
    t.addEventListener("click", function () {
      Array.prototype.forEach.call(tabs, function (o) {
        o.classList.remove("is-on");
        o.setAttribute("aria-selected", "false");
      });
      t.classList.add("is-on");
      t.setAttribute("aria-selected", "true");
      Array.prototype.forEach.call(document.querySelectorAll(".cpanel"), function (p) {
        p.hidden = p.id !== "panel-" + t.dataset.panel;
      });
    });
  });

  /* ---------------------------------------------------------- lumpsum -- */

  function runLump() {
    if (!$("l-amount")) return;
    var p = num("l-amount"), y = Math.max(1, num("l-years"));
    var r = num("l-rate") / 100, i = num("l-infl") / 100;

    var fv = p * Math.pow(1 + r, y);
    var real = fv / Math.pow(1 + i, y);

    set("l-value", rupees(fv));
    set("l-invested", rupees(p));
    set("l-growth", rupees(fv - p));
    set("l-real", rupees(real));
    set("l-mult", p > 0 ? (fv / p).toFixed(2) + "×" : "—");

    verdict("l-verdict", real > p,
      real > p
        ? "<strong>It stays ahead of inflation.</strong> " + shortRupees(fv) +
          " after " + y + " years is worth " + shortRupees(real) + " in today’s money."
        : "<strong>Inflation eats it.</strong> " + shortRupees(fv) +
          " after " + y + " years is worth only " + shortRupees(real) +
          " in today’s money — less than you put in.");
  }

  /* -------------------------------------------------- SIP with step-up -- */

  function stepUpRun(sip, stepPct, years, ratePct) {
    var rm = monthly(ratePct), months = years * 12;
    var value = 0, invested = 0, current = sip;
    for (var m = 1; m <= months; m++) {
      value = value * (1 + rm) + current;
      invested += current;
      if (m % 12 === 0) current = current * (1 + stepPct / 100);
    }
    return { value: value, invested: invested, lastSip: current / (1 + stepPct / 100) };
  }

  function runStep() {
    if (!$("s-sip")) return;
    var sip = num("s-sip"), step = num("s-step");
    var y = Math.max(1, num("s-years")), rate = num("s-rate");

    var up = stepUpRun(sip, step, y, rate);
    var flat = stepUpRun(sip, 0, y, rate);

    set("s-value", rupees(up.value));
    set("s-invested", rupees(up.invested));
    set("s-growth", rupees(up.value - up.invested));
    set("s-last", rupees(up.lastSip) + " a month");
    set("s-flat", rupees(flat.value));

    var extra = up.value - flat.value;
    verdict("s-verdict", true,
      step > 0
        ? "<strong>The step-up adds " + shortRupees(extra) + ".</strong> " +
          "Raising the SIP " + step + "% a year takes you from " + shortRupees(flat.value) +
          " to " + shortRupees(up.value) + " over " + y + " years."
        : "<strong>" + shortRupees(up.value) + " after " + y + " years.</strong> " +
          "Add a yearly step-up to see what a rising income does to the same plan.");
  }

  /* ------------------------------------------------ retirement and SWP -- */

  /* corpus at retirement, from what you hold plus the monthly SIP */
  function accumulate(corpus, sip, years, ratePct) {
    var rm = monthly(ratePct), months = Math.round(years * 12), v = corpus;
    for (var m = 1; m <= months; m++) v = v * (1 + rm) + sip;
    return v;
  }

  /* draw an inflating income from the corpus; returns how long it lasts */
  function drawDown(corpus, firstMonthly, years, postPct, inflPct) {
    var rm = monthly(postPct), months = Math.round(years * 12);
    var v = corpus, draw = firstMonthly;
    for (var m = 1; m <= months; m++) {
      v = v * (1 + rm) - draw;
      if (v <= 0) return { lasted: m, survives: false };
      if (m % 12 === 0) draw = draw * (1 + inflPct / 100);
    }
    return { lasted: months, survives: true, left: v };
  }

  /* corpus that would survive the whole retirement, found by bisection */
  function corpusNeeded(firstMonthly, years, postPct, inflPct) {
    var lo = 0, hi = firstMonthly * 12 * years * 3 + 1e6;
    for (var i = 0; i < 80; i++) {
      var mid = (lo + hi) / 2;
      if (drawDown(mid, firstMonthly, years, postPct, inflPct).survives) hi = mid; else lo = mid;
    }
    return hi;
  }

  function runRet() {
    if (!$("r-age")) return;
    var age = num("r-age"), retire = num("r-retire"), life = num("r-life");
    var toGo = Math.max(0, retire - age);
    var span = Math.max(1, life - retire);

    var expense = num("r-expense");
    var infl = num("r-infl"), pre = num("r-pre"), post = num("r-post");

    var have = accumulate(num("r-corpus"), num("r-sip"), toGo, pre);
    var firstDraw = expense * Math.pow(1 + infl / 100, toGo);
    var need = corpusNeeded(firstDraw, span, post, infl);
    var gap = have - need;

    set("r-have", rupees(have));
    set("r-need", rupees(need));
    set("r-gap", (gap >= 0 ? "+" : "") + rupees(gap));
    $("r-gap").className = gap >= 0 ? "is-good" : "is-short";
    set("r-draw", rupees(firstDraw) + " a month");

    /* how long the corpus you will actually have would last */
    var run = drawDown(have, firstDraw, 60, post, infl);
    set("r-runout", run.survives && run.lasted >= span * 12
      ? "Lasts past " + life
      : "Age " + Math.floor(retire + run.lasted / 12));

    /* the SIP that would close the gap */
    if (gap >= 0) {
      set("r-sipneed", "Already covered");
    } else if (toGo <= 0) {
      set("r-sipneed", "No years left to invest");
    } else {
      var lo = 0, hi = 1000;
      while (accumulate(num("r-corpus"), hi, toGo, pre) < need && hi < 1e9) hi *= 2;
      for (var i = 0; i < 60; i++) {
        var mid = (lo + hi) / 2;
        if (accumulate(num("r-corpus"), mid, toGo, pre) < need) lo = mid; else hi = mid;
      }
      set("r-sipneed", rupees(Math.ceil(hi / 100) * 100) + " a month");
    }

    verdict("r-verdict", gap >= 0,
      gap >= 0
        ? "<strong>You get there.</strong> On these assumptions you retire at " + retire +
          " with about " + shortRupees(have) + ", against the " + shortRupees(need) +
          " the plan needs."
        : "<strong>Short by about " + shortRupees(-gap) + ".</strong> " +
          "At " + retire + " you would have " + shortRupees(have) + " against " +
          shortRupees(need) + " needed to draw " + shortRupees(firstDraw) +
          " a month, rising with inflation, until " + life + ".");
  }

  /* ------------------------------------------------------------- wire -- */

  function bind(formId, fn) {
    var f = $(formId);
    if (!f) return;
    f.addEventListener("input", fn);
    f.addEventListener("submit", function (e) { e.preventDefault(); fn(); });
    fn();
  }

  bind("lump-form", runLump);
  bind("step-form", runStep);
  bind("ret-form", runRet);
})();

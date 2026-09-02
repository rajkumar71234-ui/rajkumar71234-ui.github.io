/* =========================================================================
   Minimal Wealth Advisory — lumpsum, step-up SIP and SWP tools.
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

  /* ------------------------------------------------------------- SWP -- */

  /* Draw an income out of a corpus month by month. The withdrawal is raised
     once a year if a step-up is set. Returns how long it lasted, what was
     taken out along the way and what is left at the end. */
  function drawDown(corpus, firstMonthly, years, ratePct, stepPct) {
    var rm = monthly(ratePct), months = Math.round(years * 12);
    var v = corpus, draw = firstMonthly, taken = 0, last = firstMonthly;
    for (var m = 1; m <= months; m++) {
      v = v * (1 + rm);
      var paid = Math.min(draw, Math.max(v, 0));
      v -= paid;
      taken += paid;
      last = draw;
      if (v <= 0) return { months: m, survives: false, left: 0, taken: taken, last: last };
      if (m % 12 === 0) draw = draw * (1 + stepPct / 100);
    }
    return { months: months, survives: true, left: v, taken: taken, last: last };
  }

  /* the monthly withdrawal that would just see the whole term out */
  function safeDraw(corpus, years, ratePct, stepPct) {
    var lo = 0, hi = corpus / 12 + 1000;
    while (drawDown(corpus, hi, years, ratePct, stepPct).survives && hi < corpus) hi *= 2;
    for (var i = 0; i < 70; i++) {
      var mid = (lo + hi) / 2;
      if (drawDown(corpus, mid, years, ratePct, stepPct).survives) lo = mid; else hi = mid;
    }
    return lo;
  }

  function spell(months) {
    var y = Math.floor(months / 12), m = months % 12;
    if (y <= 0) return m + (m === 1 ? " month" : " months");
    return y + (y === 1 ? " year" : " years") +
           (m ? " " + m + (m === 1 ? " month" : " months") : "");
  }

  function runSwp() {
    if (!$("w-corpus")) return;
    var corpus = num("w-corpus"), draw = num("w-draw"), years = Math.max(1, num("w-years"));
    var rate = num("w-rate"), step = num("w-step");

    var run = drawDown(corpus, draw, years, rate, step);
    var safe = safeDraw(corpus, years, rate, step);

    set("w-lasts", run.survives ? "Intact after " + years + " years"
                                : "Runs out after " + spell(run.months));
    set("w-left", run.survives ? rupees(run.left) : "Nothing");
    set("w-total", rupees(run.taken));
    set("w-final", rupees(run.last) + " a month");
    set("w-safe", rupees(Math.floor(safe / 100) * 100) + " a month");
    set("w-rateout", corpus > 0 ? ((draw * 12 / corpus) * 100).toFixed(2) + "% of the corpus" : "—");

    var el = $("w-left");
    if (el) el.className = run.survives ? "is-good" : "is-short";

    verdict("w-verdict", run.survives,
      run.survives
        ? "<strong>The corpus holds.</strong> Drawing " + shortRupees(draw) + " a month" +
          (step > 0 ? ", rising " + step + "% a year, leaves " : " leaves ") +
          "about " + shortRupees(run.left) + " after " + years + " years."
        : "<strong>It runs out after " + spell(run.months) + ".</strong> " +
          "To make it through " + years + " years on these assumptions the withdrawal has to " +
          "start at about " + shortRupees(safe) + " a month instead of " +
          shortRupees(draw) + ".");
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
  bind("swp-form", runSwp);
})();

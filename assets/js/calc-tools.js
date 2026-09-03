/* =========================================================================
   Minimal Wealth Advisory — lumpsum, step-up SIP and SWP tools.
   Standard time-value-of-money maths, run month by month in the browser.
   Nothing is sent anywhere.
   ========================================================================= */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var num = function (id) { var v = parseFloat(($(id) || {}).value); return isNaN(v) ? 0 : v; };
  /* The monthly rate that truly compounds to the annual return in the box:
     twelve of these give exactly that figure, which is what a CAGR means. */
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
  /* One amount, compounded once a year at the stated rate. */

  function runLump() {
    if (!$("l-amount")) return;
    var amount = num("l-amount"), rate = num("l-rate"), years = num("l-years");
    var value = amount * Math.pow(1 + rate / 100, years);
    set("l-invested", rupees(amount));
    set("l-growth", rupees(value - amount));
    set("l-value", rupees(value));
  }

  /* ---------------------------------------------------------- step-up -- */
  /* Monthly instalment at the start of each month, raised once a year. */

  function runStep() {
    if (!$("s-sip")) return;
    var sip = num("s-sip"), step = num("s-step"), rate = num("s-rate");
    var years = Math.max(1, Math.round(num("s-years")));
    var r = monthly(rate), v = 0, put = sip, total = 0;
    for (var m = 1; m <= years * 12; m++) {
      v = (v + put) * (1 + r);
      total += put;
      if (m % 12 === 0) put = put * (1 + step / 100);
    }
    set("s-invested", rupees(total));
    set("s-growth", rupees(v - total));
    set("s-value", rupees(v));
  }

  /* -------------------------------------------------------------- SWP -- */
  /* The withdrawal comes out at the end of each month and, if a step-up is
     set, is raised once a year. */

  function runSwp() {
    if (!$("w-corpus")) return;
    var corpus = num("w-corpus"), draw = num("w-draw"), step = num("w-step");
    var rate = num("w-rate"), years = Math.max(1, Math.round(num("w-years")));
    var r = monthly(rate), v = corpus, take = draw, taken = 0, ran = 0;

    for (var m = 1; m <= years * 12; m++) {
      v = v * (1 + r);
      var paid = Math.min(take, Math.max(v, 0));
      v -= paid;
      taken += paid;
      if (v <= 0 && !ran) { ran = m; v = 0; break; }
      if (m % 12 === 0) take = take * (1 + step / 100);
    }

    set("w-total", rupees(taken));
    set("w-left", ran ? rupees(0) : rupees(v));

    var el = $("w-lasts");
    if (el) {
      if (ran) {
        var y = Math.floor(ran / 12), mo = ran % 12;
        el.className = "is-short";
        el.innerHTML = "Runs out in year " + (y + (mo ? 1 : 0));
      } else {
        el.className = "is-good";
        el.innerHTML = '<span class="tick" aria-hidden="true">\u2713</span> Corpus intact';
      }
    }
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

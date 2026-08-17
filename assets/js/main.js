/* Minimal Wealth Advisory — site interactions */
(function () {
  "use strict";

  /* ---------------------------------------------------- mobile nav ---- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("is-open", !open);
    });

    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A" && window.innerWidth <= 780) {
        toggle.setAttribute("aria-expanded", "false");
        nav.classList.remove("is-open");
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 780) {
        toggle.setAttribute("aria-expanded", "false");
        nav.classList.remove("is-open");
      }
    });
  }

  /* ------------------------------------------------------- accordion -- */
  document.querySelectorAll(".acc__btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") === "true";
      var panel = document.getElementById(btn.getAttribute("aria-controls"));
      btn.setAttribute("aria-expanded", String(!open));
      if (panel) panel.classList.toggle("is-open", !open);
    });
  });

  /* ---------------------------------------------------- reveal on scroll */
  var items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------ year -- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ------------------------------------------------- contact form ----- */
  /* No backend is wired up. By default the form opens the visitor's mail
     client with everything pre-filled. To use a real form service instead,
     see README.md — set the <form> action and delete this block.           */
  var form = document.getElementById("enquiry-form");
  if (form && !form.getAttribute("action")) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var lines = [
        "Name: "     + (data.get("name")     || ""),
        "Email: "    + (data.get("email")    || ""),
        "Phone: "    + (data.get("phone")    || ""),
        "Interest: " + (data.get("interest") || ""),
        "Goal: "     + (data.get("goal")     || ""),
        "",
        (data.get("message") || "")
      ];
      var to = form.dataset.mailto || "hello@minimalwealth.in";
      window.location.href =
        "mailto:" + to +
        "?subject=" + encodeURIComponent("Website enquiry — " + (data.get("name") || "New")) +
        "&body="    + encodeURIComponent(lines.join("\n"));

      var status = document.getElementById("form-status");
      if (status) status.classList.add("is-visible");
    });
  }

  /* ----------------------------------------- rotating testimonials ------ */
  var trot = document.getElementById("trot");
  if (trot) {
    var slides = [].slice.call(trot.querySelectorAll(".trot__item"));
    var dotWrap = document.getElementById("trot-dots");
    var i = 0, timer = null;

    var dots = slides.map(function (_, n) {
      var d = document.createElement("button");
      d.type = "button";
      d.className = "trot__dot" + (n === 0 ? " is-on" : "");
      d.setAttribute("aria-label", "Show testimonial " + (n + 1));
      d.addEventListener("click", function () { show(n); restart(); });
      if (dotWrap) dotWrap.appendChild(d);
      return d;
    });

    function show(n) {
      slides[i].classList.remove("is-active");
      dots[i] && dots[i].classList.remove("is-on");
      i = (n + slides.length) % slides.length;
      slides[i].classList.add("is-active");
      dots[i] && dots[i].classList.add("is-on");
    }
    function restart() {
      clearInterval(timer);
      timer = setInterval(function () { show(i + 1); }, 10000);
    }
    restart();

    // pause while the visitor is reading one
    trot.addEventListener("mouseenter", function () { clearInterval(timer); });
    trot.addEventListener("mouseleave", restart);
  }

  /* ------------------------------------------- scan: quick vs detailed -- */
  var scanForm = document.querySelector(".form--scan");
  if (scanForm) {
    var modeBtns = [].slice.call(scanForm.querySelectorAll(".scanmode__btn"));
    var modeInput = document.getElementById("s-mode");
    var hint = document.getElementById("scanmode-hint");

    var TEXT = {
      quick: "Quick scan: six things and your statement, and we tell you what overlaps and what " +
             "it is costing you. Switch to detailed if you want the gap to a specific goal worked out too.",
      detailed: "Detailed analysis: the full picture — dependants, income, EMIs, what you can put " +
                "away and the goal you are aiming at. You get the gap to the goal in rupees, not just a review."
    };

    function setMode(mode) {
      var quick = mode === "quick";
      scanForm.classList.toggle("form--quick", quick);
      if (modeInput) modeInput.value = quick ? "Quick scan" : "Detailed analysis";
      if (hint) hint.textContent = TEXT[mode];

      modeBtns.forEach(function (b) {
        var on = b.getAttribute("data-mode") === mode;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-pressed", String(on));
      });

      /* a hidden field that is still "required" silently blocks submission */
      scanForm.querySelectorAll(".only-detailed").forEach(function (block) {
        block.querySelectorAll("input, select, textarea").forEach(function (el) {
          if (quick) {
            if (el.required) { el.dataset.wasRequired = "1"; el.required = false; }
          } else if (el.dataset.wasRequired === "1") {
            el.required = true;
          }
        });
      });
    }

    modeBtns.forEach(function (b) {
      b.addEventListener("click", function () { setMode(b.getAttribute("data-mode")); });
    });
    setMode("quick");
  }

  /* ------------------------------------------------- booking band ------- */
  var booking = document.getElementById("booking-form");
  if (booking && !booking.getAttribute("action")) {
    booking.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = new FormData(booking);
      var name = (data.get("name") || "").toString().trim();
      var phone = (data.get("phone") || "").toString().trim();

      if (!name || !phone) {
        booking.querySelector(name ? '[name="phone"]' : '[name="name"]').focus();
        return;
      }

      var to = booking.dataset.mailto || "hello@minimalwealth.in";
      window.location.href =
        "mailto:" + to +
        "?subject=" + encodeURIComponent("30-minute portfolio review — " + name) +
        "&body=" + encodeURIComponent(
          "Name: " + name + "\nPhone: " + phone +
          "\n\nI would like to book the 30-minute portfolio review over video."
        );

      var done = booking.parentNode.querySelector(".booking__done");
      if (!done) {
        done = document.createElement("p");
        done.className = "booking__done";
        booking.parentNode.insertBefore(done, booking.nextSibling);
      }
      done.textContent =
        "Thanks " + name + " — your mail app should be open with the request ready to send. " +
        "If it did not open, write to " + to + " and we will come back within one working day.";
      done.classList.add("is-visible");
      booking.reset();
    });
  }
})();

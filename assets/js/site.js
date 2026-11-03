(function () {
  "use strict";
  var root = document.documentElement;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Theme ---------- */
  var toggle = $("#theme-toggle");
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function isDark() {
    var t = root.getAttribute("data-theme");
    if (t === "dark") return true;
    if (t === "light") return false;
    return !!(media && media.matches);
  }
  function syncToggle() {
    if (!toggle) return;
    var dark = isDark();
    toggle.classList.toggle("is-dark", dark);
    toggle.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  }
  function flipTheme() {
    var next = isDark() ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
    syncToggle();
  }
  if (toggle) toggle.addEventListener("click", flipTheme);
  if (media) {
    if (media.addEventListener) media.addEventListener("change", syncToggle);
    else if (media.addListener) media.addListener(syncToggle);
  }
  new MutationObserver(syncToggle).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  syncToggle();

  /* ---------- Toast ---------- */
  var toastEl = $("#toast");
  var toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastEl.classList.remove("show");
    void toastEl.offsetWidth;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("show");
      setTimeout(function () { toastEl.hidden = true; }, 250);
    }, 1800);
  }

  /* ---------- Copy helpers ---------- */
  function selectText(node) {
    if (!node) return;
    var range = document.createRange();
    range.selectNodeContents(node);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  function copyText(text, okMsg, fallbackNode) {
    function fallback() {
      selectText(fallbackNode);
      toast("Selected. Press Ctrl+C or ⌘C to copy");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback);
    } else {
      fallback();
    }
  }
  $$("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var link = btn.previousElementSibling;
      copyText(btn.getAttribute("data-copy"), "Email address copied", link);
    });
  });

  /* ---------- Grounding flash ---------- */
  function slug(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").slice(0, 2).join("_");
  }
  function ground(el, label) {
    if (!el) return;
    var old = el.querySelector(":scope > .gflash");
    if (old) old.remove();
    var box = document.createElement("span");
    box.className = "gflash";
    box.setAttribute("aria-hidden", "true");
    el.appendChild(box);
    setTimeout(function () { box.classList.add("out"); }, 1500);
    setTimeout(function () { box.remove(); }, 2000);
  }
  function targetFor(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    if (el.classList.contains("sec")) return $(".sec-label", el) || el;
    return el;
  }
  function goTo(id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.classList.contains("pub") && el.hidden) setFilter("all");
    var dest = targetFor(id);
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: el.classList.contains("sec") ? "start" : "center" });
    try { history.replaceState(null, "", "#" + id); } catch (e) {}
    var text = (dest.querySelector("h4") || dest).textContent;
    setTimeout(function () { ground(dest, slug(text)); }, reduceMotion ? 0 : 420);
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href").slice(1);
    if (!id || id === "top" || id === "main" || !document.getElementById(id)) return;
    e.preventDefault();
    goTo(id);
  });
  if (location.hash.length > 1 && document.getElementById(location.hash.slice(1))) {
    setTimeout(function () { var dest = targetFor(location.hash.slice(1)); if (dest) ground(dest, slug((dest.querySelector("h4") || dest).textContent)); }, 600);
  }

  /* ---------- Scroll progress ---------- */
  var bar = $("#progress-bar");
  var ticking = false;
  function updateProgress() {
    ticking = false;
    if (!bar) return;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(updateProgress); }
  }, { passive: true });
  updateProgress();

  /* ---------- Active section in nav ---------- */
  var navLinks = $$(".navlinks a");
  if ("IntersectionObserver" in window && navLinks.length) {
    var map = {};
    navLinks.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var a = map[entry.target.id];
        if (!a) return;
        navLinks.forEach(function (l) { l.removeAttribute("aria-current"); });
        a.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    Object.keys(map).forEach(function (id) { var sec = document.getElementById(id); if (sec) io.observe(sec); });
  }

  /* ---------- Paper filters ---------- */
  var filterBtns = $$(".filter");
  var pubs = $$(".pub");
  var status = $("#filter-status");
  var statusDefault = status ? status.innerHTML : "";
  function setFilter(key) {
    var shown = 0;
    pubs.forEach(function (p) {
      var topics = (p.getAttribute("data-topics") || "").split(/\s+/);
      var on = key === "all" || topics.indexOf(key) !== -1;
      p.hidden = !on;
      if (on) shown++;
    });
    $$(".year-group").forEach(function (g) {
      g.hidden = !$$(".pub", g).some(function (p) { return !p.hidden; });
    });
    filterBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-filter") === key)); });
    if (status) {
      if (key === "all") status.innerHTML = statusDefault;
      else status.textContent = "Showing " + shown + " of " + pubs.length + " papers.";
    }
  }
  filterBtns.forEach(function (b) {
    b.addEventListener("click", function () { setFilter(b.getAttribute("data-filter")); });
  });

  /* ---------- Cite / BibTeX ---------- */
  $$(".cite-btn").forEach(function (btn) {
    var bib = btn.closest(".pub").querySelector(".bib");
    if (!bib) return;
    btn.addEventListener("click", function () {
      var open = bib.hidden;
      bib.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
    });
    var copyBtn = bib.querySelector(".bib-copy");
    var pre = bib.querySelector("pre");
    if (copyBtn && pre) {
      copyBtn.addEventListener("click", function () { copyText(pre.textContent, "BibTeX copied", pre); });
    }
  });

  /* ---------- Talk countdown and expiring "Upcoming" chips ---------- */
  var now = Date.now();
  $$("[data-until]").forEach(function (chip) {
    if (now > Date.parse(chip.getAttribute("data-until"))) chip.remove();
  });
  var talk = $("#now-talk");
  if (talk) {
    var start = Date.parse(talk.getAttribute("data-start"));
    var end = Date.parse(talk.getAttribute("data-end"));
    var chip = $("#talk-countdown");
    var label = $("#now-talk-label");
    var dayMs = 86400000;
    var startDay = new Date(start); startDay.setHours(0, 0, 0, 0);
    var today = new Date(now); today.setHours(0, 0, 0, 0);
    var days = Math.round((startDay - today) / dayMs);
    if (now < start) {
      chip.textContent = days <= 0 ? "today" : days === 1 ? "tomorrow" : "in " + days + " days";
    } else if (now <= end) {
      chip.textContent = "this week";
    } else {
      if (label) label.textContent = "Latest talk";
      chip.textContent = "Dec 2026";
      chip.className = "chip chip-quiet";
    }
  }

  /* ---------- Command palette ---------- */
  var dialog = $("#palette");
  var input = $("#palette-input");
  var list = $("#palette-list");
  var openBtn = $("#palette-open");
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  if (!isMac) $$(".kbd-hint .mod").forEach(function (k) { k.textContent = "Ctrl"; });

  function cleanText(el) {
    var c = el.cloneNode(true);
    $$(".gflash", c).forEach(function (n) { n.remove(); });
    return c.textContent.trim();
  }
  function buildItems() {
    var items = [];
    $$("section.sec").forEach(function (sec) {
      var h = $(".sec-label", sec);
      if (h) items.push({ title: cleanText(h), group: "Section", run: function () { goTo(sec.id); } });
    });
    pubs.forEach(function (p) {
      var h = $("h4", p);
      var venue = $(".venue .chip", p);
      items.push({ title: cleanText(h), group: venue ? venue.textContent.trim() : "Paper", keys: p.getAttribute("data-topics") + " paper", run: function () { goTo(p.id); } });
    });
    $$(".repos h3 a").forEach(function (a) {
      items.push({ title: a.textContent.trim(), group: "Project", keys: "github repo code", href: a.href });
    });
    items.push({ title: "Google Scholar", group: "Link", keys: "papers citations", href: "https://scholar.google.com/citations?user=oJl3yZkAAAAJ" });
    items.push({ title: "GitHub", group: "Link", keys: "code nevasini1", href: "https://github.com/nevasini1" });
    items.push({ title: "LinkedIn", group: "Link", keys: "profile", href: "https://www.linkedin.com/in/nevasini-sasikumar" });
    items.push({ title: "Copy email address", group: "Action", keys: "mail contact", run: function () { copyText("nevasini24@gmail.com", "Email address copied", $("#email-address")); } });
    items.push({ title: "Switch light or dark theme", group: "Action", keys: "dark light mode theme", run: flipTheme });
    return items;
  }
  var allItems = null;
  var results = [];
  var active = 0;

  function render() {
    var q = input.value.trim().toLowerCase();
    var words = q ? q.split(/\s+/) : [];
    results = allItems.filter(function (it) {
      var hay = (it.title + " " + it.group + " " + (it.keys || "")).toLowerCase();
      return words.every(function (w) { return hay.indexOf(w) !== -1; });
    });
    if (q) {
      results.sort(function (a, b) {
        var ai = a.title.toLowerCase().indexOf(q), bi = b.title.toLowerCase().indexOf(q);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
    }
    active = Math.min(active, Math.max(0, results.length - 1));
    list.innerHTML = "";
    if (!results.length) {
      var li = document.createElement("li");
      li.className = "palette-empty";
      li.textContent = "No match. Try a paper title, a project, or a section such as Talks.";
      list.appendChild(li);
      input.removeAttribute("aria-activedescendant");
      return;
    }
    results.forEach(function (it, i) {
      var li = document.createElement("li");
      li.id = "pal-opt-" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(i === active));
      var t = document.createElement("span");
      t.className = "pal-title";
      t.textContent = it.title;
      var g = document.createElement("span");
      g.className = "pal-group";
      g.textContent = it.href ? it.group + " ↗" : it.group;
      li.appendChild(t);
      li.appendChild(g);
      li.addEventListener("mousemove", function () { if (active !== i) { active = i; mark(); } });
      li.addEventListener("click", function () { choose(i); });
      list.appendChild(li);
    });
    mark();
  }
  function mark() {
    $$('[role="option"]', list).forEach(function (li, i) { li.setAttribute("aria-selected", String(i === active)); });
    var cur = document.getElementById("pal-opt-" + active);
    if (cur) {
      input.setAttribute("aria-activedescendant", cur.id);
      cur.scrollIntoView({ block: "nearest" });
    }
  }
  function choose(i) {
    var it = results[i];
    if (!it) return;
    closePalette();
    if (it.href) {
      var a = document.createElement("a");
      a.href = it.href;
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else if (it.run) {
      it.run();
    }
  }
  function openPalette() {
    if (!dialog) return;
    if (!allItems) allItems = buildItems();
    input.value = "";
    active = 0;
    render();
    if (typeof dialog.showModal === "function") { if (!dialog.open) dialog.showModal(); }
    else dialog.setAttribute("open", "");
    setTimeout(function () { input.focus(); }, 0);
  }
  function closePalette() {
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
  }
  if (dialog && input && list) {
    if (openBtn) openBtn.addEventListener("click", openPalette);
    input.addEventListener("input", function () { active = 0; render(); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); if (results.length) { active = (active + 1) % results.length; mark(); } }
      else if (e.key === "ArrowUp") { e.preventDefault(); if (results.length) { active = (active - 1 + results.length) % results.length; mark(); } }
      else if (e.key === "Enter") { e.preventDefault(); choose(active); }
      else if (e.key === "Escape") { e.preventDefault(); closePalette(); }
    });
    dialog.addEventListener("click", function (e) { if (e.target === dialog) closePalette(); });
    dialog.addEventListener("close", function () { if (openBtn) openBtn.focus({ preventScroll: true }); });
    document.addEventListener("keydown", function (e) {
      var typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "");
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); dialog.open ? closePalette() : openPalette(); }
      else if (e.key === "/" && !typing && !dialog.open) { e.preventDefault(); openPalette(); }
    });
  }
})();

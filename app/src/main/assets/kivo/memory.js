(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }

  var KEY_MEM = "kivoMemories";
  var KEY_ON = "kivoMemoryOn";
  var MAX_ITEMS = 100;
  var MAX_LEN = 200;
  var lastBlock = "";
  var toastTimer = null;
  var UNIQUE = { name: 1, place: 1 };

  /* ---------- storage ---------- */
  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY_MEM) || "[]");
      return Array.isArray(d) ? d.filter(function (m) { return m && typeof m.text === "string"; }) : [];
    } catch (e) { return []; }
  }
  function save(list) { try { localStorage.setItem(KEY_MEM, JSON.stringify(list)); } catch (e) {} }
  function isOn() { try { return localStorage.getItem(KEY_ON) !== "0"; } catch (e) { return true; } }
  function setOn(v) { try { localStorage.setItem(KEY_ON, v ? "1" : "0"); } catch (e) {} lastBlock = ""; }
  function newId() { return "m-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8); }

  /* ---------- safety: never keep secrets or private numbers ---------- */
  var SECRET_WORDS = /(pass(?:word|code|phrase)?|pwd|\bpin\b|\botp\b|\bcvv\b|api[ _-]?key|secret|token|private key|seed phrase|mnemonic|recovery phrase|credit card|card number|bearer|\u09aa\u09be\u09b8\u0993\u09af\u09bc\u09be\u09b0\u09cd\u09a1|\u09aa\u09bf\u09a8|\u0993\u099f\u09bf\u09aa\u09bf|\u0997\u09cb\u09aa\u09a8)/i;
  function looksSecret(s) {
    s = String(s);
    if (SECRET_WORDS.test(s)) return true;
    if (/[A-Za-z0-9+\/=_-]{24,}/.test(s)) return true;
    if (/[\d\u09e6-\u09ef][\d\u09e6-\u09ef\s-]{8,}[\d\u09e6-\u09ef]/.test(s)) return true;
    if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(s)) return true;
    return false;
  }

  var TEMP = /\b(today|tonight|right now|at the moment|tomorrow|yesterday|this (?:morning|evening|week))\b|\u098f\u0996\u09a8|\u0986\u099c|\u0995\u09be\u09b2|\u098f\u0987 \u09ae\u09c1\u09b9\u09c2\u09b0\u09cd\u09a4\u09c7/i;
  var BAD_OBJ = /^(you|it|this|that|them|him|her|me|us|when|how|what|to (?:know|ask|see|check|find|get|understand))\b/i;
  var ROLE_STOP = /^(bit|little|lot|bad|good|great|very|few|long|big|huge|mess|wreck)$/i;
  var TRAIL = /\s+(?:\u0986\u09b0|\u098f\u09ac\u0982|\u0993|\u0995\u09bf\u09a8\u09cd\u09a4\u09c1|\u09b9\u09b2\u09cb|\u09b9\u09b2|\u09b9\u09af\u09bc|\u09b9\u099a\u09cd\u099b\u09c7)$/;

  function clean(s) {
    s = String(s).replace(/\s+/g, " ").trim();
    s = s.split(/\s+(?:and|but|because|so)\s+/i)[0];
    s = s.replace(/[\s.,;:!?"'()\u0964-]+$/, "").replace(/^["'\s-]+/, "");
    return s.slice(0, 80);
  }
  function cleanBn(s) {
    s = clean(s);
    var prev;
    do { prev = s; s = s.replace(TRAIL, ""); } while (s !== prev);
    return s;
  }
  function words(s) { return s ? s.split(" ").length : 0; }

  /* ---------- what to learn ---------- */
  var PATTERNS = [
    { kind: "name", re: /\b(?:my name is|call me|i am called|i'm called)\s+([^,.!?\n]+)/i,
      make: function (m) { var v = clean(m[1]); return v && words(v) <= 3 ? "The user's name is " + v + "." : null; } },
    { kind: "place", re: /\bi\s+(?:live|stay)\s+in\s+([^,.!?\n]+)/i,
      make: function (m) { var v = clean(m[1]); return v && words(v) <= 5 ? "The user lives in " + v + "." : null; } },
    { kind: "place", re: /\bi(?:'m|\s+am)\s+(?:from|based in)\s+([^,.!?\n]+)/i,
      make: function (m) { var v = clean(m[1]); return v && words(v) <= 5 ? "The user is from " + v + "." : null; } },
    { kind: "job", re: /\bi\s+work\s+(as(?:\s+an?)?|at|for)\s+([^,.!?\n]+)/i,
      make: function (m) { var v = clean(m[2]); return v && words(v) <= 6 ? "The user works " + m[1].toLowerCase() + " " + v + "." : null; } },
    { kind: "job", re: /\bi(?:'m|\s+am)\s+(an?)\s+([a-z][a-z -]{2,40})/i,
      make: function (m) {
        var v = clean(m[2]);
        if (!v || words(v) > 4 || ROLE_STOP.test(v.split(" ")[0])) return null;
        return "The user is " + m[1].toLowerCase() + " " + v + ".";
      } },
    { kind: "pref", re: /\bi\s+(?:really\s+|also\s+|always\s+)?(like|love|enjoy|prefer|hate|dislike)\s+([^,.!?\n]+)/i,
      make: function (m) {
        var v = clean(m[2]);
        if (!v || BAD_OBJ.test(v) || words(v) > 8) return null;
        return "The user " + m[1].toLowerCase() + "s " + v + ".";
      } },
    { kind: "pref", re: /\bmy\s+favou?rite\s+([a-z ]{2,25}?)\s+(?:is|are)\s+([^,.!?\n]+)/i,
      make: function (m) {
        var a = clean(m[1]), b = clean(m[2]);
        return a && b && words(b) <= 8 ? "The user's favorite " + a + " is " + b + "." : null;
      } },
    { kind: "interest", re: /\bi(?:'m|\s+am)\s+(learning|studying|building)\s+([^,.!?\n]+)/i,
      make: function (m) { var v = clean(m[2]); return v && words(v) <= 8 ? "The user is " + m[1].toLowerCase() + " " + v + "." : null; } },
    { kind: "name", re: /\u0986\u09ae\u09be\u09b0\s+\u09a8\u09be\u09ae\s+([^\s,.\u0964!?]+(?:\s+[^\s,.\u0964!?]+)?)/,
      make: function (m) { var v = cleanBn(m[1]); return v && words(v) <= 3 ? "The user's name is " + v + "." : null; } },
    { kind: "place", re: /\u0986\u09ae\u09bf\s+(\S+)\s+\u09a5\u09be\u0995\u09bf/,
      make: function (m) { var v = cleanBn(m[1]); return v ? "The user lives in " + v + "." : null; } },
    { kind: "pref", re: /\u0986\u09ae\u09bf\s+(.{2,40}?)\s+(?:\u09aa\u099b\u09a8\u09cd\u09a6 \u0995\u09b0\u09bf|\u09ad\u09be\u09b2\u09cb\u09ac\u09be\u09b8\u09bf|\u09ad\u09be\u09b2\u09ac\u09be\u09b8\u09bf)/,
      make: function (m) { var v = cleanBn(m[1]); return v ? "The user likes " + v + "." : null; } },
    { kind: "pref", re: /\u0986\u09ae\u09be\u09b0\s+(.{2,40}?)\s+\u09ad\u09be\u09b2\u09cb \u09b2\u09be\u0997\u09c7/,
      make: function (m) { var v = cleanBn(m[1]); return v ? "The user likes " + v + "." : null; } },
    { kind: "pref", re: /\u0986\u09ae\u09be\u09b0\s+\u09aa\u09cd\u09b0\u09bf\u09af\u09bc\s+(.{2,60})/,
      make: function (m) { var v = cleanBn(m[1]); return v ? "The user's favorite: " + v + "." : null; } }
  ];
  var EXPLICIT_EN = /^\s*(?:please\s+)?(?:remember|don't forget|do not forget|keep in mind)(?:\s+that)?\s*[,:]?\s+([\s\S]{3,200})/i;
  var EXPLICIT_BN = /^\s*(?:\u09ae\u09a8\u09c7 \u09b0\u09be\u0996\u09cb|\u09ae\u09a8\u09c7 \u09b0\u09c7\u0996\u09cb|\u09ae\u09a8\u09c7 \u09b0\u09be\u0996\u09ac\u09c7)\s*[,:]?\s*([\s\S]{3,200})/;

  function norm(s) {
    return String(s).toLowerCase().replace(/[^\w\u0980-\u09FF ]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function sim(a, b) {
    var A = norm(a).split(" "), B = norm(b).split(" ");
    var set = {}, seen = {}, all = {}, inter = 0;
    A.forEach(function (w) { set[w] = 1; all[w] = 1; });
    B.forEach(function (w) { all[w] = 1; if (set[w] && !seen[w]) inter++; seen[w] = 1; });
    var union = Object.keys(all).length;
    return union ? inter / union : 0;
  }

  function addMemory(kind, text) {
    text = String(text).replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
    if (!text || looksSecret(text)) return null;
    var list = load(), i;
    if (UNIQUE[kind]) {
      for (i = 0; i < list.length; i++) {
        if (list[i].kind === kind) {
          if (list[i].text === text) return null;
          list[i].text = text; list[i].ts = Date.now(); save(list);
          return list[i];
        }
      }
    }
    for (i = 0; i < list.length; i++) {
      if (sim(list[i].text, text) >= 0.6) return null;
    }
    var item = { id: newId(), kind: kind, text: text, ts: Date.now() };
    list.unshift(item);
    if (list.length > MAX_ITEMS) {
      for (i = list.length - 1; i >= 0; i--) {
        if (!UNIQUE[list[i].kind]) { list.splice(i, 1); break; }
      }
    }
    save(list);
    return item;
  }

  function learn(text) {
    if (!isOn() || !text) return;
    var t = String(text);
    if (t.length > 2000) return;
    var found = [];
    var ex = t.match(EXPLICIT_EN) || t.match(EXPLICIT_BN);
    if (ex) {
      var raw = String(ex[1]).replace(/\s+/g, " ").trim().slice(0, MAX_LEN);
      if (raw && !/\?\s*$/.test(raw) && !looksSecret(raw)) found.push({ kind: "note", text: raw });
    }
    var sentences = t.match(/[^.!?\u0964\n]+[.!?\u0964]*/g) || [];
    sentences.forEach(function (s) {
      s = s.trim();
      if (!s || s.length > 300 || /\?\s*$/.test(s) || TEMP.test(s) || looksSecret(s)) return;
      PATTERNS.forEach(function (p) {
        var m = s.match(p.re);
        if (!m) return;
        var out = p.make(m);
        if (out) found.push({ kind: p.kind, text: out });
      });
    });
    var saved = [];
    found.slice(0, 3).forEach(function (f) {
      var it = addMemory(f.kind, f.text);
      if (it) saved.push(it);
    });
    if (saved.length) toast(saved.length === 1 ? saved[0].text : saved.length + " memories");
  }

  /* ---------- what to use ---------- */
  var STOP = {};
  ("the a an is are was were am i you he she it we they my your our to of and or in on at for with what how why when where who do does did can could would should please tell me about this that there here be been have has had will not no yes from by as if so then than too very just also \u0986\u09ae\u09bf \u0986\u09ae\u09be\u09b0 \u09a4\u09c1\u09ae\u09bf \u09a4\u09cb\u09ae\u09be\u09b0 \u0995\u09bf \u0995\u09c0 \u098f\u0987 \u09b8\u09c7\u0987 \u0993 \u098f\u09ac\u0982 \u09a8\u09be \u09b9\u09af\u09bc \u0995\u09b0\u09c7 \u0995\u09b0\u09cb \u0995\u09b0").split(" ").forEach(function (w) { STOP[w] = 1; });
  function tokens(s) {
    return norm(s).split(" ").filter(function (w) { return w.length >= 2 && !STOP[w]; });
  }
  function overlap(a, b) {
    var n = 0;
    a.forEach(function (x) {
      for (var i = 0; i < b.length; i++) {
        var y = b[i];
        if (x === y || (x.length >= 3 && y.length >= 3 && (x.indexOf(y) === 0 || y.indexOf(x) === 0))) { n++; break; }
      }
    });
    return n;
  }
  function isProfile(m) { return m.kind === "name" || m.kind === "place"; }

  function block(query) {
    if (!isOn()) return "";
    var list = load();
    if (!list.length) return "";
    var picks;
    if (list.length <= 8) {
      picks = list.slice();
    } else {
      var q = tokens(query);
      picks = list.filter(isProfile).slice(0, 4);
      list.filter(function (m) { return !isProfile(m); })
        .map(function (m) { return { m: m, s: overlap(tokens(m.text), q) }; })
        .filter(function (x) { return x.s > 0; })
        .sort(function (a, b) { return b.s - a.s; })
        .slice(0, 4)
        .forEach(function (x) { picks.push(x.m); });
    }
    var lines = [], total = 0;
    for (var i = 0; i < picks.length; i++) {
      var line = "- " + picks[i].text;
      if (total + line.length > 700) break;
      lines.push(line); total += line.length;
    }
    if (!lines.length) return "";
    var b = "[Saved notes about the user. Use them only when relevant and do not mention them unless asked.]\n" +
      lines.join("\n") + "\n[End of notes]\n\n";
    if (b === lastBlock) return "";
    lastBlock = b;
    return b;
  }

  /* ---------- screen ---------- */
  var modal = document.createElement("div");
  modal.id = "memModal";
  modal.className = "dn-modal";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML =
    '<div class="dn-sheet" role="dialog" aria-modal="true" aria-labelledby="memTitle">' +
      '<div class="dn-grab"></div>' +
      '<button id="memClose" class="dn-close icon-btn" type="button" aria-label="Close memory">' +
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
      '</button>' +
      '<div class="dn-hero"><div class="dn-heart">\uD83E\uDDE0</div><h2 id="memTitle">Memory</h2>' +
      '<p>Kivo remembers useful facts you share and uses them in all your chats. Everything stays on this phone.</p></div>' +
      '<div class="mem-row"><span>Memory <small id="memState"></small></span>' +
        '<button id="memToggle" class="mem-switch" type="button" role="switch" aria-checked="true" aria-label="Memory on or off"><i></i></button></div>' +
      '<div class="mem-add"><input id="memInput" type="text" maxlength="200" placeholder="Add something to remember" aria-label="New memory">' +
        '<button id="memAdd" type="button">Add</button></div>' +
      '<div id="memList" class="mem-list"></div>' +
      '<p id="memNote" class="dn-status" aria-live="polite"></p>' +
      '<button id="memClear" class="mem-clear" type="button">Clear all memories</button>' +
      '<div id="memConfirm" class="mem-confirm" hidden><span id="memConfirmText"></span>' +
        '<div><button id="memNo" type="button">Cancel</button><button id="memYes" class="danger" type="button">Delete all</button></div></div>' +
    '</div>';
  document.body.appendChild(modal);

  var toastEl = document.createElement("div");
  toastEl.id = "memToast";
  toastEl.className = "mem-toast";
  toastEl.setAttribute("role", "status");
  document.body.appendChild(toastEl);

  function toast(text) {
    toastEl.textContent = "Memory saved: " + text;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 3200);
  }
  function note(msg) { $("memNote").textContent = msg || ""; }

  function paintToggle() {
    var on = isOn(), t = $("memToggle");
    t.setAttribute("aria-checked", on ? "true" : "false");
    if (on) t.classList.add("on"); else t.classList.remove("on");
    $("memState").textContent = on ? "On" : "Off";
  }

  function render() {
    var list = load(), box = $("memList");
    box.innerHTML = "";
    $("memConfirm").hidden = true;
    $("memClear").hidden = !list.length;
    if (!list.length) {
      var e = document.createElement("div");
      e.className = "mem-empty";
      e.textContent = "Nothing saved yet. Kivo saves useful facts you share, like your name or what you like. You can also write \"remember that ...\" in a chat.";
      box.appendChild(e);
      return;
    }
    list.forEach(function (m) { box.appendChild(row(m)); });
  }

  function row(m) {
    var r = document.createElement("div"); r.className = "mem-item";
    var t = document.createElement("span"); t.className = "mem-text"; t.textContent = m.text;
    var ed = document.createElement("button"); ed.type = "button"; ed.className = "mem-btn";
    ed.setAttribute("aria-label", "Edit memory"); ed.textContent = "\u270E";
    var del = document.createElement("button"); del.type = "button"; del.className = "mem-btn";
    del.setAttribute("aria-label", "Delete memory"); del.textContent = "\u00d7";
    ed.addEventListener("click", function () { startEdit(r, m); });
    del.addEventListener("click", function () { removeMemory(m.id); });
    r.appendChild(t); r.appendChild(ed); r.appendChild(del);
    return r;
  }

  function startEdit(r, m) {
    r.innerHTML = "";
    var inp = document.createElement("input");
    inp.type = "text"; inp.className = "mem-edit"; inp.maxLength = MAX_LEN; inp.value = m.text;
    inp.setAttribute("aria-label", "Edit memory text");
    var ok = document.createElement("button"); ok.type = "button"; ok.className = "mem-ok"; ok.textContent = "Save";
    var no = document.createElement("button"); no.type = "button"; no.className = "mem-ok"; no.textContent = "Cancel";
    ok.addEventListener("click", function () {
      var v = inp.value.replace(/\s+/g, " ").trim();
      if (!v) { note("A memory can't be empty."); return; }
      if (looksSecret(v)) { note("Kivo doesn't save passwords, keys or private numbers."); return; }
      var list = load();
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === m.id) { list[i].text = v.slice(0, MAX_LEN); list[i].ts = Date.now(); }
      }
      save(list); lastBlock = ""; note("Saved."); render();
    });
    no.addEventListener("click", function () { note(""); render(); });
    r.appendChild(inp); r.appendChild(ok); r.appendChild(no);
    inp.focus();
  }

  function removeMemory(id) {
    save(load().filter(function (m) { return m.id !== id; }));
    lastBlock = ""; note("Deleted."); render();
  }

  function openMem() {
    var c = $("closeSidebar"); if (c) c.click();
    paintToggle(); render(); note("");
    modal.classList.add("open"); modal.setAttribute("aria-hidden", "false");
  }
  function closeMem() { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); }

  $("memClose").addEventListener("click", closeMem);
  modal.addEventListener("click", function (e) { if (e.target === modal) closeMem(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMem(); });

  $("memToggle").addEventListener("click", function () {
    setOn(!isOn()); paintToggle();
    note(isOn() ? "Memory is on." : "Memory is off. Kivo won't save or use memories.");
  });

  $("memAdd").addEventListener("click", function () {
    var inp = $("memInput");
    var v = inp.value.replace(/\s+/g, " ").trim();
    if (!v) return;
    if (looksSecret(v)) { note("Kivo doesn't save passwords, keys or private numbers."); return; }
    var it = addMemory("note", v);
    if (it) { inp.value = ""; lastBlock = ""; note("Saved."); render(); } else { note("Already saved."); }
  });

  $("memClear").addEventListener("click", function () {
    $("memConfirmText").textContent = "Delete all " + load().length + " memories? This can't be undone.";
    $("memConfirm").hidden = false; $("memClear").hidden = true;
  });
  $("memNo").addEventListener("click", function () { render(); });
  $("memYes").addEventListener("click", function () {
    save([]); lastBlock = ""; render(); note("All memories deleted.");
  });

  var btn = document.createElement("button");
  btn.type = "button"; btn.className = "btn btn-soft"; btn.style.marginTop = "8px";
  btn.textContent = "\uD83E\uDDE0 Memory";
  var donate = $("donateButton");
  if (donate && donate.parentNode) donate.parentNode.insertBefore(btn, donate);
  btn.addEventListener("click", openMem);

  window.KivoMemory = {
    learn: learn,
    block: block,
    resetContext: function () { lastBlock = ""; }
  };
})();

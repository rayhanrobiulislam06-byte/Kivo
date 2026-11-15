// Kivo UI - on-device. Bridge: KivoNative.{isReady,isLoading,pickModel,sendMessage,newChat,stop,getPending,clearPending}
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }

  var chat = $("chat"), input = $("messageInput"), sendBtn = $("sendButton");
  var sidebar = $("sidebar"), overlay = $("sidebarOverlay"), list = $("conversationList");
  var setup = $("setupScreen"), setupText = $("setupText"), setupBtn = $("setupButton");
  var pWrap = $("progressWrap"), pBar = $("progressBar"), pLabel = $("progressLabel");

  var ON_DEVICE = typeof window.KivoNative !== "undefined";
  var DONATION_ADDRESS = (window.KIVO_CONFIG && window.KIVO_CONFIG.donationAddress) || "";
  var KEY_CONV = "kivoLocalConversations";
  var KEY_CUR = "kivoLocalCurrentConversationId";
  var KEY_THEME = "kivoTheme";
  var KEY_GEN = "kivoGenConv";
  var SUGGESTIONS = ["Explain something in simple words", "Help me write a message", "Give me a creative idea"];
  var SEND_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  var STOP_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>';
  var FENCE = String.fromCharCode(96, 96, 96);
  var FENCE_OPEN = new RegExp("^\\s*" + FENCE + "\\s*([\\w+-]*)");
  var FENCE_CLOSE = new RegExp("^\\s*" + FENCE);

  var conversations = [];
  var currentId = null;
  var isSending = false;
  var gen = null;
  var pendingReset = false;
  var nativeReady = !ON_DEVICE;
  var requests = {};
  var setupState = "missing";
  var justInstalled = false;
  var needContext = true;
  var sentChars = 0;
  var inner = null;
  var btnMode = "";

  /* ---------- storage ---------- */
  function loadAll() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY_CONV) || "[]");
      conversations = Array.isArray(d) ? d : [];
      currentId = localStorage.getItem(KEY_CUR);
    } catch (e) { conversations = []; currentId = null; }
    if (currentId && !getCur()) currentId = null;
  }
  function saveConv() { try { localStorage.setItem(KEY_CONV, JSON.stringify(conversations)); } catch (e) {} }
  function saveCur() {
    try {
      if (currentId) localStorage.setItem(KEY_CUR, currentId);
      else localStorage.removeItem(KEY_CUR);
    } catch (e) {}
  }
  function getCur() { return findConv(currentId); }
  function findConv(id) {
    for (var i = 0; i < conversations.length; i++) if (conversations[i].id === id) return conversations[i];
    return null;
  }
  function newId() { return "local-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10); }

  /* ---------- theme ---------- */
  var themeBtn = document.createElement("button");
  themeBtn.type = "button";
  themeBtn.className = "btn btn-soft theme-btn";
  sidebar.insertBefore(themeBtn, $("donateButton"));

  function getThemePref() {
    try { return localStorage.getItem(KEY_THEME) || "auto"; } catch (e) { return "auto"; }
  }
  function applyTheme() {
    var pref = getThemePref();
    var sysDark = false;
    try { sysDark = !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); } catch (e) {}
    var dark = pref === "dark" || (pref === "auto" && sysDark);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    themeBtn.textContent = "Theme: " + (pref === "auto" ? "Auto" : pref === "dark" ? "Dark" : "Light");
  }
  themeBtn.addEventListener("click", function () {
    var p = getThemePref();
    var n = p === "auto" ? "dark" : p === "dark" ? "light" : "auto";
    try { localStorage.setItem(KEY_THEME, n); } catch (e) {}
    applyTheme();
  });

  /* ---------- sidebar ---------- */
  function openSidebar() {
    sidebar.classList.add("open"); overlay.classList.add("open");
    sidebar.setAttribute("aria-hidden", "false");
  }
  function closeSidebar() {
    sidebar.classList.remove("open"); overlay.classList.remove("open");
    sidebar.setAttribute("aria-hidden", "true");
  }

  /* ---------- engine context reset ---------- */
  function doReset() {
    needContext = true; sentChars = 0; if (window.KivoMemory) window.KivoMemory.resetContext();
    try { if (window.KivoNative && window.KivoNative.newChat) window.KivoNative.newChat(); } catch (e) {}
  }
  function resetEngine() {
    if (isSending) { pendingReset = true; return; }
    pendingReset = false; doReset();
  }

  function renderList() {
    list.innerHTML = "";
    conversations.forEach(function (c) {
      var row = document.createElement("div");
      row.className = "conv-item" + (c.id === currentId ? " active" : "") + (gen && gen.convId === c.id ? " generating" : "");

      var t = document.createElement("button");
      t.className = "conv-title"; t.type = "button"; t.textContent = c.title || "New chat";
      t.addEventListener("click", function () { openConv(c.id); });

      var del = document.createElement("button");
      del.className = "conv-del"; del.type = "button";
      del.setAttribute("aria-label", "Delete conversation"); del.textContent = "\u00d7";
      var armed = false, timer = null;
      del.addEventListener("click", function () {
        if (!armed) {
          armed = true; del.classList.add("armed"); del.textContent = "Delete?";
          timer = setTimeout(function () { armed = false; del.classList.remove("armed"); del.textContent = "\u00d7"; }, 2500);
          return;
        }
        clearTimeout(timer); deleteConv(c.id);
      });

      row.appendChild(t); row.appendChild(del); list.appendChild(row);
    });
  }

  function openConv(id) {
    if (id !== currentId) resetEngine();
    currentId = id; saveCur(); renderMessages(); renderList(); closeSidebar();
  }
  function deleteConv(id) {
    if (gen && gen.convId === id) stopGen();
    conversations = conversations.filter(function (c) { return c.id !== id; });
    saveConv();
    if (currentId === id) { currentId = null; saveCur(); resetEngine(); renderMessages(); }
    renderList();
  }
  function startNewChat() {
    resetEngine();
    currentId = null; saveCur(); renderMessages(); renderList(); closeSidebar();
    input.value = ""; autosize(); updateSend(); input.focus();
  }

  /* ---------- markdown ---------- */
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function inline(s) {
    var parts = String(s).split(/(`[^`\n]+`)/g);
    return parts.map(function (p) {
      if (p.length > 2 && p.charAt(0) === "`" && p.charAt(p.length - 1) === "`") {
        return "<code>" + esc(p.slice(1, -1)) + "</code>";
      }
      p = esc(p);
      p = p.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
      p = p.replace(/(^|[^*])\*([^*\s][^*\n]*)\*(?!\*)/g, "$1<em>$2</em>");
      return p;
    }).join("");
  }
  function codeHtml(lang, lines) {
    return '<div class="codeblock"><div class="codehead"><span>' + esc(lang || "code") +
      '</span><button type="button" class="copy-code" aria-label="Copy code">Copy</button></div>' +
      "<pre><code>" + esc(lines.join("\n")) + "</code></pre></div>";
  }
  function renderMd(text) {
    var lines = String(text).replace(/\r/g, "").split("\n");
    var out = [], para = [], lst = null, inCode = false, code = [], lang = "";
    function flushPara() {
      if (para.length) { out.push("<p>" + para.map(inline).join("<br>") + "</p>"); para = []; }
    }
    function flushList() {
      if (lst) {
        out.push("<" + lst.t + ">" + lst.items.map(function (x) { return "<li>" + inline(x) + "</li>"; }).join("") + "</" + lst.t + ">");
        lst = null;
      }
    }
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (inCode) {
        if (FENCE_CLOSE.test(ln)) { out.push(codeHtml(lang, code)); inCode = false; code = []; lang = ""; }
        else code.push(ln);
        continue;
      }
      var fence = ln.match(FENCE_OPEN);
      if (fence) { flushPara(); flushList(); inCode = true; lang = fence[1] || ""; continue; }
      var h = ln.match(/^(#{1,3})\s+(.*)$/);
      if (h) {
        flushPara(); flushList();
        var lv = h[1].length + 2;
        out.push("<h" + lv + ">" + inline(h[2]) + "</h" + lv + ">");
        continue;
      }
      var ul = ln.match(/^\s*[-*\u2022]\s+(.*)$/);
      var ol = ln.match(/^\s*\d+[.)]\s+(.*)$/);
      if (ul || ol) {
        flushPara();
        var t = ul ? "ul" : "ol";
        if (lst && lst.t !== t) flushList();
        if (!lst) lst = { t: t, items: [] };
        lst.items.push((ul || ol)[1]);
        continue;
      }
      if (/^\s*$/.test(ln)) { flushPara(); flushList(); continue; }
      flushList(); para.push(ln);
    }
    if (inCode) out.push(codeHtml(lang, code));
    flushPara(); flushList();
    return out.join("");
  }

  /* ---------- messages ---------- */
  function nearBottom() { return chat.scrollHeight - chat.scrollTop - chat.clientHeight < 140; }
  function toBottom() { chat.scrollTop = chat.scrollHeight; }

  function userBubble(text) {
    var d = document.createElement("div");
    d.className = "msg user"; d.textContent = text; return d;
  }
  function botBubble(raw, withActions, extra) {
    var d = document.createElement("div");
    d.className = "msg bot" + (extra ? " " + extra : "");
    var md = document.createElement("div");
    md.className = "md"; md.innerHTML = renderMd(raw || "");
    d.appendChild(md); d._raw = raw || "";
    if (withActions) {
      var a = document.createElement("div"); a.className = "msg-actions";
      var b = document.createElement("button");
      b.type = "button"; b.className = "copy-msg";
      b.setAttribute("aria-label", "Copy reply"); b.textContent = "Copy";
      a.appendChild(b); d.appendChild(a);
    }
    return d;
  }
  function thinkingBubble() {
    var d = document.createElement("div");
    d.className = "msg bot thinking fresh";
    d.appendChild(document.createTextNode("Thinking"));
    var dots = document.createElement("span"); dots.className = "dots";
    dots.innerHTML = "<i></i><i></i><i></i>";
    d.appendChild(dots);
    return d;
  }

  function renderMessages() {
    chat.innerHTML = "";
    inner = document.createElement("div"); inner.className = "chat-inner";
    var c = getCur();
    if (gen) { gen.el = null; gen.thinking = false; gen.pending = false; }
    if (!c || !c.messages || c.messages.length === 0) {
      var e = document.createElement("div"); e.className = "empty";
      var tt = document.createElement("div"); tt.className = "empty-title"; tt.textContent = "Start a conversation";
      e.appendChild(tt);
      var chips = document.createElement("div"); chips.className = "chips";
      SUGGESTIONS.forEach(function (s) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "chip"; b.textContent = s;
        b.addEventListener("click", function () {
          input.value = s; autosize(); updateSend(); input.focus();
        });
        chips.appendChild(b);
      });
      e.appendChild(chips); inner.appendChild(e);
    } else {
      c.messages.forEach(function (m) {
        inner.appendChild(m.type === "user" ? userBubble(m.text) : botBubble(m.text, true));
      });
    }
    if (gen && c && gen.convId === c.id) {
      if (gen.raw) { gen.el = botBubble(gen.raw, false); }
      else { gen.el = thinkingBubble(); gen.thinking = true; }
      inner.appendChild(gen.el);
    }
    chat.appendChild(inner); toBottom();
  }

  function showError(detail) {
    var d = document.createElement("div");
    d.className = "msg bot error";
    d.appendChild(document.createTextNode("Kivo couldn't respond. Try again."));
    if (detail) {
      var s = document.createElement("span"); s.className = "detail"; s.textContent = detail; d.appendChild(s);
    }
    inner.appendChild(d); toBottom();
  }

  function onGenChunk(t) {
    var g = gen; if (!g) return;
    g.raw += t;
    if (!g.el) return;
    if (g.thinking) {
      var b = botBubble(g.raw, false, "fresh");
      if (g.el.parentNode) g.el.parentNode.replaceChild(b, g.el);
      g.el = b; g.thinking = false; toBottom();
      return;
    }
    if (g.pending) return;
    g.pending = true;
    requestAnimationFrame(function () {
      g.pending = false;
      if (!g.el) return;
      var stick = nearBottom();
      g.el.firstChild.innerHTML = renderMd(g.raw);
      g.el._raw = g.raw;
      if (stick) toBottom();
    });
  }

  /* ---------- copy ---------- */
  function fallbackCopy(txt) {
    try {
      var ta = document.createElement("textarea");
      ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.focus(); ta.select();
      var ok = document.execCommand("copy"); ta.remove(); return ok;
    } catch (e) { return false; }
  }
  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(txt).then(function () { return true; }, function () { return fallbackCopy(txt); });
    }
    return Promise.resolve(fallbackCopy(txt));
  }
  function doCopy(txt, btn) {
    copyText(txt).then(function (ok) {
      var old = btn.textContent;
      btn.textContent = ok ? "Copied" : "Failed";
      setTimeout(function () { btn.textContent = old; }, 1400);
    });
  }
  chat.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.classList) return;
    if (t.classList.contains("copy-code")) {
      var cb = t.closest(".codeblock");
      var code = cb ? cb.querySelector("code") : null;
      if (code) doCopy(code.textContent, t);
    } else if (t.classList.contains("copy-msg")) {
      var m = t.closest(".msg");
      if (m) doCopy(m._raw || "", t);
    }
  });

  /* ---------- native request ---------- */
  function ask(text, onChunk) {
    return new Promise(function (resolve, reject) {
      if (!ON_DEVICE) { resolve("Preview mode: native AI bridge is not available."); return; }
      if (!window.KivoNative.isReady()) { reject(new Error("Gemma 4 E2B is not ready yet")); return; }
      var id = "req-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
      var timer = setTimeout(function () { delete requests[id]; reject(new Error("AI request timed out")); }, 15 * 60 * 1000);
      requests[id] = { resolve: resolve, reject: reject, timer: timer, onChunk: onChunk };
      try { window.KivoNative.sendMessage(text, id); }
      catch (e) { clearTimeout(timer); delete requests[id]; reject(e); }
    });
  }

  window.kivoNativeChunk = function (id, text) {
    var r = requests[id];
    if (r && r.onChunk) r.onChunk(text);
  };
  window.kivoNativeResponse = function (id, response, error) {
    var r = requests[id]; if (!r) return;
    delete requests[id]; clearTimeout(r.timer);
    if (error) r.reject(new Error(error)); else r.resolve(response || "");
  };

  function clearPendingNative() {
    try { if (window.KivoNative && window.KivoNative.clearPending) window.KivoNative.clearPending(); } catch (e) {}
  }

  /* ---------- unlimited chat: automatic memory ---------- */
  function pause(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

  function buildPromptBase(c, text) {
    var hist = c.messages.slice(0, -1).slice(-4);
    if (!needContext || hist.length === 0) return text;
    var lines = hist.map(function (m) {
      var t = String(m.text || "");
      if (t.length > 300) t = t.slice(0, 300) + "...";
      return (m.type === "user" ? "User: " : "Kivo: ") + t;
    });
    return "Earlier in this conversation:\n" + lines.join("\n") +
      "\n\nContinue the conversation. Reply only to the latest message.\nUser: " + text;
  }

  function buildPrompt(c, text) {
    var base = buildPromptBase(c, text);
    var mem = window.KivoMemory ? window.KivoMemory.block(text) : "";
    return mem + base;
  }

  async function askWithMemory(c, text, onChunk) {
    if (sentChars > 3500) { doReset(); await pause(700); }
    var got = false;
    var wrapped = function (t) { got = true; onChunk(t); };
    var prompt = buildPrompt(c, text);
    try {
      var r = await ask(prompt, wrapped);
      needContext = false;
      sentChars += prompt.length + r.length;
      return r;
    } catch (err) {
      var m = String(err && err.message ? err.message : "");
      doReset();
      if (got || /not ready|timed out|MODEL_NOT_READY/i.test(m)) throw err;
      await pause(700);
      var prompt2 = buildPrompt(c, text);
      var r2 = await ask(prompt2, wrapped);
      needContext = false;
      sentChars = prompt2.length + r2.length;
      return r2;
    }
  }

  /* ---------- sending, stopping, finishing ---------- */
  function finishGen(c, text, err) {
    var partial = String(text || "").trim();
    var visible = currentId === c.id;
    if (partial) {
      c.messages.push({ text: partial, type: "bot" }); saveConv();
    } else if (err && !visible) {
      c.messages.push({ text: "Kivo couldn't respond. Try again.", type: "bot" }); saveConv();
    }
    gen = null; isSending = false;
    try { localStorage.removeItem(KEY_GEN); } catch (e) {}
    clearPendingNative();
    if (visible) {
      renderMessages();
      if (err) showError(err.message || "");
    }
    renderList(); updateSend();
    if (pendingReset) { pendingReset = false; doReset(); }
  }

  function stopGen() {
    try { if (window.KivoNative && window.KivoNative.stop) window.KivoNative.stop(); } catch (e) {}
  }

  async function sendMessage() {
    if (isSending) return;
    var text = input.value.trim(); if (!text) return;

    var c = getCur();
    if (!c) {
      c = { id: newId(), title: text.length > 40 ? text.slice(0, 40) + "..." : text, messages: [] };
      conversations.unshift(c); currentId = c.id; saveCur();
    }
    c.messages.push({ text: text, type: "user" }); saveConv(); if (window.KivoMemory) window.KivoMemory.learn(text);
    try { localStorage.setItem(KEY_GEN, c.id); } catch (e) {}
    input.value = ""; autosize();

    isSending = true;
    gen = { convId: c.id, raw: "", el: null, thinking: false, pending: false };
    updateSend(); renderMessages(); renderList();

    try {
      var reply = await askWithMemory(c, text, onGenChunk);
      finishGen(c, reply || (gen ? gen.raw : ""), null);
    } catch (err) {
      finishGen(c, gen ? gen.raw : "", err || new Error("AI generation failed"));
    }
  }

  /* ---------- restore a reply that ran while the page was away ---------- */
  function recoverPending() {
    if (!ON_DEVICE || !window.KivoNative || !window.KivoNative.getPending) return;
    var raw = "";
    try { raw = window.KivoNative.getPending(); } catch (e) { return; }
    if (!raw) return;
    var p = null;
    try { p = JSON.parse(raw); } catch (e) { return; }
    var convId = "";
    try { convId = localStorage.getItem(KEY_GEN) || ""; } catch (e) {}
    var c = findConv(convId);
    var last = c && c.messages.length ? c.messages[c.messages.length - 1] : null;
    if (!p || !p.id || !c || !last || last.type !== "user") {
      if (p && p.done) clearPendingNative();
      return;
    }

    if (p.done) {
      if (p.text) { c.messages.push({ text: p.text, type: "bot" }); saveConv(); }
      try { localStorage.removeItem(KEY_GEN); } catch (e) {}
      clearPendingNative();
      if (currentId === c.id) {
        renderMessages();
        if (!p.text && p.error) showError(p.error);
      }
      renderList();
      return;
    }

    isSending = true;
    gen = { convId: c.id, raw: p.text || "", el: null, thinking: false, pending: false };
    updateSend(); renderMessages(); renderList();
    var timer = setTimeout(function () {
      delete requests[p.id];
      finishGen(c, gen ? gen.raw : "", new Error("AI request timed out"));
    }, 15 * 60 * 1000);
    requests[p.id] = {
      timer: timer,
      onChunk: onGenChunk,
      resolve: function (reply) { finishGen(c, reply || (gen ? gen.raw : ""), null); },
      reject: function (err) { finishGen(c, gen ? gen.raw : "", err); }
    };
  }

  /* ---------- composer ---------- */
  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";
  }
  function updateSend() {
    var mode = isSending ? "stop" : "send";
    if (mode !== btnMode) {
      btnMode = mode;
      if (mode === "stop") {
        sendBtn.classList.add("stop");
        sendBtn.setAttribute("aria-label", "Stop generating");
        sendBtn.innerHTML = STOP_SVG;
      } else {
        sendBtn.classList.remove("stop");
        sendBtn.setAttribute("aria-label", "Send message");
        sendBtn.innerHTML = SEND_SVG;
      }
    }
    sendBtn.disabled = mode === "send" && input.value.trim() === "";
  }

  /* ---------- setup screen ---------- */
  var MODEL_TOTAL = 2588147712;
  var confirmMobile = false;
  var altBtn = $("setupAltButton");

  function gb(n) { return (n / 1e9).toFixed(2); }

  function paintProgress(done, total) {
    total = total || MODEL_TOTAL;
    var pct = Math.max(0, Math.min(100, (done / total) * 100));
    pBar.style.width = pct.toFixed(1) + "%";
    pLabel.hidden = false;
    pLabel.textContent = gb(done) + " / " + gb(total) + " GB \u00b7 " + pct.toFixed(0) + "%";
  }

  function setSetup(state, msg, done, total) {
    setupState = state;
    confirmMobile = false;
    setup.hidden = false; setup.classList.remove("hide");
    setup.setAttribute("data-state", state);
    pWrap.hidden = true; pLabel.hidden = true; pWrap.classList.remove("indeterminate");
    setupBtn.hidden = false; altBtn.hidden = true;
    if (state === "missing") {
      setupText.textContent = "Kivo downloads the Gemma 4 E2B model once (about 2.6 GB). After that it works fully offline.";
      setupBtn.textContent = "Download Gemma 4 E2B";
      altBtn.hidden = false;
    } else if (state === "downloading") {
      setupText.textContent = "Downloading Gemma 4 E2B\u2026";
      pWrap.hidden = false; paintProgress(done || 0, total);
      setupBtn.textContent = "Pause";
    } else if (state === "paused") {
      setupText.textContent = "Download paused. You can continue any time.";
      pWrap.hidden = false; paintProgress(done || 0, total);
      setupBtn.textContent = "Resume download";
      altBtn.hidden = false;
    } else if (state === "verifying") {
      setupText.textContent = "Checking the download\u2026";
      pWrap.hidden = false; pWrap.classList.add("indeterminate"); setupBtn.hidden = true;
    } else if (state === "installing") {
      setupText.textContent = "Installing Gemma 4 E2B\u2026";
      pWrap.hidden = false; pLabel.hidden = false; setupBtn.hidden = true;
    } else if (state === "loading") {
      setupText.textContent = "Loading Gemma 4 E2B\u2026";
      pWrap.hidden = false; pWrap.classList.add("indeterminate"); setupBtn.hidden = true;
    } else if (state === "ready") {
      setupText.textContent = "Gemma 4 E2B ready";
      setupBtn.textContent = "Start Chat";
    } else if (state === "error") {
      setupText.textContent = "Couldn't set up Gemma 4 E2B.";
      pLabel.hidden = false; pLabel.textContent = msg || "Unknown error";
      setupBtn.textContent = "Try again";
      altBtn.hidden = false;
    }
  }
  function hideSetup() { setup.hidden = true; setup.classList.add("hide"); }

  setupBtn.addEventListener("click", function () {
    var n = window.KivoNative;
    if (setupState === "ready") { hideSetup(); input.focus(); return; }
    if (!n) return;
    if (setupState === "downloading") { if (n.pauseDownload) n.pauseDownload(); return; }
    if (setupState === "missing" || setupState === "paused" || setupState === "error") {
      var metered = false;
      try { metered = !!n.isMetered(); } catch (e) {}
      if (metered && !confirmMobile) {
        confirmMobile = true;
        setupText.textContent = "You are on mobile data. The download is about 2.6 GB. Tap again to continue, or connect to Wi-Fi first.";
        setupBtn.textContent = "Download on mobile data";
        return;
      }
      confirmMobile = false;
      if (n.downloadModel) n.downloadModel();
    }
  });

  altBtn.addEventListener("click", function () {
    if (window.KivoNative && window.KivoNative.pickModel) window.KivoNative.pickModel();
  });

  window.kivoNativeSetup = function (state) { if (state === "loading") setSetup("loading"); };

  window.kivoNativeReady = function (ok, err) {
    nativeReady = !!ok;
    if (ok) { if (justInstalled) setSetup("ready"); else hideSetup(); }
    else { console.error("Gemma E2B:", err); setSetup("error", err); }
  };

  window.kivoModelDownload = function (state, done, total, msg) {
    justInstalled = true;
    if (state === "start" || state === "progress") {
      if (setupState !== "downloading") setSetup("downloading", "", done, total);
      else paintProgress(done, total);
    } else if (state === "verifying") {
      setSetup("verifying");
    } else if (state === "paused") {
      setSetup("paused", "", done, total);
    } else if (state === "error") {
      setSetup("error", msg);
    }
  };

  window.kivoModelProgress = function (bytes) {
    justInstalled = true;
    if (setupState !== "installing") setSetup("installing");
    paintProgress(bytes, MODEL_TOTAL);
  };

  window.kivoModelInstallFailed = function (err) {
    console.error("Model install failed:", err);
    setSetup("error", err || "Model installation failed");
  };

  function initSetup() {
    if (!ON_DEVICE) { hideSetup(); return; }
    var n = window.KivoNative;
    function check() {
      try {
        if (n.isReady()) {
          nativeReady = true;
          if (setupState === "missing" || setupState === "loading" || setupState === "paused") hideSetup();
          return true;
        }
        if (n.isLoading() && setupState !== "loading") setSetup("loading");
      } catch (e) {}
      return false;
    }
    var part = 0, running = false;
    try { part = n.getPartialBytes ? Number(n.getPartialBytes()) : 0; } catch (e) {}
    try { running = n.isDownloading ? !!n.isDownloading() : false; } catch (e) {}
    if (running) setSetup("downloading", "", part, MODEL_TOTAL);
    else if (part > 0) setSetup("paused", "", part, MODEL_TOTAL);
    else setSetup("missing");
    if (check()) return;
    var t = setInterval(function () { if (check()) clearInterval(t); }, 800);
  }

  /* ---------- donation ---------- */
  var ADDR_OK = /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(DONATION_ADDRESS);
  var QR_SRC = (window.KIVO_CONFIG && window.KIVO_CONFIG.donationQr) || "";
  var dModal = $("donationModal"), dAddr = $("donationAddress"), dStatus = $("donationStatus"), dCopy = $("copyDonationAddress");
  var dQr = $("donationQr"), dQrBox = $("donationQrBox");
  var dChips = dModal.querySelectorAll(".dn-chip");
  var dReset = null;

  $("donateButton").style.display = ADDR_OK ? "" : "none";

  function clearChips() {
    for (var i = 0; i < dChips.length; i++) dChips[i].classList.remove("on");
  }
  function openDonation() {
    if (!ADDR_OK) return;
    dAddr.textContent = DONATION_ADDRESS;
    if (QR_SRC) { dQr.src = QR_SRC; dQrBox.hidden = false; } else { dQrBox.hidden = true; }
    dStatus.textContent = "";
    dCopy.textContent = "Copy address";
    clearChips();
    dModal.classList.add("open"); dModal.setAttribute("aria-hidden", "false");
  }
  function closeDonation() { dModal.classList.remove("open"); dModal.setAttribute("aria-hidden", "true"); }

  Array.prototype.forEach.call(dChips, function (chip) {
    chip.addEventListener("click", function () {
      clearChips(); chip.classList.add("on");
      dStatus.textContent = "Suggested: " + chip.getAttribute("data-amt") + " USDT. Copy the address and send from your wallet.";
    });
  });

  $("donateButton").addEventListener("click", function () { closeSidebar(); openDonation(); });
  $("closeDonationButton").addEventListener("click", closeDonation);
  dModal.addEventListener("click", function (e) { if (e.target === dModal) closeDonation(); });
  dCopy.addEventListener("click", function () {
    copyText(DONATION_ADDRESS).then(function (ok) {
      dCopy.textContent = ok ? "Copied \u2713" : "Couldn't copy";
      dStatus.textContent = ok
        ? "Address copied. Open your wallet and send USDT on TRON (TRC20)."
        : "Couldn't copy. Press and hold the address to select it.";
      clearTimeout(dReset);
      dReset = setTimeout(function () { dCopy.textContent = "Copy address"; }, 2200);
    });
  });

  (function () {
    var v = $("appVersion");
    try {
      if (v && window.KivoNative && window.KivoNative.getVersion) {
        var o = JSON.parse(window.KivoNative.getVersion() || "{}");
        if (o && o.name) v.textContent = "Kivo v" + o.name;
      }
    } catch (e) {}
  })();

  /* ---------- wiring ---------- */
  $("menuButton").addEventListener("click", openSidebar);
  $("closeSidebar").addEventListener("click", closeSidebar);
  overlay.addEventListener("click", closeSidebar);
  $("newChatButton").addEventListener("click", startNewChat);
  $("sidebarNewChat").addEventListener("click", startNewChat);
  sendBtn.addEventListener("click", function () { if (isSending) stopGen(); else sendMessage(); });
  input.addEventListener("input", function () { autosize(); updateSend(); });
  input.addEventListener("focus", function () { setTimeout(toBottom, 300); });
  window.addEventListener("resize", function () { if (document.activeElement === input) toBottom(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeDonation(); closeSidebar(); }
  });


  /* ---------- start ---------- */
  applyTheme(); loadAll(); renderList(); renderMessages(); updateSend(); initSetup(); recoverPending();
})();

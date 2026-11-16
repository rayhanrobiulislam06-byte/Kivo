/* Kivo backup & restore: chats, memory and settings <-> one JSON file. No server involved. */
(function () {
  var PREFIX = "kivo", SKIP = { kivoGenConv: 1 };
  var btn = document.getElementById("backupButton");
  if (!btn) return;

  function collect() {
    var d = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k.indexOf(PREFIX) === 0 && !SKIP[k]) d[k] = localStorage.getItem(k);
    }
    return { app: "kivo", v: 1, at: new Date().toISOString(), data: d };
  }
  function b64(str) {
    var bytes = new TextEncoder().encode(str), bin = "";
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function toast(msg) {
    var t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = "position:fixed;left:50%;bottom:96px;transform:translateX(-50%);max-width:86vw;background:var(--text);" +
      "color:var(--bg);padding:10px 16px;border-radius:14px;font-size:13px;z-index:90;text-align:center";
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2600);
  }
  function exportIt() {
    var json = JSON.stringify(collect());
    var name = "kivo-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    if (window.KivoNative && window.KivoNative.saveFile) {
      window.KivoNative.saveFile(name, "application/json", b64(json));
    } else {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      a.download = name; a.click();
    }
  }
  function importIt(file) {
    if (!file) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var o = JSON.parse(String(r.result));
        if (!o || o.app !== "kivo" || !o.data || typeof o.data !== "object") throw new Error("bad");
        var n = 0;
        for (var k in o.data) {
          if (k.indexOf(PREFIX) === 0 && !SKIP[k] && typeof o.data[k] === "string") { localStorage.setItem(k, o.data[k]); n++; }
        }
        if (!n) throw new Error("empty");
        toast("Restored. Reloading\u2026");
        setTimeout(function () { location.reload(); }, 800);
      } catch (e) { toast("This is not a valid Kivo backup file"); }
    };
    r.readAsText(file);
  }

  var overlay;
  function close() { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); overlay = null; }
  function open() {
    close();
    overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:80;display:flex;align-items:flex-end;justify-content:center";
    var sheet = document.createElement("div");
    sheet.style.cssText = "width:100%;max-width:440px;background:var(--bg);color:var(--text);border-radius:24px 24px 0 0;" +
      "padding:20px 20px calc(24px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:12px";
    sheet.innerHTML =
      '<h2 style="margin:0;font-size:18px">Backup &amp; restore</h2>' +
      '<p style="margin:0;font-size:14px;opacity:.8;line-height:1.5">Save your chats, memory and settings to a file, or bring them back on this or another phone. ' +
      'The file stays on your device.<br>\u099a\u09cd\u09af\u09be\u099f, \u09ae\u09c7\u09ae\u09cb\u09b0\u09bf \u0993 \u09b8\u09c7\u099f\u09bf\u0982\u09b8 \u098f\u0995\u099f\u09bf \u09ab\u09be\u0987\u09b2\u09c7 \u09b8\u0982\u09b0\u0995\u09cd\u09b7\u09a3 \u0995\u09b0\u09c1\u09a8\u0964</p>' +
      '<button id="bkExport" class="btn btn-primary">Export backup</button>' +
      '<button id="bkImport" class="btn btn-soft">Import backup (replaces current chats)</button>' +
      '<input id="bkFile" type="file" accept="application/json,.json" style="display:none">' +
      '<button id="bkLog" class="btn btn-soft">Show debug log</button>' +
      '<textarea id="bkLogText" readonly rows="9" style="display:none;width:100%;font-size:11px;font-family:monospace;' +
      'background:transparent;color:inherit;border:1px solid currentColor;border-radius:10px;padding:8px"></textarea>' +
      '<button id="bkCopy" class="btn btn-soft" style="display:none">Copy log</button>' +
      '<button id="bkClose" class="btn btn-soft">Close</button>';
    overlay.appendChild(sheet);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    var armed = false, imp = sheet.querySelector("#bkImport"), file = sheet.querySelector("#bkFile");
    sheet.querySelector("#bkExport").addEventListener("click", exportIt);
    sheet.querySelector("#bkClose").addEventListener("click", close);
    var logBox = sheet.querySelector("#bkLogText"), copyBtn = sheet.querySelector("#bkCopy");
    sheet.querySelector("#bkLog").addEventListener("click", function () {
      var t = "";
      try { t = window.KivoNative && window.KivoNative.getLog ? window.KivoNative.getLog() : ""; } catch (e) {}
      logBox.value = t || "(empty)";
      logBox.style.display = "block"; copyBtn.style.display = "block";
      logBox.scrollTop = logBox.scrollHeight;
    });
    copyBtn.addEventListener("click", function () {
      logBox.focus(); logBox.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      toast(ok ? "Log copied" : "Long-press the text and choose Copy");
    });
    imp.addEventListener("click", function () {
      if (!armed) { armed = true; imp.textContent = "Tap again to choose the backup file"; return; }
      file.click();
    });
    file.addEventListener("change", function () { importIt(file.files && file.files[0]); });
  }
  btn.addEventListener("click", function () {
    var sb = document.getElementById("sidebar"), ov = document.getElementById("sidebarOverlay");
    if (sb) { sb.classList.remove("open"); sb.setAttribute("aria-hidden", "true"); }
    if (ov) ov.classList.remove("open");
    open();
  });
})();

/* Kivo setup-screen UX: helpful notes, download speed / time left, keeps the screen on, clearer
   "I already have the model file" button. Loaded after app.js; only reads and decorates the DOM. */
(function () {
  /* FileNest button (external script, so it also works if the page blocks inline scripts) */
  var fb = document.getElementById("filesButton");
  if (fb) fb.addEventListener("click", function () {
    try { location.assign("filenest/index.html"); } catch (e) { location.href = "filenest/index.html"; }
  });

  var scr = document.getElementById("setupScreen");
  var label = document.getElementById("progressLabel");
  var text = document.getElementById("setupText");
  if (!scr || !label || !text) return;

  var st = document.createElement("style");
  st.textContent =
    ".ux-note{white-space:pre-line;font-size:13px;line-height:1.55;opacity:.8;margin:10px 4px}" +
    ".ux-speed{font-size:13px;margin-top:6px;opacity:.85;text-align:center}" +
    "#setupAltButton:not([hidden]){display:block;margin:14px auto 0;padding:10px 16px;border:1px solid currentColor;" +
    "border-radius:12px;background:transparent;font-weight:600;opacity:.9;text-decoration:none}";
  document.head.appendChild(st);

  var note = document.createElement("div"); note.className = "ux-note"; note.hidden = true;
  text.parentNode.insertBefore(note, text.nextSibling);
  var speed = document.createElement("div"); speed.className = "ux-speed"; speed.hidden = true;
  label.parentNode.insertBefore(speed, label.nextSibling);

  var NOTES = {
    missing: "One-time download, about 2.6 GB. Please use Wi-Fi. After this Kivo works fully offline.\n" +
      "\u098f\u0995\u09ac\u09be\u09b0\u0987 \u09a8\u09be\u09ae\u09be\u09a4\u09c7 \u09b9\u09ac\u09c7 (\u09aa\u09cd\u09b0\u09be\u09af\u09bc \u09e8.\u09ec GB)\u0964 Wi-Fi \u09ac\u09cd\u09af\u09ac\u09b9\u09be\u09b0 \u0995\u09b0\u09c1\u09a8\u0964 \u098f\u09b0\u09aa\u09b0 \u09aa\u09c1\u09b0\u09cb\u09aa\u09c1\u09b0\u09bf \u0985\u09ab\u09b2\u09be\u0987\u09a8\u0964\n" +
      "Already have the model file? Use the button below.",
    downloading: "For the fastest download keep this screen open and stay on Wi-Fi.\n\u09a1\u09be\u0989\u09a8\u09b2\u09cb\u09a1\u09c7\u09b0 \u09b8\u09ae\u09af\u09bc \u09b8\u09cd\u0995\u09cd\u09b0\u09bf\u09a8 \u099a\u09be\u09b2\u09c1 \u09b0\u09be\u0996\u09c1\u09a8\u0964",
    paused: "Your progress is saved. Tap Resume to continue where it stopped.",
    verifying: "Checking the file. This can take a minute.",
    installing: "Copying the model into Kivo. This can take a few minutes, please keep the app open.",
    error: "Tap Try again, the download continues where it stopped. If it keeps failing, get the model file another way and use \u201cI already have the model file\u201d."
  };

  var samples = [], lock = null, lastState = "";
  function state() { return scr.getAttribute("data-state") || ""; }

  function releaseLock() { try { if (lock) lock.release(); } catch (e) {} lock = null; }
  function holdLock() {
    try {
      if (navigator.wakeLock && !lock) {
        navigator.wakeLock.request("screen").then(function (l) {
          lock = l; l.addEventListener("release", function () { lock = null; });
        }).catch(function () {});
      }
    } catch (e) {}
  }

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) return "";
    if (sec < 90) return "less than a minute";
    var m = Math.round(sec / 60);
    return m < 90 ? "about " + m + " min" : "about " + (m / 60).toFixed(1) + " h";
  }

  function onState() {
    var s = state();
    note.textContent = NOTES[s] || ""; note.hidden = !NOTES[s];
    if (s !== "downloading") { samples = []; speed.hidden = true; speed.textContent = ""; }
    if (s === "downloading") holdLock(); else releaseLock();
    lastState = s;
  }

  function onProgress() {
    if (state() !== "downloading") return;
    var m = /([\d.]+)\s*\/\s*([\d.]+)\s*GB/.exec(label.textContent || "");
    if (!m) return;
    var done = parseFloat(m[1]), total = parseFloat(m[2]), now = Date.now();
    if (!isFinite(done) || !isFinite(total)) return;
    samples.push({ t: now, d: done });
    while (samples.length > 1 && now - samples[0].t > 40000) samples.shift();
    var a = samples[0], span = (now - a.t) / 1000, dd = done - a.d;
    if (span < 8 || dd <= 0) return;
    var gbps = dd / span;
    speed.textContent = (gbps * 1000).toFixed(1) + " MB/s \u00b7 " + fmtTime((total - done) / gbps) + " left";
    speed.hidden = false;
  }

  new MutationObserver(onState).observe(scr, { attributes: true, attributeFilter: ["data-state"] });
  new MutationObserver(onProgress).observe(label, { childList: true, characterData: true, subtree: true });
  document.addEventListener("visibilitychange", function () { if (!document.hidden && state() === "downloading") holdLock(); });
  onState();
})();

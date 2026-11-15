/* Injected by the Android app after every page load: keeps the status/navigation bar colour
   in sync with the page background (light, dark or a manually chosen theme). */
(function () {
  if (window.__kivoHost) return;
  window.__kivoHost = true;
  var timer = 0;
  function report() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      try {
        var c = getComputedStyle(document.body).backgroundColor;
        if (!c || c === "rgba(0, 0, 0, 0)") c = getComputedStyle(document.documentElement).backgroundColor;
        if (window.KivoNative && window.KivoNative.setBarColor) window.KivoNative.setBarColor(c);
      } catch (e) {}
    }, 60);
  }
  try {
    var attrs = { attributes: true, attributeFilter: ["class", "style", "data-theme"] };
    new MutationObserver(report).observe(document.documentElement, attrs);
    if (document.body) new MutationObserver(report).observe(document.body, attrs);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", report);
  } catch (e) {}
  report();
})();

// Picks light or dark before the page is drawn, so a visitor in dark mode never sees a white flash.
// It's a plain blocking script in <head> (an inline one would be blocked by the site's security
// policy). A choice saved with the header toggle wins; otherwise the device's setting decides.
// The React app takes over from here (src/store/ui-store.ts) and uses the same storage key.
(function () {
  var theme = "light";
  try {
    var saved = localStorage.getItem("ui-theme");
    if (saved === "light" || saved === "dark") theme = saved;
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) theme = "dark";
  } catch (error) {
    // Storage blocked (private mode): fall back to light.
  }
  document.documentElement.dataset.theme = theme;
  if (theme === "dark") {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", "#0f172a");
  }
})();

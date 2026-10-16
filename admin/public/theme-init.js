// Runs before first paint (classic script in <head>, no inline code needed under the CSP).
// Light is the default; dark applies only when the person chose it (src/lib/theme.ts). Only
// the theme and language preferences live in browser storage, never anything secret.
(function (root) {
  try {
    if (localStorage.getItem("solveit-admin-theme") === "dark") root.dataset.theme = "dark";
    var locale = localStorage.getItem("solveit-admin-locale");
    if (locale === "en" || locale === "id") root.lang = locale;
  } catch {
    // Storage blocked: stay on the light default.
  }
})(document.documentElement);

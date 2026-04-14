// Content script: lightweight monitoring + alert rail (cross-browser)
const api = typeof browser !== "undefined" ? browser : chrome;

let rail;

function ensureRail() {
  if (rail) return rail;
  rail = document.createElement("div");
  rail.style.position = "fixed";
  rail.style.right = "12px";
  rail.style.bottom = "12px";
  rail.style.zIndex = "2147483647";
  rail.style.display = "flex";
  rail.style.flexDirection = "column";
  rail.style.gap = "8px";
  document.documentElement.appendChild(rail);
  return rail;
}

function pushAlert(text, level = "info") {
  const host = ensureRail();
  const el = document.createElement("div");
  el.textContent = text;
  el.style.maxWidth = "320px";
  el.style.padding = "10px 12px";
  el.style.borderRadius = "12px";
  el.style.backdropFilter = "blur(10px)";
  el.style.background = "rgba(7, 11, 20, 0.8)";
  el.style.border = "1px solid rgba(255,255,255,0.12)";
  el.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
  el.style.fontSize = "12px";
  el.style.color = "rgba(255,255,255,0.9)";
  if (level === "warn") el.style.borderColor = "rgba(255,159,28,0.6)";
  if (level === "safe") el.style.borderColor = "rgba(0,212,165,0.6)";
  host.appendChild(el);
  setTimeout(() => el.remove(), 6500);
}

// MVP: show that the extension is alive and can monitor page changes.
pushAlert("Privora active on this page.", "safe");

// Basic event capture (future: send to backend for real-time checks)
window.addEventListener(
  "submit",
  () => {
    pushAlert("Form submit detected (monitoring).", "info");
  },
  true
);


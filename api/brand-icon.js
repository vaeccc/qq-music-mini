const paths = Object.freeze({
  16: "icons/qq-music-mini-16.png",
  32: "icons/qq-music-mini-32.png",
  128: "icons/qq-music-mini-128.png"
});

// Manifest icons are already decoded by the browser. Reusing them avoids
// attempting to rasterize user-provided SVG artwork in a service worker.
export async function applyBrandIcon() {
  await chrome.action.setIcon({ path: paths });
}

/**
 * Syncs a stable full-viewport height CSS variable for older browsers.
 * Uses load + orientation change only (not every resize) to avoid mobile
 * URL-bar show/hide jitter.
 */
function readViewportHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight;
}

function syncViewportHeight(): void {
  document.documentElement.style.setProperty("--height-full-js", `${readViewportHeight()}px`);
}

export function initViewportHeight(): void {
  syncViewportHeight();

  window.addEventListener("orientationchange", syncViewportHeight);

  let lastWidth = window.innerWidth;
  window.addEventListener("resize", () => {
    if (window.innerWidth !== lastWidth) {
      lastWidth = window.innerWidth;
      syncViewportHeight();
    }
  });
}

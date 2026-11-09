/** Scroll target of the history entry being restored (Astro's scrollend overwrites state.scrollY when it clamps). */
export const target = { y: 0 };

/** Called by an island once its saved state is rendered (SSR-safe: no top-level DOM). */
export function settle() {
  const root = document.documentElement;
  if (!root.hasAttribute("data-restoring")) return;
  scrollTo({ top: target.y, behavior: "instant" });
  root.removeAttribute("data-restoring");
}

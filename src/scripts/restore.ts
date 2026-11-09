// Back/forward: Astro restores scrollY before islands have rendered, so pages with
// islands hide [data-restore] until the island paints its saved state, then fade it in.
import { settle, target } from "@/utils/restore";

let traverse = false;

document.addEventListener("astro:before-preparation", e => {
  traverse = e.navigationType === "traverse";
  target.y = traverse ? (history.state?.scrollY ?? 0) : 0;
});
document.addEventListener("astro:before-swap", e => {
  if (traverse && e.newDocument.querySelector("[data-restore]"))
    e.newDocument.documentElement.setAttribute("data-restoring", "");
});
document.addEventListener("astro:page-load", () => {
  if (document.documentElement.hasAttribute("data-restoring"))
    setTimeout(settle, 1500);
});

import { registry } from "@/viz/registry";

let cleanups: (() => void)[] = [];

function vizKey(img: HTMLImageElement) {
  // Astro emits /_astro/<basename>.<hash>.<ext>
  const file = (img.getAttribute("src") ?? "").split("?")[0].split("/").pop();
  return Object.keys(registry).find(k => file?.startsWith(`${k}.`));
}

function init() {
  const imgs = document.querySelectorAll<HTMLImageElement>("#article img");
  const io = new IntersectionObserver(
    entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const img = e.target as HTMLImageElement;
        io.unobserve(img);
        const key = vizKey(img)!;
        Promise.all([registry[key](), import("svelte")])
          .then(([{ default: Viz }, { mount, unmount }]) => {
            const host = document.createElement("div");
            img.before(host);
            const inst = mount(Viz, { target: host });
            img.style.display = "none";
            cleanups.push(() => {
              unmount(inst);
              host.remove();
              img.style.display = "";
            });
          })
          .catch(() => {}); // GIF stays visible
      }
    },
    { rootMargin: "300px 0px" }
  );
  imgs.forEach(img => vizKey(img) && io.observe(img));
  cleanups.push(() => io.disconnect());
}

document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", () => {
  cleanups.forEach(fn => fn());
  cleanups = [];
});

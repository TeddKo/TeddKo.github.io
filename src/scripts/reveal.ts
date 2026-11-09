const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const native = CSS.supports("animation-timeline: view()");
const root = document.documentElement;

function revealFallback() {
  const els = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
  const vh = innerHeight;
  // Anything already on screen stays visible; only the rest starts hidden.
  els.forEach(el => {
    if (el.getBoundingClientRect().top < vh) el.classList.add("is-revealed");
  });
  root.classList.add("js-reveal");
  const io = new IntersectionObserver(
    entries =>
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-revealed");
        io.unobserve(e.target);
      }),
    { threshold: 0.1 }
  );
  els.forEach(el => io.observe(el));
}

function paintHighlight() {
  document.querySelectorAll<HTMLElement>(".hl").forEach(hl => {
    const words = [...hl.querySelectorAll(".hl-word")];
    const r = hl.getBoundingClientRect();
    const p = (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35);
    const n = Math.round(Math.min(1, Math.max(0, p)) * words.length);
    words.forEach((w, i) => w.classList.toggle("on", i < n));
  });
}

let scrollBound = false;
function highlightFallback() {
  if (!document.querySelector(".hl")) return root.classList.remove("js-hl");
  root.classList.add("js-hl");
  paintHighlight();
  if (scrollBound) return;
  scrollBound = true;
  let ticking = false;
  addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        paintHighlight();
        ticking = false;
      });
    },
    { passive: true }
  );
}

function countUp() {
  const els = [...document.querySelectorAll<HTMLElement>("[data-count]")];
  if (!els.length) return;
  const fmt = (el: HTMLElement, v: number) => {
    const d = Number(el.dataset.dec ?? 0);
    return v.toLocaleString("en-US", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
  };
  const showFinal = () =>
    els.forEach(el => (el.textContent = fmt(el, Number(el.dataset.count))));
  // Only stats below the fold start from `from`; the rest keep the server value.
  const below = els.filter(el => el.getBoundingClientRect().top > innerHeight);
  below.forEach(el => (el.textContent = fmt(el, Number(el.dataset.from ?? 0))));
  addEventListener("beforeprint", showFinal);
  const io = new IntersectionObserver(
    entries =>
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        const el = e.target as HTMLElement;
        const from = Number(el.dataset.from ?? 0);
        const to = Number(el.dataset.count);
        const t0 = performance.now();
        const step = (t: number) => {
          const k = Math.min(1, (t - t0) / 1600);
          const eased = 1 - Math.pow(1 - k, 4);
          el.textContent = fmt(el, from + (to - from) * eased);
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    { threshold: 0.6 }
  );
  below.forEach(el => io.observe(el));
}

// Re-initialise on every page, including ClientRouter navigations.
document.addEventListener("astro:page-load", () => {
  if (calm) return;
  if (!native) {
    revealFallback();
    highlightFallback();
  }
  countUp();
});

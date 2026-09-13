// Count-up animation for elements with [data-count-to].
// Supports data-decimals and data-suffix (e.g. " trillion").
function animate(el: HTMLElement) {
  const to = Number(el.dataset.countTo ?? "0");
  const decimals = Number(el.dataset.decimals ?? "0");
  const suffix = el.dataset.suffix ?? "";
  const dur = 1600;
  const start = performance.now();
  const fmt = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const tick = (t: number) => {
    const p = Math.min(1, (t - start) / dur);
    const eased = 1 - Math.pow(1 - p, 4);
    el.textContent = fmt.format(to * eased) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const els = document.querySelectorAll<HTMLElement>("[data-count-to]");

// Respect reduced motion: render final values immediately
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  for (const el of els) {
    const to = Number(el.dataset.countTo ?? "0");
    const decimals = Number(el.dataset.decimals ?? "0");
    const fmt = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    el.textContent = fmt.format(to) + (el.dataset.suffix ?? "");
  }
} else {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          animate(e.target as HTMLElement);
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.4 },
  );
  els.forEach((el) => io.observe(el));
}

// Count-up animation for elements with [data-count-to]
function animate(el) {
  const to = Number(el.dataset.countTo ?? "0");
  const dur = 1600;
  const start = performance.now();
  const fmt = new Intl.NumberFormat("en-US");
  const tick = (t) => {
    const p = Math.min(1, (t - start) / dur);
    const eased = 1 - Math.pow(1 - p, 4);
    el.textContent = fmt.format(Math.round(to * eased));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const els = document.querySelectorAll("[data-count-to]");
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        animate(e.target);
        io.unobserve(e.target);
      }
    }
  },
  { threshold: 0.4 },
);
els.forEach((el) => io.observe(el));

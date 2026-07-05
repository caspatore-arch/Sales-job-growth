import "./style.css";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ————— smooth scroll ————— */
const lenis = new Lenis({
  lerp: 0.09,
  smoothWheel: !reduceMotion,
});
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

/* ————— the film: scroll-scrubbed frame sequence ————— */
interface FrameManifest {
  count: number;
  prefix: string; // e.g. "/frames/frame_"
  pad: number; //    e.g. 4  -> frame_0001
  ext: string; //    e.g. "webp"
}

const canvas = document.getElementById("film") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const journey = document.getElementById("journey")!;

const film = {
  images: [] as (HTMLImageElement | undefined)[],
  loaded: [] as boolean[],
  count: 0,
  frame: 0, // fractional video position 0..count-1
  drawnIndex: -1,
};

function frameSrc(m: FrameManifest, i: number): string {
  return `${m.prefix}${String(i + 1).padStart(m.pad, "0")}.${m.ext}`;
}

function nearestLoaded(i: number): number {
  if (film.loaded[i]) return i;
  for (let d = 1; d < film.count; d++) {
    if (film.loaded[i - d]) return i - d;
    if (film.loaded[i + d]) return i + d;
  }
  return -1;
}

function drawCover(img: HTMLImageElement) {
  const cw = canvas.width;
  const ch = canvas.height;
  const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
}

function render(force = false) {
  const want = Math.round(film.frame);
  const idx = nearestLoaded(Math.max(0, Math.min(film.count - 1, want)));
  if (idx < 0) return;
  if (!force && idx === film.drawnIndex) return;
  const img = film.images[idx];
  if (!img) return;
  drawCover(img);
  film.drawnIndex = idx;
}

function sizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  render(true);
}
window.addEventListener("resize", sizeCanvas);

function loadFrame(m: FrameManifest, i: number): Promise<void> {
  if (film.images[i]) return Promise.resolve();
  const img = new Image();
  img.decoding = "async";
  film.images[i] = img;
  return new Promise((resolve) => {
    img.onload = () => {
      film.loaded[i] = true;
      if (Math.abs(i - Math.round(film.frame)) < 3) render(true);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = frameSrc(m, i);
  });
}

/** Load in coarse-to-fine passes so early scrubbing already works. */
async function loadAllFrames(m: FrameManifest) {
  const order: number[] = [];
  const seen = new Set<number>();
  for (const stride of [16, 4, 1]) {
    for (let i = 0; i < m.count; i += stride) {
      if (!seen.has(i)) {
        seen.add(i);
        order.push(i);
      }
    }
  }
  const CONCURRENCY = 8;
  let cursor = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < order.length) {
        const i = order[cursor++];
        await loadFrame(m, i);
      }
    })
  );
}

/* ————— mapping page progress → film progress —————
   The single 13s take moves through the home faster than the page
   scrolls, so we pin story moments to page landmarks: the film's
   arrival/living/visit/protected beats stay under the matching copy. */
const FILM_ANCHORS = [0, 0.31, 0.48, 0.78, 1]; // fractions of the film
let pageAnchors = [0, 0.35, 0.62, 0.85, 1]; //   fractions of the journey scroll

function computePageAnchors() {
  const vh = window.innerHeight;
  const total = journey.offsetHeight - vh;
  if (total <= 0) return;
  const bottomOf = (sel: string): number => {
    const el = journey.querySelector<HTMLElement>(sel);
    if (!el) return 0;
    let top = 0;
    let node: HTMLElement | null = el;
    while (node && node !== journey) {
      top += node.offsetTop;
      node = node.offsetParent as HTMLElement | null;
    }
    return Math.max(0, Math.min(1, (top + el.offsetHeight - vh) / total));
  };
  pageAnchors = [
    0,
    bottomOf(".beat-problem"),
    bottomOf(".beat-handle"),
    bottomOf(".beat-21"),
    1,
  ];
}

function filmProgress(p: number): number {
  for (let s = 0; s < pageAnchors.length - 1; s++) {
    const a = pageAnchors[s];
    const b = pageAnchors[s + 1];
    if (p <= b || s === pageAnchors.length - 2) {
      const t = b > a ? (p - a) / (b - a) : 1;
      return (
        FILM_ANCHORS[s] +
        Math.max(0, Math.min(1, t)) * (FILM_ANCHORS[s + 1] - FILM_ANCHORS[s])
      );
    }
  }
  return 1;
}

/* ————— progress rail ————— */
const rail = document.getElementById("rail")!;
const railFill = document.getElementById("rail-fill")!;
const stops = Array.from(rail.querySelectorAll<HTMLElement>(".rail-stop"));

function updateRail(fp: number) {
  railFill.style.height = `${(fp * 100).toFixed(2)}%`;
  const chapter = fp < 0.31 ? 0 : fp < 0.48 ? 1 : fp < 0.78 ? 2 : 3;
  stops.forEach((s, i) => s.classList.toggle("active", i === chapter));
}

/* ————— boot ————— */
async function boot() {
  sizeCanvas();

  let manifest: FrameManifest | null = null;
  try {
    const res = await fetch("/frames/manifest.json");
    if (res.ok) manifest = (await res.json()) as FrameManifest;
  } catch {
    manifest = null;
  }

  if (manifest && manifest.count > 0) {
    film.count = manifest.count;
    await loadFrame(manifest, 0);
    render(true);
    void loadAllFrames(manifest);
  } else {
    // graceful fallback: hold the poster while media assets are absent
    const poster = new Image();
    poster.onload = () => {
      film.images[0] = poster;
      film.loaded[0] = true;
      film.count = 1;
      render(true);
    };
    poster.src = "/media/poster.jpg";
  }

  computePageAnchors();

  ScrollTrigger.create({
    trigger: journey,
    start: "top top",
    end: "bottom bottom",
    onUpdate: (self) => {
      const fp = filmProgress(self.progress);
      if (film.count > 1) {
        film.frame = fp * (film.count - 1);
        render();
      }
      updateRail(fp);
    },
    onToggle: (self) => rail.classList.toggle("visible", self.isActive),
  });

  ScrollTrigger.addEventListener("refreshInit", computePageAnchors);

  /* rail contrast: cream panels vs film */
  rail.classList.add("on-film");
  document.querySelectorAll<HTMLElement>(".beat-panel").forEach((panel) => {
    ScrollTrigger.create({
      trigger: panel,
      start: "top 55%",
      end: "bottom 45%",
      onToggle: (self) => rail.classList.toggle("on-film", !self.isActive),
    });
  });

  /* header state */
  const header = document.getElementById("site-header")!;
  const setHeaderState = () =>
    header.classList.toggle("scrolled", (window.scrollY || 0) > 60);
  lenis.on("scroll", setHeaderState);
  window.addEventListener("scroll", setHeaderState, { passive: true });
  setHeaderState();

  /* text reveals pinned to scroll position */
  document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
    gsap.from(el, {
      opacity: 0,
      y: reduceMotion ? 0 : 36,
      duration: 1.1,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 82%" },
    });
  });

  /* the problem: one line per scroll step, fading through */
  document.querySelectorAll<HTMLElement>(".problem-line p").forEach((line, i, all) => {
    const last = i === all.length - 1;
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: line.parentElement,
        start: "top 70%",
        end: "bottom 45%",
        scrub: true,
      },
    });
    tl.fromTo(line, { opacity: 0, y: 60 }, { opacity: 1, y: 0, ease: "none" });
    if (!last) tl.to(line, { opacity: 0, y: -60, ease: "none" }, "+=0.35");
  });

  /* gentle parallax on marked elements */
  if (!reduceMotion) {
    document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
      const speed = parseFloat(el.dataset.parallax || "0.1");
      gsap.to(el, {
        yPercent: -100 * speed,
        ease: "none",
        scrollTrigger: {
          trigger: el.closest("section"),
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
    });
  }

  /* anchor links ride the smooth scroll */
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href")!;
      const target = id === "#top" ? document.body : document.querySelector(id);
      if (target) {
        e.preventDefault();
        lenis.scrollTo(target as HTMLElement, { offset: id === "#top" ? 0 : -80 });
      }
    });
  });
}

void boot();

// test hook: lets automated checks observe scrub state
(window as unknown as Record<string, unknown>).__film = film;
(window as unknown as Record<string, unknown>).__lenis = lenis;

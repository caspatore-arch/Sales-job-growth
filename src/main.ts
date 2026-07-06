import './style.css'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// ---------------------------------------------------------------------------
// Media — hosted on Higgsfield's CDN (generated cinematic assets)
// ---------------------------------------------------------------------------
const MEDIA = {
  heroPoster: 'https://d8j0ntlcm91z4.cloudfront.net/user_3G3CWRI9ds4ukRa5TYS4FK9qJ8j/hf_20260704_185713_3491b944-8be4-4c07-ad35-f4fa81edc9fa.png',
  heroOrbit: 'https://d8j0ntlcm91z4.cloudfront.net/user_3G3CWRI9ds4ukRa5TYS4FK9qJ8j/hf_20260704_190007_4a38ede1-2969-40ff-8bb6-8d6c90cdb954.mp4',
  macro: 'https://d8j0ntlcm91z4.cloudfront.net/user_3G3CWRI9ds4ukRa5TYS4FK9qJ8j/hf_20260704_190008_7306a14e-7b0c-4a50-80c5-1dea5c9c3ef5.mp4',
  exploded: 'https://d8j0ntlcm91z4.cloudfront.net/user_3G3CWRI9ds4ukRa5TYS4FK9qJ8j/hf_20260704_190011_8162c5c2-7e54-403c-9b89-6bb4b1adcbff.mp4',
  atmosphere: 'https://d8j0ntlcm91z4.cloudfront.net/user_3G3CWRI9ds4ukRa5TYS4FK9qJ8j/hf_20260704_190012_c35b3eaa-335f-47ce-9843-d6cb71ea4b00.mp4',
}

// Booking link — Nexus Implementations Stage 2 call
const CALENDLY = 'https://calendly.com/caspatore/nexus-stage-2-call'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <nav class="nav">
    <span class="nav__mark">NEXUS<span class="nav__mark-dot">/</span>IMPLEMENTATIONS</span>
    <a class="nav__cta" href="${CALENDLY}" target="_blank" rel="noopener">Book a Call</a>
  </nav>

  <section class="hero" id="hero">
    <div class="hero__stage">
      <video class="hero__video" src="${MEDIA.heroOrbit}" poster="${MEDIA.heroPoster}" muted playsinline preload="auto"></video>
      <div class="hero__scrim"></div>
    </div>
    <div class="hero__copy">
      <p class="eyebrow" data-reveal>Introducing the first autonomous orchestration engine</p>
      <h1 class="wordmark" data-track>NEXUS IMPLEMENTATIONS</h1>
      <p class="hero__product" data-reveal>THE CONDUIT</p>
      <p class="hero__sub" data-reveal>Every tool you own, one reasoning core. Deployed quietly. Tuned by hand.</p>
    </div>
    <div class="scroll-cue" data-reveal><span></span>Scroll</div>
  </section>

  <section class="story" id="story">
    <p class="story__eyebrow">Engineered in the Dark</p>
    <h2 class="story__line">We spent eighteen months on a product with no visible interface.</h2>
    <p class="story__body">No dashboards to admire. No screens to demo. Just an engine that reads your systems, decides, and acts &mdash; correctly, quietly, every time. The Conduit is the result of that obsession: the part of the stack you stop thinking about.</p>
  </section>

  <section class="macro" id="macro">
    <div class="macro__stage">
      <video class="macro__video" src="${MEDIA.macro}" muted playsinline preload="auto"></video>
      <div class="macro__scrim"></div>
    </div>
    <div class="macro__labels">
      <div class="macro__label" data-macro-label style="--x: 18%; --y: 28%;">
        <span class="macro__label-dot"></span>
        <span class="macro__label-text">Reasoning Core &mdash; decides what runs, and when</span>
      </div>
      <div class="macro__label" data-macro-label style="--x: 68%; --y: 42%;">
        <span class="macro__label-dot"></span>
        <span class="macro__label-text">Memory Lattice &mdash; every decision, recallable</span>
      </div>
      <div class="macro__label" data-macro-label style="--x: 40%; --y: 74%;">
        <span class="macro__label-dot"></span>
        <span class="macro__label-text">Tool Bus &mdash; native to your stack, not bolted on</span>
      </div>
    </div>
  </section>

  <section class="exploded" id="exploded">
    <div class="exploded__stage">
      <video class="exploded__video" src="${MEDIA.exploded}" muted playsinline preload="auto"></video>
      <div class="exploded__scrim"></div>
    </div>
    <div class="exploded__intro">
      <p class="eyebrow">Under the hood</p>
      <h2>Four components. One converged engine.</h2>
    </div>
    <div class="specs">
      <div class="spec" data-spec>
        <span class="spec__value">128-core</span>
        <span class="spec__label">inference mesh</span>
      </div>
      <div class="spec" data-spec>
        <span class="spec__value">42ms</span>
        <span class="spec__label">median decision latency</span>
      </div>
      <div class="spec" data-spec>
        <span class="spec__value">40+</span>
        <span class="spec__label">native tool integrations</span>
      </div>
      <div class="spec" data-spec>
        <span class="spec__value">99.98%</span>
        <span class="spec__label">autonomous uptime</span>
      </div>
    </div>
  </section>

  <section class="cohort" id="cohort">
    <video class="cohort__video" src="${MEDIA.atmosphere}" muted playsinline preload="auto" loop autoplay></video>
    <div class="cohort__scrim"></div>
    <div class="cohort__copy">
      <p class="eyebrow">Founding Cohort &mdash; 12 seats</p>
      <h2>We implement The Conduit ourselves, inside your stack.</h2>
      <p class="cohort__price">$18,000/mo &middot; 12-month engagement &middot; by application only</p>
    </div>
  </section>

  <section class="waitlist" id="waitlist">
    <p class="eyebrow">Apply for the founding cohort</p>
    <h2>Twelve seats. No demos, no decks.</h2>
    <form class="waitlist__form" data-waitlist-form>
      <input type="email" required placeholder="you@company.com" aria-label="Work email" />
      <button type="submit">Request Access</button>
    </form>
    <p class="waitlist__note" data-waitlist-note></p>
    <div class="waitlist__book">
      <span class="waitlist__book-or">or</span>
      <a class="waitlist__book-link" href="${CALENDLY}" target="_blank" rel="noopener">Book a Stage 2 call &rarr;</a>
    </div>
    <footer class="footer">
      <span>Nexus Implementations</span>
      <span>&copy; 2026. All systems, one core.</span>
    </footer>
  </section>
`

// ---------------------------------------------------------------------------
// Smooth scroll
// ---------------------------------------------------------------------------
const lenis = new Lenis({
  duration: 1.2,
  smoothWheel: true,
})

lenis.on('scroll', ScrollTrigger.update)

gsap.ticker.add((time) => {
  lenis.raf(time * 1000)
})
gsap.ticker.lagSmoothing(0)

// ---------------------------------------------------------------------------
// Hero: pinned scroll-scrub through the orbit video + text choreography
// ---------------------------------------------------------------------------
const heroVideo = document.querySelector<HTMLVideoElement>('.hero__video')!

function scrubVideo(video: HTMLVideoElement, progress: number) {
  if (!video.duration || Number.isNaN(video.duration)) return
  video.currentTime = Math.min(Math.max(progress, 0), 1) * video.duration
}

gsap.timeline({
  scrollTrigger: {
    trigger: '#hero',
    start: 'top top',
    end: '+=250%',
    pin: true,
    scrub: 0.4,
    onUpdate: (self) => scrubVideo(heroVideo, self.progress),
  },
})
  .fromTo(
    '.wordmark',
    { letterSpacing: '0.6em', opacity: 0 },
    { letterSpacing: '0.08em', opacity: 1, duration: 0.2 },
    0,
  )
  .to('[data-reveal]', { opacity: 1, y: 0, duration: 0.15, stagger: 0.05 }, 0.15)
  .to('.hero__copy', { opacity: 0, duration: 0.15 }, 0.75)
  .to('.scroll-cue', { opacity: 0, duration: 0.1 }, 0.05)

// ---------------------------------------------------------------------------
// Story: simple fade/rise reveal
// ---------------------------------------------------------------------------
gsap.from('.story__line, .story__body, .story__eyebrow', {
  opacity: 0,
  y: 24,
  duration: 0.8,
  stagger: 0.1,
  scrollTrigger: {
    trigger: '.story',
    start: 'top 70%',
  },
})

// ---------------------------------------------------------------------------
// Macro: pinned scrub through macro clip + sequential label callouts
// ---------------------------------------------------------------------------
const macroVideo = document.querySelector<HTMLVideoElement>('.macro__video')!
const macroLabels = gsap.utils.toArray<HTMLElement>('[data-macro-label]')

const macroTl = gsap.timeline({
  scrollTrigger: {
    trigger: '#macro',
    start: 'top top',
    end: '+=200%',
    pin: true,
    scrub: 0.4,
    onUpdate: (self) => scrubVideo(macroVideo, self.progress),
  },
})
macroLabels.forEach((label, i) => {
  const start = 0.15 + i * 0.25
  macroTl.to(label, { opacity: 1, duration: 0.15 }, start)
  macroTl.to(label, { opacity: 0, duration: 0.15 }, start + 0.22)
})

// ---------------------------------------------------------------------------
// Exploded: pinned scrub through exploded-assembly clip + spec reveals
// ---------------------------------------------------------------------------
const explodedVideo = document.querySelector<HTMLVideoElement>('.exploded__video')!
const specs = gsap.utils.toArray<HTMLElement>('[data-spec]')

const explodedTl = gsap.timeline({
  scrollTrigger: {
    trigger: '#exploded',
    start: 'top top',
    end: '+=250%',
    pin: true,
    scrub: 0.4,
    onUpdate: (self) => scrubVideo(explodedVideo, self.progress),
  },
})
explodedTl.to('.exploded__intro', { opacity: 1, y: 0, duration: 0.15 }, 0.02)
specs.forEach((spec, i) => {
  explodedTl.to(spec, { opacity: 1, y: 0, duration: 0.15 }, 0.35 + i * 0.12)
})

// ---------------------------------------------------------------------------
// Founding cohort atmosphere reveal
// ---------------------------------------------------------------------------
gsap.from('.cohort__copy', {
  opacity: 0,
  y: 30,
  duration: 0.9,
  scrollTrigger: {
    trigger: '.cohort',
    start: 'top 60%',
  },
})

// ---------------------------------------------------------------------------
// Waitlist form (demo submit)
// ---------------------------------------------------------------------------
const form = document.querySelector<HTMLFormElement>('[data-waitlist-form]')!
const note = document.querySelector<HTMLParagraphElement>('[data-waitlist-note]')!
form.addEventListener('submit', (e) => {
  e.preventDefault()
  note.innerHTML = 'Request received. Skip the queue &mdash; <a href="' + CALENDLY + '" target="_blank" rel="noopener">book a Stage 2 call</a>.'
  form.reset()
})

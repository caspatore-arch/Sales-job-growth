import './style.css'
import Lenis from 'lenis'

// Book-a-call / live demo link
const CALENDLY = 'https://calendly.com/caspatore/nexus-stage-2-call'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <nav class="nav">
    <a class="nav__mark" href="#top">Nexus<span class="nav__mark-dot"> </span>Implementations</a>
    <a class="nav__cta" href="${CALENDLY}" target="_blank" rel="noopener">Book a call</a>
  </nav>

  <header class="hero" id="top">
    <div class="hero__grid">
      <div class="hero__copy">
        <p class="eyebrow">Missed-call rescue for home service pros &middot; Marin County</p>
        <h1 class="hero__head">The call you just missed<br /><span class="hero__head-accent">already called someone else.</span></h1>
        <p class="hero__sub">About half the people who call you won't leave a voicemail. They call the next plumber on Google. We text every missed caller back in about 10 seconds, answer their question, and book the job &mdash; before your competitor picks up.</p>
        <div class="hero__actions">
          <a class="btn btn--primary" href="${CALENDLY}" target="_blank" rel="noopener">Watch it rescue a call on your own line</a>
          <a class="btn btn--ghost" href="#how">See how it works</a>
        </div>
        <p class="hero__note">Nothing about your day changes. Your phone still rings first. Setup is one forwarding code and a 10-minute form.</p>
      </div>

      <div class="phone" data-phone aria-hidden="true">
        <div class="phone__frame">
          <div class="phone__notch"></div>
          <div class="phone__screen" data-phone-screen>
            <div class="phone__status">
              <span data-phone-time>7:42</span>
              <span class="phone__signal">&#9679;&#9679;&#9679;&#9679;&#9679;</span>
            </div>
            <div class="phone__stage" data-phone-stage></div>
          </div>
        </div>
      </div>
    </div>
  </header>

  <section class="stats">
    <div class="stat">
      <span class="stat__value">~10 sec</span>
      <span class="stat__label">Every missed caller gets a text back</span>
    </div>
    <div class="stat">
      <span class="stat__value">~half</span>
      <span class="stat__label">Of callers never leave a voicemail</span>
    </div>
    <div class="stat">
      <span class="stat__value stat__value--money">5&times;</span>
      <span class="stat__label">The least you keep for every $1 you pay</span>
    </div>
  </section>

  <section class="how" id="how">
    <p class="eyebrow">How it works</p>
    <h2 class="section__head">Three steps. Then it runs in the background.</h2>
    <div class="steps">
      <div class="step" data-reveal>
        <span class="step__num">1</span>
        <h3>Your phone rings first.</h3>
        <p>Nothing changes. You answer like always. We only step in when a call goes unanswered.</p>
      </div>
      <div class="step" data-reveal>
        <span class="step__num">2</span>
        <h3>We text them back in seconds.</h3>
        <p>The missed caller gets a text from your own number, gets their question answered, and books the job.</p>
      </div>
      <div class="step" data-reveal>
        <span class="step__num">3</span>
        <h3>You see every job, with receipts.</h3>
        <p>Your dashboard shows calls rescued, jobs booked, and revenue recovered. Every line has a transcript.</p>
      </div>
    </div>
  </section>

  <section class="services" id="services">
    <p class="eyebrow">What it does</p>
    <h2 class="section__head">Every leak in your phone, plugged.</h2>
    <div class="cards">
      <div class="card" data-reveal>
        <div class="card__top"><h3>Missed-call rescue</h3><span class="tag tag--live">Available</span></div>
        <p>Every unanswered call gets a text back from your number in seconds. Most of them book instead of calling the next guy.</p>
      </div>
      <div class="card" data-reveal>
        <div class="card__top"><h3>Dead-lead revival</h3><span class="tag tag--live">Available</span></div>
        <p>Old quotes and no-shows get a friendly nudge that puts them back on your schedule &mdash; from a list you already paid for.</p>
      </div>
      <div class="card" data-reveal>
        <div class="card__top"><h3>Instant web-form reply</h3><span class="tag tag--live">Available</span></div>
        <p>Someone fills out the form on your site and hears back before they close the tab. No lead sits overnight.</p>
      </div>
      <div class="card" data-reveal>
        <div class="card__top"><h3>Ads that feed it</h3><span class="tag tag--live">Available</span></div>
        <p>We run the Google and local ads that put more calls into the system. Your ad spend stays on your card &mdash; never marked up.</p>
      </div>
      <div class="card" data-reveal>
        <div class="card__top"><h3>Voice AI</h3><span class="tag tag--soon">Coming soon</span></div>
        <p>An assistant that answers the phone in your voice when you can't get to it. Not ready yet &mdash; we'll tell you when it is.</p>
      </div>
    </div>
  </section>

  <section class="calc" id="calc">
    <div class="calc__intro">
      <p class="eyebrow">Run your own numbers</p>
      <h2 class="section__head">See what missed calls are costing you.</h2>
      <p class="calc__lead">We put our fee right in the math. That's the point &mdash; you should see it before you ever talk to us.</p>
    </div>
    <div class="calc__panel">
      <div class="calc__inputs">
        <label class="field">
          <span>Missed calls a week</span>
          <input type="range" min="1" max="40" value="10" data-calc-missed />
          <output data-calc-missed-out>10</output>
        </label>
        <label class="field">
          <span>Your average ticket</span>
          <input type="range" min="150" max="5000" step="50" value="600" data-calc-ticket />
          <output data-calc-ticket-out>$600</output>
        </label>
        <label class="field">
          <span>How often you'd close them</span>
          <input type="range" min="10" max="80" step="5" value="40" data-calc-close />
          <output data-calc-close-out>40%</output>
        </label>
      </div>
      <div class="calc__results">
        <div class="calc__big">
          <span class="calc__big-label">Revenue you're leaving on the table</span>
          <span class="calc__big-value" data-calc-revenue>$0<span class="calc__per">/mo</span></span>
        </div>
        <div class="calc__split">
          <div class="calc__split-item">
            <span class="calc__split-value calc__split-value--money" data-calc-keep>$0</span>
            <span class="calc__split-label">You keep</span>
          </div>
          <div class="calc__split-item">
            <span class="calc__split-value" data-calc-fee>$0</span>
            <span class="calc__split-label">Our fee (at the 5&times; floor)</span>
          </div>
        </div>
        <p class="calc__fine">Estimate, and real results vary. You only pay on jobs we actually book, and your fee is sized to your ticket when we talk.</p>
      </div>
    </div>
  </section>

  <section class="pricing" id="pricing">
    <p class="eyebrow">Pricing</p>
    <h2 class="section__head">Simple, and pointed at your profit.</h2>
    <ul class="pricing__list">
      <li data-reveal><strong>A small base plus a fee per booked job.</strong> Capped every month, so it never runs away from you.</li>
      <li data-reveal><strong>You only pay when a real job books.</strong> You keep at least $5 for every $1 you pay us. That's the floor, not the average.</li>
      <li data-reveal><strong>Month-to-month.</strong> Cancel anytime. Cancel within 24 hours of signing and you get a full credit.</li>
      <li data-reveal><strong>Ad spend is always on your card.</strong> Never marked up, never hidden.</li>
      <li data-reveal><strong>The per-job fee is sized to your average ticket.</strong> We set it together when we talk &mdash; no surprise line items.</li>
    </ul>
  </section>

  <section class="founder" id="founder">
    <div class="founder__inner">
      <p class="eyebrow">Who's behind it</p>
      <h2 class="founder__quote">&ldquo;I've knocked the doors. I built this because I watched good companies lose jobs they already paid for.&rdquo;</h2>
      <p class="founder__body">I run a home services company here in Marin, and I sold pest control door-to-door before that. Every missed call is a job you spent money to earn, walking to the competitor. So I built the system that catches them. I'll come to you and demo it on your own phone line. If it doesn't book jobs, you don't pay for it.</p>
      <p class="founder__sign">&mdash; Charlie, Nexus Implementations &middot; Marin County, CA</p>
    </div>
  </section>

  <section class="lead" id="demo">
    <div class="lead__inner">
      <p class="eyebrow">See it from the customer's side</p>
      <h2 class="section__head">Fill this out and time me.</h2>
      <p class="lead__sub">Drop your number and Charlie will text you back today, personally. That's the whole pitch &mdash; feel how fast it lands when you're the one who called.</p>
      <form class="lead__form" data-lead-form>
        <input type="text" name="name" placeholder="Your name" aria-label="Your name" required />
        <input type="tel" name="phone" placeholder="Your cell number" aria-label="Your cell number" required />
        <button type="submit" class="btn btn--primary">Text me the demo</button>
      </form>
      <p class="lead__note" data-lead-note></p>
      <p class="lead__consent">By submitting, you agree to receive a text about your demo. Reply STOP to opt out anytime. We never sell or share your number.</p>
      <p class="lead__or">Rather book a time? <a href="${CALENDLY}" target="_blank" rel="noopener">Grab a call &rarr;</a></p>
    </div>
  </section>

  <footer class="footer">
    <div class="footer__row">
      <span class="footer__brand">Nexus Implementations</span>
      <span>Marin County, CA</span>
      <a href="${CALENDLY}" target="_blank" rel="noopener">Book a call</a>
    </div>
    <p class="footer__legal">We only text people who've contacted a business or already work with it. No cold texts, ever. Reply STOP to opt out. We never sell your info.</p>
  </footer>
`

// ---------------------------------------------------------------------------
// Smooth scroll (reveals are CSS load animations — always end visible)
// ---------------------------------------------------------------------------
if (!reducedMotion) {
  const lenis = new Lenis({ duration: 1.1, smoothWheel: true })
  const raf = (time: number) => {
    lenis.raf(time)
    requestAnimationFrame(raf)
  }
  requestAnimationFrame(raf)
}

// ---------------------------------------------------------------------------
// Hero phone: looping missed-call -> text-back -> booked
// ---------------------------------------------------------------------------
const stage = document.querySelector<HTMLElement>('[data-phone-stage]')
const screen = document.querySelector<HTMLElement>('[data-phone-screen]')

type Beat = { html: string; screenClass?: string; hold: number }

const CALLER = '(415) 555-0142'

const beats: Beat[] = [
  {
    screenClass: 'is-calling',
    hold: 2200,
    html: `
      <div class="call">
        <div class="call__avatar">?</div>
        <p class="call__label">Incoming call</p>
        <p class="call__number">${CALLER}</p>
        <div class="call__dots"><span></span><span></span><span></span></div>
      </div>`,
  },
  {
    screenClass: 'is-missed',
    hold: 1600,
    html: `
      <div class="call call--missed">
        <div class="call__avatar call__avatar--missed">&#8600;</div>
        <p class="call__label call__label--missed">Missed call</p>
        <p class="call__number">${CALLER}</p>
      </div>`,
  },
  {
    screenClass: 'is-thread',
    hold: 2000,
    html: `
      <div class="thread">
        <p class="thread__who">You &middot; auto-text</p>
        <div class="bubble bubble--out">Hi, this is Marin Plumbing &mdash; sorry we missed your call! What can we help with?</div>
      </div>`,
  },
  {
    screenClass: 'is-thread',
    hold: 2200,
    html: `
      <div class="thread">
        <div class="bubble bubble--out is-sent">Hi, this is Marin Plumbing &mdash; sorry we missed your call! What can we help with?</div>
        <div class="bubble bubble--in">Water heater's leaking bad, can someone come today?</div>
      </div>`,
  },
  {
    screenClass: 'is-thread',
    hold: 2600,
    html: `
      <div class="thread">
        <div class="bubble bubble--out is-sent">Sorry we missed your call! What can we help with?</div>
        <div class="bubble bubble--in">Water heater's leaking bad, can someone come today?</div>
        <div class="bubble bubble--out">Absolutely &mdash; I've got you down for 2pm. Booking it now.</div>
      </div>`,
  },
  {
    screenClass: 'is-booked',
    hold: 2600,
    html: `
      <div class="booked">
        <div class="booked__check">&#10003;</div>
        <p class="booked__title">Job booked</p>
        <p class="booked__meta">Water heater &middot; today 2:00pm</p>
        <p class="booked__ticket">+ $600 recovered</p>
      </div>`,
  },
]

function runPhone() {
  if (!stage || !screen) return
  let i = 0
  const render = () => {
    const beat = beats[i]
    screen.className = 'phone__screen ' + (beat.screenClass || '')
    stage.innerHTML = beat.html
    i = (i + 1) % beats.length
    window.setTimeout(render, beat.hold)
  }
  render()
}

if (reducedMotion) {
  // Static, honest end-state: show the booked outcome
  if (stage && screen) {
    const last = beats[beats.length - 1]
    screen.className = 'phone__screen ' + (last.screenClass || '')
    stage.innerHTML = last.html
  }
} else {
  runPhone()
}

// Live clock in the phone status bar (cosmetic)
const timeEl = document.querySelector<HTMLElement>('[data-phone-time]')
if (timeEl) {
  const setTime = () => {
    const d = new Date()
    let h = d.getHours()
    const m = d.getMinutes().toString().padStart(2, '0')
    h = h % 12 || 12
    timeEl.textContent = `${h}:${m}`
  }
  setTime()
  window.setInterval(setTime, 30000)
}

// ---------------------------------------------------------------------------
// "Run your own numbers" calculator
// ---------------------------------------------------------------------------
const missedEl = document.querySelector<HTMLInputElement>('[data-calc-missed]')
const ticketEl = document.querySelector<HTMLInputElement>('[data-calc-ticket]')
const closeEl = document.querySelector<HTMLInputElement>('[data-calc-close]')

const missedOut = document.querySelector<HTMLOutputElement>('[data-calc-missed-out]')
const ticketOut = document.querySelector<HTMLOutputElement>('[data-calc-ticket-out]')
const closeOut = document.querySelector<HTMLOutputElement>('[data-calc-close-out]')

const revenueOut = document.querySelector<HTMLElement>('[data-calc-revenue]')
const keepOut = document.querySelector<HTMLElement>('[data-calc-keep]')
const feeOut = document.querySelector<HTMLElement>('[data-calc-fee]')

const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US')

function recalc() {
  if (!missedEl || !ticketEl || !closeEl) return
  const missed = Number(missedEl.value)
  const ticket = Number(ticketEl.value)
  const close = Number(closeEl.value) / 100

  const WEEKS_PER_MONTH = 4.33
  // Of the callers we text back, a share book at the owner's own close rate.
  const jobsPerMonth = missed * WEEKS_PER_MONTH * close
  const recovered = jobsPerMonth * ticket

  // At our 5x floor: for every $1 paid, the owner keeps $5. Fee = recovered / 6.
  const fee = recovered / 6
  const keep = recovered - fee

  if (missedOut) missedOut.textContent = String(missed)
  if (ticketOut) ticketOut.textContent = money(ticket)
  if (closeOut) closeOut.textContent = Number(closeEl.value) + '%'

  if (revenueOut) revenueOut.innerHTML = money(recovered) + '<span class="calc__per">/mo</span>'
  if (keepOut) keepOut.textContent = money(keep)
  if (feeOut) feeOut.textContent = money(fee)
}

;[missedEl, ticketEl, closeEl].forEach((el) => el?.addEventListener('input', recalc))
recalc()

// ---------------------------------------------------------------------------
// Lead form — personal-reply fallback (no automated backend promised yet)
// ---------------------------------------------------------------------------
const form = document.querySelector<HTMLFormElement>('[data-lead-form]')
const note = document.querySelector<HTMLElement>('[data-lead-note]')
form?.addEventListener('submit', (e) => {
  e.preventDefault()
  if (note) {
    note.textContent = "Got it — Charlie will text you back today, personally. Keep an eye on your phone."
    note.classList.add('is-shown')
  }
  form.reset()
})

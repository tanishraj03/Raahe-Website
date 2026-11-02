/* =========================================================
   Raahe.live - interaction layer
   Everything degrades gracefully: if JS fails, the page is
   still readable, and prefers-reduced-motion turns the
   movement off without removing content.
   ========================================================= */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

/* ---------------------------------------------------------
   0. Content
   Dates, photos, numbers, partners, team and links live in
   content.js, which the dashboard at /admin writes. This runs
   before everything else so the counters and marquees below
   pick up the new lists. If content.js is missing, the copy
   already in the HTML stays.
   --------------------------------------------------------- */
(function content () {
  let c = window.RAAHE_CONTENT;
  let drafts = {};

  // The dashboard's Preview button hands over an unpublished draft.
  if (new URLSearchParams(location.search).has('preview')) {
    try {
      const draft = JSON.parse(localStorage.getItem('raahe-preview') || 'null');
      if (draft) {
        c = draft.content;
        drafts = draft.images || {};
        const tag = document.createElement('div');
        tag.className = 'preview-tag mono';
        tag.textContent = 'Preview · not live yet';
        document.body.appendChild(tag);
      }
    } catch (e) {}
  }
  if (!c) return;

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    n.append(...kids);
    return n;
  };

  const image = (path, alt = '') => {
    const img = el('img', { src: drafts[path] || path, alt, loading: 'lazy' });
    img.onerror = () => img.remove();
    return img;
  };

  // A marquee loops by sliding one half of its track, so each half has to be
  // wider than the screen. Short lists repeat until they are long enough.
  const loop = (track, items, make) => {
    if (!track || !items || !items.length) return;
    const half = [];
    while (half.length < 8) half.push(...items);
    track.replaceChildren(...[...half, ...half].flatMap(make));
  };

  loop($('#disciplines'), c.disciplines, t => [el('span', {}, t), el('i', {}, '✳')]);
  loop($('#partners'), c.partners, t => [el('span', {}, t), el('i', {}, '·')]);
  loop($('#openmicPhotos'), c.photos && c.photos.openMic, p => el('figure', { class: 'shot' }, image(p)));
  loop($('#artistPhotos'), c.photos && c.photos.artists, p => el('figure', { class: 'shot' }, image(p)));

  // Plain numbers count up; anything else (like "#1") is shown as written.
  const number = (node, s) => {
    const value = String(s.value == null ? '' : s.value).trim();
    const prefix = s.prefix || '';
    const suffix = s.suffix || '';
    const counts = /^\d+(\.\d+)?$/.test(value);
    node.classList.toggle('fact__word', !counts);
    if (counts) {
      node.dataset.count = value;
      node.dataset.decimals = (value.split('.')[1] || '').length;
      node.dataset.prefix = prefix;
      node.dataset.suffix = suffix;
      node.textContent = prefix + '0' + suffix;
    } else {
      delete node.dataset.count;
      node.textContent = prefix + value + suffix;
    }
  };
  $$('#scores .score').forEach((row, i) => {
    const s = c.stats && c.stats[i];
    if (!s) return;
    number($('.score__num', row), s);
    $('p', row).textContent = s.label;
  });
  $$('#facts li').forEach((row, i) => {
    const s = c.openMicStats && c.openMicStats[i];
    if (!s) return;
    number($('b', row), s);
    $('span', row).textContent = s.label;
  });

  // Only ever link out to https pages, whatever ends up in content.js.
  const safe = (u) => (typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : '');
  const links = c.links || {};
  $$('[data-link]').forEach(a => { const u = safe(links[a.dataset.link]); if (u) a.href = u; });

  // The ticket card shows the soonest date that hasn't happened yet and lists
  // the next few under it. Once the last one passes it says a date is coming.
  const mic = c.openMic;
  const box = $('#nextMic');
  if (mic && box) {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const upcoming = (mic.events || [])
      .filter(e => e.date && e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
    const day = (date, opts) => new Date(date + 'T00:00').toLocaleDateString('en-GB', opts);
    const set = (sel, text) => { const n = $(sel, box); n.textContent = text || ''; n.hidden = !text; };
    const btn = $('.btn', box);
    const next = upcoming[0];

    if (next) {
      set('h3', day(next.date, { weekday: 'long', day: 'numeric', month: 'long' }) + (next.time ? ', ' + next.time : ''));
      set('.tickets__where', next.venue);
      set('.tickets__sub', mic.note);
      set('.tickets__more', upcoming.length > 1
        ? 'Also coming up: ' + upcoming.slice(1, 4).map(e => day(e.date, { weekday: 'short', day: 'numeric', month: 'short' })).join(' · ')
        : '');
      $('span', btn).textContent = mic.button || 'Grab your tickets';
      btn.href = safe(next.tickets) || safe(links.tickets) || btn.href;
    } else {
      set('h3', mic.noneTitle);
      set('.tickets__where', '');
      set('.tickets__sub', mic.noneNote);
      set('.tickets__more', '');
      $('span', btn).textContent = mic.noneButton || 'Follow on Instagram';
      btn.href = safe(mic.noneLink) || safe(links.instagram) || btn.href;
    }
  }

  const crew = $('#crew');
  if (crew && c.team && c.team.length) {
    crew.replaceChildren(...c.team.map(m => {
      const out = el('div', { class: 'member__links' });
      if (safe(m.linkedin))  out.append(el('a', { href: safe(m.linkedin),  target: '_blank', rel: 'noopener' }, 'LinkedIn'));
      if (safe(m.instagram)) out.append(el('a', { href: safe(m.instagram), target: '_blank', rel: 'noopener' }, 'Instagram'));
      return el('article', { class: 'member reveal' },
        el('div', { class: 'member__photo' }, ...(m.photo ? [image(m.photo, m.name)] : [])),
        el('div', { class: 'member__meta' },
          el('h3', {}, m.name || ''),
          el('p', { class: 'mono' }, m.role || ''),
          out));
    }));
  }
})();

/* ---------------------------------------------------------
   1. Load sequence
   --------------------------------------------------------- */
(function loader () {
  const el    = $('#loader');
  const count = $('#loaderCount');
  const bar   = $('#loaderBar');
  if (!el) return;

  const finish = () => {
    el.classList.add('is-done');
    document.body.classList.remove('is-locked');
    setTimeout(() => el.remove(), 1200);
    startHero();
  };

  if (REDUCED) { el.remove(); startHero(); return; }

  document.body.classList.add('is-locked');
  const duration = 1300;
  const t0 = performance.now();

  (function tick (now) {
    const p = Math.min((now - t0) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    count.textContent = String(Math.round(eased * 100)).padStart(2, '0');
    bar.style.width = (eased * 100) + '%';
    if (p < 1) requestAnimationFrame(tick);
    else setTimeout(finish, 160);
  })(t0);
})();

function startHero () {
  $$('.hero .line').forEach(l => l.closest('h1')?.classList.add('is-in'));
  $$('.hero .reveal').forEach((r, i) => setTimeout(() => r.classList.add('is-in'), 180 + i * 90));
  // The turntable may not be wired up yet when this runs straight away
  // (reduced motion skips the loader), so leave a flag as well as the event.
  document.documentElement.dataset.heroStarted = '1';
  document.dispatchEvent(new Event('hero:start'));
}

/* ---------------------------------------------------------
   1b. The turntable
   Press start: the platter spins up, then the arm lifts, swings
   over and drops the needle. Click again: the arm lifts back to
   its rest and the platter winds down. Speeds are real: 33⅓ rpm,
   up to speed in about half a second, a slower coast to a stop.
   --------------------------------------------------------- */
(function turntable () {
  const deck = $('#deck');
  if (!deck) return;
  const spin   = $('.deck__spin', deck);
  const wobble = $('.arm__wobble', deck);

  const PLAYING_DEG_PER_SEC = 33.333 * 360 / 60;
  const LIFT = 380;   // matches the .arm__lift transition
  const SWING = 1200; // matches the .deck__arm transition

  if (REDUCED) {
    // Needle on the record, nothing moving.
    deck.classList.add('is-playing');
    deck.title = '';
    return;
  }

  let angle = 0, speed = 0, target = 0, playing = false;
  let raf = 0, last = 0, onScreen = true, timers = [];

  function frame (now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const rate = target > speed ? 5 : 1.6;
    speed += (target - speed) * (1 - Math.exp(-rate * dt));
    angle = (angle + speed * dt) % 360;
    spin.style.transform = `rotate(${angle}deg)`;

    // A record is never perfectly flat; the arm rides the warp once a turn.
    const riding = playing && !deck.classList.contains('is-cueing');
    wobble.style.transform = riding ? `rotate(${Math.sin(angle * Math.PI / 180) * 0.3}deg)` : '';

    if (target === 0 && speed < 0.4) { speed = 0; raf = 0; return; }
    raf = onScreen && !document.hidden ? requestAnimationFrame(frame) : 0;
  }

  function run () {
    if (raf || !onScreen || document.hidden) return;
    if (target === 0 && speed === 0) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function later (ms, fn) { timers.push(setTimeout(fn, ms)); }

  function play (on) {
    timers.forEach(clearTimeout);
    timers = [];
    playing = on;
    deck.title = on ? 'Stop the record' : 'Play the record';

    if (on) {
      target = PLAYING_DEG_PER_SEC;
      run();
      // up to speed first, then cue the arm over
      later(450, () => deck.classList.add('is-cueing'));
      later(450 + LIFT, () => deck.classList.add('is-playing'));
      later(450 + LIFT + SWING, () => deck.classList.remove('is-cueing'));
    } else {
      deck.classList.add('is-cueing');
      later(LIFT, () => { deck.classList.remove('is-playing'); target = 0; run(); });
      later(LIFT + SWING, () => deck.classList.remove('is-cueing'));
    }
  }

  deck.addEventListener('click', () => play(!playing));

  // No point turning a record nobody can see.
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    run();
  }).observe(deck);
  document.addEventListener('visibilitychange', run);

  const start = () => later(700, () => play(true));
  if (document.documentElement.dataset.heroStarted) start();
  else document.addEventListener('hero:start', start, { once: true });
})();

/* ---------------------------------------------------------
   2. Scroll reveals (headings reveal line by line)
   --------------------------------------------------------- */
(function reveals () {
  const targets = $$('.reveal, .h2, .statement, .encore__title').filter(el => !el.closest('.hero'));
  if (!('IntersectionObserver' in window)) {
    targets.forEach(t => t.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

  targets.forEach(t => io.observe(t));
})();

/* ---------------------------------------------------------
   3. Number counters
   --------------------------------------------------------- */
(function counters () {
  const nums = $$('[data-count]');
  if (!nums.length) return;

  const run = (el) => {
    const target   = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const prefix   = el.dataset.prefix || '';
    const suffix   = el.dataset.suffix || '';

    if (REDUCED) {
      el.textContent = prefix + target.toFixed(decimals) + suffix;
      return;
    }

    const duration = 1600;
    const t0 = performance.now();
    (function tick (now) {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = prefix + target.toFixed(decimals) + suffix;
    })(t0);
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      run(e.target);
      io.unobserve(e.target);
    });
  }, { threshold: 0.4 });

  nums.forEach(n => io.observe(n));
})();

/* ---------------------------------------------------------
   4. Marquees - constant drift, nudged by scroll velocity
   --------------------------------------------------------- */
(function marquees () {
  const tracks = $$('[data-marquee]').map(el => ({
    el,
    speed: parseFloat(el.dataset.speed || '0.5'),
    dir:   parseFloat(el.dataset.dir || '-1'),
    x: 0,
    half: 0
  }));
  if (!tracks.length) return;

  const measure = () => tracks.forEach(t => { t.half = t.el.scrollWidth / 2; });
  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);

  if (REDUCED) return;

  let lastY = window.scrollY;
  let vel = 0;
  window.addEventListener('scroll', () => {
    vel += (window.scrollY - lastY) * 0.5;
    lastY = window.scrollY;
  }, { passive: true });

  (function frame () {
    vel *= 0.9;
    tracks.forEach(t => {
      if (!t.half) return;
      t.x += t.speed * t.dir - vel * 0.35;
      if (t.x <= -t.half) t.x += t.half;
      if (t.x >= 0)       t.x -= t.half;
      t.el.style.transform = `translate3d(${t.x}px,0,0)`;
    });
    requestAnimationFrame(frame);
  })();
})();

/* ---------------------------------------------------------
   5. Stage light follows the pointer
   --------------------------------------------------------- */
(function spotlight () {
  const el = $('#spotlight');
  if (!el || REDUCED) return;
  // no cursor, no stage light. Saves battery on phones too.
  if (!window.matchMedia('(hover:hover)').matches) { el.remove(); return; }

  let tx = innerWidth * 0.5, ty = innerHeight * 0.35;
  let cx = tx, cy = ty;
  let idle = true;

  window.addEventListener('pointermove', (e) => {
    idle = false;
    tx = e.clientX;
    ty = e.clientY;
  }, { passive: true });

  (function frame (now) {
    if (idle) {                                  // slow drift before any input
      tx = innerWidth  * (0.5 + Math.sin(now / 5200) * 0.22);
      ty = innerHeight * (0.4 + Math.cos(now / 6100) * 0.16);
    }
    cx += (tx - cx) * 0.07;
    cy += (ty - cy) * 0.07;
    el.style.setProperty('--mx', cx + 'px');
    el.style.setProperty('--my', cy + 'px');
    requestAnimationFrame(frame);
  })(0);
})();

/* ---------------------------------------------------------
   6. Nav: sticky background, hide on scroll down, mobile menu
   --------------------------------------------------------- */
(function nav () {
  const bar    = $('#nav');
  const burger = $('#burger');
  const menu   = $('#mobileMenu');
  let last = 0;

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    bar.classList.toggle('is-stuck', y > 40);
    const open = burger.getAttribute('aria-expanded') === 'true';
    bar.classList.toggle('is-hidden', y > 420 && y > last && !open);
    last = y;
  }, { passive: true });

  const setMenu = (open) => {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.hidden = !open;
    document.body.classList.toggle('is-locked', open);
  };

  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
})();

/* ---------------------------------------------------------
   7. Running order rail + stage-light gel per section
   --------------------------------------------------------- */
(function runningOrder () {
  const list     = $('#railList');
  const sections = $$('[data-slot]');
  const spot     = $('#spotlight');
  if (!list || !sections.length) return;

  const now = document.getElementById('railNow');

  sections.forEach(sec => {
    const li = document.createElement('li');
    li.innerHTML = '<i class="rail__tick"></i>';
    li.dataset.for = sec.dataset.slot;
    list.appendChild(li);
  });

  const items = $$('li', list);

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const slot = e.target.dataset.slot;
      const gel  = e.target.dataset.gel || 'pink';
      items.forEach(li => li.classList.toggle('is-on', li.dataset.for === slot));
      if (now) now.textContent = `${e.target.dataset.time} · ${e.target.dataset.name}`;
      document.documentElement.style.setProperty('--gel', `var(--${gel})`);
      if (spot) spot.style.setProperty('--gel', `var(--${gel})`);
    });
  }, { rootMargin: '-45% 0px -45% 0px' });

  sections.forEach(s => io.observe(s));
})();

/* ---------------------------------------------------------
   8. Magnetic buttons
   --------------------------------------------------------- */
(function magnets () {
  if (REDUCED || !window.matchMedia('(hover:hover)').matches) return;

  $$('.magnetic').forEach(el => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${dx * 0.18}px, ${dy * 0.28}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
})();

/* ---------------------------------------------------------
   9. Sign-up form
   No backend yet - this validates, then opens the visitor's
   mail app with everything filled in. Swap for a form service
   when you're ready (see README).
   --------------------------------------------------------- */
(function signup () {
  const form = $('#signup');
  const note = $('#signupNote');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data   = Object.fromEntries(new FormData(form));
    const name   = (data.name || '').trim();
    const email  = (data.email || '').trim();

    if (!name)  { note.textContent = 'Add your name so we know who we are talking to.'; return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { note.textContent = 'That email does not look right - check it and try again.'; return; }

    const subject = encodeURIComponent(`Raahe - ${data.intent} (${data.craft})`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\nCraft: ${data.craft}\nWants to: ${data.intent}\n\n`
    );
    note.textContent = `Thanks ${name.split(' ')[0]} - opening your mail app to send this over.`;
    window.location.href = `mailto:raahe.co@gmail.com?subject=${subject}&body=${body}`;
  });
})();

/* ---------------------------------------------------------
   10. Video sound toggle
   --------------------------------------------------------- */
(function film () {
  const v = $('#film');
  const b = $('#filmSound');
  if (!v || !b) return;

  const label = b.querySelector('span');

  b.addEventListener('click', () => {
    v.muted = !v.muted;
    if (!v.muted && v.paused) v.play().catch(() => {});
    b.setAttribute('aria-pressed', String(!v.muted));
    label.textContent = v.muted ? 'Sound on' : 'Sound off';
  });

  // Some browsers block muted autoplay in low power mode. Start it on first tap.
  v.play().catch(() => {
    document.addEventListener('pointerdown', () => v.play().catch(() => {}), { once: true });
  });
})();

/* ---------------------------------------------------------
   11. Small stuff
   --------------------------------------------------------- */
$('#year') && ($('#year').textContent = new Date().getFullYear());

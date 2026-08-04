/* =========================================================
   Raahe.co - interaction layer
   Everything degrades gracefully: if JS fails, the page is
   still readable, and prefers-reduced-motion turns the
   movement off without removing content.
   ========================================================= */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

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
}

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

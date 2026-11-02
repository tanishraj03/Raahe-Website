/* The Raahe dashboard. Talks only to /api on this site: the password check
   and the GitHub token stay on the server, so nothing secret reaches the browser. */

const RAW = 'https://raw.githubusercontent.com/tanishraj03/Raahe-Website/main/';

const $ = (s, c = document) => c.querySelector(s);

let state = null;   // what you're editing
let saved = '';     // what's live, as JSON, to tell when something changed
let fileSha = '';   // version of content.js you started from
let busy = false;
const uploads = new Map();   // path -> base64 of a new photo, sent on publish
const localImages = new Map(); // path -> data URL, so new photos show before the site redeploys
const blobIds = new Map();     // path -> id of a photo already uploaded, so a retry doesn't send it twice

/* ---------- small helpers ---------- */

function h (tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v;
    else if (k.includes('-')) n.setAttribute(k, v);
    else n[k] = v;
  }
  n.append(...kids.flat().filter(k => k != null && k !== false));
  return n;
}

function today () {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let toastTimer;
function toast (text, error = false) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.toggle('is-error', error);
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), error ? 7000 : 4000);
}

/* ---------- server ---------- */

async function api (path, body) {
  let res;
  try {
    res = await fetch('/api/' + path, body === undefined
      ? { cache: 'no-store', credentials: 'same-origin' }
      : { method: 'POST', cache: 'no-store', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (e) {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const err = new Error(data.error || `The server said ${res.status}. Try again in a minute.`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// Fill in anything an older or hand-edited content.js left out.
function normalise (c) {
  c.openMic = Object.assign({ events: [], note: '', button: '', noneTitle: '', noneNote: '', noneButton: '', noneLink: '' }, c.openMic);
  c.photos = Object.assign({ openMic: [], artists: [] }, c.photos);
  c.stats = c.stats || [];
  c.openMicStats = c.openMicStats || [];
  c.partners = c.partners || [];
  c.disciplines = c.disciplines || [];
  c.team = c.team || [];
  c.links = Object.assign({ tickets: '', program: '', volunteer: '', community: '', instagram: '' }, c.links);
  c.openMic.events.sort(byDate);
  return c;
}

const byDate = (a, b) => (a.date || '9999').localeCompare(b.date || '9999');

async function load () {
  const { content, sha } = await api('content');
  fileSha = sha;
  state = normalise(content);
  saved = JSON.stringify(state);
  render();
}

function photosInUse () {
  return new Set([...state.photos.openMic, ...state.photos.artists, ...state.team.map(m => m.photo)].filter(Boolean));
}

const SECTION_NAMES = {
  openMic: 'open mic dates', photos: 'photos', stats: 'numbers', openMicStats: 'numbers',
  partners: 'partners', disciplines: 'disciplines', team: 'team', links: 'links'
};

function commitMessage () {
  const before = JSON.parse(saved);
  const names = [...new Set(Object.keys(SECTION_NAMES)
    .filter(k => JSON.stringify(before[k]) !== JSON.stringify(state[k]))
    .map(k => SECTION_NAMES[k]))];
  const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0] || 'content';
  return `Update ${list} from the dashboard`;
}

// One commit with content.js plus any new photos, straight onto main.
async function publish () {
  setBusy(true, 'Publishing…');
  try {
    const used = photosInUse();
    const images = [];
    let n = 0;
    for (const [path, base64] of uploads) {
      if (!used.has(path)) continue;
      setBusy(true, `Uploading photo ${++n}…`);
      if (!blobIds.has(path)) blobIds.set(path, (await api('blob', { base64 })).sha);
      images.push({ path, sha: blobIds.get(path) });
    }

    setBusy(true, 'Publishing…');
    const body = { content: state, baseSha: fileSha, images, message: commitMessage() };
    let out;
    try {
      out = await api('publish', body);
    } catch (e) {
      if (e.status !== 409 || e.data.error !== 'conflict') throw e;
      if (!confirm('Someone else published changes after you opened the dashboard. Publishing now replaces them with what you have here.\n\nPress Cancel, then reload the page to start from their version instead.')) return;
      out = await api('publish', { ...body, force: true });
    }

    fileSha = out.sha;
    state = normalise(out.content);
    saved = JSON.stringify(state);
    uploads.clear();
    blobIds.clear();
    render();
    toast('Published. raahe.live updates in about a minute.');
  } catch (e) {
    if (e.status === 401) showLogin('You were signed out. Sign in again, your changes are still here.');
    else toast(e.message, true);
  } finally {
    setBusy(false);
  }
}

/* ---------- photos ---------- */

// Shrinks a photo to a web-friendly JPG before it goes anywhere.
async function prepare (file, kind, max) {
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch (e) { throw new Error(`Couldn't open ${file.name}. Try saving it as a JPG or PNG first.`); }
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = h('canvas', { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0E0E0E';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/jpeg', 0.82);
  const path = `images/${kind}-${today()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
  uploads.set(path, url.split(',')[1]);
  localImages.set(path, url);
  return path;
}

function picture (path, alt = '') {
  const img = h('img', { src: localImages.get(path) || '../' + path, alt, loading: 'lazy' });
  // A photo published from another device may not be on the live site yet.
  img.addEventListener('error', () => {
    if (!img.dataset.retried) { img.dataset.retried = '1'; img.src = RAW + path; }
  });
  return img;
}

async function addFiles (files, kind, max, onEach) {
  for (const f of files) {
    try { onEach(await prepare(f, kind, max)); }
    catch (e) { toast(e.message, true); }
  }
}

/* ---------- building blocks ---------- */

function field (label, obj, key, opts = {}) {
  const props = {
    value: obj[key] == null ? '' : obj[key],
    placeholder: opts.placeholder || '',
    oninput: e => { obj[key] = e.target.value; opts.oninput && opts.oninput(); changed(); },
    onchange: opts.onchange
  };
  let input;
  if (opts.multiline) input = h('textarea', { ...props, rows: 2 });
  else input = h('input', { type: opts.type || 'text', ...props });
  return h('label', { class: 'field' }, h('span', {}, label), input, opts.hint && h('small', {}, opts.hint));
}

function move (list, i, by) {
  const [item] = list.splice(i, 1);
  list.splice(i + by, 0, item);
}

/* ---------- sections ---------- */

function micSection () {
  const mic = state.openMic;
  const list = h('div');

  const draw = () => {
    mic.events.sort(byDate);
    const t = today();
    const next = mic.events.find(e => e.date && e.date >= t);
    const past = mic.events.filter(e => e.date && e.date < t);

    list.replaceChildren(...[
      mic.events.length ? null : h('p', { class: 'empty' }, 'No dates yet, so the site shows the "no date yet" message below.'),
      ...mic.events.map((ev, i) => {
        const isPast = ev.date && ev.date < t;
        return h('div', { class: 'event' + (ev === next ? ' is-next' : '') + (isPast ? ' is-past' : '') },
          h('span', { class: 'event__tag mono' },
            ev === next ? 'On the site now' : isPast ? 'Past · hidden' : ev.date ? 'Coming up' : 'Needs a date'),
          field('Date', ev, 'date', { type: 'date', onchange: draw }),
          field('Time', ev, 'time', { placeholder: '5 pm onwards' }),
          field('Venue', ev, 'venue', { placeholder: 'Starbucks, Vittal Mallya Road, Bengaluru' }),
          field('Ticket link', ev, 'tickets', { type: 'url', placeholder: 'Empty = main ticket link' }),
          h('button', { type: 'button', class: 'icon danger', title: 'Remove this date', 'aria-label': 'Remove this date',
            onclick: () => { mic.events.splice(i, 1); draw(); changed(); } }, '✕'));
      }),
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: () => {
          const last = mic.events[mic.events.length - 1];
          mic.events.push({ date: '', time: last ? last.time : '5 pm onwards', venue: last ? last.venue : '', tickets: '' });
          draw(); changed();
          list.querySelectorAll('input[type=date]')[mic.events.length - 1].focus();
        } }, '+ Add a date'),
        past.length ? h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: () => {
          mic.events = mic.events.filter(e => !(e.date && e.date < today()));
          draw(); changed();
        } }, `Clear ${past.length} past date${past.length > 1 ? 's' : ''}`) : null)
    
    ].filter(Boolean));
  };
  draw();

  return h('section', { class: 'card', id: 'sec-mic' },
    h('div', { class: 'card__head' },
      h('h2', {}, 'Next open mic'),
      h('p', {}, 'The pink ticket card in the Open mic section. Add as many dates as you like: the site shows the soonest one that hasn\'t happened yet and lists the next few under it. Past dates hide themselves the day after.')),
    list,
    h('div', { class: 'row' },
      field('Line under the date', mic, 'note', { multiline: true }),
      field('Button text', mic, 'button', { placeholder: 'Grab your tickets' })),
    h('details', {},
      h('summary', {}, 'When there\'s no upcoming date', h('small', {}, 'what the card says instead')),
      h('div', { class: 'row' },
        field('Heading', mic, 'noneTitle'),
        field('Line under it', mic, 'noneNote', { multiline: true }),
        field('Button text', mic, 'noneButton'),
        field('Button link', mic, 'noneLink', { type: 'url' })))
  );
}

function gallery (list, kind) {
  const wrap = h('div', { class: 'gallery' });
  const draw = () => {
    wrap.replaceChildren(
      ...list.map((p, i) => h('figure', { class: 'thumb' },
        picture(p),
        h('span', { class: 'thumb__num mono' }, String(i + 1).padStart(2, '0')),
        uploads.has(p) ? h('span', { class: 'thumb__new mono' }, 'New') : null,
        h('figcaption', {},
          h('button', { type: 'button', class: 'icon', title: 'Move earlier', 'aria-label': 'Move earlier', disabled: i === 0,
            onclick: () => { move(list, i, -1); draw(); changed(); } }, '←'),
          h('button', { type: 'button', class: 'icon', title: 'Move later', 'aria-label': 'Move later', disabled: i === list.length - 1,
            onclick: () => { move(list, i, 1); draw(); changed(); } }, '→'),
          h('button', { type: 'button', class: 'icon danger', title: 'Remove', 'aria-label': 'Remove photo',
            onclick: () => { list.splice(i, 1); draw(); changed(); } }, '✕')))),
      h('label', { class: 'thumb thumb--add' },
        h('input', { type: 'file', accept: 'image/*', multiple: true, onchange: async e => {
          const label = e.target.nextElementSibling;
          label.textContent = 'Preparing…';
          await addFiles([...e.target.files], kind, 1600, path => list.push(path));
          draw(); changed();
        } }),
        h('span', {}, '+ Add photos'))
    );
  };
  draw();
  return wrap;
}

function photosSection () {
  return h('section', { class: 'card', id: 'sec-photos' },
    h('div', { class: 'card__head' },
      h('h2', {}, 'Photos'),
      h('p', {}, 'The two strips of photos that scroll across the page, in this order. They\'re cropped to a portrait shape, so keep faces near the middle. Big photos are shrunk automatically before they upload.')),
    h('h3', {}, 'Open mic'),
    h('p', {}, 'The strip under "The Raahe Open Mic".'),
    gallery(state.photos.openMic, 'openmic'),
    h('h3', {}, 'Artists program'),
    h('p', {}, 'The strip under "the artists. program".'),
    gallery(state.photos.artists, 'artist')
  );
}

function numberRows (list) {
  return list.map(s => {
    const show = h('div', { class: 'number__show' });
    const update = () => { show.textContent = (s.prefix || '') + (s.value || '') + (s.suffix || ''); };
    update();
    return h('div', { class: 'number' },
      field('Before', s, 'prefix', { placeholder: '₹', oninput: update }),
      field('Number', s, 'value', { oninput: update }),
      field('After', s, 'suffix', { placeholder: '+', oninput: update }),
      field('What it means', s, 'label'));
  });
}

function numbersSection () {
  return h('section', { class: 'card', id: 'sec-numbers' },
    h('div', { class: 'card__head' },
      h('h2', {}, 'Numbers'),
      h('p', {}, 'Plain numbers count up when someone scrolls to them. Anything else, like #1, shows exactly as typed. Use "Before" and "After" for things like ₹ and L+.')),
    h('h3', {}, 'What we have done so far'),
    h('p', {}, 'The four big numbers in section 02.'),
    ...numberRows(state.stats),
    h('h3', {}, 'The open mic in numbers'),
    h('p', {}, 'The row of five in the Open mic section.'),
    ...numberRows(state.openMicStats)
  );
}

function chips (list, placeholder) {
  const wrap = h('div', { class: 'chips' });
  const draw = (focus) => {
    const input = h('input', { type: 'text', placeholder,
      onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); add(); } } });
    const add = () => {
      const v = input.value.trim();
      if (!v) return;
      list.push(v);
      draw(true); changed();
    };
    wrap.replaceChildren(
      ...list.map((t, i) => h('span', { class: 'chip' }, t,
        h('button', { type: 'button', class: 'icon', title: 'Remove', 'aria-label': `Remove ${t}`,
          onclick: () => { list.splice(i, 1); draw(); changed(); } }, '✕'))),
      h('span', { class: 'chip-add' }, input,
        h('button', { type: 'button', class: 'btn btn--small', onclick: add }, 'Add')));
    if (focus) input.focus();
  };
  draw();
  return wrap;
}

function listsSection () {
  return h('section', { class: 'card', id: 'sec-lists' },
    h('div', { class: 'card__head' },
      h('h2', {}, 'Partners and disciplines'),
      h('p', {}, 'The two scrolling bands of names.')),
    h('h3', {}, 'Rooms and brands we have worked with'),
    h('p', {}, 'Under the big numbers in section 02.'),
    chips(state.partners, 'Add a partner'),
    h('h3', {}, 'Disciplines'),
    h('p', {}, 'The band right under the headline at the top of the page.'),
    chips(state.disciplines, 'Add a discipline')
  );
}

function teamSection () {
  const list = h('div');
  const draw = () => {
    list.replaceChildren(
      ...state.team.map((m, i) => h('div', { class: 'person' },
        h('label', { class: 'avatar', title: 'Change photo' },
          m.photo ? picture(m.photo, m.name) : h('span', {}, '+ Photo'),
          h('input', { type: 'file', accept: 'image/*', onchange: async e => {
            await addFiles([...e.target.files].slice(0, 1), 'team', 900, path => { m.photo = path; });
            draw(); changed();
          } })),
        h('div', { class: 'person__fields' },
          field('Name', m, 'name'),
          field('Role', m, 'role', { placeholder: 'Founder · Community' }),
          field('LinkedIn', m, 'linkedin', { type: 'url', placeholder: 'Leave empty to hide' }),
          field('Instagram', m, 'instagram', { type: 'url', placeholder: 'Leave empty to hide' })),
        h('button', { type: 'button', class: 'icon danger', title: 'Remove', 'aria-label': `Remove ${m.name || 'this person'}`,
          onclick: () => {
            if (!confirm(`Take ${m.name || 'this person'} off the site?`)) return;
            state.team.splice(i, 1); draw(); changed();
          } }, '✕'))),
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: () => {
          state.team.push({ name: '', role: '', photo: '', linkedin: '', instagram: '' });
          draw(); changed();
        } }, '+ Add a person'))
    );
  };
  draw();
  return h('section', { class: 'card', id: 'sec-team' },
    h('div', { class: 'card__head' },
      h('h2', {}, 'Team'),
      h('p', {}, 'Section 07. Click a photo to change it.')),
    list
  );
}

function linksSection () {
  const L = state.links;
  return h('section', { class: 'card', id: 'sec-links' },
    h('div', { class: 'card__head' },
      h('h2', {}, 'Links'),
      h('p', {}, 'Where the main buttons go. Email links stay as they are.')),
    h('div', { class: 'links' },
      field('Tickets', L, 'tickets', { type: 'url', hint: 'The "Attend the open mic" button, and the ticket button when a date has no link of its own.' }),
      field('Artists program form', L, 'program', { type: 'url', hint: '"Apply to the program".' }),
      field('Volunteer form', L, 'volunteer', { type: 'url', hint: '"Volunteer with us".' }),
      field('Community', L, 'community', { type: 'url', hint: '"Join the community", the WhatsApp group.' }),
      field('Instagram', L, 'instagram', { type: 'url', hint: 'The Instagram icon in the nav and the footer link.' }))
  );
}

function render () {
  $('#sections').replaceChildren(micSection(), photosSection(), numbersSection(), listsSection(), teamSection(), linksSection());
  changed();
}

/* ---------- top bar ---------- */

const isDirty = () => state && JSON.stringify(state) !== saved;

function changed () {
  if (busy) return;
  const dirty = isDirty();
  const s = $('#status');
  s.textContent = dirty ? 'Unpublished changes' : 'Everything is live';
  s.classList.toggle('is-dirty', dirty);
  s.classList.remove('is-busy');
  $('#publish').disabled = !dirty;
  $('#discard').hidden = !dirty;
}

function setBusy (on, text) {
  busy = on;
  $('#publish').disabled = on;
  $('#preview').disabled = on;
  $('#discard').disabled = on;
  if (on) {
    $('#status').textContent = text;
    $('#status').classList.add('is-busy');
  } else {
    changed();
  }
}

$('#publish').addEventListener('click', publish);

$('#discard').addEventListener('click', () => {
  if (!confirm('Throw away everything you changed since the last publish?')) return;
  state = JSON.parse(saved);
  render();
});

$('#preview').addEventListener('click', () => {
  const images = {};
  photosInUse().forEach(p => { if (uploads.has(p)) images[p] = localImages.get(p); });
  try {
    localStorage.setItem('raahe-preview', JSON.stringify({ content: state, images }));
  } catch (e) {
    // Too many new photos for the browser's storage. Preview the rest anyway.
    localStorage.setItem('raahe-preview', JSON.stringify({ content: state, images: {} }));
    toast('Too many new photos to preview at once. They show as blank tiles until you publish.', true);
  }
  window.open('../index.html?preview', 'raahe-preview');
});

window.addEventListener('beforeunload', e => {
  if (isDirty()) { e.preventDefault(); e.returnValue = ''; }
});

/* ---------- sign in ---------- */

function showLogin (error) {
  $('#app').hidden = true;
  $('#login').hidden = false;
  $('#loginError').hidden = !error;
  $('#loginError').textContent = error || '';
  $('#userInput').focus();
}

function showApp () {
  $('#login').hidden = true;
  $('#app').hidden = false;
}

async function boot () {
  try {
    await load();
    showApp();
  } catch (e) {
    if (e.status === 401) return showLogin();
    showApp();
    $('#sections').replaceChildren(h('p', { class: 'loading' }, e.message));
    $('#status').textContent = 'Could not load';
  }
}

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('#loginBtn');
  btn.disabled = true;
  btn.textContent = 'Checking…';
  try {
    await api('login', { username: $('#userInput').value, password: $('#passInput').value });
    $('#passInput').value = '';
    $('#loginError').hidden = true;
    // Signed out mid-edit: carry on where you were instead of reloading.
    if (state) { showApp(); changed(); }
    else await boot();
  } catch (err) {
    showLogin(err.message);
    $('#passInput').select();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign in';
  }
});

$('#signOut').addEventListener('click', async () => {
  if (isDirty() && !confirm('You have unpublished changes. Sign out and lose them?')) return;
  try { await api('logout', {}); } catch (e) {}
  state = null;
  location.reload();
});

boot();

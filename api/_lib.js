/* Shared code for the dashboard's API. Files starting with _ are not
   turned into endpoints by Vercel.

   Secrets live in Vercel environment variables, never in this repo
   (it is public) and never in the browser:
     GITHUB_TOKEN         fine-grained token, Raahe-Website only, Contents read and write
     ADMIN_PASSWORD_HASH  made with: node scripts/admin-password.js            */

const crypto = require('crypto');

const REPO = 'tanishraj03/Raahe-Website';
const BRANCH = 'main';
const FILE = 'content.js';
const USERNAME = 'raahe.live';
const COOKIE = '__Host-raahe_admin';
const SESSION_DAYS = 7;

class HttpError extends Error {
  constructor (status, message) { super(message); this.status = status; }
}

function env (name) {
  const v = process.env[name];
  if (!v) throw new HttpError(500, `${name} is not set in Vercel's environment variables.`);
  return v;
}

/* ---------- responses ---------- */

function send (res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

// Wraps a handler: method check, same-origin check on writes, session check,
// and turns thrown errors into JSON without leaking internals.
function route (method, handler, { open = false } = {}) {
  return async (req, res) => {
    try {
      if (req.method !== method) throw new HttpError(405, 'Method not allowed.');
      if (method === 'POST') {
        // Browsers always send Origin on a cross-site POST. Only our own pages may write.
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const origin = req.headers.origin;
        if (!origin || !host || new URL(origin).host !== host) throw new HttpError(403, 'Not allowed from here.');
        if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new HttpError(415, 'Send JSON.');
        if (!req.body || typeof req.body !== 'object') throw new HttpError(400, 'Empty request.');
      }
      if (!open && !readSession(req)) throw new HttpError(401, 'Please sign in.');
      await handler(req, res);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500 && !(e instanceof HttpError)) console.error(e);
      send(res, status, { error: e instanceof HttpError ? e.message : 'Something went wrong on the server.' });
    }
  };
}

/* ---------- password ---------- */

// ADMIN_PASSWORD_HASH looks like scrypt:N:r:p:salt:hash (salt and hash in base64).
function hashPassword (password, salt = crypto.randomBytes(16), N = 32768, r = 8, p = 1) {
  const hash = crypto.scryptSync(String(password).normalize('NFC'), salt, 32, { N, r, p, maxmem: 128 * 1024 * 1024 });
  return ['scrypt', N, r, p, salt.toString('base64'), hash.toString('base64')].join(':');
}

function checkPassword (password) {
  const [algo, N, r, p, salt, hash] = env('ADMIN_PASSWORD_HASH').trim().split(':');
  if (algo !== 'scrypt' || !hash) throw new HttpError(500, 'ADMIN_PASSWORD_HASH is not in the right format.');
  const expected = Buffer.from(hash, 'base64');
  const got = crypto.scryptSync(String(password).normalize('NFC'), Buffer.from(salt, 'base64'), expected.length,
    { N: +N, r: +r, p: +p, maxmem: 128 * 1024 * 1024 });
  return crypto.timingSafeEqual(got, expected);
}

function sameText (a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

/* ---------- sessions ----------
   A cookie holding an expiry time and an HMAC of it. The key comes from both
   secrets, so changing the password or the token signs everyone out. */

function sign (text) {
  const key = crypto.createHash('sha256')
    .update('raahe-admin-session\0' + env('ADMIN_PASSWORD_HASH') + '\0' + env('GITHUB_TOKEN'))
    .digest();
  return crypto.createHmac('sha256', key).update(text).digest('base64url');
}

function sessionCookie () {
  const exp = String(Date.now() + SESSION_DAYS * 864e5);
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`;
}

function clearCookie () {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

function readSession (req) {
  const raw = String(req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='));
  if (!raw) return false;
  const [exp, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!exp || !sig || !/^\d+$/.test(exp) || +exp < Date.now()) return false;
  const want = Buffer.from(sign(exp));
  const have = Buffer.from(sig);
  return want.length === have.length && crypto.timingSafeEqual(want, have);
}

/* ---------- brute force ----------
   Best effort: counts failed sign-ins per IP on each running copy of the
   function. Every wrong guess also costs a second. */

const fails = new Map();
const WINDOW = 15 * 60 * 1000;
const MAX_FAILS = 5;

function tooMany (ip) {
  const f = fails.get(ip);
  if (!f || Date.now() - f.first > WINDOW) { fails.delete(ip); return false; }
  return f.count >= MAX_FAILS;
}

function failed (ip) {
  const f = fails.get(ip);
  if (!f || Date.now() - f.first > WINDOW) fails.set(ip, { first: Date.now(), count: 1 });
  else f.count++;
  if (fails.size > 5000) fails.clear();
}

function clientIp (req) {
  return String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

/* ---------- GitHub ---------- */

async function gh (path, opts = {}) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${env('GITHUB_TOKEN')}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'raahe-dashboard',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {})
    }
  });
  if (r.status === 401) throw new HttpError(502, 'GitHub rejected the token in Vercel (GITHUB_TOKEN). It may have expired.');
  if (r.status === 403 || r.status === 404) throw new HttpError(502, 'The GitHub token in Vercel cannot reach the repo, or content.js is missing.');
  if (r.status === 409 || r.status === 422) throw new HttpError(409, 'The site changed at the same moment. Reload the dashboard and publish again.');
  if (!r.ok) throw new HttpError(502, `GitHub returned ${r.status}. Try again in a minute.`);
  return r.json();
}

/* ---------- content ---------- */

function parseContentFile (text) {
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}

function serialise (c) {
  return `/* Site content: open mic dates, photos, numbers, partners, team and links.
   Written by the dashboard at raahe.live/admin. You can edit it by hand too,
   just keep everything after the = sign valid JSON. */
window.RAAHE_CONTENT = ${JSON.stringify(c, null, 2)};
`;
}

// Rebuilds the content from known fields only, so nothing unexpected
// (scripts, odd links, paths outside images/) can reach the live site.
function clean (c) {
  if (!c || typeof c !== 'object') throw new HttpError(400, 'Content is missing.');
  const text = (v, max = 300) => (typeof v === 'string' ? v : v == null ? '' : String(v)).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
  const list = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
  const link = (v, what) => {
    const s = text(v, 1000);
    if (s && !/^https:\/\/[^\s"'<>]+$/i.test(s)) throw new HttpError(400, `${what} has to be a full link starting with https://`);
    return s;
  };
  const photo = (v) => {
    const s = text(v, 200);
    if (s && !/^images\/[A-Za-z0-9_-][A-Za-z0-9._-]*\.(jpe?g|png|webp)$/.test(s)) throw new HttpError(400, 'One of the photos has a strange file name.');
    return s;
  };
  const date = (v) => {
    const s = text(v, 10);
    if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(400, 'One of the dates is not a real date.');
    return s;
  };
  const stat = (s) => ({ prefix: text(s && s.prefix, 6), value: text(s && s.value, 12), suffix: text(s && s.suffix, 6), label: text(s && s.label, 160) });

  const mic = c.openMic || {};
  const photos = c.photos || {};
  const links = c.links || {};
  return {
    openMic: {
      events: list(mic.events, 30).map(e => ({
        date: date(e && e.date), time: text(e && e.time, 60), venue: text(e && e.venue, 120), tickets: link(e && e.tickets, 'A ticket link')
      })),
      note: text(mic.note, 300),
      button: text(mic.button, 40),
      noneTitle: text(mic.noneTitle, 120),
      noneNote: text(mic.noneNote, 300),
      noneButton: text(mic.noneButton, 40),
      noneLink: link(mic.noneLink, 'The "no date" button link')
    },
    photos: {
      openMic: list(photos.openMic, 40).map(photo).filter(Boolean),
      artists: list(photos.artists, 40).map(photo).filter(Boolean)
    },
    stats: list(c.stats, 4).map(stat),
    openMicStats: list(c.openMicStats, 5).map(stat),
    partners: list(c.partners, 40).map(v => text(v, 60)).filter(Boolean),
    disciplines: list(c.disciplines, 40).map(v => text(v, 60)).filter(Boolean),
    team: list(c.team, 12).map(m => ({
      name: text(m && m.name, 80), role: text(m && m.role, 80), photo: photo(m && m.photo),
      linkedin: link(m && m.linkedin, 'A LinkedIn link'), instagram: link(m && m.instagram, 'An Instagram link')
    })),
    links: {
      tickets: link(links.tickets, 'The tickets link'),
      program: link(links.program, 'The artists program link'),
      volunteer: link(links.volunteer, 'The volunteer link'),
      community: link(links.community, 'The community link'),
      instagram: link(links.instagram, 'The Instagram link')
    }
  };
}

module.exports = {
  REPO, BRANCH, FILE, USERNAME, HttpError,
  send, route, hashPassword, checkPassword, sameText,
  sessionCookie, clearCookie, readSession,
  tooMany, failed, clientIp,
  gh, parseContentFile, serialise, clean
};

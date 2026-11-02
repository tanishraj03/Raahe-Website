// POST { username, password } -> sets the session cookie.
const { route, send, HttpError, USERNAME, checkPassword, sameText, sessionCookie, tooMany, failed, clientIp } = require('./_lib');

const wait = (ms) => new Promise(r => setTimeout(r, ms));

module.exports = route('POST', async (req, res) => {
  const ip = clientIp(req);
  if (tooMany(ip)) throw new HttpError(429, 'Too many wrong tries. Wait 15 minutes and try again.');

  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 200 || password.length > 200) {
    throw new HttpError(400, 'Enter a username and password.');
  }

  // Check both every time so a wrong username takes as long as a wrong password.
  const userOk = sameText(username.trim().toLowerCase(), USERNAME);
  const passOk = checkPassword(password);

  if (!(userOk && passOk)) {
    failed(ip);
    await wait(800 + Math.random() * 400);
    throw new HttpError(401, 'Wrong username or password.');
  }

  res.setHeader('Set-Cookie', sessionCookie());
  send(res, 200, { ok: true });
}, { open: true });

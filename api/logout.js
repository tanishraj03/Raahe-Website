// POST -> clears the session cookie.
const { route, send, clearCookie } = require('./_lib');

module.exports = route('POST', async (req, res) => {
  res.setHeader('Set-Cookie', clearCookie());
  send(res, 200, { ok: true });
}, { open: true });

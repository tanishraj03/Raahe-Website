// POST { base64 } -> uploads one photo to GitHub (not committed yet), returns its id.
// Photos go up one at a time to stay under Vercel's request size limit.
const { route, send, HttpError, gh } = require('./_lib');

const MAX_BYTES = 3 * 1024 * 1024;

module.exports = route('POST', async (req, res) => {
  const { base64 } = req.body;
  if (typeof base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new HttpError(400, 'That photo did not come through.');
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > MAX_BYTES) throw new HttpError(413, 'That photo is too big.');
  // The dashboard always sends JPEGs. Anything else is not a photo from it.
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8 || bytes[2] !== 0xFF) throw new HttpError(400, 'Only JPEG photos can be uploaded.');

  const blob = await gh('/git/blobs', { method: 'POST', body: JSON.stringify({ content: base64, encoding: 'base64' }) });
  send(res, 200, { sha: blob.sha });
});

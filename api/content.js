// GET -> the current content.js from GitHub, as data, plus its version.
const { route, send, HttpError, BRANCH, FILE, gh, parseContentFile } = require('./_lib');

module.exports = route('GET', async (req, res) => {
  const file = await gh(`/contents/${FILE}?ref=${BRANCH}`);
  let content;
  try {
    content = parseContentFile(Buffer.from(file.content, 'base64').toString('utf8'));
  } catch (e) {
    throw new HttpError(500, 'content.js on GitHub has a typo in it. Fix it in VS Code (it has to stay valid JSON) and reload.');
  }
  send(res, 200, { content, sha: file.sha });
});

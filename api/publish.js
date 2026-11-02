// POST { content, baseSha, images: [{ path, sha }], message, force }
// -> one commit on main with content.js and any new photos.
const { route, send, HttpError, BRANCH, FILE, gh, serialise, clean } = require('./_lib');

module.exports = route('POST', async (req, res) => {
  const { baseSha, images = [], message, force } = req.body;
  const content = clean(req.body.content);

  // New photos may only be added as images/<kind>-<date>-<id>.jpg, and only if the content uses them.
  const used = new Set([...content.photos.openMic, ...content.photos.artists, ...content.team.map(m => m.photo)]);
  if (!Array.isArray(images) || images.length > 60) throw new HttpError(400, 'Too many photos at once.');
  const tree = images.map(img => {
    if (!img || !/^images\/(openmic|artist|team)-\d{4}-\d{2}-\d{2}-[a-z0-9]{1,12}\.jpg$/.test(img.path) || !/^[0-9a-f]{40}$/.test(img.sha)) {
      throw new HttpError(400, 'One of the photos has a strange file name.');
    }
    return { path: img.path, mode: '100644', type: 'blob', sha: img.sha };
  }).filter(t => used.has(t.path));

  const ref = await gh(`/git/ref/heads/${BRANCH}`);
  const head = ref.object.sha;

  const current = await gh(`/contents/${FILE}?ref=${head}`);
  if (current.sha !== baseSha && !force) {
    return send(res, 409, { error: 'conflict' });
  }

  const commit = await gh(`/git/commits/${head}`);
  tree.push({ path: FILE, mode: '100644', type: 'blob', content: serialise(content) });
  const newTree = await gh('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: commit.tree.sha, tree }) });

  const title = (typeof message === 'string' ? message : '').replace(/[\r\n]+/g, ' ').trim().slice(0, 120) || 'Update content from the dashboard';
  const newCommit = await gh('/git/commits', {
    method: 'POST', body: JSON.stringify({ message: title, tree: newTree.sha, parents: [head] })
  });
  // Not forced: if someone pushed in the last second, GitHub refuses rather than losing their work.
  await gh(`/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: newCommit.sha, force: false }) });

  send(res, 200, { sha: newTree.tree.find(e => e.path === FILE).sha, content });
});

// Makes the value for ADMIN_PASSWORD_HASH in Vercel.
// Run: node scripts/admin-password.js   then type the new password.
// The password itself is never stored anywhere, only this hash.
const readline = require('readline');
const { hashPassword } = require('../api/_lib');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('New dashboard password: ', (pw) => {
  rl.close();
  if (pw.length < 12) { console.error('Use at least 12 characters.'); process.exit(1); }
  console.log('\nPaste this into Vercel as ADMIN_PASSWORD_HASH, then redeploy:\n');
  console.log(hashPassword(pw));
});

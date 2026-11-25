// Keeps the site running in the background on this Mac, starting at login.
//   node scripts/install-mac.js            install and start
//   node scripts/install-mac.js --dry-run  show what would happen
//   node scripts/install-mac.js --remove   stop and uninstall (saved editions are kept)
// macOS blocks background programs from reading Desktop, so the site is copied to Application Support.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const LABEL = 'local.daily-brief';
const SRC = join(import.meta.dirname, '..');
const APP = join(homedir(), 'Library', 'Application Support', 'Daily Brief');
const PLIST = join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
const domain = `gui/${process.getuid()}`;
const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(join(APP, 'server.js'))}</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>${xml(join(APP, 'server.log'))}</string>
  <key>StandardErrorPath</key><string>${xml(join(APP, 'server.log'))}</string>
</dict></plist>
`;

if (process.argv.includes('--dry-run')) {
  console.log(plist);
  process.exit();
}
try { execFileSync('launchctl', ['bootout', `${domain}/${LABEL}`], { stdio: 'ignore' }); } catch { /* not installed yet */ }
if (process.argv.includes('--remove')) {
  rmSync(PLIST, { force: true });
  console.log('Removed the background service.');
  process.exit();
}
mkdirSync(APP, { recursive: true });
for (const f of ['package.json', 'server.js', 'lib', 'public', 'scripts']) cpSync(join(SRC, f), join(APP, f), { recursive: true });
try { cpSync(join(SRC, 'data'), join(APP, 'data'), { recursive: true, force: false }); } catch { /* no editions yet */ }
mkdirSync(join(homedir(), 'Library', 'LaunchAgents'), { recursive: true });
writeFileSync(PLIST, plist);
execFileSync('launchctl', ['bootstrap', domain, PLIST], { stdio: 'inherit' });
console.log('Installed. Open http://localhost:5170');

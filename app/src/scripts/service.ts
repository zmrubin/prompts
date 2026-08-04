import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join, resolve } from 'node:path'
import { PORT, baseUrl } from '@/lib/config'

/**
 * Installs the dashboard as a background service so it is simply always
 * there, plus a daily metrics refresh.
 *
 *   npm run install-service
 *   npm run uninstall-service
 *
 * Nothing is written silently — every path is printed, along with how to
 * undo it.
 */
const ROOT = resolve(import.meta.dirname, '../..')

/**
 * A service unit runs with a bare environment, so `npm` has to be an absolute
 * path. Ask the shell where it actually is rather than assuming it sits next
 * to the node binary — with nvm, volta or homebrew it often does not.
 */
function npmPath(): string {
  try {
    const found = execFileSync('command', ['-v', 'npm'], {
      encoding: 'utf8',
      shell: '/bin/sh',
    }).trim()
    if (found) return found
  } catch {
    // Fall through to the sibling-of-node guess.
  }
  return process.execPath.replace(/node$/, 'npm')
}

const NPM = npmPath()
const LABEL_APP = 'dev.pragent.dashboard'
const LABEL_REFRESH = 'dev.pragent.refresh'

const uninstall = process.argv.includes('--uninstall')
const os = platform()

function plist(label: string, args: string[], daily = false): string {
  const schedule = daily
    ? '  <key>StartCalendarInterval</key>\n  <dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>'
    : '  <key>KeepAlive</key>\n  <true/>\n  <key>RunAtLoad</key>\n  <true/>'
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
${args.map((a) => `    <string>${a}</string>`).join('\n')}
  </array>
  <key>WorkingDirectory</key>
  <string>${ROOT}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PRAGENT_PORT</key>
    <string>${PORT}</string>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
  </dict>
${schedule}
  <key>StandardErrorPath</key>
  <string>${join(ROOT, 'data', `${label}.log`)}</string>
</dict>
</plist>
`
}

function unit(desc: string, args: string[]): string {
  return `[Unit]
Description=${desc}

[Service]
Type=simple
WorkingDirectory=${ROOT}
Environment=PRAGENT_PORT=${PORT}
ExecStart=${args.join(' ')}
Restart=on-failure

[Install]
WantedBy=default.target
`
}

function timer(desc: string): string {
  return `[Unit]
Description=${desc}

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
`
}

function macos() {
  const dir = join(homedir(), 'Library', 'LaunchAgents')
  const app = join(dir, `${LABEL_APP}.plist`)
  const refresh = join(dir, `${LABEL_REFRESH}.plist`)

  if (uninstall) {
    for (const [label, path] of [
      [LABEL_APP, app],
      [LABEL_REFRESH, refresh],
    ]) {
      try {
        execFileSync('launchctl', ['unload', path], { stdio: 'ignore' })
      } catch {
        // Not loaded; removing the file is enough.
      }
      rmSync(path, { force: true })
      console.log(`  Removed ${path}`)
      void label
    }
    return
  }

  mkdirSync(dir, { recursive: true })
  mkdirSync(join(ROOT, 'data'), { recursive: true })
  writeFileSync(app, plist(LABEL_APP, [NPM, 'run', 'start']))
  writeFileSync(refresh, plist(LABEL_REFRESH, [NPM, 'run', 'refresh'], true))
  console.log(`  Wrote ${app}`)
  console.log(`  Wrote ${refresh}`)

  for (const p of [app, refresh]) {
    try {
      execFileSync('launchctl', ['unload', p], { stdio: 'ignore' })
    } catch {
      // First install; nothing to unload.
    }
    execFileSync('launchctl', ['load', p], { stdio: 'inherit' })
  }
  console.log('\n  Loaded. The dashboard restarts at login and stats refresh daily at 09:00.')
}

function linux() {
  const dir = join(homedir(), '.config', 'systemd', 'user')
  const app = join(dir, 'pragent-dashboard.service')
  const refreshSvc = join(dir, 'pragent-refresh.service')
  const refreshTimer = join(dir, 'pragent-refresh.timer')

  if (uninstall) {
    for (const u of ['pragent-refresh.timer', 'pragent-dashboard.service']) {
      try {
        execFileSync('systemctl', ['--user', 'disable', '--now', u], { stdio: 'ignore' })
      } catch {
        // Not enabled; removing the unit is enough.
      }
    }
    for (const p of [app, refreshSvc, refreshTimer]) {
      rmSync(p, { force: true })
      console.log(`  Removed ${p}`)
    }
    return
  }

  mkdirSync(dir, { recursive: true })
  writeFileSync(app, unit('PR Agent dashboard', [NPM, 'run', 'start']))
  writeFileSync(refreshSvc, unit('PR Agent metrics refresh', [NPM, 'run', 'refresh']))
  writeFileSync(refreshTimer, timer('PR Agent daily metrics refresh'))
  console.log(`  Wrote ${app}`)
  console.log(`  Wrote ${refreshSvc}`)
  console.log(`  Wrote ${refreshTimer}`)

  try {
    execFileSync('systemctl', ['--user', 'daemon-reload'], { stdio: 'inherit' })
    execFileSync('systemctl', ['--user', 'enable', '--now', 'pragent-dashboard.service'], {
      stdio: 'inherit',
    })
    execFileSync('systemctl', ['--user', 'enable', '--now', 'pragent-refresh.timer'], {
      stdio: 'inherit',
    })
    console.log('\n  Enabled. The dashboard runs on login and stats refresh daily.')
  } catch {
    console.log('\n  Unit files are written, but systemctl could not enable them here.')
    console.log('  Finish with:')
    console.log('    systemctl --user daemon-reload')
    console.log('    systemctl --user enable --now pragent-dashboard.service')
    console.log('    systemctl --user enable --now pragent-refresh.timer')
  }
}

console.log(uninstall ? '\n  Removing the PR Agent services…\n' : '\n  Installing PR Agent as a background service…\n')

if (os === 'darwin') macos()
else if (os === 'linux') linux()
else {
  console.log(`  No service integration for ${os}.`)
  console.log(`  Run it yourself with:  npm run start   (serves ${baseUrl()})`)
  process.exit(1)
}

if (!uninstall) {
  console.log(`\n  Dashboard: ${baseUrl()}`)
  console.log('  Undo with: npm run uninstall-service\n')
} else {
  console.log('\n  Done.\n')
}

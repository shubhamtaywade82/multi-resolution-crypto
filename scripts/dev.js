import { spawn } from 'node:child_process';

const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function log(prefix, color, data) {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    if (line.trim()) console.log(`${color}${BOLD}[${prefix}]${RESET} ${line}`);
  }
}

function runService(cmd, args, prefix, color) {
  const child = spawn(cmd, args, { stdio: ['inherit', 'pipe', 'pipe'], shell: true });
  child.stdout.on('data', (d) => log(prefix, color, d));
  child.stderr.on('data', (d) => log(prefix, color, d));
  child.on('error', (err) => console.error(`${color}[${prefix}] error:${RESET}`, err.message));
  return child;
}

console.log(`${BOLD}🚀 Launching Multi-Resolution Crypto Cockpit...${RESET}`);
console.log(`• Backend Engine:   http://localhost:8765`);
console.log(`• UI Terminal:      http://localhost:5173\n`);

const serverProc = runService('npx', ['tsx', 'server/server.ts'], 'server', CYAN);
const uiProc = runService('npm', ['--prefix', 'ui', 'run', 'dev'], 'ui', MAGENTA);

// Graceful tear down of child processes on exit or interrupt
function cleanup() {
  serverProc.kill('SIGINT');
  uiProc.kill('SIGINT');
}

process.on('SIGINT', () => {
  console.log(`\n${BOLD}Shutting down all services...${RESET}`);
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

process.on('exit', cleanup);

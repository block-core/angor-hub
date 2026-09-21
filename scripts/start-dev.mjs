import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const project = resolve(root, process.env.ANGOR_BLAZOR_PROJECT
  || '../angor-blazor/src/webapp/Angor.Client/Angor.Client.csproj');
const localDotnet = join(homedir(), '.local/share/angor-dotnet/dotnet');
const dotnet = process.env.ANGOR_DOTNET
  || (existsSync(join(dirname(localDotnet), 'sdk')) ? localDotnet : 'dotnet');

if (!existsSync(project)) {
  console.error(`Blazor project not found: ${project}\nSet ANGOR_BLAZOR_PROJECT to its .csproj path, or use npm run start:hub.`);
  process.exit(1);
}

const children = new Set();
let stopping = false;
let forceStop;

function signalChildren(signal) {
  for (const child of children) {
    if (!child.pid) continue;
    try {
      // Include the Angular and dotnet watch subprocesses in shutdown.
      if (process.platform === 'win32') child.kill(signal);
      else process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') console.error(error.message);
    }
  }
}

function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  signalChildren('SIGTERM');
  forceStop = setTimeout(() => signalChildren('SIGKILL'), 5000);
  forceStop.unref();
}

function launch(name, command, args, env = process.env) {
  const child = spawn(command, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  });
  children.add(child);
  child.on('error', error => {
    console.error(`${name} could not start: ${error.message}`);
    stop(1);
  });
  child.on('close', code => {
    if (!stopping) {
      console.error(`${name} stopped; shutting down development servers.`);
      stop(code || 1);
    }
    children.delete(child);
    if (!children.size) clearTimeout(forceStop);
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

console.log('Starting Hub at http://localhost:4200 and Blazor at http://localhost:5062.');
console.log('Press Ctrl+C to stop both servers.');
launch('Blazor', dotnet, [
  'watch', '--project', project, '--non-interactive',
  'run', '--launch-profile', 'http', '--urls', 'http://localhost:5062',
], {
  ...process.env,
  ...(dotnet.includes('/') ? { DOTNET_ROOT: dirname(dotnet) } : {}),
  DOTNET_WATCH_SUPPRESS_LAUNCH_BROWSER: '1',
});
launch('Hub', process.execPath, [
  join(root, 'node_modules/@angular/cli/bin/ng.js'), 'serve', ...process.argv.slice(2),
]);

/**
 * Run analysis (Python) tests.
 * Prefer `uv run pytest` (CI / Docker). Fall back to `python -m pytest` when uv is absent.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../apps/analysis');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  return result.status ?? 1;
}

function commandExists(command) {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(probe, [command], {
    stdio: 'ignore',
    shell: true,
  });
  return result.status === 0;
}

if (commandExists('uv')) {
  process.exit(run('uv', ['run', 'pytest']));
}

console.warn('[analysis] uv が見つからないため `python -m pytest` にフォールバックします');
process.exit(run('python', ['-m', 'pytest']));

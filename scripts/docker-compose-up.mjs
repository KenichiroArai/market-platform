#!/usr/bin/env node
/**
 * docker compose up のラッパー。
 * ビルド・起動の途中経過と、全サービス healthy 確認後のサマリーを表示する。
 *
 * 用法:
 *   node scripts/docker-compose-up.mjs           # ビルド + 起動 + ヘルス確認 + ログ追跡
 *   node scripts/docker-compose-up.mjs -d        # ビルド + 起動 + ヘルス確認のみ
 *   node scripts/docker-compose-up.mjs --no-build
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SERVICE_ORDER = [
  { key: 'postgres', label: 'PostgreSQL' },
  { key: 'analysis', label: 'Analysis API (FastAPI)' },
  { key: 'api', label: 'Web API (NestJS)' },
  { key: 'web', label: 'Web (Next.js)' },
];

const DEFAULT_PORTS = {
  POSTGRES_PORT: '5432',
  API_PORT: '3001',
  WEB_PORT: '3000',
  ANALYSIS_PORT: '8000',
};

function loadPorts() {
  const ports = { ...DEFAULT_PORTS };
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    return ports;
  }

  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (key in ports) {
      ports[key] = trimmed.slice(eq + 1).trim();
    }
  }

  return ports;
}

function dockerCompose(args, opts = {}) {
  return spawnSync('docker', ['compose', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...opts,
  });
}

function printStep(step, total, message) {
  console.log(`\n[${step}/${total}] ${message}`);
}

function getHealth(service) {
  const healthResult = dockerCompose(['ps', '--format', '{{.Health}}', service]);
  if (healthResult.status !== 0) {
    return 'unknown';
  }

  const health = (healthResult.stdout || '').trim().split('\n')[0] ?? '';
  if (health === 'healthy') {
    return 'healthy';
  }
  if (health === 'unhealthy') {
    return 'unhealthy';
  }

  const stateResult = dockerCompose(['ps', '--format', '{{.State}}', service]);
  const state = (stateResult.stdout || '').trim().split('\n')[0] ?? '';
  if (state !== 'running') {
    return 'starting';
  }

  return health || 'starting';
}

async function waitHealthy(service, maxSeconds) {
  const deadline = Date.now() + maxSeconds * 1000;
  let waited = 0;

  while (Date.now() < deadline) {
    const status = getHealth(service);
    if (status === 'healthy') {
      return true;
    }
    if (status === 'unhealthy') {
      return false;
    }

    await sleep(2000);
    waited += 2;
    if (waited % 10 === 0) {
      console.log(`    （${waited}秒経過、起動待ち...）`);
    }
  }

  return false;
}

function printSummary(ports) {
  console.log('\n--- アクセス URL ---');
  console.log(`  PostgreSQL                   localhost:${ports.POSTGRES_PORT}`);
  console.log(`  Analysis API (FastAPI)       http://localhost:${ports.ANALYSIS_PORT}/health`);
  console.log(`  Web API (NestJS)             http://localhost:${ports.API_PORT}/health`);
  console.log(`  Web (Next.js)                http://localhost:${ports.WEB_PORT}`);
  console.log('\n--- よく使うコマンド ---');
  console.log('  状態確認: docker compose ps');
  console.log('  ログ表示: docker compose logs -f');
  console.log('  停止:     docker compose down');
}

async function main() {
  const argv = process.argv.slice(2);
  const detach = argv.includes('-d') || argv.includes('--detach');
  const noBuild = argv.includes('--no-build');
  const ports = loadPorts();

  console.log('=== market-platform Docker Compose ===');

  printStep(
    1,
    3,
    noBuild ? 'コンテナを起動します...' : 'イメージをビルドしてコンテナを起動します...',
  );
  if (!noBuild) {
    console.log('      初回は pnpm install / Next.js ビルドで数分かかることがあります。');
    console.log('      ビルドログに >>> [service] の進捗が表示されます。');
  }

  const upArgs = ['up', '-d'];
  if (!noBuild) {
    upArgs.push('--build');
  }

  const up = dockerCompose(upArgs, { stdio: 'inherit' });
  if (up.status !== 0) {
    process.exit(up.status ?? 1);
  }

  printStep(2, 3, '各サービスの起動状態を確認しています...');

  for (const service of SERVICE_ORDER) {
    process.stdout.write(`\n  • ${service.label} ... `);
    const ok = await waitHealthy(service.key, 180);
    if (!ok) {
      console.log('失敗');
      console.error(`\n${service.label} が healthy になりませんでした。直近のログ:\n`);
      dockerCompose(['logs', '--tail', '40', service.key], { stdio: 'inherit' });
      process.exit(1);
    }
    console.log('稼働中');
  }

  printStep(3, 3, 'すべてのサービスが起動しました');
  printSummary(ports);

  if (!detach) {
    console.log('\nログを追跡します（Ctrl+C でログ表示のみ終了、コンテナは稼働したまま）...\n');
    const logs = spawn('docker', ['compose', 'logs', '-f', '--tail', '30'], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    logs.on('exit', (code) => process.exit(code ?? 0));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

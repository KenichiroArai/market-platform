import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readAppVersion } from './app-version';

describe('readAppVersion', () => {
  it('reads version from nearest market-platform package.json', () => {
    const root = mkdtempSync(join(tmpdir(), 'market-version-'));
    const nested = join(root, 'apps', 'api', 'src');
    mkdirSync(nested, { recursive: true });
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: 'market-platform', version: '9.9.9' }),
    );
    writeFileSync(
      join(root, 'apps', 'api', 'package.json'),
      JSON.stringify({ name: '@market/api', version: '0.0.0' }),
    );

    expect(readAppVersion(nested)).toBe('9.9.9');
  });

  it('throws when root package.json is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'market-version-missing-'));
    expect(() => readAppVersion(root)).toThrow(
      /Root package.json \(name: market-platform\) with version was not found/,
    );
  });

  it('skips package.json without market-platform name or version', () => {
    const root = mkdtempSync(join(tmpdir(), 'market-version-skip-'));
    const nested = join(root, 'nested');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(nested, 'package.json'), JSON.stringify({ name: 'other' }));
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: 'market-platform', version: '1.2.3' }),
    );

    expect(readAppVersion(nested)).toBe('1.2.3');
  });

  it('reads the real monorepo root version from __dirname', () => {
    expect(readAppVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});

/**
 * 製品バージョンの読み取り。
 * 正本はモノレポルートの package.json（name: market-platform）。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT_PACKAGE_NAME = 'market-platform';

/**
 * 指定ディレクトリから親へ辿り、ルート package.json の version を返す。
 * Docker（/app）とローカル（apps/api/{src,dist}）の両方で同じ規則に揃える。
 */
export function readAppVersion(startDir: string = __dirname): string {
  let dir = startDir;

  while (true) {
    const candidate = join(dir, 'package.json');
    try {
      const pkg = JSON.parse(readFileSync(candidate, 'utf8')) as {
        name?: string;
        version?: string;
      };
      if (pkg.name === ROOT_PACKAGE_NAME && typeof pkg.version === 'string') {
        return pkg.version;
      }
    } catch {
      // 当該階層に package.json が無い／壊れている場合は親を試す
    }

    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Root package.json (name: ${ROOT_PACKAGE_NAME}) with version was not found`,
      );
    }
    dir = parent;
  }
}

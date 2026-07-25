/**
 * プロセス入口。
 *
 * 実サーバー起動は bootstrap に委譲し、ここでは
 * 「直接実行されたときだけ自動起動するか」を制御する。
 * Jest から import された場合は require.main !== module となり自動起動しない。
 */
import { bootstrap } from './bootstrap';

/**
 * 起動関数を呼び出す薄いラッパ。
 * テストでは start を差し替えて副作用なしで検証できる。
 */
export function startApplication(start: typeof bootstrap = bootstrap): Promise<unknown> {
  return start();
}

/**
 * このファイルが Node のエントリポイントとして実行されたかを判定する。
 * テストや他モジュールからの import 時は false になる想定。
 */
export function shouldAutoStart(
  mainModule: NodeModule | undefined = require.main,
  currentModule: NodeModule | undefined = module,
): boolean {
  return Boolean(mainModule && currentModule && mainModule === currentModule);
}

/**
 * shouldAutoStart が true のときだけ起動する。
 * check / start を注入可能にし、分岐の単体テストを容易にする。
 */
export function autoStartIfNeeded(
  check: () => boolean = shouldAutoStart,
  start: () => Promise<unknown> = startApplication,
): void {
  if (check()) {
    void start();
  }
}

// エントリとして実行された場合のみサーバーを立ち上げる
autoStartIfNeeded();

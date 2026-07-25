import { bootstrap } from './bootstrap';

export function startApplication(start: typeof bootstrap = bootstrap): Promise<unknown> {
  return start();
}

export function shouldAutoStart(
  mainModule: NodeModule | undefined = require.main,
  currentModule: NodeModule | undefined = module,
): boolean {
  return Boolean(mainModule && currentModule && mainModule === currentModule);
}

export function autoStartIfNeeded(
  check: () => boolean = shouldAutoStart,
  start: () => Promise<unknown> = startApplication,
): void {
  if (check()) {
    void start();
  }
}

autoStartIfNeeded();

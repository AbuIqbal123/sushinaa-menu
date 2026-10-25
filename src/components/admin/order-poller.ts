export const POLL_OK_MS = 15_000;
export const POLL_BACKOFF_MS = [30_000, 60_000, 120_000] as const;

export type PollResult = 'ok' | 'fail' | 'unauthorized';

export function pollDelay(failures: number) {
  if (failures <= 0) return POLL_OK_MS;
  return POLL_BACKOFF_MS[Math.min(failures, POLL_BACKOFF_MS.length) - 1];
}

export function createOrderPoller(options: {
  hidden: () => boolean;
  poll: () => Promise<PollResult>;
  onUnauthorized: () => void;
  schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clear?: (id: ReturnType<typeof setTimeout>) => void;
}) {
  const schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  const clear = options.clear ?? ((id) => clearTimeout(id));
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  let running = false;
  let stopped = false;

  async function tick() {
    if (stopped || options.hidden() || running) return;
    running = true;
    let result: PollResult = 'fail';
    try { result = await options.poll(); }
    catch { result = 'fail'; }
    running = false;
    if (stopped) return;
    if (result === 'unauthorized') {
      stopped = true;
      if (timer !== undefined) clear(timer);
      options.onUnauthorized();
      return;
    }
    failures = result === 'ok' ? 0 : failures + 1;
    if (options.hidden() || stopped) return;
    if (timer !== undefined) clear(timer);
    timer = schedule(() => { void tick(); }, pollDelay(failures));
  }

  return {
    start: () => tick(),
    wake: () => tick(),
    stop() {
      stopped = true;
      if (timer !== undefined) clear(timer);
    },
  };
}

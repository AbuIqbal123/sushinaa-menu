import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { createOrderPoller, type PollResult } from '../src/components/admin/order-poller';

test('orders poller pauses while the tab is hidden, backs off on errors and resets on success', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  const results: PollResult[] = ['ok', 'fail', 'fail', 'fail', 'fail', 'ok', 'unauthorized'];
  const polls: number[] = [];
  let hidden = false;
  let unauthorized = 0;
  const poller = createOrderPoller({
    hidden: () => hidden,
    poll: async () => {
      polls.push(Date.now());
      return results.shift() ?? 'ok';
    },
    onUnauthorized: () => { unauthorized += 1; },
  });
  try {
    await poller.start();
    assert.equal(polls.length, 1);
    hidden = true;
    mock.timers.tick(15_000);
    await Promise.resolve();
    assert.equal(polls.length, 1);
    hidden = false;
    await poller.wake();
    assert.equal(polls.length, 2);
    const waits = [30_000, 60_000, 120_000, 120_000];
    for (let step = 0; step < waits.length; step += 1) {
      mock.timers.tick(waits[step] - 1);
      await Promise.resolve();
      assert.equal(polls.length, 2 + step);
      mock.timers.tick(1);
      await Promise.resolve();
      await Promise.resolve();
      assert.equal(polls.length, 3 + step);
    }
    mock.timers.tick(15_000);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(unauthorized, 1);
    const stopped = polls.length;
    mock.timers.tick(120_000);
    await Promise.resolve();
    assert.equal(polls.length, stopped);
  } finally {
    poller.stop();
    mock.timers.reset();
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LIVE_DATABASE_HOST } from '../src/lib/deploy-env';
import { hasDevMarker } from '../scripts/dish-marker';

function run(script: string, args: string[], env: Record<string, string>) {
  return spawnSync(process.execPath, ['--import', 'tsx', script, ...args], {
    encoding: 'utf8',
    timeout: 20000,
    env: {
      ...process.env,
      CMS_DATABASE_AUTH_TOKEN: '',
      CMS_ENV_GUARD: 'report',
      PAYMENT_PROVIDER: 'mock',
      ...env,
    },
  });
}

test('dish marker check flags dev only, dev-only, [dev] and DEV ONLY in EN and AR, and passes the live menu fixture', () => {
  for (const value of ['dev only', 'dev-only', 'dev_only', '[dev]', '(dev)', 'DEV ONLY', 'development build', 'للتطوير', 'تطوير']) {
    assert.equal(hasDevMarker(value), true, value);
  }
  for (const value of ['طبق dev only', 'برجر [dev]', 'DEV ONLY برجر', 'مقبلات (dev)']) {
    assert.equal(hasDevMarker(value), true, value);
  }
  const menu = JSON.parse(readFileSync('data/initial-menu.json', 'utf8')) as { dishes: { id: string; name: string; nameAr: string }[] };
  for (const dish of menu.dishes) {
    assert.equal(hasDevMarker(dish.name), false, dish.id);
    assert.equal(hasDevMarker(dish.nameAr), false, dish.id);
  }
});

test('dev name scripts refuse the live host, a production env and a database without the development marker', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sn-marker-refuse-'));
  try {
    const live = run('scripts/check-dev-dish-names.ts', [], {
      VERCEL_ENV: 'preview',
      CMS_DATABASE_URL: `libsql://${LIVE_DATABASE_HOST}`,
    });
    assert.equal(live.status, 1, live.stderr);
    assert.match(live.stderr, /live database host/);

    const missing = join(dir, 'missing.db');
    const production = run('scripts/dev-strip-dish-marker.ts', ['--allow-file-fixture'], {
      VERCEL_ENV: 'production',
      CMS_DATABASE_URL: `file:${missing}`,
    });
    assert.equal(production.status, 1, production.stderr);
    assert.match(production.stderr, /production/);
    assert.equal(existsSync(missing), false);

    const unmarked = run('scripts/check-dev-dish-names.ts', ['--allow-file-fixture'], {
      VERCEL_ENV: 'preview',
      CMS_DATABASE_URL: `file:${join(dir, 'unmarked.db')}`,
    });
    assert.equal(unmarked.status, 1, unmarked.stderr);
    assert.match(unmarked.stderr, /not development/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('strip script changes only the matched dish name and writes one audit row', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sn-marker-strip-'));
  const database = `file:${dir}/menu.db`;
  const env = { VERCEL_ENV: 'preview', CMS_DATABASE_URL: database };
  try {
    const setup = spawnSync(process.execPath, ['--import', 'tsx', '--eval', `(async () => {
      const { readFileSync } = await import('node:fs');
      const menu = JSON.parse(readFileSync('data/initial-menu.json', 'utf8'));
      const dish = menu.dishes.find((item) => item.id === 'sushinaa-burger');
      dish.name = 'Sushinaa burger (dev only)';
      dish.nameAr = 'برجر سوشينا تطوير';
      const { seedMenu } = await import('./src/cms/repository.ts');
      await seedMenu(menu);
      const { db } = await import('./src/cms/db.ts');
      await db.execute('CREATE TABLE IF NOT EXISTS env_marker (id INTEGER PRIMARY KEY CHECK (id = 1), environment TEXT NOT NULL)');
      await db.execute("INSERT INTO env_marker (id, environment) VALUES (1, 'development')");
      const stored = JSON.parse(String((await db.execute('SELECT content FROM menu WHERE id=1')).rows[0].content));
      const seeded = stored.dishes.find((item) => item.id === 'sushinaa-burger');
      seeded.name = 'Sushinaa burger (dev only)';
      seeded.nameAr = 'برجر سوشينا تطوير';
      await db.execute({ sql: 'UPDATE menu SET content=? WHERE id=1', args: [JSON.stringify(stored)] });
      await db.close();
    })().catch((error) => { console.error(error); process.exit(1); })`], {
      encoding: 'utf8', timeout: 20000,
      env: { ...process.env, CMS_DATABASE_AUTH_TOKEN: '', CMS_ENV_GUARD: 'report', PAYMENT_PROVIDER: 'mock', ...env },
    });
    assert.equal(setup.status, 0, setup.stderr || String(setup.error));
    const dry = run('scripts/dev-strip-dish-marker.ts', ['--allow-file-fixture'], env);
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /Sushinaa burger \(dev only\) → Sushinaa burger/);
    const apply = run('scripts/dev-strip-dish-marker.ts', ['--allow-file-fixture', '--apply'], env);
    assert.equal(apply.status, 0, apply.stderr);
    assert.match(apply.stdout, /applied/);
    const check = run('scripts/check-dev-dish-names.ts', ['--allow-file-fixture'], env);
    assert.equal(check.status, 0, check.stderr);
    assert.match(check.stdout, /^ok/m);
    const verify = spawnSync(process.execPath, ['--import', 'tsx', '--eval', `(async () => {
      const { db } = await import('./src/cms/db.ts');
      const content = JSON.parse(String((await db.execute('SELECT content FROM menu WHERE id=1')).rows[0].content));
      const burger = content.dishes.find((item) => item.id === 'sushinaa-burger');
      const audit = (await db.execute("SELECT action, actor, diff FROM audit")).rows;
      console.log(JSON.stringify({ name: burger.name, nameAr: burger.nameAr, dishes: content.dishes.length, audit }));
      await db.close();
    })().catch((error) => { console.error(error); process.exit(1); })`], {
      encoding: 'utf8', timeout: 20000,
      env: { ...process.env, CMS_DATABASE_AUTH_TOKEN: '', CMS_ENV_GUARD: 'report', ...env },
    });
    assert.equal(verify.status, 0, verify.stderr);
    const report = JSON.parse(verify.stdout.trim().split('\n').at(-1)!);
    assert.equal(report.name, 'Sushinaa burger');
    assert.equal(report.nameAr, 'برجر سوشينا');
    assert.equal(report.audit.length, 1);
    assert.equal(report.audit[0].action, 'item.update');
    assert.equal(report.audit[0].actor, 'dev-script');
    const diff = JSON.parse(report.audit[0].diff);
    assert.deepEqual(Object.keys(diff).sort(), ['name', 'nameAr']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

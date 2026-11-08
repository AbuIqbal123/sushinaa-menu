import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicMenuSourceUrl, publicMenuSourceOrigin } from '../src/cms/public-menu-source';

test('public menu source requires https /api/menu without userinfo', () => {
  assert.equal(
    publicMenuSourceOrigin('https://menu.example/api/menu'),
    'https://menu.example',
  );
  assert.throws(() => assertPublicMenuSourceUrl('http://menu.example/api/menu'));
  assert.throws(() => assertPublicMenuSourceUrl('https://menu.example/api/other'));
  assert.throws(() => assertPublicMenuSourceUrl('https://user:pass@menu.example/api/menu'));
});

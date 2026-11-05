import { test } from 'node:test';
import assert from 'node:assert/strict';
import { submitHostedCheckout } from '../src/components/checkout/submit-hosted-checkout';

test('submitHostedCheckout builds a hidden form and submits it', () => {
  const appended: unknown[] = [];
  const inputs: { name: string; value: string; type: string }[] = [];
  let submitted = false;

  const form = {
    method: '',
    action: '',
    acceptCharset: '',
    style: { display: '' },
    setAttribute() {},
    appendChild(child: { name: string; value: string; type: string }) {
      inputs.push(child);
    },
    submit() {
      submitted = true;
    },
  };

  const previous = globalThis.document;
  (globalThis as { document: Document }).document = {
    createElement(tag: string) {
      if (tag === 'form') return form as unknown as HTMLFormElement;
      return { type: '', name: '', value: '' } as unknown as HTMLInputElement;
    },
    body: {
      appendChild(node: unknown) {
        appended.push(node);
      },
    },
  } as unknown as Document;

  try {
    submitHostedCheckout({
      action: 'https://sadadqa.com/webpurchase',
      method: 'POST',
      fields: { ORDER_ID: 'SU-1', signature: 'abc' },
    });
  } finally {
    if (previous === undefined) delete (globalThis as { document?: Document }).document;
    else (globalThis as { document: Document }).document = previous;
  }

  assert.equal(form.method, 'POST');
  assert.equal(form.action, 'https://sadadqa.com/webpurchase');
  assert.equal(form.style.display, 'none');
  assert.equal(appended.length, 1);
  assert.equal(inputs.length, 2);
  assert.equal(inputs[0]!.name, 'ORDER_ID');
  assert.equal(inputs[0]!.value, 'SU-1');
  assert.equal(submitted, true);
});

/** Opaque hosted-gateway launch (Sadad form POST). No card fields. */
export type HostedLaunch = {
  action: string;
  method: 'POST';
  fields: Record<string, string>;
};

/**
 * Build a one-shot HTML form and submit it. Keeps PCI surface at zero and
 * avoids a dedicated “Redirecting…” React page between review and the gateway.
 */
export function submitHostedCheckout(launch: HostedLaunch) {
  const form = document.createElement('form');
  form.method = launch.method;
  form.action = launch.action;
  form.acceptCharset = 'UTF-8';
  form.style.display = 'none';
  form.setAttribute('aria-hidden', 'true');
  for (const [name, value] of Object.entries(launch.fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

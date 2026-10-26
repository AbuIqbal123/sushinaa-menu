const PRINT_TIMEOUT_MS = 60_000;

/** The ticket route is a full Next.js page. Its client boots inside `about:srcdoc` and throws, and Safari then prints the admin tab. Keep the ticket markup and its fit script only. */
function ticketDocument(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script').forEach((script) => {
    // The flight payload quotes fitTicket, so a contains-check would keep Next's bootstrap.
    if (!script.textContent?.startsWith('function fitTicket()')) script.remove();
  });
  const number = doc.querySelector('.ticket-number')?.textContent?.trim();
  doc.title = number ? `Order ${number}` : 'Ticket';
  return `<!doctype html>${doc.documentElement.outerHTML}`;
}

export function printTicket(id: string, timeoutMs = PRINT_TIMEOUT_MS) {
  return new Promise<void>((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    // A real size, off-screen. Safari prints the parent tab when this frame is 0×0.
    frame.style.cssText = 'position:fixed;left:-120mm;top:0;width:80mm;height:100vh;border:0';
    document.body.appendChild(frame);
    fetch(`/cms/orders/${id}/ticket`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('ticket');
        const html = await response.text();
        frame.onload = () => {
          const win = frame.contentWindow;
          if (!win) {
            frame.remove();
            reject(new Error('frame'));
            return;
          }
          let finished = false;
          const timer = win.setTimeout(() => {
            if (finished) return;
            finished = true;
            frame.remove();
            reject(new Error('timeout'));
          }, timeoutMs);
          const finish = () => {
            if (finished) return;
            finished = true;
            win.clearTimeout(timer);
            frame.remove();
            resolve();
          };
          win.addEventListener('afterprint', finish, { once: true });
          try { win.focus(); } catch { /* print still targets this frame */ }
          win.print();
        };
        frame.srcdoc = ticketDocument(html);
      })
      .catch((error: unknown) => {
        frame.remove();
        reject(error);
      });
  });
}

const PRINT_TIMEOUT_MS = 60_000;

export function printTicket(id: string, timeoutMs = PRINT_TIMEOUT_MS) {
  return new Promise<void>((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0';
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
          win.print();
        };
        frame.srcdoc = html;
      })
      .catch((error: unknown) => {
        frame.remove();
        reject(error);
      });
  });
}

import type { TicketModel } from '@/ordering/ticket';

const css = `
@page { size: 80mm auto; margin: 0; }
.ticket-sheet { width: 72mm; margin: 0 auto; color: #000; background: #fff; font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; text-wrap: pretty; overflow-wrap: anywhere; }
.ticket-sheet * { box-sizing: border-box; }
.ticket-sheet h1 { margin: 0; font-size: 14px; font-weight: 550; }
.ticket-sheet .ticket-number { margin: 4px 0; font-size: 28px; font-weight: 550; line-height: 1; }
.ticket-sheet .ticket-id, .ticket-sheet p { margin: 0 0 4px; }
.ticket-sheet h2 { margin: 8px 0 2px; font-size: 12px; font-weight: 550; }
.ticket-sheet ul { list-style: none; margin: 0; padding: 0; }
.ticket-sheet li { margin: 0 0 6px; }
.ticket-sheet .ticket-banner { margin: 0 0 6px; font-weight: 550; }
.ticket-sheet .ticket-total { margin-top: 8px; font-size: 14px; font-weight: 550; }
@media print {
  .skip-link { display: none !important; }
  body { margin: 0; background: #fff; }
}
`;

const fit = `function fitTicket(){var sheet=document.querySelector('.ticket-sheet');if(!sheet)return;var mm=(sheet.offsetHeight*25.4/96)+6;var style=document.getElementById('ticket-page-size')||document.createElement('style');style.id='ticket-page-size';style.textContent='@page{size:80mm '+mm.toFixed(2)+'mm;margin:0}';document.head.appendChild(style);}if(document.readyState==='complete')fitTicket();else window.addEventListener('load',fitTicket);window.addEventListener('beforeprint',fitTicket);`;

export function Ticket({ model }: { model: TicketModel }) {
  return (
    <article className="ticket-sheet">
      <style>{css}</style>
      <script dangerouslySetInnerHTML={{ __html: fit }} />
      {model.reprint && <p className="ticket-banner">{model.reprint}</p>}
      <h1>{model.branchName}</h1>
      {model.orderNumber && <p className="ticket-number">{model.orderNumber}</p>}
      <p className="ticket-id">{model.id}</p>
      <p>{model.placed}</p>
      <p>{model.fulfilment}{model.car ? ` · ${model.car}` : ''}</p>
      <p>{model.customer}</p>
      <p>{model.phone}</p>
      {model.groups.map((group) => (
        <section key={group.name}>
          <h2>{group.name}</h2>
          <ul>
            {group.lines.map((line, index) => (
              <li key={`${group.name}-${index}`}>
                <div>{line.quantity} {line.name}</div>
                {line.options && <div>{line.options}</div>}
                {line.note && <div>{line.note}</div>}
                <div>{line.total}</div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="ticket-total">{model.total}</p>
      <p>{model.payment}</p>
    </article>
  );
}

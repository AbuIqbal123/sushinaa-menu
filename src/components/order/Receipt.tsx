const css = `
@page { size: 80mm auto; margin: 4mm; }
.ticket-sheet { width: 72mm; margin: 0 auto; color: #000; background: #fff; font: 12pt/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; text-wrap: pretty; overflow-wrap: anywhere; }
.ticket-sheet * { box-sizing: border-box; }
.ticket-sheet h1 { margin: 0; font-size: 12pt; font-weight: 550; }
.ticket-sheet p, .ticket-sheet li { margin: 0; }
.ticket-sheet ul { list-style: none; margin: 0; padding: 0; }
.ticket-sheet .receipt-rule { border: 0; border-top: 1px dashed #000; margin: 12pt 0; }
.ticket-sheet .receipt-item { margin: 0 0 6pt; }
.ticket-sheet .receipt-mod { padding-inline-start: 8pt; }
.ticket-sheet .receipt-void { text-decoration: line-through; }
.ticket-sheet .receipt-total { margin-top: 4pt; font-weight: 700; }
@media print {
  .skip-link { display: none !important; }
  body { margin: 0; background: #fff; }
}
`;

export type CustomerReceipt = {
  branchName: string;
  orderNumber: string;
  id: string;
  when: string;
  amended: boolean;
  lines: { qty: number; name: string; unit: string; total: string; modifiers: string; voided: boolean; discount: string }[];
  discounts: { label: string; amount: string }[];
  subtotal: string;
  discountTotal: string;
  total: string;
  payment: string;
  owed: string;
};

export function Receipt({ model }: { model: CustomerReceipt }) {
  return (
    <article className="ticket-sheet">
      <style>{css}</style>
      <h1>{model.branchName}</h1>
      <p>{model.orderNumber}</p>
      <p>{model.id}</p>
      <p>{model.when}</p>
      {model.amended && <p>AMENDED</p>}
      <hr className="receipt-rule" />
      <ul>
        {model.lines.map((line, index) => (
          <li key={index} className={`receipt-item${line.voided ? ' receipt-void' : ''}`}>
            <div>{line.voided ? `VOID ${line.name}` : line.name}</div>
            <div>{line.qty} x {line.unit} = {line.voided ? '0.00' : line.total}</div>
            {line.modifiers && <div className="receipt-mod">{line.modifiers}</div>}
            {line.discount && <div className="receipt-mod">{line.discount}</div>}
          </li>
        ))}
      </ul>
      {model.discounts.length > 0 && model.discounts.map((line, index) => <p key={index}>{line.label} {line.amount}</p>)}
      <hr className="receipt-rule" />
      <p>Subtotal {model.subtotal}</p>
      <p>Discounts {model.discountTotal}</p>
      <p className="receipt-total">TOTAL {model.total}</p>
      <hr className="receipt-rule" />
      <p>{model.payment}</p>
      {model.owed && <p>{model.owed}</p>}
      <p>Thank you</p>
    </article>
  );
}

// 80mm paper, 4mm clear on every side: the sheet is 80mm wide with 4mm padding,
// so no text can touch the paper edge on screen or in print.
const css = `
@page { size: 80mm auto; margin: 0; }
.ticket-sheet { box-sizing: border-box; width: 80mm; margin: 0 auto; padding: 4mm; color: #000; background: #fff; font: 12pt/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; overflow-wrap: break-word; }
.ticket-sheet * { box-sizing: border-box; }
.ticket-sheet h1 { margin: 0; font-size: 12pt; font-weight: 550; }
.ticket-sheet p, .ticket-sheet li { margin: 0; }
.ticket-sheet ul { list-style: none; margin: 0; padding: 0; }
.ticket-sheet .receipt-rule { border: 0; border-top: 1px dashed #000; margin: 12pt 0; }
.ticket-sheet .receipt-item { margin: 0 0 6pt; }
.ticket-sheet .receipt-item:last-child { margin-bottom: 0; }
.ticket-sheet .receipt-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8pt; }
.ticket-sheet .receipt-row > :first-child { flex: 1 1 auto; min-width: 0; }
.ticket-sheet .receipt-row > :last-child { flex: none; white-space: nowrap; text-align: end; font-variant-numeric: tabular-nums; }
.ticket-sheet .receipt-mod { padding-inline-start: 8pt; }
.ticket-sheet .receipt-note { padding-inline-start: 16pt; }
.ticket-sheet .receipt-void { text-decoration: line-through; }
.ticket-sheet .receipt-total { margin-top: 4pt; font-weight: 700; }
@media print {
  .skip-link { display: none !important; }
  body { margin: 0; background: #fff; }
}
`;

export type ReceiptAdjustment = { label: string; amount: string; note: string };

export type CustomerReceipt = {
  branchName: string;
  /** "Order 1", or the short code when there is no number. */
  orderLabel: string;
  when: string;
  amended: boolean;
  lines: { name: string; qtyLine: string; total: string; modifiers: string; voided: boolean; adjustments: ReceiptAdjustment[] }[];
  orderAdjustments: ReceiptAdjustment[];
  subtotal: string;
  discountTotal: string;
  total: string;
  payment: { label: string; amount: string };
  owed: { label: string; amount: string } | null;
};

function Row({ label, amount, className }: { label: string; amount: string; className?: string }) {
  return <div className={className ? `receipt-row ${className}` : 'receipt-row'}><span>{label}</span><span>{amount}</span></div>;
}

function Adjustment({ item, className }: { item: ReceiptAdjustment; className?: string }) {
  return <>
    <Row className={className} label={item.label} amount={item.amount} />
    {item.note && <p className={className ? `${className} receipt-note` : 'receipt-note'}>{item.note}</p>}
  </>;
}

export function Receipt({ model }: { model: CustomerReceipt }) {
  return (
    <article className="ticket-sheet">
      <style>{css}</style>
      <h1>{model.branchName}</h1>
      <p>{model.orderLabel}</p>
      <p>{model.when}</p>
      {model.amended && <p>AMENDED</p>}
      <hr className="receipt-rule" />
      <ul>
        {model.lines.map((line, index) => (
          <li key={index} className={`receipt-item${line.voided ? ' receipt-void' : ''}`}>
            <p>{line.voided ? `VOID ${line.name}` : line.name}</p>
            <Row label={line.qtyLine} amount={line.total} />
            {line.modifiers && <p className="receipt-mod">{line.modifiers}</p>}
            {line.adjustments.map((item, i) => <Adjustment key={i} item={item} className="receipt-mod" />)}
          </li>
        ))}
      </ul>
      {model.orderAdjustments.length > 0 && <>
        <hr className="receipt-rule" />
        {model.orderAdjustments.map((item, index) => <Adjustment key={index} item={item} />)}
      </>}
      <hr className="receipt-rule" />
      <Row label="Subtotal" amount={model.subtotal} />
      <Row label="Discounts" amount={model.discountTotal} />
      <Row className="receipt-total" label="TOTAL" amount={model.total} />
      <hr className="receipt-rule" />
      <Row label={model.payment.label} amount={model.payment.amount} />
      {model.owed && <Row label={model.owed.label} amount={model.owed.amount} />}
      <p>Thank you</p>
    </article>
  );
}

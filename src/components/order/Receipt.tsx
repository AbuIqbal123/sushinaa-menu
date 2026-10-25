const css = `
@page { size: 80mm auto; margin: 0; }
.ticket-sheet { width: 72mm; margin: 0 auto; color: #000; background: #fff; font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; text-wrap: pretty; overflow-wrap: anywhere; }
.ticket-sheet h1 { margin: 0 0 8px; font-size: 14px; font-weight: 550; }
.ticket-sheet p { margin: 0 0 4px; }
.ticket-sheet .ticket-total { margin-top: 8px; font-size: 14px; font-weight: 550; }
`;

export type CustomerReceipt = {
  branchName: string;
  id: string;
  original: string;
  discounts: { label: string; amount: string }[];
  total: string;
  payment: string;
};

export function Receipt({ model }: { model: CustomerReceipt }) {
  return (
    <article className="ticket-sheet">
      <style>{css}</style>
      <h1>{model.branchName}</h1>
      <p>{model.id}</p>
      <p>Original total {model.original}</p>
      {model.discounts.map((line, index) => <p key={index}>{line.label} {line.amount}</p>)}
      <p className="ticket-total">New total {model.total}</p>
      <p>{model.payment}</p>
    </article>
  );
}

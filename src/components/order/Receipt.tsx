import { OrderBarcode, ThermalBrand, ThermalColumns, ThermalPaper } from './ThermalPaper';

export type ReceiptAdjustment = { label: string; amount: string; note: string };
export type CustomerReceipt = {
  branchName: string;
  orderLabel: string;
  when: string;
  amended: boolean;
  car: string;
  customer: string;
  phone: string;
  reference: string;
  lines: { name: string; nameAr: string; quantity: number; qtyLine: string; total: string; modifiers: string; note: string; voided: boolean; adjustments: ReceiptAdjustment[] }[];
  orderAdjustments: ReceiptAdjustment[];
  subtotal: string;
  discountTotal: string;
  total: string;
  payment: { label: string; amount: string };
  owed: { label: string; amount: string } | null;
};
function Row({ label, amount, className }: { label: React.ReactNode; amount: string; className?: string }) {
  return <div className={`receipt-row ${className || ''}`}><span>{label}</span><span>{amount}</span></div>;
}
function Adjustment({ item }: { item: ReceiptAdjustment }) {
  return <><Row label={item.label} amount={item.amount} />{item.note && <p className="receipt-note">{item.note}</p>}</>;
}
export function Receipt({ model, logo }: { model: CustomerReceipt; logo?: string }) {
  return <ThermalPaper>
    {model.amended && <p className="ticket-banner">AMENDED · <span lang="ar">معدّل</span></p>}
    <ThermalBrand branchName={model.branchName} logo={logo} />
    <section className="thermal-details">
      {model.car && <p><strong>Car Number:</strong> {model.car}</p>}
      <p className="ticket-number">{model.orderLabel}</p>
      <p>{model.customer} · {model.phone}</p>
      <p className="thermal-source"><span>Website order</span><span>CAR PICKUP</span></p>
    </section>
    <ThermalColumns />
    <ul>{model.lines.map((line, index) => <li key={index} className={`thermal-line${line.voided ? ' receipt-void' : ''}`}>
      <span>{line.quantity}</span><div><p className="thermal-line-name">{line.voided ? `VOID ${line.name}` : line.name}</p>
        {line.nameAr !== line.name && <p className="thermal-line-ar" lang="ar" dir="rtl">{line.nameAr}</p>}
        <p className="thermal-options">{line.qtyLine}</p>
        {line.modifiers && <p className="thermal-options">{line.modifiers}</p>}
        {line.note && <p className="thermal-note" dir="auto">{line.note}</p>}
        {line.adjustments.map((item, i) => <Adjustment key={i} item={item} />)}
      </div><span className="thermal-amount">{line.total}</span>
    </li>)}</ul>
    {model.orderAdjustments.length > 0 && <><hr className="thermal-rule" />{model.orderAdjustments.map((item, index) => <Adjustment key={index} item={item} />)}</>}
    <hr className="thermal-rule" />
    <Row label={<><span lang="ar">المجموع الفرعي</span><br />Sub Total</>} amount={model.subtotal} />
    {Number(model.discountTotal) !== 0 && <Row label={<>Discounts · <span lang="ar">الخصومات</span></>} amount={model.discountTotal} />}
    <hr className="thermal-rule" />
    <Row className="thermal-total" label={<><span lang="ar">المبلغ المستحق</span><br />AMOUNT DUE</>} amount={model.total} />
    <Row label={model.payment.label} amount={model.payment.amount} />
    {model.owed && <Row label={model.owed.label} amount={model.owed.amount} />}
    <hr className="thermal-rule" />
    <footer className="thermal-footer"><p>{model.when}</p><p className="thermal-thanks">Thank you · <span lang="ar">شكراً لكم</span></p><OrderBarcode value={model.reference} /></footer>
  </ThermalPaper>;
}

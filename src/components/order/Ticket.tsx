import type { TicketModel } from '@/ordering/ticket';
import { OrderBarcode, ThermalBrand, ThermalColumns, ThermalPaper } from './ThermalPaper';

export function Ticket({ model, logo }: { model: TicketModel; logo?: string }) {
  return <ThermalPaper orderId={model.id}>
    {model.amended && <p className="ticket-banner">AMENDED · <span lang="ar">معدّل</span></p>}
    {model.reprint && <p className="ticket-banner">{model.reprint}</p>}
    <ThermalBrand branchName={model.branchName} logo={logo} />
    <section className="thermal-details">
      {model.car && <p><strong>Car Number:</strong> {model.car}</p>}
      <p className="ticket-number" data-order-number={model.orderNumber}>Check # {model.orderNumber || model.id.slice(-8)}</p>
      <p>{model.customer} · {model.phone}</p>
      <p className="thermal-source"><span>Website order</span><span>{model.fulfilment}</span></p>
      {model.instructions && <p className="thermal-note" dir="auto">{model.instructions}</p>}
    </section>
    <ThermalColumns />
    {model.groups.map(group => <section key={group.name}>
      <h2 className="thermal-category">{group.name}</h2>
      <ul>{group.lines.map((line, index) => <li key={index} className={`thermal-line${line.voided ? ' thermal-void' : ''}`}>
        <span>{line.quantity}</span>
        <div><p className="thermal-line-name">{line.name}</p>{line.nameAr && <p className="thermal-line-ar" lang="ar" dir="rtl">{line.nameAr}</p>}{line.options && <p className="thermal-options">{line.options}</p>}{line.note && <p className="thermal-note" dir="auto">{line.note}</p>}</div>
        <span className="thermal-amount">{line.amount ?? line.total}</span>
      </li>)}</ul>
    </section>)}
    <hr className="thermal-rule" />
    <div className="thermal-row"><span><span lang="ar">المجموع الفرعي</span><br />Sub Total</span><span>{model.subtotal} QAR</span></div>
    {Number(model.discount) > 0 && <div className="thermal-row"><span>Discount · <span lang="ar">الخصم</span></span><span>−{model.discount} QAR</span></div>}
    <hr className="thermal-rule" />
    <div className="thermal-row thermal-total ticket-total"><span><span lang="ar">المبلغ المستحق</span><br />AMOUNT DUE</span><strong>{model.amountDue} QAR</strong></div>
    <p>{model.payment}</p>
    <hr className="thermal-rule" />
    <footer className="thermal-footer"><p>{model.placed}</p><p className="thermal-thanks">Thank you · <span lang="ar">شكراً لكم</span></p><OrderBarcode value={model.reference} /></footer>
  </ThermalPaper>;
}

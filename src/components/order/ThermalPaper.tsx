import type { ReactNode } from 'react';

// 80mm roll with a 72mm printable area. Reset the app's full-height document:
// otherwise print drivers can append a viewport (or an A4 page) of blank paper.
const css = `
@page { size: 80mm auto; margin: 0; }
html:has(.ticket-sheet), body:has(.ticket-sheet) { width: 80mm; min-width: 0; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; color-scheme: light; background: #fff !important; color: #000; }
body:has(.ticket-sheet) > .skip-link { display: none !important; }
.ticket-sheet { box-sizing: border-box; width: 80mm; max-width: 80mm; margin: 0; padding: 4mm; color: #000; background: #fff; font: 10.5pt/1.3 Arial, Helvetica, sans-serif; overflow-wrap: anywhere; text-align: left; }
.ticket-sheet * { box-sizing: border-box; }
.ticket-sheet p, .ticket-sheet h1, .ticket-sheet h2 { margin: 0; }
.ticket-sheet [lang="ar"] { font-family: var(--font-arabic), Tahoma, Arial, sans-serif; font-weight: 500; }
.ticket-sheet ul { list-style: none; margin: 0; padding: 0; }
.thermal-brand { text-align: center; margin-bottom: 3mm; }
.thermal-logo { display: block; width: 38mm; height: 36.5mm; object-fit: contain; margin: 0 auto 2mm; filter: grayscale(1) contrast(4); }
.ticket-sheet .thermal-brand h1 { font-size: 15pt; font-weight: 500; line-height: 1.2; }
.thermal-branch { margin-top: 1mm !important; font-size: 10pt; }
.thermal-details { margin: 2mm 0; }
.thermal-details > p { margin: 1mm 0; }
.ticket-sheet .ticket-number { font-size: 14pt; font-weight: 700; }
.thermal-source { display: flex; justify-content: space-between; gap: 2mm; font-size: 10pt; }
.thermal-rule, .ticket-sheet .receipt-rule { border: 0; border-top: 1px dashed #000; margin: 2.5mm 0; }
.thermal-columns, .thermal-line { display: grid; grid-template-columns: 9mm minmax(0,1fr) 18mm; gap: 2mm; align-items: start; }
.thermal-columns { padding: 1mm 0; font-size: 9.5pt; border-block: 1px dashed #000; margin: 2mm 0; }
.thermal-columns > :last-child, .thermal-amount { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.thermal-columns span { display: block; white-space: nowrap; }
.thermal-line { padding: 1.5mm 0; break-inside: avoid; }
.thermal-line-name { font-weight: 500; }
.thermal-line-ar { font-size: 9pt; line-height: 1.45; text-align: left; }
.ticket-sheet .thermal-category { margin-top: 2mm; font-size: 9pt; font-weight: 700; }
.thermal-options, .thermal-note { margin-top: .6mm !important; font-size: 9.5pt; }
.thermal-note { font-weight: 700; }
.thermal-void { text-decoration: line-through; }
.thermal-row, .ticket-sheet .receipt-row { display: flex; align-items: baseline; justify-content: space-between; gap: 3mm; }
.thermal-row > :first-child, .ticket-sheet .receipt-row > :first-child { flex: 1; min-width: 0; }
.thermal-row > :last-child, .ticket-sheet .receipt-row > :last-child { flex: none; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.thermal-total { font-size: 12pt; }
.thermal-footer { margin-top: 3mm; font-size: 9pt; }
.thermal-thanks { text-align: center; margin: 2mm 0 !important; }
.thermal-barcode { display: block; width: 64mm; height: 12mm; margin: 2mm auto 0; }
.thermal-reference { text-align: center; font-size: 9pt; letter-spacing: .5pt; }
.ticket-sheet .ticket-banner { text-align: center; font-weight: 700; margin: 0 0 2mm; }
.ticket-sheet .receipt-note { margin: .5mm 0 1mm; font-size: 9pt; }
.ticket-sheet .receipt-void { text-decoration: line-through; }
@media print {
  html:has(.ticket-sheet), body:has(.ticket-sheet) { overflow: visible !important; }
  .ticket-sheet { margin: 0 !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`;

// Runs in the isolated print frame as well as the standalone receipt page.
// Refit after fonts/images load, and again immediately before the print dialog.
export const fitTicketScript = `function fitTicket(){var sheet=document.querySelector('.ticket-sheet');if(!sheet)return;var mm=Math.ceil(sheet.getBoundingClientRect().height*25.4/96)+2;var style=document.getElementById('ticket-page-size')||document.createElement('style');style.id='ticket-page-size';style.textContent='@page{size:80mm '+mm+'mm;margin:0}';document.head.appendChild(style);}function readyTicket(){Promise.all([document.fonts?document.fonts.ready:Promise.resolve()].concat(Array.from(document.images).map(function(img){return img.decode?img.decode().catch(function(){}):Promise.resolve();}))).then(fitTicket);}if(document.readyState==='complete')readyTicket();else window.addEventListener('load',readyTicket);window.addEventListener('beforeprint',fitTicket);`;

export function ThermalPaper({ children, orderId }: { children: ReactNode; orderId?: string }) {
  return <article className="ticket-sheet" dir="ltr" data-order-id={orderId}><style>{css}</style><script dangerouslySetInnerHTML={{ __html: fitTicketScript }} />{children}</article>;
}
export function ThermalBrand({ branchName, logo = '/brand/logo.svg' }: { branchName: string; logo?: string }) {
  return <header className="thermal-brand">
    {/* Native img is intentional: the print frame waits for its decode before printing. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className="thermal-logo" src={logo} alt="Sushinaa" width="144" height="138" />
    <h1>Sushinaa Restaurant</h1><p className="thermal-branch">{branchName}</p>
  </header>;
}
export function ThermalColumns() {
  return <div className="thermal-columns"><div><span lang="ar">الكمية</span>Qty</div><div><span lang="ar">الاسم</span>Name</div><div><span lang="ar">المجموع</span>Amount</div></div>;
}

// Code 39 digit patterns; a barcode is an order reference, never customer contact.
const bars: Record<string, string> = { '0':'nnnwwnwnn', '1':'wnnwnnnnw', '2':'nnwwnnnnw', '3':'wnwwnnnnn', '4':'nnnwwnnnw', '5':'wnnwwnnnn', '6':'nnwwwnnnn', '7':'nnnwnnwnw', '8':'wnnwnnwnn', '9':'nnwwnnwnn', '*':'nwnnwnwnn' };
export function OrderBarcode({ value }: { value: string }) {
  if (!/^\d+$/.test(value)) return null;
  let x = 10;
  const rects: ReactNode[] = [];
  for (const [characterIndex, character] of Array.from(`*${value}*`).entries()) {
    Array.from(bars[character]).forEach((bar, index) => {
      const width = bar === 'w' ? 2.5 : 1;
      if (index % 2 === 0) rects.push(<rect key={`${characterIndex}-${index}`} x={x} y="0" width={width} height="40" />);
      x += width;
    });
    x += 1;
  }
  return <><svg className="thermal-barcode" role="img" aria-label={`Order reference ${value}`} viewBox={`0 0 ${x+10} 40`} preserveAspectRatio="none" fill="#000">{rects}</svg><p className="thermal-reference">{value}</p></>;
}

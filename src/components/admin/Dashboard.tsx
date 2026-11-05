'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useLocale } from '@/i18n/locale';
import type { MenuData,CmsDish } from '@/cms/schema';
import { configuredBranches } from '@/branches/branches';
import { branchStatus,qatarClock } from '@/branches/hours';
import { formatMinor } from '@/lib/money';
import type { Role } from '@/cms/permissions';
import { ago,OpsIcon,useAdminClock,useOperations } from './OperationsUI';

export type OrderIntent={status?:string;unprinted?:boolean};
export function Dashboard({menu,onEdit,onMenu,onOrders,onBranches,branch,role}:{menu:MenuData;onEdit:(dish:CmsDish)=>void;onMenu:()=>void;onOrders:(intent?:OrderIntent,branch?:string)=>void;onBranches:()=>void;branch:string;role:Role}){
  const {lang}=useLocale();const ar=lang==='ar';const text=(en:string,arabic:string)=>ar?arabic:en;
  const [period,setPeriod]=useState('today'),[from,setFrom]=useState(''),[to,setTo]=useState(''),[chart,setChart]=useState<'orders'|'sales'>('orders');
  const {data,failed,valid,refresh}=useOperations(branch,period,from,to);const now=useAdminClock();
  const branches=configuredBranches(menu.branches).filter(b=>!branch||b.slug===branch);
  const num=(v:number)=>new Intl.NumberFormat(lang).format(v);const money=(v:number)=>formatMinor(v,lang);
  const mins=(v:number|null|undefined)=>v==null?'—':`${num(v)} ${text('min','د')}`;
  const counts=data?.counts;const metrics=data?.metrics;
  const activeItems=menu.dishes.filter(d=>d.visible&&d.available&&menu.categories.some(c=>c.id===d.section&&c.visible));
  const unavailable=menu.dishes.filter(d=>d.visible&&!d.available);
  const max=Math.max(1,...(data?.series??[]).map(p=>chart==='orders'?p.orders:p.salesMinor));
  return <div className="ops-dashboard" aria-busy={!data&&valid&&!failed}>
    <section className="ops-service-banner">
      <div><span className="ops-eyebrow">{text('CAR COLLECTION','الاستلام بالسيارة')}</span><h2>{text('Your kitchen, at a glance.','مطبخك بنظرة واحدة.')}</h2>
        <p><span className="ops-live-dot"/>{counts?`${num(counts.active)} ${text('active orders right now','طلبات نشطة الآن')}`:text('Connecting to your branches…','جارٍ الاتصال بفروعك…')}</p></div>
      <button className="ops-banner-action" onClick={()=>onOrders()}>{text('Open live orders','عرض الطلبات المباشرة')}<OpsIcon name="arrow"/></button>
    </section>
    <section className="ops-live-strip" aria-label={text('Live order stages','مراحل الطلبات المباشرة')}>
      {([['received','New orders','طلبات جديدة','orders'],['preparing','In the kitchen','قيد التحضير','clock'],['ready','Ready for collection','جاهزة للاستلام','check']] as const).map(([key,en,arabic,icon])=><button key={key} className={`ops-live-stage stage-${key}`} onClick={()=>onOrders({status:key})}>
        <span className="ops-stage-icon"><OpsIcon name={icon}/></span><span><strong>{counts?num(counts[key]):'—'}</strong><span>{text(en,arabic)}</span></span><OpsIcon name="arrow" size={17}/>
      </button>)}
    </section>
    <div className="ops-section-heading"><h2>{text('Performance','الأداء')}</h2><div className="ops-date-controls">
      <label className="sr-only" htmlFor="dashboard-period">{text('Reporting period','الفترة الزمنية')}</label><select id="dashboard-period" value={period} onChange={e=>setPeriod(e.target.value)}>
        {([['today','Today','اليوم'],['yesterday','Yesterday','أمس'],['7d','Last 7 days','آخر ٧ أيام'],['30d','Last 30 days','آخر ٣٠ يوماً'],['custom','Custom dates','تواريخ مخصصة']] as const).map(([value,en,arabic])=><option key={value} value={value}>{text(en,arabic)}</option>)}
      </select>{period==='custom'&&<><input type="date" aria-label={text('Report from','التقرير من')} value={from} onChange={e=>setFrom(e.target.value)}/><span>–</span><input type="date" aria-label={text('Report to','التقرير إلى')} value={to} onChange={e=>setTo(e.target.value)}/></>}
    </div></div>
    {!valid&&<p className="ops-inline-message" role="status">{text('Choose a date range of up to 92 days.','اختر فترة لا تتجاوز ٩٢ يوماً.')}</p>}
    {failed&&<div className="ops-inline-message ops-message-error" role="alert">{text('Live updates paused. Showing the last available figures.','توقفت التحديثات المباشرة. تُعرض آخر الأرقام المتاحة.')}<button onClick={refresh}>{text('Retry','إعادة المحاولة')}</button></div>}
    <div className="ops-metrics">
      {[{label:text('Paid order value','قيمة الطلبات المدفوعة'),value:metrics?money(metrics.paidSalesMinor):'—',icon:'money' as const,note:text('Current totals · excludes cancelled orders','الإجماليات الحالية · باستثناء الطلبات الملغاة')},
        {label:text('Orders','الطلبات'),value:metrics?num(metrics.orders):'—',icon:'orders' as const,note:metrics?`${num(metrics.completed)} ${text('collected','تم استلامها')}`:'—'},
        {label:text('Average order','متوسط الطلب'),value:metrics?money(metrics.averageMinor):'—',icon:'menu' as const,note:text('Excludes cancelled orders','باستثناء الطلبات الملغاة')},
        {label:text('Preparation time','وقت التحضير'),value:mins(metrics?.prepMinutes),icon:'clock' as const,note:metrics?`${num(metrics.timedOrders)} ${text('timed orders','طلبات ذات وقت مسجل')}`:'—'}].map(metric=><article className="ops-metric" key={metric.label}><div><span>{metric.label}</span><OpsIcon name={metric.icon}/></div><strong>{metric.value}</strong><small>{metric.note}</small></article>)}
    </div>
    <div className="ops-insight-grid">
      <section className="ops-panel ops-trend-panel"><header><div><h2>{text('The rhythm of your orders','حركة طلباتك')}</h2><small>{data?`${data.range.from} — ${data.range.to}`:text('Loading your figures…','جارٍ تحميل الأرقام…')}</small></div><div className="ops-segment" aria-label={text('Chart measure','مقياس الرسم')}><button aria-pressed={chart==='orders'} onClick={()=>setChart('orders')}>{text('Orders','الطلبات')}</button><button aria-pressed={chart==='sales'} onClick={()=>setChart('sales')}>{text('Sales','المبيعات')}</button></div></header>
        <div className="ops-chart" role="group" aria-label={text('Orders over time','الطلبات مع مرور الوقت')}>
          {(data?.series??Array.from({length:12},(_,i)=>({key:String(i),orders:0,salesMinor:0}))).map((point,i)=>{
            const value=chart==='orders'?point.orders:point.salesMinor;const label=!data?'':data.hourly?`${point.key}:00`:new Date(`${point.key}T12:00:00+03:00`).toLocaleDateString(lang,{day:'numeric',month:'short',timeZone:'Asia/Qatar'});
            const description=`${label} · ${chart==='orders'?`${num(point.orders)} ${text('orders','طلبات')}`:money(point.salesMinor)}`;
            return <div className="ops-chart-column" key={point.key}><button style={{height:`${value?Math.max(5,value/max*100):2}%`}} className={value?'':'is-zero'} aria-label={description} data-tooltip={description}/><span>{i===0||i===(data?.series.length??12)-1||i%Math.ceil((data?.series.length??12)/6)===0?label:''}</span></div>;
          })}
        </div>
        {metrics?.orders===0&&<p className="ops-chart-empty">{text('Orders will appear here as they arrive.','ستظهر الطلبات هنا عند وصولها.')}</p>}
      </section>
      <section className="ops-panel ops-pace-panel"><header><h2>{text('Service pace','سرعة الخدمة')}</h2><OpsIcon name="clock"/></header><ol className="ops-pace">
        {[{label:text('Accepting orders','قبول الطلبات'),value:metrics?.acceptMinutes,tone:'received'}, {label:text('Preparing food','تحضير الطعام'),value:metrics?.prepMinutes,tone:'preparing'}, {label:text('Ready to collected','من الجاهزية إلى الاستلام'),value:metrics?.collectionMinutes,tone:'ready'}].map((row,i)=><li key={row.tone}><span className={`ops-step step-${row.tone}`}>{i+1}</span><span>{row.label}</span><strong>{mins(row.value)}</strong></li>)}
      </ol><div className="ops-pace-footer"><span>{text('Cancelled orders','الطلبات الملغاة')}</span><strong>{metrics?num(metrics.cancelled):'—'}</strong></div><div className="ops-pace-footer"><span>{text('Awaiting collection payment','بانتظار الدفع عند الاستلام')}</span><strong>{metrics?money(metrics.unpaidMinor):'—'}</strong></div></section>
    </div>
    <div className="ops-insight-grid">
      <section className="ops-panel ops-branch-panel"><header><h2>{text('Your branches','فروعك')}</h2>{role==='admin'&&<button className="ops-link" onClick={onBranches}>{text('Manage','إدارة')}<OpsIcon name="arrow" size={15}/></button>}</header>
        <div className="ops-branch-list">{branches.map(b=>{const figures=data?.branches.find(row=>row.id===b.slug);const state=branchStatus(b.hours,qatarClock(new Date(now)),lang);return <button key={b.slug} className="ops-branch-row" onClick={()=>onOrders({},b.slug)}>
          <span className={`ops-branch-marker${state.open?' is-open':''}`}><OpsIcon name="branches"/></span><span className="ops-branch-name"><strong>{ar?b.nameAr:b.name}</strong><small><span className={state.open?'ops-open-dot':'ops-closed-dot'}/>{state.label}</small></span><span className="ops-branch-numbers"><strong>{num(figures?.active??0)} <small>{text('active','نشط')}</small></strong><span>{data?money(figures?.salesMinor??0):'—'}</span></span><OpsIcon name="arrow" size={16}/>
        </button>;})}</div>
      </section>
      <section className="ops-panel ops-popular-panel"><header><h2>{text('Menu favourites','الأصناف الأكثر طلباً')}</h2><small>{text('By quantity','حسب الكمية')}</small></header>
        {data?.popular.length?data.popular.map((item,i)=>{const dish=menu.dishes.find(d=>d.id===item.dishId);return <div className="ops-popular-row" key={item.dishId}><span className="ops-rank">{i+1}</span>{dish?.image&&<Image src={dish.image} alt="" width={48} height={48} className="ops-food-thumb" unoptimized/>}<div><strong>{ar?item.nameAr||item.name:item.name}</strong><span className="ops-popular-track"><span style={{width:`${item.quantity/data.popular[0].quantity*100}%`}}/></span></div><strong>{num(item.quantity)}</strong></div>}):<div className="ops-empty-panel"><OpsIcon name="menu" size={30}/><p>{text('Your most-loved dishes will appear here.','ستظهر الأصناف الأكثر طلباً هنا.')}</p></div>}
      </section>
    </div>
    <section className="ops-attention" aria-label={text('Needs attention','يحتاج إلى متابعة')}>
      {(data?.attention??[]).filter(item=>item.count>0).map(item=><button key={item.kind} onClick={()=>onOrders(item.kind==='unprinted'?{unprinted:true}:{status:item.kind})}><span className={`ops-step step-${item.kind}`}><OpsIcon name={item.kind==='unprinted'?'print':item.kind==='ready'?'car':'alert'}/></span><span><strong>{num(item.count)} {item.kind==='received'?text('waiting for acceptance','بانتظار القبول'):item.kind==='ready'?text('ready for collection','جاهزة للاستلام'):text('not printed','لم تُطبع')}</strong>{item.oldestAt&&<small>{text('Longest wait','أطول انتظار')} · {ago(item.oldestAt,now,lang)}</small>}</span><OpsIcon name="arrow" size={18}/></button>)}
    </section>
    {role==='admin'&&<section className="ops-panel ops-menu-health"><div><span className="ops-eyebrow">{text('MENU AVAILABILITY','توفر القائمة')}</span><h2>{num(activeItems.length)} <span>{text('items available','صنف متاح')}</span></h2><p>{unavailable.length?`${num(unavailable.length)} ${text('items are marked unavailable.','أصناف غير متوفرة حالياً.')}`:text('Your visible menu is ready for customers.','قائمتك الظاهرة جاهزة للعملاء.')}</p></div><div className="ops-menu-health-actions">{unavailable.slice(0,2).map(d=><button key={d.id} onClick={()=>onEdit(d)}>{ar?d.nameAr||d.name:d.name}<OpsIcon name="arrow" size={15}/></button>)}<button className="primary" onClick={onMenu}>{text('Manage menu','إدارة القائمة')}<OpsIcon name="arrow" size={16}/></button></div></section>}
    <p className="ops-data-note">{text('Order figures are based on this website’s car-collection orders. Paid order value uses current totals, excluding cancelled/refunded orders; it is not a payout statement.','تعتمد الأرقام على طلبات الاستلام بالسيارة من هذا الموقع. تُحتسب قيمة الطلبات المدفوعة وفق الإجماليات الحالية، باستثناء الطلبات الملغاة والمستردة، ولا تمثل كشف تسويات.')}</p>
  </div>;
}

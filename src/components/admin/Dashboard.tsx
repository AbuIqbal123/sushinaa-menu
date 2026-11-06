'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useLocale } from '@/i18n/locale';
import type { MenuData,CmsDish } from '@/cms/schema';
import { configuredBranches } from '@/branches/branches';
import { branchStatus,qatarClock } from '@/branches/hours';
import { formatMinor } from '@/lib/money';
import type { Role } from '@/cms/permissions';
import { OpsIcon,useAdminClock,useOperations } from './OperationsUI';

export type OrderIntent={status?:string;unprinted?:boolean;orderId?:string;view?:'active'|'history'};
export function Dashboard({menu,onEdit,onMenu,onOrders,onBranches,branch,role}:{menu:MenuData;onEdit:(dish:CmsDish)=>void;onMenu:()=>void;onOrders:(intent?:OrderIntent,branch?:string)=>void;onBranches:()=>void;branch:string;role:Role}){
  const {lang}=useLocale();const ar=lang==='ar';const text=(en:string,arabic:string)=>ar?arabic:en;
  const [period,setPeriod]=useState('7d'),[from,setFrom]=useState(''),[to,setTo]=useState(''),[chart,setChart]=useState<'orders'|'sales'>('orders');
  const {data,failed,valid,refresh}=useOperations(branch,period,from,to);const now=useAdminClock();
  const branches=configuredBranches(menu.branches).filter(b=>!branch||b.slug===branch);
  const num=(v:number)=>new Intl.NumberFormat(lang).format(v);const money=(v:number)=>formatMinor(v,lang);
  const mins=(v:number|null|undefined)=>v==null?'—':`${num(v)} ${text('min','د')}`;
  const counts=data?.counts;const metrics=data?.metrics;
  const activeItems=menu.dishes.filter(d=>d.visible&&d.available&&menu.categories.some(c=>c.id===d.section&&c.visible));
  const unavailable=menu.dishes.filter(d=>d.visible&&!d.available);
  const max=Math.max(1,...(data?.series??[]).map(p=>chart==='orders'?p.orders:p.salesMinor));
  const dateControls=<div className="ops-date-controls">
    <label className="sr-only" htmlFor="dashboard-period">{text('Reporting period','الفترة الزمنية')}</label>
    <select id="dashboard-period" value={period} onChange={e=>setPeriod(e.target.value)}>
      {([['today','Today','اليوم'],['yesterday','Yesterday','أمس'],['7d','Last 7 days','آخر ٧ أيام'],['30d','Last 30 days','آخر ٣٠ يوماً'],['custom','Custom dates','تواريخ مخصصة']] as const).map(([value,en,arabic])=><option key={value} value={value}>{text(en,arabic)}</option>)}
    </select>
    {period==='custom'&&<><input type="date" aria-label={text('Report from','التقرير من')} value={from} onChange={e=>setFrom(e.target.value)}/><span>–</span><input type="date" aria-label={text('Report to','التقرير إلى')} value={to} onChange={e=>setTo(e.target.value)}/></>}
  </div>;
  return <div className="ops-dashboard" aria-busy={!data&&valid&&!failed}>
    <section className="ops-layer" aria-labelledby="ops-layer-live">
      <div className="ops-section-heading"><h2 id="ops-layer-live">{text('Live','مباشر')}</h2></div>
      <section className="ops-live-strip" aria-label={text('Live order stages','مراحل الطلبات المباشرة')}>
        {([['received','New orders','طلبات جديدة','orders'],['preparing','In the kitchen','قيد التحضير','clock'],['ready','Ready for collection','جاهزة للاستلام','check']] as const).map(([key,en,arabic,icon])=><button key={key} className={`ops-live-stage stage-${key}`} onClick={()=>onOrders({status:key})}>
          <span className="ops-stage-icon"><OpsIcon name={icon} size={16}/></span><span><strong>{counts?num(counts[key]):'—'}</strong><span>{text(en,arabic)}</span></span><OpsIcon name="arrow" size={14}/>
        </button>)}
      </section>
    </section>

    <section className="ops-layer" aria-labelledby="ops-layer-performance">
      <div className="ops-section-heading"><h2 id="ops-layer-performance">{text('Performance','الأداء')}</h2>{dateControls}</div>
      {!valid&&<p className="ops-inline-message" role="status">{text('Choose a date range of up to 92 days.','اختر فترة لا تتجاوز ٩٢ يوماً.')}</p>}
      {failed&&<div className="ops-inline-message ops-message-error" role="alert">{text('Could not refresh figures. Showing the last available data.','تعذّر تحديث الأرقام. تُعرض آخر البيانات المتاحة.')}<button onClick={refresh}>{text('Retry','إعادة المحاولة')}</button></div>}
      <div className="ops-metrics">
        {[{label:text('Sales','المبيعات'),value:metrics?money(metrics.paidSalesMinor):'—',icon:'money' as const,note:text('Paid','مدفوعة')},
          {label:text('Orders','الطلبات'),value:metrics?num(metrics.orders):'—',icon:'orders' as const,note:metrics?`${num(metrics.completed)} ${text('completed','مكتملة')}`:'—'},
          {label:text('Average order','متوسط الطلب'),value:metrics?money(metrics.averageMinor):'—',icon:'menu' as const,note:text('Paid','مدفوعة')}].map(metric=><article className="ops-metric" key={metric.label}><div><span>{metric.label}</span><OpsIcon name={metric.icon}/></div><strong>{metric.value}</strong><small>{metric.note}</small></article>)}
      </div>
      <div className="ops-insight-grid ops-performance-grid">
        <section className="ops-panel ops-trend-panel"><header><div><h2>{text('Orders over time','الطلبات مع الوقت')}</h2><small>{data?`${data.range.from} to ${data.range.to}`:text('Loading…','جارٍ التحميل…')}</small></div><div className="ops-segment" aria-label={text('Chart measure','مقياس الرسم')}><button aria-pressed={chart==='orders'} onClick={()=>setChart('orders')}>{text('Orders','الطلبات')}</button><button aria-pressed={chart==='sales'} onClick={()=>setChart('sales')}>{text('Sales','المبيعات')}</button></div></header>
          <div className="ops-chart" role="group" aria-label={text('Orders over time','الطلبات مع مرور الوقت')}>
            {(data?.series??Array.from({length:12},(_,i)=>({key:String(i),orders:0,salesMinor:0}))).map((point,i)=>{
              const value=chart==='orders'?point.orders:point.salesMinor;const label=!data?'':data.hourly?`${point.key}:00`:new Date(`${point.key}T12:00:00+03:00`).toLocaleDateString(lang,{day:'numeric',month:'short',timeZone:'Asia/Qatar'});
              const description=`${label} · ${chart==='orders'?`${num(point.orders)} ${text('orders','طلبات')}`:money(point.salesMinor)}`;
              return <div className="ops-chart-column" key={point.key}><button style={{height:`${value?Math.max(5,value/max*100):2}%`}} className={value?'':'is-zero'} aria-label={description} data-tooltip={description}/><span>{i===0||i===(data?.series.length??12)-1||i%Math.ceil((data?.series.length??12)/6)===0?label:''}</span></div>;
            })}
          </div>
          {metrics?.orders===0&&<p className="ops-chart-empty">{text('No orders in this period.','لا توجد طلبات في هذه الفترة.')}</p>}
        </section>
        <section className="ops-panel ops-branch-sales-panel"><header><h2>{text('Sales by branch','المبيعات حسب الفرع')}</h2></header>
          {(()=>{
            const rows=branches.map(b=>({slug:b.slug,name:ar?b.nameAr:b.name,sales:data?.branches.find(row=>row.id===b.slug)?.salesMinor??0,orders:data?.branches.find(row=>row.id===b.slug)?.orders??0}));
            const peak=Math.max(1,...rows.map(r=>r.sales));
            return rows.some(r=>r.sales||r.orders)?<ol className="ops-branch-bars">{rows.map(row=><li key={row.slug}><div><strong>{row.name}</strong><span>{money(row.sales)} · {num(row.orders)}</span></div><span className="ops-branch-bar" aria-hidden="true"><span style={{width:`${row.sales?Math.max(4,row.sales/peak*100):0}%`}}/></span></li>)}</ol>:<div className="ops-empty-panel"><OpsIcon name="branches" size={24}/><p>{text('Branch sales will appear here.','ستظهر مبيعات الفروع هنا.')}</p></div>;
          })()}
        </section>
      </div>
    </section>

    <section className="ops-layer" aria-labelledby="ops-layer-service">
      <div className="ops-section-heading"><h2 id="ops-layer-service">{text('Service times','أوقات الخدمة')}</h2>{metrics!=null&&<small className="ops-layer-note">{num(metrics.cancelled)} {text('cancelled','ملغاة')}</small>}</div>
      <div className="ops-metrics ops-sla-metrics">
        {[{label:text('Accept','القبول'),value:mins(metrics?.acceptMinutes),tone:'received',note:text('Placed → accepted','من الطلب إلى القبول')},
          {label:text('Prep','التحضير'),value:mins(metrics?.prepMinutes),tone:'preparing',note:text('Accepted → ready','من القبول إلى الجاهزية')},
          {label:text('Collection','الاستلام'),value:mins(metrics?.collectionMinutes),tone:'ready',note:text('Ready → collected','من الجاهزية إلى الاستلام')}].map((row,i)=><article className={`ops-metric ops-sla-metric stage-${row.tone}`} key={row.tone}><div><span><span className={`ops-step step-${row.tone}`}>{i+1}</span>{row.label}</span></div><strong>{row.value}</strong><small>{row.note}</small></article>)}
      </div>
    </section>

    <section className="ops-layer ops-layer-breakdown" aria-label={text('Breakdown','التفصيل')}>
      <div className="ops-insight-grid">
        <section className="ops-panel ops-branch-panel"><header><h2>{text('Branches','الفروع')}</h2>{role==='admin'&&<button className="ops-link" onClick={onBranches}>{text('Manage','إدارة')}<OpsIcon name="arrow" size={15}/></button>}</header>
          <div className="ops-branch-list">{branches.map(b=>{const figures=data?.branches.find(row=>row.id===b.slug);const state=branchStatus(b.hours,qatarClock(new Date(now)),lang);return <button key={b.slug} className="ops-branch-row" onClick={()=>onOrders({},b.slug)}>
            <span className={`ops-branch-marker${state.open?' is-open':''}`}><OpsIcon name="branches"/></span><span className="ops-branch-name"><strong>{ar?b.nameAr:b.name}</strong><small><span className={state.open?'ops-open-dot':'ops-closed-dot'}/>{state.label}</small></span><span className="ops-branch-numbers"><strong>{num(figures?.active??0)} <small>{text('active','نشط')}</small></strong><span>{data?money(figures?.salesMinor??0):'—'}</span></span><OpsIcon name="arrow" size={16}/>
          </button>;})}</div>
        </section>
        <section className="ops-panel ops-popular-panel"><header><h2>{text('Top items','الأصناف الأكثر طلباً')}</h2></header>
          {data?.popular.length?data.popular.map((item,i)=>{const dish=menu.dishes.find(d=>d.id===item.dishId);return <div className="ops-popular-row" key={item.dishId}><span className="ops-rank">{i+1}</span>{dish?.image&&<Image src={dish.image} alt="" width={40} height={40} className="ops-food-thumb" unoptimized/>}<div><strong>{ar?item.nameAr||item.name:item.name}</strong><span className="ops-popular-track"><span style={{width:`${item.quantity/data.popular[0].quantity*100}%`}}/></span></div><strong>{num(item.quantity)}</strong></div>}):<div className="ops-empty-panel"><OpsIcon name="menu" size={24}/><p>{text('Top items will appear here.','ستظهر الأصناف الأكثر طلباً هنا.')}</p></div>}
        </section>
      </div>
    </section>

    {role==='admin'&&<section className="ops-panel ops-menu-health" aria-label={text('Menu','القائمة')}><div><h2>{num(activeItems.length)} <span>{text('items available','صنف متاح')}</span></h2><p>{unavailable.length?`${num(unavailable.length)} ${text('unavailable.','غير متوفرة.')}`:text('All visible items are available.','كل الأصناف الظاهرة متوفرة.')}</p></div><div className="ops-menu-health-actions">{unavailable.slice(0,2).map(d=><button key={d.id} onClick={()=>onEdit(d)}>{ar?d.nameAr||d.name:d.name}<OpsIcon name="arrow" size={15}/></button>)}<button className="primary" onClick={onMenu}>{text('Manage menu','إدارة القائمة')}<OpsIcon name="arrow" size={16}/></button></div></section>}
  </div>;
}

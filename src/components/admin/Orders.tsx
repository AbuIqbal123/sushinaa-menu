'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/i18n/locale';
import { configuredBranches } from '@/branches/branches';
import { nationalPhone } from '@/ordering/checkout/validation';
import { staffLabels,staffStatus,type StaffStatus } from '@/ordering/status';
import type { OrderSummary } from '@/ordering/contracts';
import { OrderDetail } from './OrderDetail';
import type { Role } from '@/cms/permissions';
import type { MenuData } from '@/cms/schema';
import { createOrderPoller } from './order-poller';
import { formatOrderNumber } from '@/ordering/order-number';
import { imageFor,selectionForDiet } from '@/ordering/price';
import { findCarBrand,carBrandName } from '@/ordering/car-brands';
import { CarBrandLogo } from '@/components/checkout/CarBrandPicker';
import { ago,OpsIcon,useAdminClock,useOperations } from './OperationsUI';
import { qatarDate } from '@/ordering/operations-calendar';
import type { OrderIntent } from './Dashboard';

type List={rows:OrderSummary[];more:boolean;newCount:number;unprintedCount?:number};
type Props={active:boolean;onUnread:(n:number)=>void;role:Role;menu:MenuData;branch?:string;view?:'active'|'history';intent?:OrderIntent&{key?:number}};
export function Orders({active,onUnread,role,menu,branch='',view='active',intent={}}:Props){
  const router=useRouter();const {lang}=useLocale();const text=(en:string,ar:string)=>lang==='ar'?ar:en;
  const [sound,setSound]=useState(true),[revision,setRevision]=useState(0),[paused,setPaused]=useState(false),[lastOk,setLastOk]=useState<string|null>(null);
  const latest=useRef<string|null>(null),unread=useRef(0),audio=useRef<HTMLAudioElement|null>(null),activeRef=useRef(active),soundRef=useRef(sound);
  useEffect(()=>{activeRef.current=active;if(active){unread.current=0;onUnread(0);}},[active,onUnread]);
  useEffect(()=>{soundRef.current=sound;},[sound]);
  useEffect(()=>{const chime=new Audio('/order-chime.wav');chime.preload='auto';audio.current=chime;
    const timer=setTimeout(()=>{try{setSound(localStorage.getItem('sushinaa-order-sound')!=='false');}catch{/* Optional preference. */}},0);
    const unlock=()=>{if(!soundRef.current||!chime.paused)return;chime.muted=true;void chime.play().then(()=>{chime.pause();chime.currentTime=0;chime.muted=false;document.removeEventListener('pointerdown',unlock,true);document.removeEventListener('keydown',unlock,true);}).catch(()=>{chime.muted=false;});};
    document.addEventListener('pointerdown',unlock,true);document.addEventListener('keydown',unlock,true);
    return()=>{clearTimeout(timer);chime.pause();document.removeEventListener('pointerdown',unlock,true);document.removeEventListener('keydown',unlock,true);};
  },[]);
  useEffect(()=>{let live=true,initial=true;const controller=new AbortController();const poller=createOrderPoller({hidden:()=>document.hidden,onUnauthorized:()=>router.push('/admin/login'),poll:async()=>{
    try{const r=await fetch(`/api/admin/orders?${latest.current?`since=${latest.current}`:'limit=1'}`,{cache:'no-store',signal:controller.signal});if(r.status===401)return 'unauthorized';const body:List=await r.json();if(!r.ok)throw Error('Unavailable');if(!live)return 'ok';setPaused(false);setLastOk(new Date().toISOString());
      if(body.rows.length){const count=initial?0:latest.current?body.newCount:body.rows.length;latest.current=body.rows[0].id;if(count&&!activeRef.current){unread.current+=count;onUnread(unread.current);}if(count&&soundRef.current)void audio.current?.play().catch(()=>{});}
      if(!initial&&activeRef.current)setRevision(v=>v+1);initial=false;return 'ok';
    }catch{if(live)setPaused(true);return 'fail';}
  }});void poller.start();const visible=()=>{if(!document.hidden)void poller.wake();};document.addEventListener('visibilitychange',visible);
    return()=>{live=false;controller.abort();poller.stop();document.removeEventListener('visibilitychange',visible);};
  },[onUnread,router]);
  const refresh=useCallback(()=>setRevision(v=>v+1),[]);
  if(!active)return null;
  return <section className="staff-orders ops-orders" dir={lang==='ar'?'rtl':'ltr'}>
    <div className="ops-order-tools"><div className={`ops-connection${paused?' is-paused':''}`} role="status"><span className="ops-live-dot"/>{paused?text('Updates paused · retrying','التحديثات متوقفة · جارٍ إعادة المحاولة'):text('Live updates','تحديثات مباشرة')}{lastOk&&<small>{new Date(lastOk).toLocaleTimeString(lang,{timeZone:'Asia/Qatar',hour:'2-digit',minute:'2-digit'})}</small>}</div>
      <div><button className="ops-quiet-button" aria-pressed={sound} onClick={()=>{const next=!sound;soundRef.current=next;setSound(next);try{localStorage.setItem('sushinaa-order-sound',String(next));}catch{/* Optional. */}if(next)void audio.current?.play().catch(()=>{});}}><OpsIcon name={sound?'sound':'muted'} size={18}/>{sound?text('Sound on','الصوت مفعّل'):text('Enable sound','تفعيل الصوت')}</button><button className="ops-quiet-button" onClick={refresh}><OpsIcon name="refresh" size={17}/>{text('Refresh','تحديث')}</button></div>
    </div>
    <OrderWorkspace key={`${view}:${branch}:${intent.key??0}`} view={view} branch={branch} role={role} menu={menu} revision={revision} refresh={refresh} intent={intent}/>
  </section>;
}
function historyDate(offset=0){return qatarDate(new Date(Date.now()+offset*86400000));}
function OrderWorkspace({view,branch,role,menu,revision,refresh,intent}:{view:'active'|'history';branch:string;role:Role;menu:MenuData;revision:number;refresh:()=>void;intent:OrderIntent}){
  const {lang}=useLocale();const ar=lang==='ar';const text=(en:string,arabic:string)=>ar?arabic:en;const branches=configuredBranches(menu.branches);
  const history=view==='history';const [status,setStatus]=useState(intent.status??''),[unprinted,setUnprinted]=useState(Boolean(intent.unprinted));
  const [from,setFrom]=useState(history?historyDate(-6):''),[to,setTo]=useState(history?historyDate():''),[period,setPeriod]=useState('7d');
  const [q,setQ]=useState(''),[search,setSearch]=useState(''),[page,setPage]=useState(1),[result,setResult]=useState<{key:string;data:List}|null>(null),[detail,setDetail]=useState<string|null>(null),[error,setError]=useState('');
  const now=useAdminClock();const {data:operations,refresh:refreshCounts}=useOperations(branch,'today','','',!history);
  const refreshAll=useCallback(()=>{refresh();refreshCounts();},[refresh,refreshCounts]);
  const query=new URLSearchParams({page:String(page),limit:history?'25':'50',view});
  for(const [key,value] of Object.entries({branch,status,from:history?from:'',to:history?to:'',q:search,unprinted:unprinted&&!history?'1':''}))if(value)query.set(key,value);
  const queryKey=query.toString();const valid=!history||Boolean(from&&to&&from<=to&&(Date.parse(to)-Date.parse(from))/86400000<92);
  useEffect(()=>{const timer=setTimeout(()=>{setSearch(q.trim());setPage(1);},200);return()=>clearTimeout(timer);},[q]);
  useEffect(()=>{if(!valid)return;const controller=new AbortController();fetch(`/api/admin/orders?${queryKey}`,{cache:'no-store',signal:controller.signal}).then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.code);setResult({key:queryKey,data:body});setError('');}).catch(e=>{if(e.name!=='AbortError')setError(e.message==='INVALID'?'INVALID':'LOAD_FAILED');});return()=>controller.abort();},[queryKey,revision,valid]);
  const num=(value:number)=>new Intl.NumberFormat(lang).format(value);const counts=operations?.counts;
  const selectStatus=(value:string)=>{setStatus(value);setPage(1);};
  const filters=history?['','collected','cancelled']:['','received','preparing','ready'];
  const filteredData=valid&&result?.key===queryKey?result.data:null;
  return <>
    <div className="ops-order-filterbar"><div className="ops-status-tabs" aria-label={text('Order status','حالة الطلب')}>
      {filters.map(value=><button key={value} aria-pressed={status===value} onClick={()=>selectStatus(value)} className={`ops-status-tab status-tab-${value||'all'}`}>{value?staffLabels[value as StaffStatus][lang]:history?text('All history','كل السجل'):text('All active','كل النشطة')}{!history&&counts&&<span>{num(value?counts[value as 'received'|'preparing'|'ready']:counts.active)}</span>}</button>)}
    </div><div className="ops-order-search"><OpsIcon name="search" size={18}/><input type="search" maxLength={80} value={q} onChange={e=>setQ(e.target.value)} aria-label={text('Search orders','البحث في الطلبات')} placeholder={text('Order, name, phone or plate','رقم الطلب، الاسم، الجوال أو اللوحة')}/></div></div>
    {history?<div className="ops-history-tools"><select aria-label={text('History period','فترة السجل')} value={period} onChange={e=>{const value=e.target.value;setPeriod(value);setPage(1);if(value!=='custom'){setFrom(historyDate(value==='today'?0:value==='yesterday'?-1:value==='30d'?-29:-6));setTo(historyDate(value==='yesterday'?-1:0));}}}>
      <option value="today">{text('Today','اليوم')}</option><option value="yesterday">{text('Yesterday','أمس')}</option><option value="7d">{text('Last 7 days','آخر ٧ أيام')}</option><option value="30d">{text('Last 30 days','آخر ٣٠ يوماً')}</option><option value="custom">{text('Custom dates','تواريخ مخصصة')}</option></select>
      <label>{text('From','من')}<input type="date" value={from} onChange={e=>{setFrom(e.target.value);setPeriod('custom');setPage(1);}}/></label><label>{text('To','إلى')}<input type="date" value={to} onChange={e=>{setTo(e.target.value);setPeriod('custom');setPage(1);}}/></label>
      {valid&&<a className="ops-export" href={`/api/admin/orders/export?${queryKey}`}><OpsIcon name="export" size={17}/>{text('Export CSV','تصدير CSV')}</a>}
    </div>:<div className="ops-queue-caption"><span>{text('Oldest orders first · Select an order to manage it','الأقدم أولاً · اختر طلباً لإدارته')}</span><button aria-pressed={unprinted} className="ops-unprinted-toggle" onClick={()=>{setUnprinted(v=>!v);setPage(1);}}><OpsIcon name="print" size={16}/>{text('Not printed','لم تُطبع')} {counts?num(counts.unprinted):''}</button></div>}
    {!valid&&<p className="ops-inline-message" role="status">{text('Choose a valid date range of up to 92 days.','اختر فترة صحيحة لا تتجاوز ٩٢ يوماً.')}</p>}
    {error&&<div role="alert" className="staff-error">{error==='INVALID'?text('Check the filters and date range.','تحقق من عوامل التصفية والفترة الزمنية.'):text('Unable to load orders.','تعذّر تحميل الطلبات.')} <button onClick={refresh}>{text('Retry','إعادة المحاولة')}</button></div>}
    {!filteredData&&!error&&valid&&<div className="ops-orders-loading"><span className="ops-loading-dot"/>{text('Loading your orders…','جارٍ تحميل الطلبات…')}</div>}
    <div className={`ops-order-workspace${detail?' has-detail':''}${history?' is-history':''}`}>
      <div className="ops-order-queue">
        {filteredData?.rows.length===0&&<div className="ops-empty-panel ops-queue-empty"><span className="ops-empty-mark"><OpsIcon name={history?'history':'orders'} size={36}/></span><h2>{history?text('No orders in this view','لا توجد طلبات في هذا العرض'):text('The kitchen is all caught up','كل الطلبات قيد المتابعة')}</h2><p>{search||status||unprinted?text('Try changing your filters.','جرّب تغيير عوامل التصفية.'):history?text('Completed and cancelled orders will appear here.','ستظهر الطلبات المستلمة والملغاة هنا.'):text('New car-collection orders will appear here automatically.','ستظهر طلبات الاستلام بالسيارة الجديدة هنا تلقائياً.')}</p></div>}
        {!history&&filteredData?.rows.slice().sort((a,b)=>Date.parse(a.paidAt??a.createdAt)-Date.parse(b.paidAt??b.createdAt)).map(row=>{const group=staffStatus(row.status),b=branches.find(b=>b.slug===row.branchId);const brand=findCarBrand(row.brandId??'');return <button className={`ops-order-card card-${group}${detail===row.id?' is-selected':''}`} key={row.id} data-order-id={row.id} aria-pressed={detail===row.id} onClick={()=>setDetail(row.id)}>
          <div className="ops-card-top"><strong dir="ltr">#{formatOrderNumber(row.orderNumber)}</strong><span className={`staff-status status-${group}`}>{staffLabels[group][lang]}</span><time>{ago(row.statusAt??row.paidAt??row.createdAt,now,lang)}</time></div>
          <div className="ops-card-customer"><strong>{row.name}</strong>{!branch&&<span>{ar?b?.nameAr:b?.name}</span>}</div>
          <div className="ops-card-vehicle"><CarBrandLogo brand={brand}/><strong dir="ltr">{row.plate}</strong><span>{carBrandName(row.brandId??'',lang)}</span></div>
          <div className="ops-card-items">{row.items?.map((item,i)=>{const dish=menu.dishes.find(d=>d.id===item.dishId);const photo=dish?imageFor(dish,item.selection??selectionForDiet(dish,'all')):undefined;return <span key={`${item.dishId}-${i}`} className="ops-card-item">{photo&&<Image src={photo} alt="" width={34} height={34} unoptimized/>}<span>{item.quantity} × {ar?item.nameAr||item.name:item.name}</span></span>;})}{(row.itemCount??0)>(row.items??[]).reduce((sum,item)=>sum+item.quantity,0)&&<span className="ops-more-items">+{(row.itemCount??0)-(row.items??[]).reduce((sum,item)=>sum+item.quantity,0)} {text('more items','أصناف أخرى')}</span>}</div>
          <div className="ops-card-bottom"><div>{row.hasNotes&&<span className="ops-notes-badge">{text('Special requests','طلبات خاصة')}</span>}{!row.printedAt&&<span className="ops-print-badge"><OpsIcon name="print" size={13}/>{text('Not printed','لم تُطبع')}</span>}</div><strong><small className="ops-payment-badge">{row.paidAt?text('Paid','مدفوع'):text('Pay at pickup','الدفع عند الاستلام')}</small>{(row.totalMinor/100).toFixed(2)} {text('QAR','ر.ق')}</strong></div>
        </button>;})}
        {history&&filteredData&&filteredData.rows.length>0&&<div className="staff-order-list ops-history-table"><table><thead><tr><th>{text('Order','الطلب')}</th>{!branch&&<th>{text('Branch','الفرع')}</th>}<th>{text('Customer','العميل')}</th><th>{text('Status','الحالة')}</th><th>{text('Placed','وقت الطلب')}</th><th>{text('Total','الإجمالي')}</th></tr></thead><tbody>{filteredData.rows.map(row=><tr key={row.id} data-order-id={row.id} onClick={()=>setDetail(row.id)}><td data-label={text('Order','الطلب')}><button className="ops-table-order" dir="ltr" onClick={()=>setDetail(row.id)}>#{formatOrderNumber(row.orderNumber)}</button></td>{!branch&&<td data-label={text('Branch','الفرع')}>{ar?branches.find(b=>b.slug===row.branchId)?.nameAr:branches.find(b=>b.slug===row.branchId)?.name}</td>}<td data-label={text('Customer','العميل')}>{row.name}<small dir="ltr">{nationalPhone(row.phone)}</small></td><td data-label={text('Status','الحالة')}><span className={`staff-status status-${staffStatus(row.status)}`}>{staffLabels[staffStatus(row.status)][lang]}</span></td><td data-label={text('Placed','وقت الطلب')}>{new Date(row.createdAt).toLocaleString(lang,{timeZone:'Asia/Qatar',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</td><td data-label={text('Total','الإجمالي')} dir="ltr">{(row.totalMinor/100).toFixed(2)} {text('QAR','ر.ق')}</td></tr>)}</tbody></table></div>}
        {filteredData&&(page>1||filteredData.more)&&<nav className="admin-pager"><button disabled={page===1} onClick={()=>setPage(v=>v-1)}>{text('Previous','السابق')}</button><span>{num(page)}</span><button disabled={!filteredData.more} onClick={()=>setPage(v=>v+1)}>{text('Next','التالي')}</button></nav>}
      </div>
      {detail?<div className="ops-order-detail-pane"><OrderDetail key={detail} id={detail} role={role} menu={menu} onBack={()=>setDetail(null)} onChange={refreshAll} refreshKey={revision}/></div>:!history&&Boolean(filteredData?.rows.length)&&<div className="ops-detail-placeholder"><span className="ops-empty-mark"><OpsIcon name="car" size={40}/></span><h2>{text('Every order, clearly in view','كل طلب أمامك بوضوح')}</h2><p>{text('Select an order to see its items, car details and next action.','اختر طلباً لعرض أصنافه وبيانات السيارة والإجراء التالي.')}</p></div>}
    </div>
  </>;
}

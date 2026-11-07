'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/i18n/locale';
import { configuredBranches } from '@/branches/branches';
import { nationalPhone } from '@/ordering/checkout/validation';
import { staffLabels,staffStatus,type StaffStatus } from '@/ordering/status';
import type { OrderSummary } from '@/ordering/contracts';
import { OrderDetail } from './OrderDetail';
import { StatusBadge } from './StatusBadge';
import type { Role } from '@/cms/permissions';
import type { MenuData } from '@/cms/schema';
import { createOrderPoller } from './order-poller';
import { formatOrderNumber } from '@/ordering/order-number';
import { formatQatarDateTime } from '@/lib/datetime';
import { OpsIcon,useOperations } from './OperationsUI';
import { qatarDate } from '@/ordering/operations-calendar';
import type { OrderIntent } from './Dashboard';

type List={rows:OrderSummary[];more:boolean;newCount:number;arrivedCount?:number;unprintedCount?:number};
type Props={active:boolean;onUnread:(n:number)=>void;role:Role;menu:MenuData;branch?:string;view?:'active'|'history';intent?:OrderIntent&{key?:number}};
export function Orders({active,onUnread,role,menu,branch='',view='active',intent={}}:Props){
  const router=useRouter();const {lang}=useLocale();const text=(en:string,ar:string)=>lang==='ar'?ar:en;
  const [sound,setSound]=useState(true),[revision,setRevision]=useState(0),[paused,setPaused]=useState(false),[lastOk,setLastOk]=useState<string|null>(null);
  const latest=useRef<string|null>(null),arrivedCursor=useRef<string|null>(null),unread=useRef(0),audio=useRef<HTMLAudioElement|null>(null),arrivedAudio=useRef<HTMLAudioElement|null>(null),activeRef=useRef(active),soundRef=useRef(sound),viewRef=useRef(view);
  useEffect(()=>{activeRef.current=active;if(active){unread.current=0;onUnread(0);}},[active,onUnread]);
  useEffect(()=>{soundRef.current=sound;},[sound]);
  useEffect(()=>{viewRef.current=view;},[view]);
  useEffect(()=>{
    const chime=new Audio('/order-chime.wav');chime.preload='auto';audio.current=chime;
    const arrived=new Audio('/arrived-chime.wav');arrived.preload='auto';arrivedAudio.current=arrived;
    const timer=setTimeout(()=>{try{setSound(localStorage.getItem('sushinaa-order-sound')!=='false');}catch{/* Optional preference. */}},0);
    const unlock=()=>{
      if(!soundRef.current)return;
      for(const clip of [chime,arrived]){
        if(!clip.paused)continue;
        clip.muted=true;void clip.play().then(()=>{clip.pause();clip.currentTime=0;clip.muted=false;}).catch(()=>{clip.muted=false;});
      }
      document.removeEventListener('pointerdown',unlock,true);document.removeEventListener('keydown',unlock,true);
    };
    document.addEventListener('pointerdown',unlock,true);document.addEventListener('keydown',unlock,true);
    return()=>{clearTimeout(timer);chime.pause();arrived.pause();document.removeEventListener('pointerdown',unlock,true);document.removeEventListener('keydown',unlock,true);};
  },[]);
  useEffect(()=>{let live=true,initial=true;const controller=new AbortController();
    // Keep polling while this tab is open but unfocused so arrival/new-order chimes still fire.
    const poller=createOrderPoller({hidden:()=>false,onUnauthorized:()=>router.push('/admin/login'),poll:async()=>{
    try{
      const params=new URLSearchParams(latest.current?{since:latest.current}:{limit:'1'});
      if(arrivedCursor.current)params.set('arrivedSince',arrivedCursor.current);
      const r=await fetch(`/api/admin/orders?${params}`,{cache:'no-store',signal:controller.signal});if(r.status===401)return 'unauthorized';const body:List=await r.json();if(!r.ok)throw Error('Unavailable');if(!live)return 'ok';setPaused(false);setLastOk(new Date().toISOString());
      const arrived=initial?0:(body.arrivedCount??0);
      let newOrders=0;
      if(body.rows.length){newOrders=initial?0:latest.current?body.newCount:body.rows.length;latest.current=body.rows[0].id;if(newOrders&&!activeRef.current){unread.current+=newOrders;onUnread(unread.current);}}
      if(soundRef.current){
        if(arrived)void arrivedAudio.current?.play().catch(()=>{});
        else if(newOrders)void audio.current?.play().catch(()=>{});
      }
      if(!initial&&activeRef.current&&viewRef.current==='active')setRevision(v=>v+1);
      arrivedCursor.current=new Date().toISOString();
      initial=false;return 'ok';
    }catch{if(live)setPaused(true);return 'fail';}
  }});void poller.start();
    return()=>{live=false;controller.abort();poller.stop();};
  },[onUnread,router]);
  const refresh=useCallback(()=>setRevision(v=>v+1),[]);
  if(!active)return null;
  return <section className="staff-orders ops-orders" dir={lang==='ar'?'rtl':'ltr'}>
    {paused&&<div className="ops-order-tools"><div className="ops-connection is-paused" role="status"><span className="ops-live-dot"/>{text('Updates paused · retrying','التحديثات متوقفة · جارٍ إعادة المحاولة')}{lastOk&&<small>{new Date(lastOk).toLocaleTimeString(lang,{timeZone:'Asia/Qatar',hour:'numeric',minute:'2-digit',hour12:true})}</small>}</div></div>}
    <OrderWorkspace key={`${view}:${branch}:${intent.key??0}`} view={view} branch={branch} role={role} menu={menu} revision={revision} refresh={refresh} intent={intent} sound={sound} onSound={()=>{const next=!sound;soundRef.current=next;setSound(next);try{localStorage.setItem('sushinaa-order-sound',String(next));}catch{/* Optional. */}if(next)void audio.current?.play().catch(()=>{});}}/>
  </section>;
}
function historyDate(offset=0){return qatarDate(new Date(Date.now()+offset*86400000));}
function applyPeriod(value:string,setFrom:(v:string)=>void,setTo:(v:string)=>void){
  if(value==='all'){setFrom('');setTo('');return;}
  if(value==='custom')return;
  setFrom(historyDate(value==='today'?0:value==='yesterday'?-1:value==='30d'?-29:value==='7d'?-6:-6));
  setTo(historyDate(value==='yesterday'?-1:0));
}
function OrderWorkspace({view,branch,role,menu,revision,refresh,intent,sound,onSound}:{view:'active'|'history';branch:string;role:Role;menu:MenuData;revision:number;refresh:()=>void;intent:OrderIntent;sound:boolean;onSound:()=>void}){
  const {lang}=useLocale();const ar=lang==='ar';const text=(en:string,arabic:string)=>ar?arabic:en;const branches=configuredBranches(menu.branches);
  const history=view==='history';const [status,setStatus]=useState(intent.status??''),[unprinted,setUnprinted]=useState(Boolean(intent.unprinted));
  // Deep-link from Coupons: open detail, search that id, and drop the default 30d history window.
  const deepLink=Boolean(intent.orderId);
  const [from,setFrom]=useState(history&&!deepLink?historyDate(-29):''),[to,setTo]=useState(history&&!deepLink?historyDate():''),[period,setPeriod]=useState(history&&!deepLink?'30d':'all');
  const [q,setQ]=useState(intent.orderId??''),[search,setSearch]=useState(intent.orderId??''),[page,setPage]=useState(1),[result,setResult]=useState<{key:string;data:List}|null>(null),[detail,setDetail]=useState<string|null>(intent.orderId??null),[error,setError]=useState('');
  const {data:operations,refresh:refreshCounts}=useOperations(branch,'today','','',!history);
  const refreshAll=useCallback(()=>{refresh();refreshCounts();},[refresh,refreshCounts]);
  const query=new URLSearchParams({page:String(page),limit:history?'25':'50',view});
  for(const [key,value] of Object.entries({branch,status,from,to,q:search,unprinted:unprinted&&!history?'1':''}))if(value)query.set(key,value);
  const queryKey=query.toString();
  const hasDates=Boolean(from||to);
  const valid=!hasDates||Boolean(from&&to&&from<=to&&(Date.parse(to)-Date.parse(from))/86400000<92);
  useEffect(()=>{const timer=setTimeout(()=>{setSearch(q.trim());setPage(1);},200);return()=>clearTimeout(timer);},[q]);
  useEffect(()=>{if(!valid)return;const controller=new AbortController();fetch(`/api/admin/orders?${queryKey}`,{cache:'no-store',signal:controller.signal}).then(async r=>{const body=await r.json();if(!r.ok)throw Error(body.code);setResult({key:queryKey,data:body});setError('');}).catch(e=>{if(e.name!=='AbortError')setError(e.message==='INVALID'?'INVALID':'LOAD_FAILED');});return()=>controller.abort();},[queryKey,revision,valid]);
  const num=(value:number)=>new Intl.NumberFormat(lang).format(value);const counts=operations?.counts;
  const selectStatus=(value:string)=>{setStatus(value);setPage(1);};
  const openOrder=(id:string)=>setDetail(cur=>cur===id?null:id);
  const filters=history?['','collected','cancelled']:['','received','preparing','ready'];
  const filteredData=valid&&result?.key===queryKey?result.data:null;
  return <>
    <div className="ops-order-filterbar">
      <div className="ops-status-tabs" aria-label={text('Order status','حالة الطلب')}>
        {filters.map(value=><button key={value} aria-pressed={status===value} onClick={()=>selectStatus(value)} className={`ops-status-tab status-tab-${value||'all'}`}>{value?staffLabels[value as StaffStatus][lang]:history?text('All history','كل السجل'):text('All active','كل النشطة')}{!history&&counts&&<span>{num(value?counts[value as 'received'|'preparing'|'ready']:counts.active)}</span>}</button>)}
      </div>
      <div className="ops-order-controls">
        <div className="ops-order-search"><OpsIcon name="search" size={16}/><input type="search" maxLength={80} value={q} onChange={e=>setQ(e.target.value)} aria-label={text('Search orders','البحث في الطلبات')} placeholder={text('Search…','بحث…')}/></div>
        <select aria-label={history?text('History period','فترة السجل'):text('Date filter','تصفية التاريخ')} value={period} onChange={e=>{const value=e.target.value;setPeriod(value);setPage(1);applyPeriod(value,setFrom,setTo);}}>
          {!history&&<option value="all">{text('All dates','كل التواريخ')}</option>}
          <option value="today">{text('Today','اليوم')}</option>
          <option value="yesterday">{text('Yesterday','أمس')}</option>
          <option value="7d">{text('Last 7 days','آخر ٧ أيام')}</option>
          <option value="30d">{text('Last 30 days','آخر ٣٠ يوماً')}</option>
          <option value="custom">{text('Custom dates','تواريخ مخصصة')}</option>
        </select>
        {period==='custom'&&<><input type="date" aria-label={text('From','من')} value={from} onChange={e=>{setFrom(e.target.value);setPage(1);}}/><input type="date" aria-label={text('To','إلى')} value={to} onChange={e=>{setTo(e.target.value);setPage(1);}}/></>}
        {!history&&<button type="button" aria-pressed={unprinted} className="ops-unprinted-toggle" onClick={()=>{setUnprinted(v=>!v);setPage(1);}}><OpsIcon name="print" size={15}/>{text('Not printed','لم تُطبع')}{counts?` ${num(counts.unprinted)}`:''}</button>}
        {!history&&<button type="button" className="ops-quiet-button" aria-pressed={sound} onClick={onSound} title={sound?text('Sound on','الصوت مفعّل'):text('Enable sound','تفعيل الصوت')}><OpsIcon name={sound?'sound':'muted'} size={16}/></button>}
        <button type="button" className="ops-quiet-button" onClick={refresh} title={text('Refresh','تحديث')}><OpsIcon name="refresh" size={16}/></button>
        {history&&valid&&<a className="ops-export" href={`/api/admin/orders/export?${queryKey}`}><OpsIcon name="export" size={15}/>{text('Export CSV','تصدير CSV')}</a>}
      </div>
    </div>
    {!valid&&<p className="ops-inline-message" role="status">{text('Choose a valid date range of up to 92 days.','اختر فترة صحيحة لا تتجاوز ٩٢ يوماً.')}</p>}
    {error&&<div role="alert" className="staff-error">{error==='INVALID'?text('Check the filters and date range.','تحقق من عوامل التصفية والفترة الزمنية.'):text('Unable to load orders.','تعذّر تحميل الطلبات.')} <button onClick={refresh}>{text('Retry','إعادة المحاولة')}</button></div>}
    {!filteredData&&!error&&valid&&<div className="ops-orders-loading"><span className="ops-loading-dot"/>{text('Loading your orders…','جارٍ تحميل الطلبات…')}</div>}
    <div className={`ops-order-workspace${detail?' has-detail':''}${history?' is-history':''}`}>
      <div className="ops-order-queue">
        {filteredData?.rows.length===0&&<div className="ops-empty-panel ops-queue-empty"><span className="ops-empty-mark"><OpsIcon name={history?'history':'orders'} size={36}/></span><h2>{history?text('No closed orders in this period','لا توجد طلبات مغلقة في هذه الفترة'):text('The kitchen is all caught up','كل الطلبات قيد المتابعة')}</h2><p>{search||status||unprinted||hasDates?text('Try changing your filters.','جرّب تغيير عوامل التصفية.'):history?text('Completed and cancelled orders appear here as soon as they close.','ستظهر الطلبات المكتملة والملغاة هنا فور إغلاقها.'):text('New pickup orders will appear here automatically.','ستظهر طلبات الاستلام الجديدة هنا تلقائياً.')}</p></div>}
        {!history&&filteredData&&filteredData.rows.length>0&&<div className="staff-order-list ops-history-table ops-live-table"><table><thead><tr><th>{text('Order','الطلب')}</th><th>{text('Customer','العميل')}</th><th>{text('Plate','اللوحة')}</th><th>{text('Status','الحالة')}</th></tr></thead><tbody>{filteredData.rows.map(row=>{const group=staffStatus(row.status);const b=branches.find(x=>x.slug===row.branchId);const flags=[!branch&&b?(ar?b.nameAr:b.name):'',row.arrivedAt?text('Arrived','وصل'):'',!row.printedAt?text('Not printed','لم تُطبع'):'',row.hasNotes?text('Notes','ملاحظات'):''].filter(Boolean).join(' · ');return <tr key={row.id} data-order-id={row.id} className={`${detail===row.id?'is-selected':''}${row.arrivedAt?' is-arrived':''}`} title={flags||undefined} onClick={()=>openOrder(row.id)}><td data-label={text('Order','الطلب')}><button type="button" className="ops-table-order" dir="ltr" onClick={e=>{e.stopPropagation();openOrder(row.id);}}>#{formatOrderNumber(row.orderNumber)}</button>{!row.printedAt&&<span className="ops-flag" aria-label={text('Not printed','لم تُطبع')}>·</span>}{row.hasNotes&&<span className="ops-flag is-note" aria-label={text('Notes','ملاحظات')}>!</span>}</td><td data-label={text('Customer','العميل')} className="ops-cell-clip">{row.name}{!branch&&b?<small>{ar?b.nameAr:b.name}</small>:null}</td><td data-label={text('Plate','اللوحة')} dir="ltr">{row.plate}</td><td data-label={text('Status','الحالة')}>{row.arrivedAt?<StatusBadge status="arrived">{text('Arrived','وصل')}</StatusBadge>:<StatusBadge status={group}>{staffLabels[group][lang]}</StatusBadge>}</td></tr>;})}</tbody></table></div>}
        {history&&filteredData&&filteredData.rows.length>0&&<div className="staff-order-list ops-history-table"><table><thead><tr><th>{text('Order','الطلب')}</th>{!branch&&<th>{text('Branch','الفرع')}</th>}<th>{text('Customer','العميل')}</th><th>{text('Status','الحالة')}</th><th>{text('Closed','وقت الإغلاق')}</th><th>{text('Total','الإجمالي')}</th></tr></thead><tbody>{filteredData.rows.map(row=><tr key={row.id} data-order-id={row.id} className={detail===row.id?'is-selected':''} onClick={()=>openOrder(row.id)}><td data-label={text('Order','الطلب')}><button type="button" className="ops-table-order" dir="ltr" onClick={e=>{e.stopPropagation();openOrder(row.id);}}>#{formatOrderNumber(row.orderNumber)}</button></td>{!branch&&<td data-label={text('Branch','الفرع')}>{ar?branches.find(b=>b.slug===row.branchId)?.nameAr:branches.find(b=>b.slug===row.branchId)?.name}</td>}<td data-label={text('Customer','العميل')}>{row.name}<small dir="ltr">{nationalPhone(row.phone)}</small></td><td data-label={text('Status','الحالة')}><StatusBadge status={staffStatus(row.status)}>{staffLabels[staffStatus(row.status)][lang]}</StatusBadge></td><td data-label={text('Closed','وقت الإغلاق')}>{formatQatarDateTime(row.statusAt??row.createdAt)}</td><td data-label={text('Total','الإجمالي')} dir="ltr">{(row.totalMinor/100).toFixed(2)} {text('QAR','ر.ق')}</td></tr>)}</tbody></table></div>}
        {filteredData&&(page>1||filteredData.more)&&<nav className="admin-pager"><button disabled={page===1} onClick={()=>setPage(v=>v-1)}>{text('Previous','السابق')}</button><span>{num(page)}</span><button disabled={!filteredData.more} onClick={()=>setPage(v=>v+1)}>{text('Next','التالي')}</button></nav>}
      </div>
      {detail?<div className="ops-order-detail-pane"><OrderDetail key={detail} id={detail} role={role} menu={menu} closeOnTerminal={!history} onBack={()=>setDetail(null)} onChange={refreshAll} refreshKey={revision}/></div>:!history&&Boolean(filteredData?.rows.length)&&<div className="ops-detail-placeholder"><span className="ops-empty-mark"><OpsIcon name="car" size={40}/></span><h2>{text('Select an order','اختر طلباً')}</h2><p>{text('Items, car details, and the next kitchen action show here.','تظهر الأصناف وبيانات السيارة والإجراء التالي هنا.')}</p></div>}
    </div>
  </>;
}

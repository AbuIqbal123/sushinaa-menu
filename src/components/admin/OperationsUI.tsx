'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createOrderPoller } from './order-poller';
import type { OperationsData } from '@/ordering/operations-contracts';

const paths={
 dashboard:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
 orders:'M7 4h10l2 3v14H5V7zM5 7h14M9 11h6M9 15h4',
 history:'M3 11a9 9 0 1 1 2.6 7M3 4v7h7M12 7v5l3 2',
 menu:'M4 4h16v16H4zM8 8h8M8 12h8M8 16h5',
 categories:'M3 4h6v6H3zM15 4h6v6h-6zM3 16h6v5H3zM15 16h6v5h-6z',
 branches:'M3 10l2-6h14l2 6M3 10h18M5 10v11h14V10M10 21v-7h4v7',
 users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M18 8a3 3 0 0 1 0 6M22 21v-2a4 4 0 0 0-3-4',
 settings:'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 activity:'M3 12h4l3-8 4 16 3-8h4',
 clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l3 2',
 arrow:'M5 12h14M14 7l5 5-5 5',
 check:'M4 12l5 5L20 6',
 search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
 refresh:'M20 7a9 9 0 0 0-15-2L2 8M2 2v6h6M4 17a9 9 0 0 0 15 2l3-3M22 22v-6h-6',
 export:'M12 3v12M7 8l5-5 5 5M4 14v7h16v-7',
 close:'M5 5l14 14M19 5L5 19',
 hamburger:'M4 6h16M4 12h16M4 18h16',
 logout:'M9 4H4v16h5M9 12h12M16 7l5 5-5 5',
 sound:'M11 4L5 9H2v6h3l6 5V4M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14',
 muted:'M11 4L5 9H2v6h3l6 5V4M16 9l6 6M22 9l-6 6',
 alert:'M12 3L2 21h20L12 3M12 9v5M12 17v1',
 car:'M4 10l3-6h10l3 6M3 10h18v8H3zM5 18v3M19 18v3M6 14h2M16 14h2',
 print:'M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v7H6zM17 11h1',
 money:'M3 5h18v14H3zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M6 9v6M18 9v6',
};
export type OpsIconName=keyof typeof paths;
export function OpsIcon({name,size=20}:{name:OpsIconName;size?:number}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;}
export function useOperations(branch:string,period='today',from='',to='',active=true){
  const router=useRouter();const query=new URLSearchParams({period});if(branch)query.set('branch',branch);if(period==='custom'){if(from)query.set('from',from);if(to)query.set('to',to);}
  const key=query.toString();const valid=period!=='custom'||Boolean(from&&to&&from<=to&&(Date.parse(to)-Date.parse(from))/86400000<92);
  const [result,setResult]=useState<{key:string;data:OperationsData}|null>(null);const [failed,setFailed]=useState(false);const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    if(!active||!valid)return;let live=true;const controller=new AbortController();
    const poller=createOrderPoller({hidden:()=>document.hidden,onUnauthorized:()=>router.push('/admin/login'),poll:async()=>{
      try{const r=await fetch(`/api/admin/operations?${key}`,{cache:'no-store',signal:controller.signal});if(r.status===401)return 'unauthorized';if(!r.ok)throw Error('Unavailable');const data=await r.json() as OperationsData;if(live){setResult({key,data});setFailed(false);}return 'ok';}
      catch{if(live)setFailed(true);return 'fail';}
    }});void poller.start();const wake=()=>{if(!document.hidden)void poller.wake();};document.addEventListener('visibilitychange',wake);
    return()=>{live=false;controller.abort();poller.stop();document.removeEventListener('visibilitychange',wake);};
  },[key,active,valid,refresh,router]);
  const reload=useCallback(()=>setRefresh(v=>v+1),[]);
  return {data:result?.key===key?result.data:null,failed,valid,refresh:reload};
}
export function useAdminClock(){const [now,setNow]=useState(0);useEffect(()=>{const first=setTimeout(()=>setNow(Date.now()),0);const timer=setInterval(()=>setNow(Date.now()),30000);return()=>{clearTimeout(first);clearInterval(timer);};},[]);return now;}
export function ago(at:string|null|undefined,now:number,lang:'en'|'ar'){
  if(!at)return '—';const m=Math.max(0,Math.floor((now-Date.parse(at))/60000));const num=new Intl.NumberFormat(lang).format(m);return lang==='ar'?`${num} د`:`${num} min`;
}

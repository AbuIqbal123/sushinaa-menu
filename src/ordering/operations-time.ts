import type { OrderDetailData } from './contracts';
export function stageTimes(order:Pick<OrderDetailData,'createdAt'|'paidAt'|'history'|'status'>,now=Date.now()) {
  const first=(states:string[])=>order.history.filter(h=>states.includes(h.to)).map(h=>Date.parse(h.at)).filter(Number.isFinite).sort((a,b)=>a-b)[0];
  const start=Date.parse(order.paidAt??order.createdAt),accepted=first(['accepted','preparing']),ready=first(['ready']),collected=first(['completed']);
  const elapsed=(from:number|undefined,to:number|undefined)=>from==null||to==null||to<from?null:Math.floor((to-from)/60000);
  return {acceptance:elapsed(start,accepted),preparation:elapsed(accepted,ready??(['accepted','preparing'].includes(order.status)?now:undefined)),collection:elapsed(ready,collected??(order.status==='ready'?now:undefined))};
}

import type { InStatement, Row } from '@libsql/client';
import { db } from '@/cms/db';
import { initOrders } from './checkout/repository';
import { branchClause, type BranchScope } from './scope';
import { KITCHEN_VISIBLE } from './orders';
import { OrderError } from './http';
import type { BranchId } from '@/branches/branches';
import type { OperationsData, OperationsQuery } from './operations-contracts';

const DAY = 86400000;
export function qatarDate(at:Date) { return new Date(at.getTime()+3*3600000).toISOString().slice(0,10); }
export function operationRange(query:OperationsQuery, now=new Date()) {
  const today=qatarDate(now);const midnight=Date.parse(`${today}T00:00:00+03:00`);
  let from:string,to:string;
  if(query.period==='custom'){from=query.from!;to=query.to!;}
  else if(query.period==='yesterday'){from=to=qatarDate(new Date(midnight-1));}
  else {to=today;from=qatarDate(new Date(midnight-(query.period==='7d'?6:query.period==='30d'?29:0)*DAY));}
  const start=new Date(`${from}T00:00:00+03:00`),end=new Date(Date.parse(`${to}T00:00:00+03:00`)+DAY);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start||end.getTime()-start.getTime()>92*DAY)throw new OrderError('INVALID',400);
  return {from,to,start:start.toISOString(),end:end.toISOString(),hourly:from===to};
}
export function operationScope(scope:BranchScope, branch?:BranchId){
  if(scope.kind==='branch'&&branch&&branch!==scope.branchId)throw new OrderError('FORBIDDEN',403);
  return scope.kind==='all'&&branch?{kind:'branch' as const,branchId:branch}:scope;
}
const n=(row:Row|undefined,key:string)=>Number(row?.[key]??0);
const minutes=(row:Row|undefined,key:string)=>row?.[key]==null?null:Math.round(Number(row[key])*10)/10;
const active="status IN ('placed','paid','accepted','preparing','ready')";
const valid="status NOT IN ('cancelled','refunded')";
const paid=`paid_at IS NOT NULL AND ${valid}`;

export async function operations(scope:BranchScope,query:OperationsQuery,now=new Date()):Promise<OperationsData>{
  await initOrders();
  const selected=operationScope(scope,query.branch),branch=branchClause(selected),range=operationRange(query,now);
  const live=`${KITCHEN_VISIBLE} AND ${branch.sql}`;
  const where=`${live} AND created_at>=? AND created_at<?`;
  const args=[...branch.args,range.start,range.end];
  const bucket=range.hourly?"strftime('%H',datetime(created_at,'+3 hours'))":"strftime('%Y-%m-%d',datetime(created_at,'+3 hours'))";
  const requests:InStatement[]=[
    {sql:`SELECT COUNT(*) orders, SUM(status='completed') completed, SUM(status IN ('cancelled','refunded')) cancelled,
      SUM(CASE WHEN ${paid} THEN total_minor ELSE 0 END) sales,
      SUM(CASE WHEN ${valid} AND paid_at IS NULL THEN total_minor ELSE 0 END) unpaid,
      AVG(CASE WHEN ${valid} THEN total_minor END) average FROM orders WHERE ${where}`,args},
    {sql:`SELECT branch_id, SUM(status IN ('placed','paid')) received, SUM(status IN ('accepted','preparing')) preparing,
      SUM(status='ready') ready, SUM(${active}) active,
      SUM(print_count=0 AND ${active}) unprinted,
      MIN(CASE WHEN status IN ('placed','paid') THEN COALESCE(paid_at,created_at) END) oldest_received,
      MIN(CASE WHEN status='ready' THEN COALESCE((SELECT MAX(at) FROM audit WHERE entity_type='order' AND entity_id=orders.id AND action='order.status' AND json_extract(diff,'$.status.to')='ready'),updated_at) END) oldest_ready FROM orders WHERE ${live} GROUP BY branch_id`,args:branch.args},
    {sql:`SELECT ${bucket} bucket,COUNT(*) orders,SUM(CASE WHEN ${paid} THEN total_minor ELSE 0 END) sales FROM orders WHERE ${where} GROUP BY bucket ORDER BY bucket`,args},
    {sql:`SELECT branch_id,COUNT(*) orders,SUM(CASE WHEN ${paid} THEN total_minor ELSE 0 END) sales FROM orders WHERE ${where} GROUP BY branch_id`,args},
    {sql:`WITH times AS (SELECT o.id,COALESCE(o.paid_at,o.created_at) started,
      MIN(CASE WHEN json_extract(a.diff,'$.status.to') IN ('accepted','preparing') THEN a.at END) accepted,
      MIN(CASE WHEN json_extract(a.diff,'$.status.to')='ready' THEN a.at END) ready,
      MIN(CASE WHEN json_extract(a.diff,'$.status.to')='completed' THEN a.at END) collected
      FROM orders o LEFT JOIN audit a ON a.entity_type='order' AND a.entity_id=o.id AND a.action='order.status'
      WHERE ${where} GROUP BY o.id)
      SELECT AVG(CASE WHEN ready>=accepted THEN (julianday(ready)-julianday(accepted))*1440 END) prep,
      AVG(CASE WHEN accepted>=started THEN (julianday(accepted)-julianday(started))*1440 END) acceptance,
      AVG(CASE WHEN collected>=ready THEN (julianday(collected)-julianday(ready))*1440 END) collection,
      SUM(ready>=accepted) timed FROM times`,args},
    {sql:`WITH chosen AS (SELECT id,snapshot FROM orders WHERE ${where} AND ${valid}),
      lines AS (SELECT o.id order_id,'L'||j.key line_id,json_extract(j.value,'$.dishId') dish_id,
      json_extract(j.value,'$.name') name,json_extract(j.value,'$.nameAr') name_ar,json_extract(j.value,'$.quantity') quantity
      FROM chosen o,json_each(o.snapshot,'$.lines') j
      UNION ALL SELECT e.order_id,json_extract(e.payload,'$.line.id'),json_extract(e.payload,'$.line.dishId'),
      json_extract(e.payload,'$.line.name'),json_extract(e.payload,'$.line.nameAr'),json_extract(e.payload,'$.line.quantity')
      FROM order_edits e JOIN chosen o ON o.id=e.order_id WHERE e.kind='add_item'),
      current_lines AS (SELECT l.*,COALESCE((SELECT json_extract(e.payload,'$.quantity') FROM order_edits e
      WHERE e.order_id=l.order_id AND e.line_id=l.line_id AND e.kind='qty' ORDER BY e.created_at DESC,e.id DESC LIMIT 1),l.quantity) qty
      FROM lines l WHERE NOT EXISTS(SELECT 1 FROM order_edits e WHERE e.order_id=l.order_id AND e.line_id=l.line_id AND e.kind='void'))
      SELECT dish_id,MAX(name) name,MAX(name_ar) name_ar,SUM(qty) quantity FROM current_lines
      WHERE dish_id IS NOT NULL GROUP BY dish_id ORDER BY quantity DESC,dish_id LIMIT 5`,args},
  ];
  const [stats,liveRows,seriesRows,branchRows,timing,popular]=await db.batch(requests,'read');
  const counts={received:0,preparing:0,ready:0,active:0,unprinted:0};
  for(const row of liveRows.rows)for(const key of Object.keys(counts) as (keyof typeof counts)[])counts[key]+=n(row,key);
  const keys=range.hourly?Array.from({length:24},(_,i)=>String(i).padStart(2,'0')):
    Array.from({length:Math.round((Date.parse(range.end)-Date.parse(range.start))/DAY)},(_,i)=>qatarDate(new Date(Date.parse(range.start)+i*DAY)));
  const series=keys.map(key=>{const row=seriesRows.rows.find(r=>r.bucket===key);return {key,orders:n(row,'orders'),salesMinor:n(row,'sales')};});
  const branches=liveRows.rows.map(row=>({id:String(row.branch_id) as BranchId,received:n(row,'received'),preparing:n(row,'preparing'),ready:n(row,'ready'),active:n(row,'active'),unprinted:n(row,'unprinted'),orders:0,salesMinor:0}));
  for(const row of branchRows.rows){let b=branches.find(b=>b.id===row.branch_id);if(!b){b={id:String(row.branch_id) as BranchId,received:0,preparing:0,ready:0,active:0,unprinted:0,orders:0,salesMinor:0};branches.push(b);}b.orders=n(row,'orders');b.salesMinor=n(row,'sales');}
  const oldest=(key:string)=>liveRows.rows.map(r=>r[key]).filter((v):v is string=>typeof v==='string').sort()[0]??null;
  return {generatedAt:now.toISOString(),range:{from:range.from,to:range.to},counts,series,hourly:range.hourly,branches,
    metrics:{orders:n(stats.rows[0],'orders'),completed:n(stats.rows[0],'completed'),cancelled:n(stats.rows[0],'cancelled'),paidSalesMinor:n(stats.rows[0],'sales'),unpaidMinor:n(stats.rows[0],'unpaid'),averageMinor:Math.round(n(stats.rows[0],'average')),prepMinutes:minutes(timing.rows[0],'prep'),acceptMinutes:minutes(timing.rows[0],'acceptance'),collectionMinutes:minutes(timing.rows[0],'collection'),timedOrders:n(timing.rows[0],'timed')},
    popular:popular.rows.map(r=>({dishId:String(r.dish_id),name:String(r.name??''),nameAr:String(r.name_ar??r.name??''),quantity:n(r,'quantity')})),
    attention:[{kind:'received',count:counts.received,oldestAt:oldest('oldest_received')},{kind:'ready',count:counts.ready,oldestAt:oldest('oldest_ready')},{kind:'unprinted',count:counts.unprinted,oldestAt:null}]};
}

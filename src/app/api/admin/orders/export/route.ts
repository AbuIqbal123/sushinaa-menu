import { requireStaff, failure } from '@/ordering/http';
import { orderQuery } from '@/ordering/contracts';
import { listOrders } from '@/ordering/orders';
import { operationRange, operationScope, qatarDate } from '@/ordering/operations-calendar';
import { formatQatarDateTime } from '@/lib/datetime';
import { formatOrderNumber } from '@/ordering/order-number';
export const dynamic='force-dynamic';
function csv(value:unknown){let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export async function GET(request:Request){
  try{
    const staff=await requireStaff(undefined,'orders');const params=Object.fromEntries(new URL(request.url).searchParams);
    const query=orderQuery.parse({...params,limit:100,page:1});
    const range=operationRange(query.from||query.to?{period:'custom',from:query.from??qatarDate(new Date(Date.parse(`${query.to}T00:00:00+03:00`)-6*86400000)),to:query.to??qatarDate(new Date())}:{period:'7d'});
    const scope=operationScope(staff.branchScope,query.branch);
    const rows:string[]=[['Order','Branch','Status','Created (Qatar)','Total QAR','Payment'].map(csv).join(',')];
    let page=1,more=true;
    while(more&&page<=100){const result=await listOrders(scope,{...query,from:range.from,to:range.to,page,limit:100});
      for(const row of result.rows)rows.push([formatOrderNumber(row.orderNumber),row.branchId,row.status,formatQatarDateTime(row.createdAt),(row.totalMinor/100).toFixed(2),row.paidAt?'Paid':'Pay at pickup'].map(csv).join(','));
      more=result.more;page++;
    }
    if(more)return Response.json({code:'RANGE_TOO_LARGE'},{status:400});
    return new Response('\uFEFF'+rows.join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="sushinaa-orders-${range.from}-${range.to}.csv"`,'Cache-Control':'no-store'}});
  }catch(error){return failure(error);}
}

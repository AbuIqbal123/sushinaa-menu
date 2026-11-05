import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {operationsQuery} from '../src/ordering/operations-contracts';
import {orderQuery} from '../src/ordering/contracts';
import {stageTimes} from '../src/ordering/operations-time';
let db:typeof import('../src/cms/db')['db'];let ops:typeof import('../src/ordering/operations');let orders:typeof import('../src/ordering/orders');let dir:string;
const now=new Date('2026-11-05T18:00:00+03:00');const all={kind:'all' as const},town={kind:'branch' as const,branchId:'down-town' as const};
const id=(n:number)=>`SU-00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const at=(time:string,day='2026-11-05')=>new Date(`${day}T${time}:00+03:00`).toISOString();
const burger={dishId:'sushinaa-burger',name:'Burger',nameAr:'برجر',quantity:2,unitMinor:2500,selection:{},note:'Sauce aside'};
const calamari={dishId:'crispy-calamari',name:'Calamari',nameAr:'كاليماري',quantity:1,unitMinor:4000,selection:{},note:''};
before(async()=>{
 dir=mkdtempSync(join(tmpdir(),'sn-operations-'));process.env.CMS_DATABASE_URL=`file:${dir}/menu.db`;process.env.CMS_ENV_GUARD='report';process.env.VERCEL='';process.env.VERCEL_ENV='';
 ({db}=await import('../src/cms/db'));const repo=await import('../src/ordering/checkout/repository');await repo.initOrders();ops=await import('../src/ordering/operations');orders=await import('../src/ordering/orders');
 async function order(n:number,branch:string,status:string,paid:boolean,total:number,created:string,lines:unknown[]){
  await db.execute({sql:'INSERT INTO orders(id,branch_id,status,payment_method,paid_at,session_hash,idempotency_key,request_hash,snapshot,total_minor,currency,customer_name,customer_phone,car_plate,created_at,updated_at,order_number,print_count) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',args:[id(n),branch,status,n===5?'mock':paid?'mock':'pay_at_pickup',paid?created:null,'session',String(n),'request',JSON.stringify({lines,customer:{brand:'toyota'}}),total,'QAR',`Guest ${n}`,'55551234',`Q${n}23`,created,created,101100000+n,n===3?1:0]});
 }
 await order(1,'down-town','completed',true,5000,at('12:00'),[burger,{...calamari,dishId:'shrimp'}]);
 await order(2,'down-town','preparing',false,3000,at('13:00'),[{...burger,quantity:1}]);
 await order(3,'down-town','ready',true,4000,at('14:00'),[calamari]);
 await order(4,'down-town','cancelled',true,2500,at('15:00'),[{...burger,quantity:99}]);
 await order(5,'down-town','placed',false,199900,at('16:00'),[{...burger,quantity:999}]);
 await order(6,'al-thumama','completed',true,6000,at('12:00'),[{...burger,quantity:1}]);
 await order(7,'down-town','completed',true,7000,at('12:00','2026-11-04'),[{...burger,quantity:1}]);
 for(const [n,history] of [[1,[['12:02','accepted'],['12:12','ready'],['12:16','completed']]],[2,[['13:03','accepted'],['13:04','preparing']]],[3,[['14:01','accepted'],['14:21','ready']]],[6,[['12:04','accepted'],['12:24','ready'],['12:30','completed']]]] as const){
  for(const [time,to] of history)await db.execute({sql:"INSERT INTO audit(at,action,entity_type,entity_id,diff) VALUES (?,'order.status','order',?,?)",args:[at(time),id(n),JSON.stringify({status:{from:'placed',to}})]});
 }
 const edits=[{n:1,kind:'qty',lineId:'L0',quantity:3},{n:1,kind:'void',lineId:'L1'},{n:2,kind:'add_item',line:{...calamari,id:'A-test',quantity:2}},{n:2,kind:'qty',lineId:'A-test',quantity:4}];
 for(let i=0;i<edits.length;i++){const {n,...payload}=edits[i];await db.execute({sql:'INSERT INTO order_edits(id,order_id,kind,line_id,payload,reason_code,before_total_minor,after_total_minor,created_at) VALUES (?,?,?,?,?,?,?,?,?)',args:[`edit-${i}`,id(n),payload.kind,('lineId'in payload?payload.lineId:null)??null,JSON.stringify(payload),'customer_request',5000,5000,at(`17:0${i}`)]});}
});
after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});
test('report dates use Qatar boundaries and reject unbounded/custom invalid ranges',()=>{
 const range=ops.operationRange(operationsQuery.parse({period:'today'}),now);assert.equal(range.start,'2026-11-04T21:00:00.000Z');assert.equal(range.end,'2026-11-05T21:00:00.000Z');
 assert.equal(ops.operationRange(operationsQuery.parse({period:'7d'}),now).from,'2026-10-30');
 assert.equal(operationsQuery.safeParse({period:'custom',from:'2026-11-05'}).success,false);
 assert.throws(()=>ops.operationRange(operationsQuery.parse({period:'custom',from:'2020-01-01',to:'2026-11-05'})),/INVALID/);
});
test('dashboard metrics exclude unpaid online attempts and cancelled sales; stages use actual audit times',async()=>{
 assert.equal(operationsQuery.parse({}).period,'7d');
 const result=await ops.operations(all,operationsQuery.parse({period:'today'}),now);
 assert.equal(result.metrics.orders,5);assert.equal(result.metrics.completed,2);assert.equal(result.metrics.cancelled,1);assert.equal(result.metrics.paidSalesMinor,15000);assert.equal(result.metrics.unpaidMinor,3000);
 assert.equal(result.metrics.prepMinutes,16.7);assert.equal(result.metrics.collectionMinutes,5);assert.equal(result.metrics.timedOrders,3);
 assert.equal(result.series.reduce((n,p)=>n+p.orders,0),5);assert.equal(result.series.length,24);assert.equal(result.counts.active,2);
});
test('branch permissions scope every metric and popular-item query, including amendments',async()=>{
 const result=await ops.operations(town,operationsQuery.parse({period:'today'}),now);
 assert.equal(result.metrics.orders,4);assert.equal(result.metrics.paidSalesMinor,9000);assert.equal(result.metrics.averageMinor,4000);assert.deepEqual(result.branches.map(b=>b.id),['down-town']);
 assert.deepEqual(Object.fromEntries(result.popular.map(p=>[p.dishId,p.quantity])),{'crispy-calamari':5,'sushinaa-burger':4});
 assert.equal(result.attention.find(a=>a.kind==='ready')?.oldestAt,at('14:21'));
 await assert.rejects(ops.operations(town,operationsQuery.parse({branch:'al-thumama'}),now),/FORBIDDEN/);
 const none=await ops.operations({kind:'none'},operationsQuery.parse({}),now);assert.equal(none.metrics.orders,0);assert.equal(none.popular.length,0);assert.equal(none.branches.length,0);
});
test('live/history queues, full order-number search and named searches preserve scope and edited quantities',async()=>{
 const live=await orders.listOrders(town,orderQuery.parse({view:'active'}));assert.deepEqual(live.rows.map(r=>r.id),[id(3),id(2)]);assert.equal(live.rows[1].itemCount,5);assert.equal(live.rows[1].brandId,'toyota');
 const found=await orders.listOrders(town,orderQuery.parse({q:'101100001'}));assert.deepEqual(found.rows.map(r=>r.id),[id(1)]);assert.equal(found.rows[0].items?.length,1);assert.equal(found.rows[0].itemCount,3);
 assert.equal((await orders.listOrders(town,orderQuery.parse({q:'Guest 6'}))).rows.length,0);
 assert.equal((await orders.listOrders(all,orderQuery.parse({q:"%' OR 1=1 --"}))).rows.length,0);
 const history=await orders.listOrders(town,orderQuery.parse({view:'history',from:'2026-11-05',to:'2026-11-05'}));assert.deepEqual(history.rows.map(r=>r.id),[id(4),id(1)]);
});
test('history filters by closed status time, not placed date',async()=>{
 await db.execute({sql:'INSERT INTO orders(id,branch_id,status,payment_method,paid_at,session_hash,idempotency_key,request_hash,snapshot,total_minor,currency,customer_name,customer_phone,car_plate,created_at,updated_at,order_number,print_count) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',args:[id(8),'down-town','completed','mock',at('11:00','2026-10-26'),'session','8','request',JSON.stringify({lines:[burger],customer:{brand:'toyota'}}),4500,'QAR','Guest 8','55551234','Q823',at('11:00','2026-10-26'),at('18:30','2026-11-04'),101100008,0]});
 await db.execute({sql:"INSERT INTO audit(at,action,entity_type,entity_id,diff) VALUES (?,'order.status','order',?,?)",args:[at('18:30','2026-11-04'),id(8),JSON.stringify({status:{from:'ready',to:'completed'}})]});
 assert.equal((await orders.listOrders(town,orderQuery.parse({view:'active'}))).rows.some(r=>r.id===id(8)),false);
 const closedYesterday=await orders.listOrders(town,orderQuery.parse({view:'history',from:'2026-11-04',to:'2026-11-04'}));
 assert.ok(closedYesterday.rows.some(r=>r.id===id(8)));
 const last30=await orders.listOrders(town,orderQuery.parse({view:'history',from:'2026-10-07',to:'2026-11-05'}));
 assert.ok(last30.rows.some(r=>r.id===id(8)));
 const placedWindowOnly=await orders.listOrders(town,orderQuery.parse({view:'history',from:'2026-10-26',to:'2026-10-26'}));
 assert.equal(placedWindowOnly.rows.some(r=>r.id===id(8)),false);
});
test('per-order timing stays blank when a stage was never recorded',()=>{
 const base={createdAt:at('12:00'),paidAt:null,status:'preparing' as const,history:[{at:at('12:03'),from:'placed' as const,to:'accepted' as const,reason:null}]};
 assert.deepEqual(stageTimes(base,Date.parse(at('12:13'))),{acceptance:3,preparation:10,collection:null});
 assert.deepEqual(stageTimes({...base,history:[]}),{acceptance:null,preparation:null,collection:null});
});

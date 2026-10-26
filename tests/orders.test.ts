import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { statuses, canTransition, staffStatus, staffLabels, type OrderStatus } from '../src/ordering/status';
import { orderQuery, statusBody } from '../src/ordering/contracts';
import { checkoutSchema, quoteOrder, type OrderSnapshot } from '../src/ordering/checkout/validation';
import { menuSchema } from '../src/cms/schema';
import { defaultSelection, unitPrice } from '../src/ordering/price';

let repository: typeof import('../src/ordering/checkout/repository');
let orders: typeof import('../src/ordering/orders');
let http: typeof import('../src/ordering/http');
let rate: typeof import('../src/ordering/rate-limit');
let db: (typeof import('../src/cms/db'))['db'];
let dir: string;
const ctx = { actor: 'test-staff', ip: null, userAgent: null };
const admin = { kind: 'all' as const };
const snapshot: OrderSnapshot = { branchId:'down-town', branchName:'Down Town',collection:'car',customer:{name:'Test customer',phone:'97455551234',plate:'Q123456',colour:'silver',car:'test car',instructions:'test instructions'},lines:[],totalMinor:1234,currency:'QAR' };
before(async () => {
  dir = mkdtempSync(join(tmpdir(),'sn-order-suite-'));
  process.env.CMS_DATABASE_URL = `file:${dir}/orders.db`; process.env.CMS_DATABASE_AUTH_TOKEN = '';
  process.env.VERCEL = ''; process.env.VERCEL_ENV = 'preview'; process.env.PAYMENT_PROVIDER = 'mock'; process.env.CMS_ENV_GUARD='report';
  repository = await import('../src/ordering/checkout/repository');
  orders = await import('../src/ordering/orders'); http = await import('../src/ordering/http');
  rate = await import('../src/ordering/rate-limit'); ({db} = await import('../src/cms/db'));
  await repository.initOrders();
});
after(() => { db.close(); rmSync(dir,{recursive:true,force:true}); });
const create = (method: 'mock' | 'pay_at_pickup' = 'pay_at_pickup') => repository.persistPendingOrder(randomUUID(),randomUUID(),'same',snapshot,1,method);
async function row(id:string) {return (await db.execute({sql:'SELECT * FROM orders WHERE id=?',args:[id]})).rows[0];}
async function countAudit(id:string) {return Number((await db.execute({sql:"SELECT COUNT(*) AS n FROM audit WHERE entity_id=?",args:[id]})).rows[0].n);}
const rejected = async (promise:Promise<unknown>, code:string) => assert.rejects(promise, (e:unknown) => e instanceof Error && e.message === code);

test('every allowed and forbidden status transition', () => {
  const permitted = new Set(['placed:accepted','placed:cancelled','paid:accepted','paid:cancelled','accepted:preparing','accepted:cancelled','preparing:ready','preparing:cancelled','ready:completed','ready:cancelled','cancelled:refunded']);
  for(const from of statuses) for(const to of statuses) {
    assert.equal(canTransition(from,to,'paid'),permitted.has(`${from}:${to}`),`${from}:${to}`);
    assert.equal(canTransition(from,to,null),permitted.has(`${from}:${to}`) && to !== 'refunded');
  }
});
test('staff label mapping uses the supplied bilingual labels', () => {
  assert.deepEqual(statuses.map(staffStatus),['received','received','received','preparing','ready','collected','cancelled','cancelled']);
  assert.equal(staffLabels.ready.ar,'جاهز'); assert.equal(staffLabels.received.ar,'تم الاستلام');
});
test('same order submitted 10 times creates one order', async () => {
  const session=randomUUID(),key=randomUUID();const ids=[];
  for(let i=0;i<10;i++) ids.push((await repository.persistPendingOrder(session,key,'same',snapshot,1)).id);
  assert.equal(new Set(ids).size,1);
  assert.equal(Number((await db.execute({sql:'SELECT COUNT(*) AS n FROM orders WHERE session_hash=?',args:[repository.hash(session)]})).rows[0].n),1);
});
test('20 concurrent submits with one key create one order', async () => {
  const session=randomUUID(),key=randomUUID();
  const result=await Promise.all(Array.from({length:20},()=>repository.persistPendingOrder(session,key,'same',snapshot,1,'pay_at_pickup')));
  assert.equal(new Set(result.map(r=>r.id)).size,1);assert.equal(result.filter(r=>!r.reused).length,1);
  assert.equal(Number((await db.execute({sql:'SELECT COUNT(*) AS n FROM order_outbox WHERE order_id=?',args:[result[0].id]})).rows[0].n),1);
});
test('same key with a different body is rejected', async () => {
  const session=randomUUID(),key=randomUUID();await repository.persistPendingOrder(session,key,'same',snapshot,1);
  await rejected(repository.persistPendingOrder(session,key,'changed',snapshot,1),'CONFLICT');
});
const menu = menuSchema.parse(JSON.parse(readFileSync('data/initial-menu.json','utf8')));
const dish = menu.dishes.find(d=>d.visible && d.available && d.kind.type === 'simple')!;
const input = {branchId:'down-town',customer:snapshot.customer,lines:[{dishId:dish.id,selection:defaultSelection(dish),quantity:1,note:'',expectedUnitMinor:Math.round(unitPrice(dish,defaultSelection(dish))*100)}]};
test('client-sent total or paid flag is ignored', () => {
  // Strict validation refuses forged fields entirely; they can never affect persistence.
  for(const fields of [{totalMinor:1},{paid:true},{paymentStatus:'paid'}]) assert.equal(checkoutSchema.safeParse({...input,...fields}).success,false);
  const valid=checkoutSchema.parse(input);const order=quoteOrder(valid,menu,new Date('2026-10-23T15:00:00+03:00'));
  assert.equal(order.totalMinor,input.lines[0].expectedUnitMinor);
  assert.throws(()=>quoteOrder({...valid,lines:[{...valid.lines[0],expectedUnitMinor:1}]},menu,new Date('2026-10-23T15:00:00+03:00')),/PRICE_CHANGED/);
});
test('zero, negative, huge and malformed quantities are rejected', () => {
  for(const quantity of [0,-1,21,1.1,NaN,Infinity,'2',null,{},100000000]) assert.equal(checkoutSchema.safeParse({...input,lines:[{...input.lines[0],quantity}]}).success,false);
});
test('illegal status jump (placed -> ready) is rejected',async()=>{
  const order=await create();await rejected(orders.transitionOrder(admin, order.id,{expected:'placed',to:'ready'},ctx),'INVALID_TRANSITION');assert.equal((await row(order.id)).status,'placed');assert.equal(await countAudit(order.id),0);
});
test('stale status update returns 409 and writes no audit row',async()=>{
  const order=await create();await orders.transitionOrder(admin, order.id,{expected:'placed',to:'accepted'},ctx);
  try{await orders.transitionOrder(admin, order.id,{expected:'placed',to:'cancelled',reason:'duplicate'},ctx);assert.fail('must refuse');}
  catch(e){assert.equal(http.failure(e).status,409);assert.equal((await http.failure(e).json()).code,'STALE_STATUS');}
  assert.equal(await countAudit(order.id),1);assert.equal((await row(order.id)).status,'accepted');
});
test('customer A cannot read customer B\'s order',async()=>{
  const a=randomUUID();const order=await repository.persistPendingOrder(a,randomUUID(),'same',snapshot,1);
  assert.equal((await repository.customerOrder(order.id,a)).id,order.id);
  await rejected(repository.customerOrder(order.id,'other'),'NOT_FOUND');await rejected(repository.customerOrder(order.id,null),'NOT_FOUND');
});
test('error responses contain no stack trace or SQL',async()=>{
  const response=http.failure(new Error('SQLITE_ERROR SELECT customer_phone FROM orders at /private/path'));
  assert.equal(response.status,503);assert.deepEqual(await response.json(),{code:'TEMPORARILY_UNAVAILABLE'});assert.equal(response.headers.get('cache-control'),'no-store');
});
test('order list shows staff the phone and plate and keeps the name off the list',async()=>{
  await create();const result=await orders.listOrders(admin, orderQuery.parse({limit:100}));const raw=JSON.stringify(result);
  assert.ok(raw.includes(snapshot.customer.phone));assert.ok(raw.includes(snapshot.customer.plate));assert.ok(!raw.includes(snapshot.customer.name));
  assert.equal(orders.maskPhone(snapshot.customer.phone),'+974 •••• 12 34');assert.equal(orders.maskPlate(snapshot.customer.plate),'Q ••• 56');
});
test('contact reveal is audited and the snapshot cannot leak hidden contact',async()=>{
  const order=await create();const hidden=await orders.detailOrder(admin, order.id,false,ctx);
  assert.ok(!JSON.stringify(hidden).includes(snapshot.customer.phone));assert.ok(!('customer' in hidden.snapshot));
  const revealed=await orders.detailOrder(admin, order.id,true,ctx);assert.equal(revealed.customer.phone,snapshot.customer.phone);
  const audit=(await db.execute({sql:'SELECT * FROM audit WHERE entity_id=?',args:[order.id]})).rows;
  assert.equal(audit[0].action,'order.contact_viewed');assert.equal(audit[0].diff,null);assert.ok(!JSON.stringify(audit).includes(snapshot.customer.phone));
});
test('db failure mid-transition leaves no partial state',async()=>{
  const order=await create();
  await db.execute(`CREATE TRIGGER reject_order_audit BEFORE INSERT ON audit WHEN NEW.entity_id='${order.id}' BEGIN SELECT RAISE(ABORT,'test failure'); END`);
  try{await assert.rejects(orders.transitionOrder(admin, order.id,{expected:'placed',to:'accepted'},ctx));assert.equal((await row(order.id)).status,'placed');assert.equal(await countAudit(order.id),0);}
  finally{await db.execute('DROP TRIGGER reject_order_audit');}
});

test('pay at pickup completion records payment atomically and sets retention',async()=>{
  const order=await create();
  for(const [expected,to] of [['placed','accepted'],['accepted','preparing'],['preparing','ready']] as [OrderStatus,OrderStatus][]) await orders.transitionOrder(admin, order.id,{expected,to},ctx);
  await rejected(orders.transitionOrder(admin, order.id,{expected:'ready',to:'completed'},ctx),'STALE_STATUS');
  assert.equal((await row(order.id)).paid_at,null);
  const at=new Date('2026-10-23T12:00:00Z');await orders.transitionOrder(admin, order.id,{expected:'ready',to:'completed',recordPayment:true},ctx,at);
  const done=await row(order.id);assert.equal(done.paid_at,at.toISOString());assert.equal(Date.parse(String(done.purge_after))-at.getTime(),90*86400000);
});
test('mock settlement is server-side, idempotent and publishes one event/outbox row',async()=>{
  const session=randomUUID();const order=await repository.persistPendingOrder(session,randomUUID(),'same',snapshot,1,'mock');
  assert.ok(!(await orders.listOrders(admin, orderQuery.parse({limit:100}))).rows.some(o=>o.id===order.id));
  await rejected(orders.transitionOrder(admin, order.id,{expected:'placed',to:'accepted'},ctx),'STALE_STATUS');
  const settled=await Promise.all(Array.from({length:5},()=>orders.payMock(order.id,session)));assert.ok(settled.every(r=>r.paymentStatus==='paid'));
  assert.equal(await countAudit(order.id),1);
  for(const table of ['order_outbox','order_events']) assert.equal(Number((await db.execute({sql:`SELECT COUNT(*) AS n FROM ${table} WHERE order_id=?`,args:[order.id]})).rows[0].n),1);
  assert.equal((await db.execute({sql:'SELECT status FROM payment_attempts WHERE order_id=?',args:[order.id]})).rows[0].status,'paid');
});
test('purge removes customer columns, snapshot contact and personal notes only after 90 days',async()=>{
  const order=await create();const at=new Date('2026-01-01T12:00:00Z');await orders.transitionOrder(admin, order.id,{expected:'placed',to:'cancelled',reason:'customer_request'},ctx,at);
  await db.execute({sql:'UPDATE orders SET snapshot=? WHERE id=?',args:[JSON.stringify({...snapshot,lines:[{note:'Personal collection instruction',totalMinor:1234}]}),order.id]});
  await orders.purgeOrders(new Date(at.getTime()+89*86400000));assert.equal((await row(order.id)).customer_phone,snapshot.customer.phone);
  await orders.purgeOrders(new Date(at.getTime()+91*86400000));const purged=await row(order.id);
  for(const key of ['customer_name','customer_phone','car_plate','car_colour','car_model','instructions']) assert.equal(purged[key],null);
  assert.equal(JSON.parse(String(purged.snapshot)).customer,null);assert.equal(purged.total_minor,1234);
  assert.equal(JSON.parse(String(purged.snapshot)).lines[0].note,'');
  assert.equal(JSON.parse(String(purged.snapshot)).lines[0].totalMinor,1234);
});
test('rate limits are atomic per IP and scope and recover after their window',async()=>{
  const at=1000000;const result=await Promise.all(Array.from({length:20},()=>rate.rateAllowed('checkout','test-ip',at,5)));
  assert.equal(result.filter(Boolean).length,5);assert.equal(await rate.rateAllowed('staff','test-ip',at,5),true);
  assert.equal(await rate.rateAllowed('checkout','another-ip',at,5),true);assert.equal(await rate.rateAllowed('checkout','test-ip',at+900000,5),true);
});
test('strict query and cancellation validation reject unknown fields and PII reasons',()=>{
  for(const query of [{status:'bad'},{page:0},{limit:101},{branch:'fake'},{from:'2026-02-30'},{from:'2026-10-25',to:'2026-10-24'},{q:'55551234'},{unknown:'x'}]) assert.equal(orderQuery.safeParse(query).success,false);
  assert.equal(statusBody.safeParse({to:'cancelled',expected:'placed',reason:'Call 55551234'}).success,false);
});

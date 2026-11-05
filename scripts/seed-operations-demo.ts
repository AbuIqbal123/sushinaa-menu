// Seeds only a NEW disposable local database with clearly synthetic order data.
import { readFileSync,realpathSync } from 'node:fs';
import { dirname,resolve,sep } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { BRANCHES } from '../src/branches/branches';
import { defaultSelection,unitPrice } from '../src/ordering/price';
import { checkoutSchema,quoteOrder } from '../src/ordering/checkout/validation';
import { composeOrderNumber,qatarDay } from '../src/ordering/order-number';

async function main(){
 const url=process.env.CMS_DATABASE_URL??'';
 if(!url.startsWith('file:')||process.env.VERCEL||process.env.VERCEL_ENV)throw Error('Demo seed requires a disposable local file database.');
 const parent=realpathSync(dirname(resolve(url.slice(5))));
 if(![realpathSync(tmpdir()),realpathSync('/tmp')].some(root=>parent.startsWith(root+sep)))throw Error('Demo database must be inside a temporary folder.');
 const {db}=await import('../src/cms/db');
 try{
  await db.execute('CREATE TABLE IF NOT EXISTS env_marker(id INTEGER PRIMARY KEY CHECK(id=1),environment TEXT NOT NULL)');
  await db.execute("INSERT OR IGNORE INTO env_marker(id,environment) VALUES(1,'development')");
  const {initOrders}=await import('../src/ordering/checkout/repository');await initOrders();
  if(Number((await db.execute('SELECT COUNT(*) n FROM orders')).rows[0].n)>0)throw Error('Use a new empty demo database; existing orders are never replaced.');
  const {seedMenu,readMenu}=await import('../src/cms/repository');await seedMenu(JSON.parse(readFileSync('data/initial-menu.json','utf8')));
  const {menu,revision}=await readMenu();const now=Date.now();const sequences=new Map<string,number>();let count=0;
  const names=['Mariam A.','Omar K.','Fatima M.','Abdullah S.','Noor H.','Khalid R.'];
  for(const [b,branch] of BRANCHES.entries())for(let i=0;i<20;i++){
   const active=i<6;const terminal=i===19?'cancelled':'completed';
   const status=active?(['paid','placed','preparing','preparing','ready','ready'] as const)[i]:terminal;
   const minutes=active?(i<2?3+i*4:i<4?12+(i-2)*4:27+(i-4)*5)+b*2:70+(i-6)*19;
   const offset=active?0:Math.floor((i-6)/2);
   const created=new Date(now-offset*86400000-minutes*60000);
   const ids=['sushinaa-burger','crispy-calamari','shrimp-kunafa','mario-roll','chicken-noodles','redbull'];
   const dishes=[menu.dishes.find(d=>d.id===ids[(i+b)%ids.length])!,menu.dishes.find(d=>d.id===ids[(i+b+2)%ids.length])!];
   const customer={name:names[(i+b)%names.length],phone:`5555${String(1000+b*100+i).slice(-4)}`,brand:['toyota','nissan','bmw','audi'][b],plate:`Q${230000+b*100+i}`,colour:['White','Black','Silver','Blue'][i%4]};
   const input=checkoutSchema.parse({branchId:branch.slug,customer,lines:dishes.map((dish,j)=>{const selection=defaultSelection(dish);return {dishId:dish.id,selection,quantity:j===0?1+i%2:1,note:i%3===0&&j===0?'Sauce on the side · الصوص على الجانب':'',expectedUnitMinor:Math.round(unitPrice(dish,selection)*100)};})});
   const snapshot=quoteOrder(input,menu,created,{allowClosed:true});const id=`SU-${randomUUID()}`;
   const method=i%3===1?'pay_at_pickup':'mock';const paid=status==='completed'||method==='mock';
   const day=qatarDay(created),key=branch.slug+day.month+day.day;const sequence=(sequences.get(key)??0)+1;sequences.set(key,sequence);
   const history=active?(i<2?[]:i<4?[[2,'accepted'],[2,'preparing']]:[[2,'accepted'],[3,'preparing'],[20,'ready']]):terminal==='cancelled'?[[4,'cancelled']]:[[2,'accepted'],[3,'preparing'],[17+i%7,'ready'],[24+i%8,'completed']];
   const last=history[history.length-1];const updated=last?new Date(created.getTime()+Number(last[0])*60000).toISOString():created.toISOString();
   await db.execute({sql:'INSERT INTO orders(id,branch_id,status,payment_method,paid_at,session_hash,idempotency_key,request_hash,snapshot,total_minor,currency,customer_name,customer_phone,car_plate,car_colour,created_at,updated_at,order_number,print_count,printed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',args:[id,branch.slug,status,method,paid?created.toISOString():null,'demo-session',randomUUID(),'demo',JSON.stringify({version:2,menuRevision:revision,...snapshot}),snapshot.totalMinor,'QAR',customer.name,customer.phone,customer.plate,customer.colour,created.toISOString(),updated,composeOrderNumber(branch.slug,day.month,day.day,sequence),i<2||i===3?0:1,i<2||i===3?null:created.toISOString()]});
   let previous=paid?'paid':'placed';for(const [minute,to] of history){await db.execute({sql:"INSERT INTO audit(at,actor,action,entity_type,entity_id,diff) VALUES (?,'demo-preview','order.status','order',?,?)",args:[new Date(created.getTime()+Number(minute)*60000).toISOString(),id,JSON.stringify({status:{from:previous,to}})]});previous=String(to);}
   count++;
  }
  console.log(`Prepared ${count} synthetic collection orders across four branches.`);
 }finally{db.close();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Demo seed failed');process.exitCode=1;});

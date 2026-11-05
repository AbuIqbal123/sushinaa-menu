import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {menuSchema} from '../src/cms/schema';
import {configuredBranches,BRANCHES} from '../src/branches/branches';
import {branchListSchema} from '../src/branches/schema';
import {branchStatus} from '../src/branches/hours';
import {checkoutSchema,quoteOrder} from '../src/ordering/checkout/validation';
import {defaultSelection,unitPrice} from '../src/ordering/price';
const legacy=()=>JSON.parse(readFileSync('data/initial-menu.json','utf8'));
test('older menus retain all four branch defaults; editing details preserves routing/maps/codes',()=>{
  const menu=menuSchema.parse(legacy());assert.equal(menu.branches.length,4);const first=menu.branches[0];first.name='Aspire';first.nameAr='أسباير';first.phone='+97455070000';
  const branch=configuredBranches(menu.branches)[0];assert.equal(branch.name,'Aspire');assert.equal(branch.nameAr,'أسباير');assert.equal(branch.phone,'+97455070000');assert.equal(branch.slug,'down-town');assert.equal(branch.mapsUrl,BRANCHES[0].mapsUrl);assert.equal(branch.code,'01');assert.equal(BRANCHES[0].name,'Down Town');
});
test('branch settings reject missing/duplicate identities, malformed phones and invalid overnight sessions',()=>{
  const menu=menuSchema.parse(legacy());const rows=menu.branches;
  assert.equal(branchListSchema.safeParse(rows.slice(1)).success,false);
  assert.equal(branchListSchema.safeParse([rows[0],rows[0],rows[2],rows[3]]).success,false);
  assert.equal(branchListSchema.safeParse(rows.map((row,i)=>i?row:{...row,phone:'+974123'})).success,false);
  const bad=structuredClone(rows);bad[0].hours[0]={open:720,close:180};assert.equal(branchListSchema.safeParse(bad).success,false);
  bad[0].hours[0]={open:720,close:2300};assert.equal(branchListSchema.safeParse(bad).success,false);
  assert.equal(branchListSchema.parse(rows.map((row,i)=>i?row:{...row,phone:'+974 ٥٥٠٧ ٥٩٣٣'}))[0].phone,'+97455075933');
});
test('closed days skip to the next opening but still honour the previous night session',()=>{
  const hours=structuredClone(menuSchema.parse(legacy()).branches[0].hours);hours[5].closed=true;hours[6].closed=true;
  assert.equal(branchStatus(hours,{day:5,minute:60}).open,true);
  assert.equal(branchStatus(hours,{day:5,minute:800}).label,'Opens Sunday');
  assert.equal(branchStatus(hours,{day:5,minute:800},'ar').label,'يفتح الأحد');
  for(const day of hours)day.closed=true;assert.equal(branchStatus(hours,{day:1,minute:800}).label,'Closed');assert.equal(branchStatus(hours,{day:1,minute:800}).open,false);
});
test('checkout enforces published hours and snapshots the published branch name',async()=>{
  const menu=menuSchema.parse(legacy());const dish=menu.dishes.find(d=>d.visible&&d.available&&d.kind.type==='simple')!;const selection=defaultSelection(dish);
  const input=checkoutSchema.parse({branchId:'down-town',customer:{name:'Test',phone:'55551234',brand:'toyota',plate:'Q123'},lines:[{dishId:dish.id,selection,quantity:1,expectedUnitMinor:Math.round(unitPrice(dish,selection)*100)}]});
  menu.branches[0].name='New branch name';menu.branches[0].hours[0]={open:900,close:1620};
  await assert.rejects(()=>quoteOrder(input,menu,new Date('2026-11-01T14:59:00+03:00')),/CLOSED/);
  assert.equal((await quoteOrder(input,menu,new Date('2026-11-01T15:00:00+03:00'))).branchName,'New branch name');
  menu.branches[0].hours[0].closed=true;await assert.rejects(()=>quoteOrder(input,menu,new Date('2026-11-01T15:00:00+03:00')),/CLOSED/);
});
test('branch changes persist with audit/revision protection, including saves from older clients',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'sn-branches-'));process.env.CMS_DATABASE_URL=`file:${dir}/menu.db`;process.env.CMS_ENV_GUARD='report';process.env.VERCEL='';process.env.VERCEL_ENV='';
  const {seedMenu,readMenu,saveMenu,ConflictError}=await import('../src/cms/repository');const {db}=await import('../src/cms/db');
  try {await seedMenu(legacy());const initial=await readMenu();initial.menu.branches[1].name='Thumama updated';initial.menu.branches[1].hours[5]={open:840,close:1620};
    const saved=await saveMenu(initial.menu,initial.revision,{actor:'owner',ip:null,userAgent:null});assert.equal((await readMenu()).menu.branches[1].name,'Thumama updated');
    await assert.rejects(saveMenu(initial.menu,initial.revision,{actor:'owner',ip:null,userAgent:null}),ConflictError);
    const old=structuredClone(saved.menu) as unknown as Record<string,unknown>;delete old.branches;await saveMenu(old,saved.revision,{actor:'owner',ip:null,userAgent:null});assert.equal((await readMenu()).menu.branches[1].name,'Thumama updated');
    const audits=(await db.execute("SELECT entity_id,diff FROM audit WHERE entity_type='branch'")).rows;assert.equal(audits.length,1);assert.equal(audits[0].entity_id,'al-thumama');assert.ok(JSON.parse(String(audits[0].diff)).hours);
  }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

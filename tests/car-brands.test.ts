import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { CAR_BRANDS, carBrandName, searchCarBrands } from '../src/ordering/car-brands';
import { customerSchema } from '../src/ordering/checkout/validation';
import { ticketModel } from '../src/ordering/ticket';

const customer = { name: 'Preview', phone: '55551234', plate: 'Q123456', brand: 'toyota', colour: '', car: 'Camry', instructions: '' };
test('checkout requires a supported car brand and rejects missing, blank and invented brands', () => {
  for (const brand of [undefined, '', 'Toyota', 'not-a-car-brand', '<script>', 42, null]) {
    assert.equal(customerSchema.safeParse({ ...customer, brand }).success, false);
  }
  for (const brand of CAR_BRANDS) assert.equal(customerSchema.parse({ ...customer, brand: brand.id }).brand, brand.id);
});
test('brand search matches English, Arabic and aliases without case or spacing sensitivity', () => {
  assert.equal(searchCarBrands('TOYOTA')[0].id, 'toyota');
  assert.equal(searchCarBrands('تويوتا')[0].id, 'toyota');
  assert.equal(searchCarBrands('بي ام دبليو')[0].id, 'bmw');
  assert.equal(searchCarBrands('Mercedes-Benz')[0].id, 'mercedes');
  assert.equal(searchCarBrands('٢١٢')[0].id, '212');
  assert.deepEqual(searchCarBrands('no-such-brand'), []);
});
test('every supplied choice has a unique identifier, bilingual labels and a local logo reference or neutral fallback', () => {
  assert.equal(new Set(CAR_BRANDS.map(b=>b.id)).size, CAR_BRANDS.length);
  for(const b of CAR_BRANDS) {
    assert.ok(b.name && b.ar);
    if(b.sprite) { assert.ok(existsSync(`public/car-brands/reference-${b.sprite}.jpg`));assert.ok(b.y > 44 && b.y < 2004); }
  }
  for(const id of ['212','toyota','camel','other','xiaomi','zeekr','land-rover','range-rover']) assert.ok(CAR_BRANDS.some(b=>b.id===id));
});
test('thermal tickets preserve the selected brand and model while historical orders remain readable', () => {
  const row = { length:0, id:'SU-00000000-0000-0000-0000-000000000001', branch_id:'down-town', created_at:'2026-10-28T12:00:00Z', customer_name:'Preview', customer_phone:'97455551234', car_plate:'Q123456', car_colour:'White', car_model:'Camry', total_minor:100, payment_method:'mock', paid_at:'2026-10-28T12:00:00Z', snapshot:JSON.stringify({customer,lines:[]}) };
  assert.equal(ticketModel(row).car,'Q123456');
  assert.equal(ticketModel(row).brand,'Toyota');
  assert.equal(ticketModel(row).vehicle,'White · Camry');
  assert.equal(ticketModel({...row,snapshot:JSON.stringify({lines:[]})}).car,'Q123456');
  assert.equal(ticketModel({...row,snapshot:JSON.stringify({lines:[]})}).brand,'');
  assert.equal(ticketModel({...row,snapshot:JSON.stringify({lines:[]})}).vehicle,'White · Camry');
  assert.equal(carBrandName('removed-brand'),'');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceLines, timestamp, password } from '../src/core.js';

test('rumus harga per sesi, per orang, kelompok dan tambahan orang', () => {
  assert.deepEqual(priceLines('PER_SESI',100000,2,null,null),{ baseQty: 1, extraQty: 0,total: 100000 });
  assert.equal(priceLines('PER_ORANG',25000,4,null,null).total,100000);
  assert.equal(priceLines('PER_KELOMPOK',80000,6,4,15000).total,110000);
  assert.equal(priceLines('PER_KELOMPOK',80000,2,4,15000).total,80000);
  assert.throws(() => priceLines('PER_ORANG',1_000_000_000_000,2,null,null));
});
test('tanggal WIB invalid dan password melampaui batas bcrypt ditolak', () => {
  assert.equal(timestamp.safeParse('2026-02-30 10:00:00').success,false);
  assert.equal(timestamp.safeParse('2026-02-28 24:00:00').success,false);
  assert.equal(timestamp.safeParse('2026-02-28 23:59:59').success,true);
  assert.equal(password.safeParse('😀'.repeat(20)).success,false);
});

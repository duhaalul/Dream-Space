import { Router } from 'express';
import { z } from 'zod';
import { actorOf, role } from './auth.js';
import { ensure, id, money, reason, type PriceType } from './core.js';
import { snapshot as read, transaction, rows, one, run, audit, type Db } from './db.js';

export interface Package {
  id: number; name: string; queue_code: string; price_type: PriceType; price: number;
  included_persons: number | null; extra_person_price: number | null;
  min_persons: number | null; max_persons: number | null; is_open: number; is_active: number;
}
export interface Background { id: number; name: string; max_persons: number | null }
const count = z.number().int().min(1).max(1000);
const packageSchema = z.strictObject({
  name: z.string().trim().min(1).max(100), queue_code: z.string().regex(/^[A-Z][A-Z0-9]{0,9}$/),
  price_type: z.enum(['PER_SESI', 'PER_ORANG', 'PER_KELOMPOK']), price: money,
  included_persons: count.nullable().default(null), extra_person_price: money.nullable().default(null),
  min_persons: count.nullable().default(null), max_persons: count.nullable().default(null),
  description: z.string().max(5000).nullable().default(null), is_active: z.boolean().default(true),
}).superRefine((p, ctx) => {
  if (p.min_persons !== null && p.max_persons !== null && p.min_persons > p.max_persons)
    ctx.addIssue({ code: 'custom', message: 'Minimum orang tidak boleh melebihi maksimum' });
  if (p.price_type === 'PER_KELOMPOK' && p.included_persons === null)
    ctx.addIssue({ code: 'custom', message: 'Paket kelompok memerlukan jumlah orang tercakup' });
  if (p.extra_person_price !== null && p.included_persons === null)
    ctx.addIssue({ code: 'custom', message: 'Tarif tambahan orang memerlukan jumlah orang tercakup' });
  if (p.price_type === 'PER_ORANG' && (p.included_persons !== null || p.extra_person_price !== null))
    ctx.addIssue({ code: 'custom', message: 'Tarif per orang tidak memakai orang tercakup/tarif tambahan' });
});
const addonSchema = z.strictObject({ name: z.string().trim().min(1).max(100), price: money,
  unit: z.string().trim().min(1).max(40), is_active: z.boolean().default(true) });
const backgroundSchema = z.strictObject({ name: z.string().trim().min(1).max(100),
  max_persons: count.nullable().default(null), is_active: z.boolean().default(true) });
export async function validateSelection(db: Db, packageId: number, backgroundId: number | null,
  persons: number, existing?: { package_id: number | null; background_id: number | null; persons: number | null }): Promise<{ pkg: Package; background: Background | null }> {
  const pkg = await one<Package>(db, 'SELECT * FROM packages WHERE id=? FOR UPDATE', [packageId]);
  const samePackage = existing?.package_id === packageId;
  const unchanged = samePackage && existing.background_id === backgroundId && existing.persons === persons;
  ensure(!!pkg.is_active || samePackage, 'PACKAGE_INACTIVE', 'Paket tidak aktif', 422);
  ensure(unchanged || ((pkg.min_persons === null || persons >= pkg.min_persons) && (pkg.max_persons === null || persons <= pkg.max_persons)),
    'PERSONS_LIMIT', 'Jumlah orang di luar batas paket', 422);
  const backgrounds = await rows<Background>(db, 'SELECT id,name,max_persons FROM package_backgrounds WHERE package_id=? AND (is_active=TRUE OR id=?)',
    [packageId,samePackage ? existing.background_id : null]);
  const background = backgrounds.find(item => item.id === backgroundId) ?? null;
  ensure(unchanged || (backgrounds.length === 0 ? backgroundId === null : background !== null),
    'BACKGROUND_REQUIRED', 'Pilih latar aktif yang sesuai dengan paket', 422);
  ensure(unchanged || background?.max_persons === null || background === null || persons <= background.max_persons,
    'BACKGROUND_CAPACITY', 'Jumlah orang melebihi kapasitas latar', 422);
  return { pkg, background };
}
export const catalog = Router();
catalog.get('/packages', async (_req, res) => res.json(await read(async db => ({
  packages: await rows(db, 'SELECT * FROM packages ORDER BY id'),
  backgrounds: await rows(db, 'SELECT * FROM package_backgrounds ORDER BY id'),
  allowed_addons: await rows(db, 'SELECT * FROM package_addons ORDER BY package_id,addon_id'),
}))));
catalog.get('/addons', async (_req, res) => res.json(await read(db => rows(db, 'SELECT * FROM addons ORDER BY id'))));
catalog.post('/packages', role('OWNER'), async (req, res) => {
  const p = packageSchema.parse(req.body);
  const result = await transaction(async db => {
    const result = await run(db, `INSERT INTO packages(name,queue_code,price_type,price,included_persons,extra_person_price,
      min_persons,max_persons,description,is_active,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    [p.name,p.queue_code,p.price_type,p.price,p.included_persons,p.extra_person_price,p.min_persons,p.max_persons,p.description,p.is_active,actorOf(req).id]);
    await audit(db, actorOf(req), 'packages', result.insertId, 'CREATE', null, p);
    return { id: result.insertId, ...p };
  });
  res.status(201).json(result);
});
catalog.put('/packages/:id', role('OWNER'), async (req, res) => {
  const packageId = id.parse(Number(req.params['id'])); const p = packageSchema.parse(req.body);
  await transaction(async db => {
    const old = await one<Record<string, string | number | null>>(db, 'SELECT * FROM packages WHERE id=? FOR UPDATE', [packageId]);
    await run(db, `UPDATE packages SET name=?,queue_code=?,price_type=?,price=?,included_persons=?,extra_person_price=?,
      min_persons=?,max_persons=?,description=?,is_active=?,updated_by=? WHERE id=?`,
    [p.name,p.queue_code,p.price_type,p.price,p.included_persons,p.extra_person_price,p.min_persons,p.max_persons,p.description,p.is_active,actorOf(req).id,packageId]);
    await audit(db, actorOf(req), 'packages', packageId, 'UPDATE', old, p);
  });
  res.json({ id: packageId, ...p });
});
catalog.patch('/packages/:id/availability', role('ADMIN'), async (req, res) => {
  const packageId = id.parse(Number(req.params['id']));
  const input = z.strictObject({ is_open: z.boolean(), reason: reason.optional() }).parse(req.body);
  await transaction(async db => {
    const old = await one<{ is_open: number }>(db, 'SELECT is_open FROM packages WHERE id=? FOR UPDATE', [packageId]);
    if (!input.is_open) {
      ensure(!!input.reason, 'REASON_REQUIRED', 'Alasan penutupan wajib diisi', 422);
      ensure(!(await rows(db, "SELECT id FROM visits WHERE package_id=? AND status IN ('DIPANGGIL','SEDANG_DILAYANI')", [packageId])).length,
        'ROOM_BUSY', 'Ruangan masih dipakai atau pelanggan sedang dipanggil');
    }
    await run(db, 'UPDATE packages SET is_open=?,closed_reason=?,updated_by=? WHERE id=?',
      [input.is_open,input.is_open ? null : input.reason ?? null,actorOf(req).id,packageId]);
    await audit(db, actorOf(req), 'packages', packageId, 'AVAILABILITY', { is_open: !!old.is_open },
      { is_open: input.is_open }, input.reason ?? null);
  });
  res.json({ id: packageId, is_open: input.is_open });
});
catalog.post('/addons', role('OWNER'), async (req, res) => {
  const p = addonSchema.parse(req.body);
  const addonId = await transaction(async db => {
    const result = await run(db, 'INSERT INTO addons(name,price,unit,is_active) VALUES(?,?,?,?)', [p.name,p.price,p.unit,p.is_active]);
    await audit(db, actorOf(req), 'addons', result.insertId, 'CREATE', null, p); return result.insertId;
  });
  res.status(201).json({ id: addonId, ...p });
});
catalog.put('/addons/:id', role('OWNER'), async (req, res) => {
  const addonId = id.parse(Number(req.params['id'])); const p = addonSchema.parse(req.body);
  await transaction(async db => {
    const old = await one<Record<string, string | number | null>>(db, 'SELECT * FROM addons WHERE id=?', [addonId]);
    await run(db, 'UPDATE addons SET name=?,price=?,unit=?,is_active=? WHERE id=?', [p.name,p.price,p.unit,p.is_active,addonId]);
    await audit(db, actorOf(req), 'addons', addonId, 'UPDATE', old, p);
  });
  res.json({ id: addonId, ...p });
});
catalog.post('/packages/:id/backgrounds', role('OWNER'), async (req, res) => {
  const packageId = id.parse(Number(req.params['id'])); const p = backgroundSchema.parse(req.body);
  const backgroundId = await transaction(async db => {
    await one(db, 'SELECT id FROM packages WHERE id=?', [packageId]);
    const result = await run(db, 'INSERT INTO package_backgrounds(package_id,name,max_persons,is_active) VALUES(?,?,?,?)',
      [packageId,p.name,p.max_persons,p.is_active]);
    await audit(db, actorOf(req), 'package_backgrounds', result.insertId, 'CREATE', null, { package_id: packageId, ...p });
    return result.insertId;
  });
  res.status(201).json({ id: backgroundId, ...p });
});
catalog.put('/backgrounds/:id', role('OWNER'), async (req, res) => {
  const backgroundId = id.parse(Number(req.params['id'])); const p = backgroundSchema.parse(req.body);
  await transaction(async db => {
    const old = await one<Record<string, string | number | null>>(db, 'SELECT * FROM package_backgrounds WHERE id=?', [backgroundId]);
    await run(db, 'UPDATE package_backgrounds SET name=?,max_persons=?,is_active=? WHERE id=?', [p.name,p.max_persons,p.is_active,backgroundId]);
    await audit(db, actorOf(req), 'package_backgrounds', backgroundId, 'UPDATE', old, p);
  });
  res.json({ id: backgroundId, ...p });
});
catalog.put('/packages/:id/addons', role('OWNER'), async (req, res) => {
  const packageId = id.parse(Number(req.params['id']));
  const input = z.strictObject({ addon_ids: z.array(id).max(100).refine(list => new Set(list).size === list.length) }).parse(req.body);
  await transaction(async db => {
    await one(db, 'SELECT id FROM packages WHERE id=?', [packageId]);
    for (const addonId of input.addon_ids) await one(db, 'SELECT id FROM addons WHERE id=?', [addonId]);
    const old = await rows<{ addon_id: number }>(db, 'SELECT addon_id FROM package_addons WHERE package_id=?', [packageId]);
    await run(db, 'DELETE FROM package_addons WHERE package_id=?', [packageId]);
    for (const addonId of input.addon_ids) await run(db, 'INSERT INTO package_addons VALUES(?,?)', [packageId,addonId]);
    await audit(db, actorOf(req), 'packages', packageId, 'ALLOWED_ADDONS', old.map(p => p.addon_id), input.addon_ids);
  });
  res.json(input);
});

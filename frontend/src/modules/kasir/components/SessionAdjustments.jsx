import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { updateVisitSelection } from '@/modules/antrean/api'
import { Button, Input } from '@/shared/components/ui'
import { formatRupiah } from '@/shared/utils/format'
import { setTransactionAddons } from '../api'
import { activeItems, cashierError } from '../cashier'

// Penyesuaian selama sesi foto (SRS: tambahan dicatat lalu dibayar di akhir):
// tambahan layanan yang diizinkan paket + jumlah orang akhir.
// Pasang dengan key berisi versi kunjungan/transaksi supaya isian ikut segar setelah data berubah.
// Pesan (onFeedback) disimpan di induk supaya tidak hilang saat komponen ini dipasang ulang.
export default function SessionAdjustments({ detail, catalog, onUpdated, onReload, onFeedback }) {
  const { visit, transaction } = detail
  const allowedIds = new Set(catalog.allowedAddons.filter((row) => row.package_id === visit.package_id).map((row) => row.addon_id))
  const addons = catalog.addons.filter((addon) => allowedIds.has(addon.id) && Number(addon.is_active) === 1)
  const current = Object.fromEntries(
    activeItems(detail)
      .filter((item) => item.item_type === 'TAMBAHAN')
      .map((item) => [item.addon_id, item.qty]),
  )

  const [qty, setQty] = useState(current)
  const [persons, setPersons] = useState(String(visit.persons ?? ''))
  const [saving, setSaving] = useState(null) // 'addons' | 'persons'

  const addonsChanged = addons.some((addon) => (qty[addon.id] ?? 0) !== (current[addon.id] ?? 0))
  const personsChanged = Number(persons) !== Number(visit.persons)

  async function save(kind, request, successMessage) {
    setSaving(kind)
    onFeedback(null)
    try {
      const result = await request()
      onFeedback({ variant: 'success', message: successMessage })
      onUpdated(result)
    } catch (error) {
      const outcome = cashierError(error)
      onFeedback(outcome)
      if (outcome.reload) onReload()
    } finally {
      setSaving(null)
    }
  }

  function saveAddons() {
    const list = Object.entries(qty)
      .filter(([, value]) => value > 0)
      .map(([addonId, value]) => ({ addon_id: Number(addonId), qty: value }))
    save(
      'addons',
      () => setTransactionAddons(transaction.id, { version: transaction.version, addons: list, reason: 'Tambahan layanan selama sesi' }),
      'Tambahan layanan disimpan. Tagihan sudah diperbarui.',
    )
  }

  function savePersons() {
    const count = Number(persons)
    if (!Number.isInteger(count) || count < 1) {
      onFeedback({ variant: 'error', message: 'Jumlah orang harus angka bulat minimal 1.' })
      return
    }
    save(
      'persons',
      () =>
        updateVisitSelection(visit.id, {
          version: visit.version,
          package_id: visit.package_id,
          background_id: visit.background_id,
          persons: count,
          reason: 'Konfirmasi jumlah orang akhir sesi',
        }),
      `Jumlah orang diubah menjadi ${count}. Tagihan sudah diperbarui.`,
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
      <div>
        <p className="font-semibold text-slate-800">Penyesuaian Selama Sesi</p>
        <p className="text-xs text-slate-500">Tambahan dicatat sekarang lalu dibayar sebelum sesi diselesaikan.</p>
      </div>

      {addons.length ? (
        <div className="space-y-2">
          {addons.map((addon) => {
            const value = qty[addon.id] ?? 0
            return (
              <div key={addon.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-700">{addon.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatRupiah(addon.price)} / {addon.unit}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="neutral"
                    className="px-2.5!"
                    aria-label={`Kurangi ${addon.name}`}
                    disabled={value === 0 || saving !== null}
                    onClick={() => setQty({ ...qty, [addon.id]: value - 1 })}
                  >
                    <Minus aria-hidden="true" className="h-3.5 w-3.5" />
                  </Button>
                  <span className="w-8 text-center text-sm font-semibold text-slate-800" aria-live="polite">
                    {value}
                  </span>
                  <Button
                    size="sm"
                    variant="neutral"
                    className="px-2.5!"
                    aria-label={`Tambah ${addon.name}`}
                    disabled={saving !== null}
                    onClick={() => setQty({ ...qty, [addon.id]: value + 1 })}
                  >
                    <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
          <Button size="sm" variant="soft" className="w-full" disabled={!addonsChanged} loading={saving === 'addons'} onClick={saveAddons}>
            Simpan Tambahan
          </Button>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Paket ini tidak punya pilihan tambahan layanan.</p>
      )}

      <div className="flex items-end gap-2 border-t border-slate-100 pt-4">
        <Input
          className="flex-1"
          label="Jumlah orang akhir"
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={persons}
          onChange={(event) => setPersons(event.target.value)}
        />
        <Button size="lg" variant="soft" disabled={!personsChanged} loading={saving === 'persons'} onClick={savePersons}>
          Ubah
        </Button>
      </div>
    </div>
  )
}

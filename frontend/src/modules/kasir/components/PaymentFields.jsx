import { Input, Select } from '@/shared/components/ui'
import { formatRupiah } from '@/shared/utils/format'
import { PAYMENT_METHODS, cashError, paymentAmount } from '../cashier'
import { SummaryRow } from './BillSummary'

// Pembayaran untuk melunasi `due` (tab Di Tempat & pop-up Sudah Datang):
// Metode, Uang diterima (Tunai, dicek langsung "Kurang RpX") atau Nominal (Transfer/QRIS = pas),
// Referensi (Transfer, opsional), Kembalian.
// value: { method, amount, reference } (string), errors: { amount, reference }.
export default function PaymentFields({ due, value, onChange, errors = {}, disabled = false }) {
  const cash = value.method === 'TUNAI'
  const amount = paymentAmount(value, due)
  const change = cash && amount > due ? amount - due : 0
  const amountError = errors.amount ?? cashError(value, due)

  return (
    <div className="space-y-4">
      <Select
        label="Metode"
        options={PAYMENT_METHODS}
        value={value.method}
        disabled={disabled}
        onChange={(event) => onChange({ ...value, method: event.target.value, reference: '' })}
      />
      {cash ? (
        <Input
          label="Uang diterima (Rp) *"
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          placeholder={due ? String(due) : '0'}
          value={value.amount}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, amount: event.target.value })}
          error={amountError}
          hint={Number(value.amount) > 0 ? formatRupiah(value.amount) : undefined}
        />
      ) : (
        <Input label="Nominal" value={formatRupiah(due)} readOnly tabIndex={-1} error={amountError} />
      )}
      {value.method === 'TRANSFER' && (
        <Input
          label="Referensi (opsional)"
          maxLength={100}
          autoComplete="off"
          value={value.reference}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, reference: event.target.value })}
          error={errors.reference}
        />
      )}
      <SummaryRow strong label="Kembalian" value={formatRupiah(change)} />
    </div>
  )
}

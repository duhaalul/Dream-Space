-- Alur baru: pelanggan datang langsung membayar lunas saat mendaftar.
-- paid_off_at = waktu transaksi pertama kali lunas (dasar laporan penjualan dan nota).
-- Catatan: jangan memakai titik koma di komentar, migrate.ts memecah perintah dengan titik koma.
ALTER TABLE transactions ADD COLUMN paid_off_at DATETIME(3) NULL AFTER completed_at;
CREATE INDEX transactions_paid_off_at ON transactions(paid_off_at);
-- Data lama yang sudah lunas memakai waktu pembayaran terakhirnya (transaksi batal tidak diisi).
UPDATE transactions t
  SET t.paid_off_at = (SELECT MAX(p.paid_at) FROM payments p WHERE p.transaction_id = t.id)
  WHERE t.payment_status IN ('LUNAS','TIDAK_ADA_TAGIHAN') AND t.cancelled_at IS NULL AND t.price_type_snapshot IS NOT NULL

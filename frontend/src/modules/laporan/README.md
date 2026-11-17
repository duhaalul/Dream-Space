# Modul Laporan

Pegangan kerja modul **Dashboard dan Laporan** (SRS 5.1, 5.5). Aturan umum ada di [README frontend](../../../README.md).

## Tujuan
Owner memantau penjualan dan penerimaan uang, melihat laporan per periode, dan mengekspornya ke PDF/Excel.
FR-11, FR-15 · UC-21, UC-22, UC-23.

## Penanggung jawab
**Larisa**

## Halaman & komponen
| File | Layar di Figma | Peran | Status |
|---|---|---|---|
| `pages/DashboardPage.jsx` | Dashboard | Owner | Selesai |
| `pages/ReportsPage.jsx` | Laporan | Owner; Admin (hari ini) | Selesai |
| `components/` | `PeriodFilter.jsx`, `SalesChart.jsx` (penjualan per jam/tanggal), `SalesMethodChart.jsx` (penjualan per metode) | Owner | Selesai |

Komponen dasar yang sudah tersedia (`@/shared/components/ui`, contoh di `/dev/komponen`):
- `PageHeader` dengan `actions={<SegmentedControl …/>}`: judul + pilihan periode di kanan, seperti desain;
- `StatCard`: 3 kartu angka di atas Dashboard (Nilai Penjualan, Transaksi Lunas, Paket Terlaris);
- `Card`: kotak grafik dan tabel;
- `Table`: tabel laporan;
- `Button variant="danger"` / `variant="soft-success"`: tombol Unduh PDF / Unduh Excel.

## Hak akses
- **Owner:** Dashboard dan Laporan, periode bebas.
- **Admin:** Laporan **hari ini saja** (tanpa pilihan periode, chip tanggal hari ini; backend menolak periode lain: `REPORT_TODAY_ONLY`). Tidak ada Dashboard.

## API (`api.js`)
Parameter periode: `{ period: 'today' | 'week' | 'month' | 'custom', from?, to? }`. `week` = Senin–Minggu. `from`/`to` (`YYYY-MM-DD`) hanya untuk `custom`.

| Fungsi | Endpoint | Hasil |
|---|---|---|
| `getDashboard(params)` | `GET /dashboard` | `{ from, to, sales, dp: { count, amount }, lunas: { count, amount }, refund: { count, amount }, methods: [{ method, amount }], packages, visits_by_status }` |
| `getReport(code, params)` | `GET /reports/:code?format=json` | `{ code, from, to, rows }` |
| `downloadReport(code, format, params)` | `GET /reports/:code?format=pdf\|xlsx` | File → simpan dengan `saveBlob()` |

`REPORT_CODES` di `api.js`:

| Kode | Laporan | Isi `rows` |
|---|---|---|
| `sales` | L-01 Penjualan | **Satu baris per pembayaran / refund**: `paid_at` (Waktu), `transaction_no`, `customer_name`, `customer_type` (Jenis: Di Tempat/Reservasi), `package_name`, `persons`, `method`, `status` (DP/Lunas/Refund), `amount` (Nominal; Refund **negatif**) |
| `packages` | L-02 Penjualan per Paket | L-01 per paket: `name`, `payments` (jumlah pembayaran masuk), `sales` (bersih, sudah dikurangi refund), urut penjualan terbesar (paket tanpa pembayaran ikut tampil) |

**Penjualan = buku kas** (uang masuk dan keluar pada hari kejadian): DP reservasi → baris DP; pelunasan saat datang → baris Lunas sebesar sisanya; bayar penuh (Di Tempat / reservasi lunas) → satu baris Lunas; kelebihan bayar yang dikembalikan saat **Ubah Reservasi** → baris **Refund** minus (badge merah, "−Rp…"). Kunjungan yang dibatalkan tetap tercatat (uangnya ditahan, tidak di-refund). Total = uang bersih. Kolom Waktu ringkas: satu hari → jam saja; beberapa hari → "17 Nov 14.05".

Kartu L-01: **Total Penjualan** (bersih) · DP · Lunas · **Refund** (grid 4, bertumpuk di HP).

L-03 Penerimaan Uang dihapus (17 Nov 2026) dan L-04 Rekap Kunjungan dihapus (kebutuhannya dipenuhi menu Riwayat). Kolom Subtotal tidak ada: tanpa fitur diskon nilainya selalu sama dengan Total.

**Data untuk grafik Dashboard** (semua berdasar buku kas = uang bersih):
- grafik penjualan: `getReport('sales', params)` → kelompokkan `amount` per jam/hari dari `paid_at` (refund mengurangi jam/hari kejadiannya);
- penjualan per metode: `dashboard.methods` (uang bersih per metode; jumlahnya = `sales`);
- kartu: Nilai Penjualan (`sales` = DP + Lunas − Refund; hint "DP Rp… · Lunas Rp…", ditambah "· Refund −Rp…" bila ada), Transaksi Lunas (`lunas.count`), Paket Terlaris;
- paket terlaris: `packages[0]` dari `getDashboard` bila `sales > 0`; bila belum ada, tampilkan "Belum ada" (backend juga mengirim paket tanpa pembayaran).

## Aturan wajib
- Pilihan periode: Hari ini, Minggu ini, Bulan ini, Rentang tanggal (maksimal 367 hari; `from` dan `to` wajib).
- **Nyaman dibuka di HP** (NFR-03): kartu bertumpuk, grafik memakai Recharts `ResponsiveContainer`, tabel bisa digeser.
- Ekspor: `downloadReport(code, 'pdf' | 'xlsx', params)` lalu `saveBlob(blob, 'nama-file')`.
- Maksimal 10.000 baris per laporan.
- Hapus dari desain: tulisan "+12% dari target harian" (tidak ada data target). Tidak ada laporan shift atau kas laci.
- Laporan target selesai ≤ 5 detik (NFR-06); tampilkan indikator memuat.

## Error yang ditangani khusus
| Kode | Tindakan di tampilan |
|---|---|
| `DATE_RANGE_REQUIRED` | Rentang tanggal belum lengkap |
| `INVALID_RANGE` | Tanggal terbalik atau lebih dari 367 hari |
| `REPORT_TOO_LARGE` | Lebih dari 10.000 baris; minta persempit periode |

## Hubungan dengan modul lain
Tidak memakai modul lain, hanya `shared/` (`formatRupiah`, `formatDate`, `REPORT_PERIODS`, `saveBlob`). Dashboard adalah halaman awal Owner (`HOME_BY_ROLE` di `shared/utils/constants.js`).

## Checklist selesai
- [x] Pilihan periode (dipakai Dashboard dan Laporan)
- [x] Dashboard: nilai penjualan, transaksi lunas, paket terlaris
- [x] Grafik penjualan dan penjualan per metode (Recharts)
- [x] Laporan L-01 dan L-02 dalam tabel (L-01 dengan kolom Metode)
- [x] Unduh PDF dan Excel
- [x] Nyaman dibuka di HP
- [x] `npm run build` dan `npm run lint` lulus
- [ ] Semua langkah uji di bawah lulus

## Cara mengetes
1. Login `owner` → Dashboard tampil dengan periode Hari ini.
2. Ganti ke Bulan ini → angka dan grafik berubah.
3. Rentang tanggal tanpa tanggal akhir → pesan rentang belum lengkap.
4. Unduh L-01 PDF dan L-02 Excel → file bisa dibuka; L-01 punya kolom Metode, tanpa Subtotal.
5. Buka di ukuran HP (DevTools, lebar 390px) → tidak ada scroll ke samping.
6. Login `admin` → menu Laporan ada (hari ini saja, tanpa pilihan periode), Dashboard tidak ada.
7. Ubah Reservasi lunas ke paket lebih murah (Antrean › Detail) → L-01 punya baris Refund minus; kartu Total = DP + Lunas − Refund; hint Dashboard menampilkan "Refund −Rp…".

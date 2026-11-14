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
| `pages/ReportsPage.jsx` | Laporan | Owner | Selesai |
| `components/` | `PeriodFilter.jsx`, `SalesChart.jsx`, `CashMethodChart.jsx` | Owner | Selesai |

Komponen dasar yang sudah tersedia (`@/shared/components/ui`, contoh di `/dev/komponen`):
- `PageHeader` dengan `actions={<SegmentedControl …/>}`: judul + pilihan periode di kanan, seperti desain;
- `StatCard`: 4 kartu angka di atas (`tone="green"` untuk Sesi Selesai);
- `Card`: kotak grafik dan tabel;
- `Table`: tabel laporan;
- `Button variant="danger"` / `variant="soft-success"`: tombol Unduh PDF / Unduh Excel.

## Hak akses
Owner saja. Admin tidak punya Dashboard maupun Laporan; laporan shift Admin sudah dihapus dari desain.

## API (`api.js`)
Parameter periode: `{ period: 'today' | 'week' | 'month' | 'custom', from?, to? }`. `week` = Senin–Minggu. `from`/`to` (`YYYY-MM-DD`) hanya untuk `custom`.

| Fungsi | Endpoint | Hasil |
|---|---|---|
| `getDashboard(params)` | `GET /dashboard` | `{ from, to, sessions, sales, cash_in, refunds, net_cash, cancelled_net_cash, packages, visits_by_status }` |
| `getReport(code, params)` | `GET /reports/:code?format=json` | `{ code, from, to, rows }` |
| `downloadReport(code, format, params)` | `GET /reports/:code?format=pdf\|xlsx` | File → simpan dengan `saveBlob()` |

`REPORT_CODES` di `api.js`:

| Kode | Laporan | Isi `rows` |
|---|---|---|
| `sales` | L-01 Penjualan | Transaksi Selesai: `transaction_no`, `customer_name`, `package_name`, `persons`, `total`, `completed_at` |
| `packages` | L-02 Penjualan per paket | `name`, `sessions`, `sales`, urut terlaris (paket 0 sesi ikut tampil) |
| `cash` | L-03 Penerimaan uang | `kind` (PAYMENT/REFUND), `method`, `cash_in`, `cash_out`, `net`, `occurred_at`, `category` |
| `visits` | L-04 Rekap kunjungan | `queue_label`, `customer_name`, `status`, waktu-waktu, `total`, `payment_status` |

**Data untuk grafik Dashboard.** Endpoint dashboard tidak mengirim data per jam atau per metode, jadi diolah dari laporan:
- grafik penjualan: `getReport('sales', params)` → kelompokkan `total` per jam/hari dari `completed_at`;
- penerimaan per metode: `getReport('cash', params)` → jumlahkan `net` per `method`;
- paket terlaris: `packages[0]` dari `getDashboard` bila `sessions > 0`; bila belum ada sesi, tampilkan "Belum ada" (backend juga mengirim paket dengan 0 sesi).

## Aturan wajib
- Pilihan periode: Hari ini, Minggu ini, Bulan ini, Rentang tanggal (maksimal 367 hari; `from` dan `to` wajib).
- **Nyaman dibuka di HP** (NFR-03): kartu bertumpuk, grafik memakai Recharts `ResponsiveContainer`, tabel bisa digeser.
- Ekspor: `downloadReport(code, 'pdf' | 'xlsx', params)` lalu `saveBlob(blob, 'nama-file')`.
- Maksimal 10.000 baris per laporan.
- L-03: uang dari transaksi Dibatalkan (`category = 'BATAL_DITAHAN'`) ditampilkan terpisah.
- `cancelled_net_cash` di dashboard adalah uang dari transaksi batal, **bukan** nilai penjualan.
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
- [x] Dashboard: nilai penjualan, sesi selesai, penerimaan, paket terlaris
- [x] Grafik penjualan dan penerimaan per metode (Recharts)
- [x] Laporan L-01 s.d. L-04 dalam tabel
- [x] Unduh PDF dan Excel
- [x] Nyaman dibuka di HP
- [x] `npm run build` dan `npm run lint` lulus
- [ ] Semua langkah uji di bawah lulus

## Cara mengetes
1. Login `owner` → Dashboard tampil dengan periode Hari ini.
2. Ganti ke Bulan ini → angka dan grafik berubah.
3. Rentang tanggal tanpa tanggal akhir → pesan rentang belum lengkap.
4. Unduh L-01 PDF dan L-03 Excel → file bisa dibuka.
5. Buka di ukuran HP (DevTools, lebar 390px) → tidak ada scroll ke samping.
6. Login `admin` → tidak ada menu Dashboard dan Laporan.

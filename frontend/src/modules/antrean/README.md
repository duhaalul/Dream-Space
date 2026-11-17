# Modul Antrean

Pegangan kerja modul **Antrean Layanan**. Aturan umum ada di [README frontend](../../../README.md).

## Tujuan
Menampilkan antrean per paket dan menjalankan sesi: panggil, mulai foto (dengan **timer**), lewati, kembalikan, batalkan, **selesai**.
Di bawahnya ada bagian **Reservasi**: pelanggan reservasi yang belum datang (per tanggal), dengan tombol **Sudah Datang**.
Pendaftaran pelanggan (Di Tempat & Reservasi) ada di menu **Pendaftaran** (modul `kasir`).

## Penanggung jawab
**Ihsan**

## Halaman & komponen
Satu halaman `/antrean` (tanpa tab): kartu paket → banner ruangan → Di Ruangan, Menunggu, Dilewati → **Reservasi**. Paket terpilih disimpan di URL (`?paket=RG`).

| File | Isi | Peran |
|---|---|---|
| `pages/QueuePage.jsx` | wadah halaman | Admin; Owner lihat |
| `components/QueueBoard.jsx` | papan per paket + bagian Reservasi + pop-up (Detail, Sudah Datang, Ubah Reservasi) | Admin; Owner lihat |
| `components/ReservationSection.jsx` | bagian Reservasi: pilihan tanggal, kartu (jam, nama, "Paket · N orang"/"Belum pilih paket", **Lunas / Sisa Rp…**), tombol **Terlewat (N)** → daftar reservasi lewat tanggal | Admin; Owner lihat |
| `components/CheckInModal.jsx` | pop-up **Sudah Datang**: chip data reservasi, **tambahan** (boleh ditambah, tidak dikurangi), isian paket (data lama), sisa bayar, **Masuk Antrean** → pop-up Berhasil | Admin |
| `components/ReservationEditModal.jsx` | pop-up **Ubah Reservasi**: isian sama dengan form Reservasi (`kasir/components/ReservationFields`), rincian Total · Sudah dibayar · Sisa dibayar saat datang / **Dikembalikan** + "Dikembalikan lewat" (Tunai/Transfer), satu Simpan | Admin |
| `components/PackageTiles.jsx` | kartu paket (Kosong/Dipanggil/Dipakai/Ditutup) + sisa waktu sesi | Admin; Owner lihat |
| `components/RoomBanner.jsx` | banner ruangan + Tutup/Buka Ruangan (Admin) | Admin; Owner lihat |
| `components/VisitCard.jsx` | kartu pelanggan + nomor antrean + timer; badge bayar bila belum lunas (atau `badge` khusus) | Admin; Owner lihat |
| `components/SessionTimer.jsx` | pil sisa waktu "12:30"; merah "Lewat 2:10" bila habis | Admin; Owner lihat |
| `components/SessionEndNotifier.jsx` | notifikasi kanan bawah saat waktu sesi habis (dipasang di `app/AppLayout.jsx`, semua halaman) | Admin |
| `components/VisitActionButtons.jsx` | tombol tindakan per status (semua berikon) | Admin |
| `components/ReasonDialog.jsx` | dialog alasan (Batalkan; Kembalikan untuk data lama Dilewati) | Admin |
| `components/VisitDetailModal.jsx` | Detail ringkas: jadwal & No. WhatsApp (reservasi), paket, tambahan, pembayaran ("Dibayar … · dikembalikan … · sisa …", Lunas dari `payment_status`), jam daftar, alasan batal; Batalkan, Ubah Reservasi, Cetak Nota | Admin; Owner lihat |
| `components/BoardParts.jsx` | `Section`, `EmptyNote`, `RefreshButton`, `QueueLoading`, `ActionFeedback` | — |
| `components/PackageFields.jsx` | Paket, Latar, Jumlah Orang sejajar satu baris (Pendaftaran, Reservasi, Sudah Datang); `PACKAGE_GRID` = lajurnya, dipakai baris lain yang ingin lurus | Admin |
| `useQueueData.js` | data antrean hari ini, `useReservations(date)`, `useOverdueReservations()` (reservasi terlewat, 1 tahun ke belakang), `useDayVisits(date)`; diperbarui otomatis tiap 15 detik | — |
| `useVisitActions.js` | jalankan tindakan + pesan sukses/error; memancarkan `QUEUE_CHANGED_EVENT` | — |
| `useNow.js` | waktu sekarang per detik (untuk timer) | — |
| `queue.js` | `buildBoard`, `packageQueue`, `queueLabel`/`formatQueueNumber` (`RG-001`, `RG-R001`), `ticketFor`, `visitMeta`, `sessionTimer`, `whatsappNumber` | — |
| `visitForm.js` | validasi paket/latar/orang, `interpretSaveError` (jam reservasi dihitung backend: `kasir/useReservationSlots.js`) | — |

## Hak akses
| Tindakan | Admin | Owner |
|---|---|---|
| Melihat papan antrean, bagian Reservasi, timer, Detail | ✓ | ✓ |
| Tombol tindakan, Sudah Datang, Ubah Reservasi, Tutup/Buka Ruangan, notifikasi waktu habis | ✓ | — |

## API (`api.js`)
| Fungsi | Endpoint | Dipakai untuk |
|---|---|---|
| `getQueueRooms()` | `GET /queue/rooms` | Status ruangan + sesi berjalan (`started_at`, `session_minutes`, `customer_type`) untuk notifikasi |
| `getVisits(params)` | `GET /visits` | Kunjungan per tanggal: `{ date, page, search }` (termasuk status RESERVASI) |
| `getVisit(id)` | `GET /visits/:id` | Detail, isi pop-up Sudah Datang |
| `runVisitAction(id, data)` | `POST /visits/:id/actions` | `{ version, action, reason? }` |
| `updateVisitSelection` | `PUT /visits/:id/selection` | Belum dipakai (nanti untuk koreksi) |

Sudah Datang dan Ubah Reservasi memakai `checkInReservation` dan `updateReservation` dari `kasir/api.js`.

## Tombol per status
| Status | Tombol (Admin) | `action` |
|---|---|---|
| Reservasi (belum datang) | **Sudah Datang** (hanya pada tanggal reservasi) · Batalkan · Detail (Ubah Reservasi) | check-in · `CANCEL` |
| Menunggu | Panggil · Batalkan | `CALL` (siapa pun, tanpa alasan) · `CANCEL` |
| Dipanggil | Mulai Foto · **Kembali ke Antrean** · Batalkan | `START` · `UNCALL` (tanpa alasan; kembali ke **urutan semula**, mis. salah panggil atau belum di tempat) · `CANCEL` |
| Sedang foto | **Selesai** (bisa ditekan kapan saja, walau timer masih berjalan) | `FINISH` (wajib lunas) |
| Dilewati (hanya data lama; tombol Lewati sudah diganti) | Kembalikan · Batalkan | `RETURN` (alasan; masuk paling belakang) · `CANCEL` |
| Selesai / Dibatalkan | — | pindah ke Riwayat |

Batalkan wajib alasan dan hanya sebelum foto dimulai. Uang yang sudah dibayar **tidak dikembalikan** (DP maupun reservasi yang sudah lunas).

## Reservasi, Ubah Reservasi & Sudah Datang
- Bagian **Reservasi** (paling bawah): **semua paket** pada satu tanggal (bawaan hari ini), urut jam. Pilih tanggal lain untuk melihat reservasi mendatang atau yang belum datang dari hari sebelumnya.
- Kartu: **Lunas**, atau **Sisa Rp…** (= total − uang bersih yang sudah dibayar, field `paid` dari `GET /visits`) untuk yang belum lunas, termasuk reservasi lunas yang naik paket. Data lama tanpa paket: "DP".
- Reservasi yang tidak datang **tidak** ditutup otomatis: tetap ada sampai Admin membatalkan atau mengubahnya.
- **Terlewat (N)** (di samping pilihan tanggal, hanya bila ada): reservasi yang tanggalnya sudah lewat tapi belum datang/dibatalkan.
  - Diklik → judul "Reservasi Terlewat (N)", semua tampil sekaligus urut jadwal; kotak jam memuat tanggalnya.
  - Tombol Batalkan & Detail (Ubah Reservasi untuk pindah jadwal), tanpa Sudah Datang.
  - Diklik lagi atau memilih tanggal → kembali ke tampilan per tanggal.
- **Ubah Reservasi** (Detail › Ubah Reservasi; hanya sebelum datang): nama, No. WA, paket, latar, jumlah orang, tambahan, tanggal & jam dalam satu pop-up.
  - Pilihan jam dihitung ulang dengan lama pemakaian baru (reservasi itu sendiri tidak dihitung bentrok); jam semula tetap bisa dipilih.
  - Ganti paket → harga paket sekarang; paket sama → harga saat reservasi.
  - Total baru > sudah dibayar → **"Sisa dibayar saat datang"** (tidak ada uang berpindah sekarang; status jadi belum lunas).
  - Total baru < sudah dibayar → **"Dikembalikan RpX"** + pilihan **Dikembalikan lewat** Tunai/Transfer; refund tercatat saat Simpan (masuk Laporan sebagai baris minus).
- **Sudah Datang** (pop-up, hanya pada tanggal reservasi, jam berapa pun):
  - data reservasi tampil sebagai chip (jam, paket, Lunas/Dibayar Rp…);
  - **tambahan boleh ditambah** sebelum masuk Menunggu; yang sudah dipesan tidak bisa dikurangi (kurangi lewat Ubah Reservasi). Paket/latar/orang terkunci;
  - data lama tanpa paket → isi Paket, Latar, Jumlah Orang, Tambahan (DP lebih besar dari total ditolak);
  - masih ada sisa → bayar sisa (Tunai/Transfer/QRIS); sudah lunas → langsung;
  - **Masuk Antrean** → pop-up Berhasil (nomor `RG-R001`, Kembalian, Cetak Nota).
- Setelah masuk Menunggu semuanya terkunci.
- Datang di hari lain → Detail › **Ubah Reservasi** ke hari ini dulu.

## Urutan & nomor
- Menunggu diurutkan backend menurut **jam masuk**: datang langsung = jam daftar; reservasi = **jam reservasinya** (walau terlambat/lebih awal). Kartu menulis "Masuk HH.MM".
- Nomor per paket per hari: datang langsung `RG-001`, `RG-002`…; reservasi punya urutan sendiri `RG-R001`, `RG-R002`… (diberikan saat Sudah Datang). Jadi nomor tidak selalu sama dengan urutan.
- Admin bebas memanggil siapa pun di Menunggu tanpa alasan; urutan hanya panduan.

## Timer sesi
- Durasi = **Durasi Sesi** paket + (jumlah × **Menit Tambahan**) dari tambahan waktu; keduanya diatur Owner di Kelola Paket.
- Backend menghitung dan menyimpannya di `visit.session_minutes` saat **Mulai Foto**, jadi perubahan katalog tidak mengubah sesi yang sedang berjalan.
- Paket tanpa durasi → tanpa timer.
- Waktu habis:
  - pil berubah merah "Lewat …";
  - Admin mendapat notifikasi kecil di kanan bawah (semua halaman), berisi tombol **Lihat** (ke paketnya) dan **X**.
  - Notifikasi hilang bila ditutup atau sesi diselesaikan.
  - Sesi **tidak** berhenti otomatis.

## Aturan wajib
- Antrean per paket; satu paket hanya satu sesi pada satu waktu. Nomor dibuat backend.
- Urutan diambil dari backend, jangan dihitung sendiri. Tidak ada perkiraan waktu tunggu.
- Mulai Foto & Selesai hanya bila lunas (Di Tempat lunas saat daftar, reservasi lunas saat Sudah Datang).
- Kirim `visit.version` terbaru di setiap tindakan.
- Kunjungan hari sebelumnya yang sudah masuk antrean tapi lupa ditutup **ditutup otomatis oleh backend**:
  - Menunggu, Dipanggil, Dilewati → Dibatalkan;
  - Sedang foto → Selesai.
  - Karena itu papan hanya menampilkan hari ini.
- Tampilan ringkas: hanya info penting, tulisan sedikit, setiap tombol berikon.

## Error yang ditangani khusus
| Kode | Tindakan di tampilan |
|---|---|
| `STALE_VERSION` | Data berubah di komputer lain: muat ulang, jangan kirim ulang otomatis |
| `ROOM_BUSY`, `ROOM_CLOSED` | Ruangan dipakai/ditutup; tombol Panggil nonaktif |
| `PAYMENT_REQUIRED_BEFORE_START` | Belum lunas |
| `WRONG_SERVICE_DATE`, `PACKAGE_LOCKED`, `ADDON_DECREASE_NOT_ALLOWED`, `DP_EXCEEDS_TOTAL`, `PAYMENT_NOT_SETTLED` | Pop-up Sudah Datang: pesan di pop-up / kolomnya |
| `RESERVATION_CLASH`, `REFUND_REQUIRED` | Pop-up Ubah Reservasi: pesan di kolom Jam / di pop-up |

Error lain ditampilkan dengan pesan dari backend.

## Hubungan dengan modul lain
- **Ke `kasir`:** Pendaftaran memakai `PackageFields`, `useDayVisits`, `packageQueue`, `interpretSaveError`; Detail memakai `downloadReceipt`.
- **Dari `kasir`:** `CheckInModal` memakai `checkInReservation`, `useCatalog`, `BillSummary`, `PaymentFields`, `RegistrationSuccess`, `AddonPicker`, `PackageSummary`; `ReservationEditModal` memakai `updateReservation`, `ReservationFields`, `useReservationTime`, `editBillPreview`, `BillSummary`.
- **Dari `paket`:** `getPackages()` (termasuk `duration_minutes`), `getAddons()` (termasuk `extra_minutes`), dan `RoomAvailabilityToggle`.
- **`app/AppLayout.jsx`** memasang `SessionEndNotifier` untuk Admin.

## Cara mengetes
1. Daftarkan pelanggan di Pendaftaran › Di Tempat → muncul di papan paketnya (Menunggu) dengan nomor `RG-xxx`.
2. Panggil → Mulai Foto → pil timer berjalan di kartu dan di kartu paket → Selesai → muncul di Riwayat.
3. Isi Durasi Sesi paket 1 menit → Mulai Foto → setelah 1 menit pil merah "Lewat" dan notifikasi muncul di kanan bawah (juga di halaman Pendaftaran). X menutupnya; Selesai menghapusnya.
4. Panggil pelanggan kedua di Menunggu → langsung dipanggil tanpa dialog alasan. **Kembali ke Antrean** → tanpa dialog, ruangan kosong, ia kembali ke urutan ke-2 (bukan paling belakang).
5. Buat reservasi (Pendaftaran › Reservasi) untuk hari ini → muncul di bagian Reservasi. Sudah Datang (paket + DP) → bayar sisa tunai → nomor `RG-R001`, kartu Menunggu "Masuk <jam reservasi>".
6. Ganti tanggal bagian Reservasi ke besok → tanpa tombol Sudah Datang. Detail › Ubah Reservasi ke hari ini → pindah ke hari ini. Batalkan → hilang dari Reservasi, masuk Riwayat.
7. Reservasi lunas → Ubah Reservasi, hapus tambahan → "Dikembalikan Rp…" + Dikembalikan lewat Tunai → Simpan → Laporan punya baris Refund minus. Naikkan paket → "Sisa dibayar saat datang" → Sudah Datang menagih sisanya.
8. Sudah Datang → tambah 1 tambahan → Total & Sisa naik; tombol − tidak bisa di bawah jumlah yang sudah dipesan.
9. Login Owner → hanya melihat (Detail), tanpa tombol tindakan, Sudah Datang, Ubah Reservasi, dan notifikasi.

Uji otomatis UI: `tools/ui-test/uji-reservasi.mjs` (di luar repo).

## Belum dibuat / ditunda
- **Koreksi** setelah masuk Menunggu (ganti paket/tambahan, koreksi nama, salah metode bayar): ditunda ke fitur koreksi.
- Pengingat reservasi yang lewat tanggal tanpa datang (sekarang dilihat lewat pilihan tanggal).

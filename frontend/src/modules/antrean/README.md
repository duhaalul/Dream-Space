# Modul Antrean

Pegangan kerja modul **Antrean Layanan** (SRS 4.1–4.3, 5.1). Aturan umum ada di [README frontend](../../../README.md).

## Tujuan
Menampilkan antrean per paket dan menjalankan sesi: panggil, mulai foto (dengan **timer**), lewati, kembalikan, batalkan, **selesai**.
Pendaftaran pelanggan ada di menu **Pendaftaran** (modul `kasir`); Antrean hanya mengurus antrean.

## Penanggung jawab
**Ihsan**

## Halaman & komponen
Satu halaman `/antrean` (tanpa tab): kartu paket → banner ruangan → Di Ruangan, Menunggu, Dilewati. Paket terpilih disimpan di URL (`?paket=RG`).

| File | Isi | Peran |
|---|---|---|
| `pages/QueuePage.jsx` | wadah halaman | Admin; Owner lihat |
| `components/QueueBoard.jsx` | papan per paket: Di Ruangan, Menunggu, Dilewati | Admin; Owner lihat |
| `components/PackageTiles.jsx` | kartu paket (Kosong/Dipanggil/Dipakai/Ditutup) + sisa waktu sesi | Admin; Owner lihat |
| `components/RoomBanner.jsx` | banner ruangan + Tutup/Buka Ruangan (Admin) | Admin; Owner lihat |
| `components/VisitCard.jsx` | kartu pelanggan + nomor antrean + timer (badge bayar hanya bila belum lunas) | Admin; Owner lihat |
| `components/SessionTimer.jsx` | pil sisa waktu "12:30"; merah "Lewat 2:10" bila habis | Admin; Owner lihat |
| `components/SessionEndNotifier.jsx` | notifikasi kanan bawah saat waktu sesi habis (dipasang di `app/AppLayout.jsx`, semua halaman) | Admin |
| `components/VisitActionButtons.jsx` | tombol tindakan per status (semua berikon) | Admin |
| `components/ReasonDialog.jsx` | dialog alasan (Lewati, Kembalikan, Batalkan, Panggil di luar urutan) | Admin |
| `components/VisitDetailModal.jsx` | Detail ringkas: paket, tambahan, pembayaran, jam daftar, alasan batal; Batalkan + Cetak Nota | Admin; Owner lihat |
| `components/BoardParts.jsx` | `Section`, `EmptyNote`, `RefreshButton`, `QueueLoading`, `ActionFeedback` | — |
| `components/PackageFields.jsx` | Paket, Latar, Jumlah Orang sejajar satu baris (dipakai di Pendaftaran; info kapasitas di `kasir/components/PackageSummary`) | Admin |
| `useQueueData.js` | data antrean hari ini + `useDayVisits(date)` (→ `{ data, error, reload }`); diperbarui otomatis tiap 15 detik | — |
| `useVisitActions.js` | jalankan tindakan + pesan sukses/error; memancarkan `QUEUE_CHANGED_EVENT` | — |
| `useNow.js` | waktu sekarang per detik (untuk timer) | — |
| `queue.js` | `buildBoard`, `packageQueue`, `queueLabel`, `ticketFor`, `visitMeta`, `sessionTimer` | — |
| `visitForm.js` | validasi paket/latar/orang, `interpretSaveError` (peta error → kolom) | — |
| `components/ReservationForm.jsx`, `EstimateBox.jsx` | **belum dipakai** (disimpan untuk reservasi) | — |

## Hak akses
| Tindakan | Admin | Owner |
|---|---|---|
| Melihat papan antrean, timer, Detail | ✓ | ✓ |
| Tombol tindakan, Tutup/Buka Ruangan, notifikasi waktu habis | ✓ | — |

## API (`api.js`)
| Fungsi | Endpoint | Dipakai untuk |
|---|---|---|
| `getQueueRooms()` | `GET /queue/rooms` | Status ruangan + sesi berjalan (`started_at`, `session_minutes`) untuk notifikasi |
| `getVisits(params)` | `GET /visits` | Kunjungan per tanggal: `{ date, page, search }` |
| `getVisit(id)` | `GET /visits/:id` | Detail |
| `runVisitAction(id, data)` | `POST /visits/:id/actions` | `{ version, action, reason?, priority? }` |
| `createVisit`, `updateVisitSelection` | `POST /visits`, `PUT /visits/:id/selection` | Belum dipakai (reservasi nanti) |

## Tombol per status
| Status | Tombol (Admin) | `action` |
|---|---|---|
| Menunggu | Panggil · Batalkan | `CALL` (di luar urutan wajib alasan) · `CANCEL` |
| Dipanggil | Mulai Foto · Lewati · Batalkan | `START` · `SKIP` (alasan) · `CANCEL` |
| Sedang foto | **Selesai** (bisa ditekan kapan saja, walau timer masih berjalan) | `FINISH` (wajib lunas) |
| Dilewati | Kembalikan · Batalkan | `RETURN` (alasan; masuk paling belakang) · `CANCEL` |
| Selesai / Dibatalkan | — | pindah ke Riwayat |

Batalkan wajib alasan dan hanya sebelum foto dimulai. Uang yang sudah dibayar tidak dikembalikan.

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
- Antrean per paket; satu paket hanya satu sesi pada satu waktu. Nomor `KODE-001` per paket per hari dibuat backend.
- Urutan diambil dari backend, jangan dihitung sendiri. Tidak ada perkiraan waktu tunggu.
- Mulai Foto & Selesai hanya bila lunas (pelanggan datang langsung selalu sudah lunas saat daftar).
- Kirim `visit.version` terbaru di setiap tindakan.
- Kunjungan hari sebelumnya yang lupa ditutup **ditutup otomatis oleh backend**:
  - Menunggu, Dipanggil, Dilewati → Dibatalkan;
  - Sedang foto → Selesai.
  - Karena itu Antrean hanya menampilkan hari ini.
- Tampilan ringkas: hanya info penting, tulisan sedikit, setiap tombol berikon.

## Error yang ditangani khusus
| Kode | Tindakan di tampilan |
|---|---|
| `STALE_VERSION` | Data berubah di komputer lain: muat ulang, jangan kirim ulang otomatis |
| `ROOM_BUSY`, `ROOM_CLOSED` | Ruangan dipakai/ditutup; tombol Panggil nonaktif |
| `OUT_OF_ORDER_REASON` | Minta alasan |
| `PAYMENT_REQUIRED_BEFORE_START` | Belum lunas |

Error lain ditampilkan dengan pesan dari backend.

## Hubungan dengan modul lain
- **Ke `kasir`:** Pendaftaran memakai `PackageFields`, `useDayVisits`, `packageQueue`, `interpretSaveError`; Detail memakai `downloadReceipt`.
- **Dari `paket`:** `getPackages()` (termasuk `duration_minutes`), `getAddons()` (termasuk `extra_minutes`), dan `RoomAvailabilityToggle`.
- **`app/AppLayout.jsx`** memasang `SessionEndNotifier` untuk Admin.

## Cara mengetes
1. Daftarkan pelanggan di Pendaftaran → muncul di papan paketnya (Menunggu) dengan nomor `RG-xxx`.
2. Panggil → Mulai Foto → pil timer berjalan di kartu dan di kartu paket → Selesai → muncul di Riwayat.
3. Isi Durasi Sesi paket 1 menit → Mulai Foto → setelah 1 menit pil merah "Lewat" dan notifikasi muncul di kanan bawah (juga di halaman Pendaftaran). X menutupnya; Selesai menghapusnya.
4. Lewati tanpa alasan → ditolak. Kembalikan → masuk paling belakang.
5. Detail → Batalkan dengan alasan → pindah ke Riwayat (Dibatalkan).
6. Login Owner → hanya melihat, tanpa tombol tindakan dan tanpa notifikasi.

## Belum dibuat / ditunda
- **Reservasi WhatsApp** (Sudah Datang, DP): tampilan disembunyikan; backend & `ReservationForm.jsx` disimpan.
- **Ubah paket / koreksi nama**: ditunda ke fitur koreksi.

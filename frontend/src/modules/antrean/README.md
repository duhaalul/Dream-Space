# Modul Antrean

Pegangan kerja modul **Antrean Layanan** (SRS 4.1–4.3, 5.1). Aturan umum ada di [README frontend](../../../README.md).

## Tujuan
Mencatat reservasi WhatsApp dan pelanggan datang langsung, menampilkan antrean per paket, dan menjalankan sesi: panggil, mulai foto, lewati, kembalikan, batalkan.
FR-03, FR-04, FR-05, FR-08 · UC-07 s.d. UC-12, UC-16.

## Penanggung jawab
**Ihsan**

## Halaman & komponen
Satu halaman `/antrean` dengan 3 tab (tab aktif disimpan di URL `?tab=`).

| File | Layar di Figma | Peran | Status |
|---|---|---|---|
| `pages/QueuePage.jsx` | Antrean (wadah tab) | Admin; Owner lihat | Tab sudah berfungsi |
| `components/QueueOverview.jsx` | Antrean › ringkasan: reservasi hari ini, ruangan ditutup | Admin; Owner lihat | TODO |
| `components/QueueBoard.jsx` | Antrean › tab per paket (RG, WD, …) | Admin; Owner lihat | TODO |
| `components/VisitForm.jsx` | Antrean › Pendaftaran Datang Langsung + Reservasi WhatsApp | Admin | TODO |
| `components/VisitDetailModal.jsx` | (modal) detail, ubah, batalkan kunjungan | Admin; Owner lihat | TODO |

## Hak akses
| Tindakan | Admin | Owner |
|---|---|---|
| Melihat ringkasan dan papan per paket | ✓ | ✓ |
| Tab Pendaftaran, semua tombol tindakan | ✓ | — |

## API (`api.js`)
| Fungsi | Endpoint | Dipakai untuk |
|---|---|---|
| `getQueueRooms()` | `GET /queue/rooms` | Status ruangan dan pelanggan dipanggil/sedang foto |
| `getVisits(params)` | `GET /visits` | Daftar kunjungan per tanggal: `{ date, page, search }` |
| `getVisit(id)` | `GET /visits/:id` | Detail kunjungan (modal) |
| `createVisit(data)` | `POST /visits` | Pendaftaran datang langsung / reservasi (+ DP opsional) |
| `updateVisitSelection(id, data)` | `PUT /visits/:id/selection` | Ubah paket/latar/jumlah orang: `{ version, package_id, background_id, persons, reason }` |
| `runVisitAction(id, data)` | `POST /visits/:id/actions` | Tombol tindakan: `{ version, action, reason?, priority? }` |

Dari modul paket: `getPackages()` untuk pilihan paket, latar, dan kapasitas. Contoh body pendaftaran ada di `docs/API.md` (branch backend), bagian Kunjungan.

## Tombol per status
| Status | Tombol (Admin) | `action` |
|---|---|---|
| Reservasi | Sudah datang · Batalkan | `CONFIRM` (`priority: true`; antrean biasa = `false` + alasan) · `CANCEL` |
| Menunggu | **Panggil** · Batalkan | `CALL` (di luar urutan wajib alasan) · `CANCEL` |
| Dipanggil | **Mulai foto** atau **Lewati** · Batalkan | `START` · `SKIP` (alasan) · `CANCEL` |
| Sedang dilayani | **Selesaikan sesi** | buka `/kasir/:id`; penyelesaian dilakukan di Kasir |
| Dilewati | Kembalikan ke antrean · Batalkan | `RETURN` (alasan; masuk paling belakang) · `CANCEL` |
| Selesai / Dibatalkan | — | tidak tampil di Antrean (ada di Riwayat) |

Batalkan wajib alasan dan hanya sebelum foto dimulai. Uang yang sudah dibayar tidak dikembalikan.

## Aturan wajib
- Antrean per paket. Satu paket hanya menjalankan satu sesi pada satu waktu. Nomor `KODE-001` per paket per hari dibuat backend.
- Urutan: reservasi yang sudah datang didahulukan (tanpa menghentikan sesi berjalan), lalu urutan masuk. **Ambil urutan dari backend**, jangan menghitung sendiri.
- "Sudah datang" hanya pada tanggal janji dan setelah jam janji tiba (backend menolak sebelum itu).
- Reservasi yang belum datang tidak menahan antrean. Tidak ada perkiraan waktu tunggu.
- **Mulai foto hanya bila tagihan awal lunas.** Kalau ditolak, arahkan ke Kasir.
- Form hanya mencatat **nama panggilan**, tanpa nomor telepon (NFR-07).
- Datang langsung wajib paket + jumlah orang. Reservasi wajib tanggal & jam janji (tidak boleh lewat); paket boleh menyusul.
- DP (khusus reservasi): **nominal + metode** Tunai/Transfer/QRIS, dan referensi untuk nontunai. **Tanpa** gambar QRIS, nomor rekening, atau unggah bukti transfer.
- `client_request_id = newRequestId()` sekali per pengisian form; pakai ulang saat mencoba lagi.
- Kirim `visit.version` terbaru di setiap tindakan.
- Ubah paket/latar/jumlah orang hanya sebelum dipanggil. Kosongkan tambahan lama sebelum mengganti paket.
- **Tidak ada** tombol "Tutup Hari Kasir". Saat studio tutup, sisa antrean dibatalkan satu per satu dengan alasan.

## Error yang ditangani khusus
| Kode | Tindakan di tampilan |
|---|---|
| `PAYMENT_REQUIRED_BEFORE_START` | Pesan + tombol "Buka Kasir" ke `/kasir/:id` |
| `STALE_VERSION` | Data berubah di komputer lain: muat ulang, jangan kirim ulang otomatis |
| `ROOM_BUSY`, `ROOM_CLOSED` | Ruangan dipakai/ditutup; tombol Panggil sebaiknya sudah nonaktif |
| `OUT_OF_ORDER_REASON`, `REASON_REQUIRED` | Minta alasan |
| `APPOINTMENT_NOT_DUE` | Belum tanggal/jam janji |
| `PAST_APPOINTMENT`, `APPOINTMENT_INVALID` | Jam janji tidak valid |
| `PACKAGE_REQUIRED`, `PERSONS_REQUIRED`, `PERSONS_LIMIT`, `BACKGROUND_REQUIRED`, `BACKGROUND_CAPACITY`, `PACKAGE_INACTIVE` | Isian paket/latar/jumlah orang salah; tandai kolomnya |
| `PACKAGE_LOCKED`, `REMOVE_ADDONS_FIRST` | Paket belum bisa diganti |
| `CANNOT_CANCEL_STARTED` | Sesi sudah mulai, tidak bisa dibatalkan |
| `WRONG_SERVICE_DATE` | Antrean hari lain tidak bisa dipanggil |
| `DP_RESERVATION_ONLY`, `REFERENCE_REQUIRED` | DP hanya untuk reservasi; DP nontunai wajib referensi |
| `IDEMPOTENCY_CONFLICT` | Request ID dipakai untuk data berbeda; isi ulang form |

## Hubungan dengan modul lain
- **Memakai dari `paket`:**
  - `RoomAvailabilityToggle` (`@/modules/paket/components/RoomAvailabilityToggle`) untuk tutup/buka ruangan;
  - `getPackages()` (`@/modules/paket/api`) untuk pilihan paket.
- **Menuju `kasir`:** tombol "Selesaikan sesi" dan penolakan "Mulai foto" membuka `/kasir/:id` (`id` = id kunjungan).

## Checklist selesai
- [ ] Ringkasan: reservasi hari ini + tombol Sudah datang, ruangan ditutup
- [ ] Papan per paket: sedang foto, urutan menunggu, dilewati, reservasi belum datang
- [ ] Tombol mengikuti status (tabel di atas) + dialog alasan
- [ ] Form datang langsung dan reservasi (+ DP)
- [ ] Modal detail: ubah dan batalkan
- [ ] Owner hanya melihat (tanpa tab Pendaftaran dan tombol)
- [ ] Tombol simpan/aksi memakai `loading` (anti klik ganda)
- [ ] `npm run build` dan `npm run lint` lulus
- [ ] Semua langkah uji di bawah lulus

## Cara mengetes
1. Daftarkan pelanggan datang langsung → muncul di papan paketnya dengan nomor `RG-xxx`.
2. Catat reservasi + DP Transfer tanpa referensi → ditolak; dengan referensi → tersimpan.
3. "Sudah datang" sebelum jam janji → ditolak; setelah jam janji → masuk antrean dengan prioritas.
4. Panggil → Mulai foto saat belum lunas → pesan + tombol ke Kasir.
5. Lewati tanpa alasan → ditolak. Kembalikan → masuk paling belakang.
6. Buka Antrean di 2 browser, lakukan tindakan di satu browser → browser lain mendapat pesan data berubah.
7. Login Owner → hanya melihat, tanpa tab Pendaftaran dan tombol.
8. Tekan Simpan dua kali dengan cepat → hanya 1 kunjungan tercatat.

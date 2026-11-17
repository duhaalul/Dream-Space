# ERD Dream Space Revisi 05

Disusun 11 November 2026 berdasarkan SRS_Dream_Space..docx, nomor SRS-DS-001 tanggal 10 November 2026. SRS §6 menyerahkan kolom dan tipe kepada Backend. Model ini memiliki 12 tabel bisnis yang disebut SRS dan dua tabel teknis, sessions serta queue_counters. Jumlah keseluruhan 14 tabel.

## Klarifikasi terbaru 11 November 2026

Tagihan yang sudah tercatat wajib lunas sebelum foto dimulai. Tambahan selama sesi (misalnya tambah waktu/cetak) boleh dibayar di akhir, dan seluruh tagihan wajib lunas sebelum SELESAI. Aturan ini mengikuti instruksi terbaru pengguna dan menggantikan ketentuan mulai sebelum lunas dalam SRS lama. Backend menyimpan audit START_PAYMENT_CHECK berisi total dan pembayaran bersih ketika mulai.

Implementasi menambahkan request_hash pada visits, payments, dan refunds untuk membandingkan payload retry. Tidak ada tabel bisnis baru. schema_migrations merupakan tabel pencatat migrasi di luar diagram utama.

## Perubahan setelah Revisi 05 (sampai 17 November 2026)

Klien meminta banyak perubahan sehingga SRS bukan lagi satu-satunya acuan; kondisi terkini ada di kode, `API.md`, dan README modul. Tetap 14 tabel + `schema_migrations`.

| Migrasi | Perubahan |
| --- | --- |
| 002_paid_off_at | `transactions.paid_off_at`: waktu transaksi **pertama kali** lunas (jam "Lunas" di nota/Riwayat). Tidak dikosongkan bila total naik lagi. |
| 003_session_duration | `packages.duration_minutes` (durasi sesi), `addons.extra_minutes` (menit tambahan timer), `visits.session_minutes` (diisi saat Mulai Foto). |
| 004_reservation | `visits.phone` (No. WhatsApp reservasi); `queue_counters.kind` (WALK_IN/RESERVASI) masuk PK; indeks unik nomor menjadi `visits_queue_number (package_id, service_date, customer_type, queue_number)` sehingga datang langsung `RG-001` dan reservasi `RG-R001` punya urutan sendiri. |

**Kolom sisa (dibiarkan, tidak dipakai):**
- `visits.has_priority`: fitur prioritas/konfirmasi reservasi sudah dihapus, selalu FALSE;
- `transactions.subtotal`: selalu sama dengan total, karena tidak ada diskon;
- `transactions.refund_status`: tetap dihitung tapi tidak ditampilkan.

**Aturan yang berubah:**
- urutan Menunggu = jam masuk (`COALESCE(queue_entered_at, appointment_at)`), tanpa prioritas;
- panggil di luar urutan tanpa alasan; "Kembali ke Antrean" (UNCALL) mengembalikan pelanggan yang dipanggil ke urutan semula;
- reservasi wajib paket dan jamnya tidak boleh bentrok per paket;
- tutup otomatis kunjungan hari sebelumnya;
- laporan menjadi buku kas.

Tabel `sessions` tidak dibersihkan otomatis karena barisnya dirujuk `audit_logs.session_id`.

## Perubahan dasar dari Revisi 03

| Sumber keputusan | Perubahan model |
| --- | --- |
| SRS §1.2 mengeluarkan promo dan voucher | Hapus promos, transactions.promo_id dan discount. Tagihan aktif sama dengan subtotal rincian aktif. |
| SRS §2.2 menetapkan dua akun tetap | users.role unik dengan nilai ADMIN atau OWNER. Seed dua akun sekali. Profil dan reset sandi Admin tetap tersedia. |
| SRS §2.4 menetapkan Tunai, Transfer, QRIS | payments.method dan refunds.method memakai enum tetap. Tabel payment_methods dihapus. |
| SRS §6 menyerahkan rancangan teknis ke Backend | sessions dan queue_counters dipertahankan untuk NFR-08 dan NFR-02. Kolom versi, idempotensi dan snapshot ditetapkan dalam dokumen ini. |
| SRS §4.3 aturan 17 menjaga harga transaksi lama | Transaksi menyimpan rumus dan tarif paket saat dipilih. Rincian menyimpan harga dan satuan. Koreksi/perubahan eksplisit tetap diaudit. |
| SRS §4.3 aturan 11 mengatur akhir hari | Penanganan sisa antrean dilakukan Admin. Sesi yang sudah berjalan tunduk pada larangan pembatalan setelah mulai foto, lihat konflik yang dicatat di bawah. |

## Keputusan teknis backend

- PK bertipe INT/BIGINT untuk ID, UUID sesi berupa CHAR(36), tanggal DATE dan waktu DATETIME(3) dengan konvensi WIB. Nominal memakai BIGINT Rupiah utuh. Implementasi Node menjaga nilai uang sebagai integer aman atau string desimal di batas JSON, dengan validasi rentang sebelum konversi.
- users mempunyai username unik dan role ENUM(ADMIN, OWNER) unik. Seed dua akun melalui skrip dengan kata sandi dari lingkungan lokal dan bcrypt. Role tetap. Audit mengidentifikasi akun bersama dan sesi, sehingga identitas karyawan individual tidak dapat dibuktikan dari log tersebut.
- sessions mencatat last_activity_at dan revoked_at. Logout, ganti sandi dan reset mencabut sesi yang terkait. JWT memuat ID sesi dan setiap request memeriksa sesi belum dicabut serta idle kurang dari 30 menit. Reset sandi Admin menetapkan must_change_password dan mengharuskan perubahan sebelum memakai fitur usaha.
- visits dan transactions dibuat bersama dalam transaksi DB. transactions.visit_id adalah FK wajib unik. Reservasi tanpa paket dapat memiliki transaksi dengan nol rincian, package_id/background_id/persons kosong. Sebelum masuk antrean, paket dan jumlah orang valid, latar wajib jika paket memiliki pilihan latar aktif.
- Paket/kunjungan berpindah hanya sebelum DIPANGGIL. Jika ganti paket saat MENUNGGU, simpan paket, nomor, tanggal dan kode lama dalam event, terbitkan nomor tujuan, dan pertahankan waktu masuk antrean serta ID transaksi. Snapshot kode menjaga nomor historis saat Owner mengubah kode paket. Counter monoton tidak diturunkan atau dipakai ulang.
- UNIQUE(package_id, service_date, customer_type, queue_number) di visits dan PK(package_id, service_date, kind) di queue_counters (sejak migrasi 004; semula tanpa customer_type/kind). Kunci baris counter saat menerbitkan nomor. Kunci baris paket saat mengalokasikan DIPANGGIL/SEDANG_DILAYANI. Semua endpoint yang mengubah alokasi memakai urutan penguncian konsisten. Jika melibatkan dua paket, kunci berdasarkan urutan ID.
- *(Diganti 17 Nov 2026)* Prioritas dan konfirmasi reservasi sudah dihapus. Urutan Menunggu = jam masuk (`queue_entered_at`; reservasi = jam reservasinya saat Sudah Datang), lalu ID. Admin boleh panggil di luar urutan **tanpa** alasan. "Kembali ke Antrean" (UNCALL) mengembalikan pelanggan yang dipanggil ke urutan semula. Lewati/DILEWATI hanya tersisa untuk data lama (kembali dari DILEWATI masuk paling belakang).
- package_addons menggunakan PK gabungan. Latar harus milik paket, ditegakkan melalui FK gabungan (background_id, package_id) ke pasangan unik (id, package_id) atau validasi atomik. Master yang direferensikan dinonaktifkan, penghapusan fisik dibatasi RESTRICT.
- Tarif yang sama pada transaksi lama memakai price_type_snapshot, price_snapshot, included_persons_snapshot dan extra_person_price_snapshot. Perubahan jumlah orang pada paket yang sama memakai tarif snapshot. Pergantian paket secara eksplisit menangkap tarif paket tujuan saat itu dan mengaudit nilai lama/baru. Tambahan baru menangkap harga master pada saat ditambahkan. Tambahan yang sudah ada mempertahankan unit_price saat qty berubah. Penggantian harga secara sengaja melalui koreksi harus terlacak.
- transaction_items menyimpan description, unit_snapshot, qty, unit_price dan amount = qty × unit_price. Rincian lama yang diganti dinonaktifkan, bukan dihapus. PAKET dan TAMBAH_ORANG tidak mengisi addon_id. TAMBAHAN wajib memakai addon yang diizinkan untuk paket tersebut. Latar disalin ke background_snapshot untuk cetak ulang nota.
- Total transaksi aktif = jumlah amount rincian aktif. Pembayaran bersih = SUM(payments.amount) − SUM(refunds.amount). Sisa = max(total − pembayaran bersih, 0), kelebihan = max(pembayaran bersih − total, 0). Tunai dipisahkan antara nominal diterapkan, uang diserahkan dan kembalian. Transfer/QRIS tidak boleh melebihi sisa saat tagihan sudah diketahui.
- Keputusan teknis untuk DP tanpa paket adalah menerima nominal positif yang sudah diverifikasi sebagai uang muka belum dialokasikan. Total sementara nol dan status BELUM_LUNAS jika saldo positif. Nilai itu belum diperlakukan sebagai kelebihan bayar sebelum paket dipilih. Setelah paket dipilih, saldo dihitung terhadap tagihan sebenarnya. Referensi unik diwajibkan pada DP nontunai. paid_at mempertahankan tanggal uang masuk, created_at waktu input.
- Mulai foto memerlukan pelunasan seluruh tagihan yang sudah tercatat. Tambahan yang terjadi setelah sesi mulai boleh menjadi sisa tagihan sementara dan dibayar pada akhir sesi. Konfirmasi akhir harus memuat jumlah orang dan seluruh tambahan terakhir. Selesai hanya ketika pembayaran bersih sama dengan total, termasuk tagihan nol. Saldo berlebih diselesaikan dulu melalui refund langsung Admin. Kunci transaksi saat seluruh pemeriksaan uang agar dua komputer tidak memakai saldo yang sama.
- Pembatalan sebelum foto menyimpan alasan serta cancelled_at, menetapkan total sebesar pembayaran bersih yang ditahan, dan mempertahankan rincian historis. Kasus tanpa pembayaran memiliki TIDAK_ADA_TAGIHAN. Pembatalan tidak membuat refund. Koreksi tidak membuka kembali status terminal atau membuat penerimaan kas fiktif.
- client_request_id unik pada visits/payments/refunds mencegah duplikasi pembuatan. Retry membandingkan payload bisnis terhadap data pertama, lalu mengembalikan hasil yang sama. Kunci sama dengan payload berbeda menghasilkan konflik. Status dan version diperiksa atomik saat panggil/mulai/selesai. Simpan audit bersama mutasi sehingga kegagalan membatalkan keduanya.
- audit_logs hanya append. entity memakai allowlist, entity_id string mendukung ID numerik maupun UUID. session_id optional untuk membedakan sesi komputer pada akun bersama. old_values/new_values punya schema per aksi, tidak menyimpan kata sandi/hash/token. Simpan alasan untuk pengecualian antrean, perubahan layanan, refund, penutupan ruang dan koreksi transaksi lunas.

## Enum dan nullable

| Kolom | Nilai atau kondisi |
| --- | --- |
| users.role | ADMIN, OWNER |
| packages.price_type dan snapshot | PER_SESI, PER_ORANG, PER_KELOMPOK |
| visits.customer_type | WALK_IN, RESERVASI |
| visits.status | RESERVASI, MENUNGGU, DIPANGGIL, SEDANG_DILAYANI, DILEWATI, SELESAI, DIBATALKAN |
| transactions.payment_status | BELUM_DIBAYAR, BELUM_LUNAS, LUNAS, KELEBIHAN_BAYAR, TIDAK_ADA_TAGIHAN |
| transactions.refund_status | BELUM_ADA, SEBAGIAN, PENUH |
| transaction_items.item_type | PAKET, TAMBAH_ORANG, TAMBAHAN |
| payments.payment_type | DP, PEMBAYARAN |
| payments.method dan refunds.method | TUNAI, TRANSFER, QRIS |

Kolom bertanda opsional dapat NULL. appointment_at wajib untuk RESERVASI. Tarif/orang tercakup snapshot boleh kosong sebelum pemilihan paket, kemudian mengikuti cara hitung. Batas jumlah orang NULL berarti tanpa batas yang ditetapkan Owner. from_status pada event pendaftaran boleh NULL. Master dan akun historis tetap disimpan. Setiap keputusan ini merupakan penurunan teknis SRS, bukan kutipan kamus data karena SRS terbaru tidak lagi memuat kamus kolom.

## Cakupan laporan dan batas yang masih terbuka

*(Diperbarui 17 Nov 2026)* Laporan = **buku kas**:
- **L-01 Penjualan:** satu baris per pembayaran pada `payments.paid_at` (DP/Lunas) dan per refund pada `refunds.refunded_at` (baris minus); total = uang bersih.
- **L-02 Penjualan per Paket:** L-01 dikelompokkan per paket kunjungan.
- L-03 dan L-04 dihapus (diganti menu Riwayat).
- **Nota** hanya untuk sesi SELESAI atau transaksi lunas penuh (`paid_off_at` terisi dan uang bersih ≥ rincian aktif).
- **Akses:** Owner bebas memilih periode; Admin hanya laporan hari ini. Dashboard khusus Owner. Periode mengikuti WIB.

Aturan 11 dan 18: sejak 16 Nov 2026 backend **menutup otomatis** kunjungan hari sebelumnya. Menunggu/Dipanggil/Dilewati dibatalkan (uang ditahan), Sedang foto yang lunas diselesaikan. Jadi aturan 18 tetap terjaga: sesi berjalan tidak pernah dibatalkan. Reservasi yang belum datang tidak disentuh.

SRS tetap berasumsi satu paket mempunyai ruang sendiri. Dua paket berbagi ruang belum dapat diamankan dengan penguncian per paket. Sebelum produksi, pastikan asumsi tersebut atau tambahkan model sumber daya ruang bersama. Akun Admin bersama juga membatasi akuntabilitas sampai akun/sesi, sesuai keputusan pengguna SRS §2.2.

## Urutan mulai pekerjaan backend

1. Siapkan repositori dan Express dengan konfigurasi lingkungan, pemeriksaan kesehatan proses dan basis data, serta .gitignore.
2. Turunkan ERD ke migrasi MySQL. Uji FK, nomor unik, transaksi satu per kunjungan, lalu seed dua akun dengan kata sandi lokal.
3. Implementasikan login, pencabutan sesi, ganti sandi, reset Admin oleh Owner dan pemeriksaan role.
4. Implementasikan paket, latar dan tambahan beserta rumus harga. Uji snapshot tarif sebelum menghubungkan ke kasir.
5. Implementasikan reservasi/walk-in dan antrean per paket. Uji dua pendaftaran dan dua pemanggilan bersamaan.
6. Implementasikan DP, pembayaran, tambahan akhir, refund, pembatalan, koreksi dan nota. Uji retry dan saldo bersamaan.
7. Tambahkan dashboard/laporan/ekspor dari data sumber yang sama, lalu pengujian bersama frontend.

## Akun dan audit

```mermaid
erDiagram
    direction LR
    users ||..o{ sessions : "user_id"
    users ||..o{ audit_logs : "user_id"
    sessions |o..o{ audit_logs : "session_id"
    users {
        int id PK
        string name
        string username UK
        string password_hash
        enum role UK
        boolean must_change_password
        datetime created_at
        datetime updated_at
    }
    sessions {
        string id PK
        int user_id FK
        datetime last_activity_at
        datetime revoked_at "opsional"
        datetime created_at
    }
    audit_logs {
        bigint id PK
        string entity
        string entity_id
        string action
        json old_values "opsional"
        json new_values "opsional"
        string reason "opsional"
        int user_id FK
        string session_id FK "opsional untuk tindakan sistem"
        datetime created_at
    }
```

## Paket dan layanan

```mermaid
erDiagram
    direction LR
    users ||..o{ packages : "updated_by"
    packages ||..o{ package_backgrounds : "package_id"
    packages ||..o{ package_addons : "package_id"
    addons ||..o{ package_addons : "addon_id"
    users {
        int id PK
        string name
        string username UK
        string password_hash
        enum role UK
        boolean must_change_password
        datetime created_at
        datetime updated_at
    }
    packages {
        int id PK
        string name UK
        string queue_code UK
        enum price_type
        bigint price
        int included_persons "opsional"
        bigint extra_person_price "opsional"
        int min_persons "opsional"
        int max_persons "opsional"
        int duration_minutes "opsional, menit sesi (migrasi 003)"
        text description "opsional"
        boolean is_open
        string closed_reason "opsional"
        boolean is_active
        int updated_by FK
        datetime updated_at
    }
    package_backgrounds {
        int id PK
        int package_id FK
        string name
        int max_persons "opsional"
        boolean is_active
    }
    addons {
        int id PK
        string name
        bigint price
        string unit
        int extra_minutes "opsional, menit tambahan timer (migrasi 003)"
        boolean is_active
    }
    package_addons {
        int package_id PK, FK
        int addon_id PK, FK
    }
```

## Kunjungan dan antrean

```mermaid
erDiagram
    direction LR
    users ||..o{ packages : "updated_by"
    packages ||..o{ package_backgrounds : "package_id"
    packages |o..o{ visits : "package_id"
    package_backgrounds |o..o{ visits : "background_id"
    users ||..o{ visits : "created_by"
    packages ||..o{ queue_counters : "package_id"
    visits ||..|{ visit_events : "visit_id"
    users ||..o{ visit_events : "created_by"
    visits ||..|| transactions : "visit_id"
    users ||..o{ transactions : "created_by"
    users {
        int id PK
        string name
        string username UK
        string password_hash
        enum role UK
        boolean must_change_password
        datetime created_at
        datetime updated_at
    }
    packages {
        int id PK
        string name UK
        string queue_code UK
        enum price_type
        bigint price
        int included_persons "opsional"
        bigint extra_person_price "opsional"
        int min_persons "opsional"
        int max_persons "opsional"
        int duration_minutes "opsional, menit sesi (migrasi 003)"
        text description "opsional"
        boolean is_open
        string closed_reason "opsional"
        boolean is_active
        int updated_by FK
        datetime updated_at
    }
    package_backgrounds {
        int id PK
        int package_id FK
        string name
        int max_persons "opsional"
        boolean is_active
    }
    visits {
        bigint id PK
        string customer_name
        string phone "opsional, No. WhatsApp (migrasi 004)"
        enum customer_type
        datetime appointment_at "opsional"
        date service_date
        int package_id FK "opsional"
        int background_id FK "opsional"
        int persons "opsional"
        int queue_number "opsional"
        datetime queue_entered_at "opsional"
        string queue_code_snapshot "opsional sebelum masuk antrean"
        boolean has_priority "sisa fitur prioritas, tidak dipakai"
        enum status
        datetime called_at "opsional"
        datetime started_at "opsional"
        int session_minutes "opsional, timer saat Mulai Foto (migrasi 003)"
        datetime finished_at "opsional"
        string cancel_reason "opsional"
        string note "opsional"
        string client_request_id UK
        string request_hash
        int created_by FK
        datetime created_at
        datetime updated_at
        int version
    }
    visit_events {
        bigint id PK
        bigint visit_id FK
        string event_type
        string from_status "opsional"
        string to_status
        int package_id "opsional"
        int queue_number "opsional"
        date service_date_snapshot
        string queue_code_snapshot "opsional"
        string reason "opsional"
        int created_by FK
        datetime created_at
    }
    queue_counters {
        int package_id PK, FK
        date service_date PK
        enum kind PK "WALK_IN atau RESERVASI (migrasi 004)"
        int last_number
    }
    transactions {
        bigint id PK
        string transaction_no UK
        bigint visit_id FK, UK
        enum price_type_snapshot "opsional sebelum paket dipilih"
        bigint price_snapshot "opsional sebelum paket dipilih"
        int included_persons_snapshot "opsional"
        bigint extra_person_price_snapshot "opsional"
        string background_snapshot "opsional"
        bigint subtotal "sisa, selalu sama dengan total"
        bigint total
        enum payment_status
        enum refund_status "sisa, tidak ditampilkan"
        datetime completed_at "opsional"
        datetime paid_off_at "opsional, pertama kali lunas (migrasi 002)"
        datetime cancelled_at "opsional"
        int created_by FK
        datetime created_at
        datetime updated_at
        int version
    }
```

## Transaksi dan uang

```mermaid
erDiagram
    direction LR
    users ||..o{ visits : "created_by"
    visits ||..|| transactions : "visit_id"
    users ||..o{ transactions : "created_by"
    transactions ||..o{ transaction_items : "transaction_id"
    addons |o..o{ transaction_items : "addon_id"
    users ||..o{ transaction_items : "created_by"
    transactions ||..o{ payments : "transaction_id"
    users ||..o{ payments : "created_by"
    transactions ||..o{ refunds : "transaction_id"
    users ||..o{ refunds : "created_by"
    users {
        int id PK
        string name
        string username UK
        string password_hash
        enum role UK
        boolean must_change_password
        datetime created_at
        datetime updated_at
    }
    visits {
        bigint id PK
        string customer_name
        string phone "opsional, No. WhatsApp (migrasi 004)"
        enum customer_type
        datetime appointment_at "opsional"
        date service_date
        int package_id FK "opsional"
        int background_id FK "opsional"
        int persons "opsional"
        int queue_number "opsional"
        datetime queue_entered_at "opsional"
        string queue_code_snapshot "opsional sebelum masuk antrean"
        boolean has_priority "sisa fitur prioritas, tidak dipakai"
        enum status
        datetime called_at "opsional"
        datetime started_at "opsional"
        int session_minutes "opsional, timer saat Mulai Foto (migrasi 003)"
        datetime finished_at "opsional"
        string cancel_reason "opsional"
        string note "opsional"
        string client_request_id UK
        string request_hash
        int created_by FK
        datetime created_at
        datetime updated_at
        int version
    }
    transactions {
        bigint id PK
        string transaction_no UK
        bigint visit_id FK, UK
        enum price_type_snapshot "opsional sebelum paket dipilih"
        bigint price_snapshot "opsional sebelum paket dipilih"
        int included_persons_snapshot "opsional"
        bigint extra_person_price_snapshot "opsional"
        string background_snapshot "opsional"
        bigint subtotal "sisa, selalu sama dengan total"
        bigint total
        enum payment_status
        enum refund_status "sisa, tidak ditampilkan"
        datetime completed_at "opsional"
        datetime paid_off_at "opsional, pertama kali lunas (migrasi 002)"
        datetime cancelled_at "opsional"
        int created_by FK
        datetime created_at
        datetime updated_at
        int version
    }
    transaction_items {
        bigint id PK
        bigint transaction_id FK
        enum item_type
        int addon_id FK "opsional"
        string description
        int qty
        string unit_snapshot
        bigint unit_price
        bigint amount
        boolean is_active
        string reason "opsional"
        int created_by FK
        datetime created_at
    }
    addons {
        int id PK
        string name
        bigint price
        string unit
        int extra_minutes "opsional, menit tambahan timer (migrasi 003)"
        boolean is_active
    }
    payments {
        bigint id PK
        bigint transaction_id FK
        enum payment_type
        enum method "TUNAI TRANSFER QRIS"
        bigint amount
        bigint cash_received "opsional"
        bigint change_amount "opsional"
        datetime paid_at
        string reference UK "opsional"
        string client_request_id UK
        string request_hash
        int created_by FK
        datetime created_at
    }
    refunds {
        bigint id PK
        bigint transaction_id FK
        bigint amount
        enum method "TUNAI TRANSFER QRIS"
        string reason
        datetime refunded_at
        string client_request_id UK
        string request_hash
        int created_by FK
        datetime created_at
    }
```

Sumber [SRS tanggal 10 November 2026](<C:/Alul/Sistem Informasi UA24/Semester 5/MPSI/SRS_Dream_Space..docx>).

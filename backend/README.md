# Backend Dream Space

API kasir dan antrean studio Dream Space Padang. Seluruh source, migrasi, test, konfigurasi contoh, dan dokumentasi backend berada dalam folder ini. Frontend dikelola terpisah oleh tim frontend.

Stack: Node.js 24, TypeScript strict, Express, MySQL 8.0.16+, mysql2, Zod, bcrypt/JWT, pdfmake, dan ExcelJS.

## Jalankan lokal

Dari root repository:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
```

Isi koneksi MySQL, `JWT_SECRET` acak minimal 32 karakter, dan password seed minimal 12 karakter. Buat database/user MySQL sesuai [panduan operasional](docs/OPERATIONS.md), lalu:

```powershell
npm run db:migrate
npm run db:seed
npm run dev
```

Jika `.env` dan database sudah disiapkan sebelumnya, jangan menimpa `.env`. Seed tidak mengganti password akun yang sudah ada. Username awal `admin` dan `owner`, password dari `SEED_ADMIN_PASSWORD`/`SEED_OWNER_PASSWORD` lokal. Login pertama wajib mengganti password.

Backend: `http://localhost:3000`; health check database: `http://localhost:3000/health/ready`.

## Hubungkan frontend

Konfigurasi backend:

```dotenv
FRONTEND_ORIGIN=http://localhost:5173
```

Tim frontend mengisi `VITE_API_URL=http://localhost:3000/api` pada environment frontend. Origin harus sama dengan URL yang dibuka di browser (termasuk port). Token Bearer, endpoint, payload, dan format error mengikuti [kontrak API](docs/API.md).

Kontrak modul API frontend di `main` dan branch Larisa diperiksa pada 15 November 2026. Kode frontend tidak diubah dalam penambahan folder backend ini. Status dan batas pengujian ada di [catatan integrasi](docs/FRONTEND_INTEGRATION.md).

## Aturan pembayaran

Tagihan yang sudah tercatat wajib lunas sebelum **START foto**. DP atau pembayaran sebagian belum cukup. Tambahan selama sesi boleh dibayar di akhir. **FINISH** hanya berhasil setelah seluruh tagihan seimbang, termasuk refund bila ada kelebihan bayar.

## Pengujian

```powershell
npm run typecheck
npm test
npm run build
# Siapkan .env.test dari .env.test.example dengan database KHUSUS pengujian.
npm run test:integration
```

Integration test mensyaratkan `NODE_ENV=test` dan nama database berakhiran `_test`. `TEST_RESET=1` menghapus tabel pada schema test tersebut sebelum pengujian. Jangan memakai schema usaha.

Suite: 2 unit test + 22 integration test. Salah satunya membangun modul API dari `../frontend/src` ke file sementara dalam `.local/`, kemudian menjalankannya melalui fetch HTTP ke backend dengan database test sungguhan. Tidak mengubah file frontend dan tidak memerlukan instalasi dependensi React. Jika frontend berada di lokasi lain, set `FRONTEND_DIR` ke lokasi folder frontend sebelum menjalankan test.

## Dokumentasi

- [Kontrak API](docs/API.md)
- [Setup, akun, backup, dan pemulihan](docs/OPERATIONS.md)
- [Integrasi frontend dan batas yang belum selesai](docs/FRONTEND_INTEGRATION.md)
- [Arsitektur](docs/ARCHITECTURE.md)
- [ERD Revisi 05](docs/ERD_Revisi_05.md) dan [Mermaid](docs/erd.mmd)
- [Aturan pelunasan sebelum foto](docs/PAYMENT_RULE_CHANGE.md)

Gunakan `npm start` setelah build. Edit `src/*.ts`, bukan `dist/*.js`: folder `dist` adalah hasil kompilasi dan akan ditimpa saat build. `.env`, `.local`, `node_modules`, backup, dan `dist` tidak diunggah ke Git.

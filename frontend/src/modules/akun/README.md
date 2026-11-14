# Modul Akun

Pegangan kerja modul **Akun dan Pengaturan** (SRS 5.1). Aturan umum (impor, tombol simpan, error) ada di [README frontend](../../../README.md).

## Tujuan
Login, logout, dan kata sandi untuk dua akun tetap: Admin dan Owner.
FR-01, FR-13 · UC-01, UC-02, UC-24.

## Penanggung jawab
- **Ihsan:** Login, `AuthContext.jsx`/`useAuth.js`, form kata sandi (sudah selesai).
- **Larisa:** tampilan halaman Profil (`pages/ProfilePage.jsx`) sesuai Figma, memakai form kata sandi yang sudah ada.

## Halaman & komponen
| File | Layar di Figma | Peran | Status |
|---|---|---|---|
| `pages/LoginPage.jsx` | Selamat Datang Kembali | publik | Selesai, sesuai Figma |
| `components/LoginBrandPanel.jsx` | Panel biru logo Dream Space (kanan Login, layar lebar saja) | publik | Selesai |
| `pages/ProfilePage.jsx` | Profil | Admin, Owner | Berfungsi, tampilan belum sesuai Figma |
| `components/ChangePasswordForm.jsx` | Profil › ubah kata sandi | Admin, Owner | Selesai |
| `components/ResetAdminPasswordForm.jsx` | Profil Owner › reset kata sandi Admin | Owner | Selesai |
| `AuthContext.jsx`, `useAuth.js` | — | semua | Selesai |
| `passwordRules.js` | — | — | Selesai |

## Hak akses
| Tindakan | Admin | Owner |
|---|---|---|
| Login, logout | ✓ | ✓ |
| Ganti kata sandi sendiri di Profil | ✓ | ✓ |
| Reset kata sandi Admin di Profil | — | ✓ |

## API (`api.js`)
| Fungsi | Endpoint | Dipakai untuk |
|---|---|---|
| `login(username, password)` | `POST /auth/login` | Login → `{ token, user }` |
| `logout()` | `POST /auth/logout` | Tombol Keluar |
| `getMe()` | `GET /auth/me` | Memuat ulang data akun (`refreshUser`) |
| `changePassword(lama, baru)` | `POST /auth/change-password` | Ganti kata sandi sendiri |
| `updateProfile(name)` | `PATCH /auth/profile` | Ubah nama tampilan (belum dipakai) |
| `resetAdminPassword(sementara)` | `POST /auth/reset-admin-password` | Owner mereset kata sandi Admin |

`user` = `{ id, name, username, role: 'ADMIN' | 'OWNER', must_change_password }`.

## Aturan wajib
- Kata sandi minimal 12 karakter, maksimal 72 byte (`passwordRules.js`, NFR-08).
- Setelah ganti kata sandi, backend mencabut **semua sesi**: pengguna dikeluarkan ke Login (sudah lewat `clearSession`).
- Setelah reset, Admin wajib mengganti kata sandi sementara. Selama `must_change_password`, halaman lain dialihkan ke Profil (`app/ProtectedRoute.jsx`).
- Token hanya di memori. Reload = login ulang. Jangan simpan token di localStorage, URL, atau log.
- Sesi berakhir setelah 30 menit tidak aktif; respons 401 otomatis kembali ke Login (`shared/api/client.js`).
- Login **tanpa** "Lupa Password" dan "Ingat Saya". Tampilkan **nama pengguna**, bukan email. Hapus tulisan "SHA-256" dari desain.

## Error yang ditangani khusus
Error lain cukup tampilkan `error.message` dengan `<Alert variant="error">`.

| Kode | Tindakan di tampilan |
|---|---|
| `INVALID_CREDENTIALS` | Pesan "Username atau kata sandi salah", tetap di Login |
| `LOGIN_RATE_LIMIT` | Terlalu banyak percobaan; minta coba lagi nanti |
| `INVALID_PASSWORD` | Kata sandi lama salah |
| `SAME_PASSWORD` | Kata sandi baru sama dengan yang lama |
| `PASSWORD_CHANGE_REQUIRED` (403) | Arahkan ke Profil |

## Hubungan dengan modul lain
- **Dipakai semua modul:** `useAuth()` untuk data pengguna dan `user.role`. `app/ProtectedRoute.jsx` dan `app/AppLayout.jsx` juga memakainya.
- Mengubah isi `AuthContext.jsx` atau `useAuth.js` **wajib dikoordinasikan** dengan semua anggota tim.

## Checklist selesai
- [x] Login, logout, ganti kata sandi, reset kata sandi Admin
- [x] Tampilan Login sesuai Figma (tanpa Lupa Password, Ingat Saya, dan tab Owner/Admin)
- [ ] Ganti `src/assets/logo-ds.png` dengan ekspor logo resmi dari Figma (sekarang hasil potongan gambar desain)
- [ ] Tampilan Profil Admin dan Owner sesuai Figma
- [ ] Ubah nama tampilan dengan `updateProfile` (opsional)
- [ ] Profil nyaman dibuka di HP (Owner)
- [ ] `npm run build` dan `npm run lint` lulus
- [ ] Semua langkah uji di bawah lulus

## Cara mengetes
1. Login `admin` → masuk Antrean. Login `owner` → masuk Dashboard.
2. Kata sandi salah → pesan error, tetap di Login.
3. Ganti kata sandi di Profil → keluar otomatis; login dengan kata sandi baru berhasil.
4. Owner mereset kata sandi Admin → login `admin` dengan kata sandi sementara → hanya bisa membuka Profil sampai kata sandinya diganti.
5. Diamkan 30 menit → aksi berikutnya kembali ke Login dengan pesan "Sesi berakhir".

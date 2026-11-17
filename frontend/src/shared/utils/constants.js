// Nilai enum mengikuti backend (docs/API.md); label untuk tampilan.

export const ROLES = {
  ADMIN: 'ADMIN',
  OWNER: 'OWNER',
}

export const ROLE_LABELS = {
  ADMIN: 'Admin',
  OWNER: 'Owner',
}

// Halaman awal setelah login.
export const HOME_BY_ROLE = {
  ADMIN: '/pendaftaran',
  OWNER: '/dashboard',
}

export const VISIT_STATUS_LABELS = {
  RESERVASI: 'Reservasi',
  MENUNGGU: 'Menunggu',
  DIPANGGIL: 'Dipanggil',
  SEDANG_DILAYANI: 'Sedang dilayani',
  DILEWATI: 'Dilewati',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
}

// Warna <Badge tone=...> untuk tiap status.
export const VISIT_STATUS_TONES = {
  RESERVASI: 'blue',
  MENUNGGU: 'gray',
  DIPANGGIL: 'amber',
  SEDANG_DILAYANI: 'indigo',
  DILEWATI: 'amber',
  SELESAI: 'green',
  DIBATALKAN: 'red',
}

// Reservasi masuk antrean lewat "Sudah Datang" (checkInReservation di kasir/api.js), bukan aksi ini.
export const VISIT_ACTIONS = {
  CALL: 'CALL', // Panggil
  START: 'START', // Mulai foto
  SKIP: 'SKIP', // Lewati
  RETURN: 'RETURN', // Kembalikan ke antrean
  CANCEL: 'CANCEL', // Batalkan
  FINISH: 'FINISH', // Selesai (sesi foto selesai; tagihan sudah lunas saat mendaftar)
}

export const CUSTOMER_TYPES = {
  WALK_IN: 'WALK_IN',
  RESERVASI: 'RESERVASI',
}

export const PAYMENT_METHOD_LABELS = {
  TUNAI: 'Tunai',
  TRANSFER: 'Transfer',
  QRIS: 'QRIS',
}

export const PAYMENT_TYPE_LABELS = {
  DP: 'DP',
  PEMBAYARAN: 'Pembayaran',
}

// transactions.payment_status → label + warna <Badge tone>.
export const PAYMENT_STATUS_LABELS = {
  BELUM_DIBAYAR: 'Belum Dibayar',
  BELUM_LUNAS: 'Belum Lunas',
  LUNAS: 'Lunas',
  KELEBIHAN_BAYAR: 'Kelebihan Bayar',
  TIDAK_ADA_TAGIHAN: 'Tanpa Tagihan',
}

export const PAYMENT_STATUS_TONES = {
  BELUM_DIBAYAR: 'red',
  BELUM_LUNAS: 'amber',
  LUNAS: 'green',
  KELEBIHAN_BAYAR: 'indigo',
  TIDAK_ADA_TAGIHAN: 'gray',
}

export const PRICE_TYPE_LABELS = {
  PER_SESI: 'Per sesi',
  PER_ORANG: 'Per orang',
  PER_KELOMPOK: 'Per kelompok',
}

export const REPORT_PERIODS = {
  today: 'Hari ini',
  week: 'Minggu ini',
  month: 'Bulan ini',
  custom: 'Rentang tanggal',
}

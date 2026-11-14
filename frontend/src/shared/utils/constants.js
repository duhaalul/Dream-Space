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
  ADMIN: '/antrean',
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

export const VISIT_ACTIONS = {
  CONFIRM: 'CONFIRM', // Sudah datang
  CALL: 'CALL', // Panggil
  START: 'START', // Mulai foto
  SKIP: 'SKIP', // Lewati
  RETURN: 'RETURN', // Kembalikan ke antrean
  CANCEL: 'CANCEL', // Batalkan
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

export const PRICE_TYPE_LABELS = {
  PER_SESI: 'Per sesi',
  PER_ORANG: 'Per orang',
  PER_KELOMPOK: 'Harga untuk sejumlah orang',
}

export const REPORT_PERIODS = {
  today: 'Hari ini',
  week: 'Minggu ini',
  month: 'Bulan ini',
  custom: 'Rentang tanggal',
}

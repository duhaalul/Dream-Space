// Menggabungkan route dari kelima modul. Menambah halaman cukup di
// routes.js milik modulnya; file ini tidak perlu diubah.
import { akunRoutes } from '@/modules/akun/routes'
import { antreanRoutes } from '@/modules/antrean/routes'
import { kasirRoutes } from '@/modules/kasir/routes'
import { laporanRoutes } from '@/modules/laporan/routes'
import { paketRoutes } from '@/modules/paket/routes'

export const appRoutes = [...akunRoutes, ...paketRoutes, ...antreanRoutes, ...kasirRoutes, ...laporanRoutes]

// Menu untuk satu peran → [{ label, to, icon }].
// route.menu.label boleh teks biasa atau objek per peran, mis. { ADMIN: 'Paket', OWNER: 'Kelola Paket' }.
// route.menu.to dipakai bila alamat menu berbeda dari path route (mis. '/kasir' untuk '/kasir/:id?').
// route.menu.icon = komponen ikon dari lucide-react.
export function menuFor(role) {
  return appRoutes
    .filter((route) => route.menu && route.roles?.includes(role))
    .sort((a, b) => a.menu.order - b.menu.order)
    .map((route) => ({
      label: typeof route.menu.label === 'string' ? route.menu.label : route.menu.label[role],
      to: route.menu.to ?? route.path,
      icon: route.menu.icon,
    }))
}

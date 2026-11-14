import { TodoCard } from '@/shared/components/ui'

// Formulir tambah/ubah paket (SRS 5.4), Owner saja.
export default function PackageForm() {
  return (
    <TodoCard
      title="Formulir paket"
      items={[
        'Informasi paket: nama, kode antrean (huruf kapital/angka, maks. 10), keterangan.',
        'Cara hitung harga: PER_SESI / PER_ORANG / PER_KELOMPOK (+ included_persons, extra_person_price).',
        'Kapasitas: min_persons dan max_persons (boleh kosong).',
        'Latar: createBackground() / updateBackground(), batas orang per latar.',
        'Tambahan layanan: centang lalu setPackageAddons().',
        'Pratinjau harga sebelum disimpan; simpan dengan createPackage() / updatePackage().',
      ]}
    />
  )
}

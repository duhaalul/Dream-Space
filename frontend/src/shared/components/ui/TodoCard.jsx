// SEMENTARA: penanda bagian yang belum dikerjakan.
// Hapus pemakaiannya saat halaman/komponen sudah dibuat.
export default function TodoCard({ title = 'Belum dikerjakan', items = [] }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5">
      <p className="text-sm font-semibold text-slate-700">TODO · {title}</p>
      {items.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

import logoDs from '@/assets/logo-ds.png'

// Panel biru di sisi kanan halaman Login (hanya di layar lebar).
export default function LoginBrandPanel() {
  return (
    <aside className="relative hidden w-1/2 items-center justify-center overflow-hidden bg-linear-to-b from-[#00a0e0] to-brand-600 px-10 text-center text-white lg:flex">
      {/* Lingkaran dekorasi */}
      <span aria-hidden="true" className="absolute -top-40 -left-28 h-[26rem] w-[26rem] rounded-full bg-white/10" />
      <span
        aria-hidden="true"
        className="absolute top-[42%] left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.07]"
      />
      <span aria-hidden="true" className="absolute -right-32 -bottom-40 h-[26rem] w-[26rem] rounded-full bg-white/10" />

      <div className="relative">
        <img src={logoDs} alt="" className="mx-auto w-40 xl:w-48" />
        <h2 className="mt-10 font-display text-5xl font-black font-soft xl:text-6xl">Dream Space</h2>
        <p className="mt-3 text-sm font-bold tracking-wide text-yellow-300">SELF PHOTO STUDIO PADANG</p>
        <p className="mt-6 text-lg font-semibold">“Abadikan Setiap Tawa, Cerita &amp; Momen Bahagia”</p>
        <p className="mt-2 text-sm text-white/85">Sistem Kasir, Antrean &amp; Operasional Terpadu Studio</p>
        <p className="mt-14 text-xs font-semibold">Jl. Belakang Olo No. 42 Padang</p>
      </div>
    </aside>
  )
}

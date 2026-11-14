import { useState } from 'react'
import { Check, KeyRound, ShieldCheck, UserCheck, UserCog } from 'lucide-react'
import { Alert, Badge, Button, Card, Input, PageHeader } from '@/shared/components/ui'
import { ROLE_LABELS, ROLES } from '@/shared/utils/constants'
import { updateProfile } from '../api'
import ChangePasswordForm from '../components/ChangePasswordForm'
import ResetAdminPasswordForm from '../components/ResetAdminPasswordForm'
import { useAuth } from '../useAuth'

// T-11 Profil — Admin dan Owner.
// Setiap akun mengganti kata sandinya sendiri di sini.
// Owner juga bisa mereset kata sandi Admin (UC-24), mis. saat Admin lupa kata sandi.
export default function ProfilePage() {
  const { user, clearSession, refreshUser } = useAuth()
  const isOwner = user.role === ROLES.OWNER

  const [displayName, setDisplayName] = useState(user.name ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState(null)
  const [profileSuccess, setProfileSuccess] = useState(false)

  async function handleUpdateProfile(event) {
    event.preventDefault()
    const trimmed = displayName.trim()
    if (!trimmed) {
      setProfileError({ message: 'Nama tampilan wajib diisi.' })
      return
    }

    setSavingProfile(true)
    setProfileError(null)
    setProfileSuccess(false)
    try {
      await updateProfile(trimmed)
      await refreshUser()
      setDisplayName(trimmed)
      setProfileSuccess(true)
    } catch (err) {
      setProfileError(err)
    } finally {
      setSavingProfile(false)
    }
  }

  const initial = (user.name || ROLE_LABELS[user.role] || 'U').trim().charAt(0).toUpperCase()

  return (
    <>
      <PageHeader
        title="Profil"
        code="T-11"
        description="Kelola identitas akun, nama tampilan, dan keamanan kata sandi."
      />

      {user.must_change_password && (
        <Alert variant="warning" className="mb-6">
          Akun ini sedang menggunakan kata sandi sementara hasil reset Owner. Silakan ganti kata
          sandi terlebih dahulu sebelum membuka menu operasional lainnya.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Kolom Kiri: Kartu Identitas Akun & Ubah Nama Tampilan */}
        <div className="space-y-6 lg:col-span-5">
          <Card>
            <div className="flex flex-col items-center text-center sm:flex-row sm:text-left">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-linear-to-br from-brand-500 via-cyan-500 to-emerald-500 text-3xl font-bold text-white shadow-md shadow-brand-500/20">
                {initial}
              </div>
              <div className="mt-4 min-w-0 sm:mt-0 sm:ml-5">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <h2 className="truncate text-xl font-bold text-slate-800">{user.name}</h2>
                  <Badge tone={isOwner ? 'brand' : 'green'}>{ROLE_LABELS[user.role]}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Nama pengguna: <b className="text-slate-700">{user.username}</b>
                </p>
                <div className="mt-2.5 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <Badge tone={user.must_change_password ? 'amber' : 'green'}>
                    {user.must_change_password ? 'Wajib Ganti Sandi' : 'Sesi Aktif'}
                  </Badge>
                </div>
              </div>
            </div>

            <dl className="mt-6 divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-slate-50/60 px-4 py-2 text-sm">
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-slate-500">Nama Pengguna</dt>
                <dd className="font-semibold text-slate-800">{user.username}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-slate-500">Peran Akun</dt>
                <dd className="font-semibold text-slate-800">{ROLE_LABELS[user.role]}</dd>
              </div>
              <div className="py-2.5">
                <dt className="text-slate-500">Cakupan Akses</dt>
                <dd className="mt-1 text-xs leading-relaxed text-slate-600">
                  {isOwner
                    ? 'Memantau Dashboard & laporan keuangan (PDF/Excel), melihat antrean & riwayat transaksi, mengelola paket, harga, latar & tambahan layanan, serta mereset kata sandi Admin.'
                    : 'Mencatat pendaftaran pelanggan datang langsung & reservasi WhatsApp, mengatur antrean & ruangan studio, memproses pembayaran kasir, koreksi transaksi, serta mencetak nota.'}
                </dd>
              </div>
            </dl>

            {!user.must_change_password && (
              <form onSubmit={handleUpdateProfile} className="mt-6 space-y-4 border-t border-slate-100 pt-5">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <UserCheck aria-hidden="true" className="h-4 w-4 text-brand-600" />
                  Ubah Nama Tampilan
                </div>

                {profileError && (
                  <Alert
                    variant="error"
                    requestId={profileError.status >= 500 ? profileError.requestId : null}
                  >
                    {profileError.message}
                  </Alert>
                )}
                {profileSuccess && (
                  <Alert variant="success">Nama tampilan profil berhasil diperbarui.</Alert>
                )}

                <Input
                  label="Nama Tampilan"
                  value={displayName}
                  onChange={(event) => {
                    setDisplayName(event.target.value)
                    setProfileSuccess(false)
                  }}
                  placeholder="Masukkan nama tampilan"
                  hint="Nama pengguna untuk login tetap dan tidak berubah."
                  maxLength={100}
                  required
                />

                <Button type="submit" variant="soft" size="sm" loading={savingProfile}>
                  <Check aria-hidden="true" className="h-4 w-4" />
                  Simpan Nama Tampilan
                </Button>
              </form>
            )}
          </Card>
        </div>

        {/* Kolom Kanan: Ganti Kata Sandi & Reset Kata Sandi Admin */}
        <div className="space-y-6 lg:col-span-7">
          <Card
            title="Ganti Kata Sandi Akun"
            description="Minimal 12 karakter. Setelah kata sandi diganti, seluruh sesi aktif akan dicabut dan Anda diminta login kembali."
            actions={
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <KeyRound aria-hidden="true" className="h-5 w-5" />
              </span>
            }
          >
            <ChangePasswordForm
              onChanged={() =>
                clearSession('Kata sandi berhasil diganti. Silakan login dengan kata sandi baru.')
              }
            />
          </Card>

          {isOwner && !user.must_change_password && (
            <Card
              title="Reset Kata Sandi Admin"
              description="Tetapkan kata sandi sementara apabila Admin lupa kata sandi. Seluruh sesi Admin akan langsung dicabut dan Admin wajib menggantinya saat login berikutnya."
              actions={
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <UserCog aria-hidden="true" className="h-5 w-5" />
                </span>
              }
            >
              <ResetAdminPasswordForm />
            </Card>
          )}

          <div className="flex items-start gap-3 rounded-2xl border border-brand-200/80 bg-brand-50/60 px-4 py-3.5 text-xs text-slate-600">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            <p>
              Demi keamanan operasional studio, sesi akun akan berakhir otomatis setelah 30 menit
              tidak ada aktivitas. Pastikan keluar dari akun saat meninggalkan perangkat kasir.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

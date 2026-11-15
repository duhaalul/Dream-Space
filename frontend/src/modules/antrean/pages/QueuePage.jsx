import { useSearchParams } from 'react-router'
import { Plus } from 'lucide-react'
import { useAuth } from '@/modules/akun/useAuth'
import { Button, PageHeader, SegmentedControl } from '@/shared/components/ui'
import { ROLES } from '@/shared/utils/constants'
import QueueBoard from '../components/QueueBoard'
import QueueOverview from '../components/QueueOverview'
import VisitForm from '../components/VisitForm'

// T-03 Antrean (+ T-04 form kunjungan) — Admin mencatat, Owner hanya melihat.
// Satu halaman dengan 3 tampilan; tab aktif disimpan di URL (?tab=...).
// Tampilan utama (bawaan) = papan Per Paket, sesuai desain 03_Antrean.
const TABS = [
  { value: 'ringkasan', label: 'Ringkasan', component: QueueOverview },
  { value: 'paket', label: 'Per Paket', component: QueueBoard },
  { value: 'pendaftaran', label: 'Pendaftaran', component: VisitForm, adminOnly: true },
]

export default function QueuePage() {
  const { user } = useAuth()
  const isAdmin = user.role === ROLES.ADMIN
  const tabs = TABS.filter((tab) => isAdmin || !tab.adminOnly)
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = tabs.find((tab) => tab.value === searchParams.get('tab')) ?? tabs.find((tab) => tab.value === 'paket')
  const ActiveView = activeTab.component

  return (
    <>
      <PageHeader
        title="Antrean"
        code="T-03"
        actions={
          <>
            {/* Tombol cepat ke form pendaftaran (desain: + Reservasi WhatsApp, + Datang Langsung). */}
            {isAdmin && activeTab.value !== 'pendaftaran' && (
              <>
                <Button variant="secondary" onClick={() => setSearchParams({ tab: 'pendaftaran', form: 'reservasi' })}>
                  <Plus aria-hidden="true" className="h-4 w-4" /> Reservasi WhatsApp
                </Button>
                <Button variant="success" onClick={() => setSearchParams({ tab: 'pendaftaran', form: 'walkin' })}>
                  <Plus aria-hidden="true" className="h-4 w-4" /> Datang Langsung (Walk-in)
                </Button>
              </>
            )}
            <SegmentedControl
              label="Tampilan antrean"
              tone="brand"
              options={tabs}
              value={activeTab.value}
              onChange={(value) => setSearchParams({ tab: value })}
            />
          </>
        }
      />

      <ActiveView />
    </>
  )
}

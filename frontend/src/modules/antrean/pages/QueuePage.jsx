import { useSearchParams } from 'react-router'
import { useAuth } from '@/modules/akun/useAuth'
import { PageHeader, SegmentedControl } from '@/shared/components/ui'
import { ROLES } from '@/shared/utils/constants'
import QueueBoard from '../components/QueueBoard'
import QueueOverview from '../components/QueueOverview'
import VisitForm from '../components/VisitForm'

// T-03 Antrean (+ T-04 form kunjungan) — Admin mencatat, Owner hanya melihat.
// Satu halaman dengan 3 tampilan; tab aktif disimpan di URL (?tab=...).
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
  const defaultTab = isAdmin ? 'ringkasan' : 'paket'
  const activeTab =
    tabs.find((tab) => tab.value === searchParams.get('tab')) ?? tabs.find((tab) => tab.value === defaultTab)
  const ActiveView = activeTab.component

  return (
    <>
      <PageHeader
        title="Antrean"
        code="T-03"
        actions={
          <SegmentedControl
            label="Tampilan antrean"
            tone="brand"
            options={tabs}
            value={activeTab.value}
            onChange={(value) => setSearchParams({ tab: value })}
          />
        }
      />

      <ActiveView />
    </>
  )
}

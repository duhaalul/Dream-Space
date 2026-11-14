import { useSearchParams } from 'react-router'
import { useAuth } from '@/modules/akun/useAuth'
import { PageHeader } from '@/shared/components/ui'
import { ROLES } from '@/shared/utils/constants'
import QueueBoard from '../components/QueueBoard'
import QueueOverview from '../components/QueueOverview'
import VisitForm from '../components/VisitForm'

// T-03 Antrean (+ T-04 form kunjungan) — Admin mencatat, Owner hanya melihat.
// Satu halaman dengan 3 tampilan; tab aktif disimpan di URL (?tab=...).
const TABS = [
  { key: 'ringkasan', label: 'Ringkasan', component: QueueOverview },
  { key: 'paket', label: 'Per Paket', component: QueueBoard },
  { key: 'pendaftaran', label: 'Pendaftaran', component: VisitForm, adminOnly: true },
]

export default function QueuePage() {
  const { user } = useAuth()
  const isAdmin = user.role === ROLES.ADMIN
  const tabs = TABS.filter((tab) => isAdmin || !tab.adminOnly)
  const [searchParams, setSearchParams] = useSearchParams()
  const defaultTab = isAdmin ? 'ringkasan' : 'paket'
  const activeTab = tabs.find((tab) => tab.key === searchParams.get('tab')) ?? tabs.find((tab) => tab.key === defaultTab)
  const ActiveView = activeTab.component

  return (
    <>
      <PageHeader
        title="Antrean"
        code="T-03"
        description="Antrean per paket, reservasi hari ini, dan pendaftaran pelanggan."
      />

      <div role="tablist" className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((tab) => {
          const selected = tab.key === activeTab.key
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setSearchParams({ tab: tab.key })}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm ${
                selected
                  ? 'border-indigo-600 font-medium text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <ActiveView />
    </>
  )
}

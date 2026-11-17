import { useCallback, useEffect, useState } from 'react'
import { getAddons, getPackages } from '@/modules/paket/api'

// Katalog untuk form pendaftaran/reservasi/Sudah Datang.
// → { catalog: { packages, backgrounds, allowedAddons, addons } | null, error, reload }
export function useCatalog() {
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState(null)

  const reload = useCallback(
    () =>
      Promise.all([getPackages(), getAddons()])
        .then(([packages, addons]) => {
          setError(null)
          setCatalog({
            packages: packages?.packages ?? [],
            backgrounds: packages?.backgrounds ?? [],
            allowedAddons: packages?.allowed_addons ?? [],
            addons: addons ?? [],
          })
        })
        .catch(setError),
    [],
  )

  useEffect(() => {
    reload()
  }, [reload])

  return { catalog, error, reload }
}

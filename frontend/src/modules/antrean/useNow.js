import { useEffect, useState } from 'react'

// Waktu sekarang (ms) yang diperbarui tiap intervalMs — untuk timer sesi.
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

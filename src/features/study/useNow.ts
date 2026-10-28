import { useEffect, useState } from 'react'

/** The current time, updated every `ms` while `ticking`. */
export function useNow(ticking: boolean, ms = 1000): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    setNow(Date.now())
    if (!ticking) return
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ticking, ms])
  return now
}

import { useId, useState, type ReactNode } from 'react'
import { ChevronIcon } from './icons.tsx'

const OPEN_KEY = 'atlas.howItWorksOpen'

function remembered() {
  try {
    return localStorage.getItem(OPEN_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * The science behind a panel, folded away under "How it works" so the
 * experiment comes first. Opening or closing one is remembered for the rest.
 */
export function HowItWorks({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(remembered)
  const id = useId()
  const toggle = () => {
    setOpen(!open)
    try {
      localStorage.setItem(OPEN_KEY, open ? '0' : '1')
    } catch {
      // Not remembered this time.
    }
  }
  return (
    <section className={`how-it-works${open ? ' open' : ''}`}>
      <button className="how-it-works-toggle" aria-expanded={open} aria-controls={id} onClick={toggle}>
        How it works <ChevronIcon className="how-it-works-chevron" size={14} />
      </button>
      <div className="how-it-works-drawer" id={id}>
        <div>{children}</div>
      </div>
    </section>
  )
}

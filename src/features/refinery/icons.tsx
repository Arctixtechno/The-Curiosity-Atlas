import type { ReactNode } from 'react'

// Line icons for the refinery's panels, drawn like the ones in components/icons.tsx.

function Icon({ size = 18, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

/** A distillation column with a flame under it. */
export const ColumnFlameIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <rect x="9" y="2.5" width="6" height="15" rx="3" />
    <path d="M9 7h6M9 10.5h6M9 14h6M15 6h3M15 12h3" />
    <path d="M12 21.5c-1.6 0-2.5-1-2.5-2.2 0-1.4 1.4-2 1.6-3.3.9.6 1.4 1.4 1.4 2.1.4-.3.6-.8.7-1.2.8.7 1.3 1.5 1.3 2.4 0 1.2-1 2.2-2.5 2.2z" />
  </Icon>
)

/** A refinery skyline: tanks, a column and a flare. */
export const RefineryIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M2.5 21h19" />
    <path d="M4 21v-5a2.5 1 0 0 1 5 0v5" />
    <rect x="11" y="6" width="3.5" height="15" rx="1.75" />
    <path d="M18 21V5" />
    <path d="M18 3.2c.9.8.9 1.6 0 2.3-.9-.7-.9-1.5 0-2.3z" />
  </Icon>
)

/** A cat cracker: the regenerator, the riser and the reactor on top. */
export const CatCrackerIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <rect x="3" y="11" width="8" height="9" rx="3" />
    <rect x="12.5" y="2.5" width="7" height="5" rx="2" />
    <path d="M16 7.5V20M11 17.5h5M14 7.5v3H7V11" />
    <path d="M7 11V8.5M7 6.5v-1" />
  </Icon>
)

/** A reformer: three reactors in a row, getting bigger. */
export const ReformerIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M2.5 21h19" />
    <rect x="3" y="13" width="4" height="8" rx="2" />
    <rect x="9.5" y="10" width="4.5" height="11" rx="2.25" />
    <rect x="16.5" y="6" width="5" height="15" rx="2.5" />
    <path d="M5 13V9h6.75v1M11.75 9V5h7.25v1" />
  </Icon>
)

/** Sulphur: a crystal over a drop. */
export const SulphurIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M12 2.5l5 4v6l-5 4-5-4v-6z" />
    <path d="M7 6.5l5 4 5-4M12 10.5v6" />
    <path d="M12 18.5c-1.2 1.4-1.8 2.2-1.8 2.9a1.8 1.8 0 0 0 3.6 0c0-.7-.6-1.5-1.8-2.9z" />
  </Icon>
)

/** A gas plant: a column with a bullet tank beside it. */
export const GasPlantIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M2.5 21h19" />
    <rect x="4" y="3" width="4.5" height="18" rx="2.25" />
    <path d="M4 8h4.5M4 12.5h4.5M4 17h4.5" />
    <rect x="11" y="14" width="10.5" height="4.5" rx="2.25" />
    <path d="M13 18.5V21M19.5 18.5V21M8.5 5h4v9" />
  </Icon>
)

/** Blending: three streams meeting in one tank. */
export const BlendIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M3 3v5l6 4M12 3v9M21 3v5l-6 4" />
    <path d="M6 12h12v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20z" />
    <path d="M6 16.5h12" />
  </Icon>
)

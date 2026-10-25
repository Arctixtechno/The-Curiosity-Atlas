import { openOverlay } from '../world/overlay.ts'

// Full-screen panels for the central features, shown through the world's
// shared overlay system (src/components/Overlays.tsx).

export type PanelId = 'fountain' | 'library' | 'lounge'

export const openPanel = (id: PanelId) => openOverlay(id)

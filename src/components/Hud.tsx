import './Hud.css'

interface HudProps {
  isExploring: boolean
}

// Conventional HTML overlay drawn on top of the 3D canvas.
export function Hud({ isExploring }: HudProps) {
  if (isExploring) {
    return <div className="crosshair" aria-hidden="true" />
  }

  return (
    <div className="intro">
      <div className="intro-panel">
        <h1>The Curiosity Atlas</h1>
        <p className="tagline">A small world built for endless curiosity.</p>
        <p className="start">Click anywhere to explore</p>
        <ul className="controls">
          <li>
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> Move
          </li>
          <li>
            <kbd>Mouse</kbd> Look around
          </li>
          <li>
            <kbd>Shift</kbd> Walk faster
          </li>
          <li>
            <kbd>Esc</kbd> Release cursor
          </li>
        </ul>
      </div>
    </div>
  )
}

import { Component, type ReactNode } from 'react'
import './GraphicsProblem.css'

/** A message over the page when the 3D view can't carry on, with a way to start again. */
export function GraphicsProblem({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="graphics-problem" role="alertdialog" aria-label={title}>
      <div className="graphics-problem-box">
        <h2>{title}</h2>
        <p>{detail}</p>
        <button className="button" onClick={() => window.location.reload()} autoFocus>
          Reload the page
        </button>
      </div>
    </div>
  )
}

/** Shows a message instead of a blank page if the 3D view fails to start, usually because WebGL is unavailable. */
export class GraphicsErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed)
      return (
        <GraphicsProblem
          title="The 3D view couldn't start"
          detail="Your browser may have WebGL turned off, or the graphics driver may be busy. Try reloading, or turning on hardware acceleration in your browser's settings."
        />
      )
    return this.props.children
  }
}

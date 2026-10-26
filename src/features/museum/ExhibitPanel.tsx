import { Bounds, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Panel } from '../../components/Panel.tsx'
import { ColumnIcon } from '../../components/icons.tsx'
import { prefersReducedMotion } from '../../world/settings.ts'
import { EXHIBITS } from './exhibits.ts'
import { MODELS } from './models.tsx'
import type { ExhibitId } from './overlayId.ts'
import './ExhibitPanel.css'

/** An exhibit up close: a model to turn over with the mouse, and its label in full. */
export function ExhibitPanel({ id }: { id: ExhibitId }) {
  const exhibit = EXHIBITS[id]
  const Model = MODELS[id]
  return (
    <Panel title={exhibit.name} subtitle="From the museum's collection" icon={<ColumnIcon />} wide>
      <div className="exhibit-layout">
        <div className="exhibit-view">
          <Canvas camera={{ fov: 30, position: [0, 0.1, 1] }} dpr={[1, 1.5]} gl={{ antialias: true }}>
            <color attach="background" args={['#1a1412']} />
            <hemisphereLight args={['#fff6ea', '#5a4a40', 1.5]} />
            <directionalLight position={[0, 1, 3]} intensity={1.2} />
            <directionalLight position={[2, 3, 2]} intensity={2} />
            <directionalLight position={[-2, 1, -1]} intensity={0.6} color="#c8d8ff" />
            <Bounds fit clip observe margin={1.25}>
              <Model />
            </Bounds>
            <OrbitControls makeDefault autoRotate={!prefersReducedMotion} autoRotateSpeed={0.8} enablePan={false} />
          </Canvas>
          <p className="muted exhibit-hint">Drag to turn it over, scroll to zoom.</p>
        </div>
        <div>
          <p className="exhibit-date">
            {exhibit.date} · {exhibit.gallery}
          </p>
          <p>{exhibit.intro}</p>
          <dl className="exhibit-facts">
            {exhibit.facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <h3>Look closer</h3>
      <ul>
        {exhibit.notice.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      {exhibit.seeIt && (
        <p>
          <strong>See the real thing:</strong> {exhibit.seeIt}
        </p>
      )}
      <p className="muted">
        {exhibit.modelNote} Facts from{' '}
        <a href={exhibit.source} target="_blank" rel="noreferrer">
          Wikipedia
        </a>
        .
      </p>
    </Panel>
  )
}

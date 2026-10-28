import { useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { CardsIcon, LampIcon, ListIcon, NoteIcon, TimerIcon } from '../../components/icons.tsx'
import { CardsTab } from './CardsTab.tsx'
import { NotesTab } from './NotesTab.tsx'
import type { StudyTab } from './overlayId.ts'
import { TimerTab } from './TimerTab.tsx'
import { TodoTab } from './TodoTab.tsx'
import './StudyPanel.css'

const TABS: { id: StudyTab; name: string; subtitle: string; icon: typeof TimerIcon }[] = [
  { id: 'timer', name: 'Focus timer', subtitle: 'Work in focused blocks with breaks between', icon: TimerIcon },
  { id: 'todo', name: 'To-do', subtitle: 'What needs doing, and when it is due', icon: ListIcon },
  { id: 'notes', name: 'Notes', subtitle: 'Write it down while it is fresh', icon: NoteIcon },
  { id: 'cards', name: 'Flashcards', subtitle: 'Test yourself, and see each card again just before you forget it', icon: CardsIcon },
]

/**
 * The study room's tools, one tab each: a focus timer, a to-do list, notes
 * and flashcards. Everything is kept in this browser.
 */
export function StudyPanel({ tab: initial }: { tab: StudyTab }) {
  const [tab, setTab] = useState(initial)
  const current = TABS.find((t) => t.id === tab)!
  return (
    <Panel title="Study room" subtitle={current.subtitle} icon={<LampIcon />} wide>
      <nav className="study-tabs" role="tablist" aria-label="Study tools">
        {TABS.map(({ id, name, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={`study-tab${tab === id ? ' study-tab-active' : ''}`}
            onClick={() => setTab(id)}
          >
            <Icon size={16} />
            {name}
          </button>
        ))}
      </nav>
      <div role="tabpanel" aria-label={current.name}>
        {tab === 'timer' && <TimerTab />}
        {tab === 'todo' && <TodoTab onFocus={() => setTab('timer')} />}
        {tab === 'notes' && <NotesTab />}
        {tab === 'cards' && <CardsTab />}
      </div>
    </Panel>
  )
}

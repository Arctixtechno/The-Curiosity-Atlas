import { useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { BookIcon } from '../../components/icons.tsx'
import { library, searchLibrary, useLibrary, type LibraryItem } from '../../services/library.ts'
import { openPanel } from '../panels.ts'
import '../FeaturePanels.css'

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

/** Conventional searchable view of the Library of Discoveries (spec section 5.4). */
export function LibraryPanel() {
  const items = useLibrary()
  const [query, setQuery] = useState('')
  const [topic, setTopic] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const topics = [...new Set(items.map((i) => i.topic))].sort()
  const results = searchLibrary(items, query, topic || undefined)

  if (items.length === 0) {
    return (
      <Panel title="Library of Discoveries" subtitle="Everything you've saved on your travels" icon={<BookIcon />}>
        <div className="feature-panel">
          <h2>Your library is empty</h2>
          <p>Discoveries you save at the fountain in the Main Hall will be kept here to revisit.</p>
          <div className="panel-footer">
            <button className="primary" onClick={() => openPanel('fountain')}>
              Go to the Discovery Fountain
            </button>
          </div>
        </div>
      </Panel>
    )
  }

  return (
    <Panel title="Library of Discoveries" subtitle="Everything you've saved on your travels" icon={<BookIcon />}>
      <div className="feature-panel">
        <h2>
          {items.length} saved {items.length === 1 ? 'discovery' : 'discoveries'}
        </h2>
        <div className="library-filters">
          <input
            type="search"
            placeholder="Search your library"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search your library"
            autoFocus
          />
          <select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Filter by subject">
            <option value="">All subjects</option>
            {topics.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        {results.length === 0 ? (
          <p className="muted">Nothing matches that search.</p>
        ) : (
          <ul className="library-list">
            {results.map((item) => (
              <LibraryEntry
                key={item.id}
                item={item}
                open={openId === item.id}
                onToggle={() => setOpenId(openId === item.id ? null : item.id)}
              />
            ))}
          </ul>
        )}

        <div className="panel-footer">
          <button className="link" onClick={() => openPanel('fountain')}>
            Visit the Discovery Fountain
          </button>
        </div>
      </div>
    </Panel>
  )
}

function LibraryEntry({ item, open, onToggle }: { item: LibraryItem; open: boolean; onToggle: () => void }) {
  return (
    <li className={open ? 'open' : undefined}>
      <button className="entry-header" onClick={onToggle} aria-expanded={open}>
        <span className="entry-meta">
          {item.topic} · saved {dateFormat.format(new Date(item.savedAt))}
        </span>
        <span className="entry-title">{item.title}</span>
        <span className="entry-summary">{item.summary}</span>
      </button>
      {open && (
        <div className="entry-body">
          {item.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {item.source && (
            <p className="source">
              Source:{' '}
              <a href={item.source.url} target="_blank" rel="noreferrer">
                {item.source.title}
              </a>
            </p>
          )}
          <button className="link danger" onClick={() => library.remove(item.id)}>
            Remove from library
          </button>
        </div>
      )}
    </li>
  )
}

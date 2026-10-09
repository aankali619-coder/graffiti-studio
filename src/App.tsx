import { useEffect, useState } from 'react'
import { Editor } from './editor/Editor'
import type { ToolId } from './types'
import { TOOL_ORDER } from './toolMeta'
import { saveProject, downloadArtwork, exportPNG } from './fileio'
import { TopBar } from './components/TopBar'
import { Toolbar } from './components/Toolbar'
import { CanvasStage } from './components/CanvasStage'
import { OptionsPanel } from './components/OptionsPanel'
import { ColorPanel } from './components/ColorPanel'
import { LayersPanel } from './components/LayersPanel'
import { GalleryPanel } from './components/GalleryPanel'
import { DownloadsPanel } from './components/DownloadsPanel'
import { StatusBar } from './components/StatusBar'
import { Globe } from 'lucide-react'

const KEY_TOOLS: Record<string, ToolId> = Object.fromEntries(
  TOOL_ORDER.map((t) => [t.shortcut.toLowerCase(), t.id]),
)

type SidebarTab = 'studio' | 'layers' | 'gallery' | 'download'

export default function App() {
  const [ed] = useState(() => new Editor())
  const [tab, setTab] = useState<SidebarTab>('studio')
  // handy for debugging / automated tests
  ;(window as unknown as { __editor?: Editor }).__editor = ed

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')
      const mod = e.ctrlKey || e.metaKey

      if (mod) {
        const k = e.key.toLowerCase()
        if (k === 'z') {
          e.preventDefault()
          if (e.shiftKey) void ed.redo()
          else void ed.undo()
        } else if (k === 'y') {
          e.preventDefault()
          void ed.redo()
        } else if (k === 's') {
          // Ctrl+S = download PNG; Ctrl+Shift+S = save project file
          e.preventDefault()
          if (e.shiftKey) saveProject(ed)
          else void downloadArtwork(ed)
        } else if (k === 'e') {
          e.preventDefault()
          exportPNG(ed)
        } else if (e.key === '=' || e.key === '+') {
          e.preventDefault()
          ed.zoomAt(1.25, window.innerWidth / 2, window.innerHeight / 2)
        } else if (e.key === '-') {
          e.preventDefault()
          ed.zoomAt(1 / 1.25, window.innerWidth / 2, window.innerHeight / 2)
        } else if (e.key === '0') {
          e.preventDefault()
          const el = document.querySelector('.stage')
          ed.fit(el?.clientWidth ?? 800, el?.clientHeight ?? 600)
        }
        return
      }

      if (typing) return

      if (e.key === ' ') {
        if (!e.repeat) ed.space = true
        e.preventDefault()
        return
      }

      const k = e.key.toLowerCase()
      if (KEY_TOOLS[k]) {
        ed.setTool(KEY_TOOLS[k])
        return
      }
      if (k === 'x') {
        ed.setOptions({ color: ed.options.secondary, secondary: ed.options.color })
        return
      }
      if (e.key === '[') {
        ed.setOptions({ size: Math.max(1, Math.round(ed.options.size / 1.25)) })
        return
      }
      if (e.key === ']') {
        ed.setOptions({ size: Math.min(220, Math.round(ed.options.size * 1.25) + 1) })
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') ed.space = false
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [ed])

  return (
    <div className="app">
      <TopBar ed={ed} onDownload={() => setTab('download')} />
      <div className="main">
        <Toolbar ed={ed} />
        <div className="center">
          <CanvasStage ed={ed} />
          <StatusBar ed={ed} />
        </div>
        <aside className="sidebar">
          <div className="tabs" role="tablist">
            {(
              [
                ['studio', 'Studio'],
                ['layers', 'Layers'],
                ['download', 'DOWNLOADS'],
                ['gallery', null], // icon-only: Community Gallery
              ] as [SidebarTab, string | null][]
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                aria-label={label ?? 'Community Gallery'}
                title={label ?? 'Community Gallery'}
                className={`tab${tab === id ? ' on' : ''}${label === null ? ' icon' : ''}`}
                onClick={() => setTab(id)}
              >
                {label ?? <Globe size={14} />}
              </button>
            ))}
          </div>
          <div className="sidebar-body">
            {tab === 'studio' && (
              <>
                <OptionsPanel ed={ed} />
                <ColorPanel ed={ed} />
              </>
            )}
            {tab === 'layers' && <LayersPanel ed={ed} />}
            {tab === 'gallery' && <GalleryPanel ed={ed} />}
            {tab === 'download' && <DownloadsPanel ed={ed} />}
          </div>
        </aside>
      </div>
    </div>
  )
}

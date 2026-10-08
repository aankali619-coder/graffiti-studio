import { useEffect, useState } from 'react'
import { Editor } from './editor/Editor'
import type { ToolId } from './types'
import { TOOL_ORDER } from './toolMeta'
import { saveProject, exportPNG } from './fileio'
import { TopBar } from './components/TopBar'
import { Toolbar } from './components/Toolbar'
import { CanvasStage } from './components/CanvasStage'
import { OptionsPanel } from './components/OptionsPanel'
import { ColorPanel } from './components/ColorPanel'
import { LayersPanel } from './components/LayersPanel'
import { StatusBar } from './components/StatusBar'

const KEY_TOOLS: Record<string, ToolId> = Object.fromEntries(
  TOOL_ORDER.map((t) => [t.shortcut.toLowerCase(), t.id]),
)

export default function App() {
  const [ed] = useState(() => new Editor())
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
          e.preventDefault()
          saveProject(ed)
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
      <TopBar ed={ed} />
      <div className="main">
        <Toolbar ed={ed} />
        <div className="center">
          <CanvasStage ed={ed} />
          <StatusBar ed={ed} />
        </div>
        <aside className="sidebar">
          <OptionsPanel ed={ed} />
          <ColorPanel ed={ed} />
          <LayersPanel ed={ed} />
        </aside>
      </div>
    </div>
  )
}

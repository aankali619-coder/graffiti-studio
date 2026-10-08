import { useSyncExternalStore } from 'react'
import type { Editor } from './editor/Editor'

/** Re-renders the component whenever the editor's UI state changes. */
export function useEditorState(ed: Editor): number {
  return useSyncExternalStore(ed.subscribe, ed.getVersion, ed.getVersion)
}

/** Re-renders on cursor movement only (cheap; used by the status bar). */
export function useCursor(ed: Editor): number {
  return useSyncExternalStore(ed.subscribeCursor, ed.getCursorVersion, ed.getCursorVersion)
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { AutosaveController, type SaveStatus } from './autosave'
import type { DocumentPatch } from '../../types/documents'

/**
 * Binds an AutosaveController to a component's lifetime. `save` must be bound to
 * a single document; the component using this hook is keyed by document id.
 */
export function useAutosave(save: (patch: DocumentPatch) => Promise<void>) {
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [error, setError] = useState<unknown>(null)
  const controllerRef = useRef<AutosaveController | null>(null)
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })

  useEffect(() => {
    const controller = new AutosaveController({
      save: (patch) => saveRef.current(patch),
      onStatusChange: (next, err) => {
        setStatus(next)
        setError(next === 'error' ? err : null)
      },
    })
    controllerRef.current = controller

    // Warn before closing the tab with unsaved or in-flight changes.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (controller.hasUnsavedChanges()) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      controller.dispose() // flushes pending edits for THIS document
      controllerRef.current = null
    }
  }, [])

  const update = useCallback((patch: DocumentPatch) => controllerRef.current?.update(patch), [])
  const flush = useCallback(() => controllerRef.current?.flush() ?? Promise.resolve(), [])

  return { status, error, update, flush }
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AutosaveController, type SaveStatus } from './autosave'
import type { DocumentPatch } from '../../types/documents'

function deferred() {
  let resolve!: () => void
  let reject!: (e: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('AutosaveController', () => {
  let statuses: SaveStatus[]
  let calls: { patch: DocumentPatch; d: ReturnType<typeof deferred> }[]
  let controller: AutosaveController

  beforeEach(() => {
    vi.useFakeTimers()
    statuses = []
    calls = []
    controller = new AutosaveController({
      delayMs: 500,
      save: (patch) => {
        const d = deferred()
        calls.push({ patch, d })
        return d.promise
      },
      onStatusChange: (s) => statuses.push(s),
    })
  })
  afterEach(() => vi.useRealTimers())

  it('debounces rapid edits into a single save of the latest values', async () => {
    controller.update({ title: 'a' })
    controller.update({ title: 'ab' })
    controller.update({ content: { type: 'doc' } })
    expect(statuses.at(-1)).toBe('unsaved')
    await vi.advanceTimersByTimeAsync(499)
    expect(calls).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toHaveLength(1)
    expect(calls[0].patch).toEqual({ title: 'ab', content: { type: 'doc' } })
  })

  it('reports "saved" only after the database confirms the write', async () => {
    controller.update({ title: 'x' })
    await vi.advanceTimersByTimeAsync(500)
    expect(controller.currentStatus).toBe('saving')
    calls[0].d.resolve()
    await vi.runAllTimersAsync()
    expect(controller.currentStatus).toBe('saved')
    expect(statuses).toEqual(['unsaved', 'saving', 'saved'])
  })

  it('never runs two saves concurrently; edits during a save are saved afterwards', async () => {
    controller.update({ title: 'v1' })
    await vi.advanceTimersByTimeAsync(500)
    controller.update({ title: 'v2' })
    await vi.advanceTimersByTimeAsync(500)
    expect(calls).toHaveLength(1) // v2 waits for v1
    expect(controller.currentStatus).toBe('saving')

    calls[0].d.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toHaveLength(2)
    expect(calls[1].patch).toEqual({ title: 'v2' })
    expect(controller.currentStatus).toBe('saving') // not "saved" while v2 is outstanding

    calls[1].d.resolve()
    await vi.runAllTimersAsync()
    expect(controller.currentStatus).toBe('saved')
  })

  it('keeps failed changes, reports an error, and retries them with newer edits', async () => {
    controller.update({ title: 'old', content: { type: 'doc', content: [] } })
    await vi.advanceTimersByTimeAsync(500)
    calls[0].d.reject(new Error('offline'))
    await vi.advanceTimersByTimeAsync(0)
    expect(controller.currentStatus).toBe('error')
    expect(controller.hasUnsavedChanges()).toBe(true)

    controller.update({ title: 'new' })
    await vi.advanceTimersByTimeAsync(500)
    expect(calls[1].patch).toEqual({ title: 'new', content: { type: 'doc', content: [] } })
    calls[1].d.resolve()
    await vi.runAllTimersAsync()
    expect(controller.currentStatus).toBe('saved')
    expect(controller.hasUnsavedChanges()).toBe(false)
  })

  it('flushes pending edits immediately on dispose (e.g. switching documents)', async () => {
    controller.update({ title: 'unsaved work' })
    controller.dispose()
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toHaveLength(1)
    expect(calls[0].patch).toEqual({ title: 'unsaved work' })
  })
})

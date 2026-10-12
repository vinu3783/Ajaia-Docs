import type { DocumentPatch } from '../../types/documents'

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error'

export interface AutosaveOptions {
  /** Persists a patch. Must reject if the database did not confirm the write. */
  save: (patch: DocumentPatch) => Promise<void>
  onStatusChange: (status: SaveStatus, error?: unknown) => void
  onSaved?: () => void
  delayMs?: number
}

/**
 * Debounced autosave for ONE document.
 *
 * Guarantees:
 *  - At most one save is in flight at a time, so responses can never arrive out
 *    of order and an older snapshot can never overwrite a newer one.
 *  - Edits made while a save is in flight are queued and saved afterwards.
 *  - "saved" is reported only after `save` resolves AND nothing newer is pending.
 *  - A failed patch is merged back under any newer edits and retried on the
 *    next edit or an explicit flush(), so changes are not silently dropped.
 *
 * The editor is remounted per document and each controller's `save` is bound to
 * a single document id, so a pending save can't land on a different document.
 */
export class AutosaveController {
  private pending: DocumentPatch | null = null
  private inFlight: Promise<void> | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private status: SaveStatus = 'saved'
  private silenced = false
  private readonly opts: AutosaveOptions
  private readonly delayMs: number

  constructor(opts: AutosaveOptions) {
    this.opts = opts
    this.delayMs = opts.delayMs ?? 800
  }

  get currentStatus(): SaveStatus {
    return this.status
  }

  hasUnsavedChanges(): boolean {
    return this.pending !== null || this.inFlight !== null
  }

  /** Record an edit; it will be saved after the debounce delay. */
  update(patch: DocumentPatch): void {
    this.pending = { ...this.pending, ...patch }
    if (!this.inFlight) this.setStatus('unsaved')
    this.clearTimer()
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, this.delayMs)
  }

  /** Save any pending changes now. Resolves once everything queued so far has been attempted. */
  async flush(): Promise<void> {
    this.clearTimer()
    while (this.inFlight) {
      await this.inFlight
    }
    if (!this.pending) return
    const patch = this.pending
    this.pending = null
    this.setStatus('saving')

    const attempt = this.opts.save(patch).then(
      () => {
        this.inFlight = null
        if (this.pending) {
          this.setStatus('unsaved')
          // Newer edits arrived during the save; make sure they get saved even if
          // their debounce timer already fired while we were busy.
          if (!this.timer) void this.flush()
        } else {
          this.setStatus('saved')
          this.opts.onSaved?.()
        }
      },
      (error: unknown) => {
        this.inFlight = null
        // Newer edits win over the failed snapshot; nothing is lost.
        this.pending = { ...patch, ...this.pending }
        this.setStatus('error', error)
      },
    )
    this.inFlight = attempt
    await attempt
  }

  /**
   * Stop reporting status (component unmounted) but still persist outstanding
   * edits, e.g. when the user switches to another document mid-debounce.
   */
  dispose(): void {
    this.silenced = true
    if (this.pending) void this.flush()
  }

  private setStatus(status: SaveStatus, error?: unknown) {
    this.status = status
    if (!this.silenced) this.opts.onStatusChange(status, error)
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}

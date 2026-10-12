import { useState, type KeyboardEvent } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import { DEFAULT_FONT_PT, FONT_SIZES_PT, MAX_FONT_PT, MIN_FONT_PT } from './extensions'

function currentDefault(editor: Editor): number {
  if (editor.isActive('heading', { level: 1 })) return DEFAULT_FONT_PT.h1
  if (editor.isActive('heading', { level: 2 })) return DEFAULT_FONT_PT.h2
  if (editor.isActive('heading', { level: 3 })) return DEFAULT_FONT_PT.h3
  return DEFAULT_FONT_PT.paragraph
}

/** Google Docs-style "– 11 +" font size control, in points. */
export function FontSizeControl({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const size = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const explicit = parseFloat(String(e.getAttributes('textStyle').fontSize ?? ''))
      return Number.isFinite(explicit) ? explicit : currentDefault(e)
    },
  })
  // Text being typed into the box; null while not editing.
  const [draft, setDraft] = useState<string | null>(null)

  /**
   * `returnFocus` only after typing a size + Enter. Tiptap's focus() is deferred to a
   * timer, so calling it from the +/− buttons could pull focus out of the size box if
   * the user clicks into it right afterwards. The buttons don't need it anyway: they
   * prevent mousedown, so the editor keeps its selection.
   */
  function apply(pt: number, returnFocus = false) {
    const clamped = Math.min(MAX_FONT_PT, Math.max(MIN_FONT_PT, Math.round(pt * 2) / 2))
    const chain = returnFocus ? editor.chain().focus() : editor.chain()
    // Back to the block's default size: remove the override instead of storing it.
    if (clamped === currentDefault(editor)) chain.unsetFontSize().run()
    else chain.setFontSize(`${clamped}pt`).run()
  }

  const step = (direction: 1 | -1) => {
    const next =
      direction === 1 ? FONT_SIZES_PT.find((s) => s > size) ?? MAX_FONT_PT : [...FONT_SIZES_PT].reverse().find((s) => s < size) ?? MIN_FONT_PT
    apply(next)
  }

  function commitDraft(returnFocus: boolean) {
    const value = parseFloat(draft ?? '')
    setDraft(null)
    if (Number.isFinite(value)) apply(value, returnFocus)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitDraft(true)
    } else if (e.key === 'Escape') {
      setDraft(null)
      editor.commands.focus()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      setDraft(null)
      step(e.key === 'ArrowUp' ? 1 : -1)
    }
  }

  const buttonClass =
    'inline-flex size-7 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="inline-flex items-center gap-0.5" role="group" aria-label="Font size">
      <button
        type="button"
        className={buttonClass}
        aria-label="Decrease font size"
        title="Decrease font size"
        disabled={disabled || size <= MIN_FONT_PT}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => step(-1)}
      >
        <span aria-hidden="true" className="text-base leading-none">−</span>
      </button>
      <input
        type="text"
        inputMode="decimal"
        aria-label="Font size in points"
        title="Font size (pt)"
        disabled={disabled}
        value={draft ?? String(size)}
        onFocus={(e) => {
          setDraft(String(size))
          e.target.select()
        }}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, '').slice(0, 4))}
        onBlur={() => draft !== null && commitDraft(false)}
        onKeyDown={onKeyDown}
        className="h-7 w-10 rounded-md border border-slate-300 text-center text-sm text-slate-800 focus:border-blue-500 focus:outline-none disabled:opacity-40"
      />
      <button
        type="button"
        className={buttonClass}
        aria-label="Increase font size"
        title="Increase font size"
        disabled={disabled || size >= MAX_FONT_PT}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => step(1)}
      >
        <span aria-hidden="true" className="text-base leading-none">+</span>
      </button>
    </div>
  )
}

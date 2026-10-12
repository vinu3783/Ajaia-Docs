import type { ReactNode } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl+'
const alt = isMac ? '⌥' : 'Alt+'
const shift = isMac ? '⇧' : 'Shift+'

interface ToolButtonProps {
  label: string
  shortcut?: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}

function ToolButton({ label, shortcut, active, disabled, onClick, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      title={shortcut ? `${label} (${shortcut})` : label}
      disabled={disabled}
      // Keep the editor's selection when clicking toolbar buttons.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:bg-blue-100 aria-pressed:text-blue-800"
    >
      {children}
    </button>
  )
}

const Divider = () => <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" aria-hidden="true" />

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

export function Toolbar({ editor, disabled = false }: { editor: Editor; disabled?: boolean }) {
  // Re-render only when the bits we display change, not on every transaction.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      paragraph: e.isActive('paragraph') && !e.isActive('bulletList') && !e.isActive('orderedList'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })
  const run = () => editor.chain().focus()

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex items-center gap-0.5 overflow-x-auto px-2 py-1.5 [scrollbar-width:thin]"
    >
      <ToolButton label="Undo" shortcut={`${mod}Z`} disabled={disabled || !state.canUndo} onClick={() => run().undo().run()}>
        <Icon d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
      </ToolButton>
      <ToolButton label="Redo" shortcut={isMac ? '⌘⇧Z' : 'Ctrl+Y'} disabled={disabled || !state.canRedo} onClick={() => run().redo().run()}>
        <Icon d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
      </ToolButton>
      <Divider />
      <ToolButton label="Normal text" shortcut={`${mod}${alt}0`} active={state.paragraph} disabled={disabled} onClick={() => run().setParagraph().run()}>
        <span className="px-0.5 text-[13px]">Text</span>
      </ToolButton>
      <ToolButton label="Heading 1" shortcut={`${mod}${alt}1`} active={state.h1} disabled={disabled} onClick={() => run().toggleHeading({ level: 1 }).run()}>
        <span className="font-semibold">H1</span>
      </ToolButton>
      <ToolButton label="Heading 2" shortcut={`${mod}${alt}2`} active={state.h2} disabled={disabled} onClick={() => run().toggleHeading({ level: 2 }).run()}>
        <span className="font-semibold">H2</span>
      </ToolButton>
      <Divider />
      <ToolButton label="Bold" shortcut={`${mod}B`} active={state.bold} disabled={disabled} onClick={() => run().toggleBold().run()}>
        <span className="font-bold">B</span>
      </ToolButton>
      <ToolButton label="Italic" shortcut={`${mod}I`} active={state.italic} disabled={disabled} onClick={() => run().toggleItalic().run()}>
        <span className="font-serif italic">I</span>
      </ToolButton>
      <ToolButton label="Underline" shortcut={`${mod}U`} active={state.underline} disabled={disabled} onClick={() => run().toggleUnderline().run()}>
        <span className="underline">U</span>
      </ToolButton>
      <Divider />
      <ToolButton label="Bulleted list" shortcut={`${mod}${shift}8`} active={state.bulletList} disabled={disabled} onClick={() => run().toggleBulletList().run()}>
        <Icon d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
      </ToolButton>
      <ToolButton label="Numbered list" shortcut={`${mod}${shift}7`} active={state.orderedList} disabled={disabled} onClick={() => run().toggleOrderedList().run()}>
        <Icon d="M10 6h10M10 12h10M10 18h10M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
      </ToolButton>
    </div>
  )
}

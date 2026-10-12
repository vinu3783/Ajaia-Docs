import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import { PAGE_GAP_PX, PAGE_MARGIN_PX, paginate, type BlockBox, type PageBreak } from './pageLayout'

const key = new PluginKey<PageBreak[]>('pagination')
/** Pagination only applies where the sheet is really A4-sized (matches Tailwind `sm`). */
const DESKTOP_QUERY = '(min-width: 640px)'
/** Lists are paginated per item; everything else per top-level block. */
const SPLITTABLE = new Set(['bulletList', 'orderedList'])

/** Positions of the blocks that must not be split across pages. */
function unitPositions(doc: PMNode): number[] {
  const positions: number[] = []
  doc.forEach((node, offset) => {
    if (SPLITTABLE.has(node.type.name)) node.forEach((_item, itemOffset) => positions.push(offset + 1 + itemOffset))
    else positions.push(offset)
  })
  return positions
}

function measure(view: EditorView, current: PageBreak[]): { blocks: BlockBox[]; indents: Map<number, number> } {
  const origin = view.dom.getBoundingClientRect()
  const spacerBefore = new Map(current.map((b) => [b.pos, b.height]))
  const blocks: BlockBox[] = []
  const indents = new Map<number, number>()
  let spacersSoFar = 0
  for (const pos of unitPositions(view.state.doc)) {
    const el = view.nodeDOM(pos)
    if (!(el instanceof HTMLElement)) continue
    spacersSoFar += spacerBefore.get(pos) ?? 0
    const rect = el.getBoundingClientRect()
    blocks.push({
      pos,
      // Subtract our own spacers to get the natural (unpaginated) position.
      top: rect.top - origin.top - spacersSoFar,
      height: rect.height,
      marginTop: parseFloat(getComputedStyle(el).marginTop) || 0,
    })
    indents.set(pos, rect.left - origin.left)
  }
  return { blocks, indents }
}

const indentByPos = new WeakMap<EditorView, Map<number, number>>()

function spacer(view: EditorView, brk: PageBreak): HTMLElement {
  const indent = indentByPos.get(view)?.get(brk.pos) ?? 0
  const el = document.createElement('div')
  el.className = 'page-spacer'
  el.contentEditable = 'false'
  el.setAttribute('aria-hidden', 'true')
  const gapStart = brk.gapOffset
  const gapEnd = gapStart + PAGE_GAP_PX
  // Stretch across the whole sheet (and a little beyond, to cover its shadow) so the
  // grey band reads as space between two separate sheets of paper.
  const bleed = PAGE_MARGIN_PX + indent + 6
  Object.assign(el.style, {
    height: `${brk.height}px`,
    marginLeft: `-${bleed}px`,
    width: `calc(100% + ${bleed + PAGE_MARGIN_PX + 6}px)`,
    // Only the gap is painted; elsewhere the sheet's own white shows through.
    background: `linear-gradient(to bottom, transparent 0 ${gapStart}px, #cbd5e1 ${gapStart}px ${gapStart + 1}px, #f1f5f9 ${gapStart + 1}px ${gapEnd - 1}px, #cbd5e1 ${gapEnd - 1}px ${gapEnd}px, transparent ${gapEnd}px)`,
  })
  return el
}

function buildDecorations(state: EditorState, breaks: PageBreak[]): DecorationSet {
  const decorations: Decoration[] = []
  for (const brk of breaks) {
    const node = state.doc.nodeAt(brk.pos)
    if (!node) continue
    decorations.push(
      Decoration.widget(brk.pos, (view) => spacer(view, brk), {
        side: -1,
        ignoreSelection: true,
        key: `page-break-${brk.pos}-${Math.round(brk.height)}-${Math.round(brk.gapOffset)}`,
      }),
      // Lets the print stylesheet break at exactly the same places as the screen.
      Decoration.node(brk.pos, brk.pos + node.nodeSize, { class: 'page-break-before' }),
    )
  }
  return DecorationSet.create(state.doc, decorations)
}

function sameBreaks(a: PageBreak[], b: PageBreak[]): boolean {
  return (
    a.length === b.length &&
    a.every((x, i) => x.pos === b[i].pos && Math.abs(x.height - b[i].height) < 1 && Math.abs(x.gapOffset - b[i].gapOffset) < 1)
  )
}

export interface PaginationOptions {
  onPagesChange: (pages: number) => void
}

/**
 * Splits the document into A4 pages on screen: measures block positions after each
 * change and inserts spacer widgets so no block crosses a page boundary. Spacers are
 * decorations — they are never part of the saved document.
 */
export const Pagination = Extension.create<PaginationOptions>({
  name: 'pagination',

  addOptions() {
    return { onPagesChange: () => {} }
  },

  addProseMirrorPlugins() {
    const { onPagesChange } = this.options
    return [
      new Plugin<PageBreak[]>({
        key,
        state: {
          init: () => [],
          apply(tr, value) {
            const next = tr.getMeta(key) as PageBreak[] | undefined
            if (next) return next
            if (!tr.docChanged) return value
            // Keep breaks attached to their blocks while typing until the next measurement.
            return value
              .map((b) => ({ ...b, pos: tr.mapping.map(b.pos, 1) }))
              .filter((b) => tr.doc.nodeAt(b.pos))
          },
        },
        props: {
          decorations: (state) => buildDecorations(state, key.getState(state) ?? []),
        },
        view(view) {
          let frame = 0
          let lastPages = 0
          const media = typeof window.matchMedia === 'function' ? window.matchMedia(DESKTOP_QUERY) : null

          const run = () => {
            frame = 0
            if (view.isDestroyed) return
            const current = key.getState(view.state) ?? []
            let result = { breaks: [] as PageBreak[], pages: 1 }
            if (media?.matches) {
              const { blocks, indents } = measure(view, current)
              indentByPos.set(view, indents)
              result = paginate(blocks)
            }
            if (result.pages !== lastPages) {
              lastPages = result.pages
              onPagesChange(result.pages)
            }
            if (!sameBreaks(current, result.breaks)) {
              const tr = view.state.tr.setMeta(key, result.breaks).setMeta('addToHistory', false)
              view.dispatch(view.hasFocus() ? tr.scrollIntoView() : tr)
            }
          }
          const schedule = () => {
            if (!frame) frame = requestAnimationFrame(run)
          }

          const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null
          resize?.observe(view.dom)
          media?.addEventListener?.('change', schedule)
          void document.fonts?.ready.then(schedule)
          schedule()

          return {
            update(_view, prevState) {
              if (prevState.doc !== view.state.doc) schedule()
            },
            destroy() {
              if (frame) cancelAnimationFrame(frame)
              resize?.disconnect()
              media?.removeEventListener?.('change', schedule)
            },
          }
        },
      }),
    ]
  },
})

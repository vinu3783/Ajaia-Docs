import StarterKit from '@tiptap/starter-kit'
import { FontSize, TextStyle } from '@tiptap/extension-text-style'

/**
 * Single source of truth for the document schema. Used by the editor UI, the
 * import pipeline tests and the serialization tests so they all agree.
 * StarterKit v3 already bundles Underline, lists, headings and undo/redo.
 * Link is disabled: we don't need it, and it removes a class of href/XSS concerns.
 * TextStyle + FontSize store sizes as a `textStyle` mark, e.g. { fontSize: '14pt' }.
 */
export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: false,
  }),
  TextStyle,
  FontSize,
]

/** Font sizes offered by the toolbar, in points (Google Docs' list). */
export const FONT_SIZES_PT = [8, 9, 10, 11, 12, 14, 18, 24, 30, 36, 48, 60, 72, 96]
export const MIN_FONT_PT = 6
export const MAX_FONT_PT = 96
/** Default size of each block type, matching index.css. */
export const DEFAULT_FONT_PT = { paragraph: 11, h1: 20, h2: 16, h3: 14 } as const

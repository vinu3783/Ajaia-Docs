import StarterKit from '@tiptap/starter-kit'

/**
 * Single source of truth for the document schema. Used by the editor UI, the
 * import pipeline tests and the serialization tests so they all agree.
 * StarterKit v3 already bundles Underline, lists, headings and undo/redo.
 * Link is disabled: we don't need it, and it removes a class of href/XSS concerns.
 */
export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: false,
  }),
]

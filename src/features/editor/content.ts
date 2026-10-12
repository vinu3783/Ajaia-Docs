import type { JSONContent } from '@tiptap/core'

export const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

/** Minimal structural check before handing stored JSON to the editor. */
export function isDocJSON(value: unknown): value is JSONContent {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as JSONContent).type === 'doc' &&
    ((value as JSONContent).content === undefined || Array.isArray((value as JSONContent).content))
  )
}

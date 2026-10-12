import type { JSONContent } from '@tiptap/core'

export const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

const FONT_SIZE_PATTERN = /^(\d{1,2}(?:\.\d)?)pt$/

/**
 * Drops font sizes we didn't produce (anything but 6–96pt). Tiptap already refuses
 * values containing ; { }, this just keeps stored documents to sane values.
 */
export function sanitizeDoc(node: JSONContent): JSONContent {
  const marks = node.marks
    ?.map((mark) => {
      if (mark.type !== 'textStyle') return mark
      const size = String(mark.attrs?.fontSize ?? '').match(FONT_SIZE_PATTERN)
      const valid = size && Number(size[1]) >= 6 && Number(size[1]) <= 96
      return valid ? { type: 'textStyle', attrs: { fontSize: mark.attrs!.fontSize } } : null
    })
    .filter((m): m is NonNullable<typeof m> => m !== null)
  return {
    ...node,
    ...(node.marks && { marks }),
    ...(node.content && { content: node.content.map(sanitizeDoc) }),
  }
}

/** Minimal structural check before handing stored JSON to the editor. */
export function isDocJSON(value: unknown): value is JSONContent {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as JSONContent).type === 'doc' &&
    ((value as JSONContent).content === undefined || Array.isArray((value as JSONContent).content))
  )
}

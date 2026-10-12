import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest globals are off, so RTL can't register its own auto-cleanup.
afterEach(() => cleanup())

// jsdom has no layout engine; ProseMirror measures the selection when focusing/scrolling.
const emptyRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
const zeroRect = () => new DOMRect(0, 0, 0, 0)
if (typeof window !== 'undefined') {
  for (const proto of [Element.prototype, Range.prototype, Text.prototype] as unknown as Record<string, unknown>[]) {
    proto.getClientRects ??= emptyRects
    proto.getBoundingClientRect ??= zeroRect
  }
  document.elementFromPoint ??= () => null
}

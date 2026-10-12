import { describe, expect, it } from 'vitest'
import { A4_HEIGHT_PX, PAGE_MARGIN_PX, pageCountFor } from './pageLayout'

describe('pageCountFor', () => {
  const perPage = A4_HEIGHT_PX - 2 * PAGE_MARGIN_PX // usable height on the first page

  it('always shows at least one A4 page', () => {
    expect(pageCountFor(0)).toBe(1)
    expect(pageCountFor(perPage)).toBe(1)
  })

  it('adds a page as soon as content passes the bottom of the current one', () => {
    expect(pageCountFor(perPage + 1)).toBe(2)
    expect(pageCountFor(perPage + A4_HEIGHT_PX)).toBe(2)
    expect(pageCountFor(perPage + A4_HEIGHT_PX + 1)).toBe(3)
  })
})

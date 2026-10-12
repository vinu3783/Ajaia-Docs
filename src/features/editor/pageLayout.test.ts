import { describe, expect, it } from 'vitest'
import { PAGE_CONTENT_PX, PAGE_GAP_PX, PAGE_MARGIN_PX, PAGE_PITCH_PX, paginate, sheetHeight, type BlockBox } from './pageLayout'

/** Stack equally sized blocks with a fixed margin between them, like paragraphs. */
function stack(count: number, height: number, margin = 12): BlockBox[] {
  return Array.from({ length: count }, (_, i) => ({
    pos: i * 10,
    top: i * (height + margin),
    height,
    marginTop: i === 0 ? 0 : margin,
  }))
}

/** Where each block ends up on screen after the breaks are applied. */
function layout(blocks: BlockBox[]) {
  const { breaks } = paginate(blocks)
  let shift = 0
  return blocks.map((b) => {
    shift += breaks.find((br) => br.pos === b.pos)?.height ?? 0
    return { top: b.top + shift, bottom: b.top + shift + b.height }
  })
}

describe('paginate', () => {
  it('keeps short documents on one page with no breaks', () => {
    expect(paginate(stack(5, 56))).toEqual({ breaks: [], pages: 1 })
    expect(paginate([])).toEqual({ breaks: [], pages: 1 })
  })

  it('never lets a block cross a page boundary or sit in the gap', () => {
    const placed = layout(stack(60, 56))
    for (const { top, bottom } of placed) {
      const page = Math.floor(top / PAGE_PITCH_PX)
      expect(top).toBeGreaterThanOrEqual(page * PAGE_PITCH_PX)
      expect(bottom).toBeLessThanOrEqual(page * PAGE_PITCH_PX + PAGE_CONTENT_PX)
    }
    expect(paginate(stack(60, 56)).pages).toBe(5) // 13 blocks per page
  })

  it('moves the block that would overflow to the very top of the next page', () => {
    const blocks = stack(20, 56) // 68px per block → 13 fit in 931px content height
    const { breaks, pages } = paginate(blocks)
    expect(breaks[0].pos).toBe(blocks[13].pos)
    expect(layout(blocks)[13].top).toBe(PAGE_PITCH_PX)
    expect(pages).toBe(2)
    // The grey gap starts right after page 1's bottom margin.
    const spacerTop = blocks[13].top - blocks[13].marginTop
    expect(spacerTop + breaks[0].gapOffset).toBe(PAGE_CONTENT_PX + PAGE_MARGIN_PX)
  })

  it('leaves a block taller than a page where it is (it cannot fit anywhere)', () => {
    const blocks: BlockBox[] = [
      { pos: 0, top: 0, height: 100, marginTop: 0 },
      { pos: 10, top: 112, height: PAGE_CONTENT_PX + 200, marginTop: 12 },
    ]
    expect(paginate(blocks).breaks).toEqual([])
  })

  it('computes the stacked sheet height including gaps', () => {
    expect(sheetHeight(1)).toBe(1123)
    expect(sheetHeight(3)).toBe(3 * 1123 + 2 * PAGE_GAP_PX)
  })
})

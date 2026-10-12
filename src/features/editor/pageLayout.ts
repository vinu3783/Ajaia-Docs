// A4 at CSS 96 dpi: 210mm × 297mm ≈ 794px × 1123px, with 1in (96px) margins like Google Docs.
export const A4_WIDTH_PX = 794
export const A4_HEIGHT_PX = 1123
export const PAGE_MARGIN_PX = 96
/** Grey space between consecutive sheets on screen. */
export const PAGE_GAP_PX = 20
/** Height available for content on each page. */
export const PAGE_CONTENT_PX = A4_HEIGHT_PX - 2 * PAGE_MARGIN_PX
/** Distance from the top of one page to the top of the next, gap included. */
export const PAGE_PITCH_PX = A4_HEIGHT_PX + PAGE_GAP_PX

/**
 * A block that may not be split across pages (paragraph, heading, list item…),
 * measured in its *natural* position, i.e. as if no page breaks were inserted.
 * `top` is relative to the top of the content area of page 1.
 */
export interface BlockBox {
  pos: number
  top: number
  height: number
  marginTop: number
}

export interface PageBreak {
  /** Document position of the block that starts a new page. */
  pos: number
  /** Height of the spacer inserted before that block. */
  height: number
  /** Offset inside the spacer where the grey gap between sheets begins. */
  gapOffset: number
}

export interface Pagination {
  breaks: PageBreak[]
  pages: number
}

/**
 * Decides where pages break. Any block that would cross the bottom of a page is
 * pushed to the top of the next page by inserting a spacer before it. A block
 * taller than a whole page can't be moved anywhere better, so it is left to
 * overflow (the only case where content crosses a gap).
 */
export function paginate(blocks: BlockBox[]): Pagination {
  const breaks: PageBreak[] = []
  let shift = 0
  let lastBottom = 0

  for (const block of blocks) {
    const top = block.top + shift
    const page = Math.floor(top / PAGE_PITCH_PX)
    const pageStart = page * PAGE_PITCH_PX
    const pageEnd = pageStart + PAGE_CONTENT_PX
    const startsInGap = top >= pageEnd
    const overflows = top + block.height > pageEnd + 0.5
    const fitsOnAPage = block.height <= PAGE_CONTENT_PX

    // A block already at the top of a page gains nothing from moving.
    if (startsInGap || (overflows && fitsOnAPage && top > pageStart)) {
      const height = (page + 1) * PAGE_PITCH_PX - top
      const spacerTop = top - block.marginTop
      breaks.push({ pos: block.pos, height, gapOffset: pageEnd + PAGE_MARGIN_PX - spacerTop })
      shift += height
    }
    lastBottom = Math.max(lastBottom, block.top + shift + block.height)
  }

  const pages = Math.max(1, Math.floor(Math.max(0, lastBottom - 1) / PAGE_PITCH_PX) + 1)
  return { breaks, pages }
}

/** Total on-screen height of a sheet stack with `pages` pages. */
export function sheetHeight(pages: number): number {
  return pages * A4_HEIGHT_PX + (pages - 1) * PAGE_GAP_PX
}

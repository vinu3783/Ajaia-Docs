// A4 at CSS 96 dpi: 210mm × 297mm ≈ 794px × 1123px, with 1in (96px) margins like Google Docs.
export const A4_WIDTH_PX = 794
export const A4_HEIGHT_PX = 1123
export const PAGE_MARGIN_PX = 96

/** Number of A4 pages needed for content of the given height (content box, excluding margins). */
export function pageCountFor(contentHeight: number): number {
  return Math.max(1, Math.ceil((contentHeight + 2 * PAGE_MARGIN_PX) / A4_HEIGHT_PX))
}

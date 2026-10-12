import type { ReactNode } from 'react'
import { A4_WIDTH_PX, sheetHeight } from './pageLayout'

/**
 * The paper the document sits on: A4 width, 1in margins, and on desktop tall
 * enough for `pages` A4 sheets. The gaps between sheets are drawn by the
 * Pagination editor extension, which also decides where pages break.
 */
export function PagedSheet({ pages, children }: { pages: number; children: ReactNode }) {
  return (
    <article
      className="paged-sheet relative mx-auto w-full rounded-sm bg-white px-5 py-8 shadow-sm ring-1 ring-slate-200 sm:px-[96px] sm:py-[96px]"
      style={{ maxWidth: A4_WIDTH_PX, ['--sheet-min-h' as string]: `${sheetHeight(pages)}px` }}
      data-pages={pages}
    >
      {children}
    </article>
  )
}

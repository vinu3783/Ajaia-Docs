import { useEffect, useRef, useState, type ReactNode } from 'react'
import { A4_HEIGHT_PX, A4_WIDTH_PX, pageCountFor } from './pageLayout'

/**
 * Renders the document on an A4-sized sheet and marks where each A4 page ends.
 *
 * This is a visual guide, not true pagination: text flows continuously and is not
 * re-laid out across separate page boxes. Printing / "Save as PDF" uses @page A4
 * (see index.css), so printed output is split into real A4 pages by the browser.
 */
export function PagedSheet({ children }: { children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState(1)

  useEffect(() => {
    const el = contentRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    // Measure the content, not the sheet: the sheet's min-height depends on the
    // page count, and measuring it would stop the count from ever shrinking.
    const observer = new ResizeObserver(([entry]) => setPages(pageCountFor(entry.contentRect.height)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <article
      className="paged-sheet relative mx-auto w-full rounded-sm bg-white px-5 py-8 shadow-sm ring-1 ring-slate-200 sm:px-[96px] sm:py-[96px]"
      style={{ maxWidth: A4_WIDTH_PX, ['--sheet-min-h' as string]: `${pages * A4_HEIGHT_PX}px` }}
      data-pages={pages}
    >
      <div ref={contentRef}>{children}</div>
      {/* Page-boundary guides: desktop only, where the sheet really is A4-sized. */}
      <div className="absolute inset-x-0 top-0 hidden sm:block print:hidden" aria-hidden="true">
        {Array.from({ length: pages - 1 }, (_, i) => (
          <div
            key={i}
            className="pointer-events-none absolute -left-3 -right-3 border-t-2 border-dashed border-slate-300"
            style={{ top: (i + 1) * A4_HEIGHT_PX }}
          >
            <span
              title="Approximate A4 page boundary. When printing, the browser avoids splitting lines, so printed breaks can differ by a few lines."
              className="absolute -top-3 right-full mr-2 whitespace-nowrap rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
              Page {i + 2}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-6 text-right text-xs text-slate-400 sm:hidden print:hidden">
        {pages} {pages === 1 ? 'page' : 'pages'} (A4)
      </p>
    </article>
  )
}

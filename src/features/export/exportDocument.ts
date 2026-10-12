import type { JSONContent } from '@tiptap/core'
import { DEFAULT_TITLE } from '../../types/documents'

export type ExportFormat = 'md' | 'txt' | 'html'

/** Filesystem-safe base name derived from the document title. */
export function safeFilename(title: string): string {
  const base = Array.from(title)
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .join('')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
  return base || DEFAULT_TITLE
}

// ---------------------------------------------------------------------------
// Tiptap JSON → Markdown (the inverse of import/markdown.ts)
// ---------------------------------------------------------------------------

/** Escape characters our importer (and CommonMark) would otherwise treat as syntax. */
function escapeInline(text: string): string {
  return text.replace(/([\\`*_~[\]<])/g, '\\$1')
}

/** Escape block syntax at the start of a paragraph line so it stays literal text. */
function escapeLineStart(line: string): string {
  if (/^\s*-(\s*-){2,}\s*$/.test(line)) return line.replace('-', '\\-') // would become a rule
  return line
    .replace(/^(\s*)(#{1,6}\s|[-+]\s|>)/, '$1\\$2')
    .replace(/^(\s*\d+)([.)]\s)/, '$1\\$2')
}

const MARK_ORDER = ['code', 'bold', 'italic', 'strike', 'underline']
const MARK_SYNTAX: Record<string, [string, string]> = {
  bold: ['**', '**'],
  italic: ['*', '*'],
  strike: ['~~', '~~'],
  // Markdown has no underline; <u> is widely rendered and keeps the intent.
  underline: ['<u>', '</u>'],
}

function inlineToMarkdown(nodes: JSONContent[] = []): string {
  return nodes
    .map((node) => {
      if (node.type === 'hardBreak') return '\\\n'
      if (node.type !== 'text' || !node.text) return ''
      const marks = (node.marks ?? []).map((m) => m.type).sort((a, b) => MARK_ORDER.indexOf(a) - MARK_ORDER.indexOf(b))
      if (marks.includes('code')) return `\`${node.text.replace(/`/g, "'")}\``
      let out = escapeInline(node.text)
      for (const mark of marks) {
        const syntax = MARK_SYNTAX[mark]
        if (syntax) out = `${syntax[0]}${out}${syntax[1]}`
      }
      return out
    })
    .join('')
}

function blockToMarkdown(node: JSONContent, indent = ''): string {
  const children = node.content ?? []
  switch (node.type) {
    case 'heading':
      return `${'#'.repeat(Number(node.attrs?.level ?? 1))} ${inlineToMarkdown(children)}`
    case 'paragraph':
      return escapeLineStart(inlineToMarkdown(children))
    case 'bulletList':
    case 'orderedList': {
      const start = Number(node.attrs?.start ?? 1)
      return children
        .map((item, i) => {
          const marker = node.type === 'bulletList' ? '- ' : `${start + i}. `
          const [first, ...rest] = item.content ?? []
          const head = first ? blockToMarkdown(first) : ''
          // Nested lists indent themselves; other extra blocks get the item's indentation.
          const tail = rest
            .map((child) =>
              child.type === 'bulletList' || child.type === 'orderedList'
                ? `\n${blockToMarkdown(child, indent + '   ')}`
                : `\n\n${indent}   ${blockToMarkdown(child)}`,
            )
            .join('')
          return `${indent}${marker}${head}${tail}`
        })
        .join('\n')
    }
    case 'blockquote':
      return children
        .map((c) => blockToMarkdown(c))
        .join('\n\n')
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n')
    case 'codeBlock':
      return `\`\`\`\n${children.map((c) => c.text ?? '').join('')}\n\`\`\``
    case 'horizontalRule':
      return '---'
    default:
      return inlineToMarkdown(children)
  }
}

export function docToMarkdown(doc: JSONContent): string {
  return (
    (doc.content ?? [])
      .map((block) => blockToMarkdown(block))
      .join('\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n'
  )
}

// ---------------------------------------------------------------------------
// HTML export: wraps the editor's own serializer output (schema-generated, so
// it only ever contains the node/mark types our schema allows).
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export function toHtmlDocument(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 25mm; }
  body { font-family: system-ui, sans-serif; line-height: 1.6; max-width: 210mm; margin: 2rem auto; padding: 0 1rem; color: #1e293b; }
  pre { background: #0f172a; color: #f1f5f9; padding: 1rem; border-radius: 6px; overflow-x: auto; }
  code { font-family: ui-monospace, monospace; }
  blockquote { border-left: 4px solid #e2e8f0; margin-left: 0; padding-left: 1rem; color: #475569; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`
}

/** Trigger a browser download of `content` without a server round-trip. */
export function downloadFile(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

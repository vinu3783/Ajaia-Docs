import type { JSONContent } from '@tiptap/core'

/**
 * Converts a practical subset of Markdown straight into Tiptap JSON.
 *
 * Deliberately never produces or parses HTML: all file content ends up in text
 * nodes, so nothing in an uploaded file can become markup or script.
 *
 * Supported: ATX headings (#, ##, ###+ → H3), bullet lists (-, *, +), numbered
 * lists, blockquotes, fenced code blocks, horizontal rules, and inline
 * **bold**, *italic*, `code` and ~~strike~~. Nested lists are flattened;
 * links and images are kept as their literal Markdown text.
 */
export function markdownToDoc(markdown: string): JSONContent {
  const lines = normalizeNewlines(markdown).split('\n')
  const blocks: JSONContent[] = []
  let paragraph: string[] = []
  let i = 0

  const flushParagraph = () => {
    if (paragraph.length) blocks.push(paragraphFromLines(paragraph))
    paragraph = []
  }

  while (i < lines.length) {
    const line = lines[i]

    const fence = line.match(/^\s*(```|~~~)/)
    if (fence) {
      flushParagraph()
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith(fence[1])) code.push(lines[i++])
      i++ // closing fence (or EOF)
      blocks.push({ type: 'codeBlock', content: textNodes(code.join('\n')) })
      continue
    }

    if (line.trim() === '') {
      flushParagraph()
      i++
      continue
    }

    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushParagraph()
      blocks.push({ type: 'horizontalRule' })
      i++
      continue
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/)
    if (heading) {
      flushParagraph()
      const level = Math.min(heading[1].length, 3)
      blocks.push({ type: 'heading', attrs: { level }, content: parseInline(heading[2]) })
      i++
      continue
    }

    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      flushParagraph()
      const ordered = /^\s*\d+[.)]\s+/.test(line)
      const itemPattern = ordered ? /^\s*(\d+)[.)]\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/
      const start = ordered ? Number(line.match(itemPattern)![1]) : 1
      const items: JSONContent[] = []
      while (i < lines.length) {
        const m = lines[i].match(itemPattern)
        if (!m) break
        const text = ordered ? m[2] : m[1]
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: parseInline(text) }] })
        i++
      }
      blocks.push(
        ordered
          ? { type: 'orderedList', attrs: { start }, content: items }
          : { type: 'bulletList', content: items },
      )
      continue
    }

    if (/^\s{0,3}>/.test(line)) {
      flushParagraph()
      const quoted: string[] = []
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) {
        quoted.push(lines[i].replace(/^\s{0,3}>\s?/, ''))
        i++
      }
      const inner = markdownToDoc(quoted.join('\n')).content ?? []
      blocks.push({ type: 'blockquote', content: inner.length ? inner : [{ type: 'paragraph' }] })
      continue
    }

    paragraph.push(line)
    i++
  }
  flushParagraph()

  return { type: 'doc', content: blocks.length ? blocks : [{ type: 'paragraph' }] }
}

/** Plain text: one paragraph per line, so every line break and blank line survives. */
export function plainTextToDoc(text: string): JSONContent {
  const lines = normalizeNewlines(text).split('\n')
  if (lines.length > 1 && lines.at(-1) === '') lines.pop() // trailing newline at EOF
  return {
    type: 'doc',
    content: lines.map((line) => (line ? { type: 'paragraph', content: textNodes(line) } : { type: 'paragraph' })),
  }
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, '\n')
}

function textNodes(text: string): JSONContent[] | undefined {
  return text ? [{ type: 'text', text }] : undefined
}

/** Consecutive Markdown lines form one paragraph; keep the original line breaks. */
function paragraphFromLines(lines: string[]): JSONContent {
  const content: JSONContent[] = []
  lines.forEach((line, idx) => {
    if (idx > 0) content.push({ type: 'hardBreak' })
    content.push(...parseInline(line.trim()))
  })
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
}

type Mark = { type: string }

const INLINE_PATTERN =
  /(\*\*|__)(?=\S)(.+?)(?<=\S)\1|(?<![\w*])\*(?=[^\s*])(.+?)(?<=[^\s*])\*(?!\*)|(?<![\w_])_(?=[^\s_])(.+?)(?<=[^\s_])_(?![\w_])|`([^`]+)`|~~(?=\S)(.+?)(?<=\S)~~/

export function parseInline(text: string, marks: Mark[] = []): JSONContent[] {
  const out: JSONContent[] = []
  let rest = text
  while (rest) {
    const m = rest.match(INLINE_PATTERN)
    if (!m || m.index === undefined) {
      out.push(textWithMarks(rest, marks))
      break
    }
    if (m.index > 0) out.push(textWithMarks(rest.slice(0, m.index), marks))
    if (m[2] !== undefined) out.push(...parseInline(m[2], [...marks, { type: 'bold' }]))
    else if (m[3] !== undefined) out.push(...parseInline(m[3], [...marks, { type: 'italic' }]))
    else if (m[4] !== undefined) out.push(...parseInline(m[4], [...marks, { type: 'italic' }]))
    else if (m[5] !== undefined) out.push(textWithMarks(m[5], [...marks, { type: 'code' }]))
    else if (m[6] !== undefined) out.push(...parseInline(m[6], [...marks, { type: 'strike' }]))
    rest = rest.slice(m.index + m[0].length)
  }
  return out
}

function textWithMarks(text: string, marks: Mark[]): JSONContent {
  return marks.length ? { type: 'text', text, marks: [...marks] } : { type: 'text', text }
}

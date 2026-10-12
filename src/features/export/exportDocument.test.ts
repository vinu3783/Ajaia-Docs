import type { JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { markdownToDoc } from '../import/markdown'
import { createTestEditor } from '../../test/editorHarness'
import { docToMarkdown, safeFilename, toHtmlDocument } from './exportDocument'

const text = (t: string, ...marks: string[]): JSONContent =>
  marks.length ? { type: 'text', text: t, marks: marks.map((type) => ({ type })) } : { type: 'text', text: t }
const p = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content })
const li = (...content: JSONContent[]): JSONContent => ({ type: 'listItem', content: [p(...content)] })

/** Normalise through a real editor so both sides use the schema's canonical JSON. */
const canonical = (doc: JSONContent) => {
  const editor = createTestEditor(doc)
  const json = editor.getJSON()
  editor.destroy()
  return json
}

describe('docToMarkdown', () => {
  const doc: JSONContent = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [text('Launch plan')] },
      { type: 'heading', attrs: { level: 2 }, content: [text('Goals')] },
      p(text('Ship '), text('bold', 'bold'), text(', '), text('italic', 'italic'), text(', '), text('underlined', 'underline'), text(' and '), text('both', 'bold', 'italic')),
      p(text('line one'), { type: 'hardBreak' }, text('line two')),
      { type: 'bulletList', content: [li(text('alpha')), li(text('beta'))] },
      { type: 'orderedList', attrs: { start: 3 }, content: [li(text('three')), li(text('four'))] },
      { type: 'blockquote', content: [p(text('quoted'))] },
      { type: 'codeBlock', content: [text('# not a heading\n*not bold*')] },
      { type: 'horizontalRule' },
      // Text that *looks* like Markdown must stay literal.
      p(text('# not a heading, 2. not a list, *not italic*, snake_case, <u>not underline</u>, a\\b')),
      p(text('---')),
    ],
  }

  it('produces readable Markdown', () => {
    const md = docToMarkdown(doc)
    expect(md).toContain('# Launch plan\n\n## Goals')
    expect(md).toContain('Ship **bold**, *italic*, <u>underlined</u> and ***both***')
    expect(md).toContain('- alpha\n- beta')
    expect(md).toContain('3. three\n4. four')
    expect(md).toContain('> quoted')
    expect(md).toContain('```\n# not a heading\n*not bold*\n```')
    expect(md).toContain('\n---\n')
  })

  it('round-trips through the importer without losing formatting or literal text', () => {
    const reimported = markdownToDoc(docToMarkdown(doc))
    expect(canonical(reimported)).toEqual(canonical(doc))
  })

  it('indents nested lists', () => {
    const nested: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [p(text('parent')), { type: 'bulletList', content: [li(text('child'))] }] },
          ],
        },
      ],
    }
    expect(docToMarkdown(nested)).toBe('- parent\n   - child\n')
  })
})

describe('safeFilename', () => {
  it('removes characters that are invalid in file names', () => {
    expect(safeFilename('Q3: plan/draft? <v2>')).toBe('Q3 plan draft v2')
    expect(safeFilename('a\u0007b')).toBe('ab')
    expect(safeFilename('  ')).toBe('Untitled document')
  })
})

describe('toHtmlDocument', () => {
  it('escapes the title and uses A4 print settings', () => {
    const html = toHtmlDocument('<script>x</script>', '<p>hi</p>')
    expect(html).toContain('<title>&lt;script&gt;x&lt;/script&gt;</title>')
    expect(html).toContain('@page { size: A4')
    expect(html).toContain('<p>hi</p>')
  })
})

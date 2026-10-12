import { describe, expect, it } from 'vitest'
import { ImportError, MAX_IMPORT_BYTES, importFile, titleFromFilename, validateImportFile } from './importFile'
import { markdownToDoc, plainTextToDoc } from './markdown'
import { createTestEditor } from '../../test/editorHarness'

const file = (parts: BlobPart[], name: string, type = '') => new File(parts, name, { type })

describe('validateImportFile — unsupported uploads are rejected', () => {
  it.each([
    ['report.pdf', 'application/pdf'],
    ['notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['page.html', 'text/html'],
    ['script.js', 'text/javascript'],
    ['no-extension', ''],
  ])('rejects %s', (name, type) => {
    expect(() => validateImportFile(file(['hello'], name, type))).toThrow(ImportError)
    expect(() => validateImportFile(file(['hello'], name, type))).toThrow(/not supported/)
  })

  it('rejects a .txt file whose MIME type says it is something else', () => {
    expect(() => validateImportFile(file(['<html>'], 'fake.txt', 'text/html'))).toThrow(/unexpected file type/)
  })

  it('rejects empty and oversized files instead of truncating', () => {
    expect(() => validateImportFile(file([], 'empty.txt', 'text/plain'))).toThrow(/empty/)
    const big = file([new Uint8Array(MAX_IMPORT_BYTES + 1)], 'big.md', 'text/markdown')
    expect(() => validateImportFile(big)).toThrow(/maximum import size is 1 MB/)
  })

  it('accepts .txt, .md and .markdown, including .md with no browser MIME type', () => {
    expect(validateImportFile(file(['a'], 'a.txt', 'text/plain'))).toBe('txt')
    expect(validateImportFile(file(['a'], 'a.MD', ''))).toBe('md')
    expect(validateImportFile(file(['a'], 'a.markdown', 'text/markdown'))).toBe('md')
  })
})

describe('importFile', () => {
  it('rejects binary and non-UTF-8 content', async () => {
    await expect(importFile(file([new Uint8Array([0x68, 0x00, 0x69])], 'bin.txt'))).rejects.toThrow(/binary/)
    await expect(importFile(file([new Uint8Array([0xff, 0xfe, 0xfd])], 'latin.txt'))).rejects.toThrow(/UTF-8/)
    await expect(importFile(file(['   \n\n'], 'blank.txt'))).rejects.toThrow(/no text/)
  })

  it('uses the filename as the title and preserves plain-text lines', async () => {
    const doc = await importFile(file(['Line one\r\n\r\nLine   three\n'], 'meeting_notes.txt', 'text/plain'))
    expect(doc.title).toBe('meeting notes')
    expect(doc.content).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Line one' }] },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: 'Line   three' }] },
      ],
    })
  })

  it('treats HTML in a text file as literal text, never markup', async () => {
    const doc = await importFile(file(['<img src=x onerror=alert(1)>'], 'x.md'))
    const editor = createTestEditor(doc.content)
    expect(editor.getText()).toBe('<img src=x onerror=alert(1)>')
    expect(editor.getHTML()).not.toContain('<img')
    editor.destroy()
  })
})

describe('markdownToDoc', () => {
  const md = [
    '# Project plan',
    '## Goals',
    'Ship **bold** and *italic* and _also italic_ with `code`.',
    'Second line of the same paragraph.',
    '',
    '- first',
    '* second',
    '',
    '3. three',
    '4. four',
    '',
    '> quoted',
    '',
    '```',
    '# not a heading',
    '```',
    '---',
    '#### deep heading',
    'snake_case_name stays plain',
  ].join('\n')

  it('converts headings, lists and inline formatting into schema-valid editor content', () => {
    const doc = markdownToDoc(md)
    const editor = createTestEditor(doc) // throws on schema violations
    const html = editor.getHTML()
    expect(html).toContain('<h1>Project plan</h1>')
    expect(html).toContain('<h2>Goals</h2>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
    expect(html).toContain('<em>also italic</em>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('<br>Second line')
    expect(html).toMatch(/<ul><li><p>first<\/p><\/li><li><p>second<\/p><\/li><\/ul>/)
    expect(html).toMatch(/<ol start="3"><li><p>three<\/p><\/li><li><p>four<\/p><\/li><\/ol>/)
    expect(html).toContain('<blockquote><p>quoted</p></blockquote>')
    expect(html).toContain('# not a heading') // code fences are literal
    expect(html).toContain('<hr>')
    expect(html).toContain('<h3>deep heading</h3>')
    expect(html).toContain('snake_case_name stays plain')
    editor.destroy()
  })

  it('handles empty documents and plain text edge cases', () => {
    expect(() => createTestEditor(markdownToDoc('')).destroy()).not.toThrow()
    expect(() => createTestEditor(plainTextToDoc('\n\n\n')).destroy()).not.toThrow()
  })
})

describe('titleFromFilename', () => {
  it('strips the extension and falls back for blank names', () => {
    expect(titleFromFilename('Q3 roadmap.md')).toBe('Q3 roadmap')
    expect(titleFromFilename('.md')).toBe('Untitled document')
    expect(titleFromFilename(`${'x'.repeat(300)}.txt`)).toHaveLength(200)
  })
})

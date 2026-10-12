import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../../test/editorHarness'
import { EMPTY_DOC, isDocJSON, sanitizeDoc } from './content'

describe('rich-text serialization', () => {
  it('preserves formatting through save (JSON) and load', () => {
    const lines = ['Heading', 'Sub', 'bold italic underline', 'bullet', 'number']
    const editor = createTestEditor({
      type: 'doc',
      content: lines.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
    })
    /** Select `text` in the document, like a user dragging over it. */
    const select = (text: string) => {
      let from = -1
      editor.state.doc.descendants((node, pos) => {
        if (from === -1 && node.isText && node.text?.includes(text)) from = pos + node.text.indexOf(text)
      })
      expect(from).toBeGreaterThan(-1)
      editor.commands.setTextSelection({ from, to: from + text.length })
    }

    select('Heading')
    editor.commands.toggleHeading({ level: 1 })
    select('Sub')
    editor.commands.toggleHeading({ level: 2 })
    select('bold')
    editor.commands.toggleBold()
    select('italic')
    editor.commands.toggleItalic()
    select('underline')
    editor.commands.toggleUnderline()
    select('bullet')
    editor.commands.toggleBulletList()
    select('number')
    editor.commands.toggleOrderedList()

    const saved = editor.getJSON()
    // What actually goes over the wire and into the jsonb column.
    const fromDatabase = JSON.parse(JSON.stringify(saved))
    expect(isDocJSON(fromDatabase)).toBe(true)

    const reloaded = createTestEditor(fromDatabase)
    expect(reloaded.getJSON()).toEqual(saved)

    const html = reloaded.getHTML()
    expect(html).toContain('<h1>Heading</h1>')
    expect(html).toContain('<h2>Sub</h2>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
    expect(html).toContain('<u>underline</u>')
    expect(html).toContain('<ul><li><p>bullet</p></li></ul>')
    expect(html).toContain('<ol><li><p>number</p></li></ol>')
    editor.destroy()
    reloaded.destroy()
  })

  it('preserves font sizes through save and load', () => {
    const editor = createTestEditor({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'big words' }] }] })
    editor.chain().setTextSelection({ from: 1, to: 4 }).setFontSize('24pt').run()
    const reloaded = createTestEditor(JSON.parse(JSON.stringify(editor.getJSON())))
    expect(reloaded.getHTML()).toBe('<p><span style="font-size: 24pt;">big</span> words</p>')
    editor.destroy()
    reloaded.destroy()
  })

  it('drops stored font sizes outside 6–96pt or in unexpected formats', () => {
    const withSize = (fontSize: unknown) => ({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { fontSize } }] }] }],
    })
    const marksOf = (fontSize: unknown) => sanitizeDoc(withSize(fontSize)).content![0].content![0].marks
    expect(marksOf('14pt')).toEqual([{ type: 'bold' }, { type: 'textStyle', attrs: { fontSize: '14pt' } }])
    expect(marksOf('500pt')).toEqual([{ type: 'bold' }])
    expect(marksOf('12px; background: url(https://evil.example)')).toEqual([{ type: 'bold' }])
    expect(marksOf(null)).toEqual([{ type: 'bold' }])
  })

  it('supports undo and redo', () => {
    const editor = createTestEditor(EMPTY_DOC)
    editor.chain().focus().insertContent('hello').run()
    expect(editor.getText()).toBe('hello')
    editor.commands.undo()
    expect(editor.getText()).toBe('')
    editor.commands.redo()
    expect(editor.getText()).toBe('hello')
    editor.destroy()
  })

  it('rejects stored content that is not a document', () => {
    expect(isDocJSON(null)).toBe(false)
    expect(isDocJSON('<p>hi</p>')).toBe(false)
    expect(isDocJSON({ type: 'paragraph' })).toBe(false)
    expect(isDocJSON({ type: 'doc', content: 'x' })).toBe(false)
    expect(isDocJSON(EMPTY_DOC)).toBe(true)
  })
})

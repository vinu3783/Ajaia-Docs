import type { JSONContent } from '@tiptap/core'
import { DEFAULT_TITLE, TITLE_MAX_LENGTH } from '../../types/documents'
import { markdownToDoc, plainTextToDoc } from './markdown'

export const MAX_IMPORT_BYTES = 1024 * 1024 // 1 MB
export const SUPPORTED_FORMATS_LABEL = '.txt and .md (Markdown), up to 1 MB'
/** Value for <input type="file" accept>. */
export const ACCEPT_ATTRIBUTE = '.txt,.md,.markdown,text/plain,text/markdown'

const ALLOWED_MIME: Record<'txt' | 'md', string[]> = {
  txt: ['text/plain'],
  md: ['text/markdown', 'text/x-markdown', 'text/plain'],
}

export type ImportKind = keyof typeof ALLOWED_MIME

export interface ImportedDocument {
  title: string
  content: JSONContent
}

export class ImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportError'
  }
}

function kindFromName(name: string): ImportKind | null {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  if (ext === 'txt') return 'txt'
  if (ext === 'md' || ext === 'markdown') return 'md'
  return null
}

/** Cheap checks that don't require reading the file. Throws ImportError. */
export function validateImportFile(file: File): ImportKind {
  const kind = kindFromName(file.name)
  if (!kind) {
    throw new ImportError(`“${file.name}” is not supported. Supported formats: ${SUPPORTED_FORMATS_LABEL}.`)
  }
  // Browsers often report an empty type for .md files; only reject an explicit mismatch.
  if (file.type && !ALLOWED_MIME[kind].includes(file.type.split(';')[0].trim().toLowerCase())) {
    throw new ImportError(`“${file.name}” has an unexpected file type (${file.type}). Supported formats: ${SUPPORTED_FORMATS_LABEL}.`)
  }
  if (file.size === 0) throw new ImportError(`“${file.name}” is empty.`)
  if (file.size > MAX_IMPORT_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    throw new ImportError(`“${file.name}” is ${mb} MB. The maximum import size is 1 MB.`)
  }
  return kind
}

export function titleFromFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[\s_]+/g, ' ').trim()
  return (base || DEFAULT_TITLE).slice(0, TITLE_MAX_LENGTH)
}

async function readFileBytes(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer()
  return new Response(file).arrayBuffer()
}

/** Validates, reads and converts a .txt/.md file into a new document's title + content. */
export async function importFile(file: File): Promise<ImportedDocument> {
  const kind = validateImportFile(file)
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(await readFileBytes(file))
  } catch {
    throw new ImportError(`“${file.name}” is not valid UTF-8 text.`)
  }
  if (text.includes('\u0000')) throw new ImportError(`“${file.name}” looks like a binary file, not text.`)
  text = text.replace(/^\uFEFF/, '')
  if (!text.trim()) throw new ImportError(`“${file.name}” has no text content.`)

  return {
    title: titleFromFilename(file.name),
    content: kind === 'md' ? markdownToDoc(text) : plainTextToDoc(text),
  }
}

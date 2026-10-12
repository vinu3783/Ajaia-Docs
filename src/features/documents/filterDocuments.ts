import type { DocumentSummary } from '../../types/documents'

/** Case-insensitive match on title, or on the owner's email for shared documents. */
export function filterDocuments(docs: DocumentSummary[], query: string): DocumentSummary[] {
  const q = query.trim().toLowerCase()
  if (!q) return docs
  return docs.filter((d) => d.title.toLowerCase().includes(q) || d.ownerEmail?.toLowerCase().includes(q))
}

import type { JSONContent } from '@tiptap/core'

export type Permission = 'viewer' | 'editor'
/** The current user's relationship to a document. */
export type AccessRole = 'owner' | Permission

export interface DocumentSummary {
  id: string
  title: string
  ownerId: string
  updatedAt: string
  role: AccessRole
  /** Only populated for documents shared with the current user. */
  ownerEmail?: string
}

export interface DocumentRecord extends DocumentSummary {
  content: JSONContent
}

export interface DocumentPatch {
  title?: string
  content?: JSONContent
}

export interface DocumentShare {
  id: string
  userId: string
  email: string
  permission: Permission
  createdAt: string
}

export const TITLE_MAX_LENGTH = 200
export const DEFAULT_TITLE = 'Untitled document'

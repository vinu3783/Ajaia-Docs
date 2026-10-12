import { Editor, type JSONContent } from '@tiptap/core'
import { editorExtensions } from '../features/editor/extensions'

/** Headless editor with the app's real schema; throws if content doesn't fit the schema. */
export function createTestEditor(content?: JSONContent): Editor {
  return new Editor({
    extensions: editorExtensions,
    content,
    enableContentCheck: true,
    onContentError: ({ error }) => {
      throw error
    },
  })
}

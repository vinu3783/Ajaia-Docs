/** Turn Supabase/PostgREST/network errors into short, user-facing messages. */
export function toUserMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return 'Network error — check your connection and try again.'
  }
  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message) {
    const code = 'code' in error ? String(error.code) : ''
    if (code === '42501' || /row-level security|permission denied/i.test(error.message)) {
      // Our own RPC raises friendly 42501 messages; raw Postgres ones are not.
      return /row-level security|permission denied/i.test(error.message)
        ? 'You do not have permission to do that.'
        : error.message
    }
    if (/Failed to fetch|NetworkError|Load failed/i.test(error.message)) {
      return 'Network error — check your connection and try again.'
    }
    return error.message
  }
  return fallback
}

/** Thrown when an UPDATE/DELETE matched no rows (RLS filters silently instead of erroring). */
export class AccessLostError extends Error {
  constructor(message = 'This document is no longer available to you, or you no longer have permission to edit it.') {
    super(message)
    this.name = 'AccessLostError'
  }
}

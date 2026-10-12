import type { SupabaseClient } from '@supabase/supabase-js'

export type Call = [method: string, ...args: unknown[]]

/**
 * A tiny stand-in for the Supabase query builder: records every chained call and
 * resolves the whole chain to `result`. For unit-testing our data-access code
 * only — it says nothing about what the real database or RLS would allow.
 */
export function fakeSupabase(result: { data: unknown; error: unknown }) {
  const calls: Call[] = []
  const builder: object = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(result)
        return (...args: unknown[]) => {
          calls.push([String(prop), ...args])
          return builder
        }
      },
    },
  )
  const client = {
    from: (table: string) => {
      calls.push(['from', table])
      return builder
    },
    rpc: (fn: string, args: unknown) => {
      calls.push(['rpc', fn, args])
      return builder
    },
  } as unknown as SupabaseClient
  return { client, calls }
}

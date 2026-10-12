import type { SupabaseClient } from '@supabase/supabase-js'
import { Logo } from './components/Logo'
import { Spinner } from './components/Spinner'
import { useAuth } from './features/auth/AuthContext'
import { AuthScreen } from './features/auth/AuthScreen'
import { Workspace } from './features/documents/Workspace'

export function App({ client }: { client: SupabaseClient }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center text-slate-500">
        <Spinner label="Loading…" />
      </div>
    )
  }
  // key: never carry one user's in-memory state over to the next sign-in.
  return user ? <Workspace key={user.id} client={client} user={user} /> : <AuthScreen client={client} />
}

export function MissingConfig() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <Logo />
        <h1 className="mt-4 text-lg font-semibold">Supabase is not configured</h1>
        <p className="mt-2 text-sm text-slate-600">
          Set <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_ANON_KEY</code> (see <code>.env.example</code>{' '}
          and README), then restart the dev server or redeploy.
        </p>
      </div>
    </main>
  )
}

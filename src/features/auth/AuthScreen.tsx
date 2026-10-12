import { useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Logo } from '../../components/Logo'
import { Spinner } from '../../components/Spinner'
import { toUserMessage } from '../../lib/errors'
import { EMAIL_PATTERN } from '../sharing/sharingApi'

type Mode = 'sign-in' | 'sign-up'
const MIN_PASSWORD = 8

export function AuthScreen({ client }: { client: SupabaseClient }) {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    const trimmed = email.trim()
    if (!EMAIL_PATTERN.test(trimmed)) return setError('Enter a valid email address.')
    if (mode === 'sign-up' && password.length < MIN_PASSWORD) {
      return setError(`Use at least ${MIN_PASSWORD} characters for your password.`)
    }
    if (!password) return setError('Enter your password.')

    setBusy(true)
    try {
      if (mode === 'sign-in') {
        const { error } = await client.auth.signInWithPassword({ email: trimmed, password })
        if (error) throw error
      } else {
        const { data, error } = await client.auth.signUp({ email: trimmed, password })
        if (error) throw error
        // With "Confirm email" enabled in Supabase, no session is returned yet.
        if (!data.session) {
          setNotice('Account created. Check your inbox to confirm your email, then sign in.')
          setMode('sign-in')
        }
      }
    } catch (err) {
      setError(toUserMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const isSignIn = mode === 'sign-in'

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">{isSignIn ? 'Sign in' : 'Create an account'}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isSignIn ? 'Welcome back. Sign in to open your documents.' : 'Sign up to create and share documents.'}
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input mt-1"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={isSignIn ? 'current-password' : 'new-password'}
                required
                minLength={isSignIn ? undefined : MIN_PASSWORD}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input mt-1"
                aria-describedby={isSignIn ? undefined : 'password-hint'}
              />
              {!isSignIn && (
                <p id="password-hint" className="mt-1 text-xs text-slate-500">
                  At least {MIN_PASSWORD} characters.
                </p>
              )}
            </div>

            {error && (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
                {notice}
              </p>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy && <Spinner className="size-4" />}
              {isSignIn ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-slate-600">
          {isSignIn ? 'New to Ajaia Docs?' : 'Already have an account?'}{' '}
          <button
            type="button"
            className="font-medium text-blue-700 hover:underline"
            onClick={() => {
              setMode(isSignIn ? 'sign-up' : 'sign-in')
              setError(null)
              setNotice(null)
            }}
          >
            {isSignIn ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </div>
    </main>
  )
}

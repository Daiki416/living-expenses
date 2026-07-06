import { useState } from 'react'
import { supabase } from '../lib/supabase'

type View = 'login' | 'forgot' | 'sent' | 'reset'

interface LoginScreenProps {
  isRecovery?: boolean
}

export function LoginScreen({ isRecovery }: LoginScreenProps) {
  const [view, setView] = useState<View>(isRecovery ? 'reset' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // isRecovery の変化（PASSWORD_RECOVERY イベント到着）でリセット画面に切り替える。
  // useEffect ではなくレンダー中の状態調整パターンで同期する。
  const [prevRecovery, setPrevRecovery] = useState(isRecovery)
  if (isRecovery !== prevRecovery) {
    setPrevRecovery(isRecovery)
    if (isRecovery) setView('reset')
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
    }

    setLoading(false)
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email)

    if (error) {
      setError(error.message)
    } else {
      setView('sent')
    }

    setLoading(false)
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
    } else {
      await supabase.auth.signOut()
      setView('login')
    }

    setLoading(false)
  }

  if (view === 'forgot') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-sm w-full max-w-sm px-6 py-8">
          <h1 className="text-xl font-bold text-gray-800 mb-6 text-center">パスワードリセット</h1>

          <form onSubmit={handleForgot} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="email">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow-sm transition"
            >
              {loading ? '送信中…' : 'リセットメールを送信'}
            </button>
          </form>

          <p className="text-center mt-4">
            <button
              type="button"
              onClick={() => { setError(null); setView('login') }}
              className="text-xs text-indigo-500 hover:text-indigo-700 transition"
            >
              戻る
            </button>
          </p>
        </div>
      </div>
    )
  }

  if (view === 'sent') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-sm w-full max-w-sm px-6 py-8">
          <h1 className="text-xl font-bold text-gray-800 mb-6 text-center">メールを送信しました</h1>

          <p className="text-sm text-gray-600 text-center mb-6">
            確認メールを送信しました。メール内のリンクからパスワードをリセットしてください。
          </p>

          <p className="text-center">
            <button
              type="button"
              onClick={() => { setError(null); setView('login') }}
              className="text-xs text-indigo-500 hover:text-indigo-700 transition"
            >
              ログイン画面に戻る
            </button>
          </p>
        </div>
      </div>
    )
  }

  if (view === 'reset') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-sm w-full max-w-sm px-6 py-8">
          <h1 className="text-xl font-bold text-gray-800 mb-6 text-center">新しいパスワードを設定</h1>

          <form onSubmit={handleReset} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="new-password">
                新しいパスワード
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="confirm-password">
                パスワード（確認）
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow-sm transition"
            >
              {loading ? '更新中…' : 'パスワードを更新'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-sm w-full max-w-sm px-6 py-8">
        <h1 className="text-xl font-bold text-gray-800 mb-6 text-center">家計管理</h1>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="email">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="password">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <p className="text-right mt-1">
              <button
                type="button"
                onClick={() => { setError(null); setView('forgot') }}
                className="text-xs text-indigo-500 hover:text-indigo-700 transition"
              >
                パスワードをお忘れですか？
              </button>
            </p>
          </div>

          {error && (
            <p className="text-red-400 text-xs text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow-sm transition"
          >
            {loading ? 'ログイン中…' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  )
}

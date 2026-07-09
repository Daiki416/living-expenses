import { supabase } from '../lib/supabase'

type Props = {
  onOpenTrend?: () => void
  onOpenHome?: () => void
  onOpenSettings: () => void
  settingsDisabled?: boolean
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export function HeaderActions({ onOpenTrend, onOpenHome, onOpenSettings, settingsDisabled = false, theme, onToggleTheme }: Props) {
  return (
    <div className="flex items-center gap-2">
      {onOpenHome && (
        <button
          onClick={onOpenHome}
          className="icon-btn text-xl"
          title="家計管理"
        >
          🏠
        </button>
      )}
      {onOpenTrend && (
        <button
          onClick={onOpenTrend}
          className="icon-btn text-xl"
          title="支出推移"
        >
          📊
        </button>
      )}
      <button
        onClick={onOpenSettings}
        disabled={settingsDisabled}
        className="icon-btn text-xl"
        title="設定"
      >
        ⚙
      </button>
      <button
        onClick={onToggleTheme}
        className="icon-btn text-xl"
        title={theme === 'dark' ? 'ライトモード' : 'ダークモード'}
        aria-label={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>
      <button
        onClick={() => supabase.auth.signOut()}
        className="icon-btn text-xs px-2 py-1 rounded border border-line hover:border-line-strong"
        title="ログアウト"
      >
        ログアウト
      </button>
    </div>
  )
}

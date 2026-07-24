import { supabase } from '../lib/supabase'
import type { Theme } from '../hooks/useTheme'

type Props = {
  onOpenTrend?: () => void
  onOpenHome?: () => void
  onOpenSettings: () => void
  settingsDisabled?: boolean
  theme: Theme
  onCycleTheme: () => void
}

const NEXT_THEME_LABEL: Record<Theme, string> = {
  light: 'ダークモードに切り替え',
  dark: 'ファンシーモードに切り替え',
  fancy: 'ライトモードに切り替え',
}

const NEXT_THEME_ICON: Record<Theme, string> = {
  light: '☾',
  dark: '🎀',
  fancy: '☀',
}

export function HeaderActions({ onOpenTrend, onOpenHome, onOpenSettings, settingsDisabled = false, theme, onCycleTheme }: Props) {
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
        onClick={() => window.location.reload()}
        className="icon-btn text-xl"
        title="表示を更新"
      >
        🔄
      </button>
      <button
        onClick={onOpenSettings}
        disabled={settingsDisabled}
        className="icon-btn text-xl"
        title="設定"
      >
        ⚙
      </button>
      <button
        onClick={onCycleTheme}
        className="icon-btn text-xl"
        title={NEXT_THEME_LABEL[theme]}
        aria-label={NEXT_THEME_LABEL[theme]}
      >
        {NEXT_THEME_ICON[theme]}
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

import { useState } from 'react'
import { computeAccountProjection } from '../lib/accountProjection'

type Props = {
  balance: number
  balanceAsOf: string | null
  expectedInflow: number
  nextCardDebit: number
  loading?: boolean
}

// YYYY-MM-DD を M/D に整形する。null は「未入力」。
function formatAsOf(asOf: string | null): string {
  if (!asOf) return '未入力'
  const [, m, d] = asOf.split('-')
  return `${Number(m)}/${Number(d)}`
}

export function AccountProjection({ balance, balanceAsOf, expectedInflow, nextCardDebit, loading }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { afterDebit, shortfall } = computeAccountProjection({ balance, expectedInflow, nextCardDebit })

  if (loading) {
    return (
      <div className="card px-4 py-2.5 mb-4">
        <p className="text-sm text-ink-4 text-center">計算中…</p>
      </div>
    )
  }

  return (
    <div className="card mb-4">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-2.5"
      >
        <span className="text-sm font-medium text-ink-2">引落後見込み</span>
        <span className={`text-base font-semibold tabular-nums ${shortfall ? 'text-red-500 dark:text-red-400' : 'text-ink'}`}>
          {shortfall && <span className="mr-1">⚠</span>}¥{afterDebit.toLocaleString()}
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-line space-y-1">
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span>残高（{formatAsOf(balanceAsOf)} 時点）</span>
            <span className="tabular-nums">¥{balance.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span>＋入金見込み</span>
            <span className="tabular-nums">¥{expectedInflow.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-ink-3">
            <span>−翌月引落</span>
            <span className="tabular-nums">¥{nextCardDebit.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  )
}

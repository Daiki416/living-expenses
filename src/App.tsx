import { useRef, useState } from 'react'
import { useTheme } from './hooks/useTheme'
import { useReceipts } from './hooks/useReceipts'
import { useMembers } from './hooks/useMembers'
import { useCategories } from './hooks/useCategories'
import { useCategoryRules } from './hooks/useCategoryRules'
import { useAuth } from './hooks/useAuth'
import { AddExpenseModal } from './components/AddExpenseModal'
import { EditExpenseModal } from './components/EditExpenseModal'
import { EditReceiptModal } from './components/EditReceiptModal'
import { SettingsModal } from './components/SettingsModal'
import { LoginScreen } from './components/LoginScreen'
import { ExpenseList } from './components/ExpenseList'
import { CategorySummary } from './components/CategorySummary'
import { MonthlyTrendView } from './components/MonthlyTrendView'
import { HeaderActions } from './components/HeaderActions'
import { FancyDecor } from './components/FancyDecor'
import type { Expense, ReceiptKind } from './lib/supabase'
import { deriveReceiptKind } from './lib/payment'
import { EXPENSE_KIND, EXPENSE_KIND_LABEL } from './config/classifications'

function todayYYYYMMDD() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function App() {
  const { session, initializing, isRecovery } = useAuth()

  if (initializing) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <p className="text-ink-4 text-sm">読み込み中…</p>
      </div>
    )
  }

  if (session === null || isRecovery) {
    return <LoginScreen isRecovery={isRecovery} />
  }

  return <AppMain />
}

function AppMain() {
  const { theme, cycleTheme } = useTheme()
  const now = new Date()
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [showTrend, setShowTrend] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [initialScanFiles, setInitialScanFiles] = useState<File[]>([])
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editingReceipt, setEditingReceipt] = useState<{ id: string; description: string; date: string; kind: ReceiptKind; paidByMemberId: string | null } | null>(null)
  const [reminderDismissed, setReminderDismissed] = useState(
    () => localStorage.getItem('reminderDismissedYM') === currentYM
  )
  const [reminderConfirming, setReminderConfirming] = useState(false)

  const { members, loading: membersLoading, error: membersError, addMember, deleteMember, updateMemberBudget } = useMembers()

  const prevMonthNum = now.getMonth() === 0 ? 12 : now.getMonth()
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const { categories, error: categoriesError, addCategory, addParentWithChild, deleteCategory, renameCategory, reorderCategory } = useCategories()
  const { rulesMap, upsertRule, deleteRule } = useCategoryRules()
  const { receipts, loading: expensesLoading, error: expensesError, addReceiptGroup, updateExpense, deleteReceipt, updateReceipt } = useReceipts(year, month)
  const { receipts: prevMonthReceipts, loading: prevMonthLoading } = useReceipts(prevYear, prevMonthNum)

  const advanceReceipts = receipts.filter(r => r.kind === EXPENSE_KIND.ADVANCE)
  const cardReceipts = receipts.filter(r => r.kind === EXPENSE_KIND.CARD)
  const expenses = advanceReceipts.flatMap(r => r.expenses)
  const cardExpenses = cardReceipts.flatMap(r => r.expenses)

  const memberNames = members.map((m) => m.name)
  const memberNameById = new Map(members.map(m => [m.id, m.name]))

  const prevMonthMemberTotals: Record<string, number> = {}
  prevMonthReceipts.filter(r => r.kind === EXPENSE_KIND.ADVANCE).forEach(r => {
    const name = r.paid_by_member_id ? memberNameById.get(r.paid_by_member_id) : undefined
    if (!name) return
    const sum = r.expenses.reduce((s, e) => s + e.amount, 0)
    prevMonthMemberTotals[name] = (prevMonthMemberTotals[name] ?? 0) + sum
  })

  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0)
  const memberTotals: Record<string, number> = Object.fromEntries(memberNames.map(n => [n, 0]))
  advanceReceipts.forEach(r => {
    const name = r.paid_by_member_id ? memberNameById.get(r.paid_by_member_id) : undefined
    if (name && name in memberTotals) {
      memberTotals[name] += r.expenses.reduce((s, e) => s + e.amount, 0)
    }
  })

  const cardTotal = cardExpenses.reduce((s, e) => s + e.amount, 0)
  const grandTotal = expenseTotal + cardTotal

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  return (
    <>
      {theme === 'fancy' && <FancyDecor />}
      {showTrend ? (
        <MonthlyTrendView
          categories={categories}
          onClose={() => setShowTrend(false)}
          theme={theme}
          onCycleTheme={cycleTheme}
          onOpenSettings={() => setShowSettings(true)}
        />
      ) : (
        <div className="min-h-screen bg-transparent">
          <div className="max-w-xl mx-auto px-4 py-6">

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-bold text-ink">家計管理</h1>
              <HeaderActions
                onOpenTrend={() => setShowTrend(true)}
                onOpenSettings={() => setShowSettings(true)}
                settingsDisabled={membersLoading}
                theme={theme}
                onCycleTheme={cycleTheme}
              />
            </div>

        {membersError && (
          <p className="text-red-400 text-xs text-center mb-2">{membersError}</p>
        )}
        {categoriesError && (
          <p className="text-red-400 text-xs text-center mb-2">{categoriesError}</p>
        )}

        {/* 月初清算リマインダー */}
        {now.getDate() <= 3 && !reminderDismissed && (
          <div className="bg-amber-50 border border-amber-300 text-amber-700 dark:bg-amber-400/10 dark:border-amber-400/30 dark:text-amber-200 rounded-xl px-4 py-2.5 mb-3">
            {reminderConfirming ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">生活費の振り込みは済ませましたか？</span>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => { localStorage.setItem('reminderDismissedYM', currentYM); setReminderDismissed(true); setReminderConfirming(false) }}
                    className="text-xs font-medium bg-amber-500 text-white px-3 py-1 rounded-lg hover:bg-amber-600 transition-colors"
                  >
                    はい
                  </button>
                  <button
                    onClick={() => setReminderConfirming(false)}
                    className="text-xs font-medium border border-amber-400 text-amber-700 dark:text-amber-200 px-3 py-1 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-400/10 transition-colors"
                  >
                    いいえ
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium mb-1">月初になりました。今月の生活費振込をお忘れなく。</p>
                  {prevMonthLoading ? (
                    <p className="text-xs text-amber-600 dark:text-amber-300">計算中…</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {members
                        .filter(m => m.monthly_budget > 0)
                        .map(m => {
                          const prev = prevMonthMemberTotals[m.name] ?? 0
                          const due = Math.max(0, m.monthly_budget - prev)
                          return (
                            <li key={m.id} className="text-xs text-amber-700 dark:text-amber-200">
                              {m.name}: ¥{due.toLocaleString()}
                              {m.monthly_budget - prev < 0 && <span className="ml-1 text-amber-500 dark:text-amber-300">（{EXPENSE_KIND_LABEL.advance}超過）</span>}
                            </li>
                          )
                        })
                      }
                    </ul>
                  )}
                </div>
                <button
                  onClick={() => setReminderConfirming(true)}
                  className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 text-lg leading-none shrink-0 transition-colors"
                  aria-label="閉じる"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        )}

        {/* Month nav */}
        <div className="flex items-center justify-between card px-4 py-2.5 mb-4">
          <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-lg text-ink-4 hover:text-indigo-500 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/15 transition-colors text-xl leading-none">‹</button>
          <span className="text-base font-semibold text-ink tabular-nums">{year}年{month}月</span>
          <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-lg text-ink-4 hover:text-indigo-500 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/15 transition-colors text-xl leading-none">›</button>
        </div>

        {/* Category summary */}
        <CategorySummary
          expenses={expenses}
          cardExpenses={cardExpenses}
          memberTotals={memberTotals}
          categories={categories}
          receipts={receipts}
          memberNameById={memberNameById}
          onEditExpense={setEditingExpense}
          loading={expensesLoading}
        />

        {/* 支出セクション */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-2 uppercase tracking-wide">
              <span className="w-1 h-4 rounded-full bg-indigo-500"></span>明細
            </h2>
            <div className="flex items-center gap-2">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; setInitialScanFiles([f]); setShowAdd(true) }}
              />
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="btn-primary text-xs px-3 py-1.5 shadow-sm flex items-center gap-1"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                </svg>
                レシート
              </button>
              <button
                onClick={() => setShowAdd(true)}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                ＋追加
              </button>
            </div>
          </div>

          <div className="card px-5 py-4">
            {expensesLoading ? (
              <div className="text-center text-ink-4 py-8 text-sm">読み込み中…</div>
            ) : expensesError ? (
              <div className="text-center text-red-400 py-8 text-sm">エラー: {expensesError}</div>
            ) : (
              <ExpenseList
                receipts={receipts}
                categories={categories}
                memberNameById={memberNameById}
                onEdit={setEditingExpense}
                onDeleteReceipt={deleteReceipt}
                onEditReceipt={receiptId => {
                  const r = receipts.find(r => r.id === receiptId)
                  if (r) setEditingReceipt({ id: r.id, description: r.description, date: r.date, kind: r.kind, paidByMemberId: r.paid_by_member_id })
                }}
              />
            )}
          </div>
          {expensesLoading || grandTotal === 0 ? null : (
            <p className="text-xs text-ink-4 text-right mt-1 tabular-nums">合計 ¥{grandTotal.toLocaleString()}</p>
          )}
            </div>

          </div>
        </div>
      )}

      {showAdd && (
        <AddExpenseModal
          members={members}
          categories={categories}
          defaultDate={todayYYYYMMDD()}
          rulesMap={rulesMap}
          onUpsertRule={upsertRule}
          onDeleteRule={deleteRule}
          onAddGroup={(parent, children) =>
            addReceiptGroup(
              { date: parent.date, description: parent.description, kind: deriveReceiptKind(parent.paidByMemberId), paidByMemberId: parent.paidByMemberId },
              children.map(c => ({
                description: c.description,
                amount: c.amount,
                category_id: c.categoryId,
              }))
            )
          }
          initialFiles={initialScanFiles}
          onClose={() => { setShowAdd(false); setInitialScanFiles([]) }}
        />
      )}

      {editingExpense && (
        <EditExpenseModal
          expense={editingExpense}
          categories={categories}
          onUpdate={updateExpense}
          onUpsertRule={upsertRule}
          onDeleteRule={deleteRule}
          onClose={() => setEditingExpense(null)}
        />
      )}

      {editingReceipt && (
        <EditReceiptModal
          receiptId={editingReceipt.id}
          initialDescription={editingReceipt.description}
          initialDate={editingReceipt.date}
          initialKind={editingReceipt.kind}
          initialPaidByMemberId={editingReceipt.paidByMemberId}
          members={members}
          onUpdate={updateReceipt}
          onClose={() => setEditingReceipt(null)}
        />
      )}

      {showSettings && (
        <SettingsModal
          members={members}
          categories={categories}
          onAddMember={addMember}
          onDeleteMember={deleteMember}
          onUpdateMemberBudget={updateMemberBudget}
          onAddCategory={(name, parentId) => addCategory(name, parentId)}
          onAddParentWithChild={addParentWithChild}
          onDeleteCategory={deleteCategory}
          onRenameCategory={renameCategory}
          onReorderCategory={reorderCategory}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  )
}

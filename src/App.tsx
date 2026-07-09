import { useState } from 'react'
import { useTheme } from './hooks/useTheme'
import { useExpenses } from './hooks/useExpenses'
import { useMembers } from './hooks/useMembers'
import { useCategories } from './hooks/useCategories'
import { useCategoryRules } from './hooks/useCategoryRules'
import { useCardExpenses } from './hooks/useCardExpenses'
import { useAuth } from './hooks/useAuth'
import { AddExpenseModal } from './components/AddExpenseModal'
import { AddCardExpenseModal } from './components/AddCardExpenseModal'
import { EditExpenseModal } from './components/EditExpenseModal'
import { EditCardExpenseModal } from './components/EditCardExpenseModal'
import { EditReceiptModal } from './components/EditReceiptModal'
import { SettingsModal } from './components/SettingsModal'
import { LoginScreen } from './components/LoginScreen'
import { ExpenseList } from './components/ExpenseList'
import { CardExpenseList } from './components/CardExpenseList'
import { CategorySummary } from './components/CategorySummary'
import { MonthlyTrendView } from './components/MonthlyTrendView'
import { HeaderActions } from './components/HeaderActions'
import type { Expense, CardExpense } from './lib/supabase'
import { applyTax } from './lib/ocr'

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
  const { theme, toggleTheme } = useTheme()
  const now = new Date()
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [showTrend, setShowTrend] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showAddCard, setShowAddCard] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editingCardExpense, setEditingCardExpense] = useState<CardExpense | null>(null)
  const [editingReceipt, setEditingReceipt] = useState<{ id: string; description: string; date: string } | null>(null)
  const [reminderDismissed, setReminderDismissed] = useState(
    () => localStorage.getItem('reminderDismissedYM') === currentYM
  )
  const [reminderConfirming, setReminderConfirming] = useState(false)

  const { members, loading: membersLoading, error: membersError, addMember, deleteMember, updateMemberBudget } = useMembers()

  const prevMonthNum = now.getMonth() === 0 ? 12 : now.getMonth()
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const { categories, error: categoriesError, addCategory, deleteCategory, renameCategory, reorderCategory } = useCategories()
  const { rulesMap, upsertRule, deleteRule } = useCategoryRules()
  const { receipts, expenses, loading: expensesLoading, error: expensesError, addReceiptGroup, updateExpense, deleteReceipt, updateReceipt } = useExpenses(year, month)
  const { expenses: prevMonthExpenses, loading: prevMonthLoading } = useExpenses(prevYear, prevMonthNum)
  const { cardReceipts, cardExpenses, loading: cardLoading, error: cardError, addCardReceiptGroup, updateCardExpense, deleteCardReceipt, updateCardReceipt } = useCardExpenses(year, month)

  const memberNames = members.map((m) => m.name)

  const prevMonthMemberTotals: Record<string, number> = {}
  prevMonthExpenses.forEach(e => { prevMonthMemberTotals[e.paid_by] = (prevMonthMemberTotals[e.paid_by] ?? 0) + e.amount })

  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0)
  const memberTotals: Record<string, number> = Object.fromEntries(memberNames.map(n => [n, 0]))
  expenses.forEach(e => { if (e.paid_by in memberTotals) memberTotals[e.paid_by] += e.amount })

  const cardTotal = cardExpenses.reduce((s, e) => s + e.amount, 0)

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
      {showTrend ? (
        <MonthlyTrendView
          categories={categories}
          onClose={() => setShowTrend(false)}
          theme={theme}
          onToggleTheme={toggleTheme}
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
                onToggleTheme={toggleTheme}
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
                              {m.monthly_budget - prev < 0 && <span className="ml-1 text-amber-500 dark:text-amber-300">（立替超過）</span>}
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
          categories={categories}
          loading={expensesLoading || cardLoading}
        />

        {/* 立替セクション */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-2 uppercase tracking-wide">
              <span className="w-1 h-4 rounded-full bg-indigo-500"></span>立替
            </h2>
            <button
              onClick={() => setShowAdd(true)}
              className="btn-primary text-xs px-3 py-1.5 shadow-sm"
            >
              ＋ 追加
            </button>
          </div>

          {/* Per-member totals */}
          {memberNames.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              {memberNames.map(name => (
                <div key={name} className="bg-gradient-to-br from-indigo-50 to-indigo-100/70 border border-indigo-100 dark:from-indigo-500/10 dark:to-violet-500/10 dark:border-indigo-400/20 rounded-2xl px-4 py-3.5 text-center">
                  <div className="text-xs text-indigo-500 dark:text-indigo-300 font-medium mb-1">{name}</div>
                  <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-200 tabular-nums tracking-tight">¥{memberTotals[name].toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}

          <div className="card px-5 py-4">
            {expensesLoading ? (
              <div className="text-center text-ink-4 py-8 text-sm">読み込み中…</div>
            ) : expensesError ? (
              <div className="text-center text-red-400 py-8 text-sm">エラー: {expensesError}</div>
            ) : (
              <ExpenseList
                receipts={receipts}
                categories={categories}
                onEdit={setEditingExpense}
                onDeleteReceipt={deleteReceipt}
                onEditReceipt={receiptId => {
                  const r = receipts.find(r => r.id === receiptId)
                  if (r) setEditingReceipt({ id: r.id, description: r.description, date: r.date })
                }}
              />
            )}
          </div>
          {expensesLoading || expenseTotal === 0 ? null : (
            <p className="text-xs text-ink-4 text-right mt-1 tabular-nums">合計 ¥{expenseTotal.toLocaleString()}</p>
          )}
        </div>

        {/* クレカセクション */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-2 uppercase tracking-wide">
              <span className="w-1 h-4 rounded-full bg-indigo-500"></span>クレカ
            </h2>
            <button
              onClick={() => setShowAddCard(true)}
              className="btn-primary text-xs px-3 py-1.5 shadow-sm"
            >
              ＋ 追加
            </button>
          </div>

          <div className="card px-5 py-4">
            {cardLoading ? (
              <div className="text-center text-ink-4 py-8 text-sm">読み込み中…</div>
            ) : cardError ? (
              <div className="text-center text-red-400 py-8 text-sm">エラー: {cardError}</div>
            ) : (
              <CardExpenseList
                receipts={cardReceipts}
                categories={categories}
                onEdit={setEditingCardExpense}
                onDeleteReceipt={deleteCardReceipt}
                onEditReceipt={receiptId => {
                  const r = cardReceipts.find(r => r.id === receiptId)
                  if (r) setEditingReceipt({ id: r.id, description: r.description, date: r.date })
                }}
              />
            )}
          </div>
          {cardLoading || cardTotal === 0 ? null : (
            <p className="text-xs text-ink-4 text-right mt-1 tabular-nums">合計 ¥{cardTotal.toLocaleString()}</p>
          )}
            </div>

          </div>
        </div>
      )}

      {showAdd && (
        <AddExpenseModal
          members={memberNames}
          categories={categories}
          defaultDate={todayYYYYMMDD()}
          rulesMap={rulesMap}
          onUpsertRule={upsertRule}
          onDeleteRule={deleteRule}
          onAddGroup={(parent, children) =>
            addReceiptGroup(
              { date: parent.date, description: parent.description },
              children.map(c => ({
                paid_by: parent.paidBy,
                description: c.description,
                amount: applyTax(c.amount, c.taxRate),
                category_id: c.categoryId,
              }))
            )
          }
          onClose={() => setShowAdd(false)}
        />
      )}

      {showAddCard && (
        <AddCardExpenseModal
          categories={categories}
          defaultDate={todayYYYYMMDD()}
          rulesMap={rulesMap}
          onUpsertRule={upsertRule}
          onDeleteRule={deleteRule}
          onAddGroup={(parent, children) =>
            addCardReceiptGroup(
              { date: parent.date, description: parent.description },
              children.map(c => ({
                description: c.description,
                amount: applyTax(c.amount, c.taxRate),
                category_id: c.categoryId,
              }))
            )
          }
          onClose={() => setShowAddCard(false)}
        />
      )}

      {editingExpense && (
        <EditExpenseModal
          expense={editingExpense}
          members={memberNames}
          categories={categories}
          onUpdate={updateExpense}
          onUpsertRule={upsertRule}
          onDeleteRule={deleteRule}
          onClose={() => setEditingExpense(null)}
        />
      )}

      {editingCardExpense && (
        <EditCardExpenseModal
          cardExpense={editingCardExpense}
          categories={categories}
          onUpdate={updateCardExpense}
          onUpsertRule={upsertRule}
          onDeleteRule={deleteRule}
          onClose={() => setEditingCardExpense(null)}
        />
      )}

      {editingReceipt && (
        <EditReceiptModal
          receiptId={editingReceipt.id}
          initialDescription={editingReceipt.description}
          initialDate={editingReceipt.date}
          onUpdate={(id, input) => {
            const isCard = cardReceipts.some(r => r.id === id)
            return isCard ? updateCardReceipt(id, input) : updateReceipt(id, input)
          }}
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
          onDeleteCategory={deleteCategory}
          onRenameCategory={renameCategory}
          onReorderCategory={reorderCategory}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  )
}

import { useState } from 'react'
import { useExpenses } from './hooks/useExpenses'
import { useMembers } from './hooks/useMembers'
import { useCategories } from './hooks/useCategories'
import { useCardExpenses } from './hooks/useCardExpenses'
import { AddExpenseModal } from './components/AddExpenseModal'
import { AddCardExpenseModal } from './components/AddCardExpenseModal'
import { EditExpenseModal } from './components/EditExpenseModal'
import { EditCardExpenseModal } from './components/EditCardExpenseModal'
import { SettingsModal } from './components/SettingsModal'
import { ExpenseList } from './components/ExpenseList'
import { CardExpenseList } from './components/CardExpenseList'
import { CategorySummary } from './components/CategorySummary'
import type { Expense, CardExpense } from './lib/supabase'

function todayYYYYMMDD() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function App() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [showAdd, setShowAdd] = useState(false)
  const [showAddCard, setShowAddCard] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editingCardExpense, setEditingCardExpense] = useState<CardExpense | null>(null)

  const { members, loading: membersLoading, error: membersError, addMember, deleteMember } = useMembers()
  const { categories, error: categoriesError, addCategory, deleteCategory } = useCategories()
  const { expenses, loading: expensesLoading, error: expensesError, addExpense, updateExpense, deleteExpense } = useExpenses(year, month)
  const { cardExpenses, loading: cardLoading, error: cardError, addCardExpense, updateCardExpense, deleteCardExpense } = useCardExpenses(year, month)

  const memberNames = members.map((m) => m.name)

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800">家計管理</h1>
          <button
            onClick={() => setShowSettings(true)}
            disabled={membersLoading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-40 transition text-xl"
            title="設定"
          >
            ⚙
          </button>
        </div>

        {membersError && (
          <p className="text-red-400 text-xs text-center mb-2">{membersError}</p>
        )}
        {categoriesError && (
          <p className="text-red-400 text-xs text-center mb-2">{categoriesError}</p>
        )}

        {/* Month nav */}
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm px-5 py-3 mb-4">
          <button onClick={prevMonth} className="text-gray-400 hover:text-indigo-500 transition text-lg font-medium px-2">‹</button>
          <span className="font-semibold text-gray-700">{year}年{month}月</span>
          <button onClick={nextMonth} className="text-gray-400 hover:text-indigo-500 transition text-lg font-medium px-2">›</button>
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
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">立替</h2>
            <button
              onClick={() => setShowAdd(true)}
              className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm transition"
            >
              ＋ 追加
            </button>
          </div>

          {/* Per-member totals */}
          {memberNames.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              {memberNames.map(name => (
                <div key={name} className="bg-indigo-50 rounded-xl px-4 py-3 text-center">
                  <div className="text-xs text-indigo-500 font-medium mb-0.5">{name}</div>
                  <div className="text-lg font-semibold text-indigo-700">¥{memberTotals[name].toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm px-5 py-4">
            {expensesLoading ? (
              <div className="text-center text-gray-400 py-8 text-sm">読み込み中…</div>
            ) : expensesError ? (
              <div className="text-center text-red-400 py-8 text-sm">エラー: {expensesError}</div>
            ) : (
              <ExpenseList expenses={expenses} categories={categories} onEdit={setEditingExpense} onDelete={deleteExpense} />
            )}
          </div>
          {expensesLoading || expenseTotal === 0 ? null : (
            <p className="text-xs text-gray-400 text-right mt-1">合計 ¥{expenseTotal.toLocaleString()}</p>
          )}
        </div>

        {/* クレカセクション */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">クレカ</h2>
            <button
              onClick={() => setShowAddCard(true)}
              className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm transition"
            >
              ＋ 追加
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm px-5 py-4">
            {cardLoading ? (
              <div className="text-center text-gray-400 py-8 text-sm">読み込み中…</div>
            ) : cardError ? (
              <div className="text-center text-red-400 py-8 text-sm">エラー: {cardError}</div>
            ) : (
              <CardExpenseList cardExpenses={cardExpenses} categories={categories} onEdit={setEditingCardExpense} onDelete={deleteCardExpense} />
            )}
          </div>
          {cardLoading || cardTotal === 0 ? null : (
            <p className="text-xs text-gray-400 text-right mt-1">合計 ¥{cardTotal.toLocaleString()}</p>
          )}
        </div>

      </div>

      {showAdd && (
        <AddExpenseModal
          members={memberNames}
          categories={categories}
          defaultDate={todayYYYYMMDD()}
          onAdd={addExpense}
          onClose={() => setShowAdd(false)}
        />
      )}

      {showAddCard && (
        <AddCardExpenseModal
          categories={categories}
          defaultDate={todayYYYYMMDD()}
          onAdd={addCardExpense}
          onClose={() => setShowAddCard(false)}
        />
      )}

      {editingExpense && (
        <EditExpenseModal
          expense={editingExpense}
          members={memberNames}
          categories={categories}
          onUpdate={updateExpense}
          onClose={() => setEditingExpense(null)}
        />
      )}

      {editingCardExpense && (
        <EditCardExpenseModal
          cardExpense={editingCardExpense}
          categories={categories}
          onUpdate={updateCardExpense}
          onClose={() => setEditingCardExpense(null)}
        />
      )}

      {showSettings && (
        <SettingsModal
          members={members}
          categories={categories}
          onAddMember={addMember}
          onDeleteMember={deleteMember}
          onAddCategory={(name, parentId) => addCategory(name, parentId)}
          onDeleteCategory={deleteCategory}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

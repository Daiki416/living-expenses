import { useState } from 'react'
import { useExpenses } from './hooks/useExpenses'
import { useMembers } from './hooks/useMembers'
import { AddExpenseModal } from './components/AddExpenseModal'
import { SettingsModal } from './components/SettingsModal'
import { ExpenseList } from './components/ExpenseList'
import { ExpenseSummary } from './components/ExpenseSummary'

function todayYYYYMMDD() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function App() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [showAdd, setShowAdd] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const { members, setMembers } = useMembers()
  const { expenses, loading, error, addExpense, deleteExpense } = useExpenses(year, month)

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
          <h1 className="text-xl font-bold text-gray-800">立て替え管理</h1>
          <button
            onClick={() => setShowSettings(true)}
            className="text-gray-400 hover:text-gray-600 transition text-xl"
            title="設定"
          >
            ⚙
          </button>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm px-5 py-3 mb-4">
          <button
            onClick={prevMonth}
            className="text-gray-400 hover:text-indigo-500 transition text-lg font-medium px-2"
          >
            ‹
          </button>
          <span className="font-semibold text-gray-700">
            {year}年{month}月
          </span>
          <button
            onClick={nextMonth}
            className="text-gray-400 hover:text-indigo-500 transition text-lg font-medium px-2"
          >
            ›
          </button>
        </div>

        {/* Summary */}
        <ExpenseSummary expenses={expenses} members={members} />

        {/* Add button */}
        <div className="flex justify-end mt-5 mb-2">
          <button
            onClick={() => setShowAdd(true)}
            className="bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition"
          >
            ＋ 追加
          </button>
        </div>

        {/* Expense list */}
        <div className="bg-white rounded-xl shadow-sm px-5 py-4">
          {loading ? (
            <div className="text-center text-gray-400 py-10 text-sm">読み込み中…</div>
          ) : error ? (
            <div className="text-center text-red-400 py-10 text-sm">
              エラー: {error}
              <br />
              <span className="text-xs">.env ファイルの Supabase 設定を確認してください</span>
            </div>
          ) : (
            <ExpenseList expenses={expenses} onDelete={deleteExpense} />
          )}
        </div>
      </div>

      {showAdd && (
        <AddExpenseModal
          members={members}
          defaultDate={todayYYYYMMDD()}
          onAdd={addExpense}
          onClose={() => setShowAdd(false)}
        />
      )}

      {showSettings && (
        <SettingsModal
          members={members}
          onSave={setMembers}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

import { useState } from 'react'
import type { Member } from '../lib/supabase'

type Props = {
  members: Member[]
  onAdd: (name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}

export function SettingsModal({ members, onAdd, onDelete, onClose }: Props) {
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    setError(null)
    try {
      await onAdd(name)
      setNewName('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`「${name}」を削除しますか？\nこのメンバーの支出記録は残ります。`)) return
    setDeletingId(id)
    setError(null)
    try {
      await onDelete(id)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-800">メンバー管理</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden mb-4">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-3 py-2">
              <span className="text-sm text-gray-700">{m.name}</span>
              <button
                onClick={() => handleDelete(m.id, m.name)}
                disabled={deletingId === m.id}
                className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 transition"
              >
                {deletingId === m.id ? '削除中…' : '削除'}
              </button>
            </div>
          ))}
          {members.length === 0 && (
            <div className="px-3 py-3 text-sm text-gray-400 text-center">メンバーがいません</div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            placeholder="名前を入力"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
            className="bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 transition"
          >
            {adding ? '追加中…' : '追加'}
          </button>
        </div>

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
      </div>
    </div>
  )
}

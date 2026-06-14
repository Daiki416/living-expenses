import { useState } from 'react'
import type { Member, Category } from '../lib/supabase'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { ModalShell } from './ModalShell'

type Props = {
  members: Member[]
  categories: Category[]
  onAddMember: (name: string) => Promise<void>
  onDeleteMember: (id: string) => Promise<void>
  onAddCategory: (name: string) => Promise<void>
  onDeleteCategory: (id: string) => Promise<void>
  onClose: () => void
}

export function SettingsModal({ members, categories, onAddMember, onDeleteMember, onAddCategory, onDeleteCategory, onClose }: Props) {
  const [newMemberName, setNewMemberName] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null)

  const [newCategoryName, setNewCategoryName] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null)

  const [memberError, setMemberError] = useState<string | null>(null)
  const [categoryError, setCategoryError] = useState<string | null>(null)

  useEscapeKey(onClose)

  async function handleAddMember() {
    const name = newMemberName.trim()
    if (!name) return
    setAddingMember(true)
    setMemberError(null)
    try {
      await onAddMember(name)
      setNewMemberName('')
    } catch (err) {
      setMemberError((err as Error).message)
    } finally {
      setAddingMember(false)
    }
  }

  async function handleDeleteMember(id: string, name: string) {
    if (!window.confirm(`「${name}」を削除しますか？\nこのメンバーの支出記録は残ります。`)) return
    setDeletingMemberId(id)
    setMemberError(null)
    try {
      await onDeleteMember(id)
    } catch (err) {
      setMemberError((err as Error).message)
    } finally {
      setDeletingMemberId(null)
    }
  }

  async function handleAddCategory() {
    const name = newCategoryName.trim()
    if (!name) return
    setAddingCategory(true)
    setCategoryError(null)
    try {
      await onAddCategory(name)
      setNewCategoryName('')
    } catch (err) {
      setCategoryError((err as Error).message)
    } finally {
      setAddingCategory(false)
    }
  }

  async function handleDeleteCategory(id: string, name: string) {
    if (!window.confirm(`「${name}」を削除しますか？\nこのカテゴリーの支出は「未分類」になります。`)) return
    setDeletingCategoryId(id)
    setCategoryError(null)
    try {
      await onDeleteCategory(id)
    } catch (err) {
      setCategoryError((err as Error).message)
    } finally {
      setDeletingCategoryId(null)
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-gray-800">設定</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition text-xl leading-none"
        >
          ×
        </button>
      </div>

      {/* メンバー管理 */}
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">メンバー</p>
      <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden mb-3">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-3 py-2">
            <span className="text-sm text-gray-700">{m.name}</span>
            <button
              onClick={() => handleDeleteMember(m.id, m.name)}
              disabled={deletingMemberId === m.id}
              className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 transition"
            >
              {deletingMemberId === m.id ? '削除中…' : '削除'}
            </button>
          </div>
        ))}
        {members.length === 0 && (
          <div className="px-3 py-3 text-sm text-gray-400 text-center">メンバーがいません</div>
        )}
      </div>
      <div className="flex gap-2 mb-1">
        <input
          type="text"
          value={newMemberName}
          onChange={(e) => setNewMemberName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddMember() }}
          placeholder="名前を入力"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={handleAddMember}
          disabled={addingMember || !newMemberName.trim()}
          className="bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 transition"
        >
          {addingMember ? '追加中…' : '追加'}
        </button>
      </div>
      <div className="mb-6">
        {memberError && <p className="text-red-500 text-xs mt-1">{memberError}</p>}
      </div>

      {/* カテゴリー管理 */}
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">カテゴリー</p>
      <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden mb-3">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-3 py-2">
            <span className="text-sm text-gray-700">{c.name}</span>
            <button
              onClick={() => handleDeleteCategory(c.id, c.name)}
              disabled={deletingCategoryId === c.id}
              className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 transition"
            >
              {deletingCategoryId === c.id ? '削除中…' : '削除'}
            </button>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="px-3 py-3 text-sm text-gray-400 text-center">カテゴリーがありません</div>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory() }}
          placeholder="例：食費"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={handleAddCategory}
          disabled={addingCategory || !newCategoryName.trim()}
          className="bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 transition"
        >
          {addingCategory ? '追加中…' : '追加'}
        </button>
      </div>

      {categoryError && <p className="text-red-500 text-xs mt-2">{categoryError}</p>}
    </ModalShell>
  )
}

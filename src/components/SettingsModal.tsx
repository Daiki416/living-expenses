import { useEffect, useMemo, useState } from 'react'
import type { Member, Category } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { ModalShell } from './ModalShell'
import { toUserErrorMessage } from '../lib/validation'

type Tab = 'members' | 'categories' | 'password'

type Props = {
  members: Member[]
  categories: Category[]
  onAddMember: (name: string) => Promise<void>
  onDeleteMember: (id: string) => Promise<void>
  onUpdateMemberBudget: (id: string, budget: number) => Promise<void>
  onAddCategory: (name: string, parentId?: string | null) => Promise<void>
  onDeleteCategory: (id: string) => Promise<void>
  onClose: () => void
}

export function SettingsModal({ members, categories, onAddMember, onDeleteMember, onUpdateMemberBudget, onAddCategory, onDeleteCategory, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('members')

  const [newMemberName, setNewMemberName] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null)
  const [memberError, setMemberError] = useState<string | null>(null)
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({})
  const [savingBudgetId, setSavingBudgetId] = useState<string | null>(null)

  useEffect(() => {
    setBudgetDrafts(Object.fromEntries(members.map(m => [m.id, String(m.monthly_budget)])))
  }, [members])

  const [newParentName, setNewParentName] = useState('')
  const [addingParent, setAddingParent] = useState(false)
  const [newChildName, setNewChildName] = useState('')
  const [newChildParentId, setNewChildParentId] = useState('')
  const [addingChild, setAddingChild] = useState(false)
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null)
  const [categoryError, setCategoryError] = useState<string | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordChanging, setPasswordChanging] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  useEscapeKey(onClose)

  const { parentCategories, childrenByParentId } = useMemo(() => {
    const parentCategories = categories.filter(c => c.parent_id === null)
    const childrenByParentId = new Map<string, Category[]>()
    for (const c of categories) {
      if (c.parent_id !== null) {
        const list = childrenByParentId.get(c.parent_id) ?? []
        list.push(c)
        childrenByParentId.set(c.parent_id, list)
      }
    }
    return { parentCategories, childrenByParentId }
  }, [categories])

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

  async function handleSaveBudget(id: string) {
    const raw = budgetDrafts[id] ?? ''
    const budget = Number(raw)
    if (!Number.isInteger(budget) || budget < 0) return
    const current = members.find(m => m.id === id)?.monthly_budget ?? 0
    if (budget === current) return
    setSavingBudgetId(id)
    setMemberError(null)
    try {
      await onUpdateMemberBudget(id, budget)
    } catch (err) {
      setMemberError((err as Error).message)
    } finally {
      setSavingBudgetId(null)
    }
  }

  async function handleAddCategory(
    name: string,
    parentId: string | null,
    onSuccess: () => void,
    setAdding: (isAdding: boolean) => void
  ) {
    if (!name || name.length > 100) return
    setAdding(true)
    setCategoryError(null)
    try {
      await onAddCategory(name, parentId)
      onSuccess()
    } catch (err) {
      setCategoryError(toUserErrorMessage(err))
    } finally {
      setAdding(false)
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      setPasswordError('6文字以上で入力してください')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('パスワードが一致しません')
      return
    }
    setPasswordChanging(true)
    setPasswordError(null)
    setPasswordSuccess(false)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setPasswordError(error.message)
      } else {
        setNewPassword('')
        setConfirmPassword('')
        setPasswordSuccess(true)
      }
    } finally {
      setPasswordChanging(false)
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
    <ModalShell onClose={onClose} className="max-h-[90dvh] flex flex-col">
      {/* ヘッダー・タブ：常に表示 */}
      <div className="shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">設定</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition text-xl leading-none">×</button>
        </div>
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => setTab('members')}
            className={`flex-1 py-2 text-sm font-medium transition ${tab === 'members' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            メンバー
          </button>
          <button
            onClick={() => setTab('categories')}
            className={`flex-1 py-2 text-sm font-medium transition ${tab === 'categories' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            カテゴリー
          </button>
          <button
            onClick={() => setTab('password')}
            className={`flex-1 py-2 text-sm font-medium transition ${tab === 'password' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            パスワード
          </button>
        </div>
      </div>

      {tab === 'members' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* リスト：スクロール */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden mb-3">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2 gap-2">
                  <span className="text-sm text-gray-700 shrink-0">{m.name}</span>
                  <div className="flex items-center gap-1 flex-1 justify-end">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={budgetDrafts[m.id] ?? ''}
                      onChange={e => setBudgetDrafts(prev => ({ ...prev, [m.id]: e.target.value }))}
                      onBlur={() => handleSaveBudget(m.id)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveBudget(m.id) }}
                      disabled={savingBudgetId === m.id}
                      placeholder="振込額"
                      className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                    />
                    <span className="text-xs text-gray-500 shrink-0">円</span>
                    <button
                      onClick={() => handleDeleteMember(m.id, m.name)}
                      disabled={deletingMemberId === m.id}
                      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 transition ml-2"
                    >
                      {deletingMemberId === m.id ? '削除中…' : '削除'}
                    </button>
                  </div>
                </div>
              ))}
              {members.length === 0 && (
                <div className="px-3 py-3 text-sm text-gray-400 text-center">メンバーがいません</div>
              )}
            </div>
          </div>
          {/* 追加フォーム：常に表示 */}
          <div className="shrink-0 pt-1">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !addingMember && newMemberName.trim()) handleAddMember() }}
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
            {memberError && <p className="text-red-500 text-xs mt-2">{memberError}</p>}
          </div>
        </div>
      )}

      {tab === 'categories' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* リスト：スクロール */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden mb-3">
              {parentCategories.length === 0 && (
                <div className="px-3 py-3 text-sm text-gray-400 text-center">カテゴリーがありません</div>
              )}
              {parentCategories.map((parent) => {
                const children = childrenByParentId.get(parent.id) ?? []
                return (
                  <div key={parent.id}>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm font-medium text-gray-700">{parent.name}</span>
                      <button
                        onClick={() => handleDeleteCategory(parent.id, parent.name)}
                        disabled={deletingCategoryId === parent.id}
                        className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 transition"
                      >
                        {deletingCategoryId === parent.id ? '削除中…' : '削除'}
                      </button>
                    </div>
                    {children.map((child) => (
                      <div key={child.id} className="flex items-center justify-between pl-7 pr-3 py-1.5 bg-gray-50 border-t border-gray-100">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400 text-xs">└</span>
                          <span className="text-sm text-gray-600">{child.name}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteCategory(child.id, child.name)}
                          disabled={deletingCategoryId === child.id}
                          className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 transition"
                        >
                          {deletingCategoryId === child.id ? '削除中…' : '削除'}
                        </button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
          {/* 追加フォーム：常に表示 */}
          <div className="shrink-0 pt-1 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newParentName}
                onChange={(e) => setNewParentName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !addingParent && newParentName.trim()) {
                    handleAddCategory(newParentName.trim(), null, () => setNewParentName(''), setAddingParent)
                  }
                }}
                placeholder="大分類名（例：食費）"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                onClick={() => handleAddCategory(newParentName.trim(), null, () => setNewParentName(''), setAddingParent)}
                disabled={addingParent || !newParentName.trim()}
                className="bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 transition whitespace-nowrap"
              >
                {addingParent ? '追加中…' : '追加'}
              </button>
            </div>
            {parentCategories.length > 0 && (
              <>
                <select
                  value={newChildParentId}
                  onChange={(e) => setNewChildParentId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                >
                  <option value="">大分類を選択</option>
                  {parentCategories.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newChildName}
                    onChange={(e) => setNewChildName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !addingChild && newChildName.trim() && newChildParentId) {
                        handleAddCategory(newChildName.trim(), newChildParentId, () => setNewChildName(''), setAddingChild)
                      }
                    }}
                    placeholder="小分類名"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button
                    onClick={() => handleAddCategory(newChildName.trim(), newChildParentId, () => setNewChildName(''), setAddingChild)}
                    disabled={addingChild || !newChildName.trim() || !newChildParentId}
                    className="bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 transition whitespace-nowrap"
                  >
                    {addingChild ? '追加中…' : '追加'}
                  </button>
                </div>
              </>
            )}
            {categoryError && <p className="text-red-500 text-xs mt-2">{categoryError}</p>}
          </div>
        </div>
      )}

      {tab === 'password' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0 space-y-3">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="新しいパスワード"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="新しいパスワード（確認）"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              onClick={handleChangePassword}
              disabled={passwordChanging || !newPassword.trim()}
              className="w-full bg-indigo-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 transition"
            >
              {passwordChanging ? '変更中…' : '変更する'}
            </button>
            {passwordError && <p className="text-red-500 text-xs mt-2">{passwordError}</p>}
            {passwordSuccess && <p className="text-green-600 text-xs mt-2">パスワードを変更しました</p>}
          </div>
        </div>
      )}
    </ModalShell>
  )
}

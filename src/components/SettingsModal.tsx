import { useMemo, useRef, useState, type ReactNode } from 'react'
import type { Member, Category } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { ModalShell } from './ModalShell'
import { toUserErrorMessage } from '../lib/validation'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// 並べ替え可能な行。ドラッグは children に渡される handle にのみ効く。
function SortableRow({ id, className, children }: { id: string; className?: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  }
  const handle = (
    <button
      type="button"
      aria-label="並べ替え"
      className="text-ink-4 hover:text-ink-3 cursor-grab touch-none select-none px-1 leading-none"
      {...attributes}
      {...listeners}
    >
      ≡
    </button>
  )
  return (
    <div ref={setNodeRef} style={style} className={className}>
      {children(handle)}
    </div>
  )
}

type Tab = 'members' | 'categories' | 'password'

type Props = {
  members: Member[]
  categories: Category[]
  onAddMember: (name: string) => Promise<void>
  onDeleteMember: (id: string) => Promise<void>
  onUpdateMemberBudget: (id: string, budget: number) => Promise<void>
  onAddCategory: (name: string, parentId?: string | null) => Promise<void>
  onDeleteCategory: (id: string) => Promise<void>
  onRenameCategory: (id: string, name: string) => Promise<void>
  onReorderCategory: (orderedIds: string[]) => Promise<void>
  onClose: () => void
}

export function SettingsModal({ members, categories, onAddMember, onDeleteMember, onUpdateMemberBudget, onAddCategory, onDeleteCategory, onRenameCategory, onReorderCategory, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('members')

  const [newMemberName, setNewMemberName] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null)
  const [memberError, setMemberError] = useState<string | null>(null)
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>(
    () => Object.fromEntries(members.map(m => [m.id, String(m.monthly_budget)]))
  )
  const [savingBudgetId, setSavingBudgetId] = useState<string | null>(null)

  // members の再取得（追加・削除・振込額保存後）でドラフトを再シードする。
  // useEffect ではなくレンダー中の状態調整パターンで同期する。
  const [prevMembers, setPrevMembers] = useState(members)
  if (members !== prevMembers) {
    setPrevMembers(members)
    setBudgetDrafts(Object.fromEntries(members.map(m => [m.id, String(m.monthly_budget)])))
  }

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

  const { parentCategories, childrenByParentId, categoryById } = useMemo(() => {
    const parentCategories = categories.filter(c => c.parent_id === null)
    const childrenByParentId = new Map<string, Category[]>()
    const categoryById = new Map<string, Category>()
    for (const c of categories) {
      categoryById.set(c.id, c)
      if (c.parent_id !== null) {
        const list = childrenByParentId.get(c.parent_id) ?? []
        list.push(c)
        childrenByParentId.set(c.parent_id, list)
      }
    }
    return { parentCategories, childrenByParentId, categoryById }
  }, [categories])

  // 並べ替え用の楽観的ローカル順序。ドラッグ中のフリッカを避けるため props から保持する。
  const buildChildOrder = () => {
    const rec: Record<string, string[]> = {}
    for (const [pid, list] of childrenByParentId) rec[pid] = list.map(c => c.id)
    return rec
  }
  const [parentOrder, setParentOrder] = useState<string[]>(() => parentCategories.map(c => c.id))
  const [childOrder, setChildOrder] = useState<Record<string, string[]>>(buildChildOrder)

  // categories の再取得（追加・削除・並べ替え・名称変更後）で順序を再シードする。
  // budgetDrafts と同じくレンダー中の状態調整パターンで同期する。
  const [prevCategories, setPrevCategories] = useState(categories)
  if (categories !== prevCategories) {
    setPrevCategories(categories)
    setParentOrder(parentCategories.map(c => c.id))
    setChildOrder(buildChildOrder())
  }

  // インライン編集
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  // Escape によるキャンセル時、直後の blur が保存を発火させないよう抑止する。
  const canceledEditRef = useRef(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  async function handleParentDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = parentOrder.indexOf(active.id as string)
    const newIndex = parentOrder.indexOf(over.id as string)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(parentOrder, oldIndex, newIndex)
    const prev = parentOrder
    setParentOrder(next)
    setCategoryError(null)
    try {
      await onReorderCategory(next)
    } catch (err) {
      setCategoryError(toUserErrorMessage(err))
      setParentOrder(prev)
    }
  }

  async function handleChildDragEnd(parentId: string, e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const order = childOrder[parentId] ?? []
    const oldIndex = order.indexOf(active.id as string)
    const newIndex = order.indexOf(over.id as string)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(order, oldIndex, newIndex)
    setChildOrder(prev => ({ ...prev, [parentId]: next }))
    setCategoryError(null)
    try {
      await onReorderCategory(next)
    } catch (err) {
      setCategoryError(toUserErrorMessage(err))
      setChildOrder(prev => ({ ...prev, [parentId]: order }))
    }
  }

  function startEditCategory(id: string, name: string) {
    setEditingCategoryId(id)
    setEditDraft(name)
  }

  function cancelEditCategory() {
    canceledEditRef.current = true
    setEditingCategoryId(null)
    setEditDraft('')
  }

  async function handleRenameCategory(id: string) {
    if (canceledEditRef.current) {
      canceledEditRef.current = false
      return
    }
    const original = categoryById.get(id)?.name ?? ''
    const n = editDraft.trim()
    // 空・100超は編集破棄で表示に戻す。同一名は no-op。
    if (!n || n.length > 100 || n === original) {
      setEditingCategoryId(null)
      setEditDraft('')
      return
    }
    setCategoryError(null)
    try {
      await onRenameCategory(id, n)
      setEditingCategoryId(null)
      setEditDraft('')
    } catch (err) {
      setCategoryError(toUserErrorMessage(err))
    }
  }

  async function handleAddMember() {
    const name = newMemberName.trim()
    if (!name) return
    setAddingMember(true)
    setMemberError(null)
    try {
      await onAddMember(name)
      setNewMemberName('')
    } catch (err) {
      setMemberError(toUserErrorMessage(err))
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
      setMemberError(toUserErrorMessage(err))
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
      setMemberError(toUserErrorMessage(err))
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
      setCategoryError(toUserErrorMessage(err))
    } finally {
      setDeletingCategoryId(null)
    }
  }

  return (
    <ModalShell onClose={onClose} className="max-h-[90dvh] flex flex-col">
      {/* ヘッダー・タブ：常に表示 */}
      <div className="shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">設定</h2>
          <button onClick={onClose} className="icon-btn text-xl leading-none">×</button>
        </div>
        <div className="flex border-b border-line mb-4">
          <button
            onClick={() => setTab('members')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'members' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-300' : 'text-ink-3 hover:text-ink-2'}`}
          >
            メンバー
          </button>
          <button
            onClick={() => setTab('categories')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'categories' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-300' : 'text-ink-3 hover:text-ink-2'}`}
          >
            カテゴリー
          </button>
          <button
            onClick={() => setTab('password')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${tab === 'password' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-300' : 'text-ink-3 hover:text-ink-2'}`}
          >
            パスワード
          </button>
        </div>
      </div>

      {tab === 'members' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* リスト：スクロール */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="divide-y divide-line border border-line rounded-lg overflow-hidden mb-3">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2 gap-2">
                  <span className="text-sm text-ink-2 shrink-0">{m.name}</span>
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
                      className="field-input w-24 px-2 py-1 text-sm text-right disabled:opacity-50"
                    />
                    <span className="text-xs text-ink-3 shrink-0">円</span>
                    <button
                      onClick={() => handleDeleteMember(m.id, m.name)}
                      disabled={deletingMemberId === m.id}
                      className="btn-danger text-xs ml-2"
                    >
                      {deletingMemberId === m.id ? '削除中…' : '削除'}
                    </button>
                  </div>
                </div>
              ))}
              {members.length === 0 && (
                <div className="px-3 py-3 text-sm text-ink-4 text-center">メンバーがいません</div>
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
                className="field-input flex-1"
              />
              <button
                onClick={handleAddMember}
                disabled={addingMember || !newMemberName.trim()}
                className="btn-primary px-4 py-2"
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
            <div className="divide-y divide-line border border-line rounded-lg overflow-hidden mb-3">
              {parentCategories.length === 0 && (
                <div className="px-3 py-3 text-sm text-ink-4 text-center">カテゴリーがありません</div>
              )}
              {/* 親リスト：親同士のみ並べ替え可能 */}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleParentDragEnd}>
                <SortableContext items={parentOrder} strategy={verticalListSortingStrategy}>
                  {parentOrder.map((parentId) => {
                    const parent = categoryById.get(parentId)
                    if (!parent) return null
                    const childIds = childOrder[parent.id] ?? []
                    return (
                      <SortableRow key={parent.id} id={parent.id} className="bg-surface">
                        {(handle) => (
                          <>
                            <div className="flex items-center justify-between px-3 py-2 gap-2">
                              <div className="flex items-center gap-1 flex-1 min-w-0">
                                {handle}
                                {editingCategoryId === parent.id ? (
                                  <input
                                    type="text"
                                    autoFocus
                                    value={editDraft}
                                    onChange={(e) => setEditDraft(e.target.value)}
                                    onBlur={() => handleRenameCategory(parent.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') { e.preventDefault(); handleRenameCategory(parent.id) }
                                      else if (e.key === 'Escape') { e.stopPropagation(); cancelEditCategory() }
                                    }}
                                    className="field-input flex-1 min-w-0 px-2 py-1 text-sm font-medium"
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startEditCategory(parent.id, parent.name)}
                                    className="text-sm font-medium text-ink-2 text-left truncate hover:text-indigo-600 transition-colors"
                                  >
                                    {parent.name}
                                  </button>
                                )}
                              </div>
                              <button
                                onClick={() => handleDeleteCategory(parent.id, parent.name)}
                                disabled={deletingCategoryId === parent.id}
                                className="btn-danger text-xs shrink-0"
                              >
                                {deletingCategoryId === parent.id ? '削除中…' : '削除'}
                              </button>
                            </div>
                            {/* 子リスト：同じ親の中でのみ並べ替え可能 */}
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleChildDragEnd(parent.id, e)}>
                              <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
                                {childIds.map((childId) => {
                                  const child = categoryById.get(childId)
                                  if (!child) return null
                                  return (
                                    <SortableRow key={child.id} id={child.id} className="flex items-center justify-between pl-7 pr-3 py-1.5 bg-inset border-t border-line gap-2">
                                      {(childHandle) => (
                                        <>
                                          <div className="flex items-center gap-1 flex-1 min-w-0">
                                            {childHandle}
                                            <span className="text-ink-4 text-xs">└</span>
                                            {editingCategoryId === child.id ? (
                                              <input
                                                type="text"
                                                autoFocus
                                                value={editDraft}
                                                onChange={(e) => setEditDraft(e.target.value)}
                                                onBlur={() => handleRenameCategory(child.id)}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') { e.preventDefault(); handleRenameCategory(child.id) }
                                                  else if (e.key === 'Escape') { e.stopPropagation(); cancelEditCategory() }
                                                }}
                                                className="field-input flex-1 min-w-0 px-2 py-1 text-sm"
                                              />
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => startEditCategory(child.id, child.name)}
                                                className="text-sm text-ink-2 text-left truncate hover:text-indigo-600 transition-colors"
                                              >
                                                {child.name}
                                              </button>
                                            )}
                                          </div>
                                          <button
                                            onClick={() => handleDeleteCategory(child.id, child.name)}
                                            disabled={deletingCategoryId === child.id}
                                            className="btn-danger text-xs shrink-0"
                                          >
                                            {deletingCategoryId === child.id ? '削除中…' : '削除'}
                                          </button>
                                        </>
                                      )}
                                    </SortableRow>
                                  )
                                })}
                              </SortableContext>
                            </DndContext>
                          </>
                        )}
                      </SortableRow>
                    )
                  })}
                </SortableContext>
              </DndContext>
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
                className="field-input flex-1"
              />
              <button
                onClick={() => handleAddCategory(newParentName.trim(), null, () => setNewParentName(''), setAddingParent)}
                disabled={addingParent || !newParentName.trim()}
                className="btn-primary px-4 py-2 whitespace-nowrap"
              >
                {addingParent ? '追加中…' : '追加'}
              </button>
            </div>
            {parentCategories.length > 0 && (
              <>
                <select
                  value={newChildParentId}
                  onChange={(e) => setNewChildParentId(e.target.value)}
                  className="field-input"
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
                    className="field-input flex-1"
                  />
                  <button
                    onClick={() => handleAddCategory(newChildName.trim(), newChildParentId, () => setNewChildName(''), setAddingChild)}
                    disabled={addingChild || !newChildName.trim() || !newChildParentId}
                    className="btn-primary px-4 py-2 whitespace-nowrap"
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
              className="field-input"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="新しいパスワード（確認）"
              className="field-input"
            />
            <button
              onClick={handleChangePassword}
              disabled={passwordChanging || !newPassword.trim()}
              className="btn-primary w-full px-4 py-2"
            >
              {passwordChanging ? '変更中…' : '変更する'}
            </button>
            {passwordError && <p className="text-red-500 text-xs mt-2">{passwordError}</p>}
            {passwordSuccess && <p className="text-green-600 dark:text-emerald-400 text-xs mt-2">パスワードを変更しました</p>}
          </div>
        </div>
      )}
    </ModalShell>
  )
}

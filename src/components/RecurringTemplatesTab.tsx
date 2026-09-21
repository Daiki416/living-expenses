import { useState } from 'react'
import type { Category, Member, RecurringTemplateWithItems } from '../lib/supabase'
import { EXPENSE_KIND, EXPENSE_KIND_LABEL } from '../config/classifications'
import { MESSAGES } from '../config/messages'
import { toUserErrorMessage } from '../lib/validation'
import { resolveCategoryColor } from '../lib/categoryColors'
import { resolveCategoryLabel } from '../lib/format'
import { nextRegistrationDate, validateRecurringTemplate, stripEmptyRecurringItems, type RecurringTemplateInput } from '../lib/recurring'
import { jstDateParts } from '../lib/date'
import { CategoryPicker } from './CategoryPicker'

type ItemDraft = { description: string; amount: string; categoryId: string | null }

type Props = {
  members: Member[]
  categories: Category[]
  templates: RecurringTemplateWithItems[]
  loading: boolean
  loadError: string | null
  onAdd: (input: RecurringTemplateInput) => Promise<void>
  onUpdate: (id: string, input: RecurringTemplateInput) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onToggle: (id: string, active: boolean) => Promise<void>
}

function emptyItem(): ItemDraft {
  return { description: '', amount: '', categoryId: null }
}

export function RecurringTemplatesTab({ members, categories, templates, loading, loadError, onAdd, onUpdate, onDelete, onToggle }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [dayOfMonthDraft, setDayOfMonthDraft] = useState('1')
  const [paidByMemberId, setPaidByMemberId] = useState<string | null>(null)
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()])
  const [pickerItemIndex, setPickerItemIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function resetForm() {
    setEditingId(null)
    setDescription('')
    setDayOfMonthDraft('1')
    setPaidByMemberId(null)
    setItems([emptyItem()])
    setError(null)
  }

  function startEdit(t: RecurringTemplateWithItems) {
    setEditingId(t.id)
    setDescription(t.description)
    setDayOfMonthDraft(String(t.day_of_month))
    setPaidByMemberId(t.paid_by_member_id)
    const sorted = [...t.recurring_template_items].sort((a, b) => a.sort_order - b.sort_order)
    setItems(sorted.length > 0
      ? sorted.map(i => ({ description: i.description, amount: String(i.amount), categoryId: i.category_id }))
      : [emptyItem()])
    setError(null)
  }

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, ...patch } : it))
  }

  function addItemRow() {
    setItems(prev => [...prev, emptyItem()])
  }

  function removeItemRow(index: number) {
    setItems(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    const kind = paidByMemberId === null ? EXPENSE_KIND.CARD : EXPENSE_KIND.ADVANCE
    // 説明も金額も未入力の空行（末尾の追加行など）は検証前に除外する。
    const filledDrafts = stripEmptyRecurringItems(items)
    const input: RecurringTemplateInput = {
      description: description.trim(),
      kind,
      paidByMemberId,
      dayOfMonth: Number(dayOfMonthDraft),
      items: filledDrafts.map(it => ({
        description: it.description.trim(),
        amount: Number(it.amount),
        categoryId: it.categoryId,
      })),
    }
    const validation = validateRecurringTemplate(input, categories)
    if (!validation.ok) { setError(validation.message); return }
    setSaving(true)
    setError(null)
    try {
      if (editingId) {
        await onUpdate(editingId, input)
      } else {
        await onAdd(input)
      }
      resetForm()
    } catch (err) {
      setError(toUserErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(id: string, active: boolean) {
    setTogglingId(id)
    setError(null)
    try {
      await onToggle(id, active)
    } catch {
      setError(MESSAGES.recurring.saveFailed)
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`「${name || 'このテンプレート'}」を削除しますか？\n毎月の自動登録が停止します。`)) return
    if (editingId === id) resetForm()
    setDeletingId(id)
    setError(null)
    try {
      await onDelete(id)
    } catch {
      setError(MESSAGES.recurring.saveFailed)
    } finally {
      setDeletingId(null)
    }
  }

  const previewDay = Number(dayOfMonthDraft)
  const previewDate = Number.isInteger(previewDay) && previewDay >= 1 && previewDay <= 31
    ? nextRegistrationDate(previewDay, jstDateParts())
    : null

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* テンプレート一覧：スクロール */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="divide-y divide-line border border-line rounded-lg overflow-hidden mb-3">
          {loadError ? (
            <div className="px-3 py-3 text-sm text-red-500 text-center">{MESSAGES.recurring.loadFailed}</div>
          ) : loading ? (
            <div className="px-3 py-3 text-sm text-ink-4 text-center">{MESSAGES.recurring.loading}</div>
          ) : templates.length === 0 ? (
            <div className="px-3 py-3 text-sm text-ink-4 text-center">{MESSAGES.recurring.empty}</div>
          ) : templates.map((t) => {
            const total = t.recurring_template_items.reduce((sum, i) => sum + i.amount, 0)
            const memberName = t.paid_by_member_id
              ? members.find(m => m.id === t.paid_by_member_id)?.name ?? '（不明）'
              : EXPENSE_KIND_LABEL.card
            return (
              <div key={t.id} className={`px-3 py-2 ${t.active ? 'bg-surface' : 'bg-inset opacity-70'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink-2 truncate">{t.description}</span>
                      <span className="text-xs text-ink-4 shrink-0">毎月{t.day_of_month}日</span>
                    </div>
                    <div className="text-xs text-ink-3 mt-0.5">
                      {memberName}・{t.recurring_template_items.length}件・¥{total.toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <label className="flex items-center gap-1 text-xs text-ink-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={t.active}
                        disabled={togglingId === t.id}
                        onChange={(e) => handleToggle(t.id, e.target.checked)}
                        className="accent-indigo-500"
                      />
                      有効
                    </label>
                    <button
                      type="button"
                      onClick={() => startEdit(t)}
                      className="btn-secondary text-xs ml-1"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id, t.description)}
                      disabled={deletingId === t.id}
                      className="btn-danger text-xs"
                    >
                      {deletingId === t.id ? '削除中…' : '削除'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 追加/編集フォーム：常に表示 */}
      <div className="shrink-0 pt-1 space-y-3 border-t border-line mt-1">
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm font-medium text-ink-2">{editingId ? 'テンプレートを編集' : 'テンプレートを追加'}</span>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-xs text-ink-3 hover:text-ink-2">
              新規追加に戻る
            </button>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1">内容</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例：家賃"
            className="field-input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1">毎月の登録日</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={31}
              step={1}
              value={dayOfMonthDraft}
              onChange={(e) => setDayOfMonthDraft(e.target.value)}
              className="field-input w-24 px-2 py-1 text-sm text-right"
            />
            <span className="text-xs text-ink-3 shrink-0">日</span>
            {previewDate && (
              <span className="text-xs text-ink-4 ml-2">次回登録日: {previewDate}</span>
            )}
          </div>
          <p className="text-xs text-ink-4 mt-1">{MESSAGES.recurring.registrationNote}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-2 mb-2">支払い手段</label>
          <div className="flex flex-wrap gap-2">
            <label
              className={`px-4 py-1.5 rounded-full text-sm font-medium border cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-indigo-400 ${
                paidByMemberId === null
                  ? 'bg-indigo-500 border-indigo-500 text-white'
                  : 'border-line-strong text-ink-2 hover:bg-inset'
              }`}
            >
              <input
                type="radio"
                name="recurringPaidBy"
                checked={paidByMemberId === null}
                onChange={() => setPaidByMemberId(null)}
                className="sr-only"
              />
              {EXPENSE_KIND_LABEL.card}
            </label>
            {members.map((m) => (
              <label
                key={m.id}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-indigo-400 ${
                  paidByMemberId === m.id
                    ? 'bg-indigo-500 border-indigo-500 text-white'
                    : 'border-line-strong text-ink-2 hover:bg-inset'
                }`}
              >
                <input
                  type="radio"
                  name="recurringPaidBy"
                  value={m.id}
                  checked={paidByMemberId === m.id}
                  onChange={() => setPaidByMemberId(m.id)}
                  className="sr-only"
                />
                {m.name}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-2 mb-1">明細</label>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateItem(i, { description: e.target.value })}
                  placeholder="内容"
                  className="field-input flex-1 min-w-0 px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={item.amount}
                  onChange={(e) => updateItem(i, { amount: e.target.value })}
                  placeholder="金額"
                  className="field-input w-24 px-2 py-1 text-sm text-right"
                />
                <button
                  type="button"
                  onClick={() => setPickerItemIndex(i)}
                  className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-1 text-xs shrink-0 ${
                    resolveCategoryLabel(item.categoryId, categories) ? 'text-ink-2' : 'text-ink-4'
                  }`}
                >
                  <span className="cat-dot w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: resolveCategoryColor(item.categoryId, categories) ?? '#d1d5db' }} />
                  {resolveCategoryLabel(item.categoryId, categories) || '未分類'}
                </button>
                <button
                  type="button"
                  onClick={() => removeItemRow(i)}
                  disabled={items.length <= 1}
                  aria-label="明細を削除"
                  className="text-ink-4 hover:text-red-500 disabled:opacity-30 px-1 leading-none text-lg shrink-0"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addItemRow}
            className="w-full mt-2 border border-dashed border-line-strong text-ink-3 rounded-lg py-1.5 text-sm hover:bg-inset transition-colors"
          >
            ＋ 明細を追加
          </button>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full px-4 py-2"
        >
          {saving ? '保存中…' : editingId ? '更新する' : '追加する'}
        </button>
        {error && <p className="text-red-500 text-xs">{error}</p>}
      </div>

      {pickerItemIndex !== null && (
        <CategoryPicker
          categories={categories}
          selectedId={items[pickerItemIndex]?.categoryId ?? null}
          onSelect={(id) => { updateItem(pickerItemIndex, { categoryId: id }); setPickerItemIndex(null) }}
          onClose={() => setPickerItemIndex(null)}
        />
      )}
    </div>
  )
}

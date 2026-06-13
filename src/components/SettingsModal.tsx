import { useState } from 'react'

type Props = {
  members: [string, string]
  onSave: (members: [string, string]) => void
  onClose: () => void
}

export function SettingsModal({ members, onSave, onClose }: Props) {
  const [m1, setM1] = useState(members[0])
  const [m2, setM2] = useState(members[1])

  function handleSave() {
    const n1 = m1.trim() || 'メンバー1'
    const n2 = m2.trim() || 'メンバー2'
    onSave([n1, n2])
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-5">メンバー名の設定</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">メンバー1</label>
            <input
              type="text"
              value={m1}
              onChange={(e) => setM1(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="メンバー1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">メンバー2</label>
            <input
              type="text"
              value={m2}
              onChange={(e) => setM2(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="メンバー2"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-600 transition"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

import type { ReactNode } from 'react'

type Props = {
  onClose: () => void
  children: ReactNode
  className?: string
}

export function ModalShell({ onClose, children, className = '' }: Props) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className={`bg-white rounded-2xl shadow-[var(--shadow-modal)] p-6 w-full max-w-sm mx-4 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

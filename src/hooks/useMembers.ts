import { useState } from 'react'

const STORAGE_KEY = 'living-expenses-members'

type Members = [string, string]

function loadMembers(): Members {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length === 2) return parsed as Members
    }
  } catch {
    // ignore
  }
  return ['メンバー1', 'メンバー2']
}

export function useMembers() {
  const [members, setMembersState] = useState<Members>(loadMembers)

  function setMembers(next: Members) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setMembersState(next)
  }

  return { members, setMembers }
}

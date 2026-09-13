'use client'

import { create } from 'zustand'
import type {
  CompanyInfo,
  JournalEntry,
  Adjustment,
  JournalLeg,
  WorkbookRequest,
} from './accounting'
import { newEntry, newLeg, newAdjustment, entryBalanced } from './accounting'
import type { TemplateDef } from './accounting'
import { SAMPLE_DATA } from './sample-data'

interface Totals {
  totalDr: number
  totalCr: number
  unbalanced: number
  entryCount: number
}

interface DataSnapshot {
  company: CompanyInfo
  entries: JournalEntry[]
  adjustments: Adjustment[]
  accountOverrides: Record<string, string>
}

const MAX_HISTORY = 50
const COALESCE_MS = 800
const STORAGE_KEY = 'final-accounts-builder'

let _lastSnapshotTime = 0

function snapshotData(s: DataSnapshot): DataSnapshot {
  return {
    company: { ...s.company },
    entries: s.entries.map((e) => ({ ...e, legs: e.legs.map((l) => ({ ...l })) })),
    adjustments: s.adjustments.map((a) => ({ ...a })),
    accountOverrides: { ...s.accountOverrides },
  }
}

function loadFromStorage(): Partial<DataSnapshot> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return {
      company: parsed.company,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      adjustments: Array.isArray(parsed.adjustments) ? parsed.adjustments : [],
      accountOverrides: parsed.accountOverrides || {},
    }
  } catch {
    return null
  }
}

function saveToStorage(data: DataSnapshot) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* ignore */ }
}

interface AccountingState {
  company: CompanyInfo
  entries: JournalEntry[]
  adjustments: Adjustment[]
  accountOverrides: Record<string, string>
  isGenerating: boolean
  lastResult: {
    ok: boolean
    fileName?: string
    tbBalanced?: string
    bsBalanced?: string
    recalcErrors?: string
    accountsCount?: number
    assumptionsCount?: number
    error?: string
    trace?: string
  } | null
  _past: DataSnapshot[]
  _future: DataSnapshot[]

  setCompany: (patch: Partial<CompanyInfo>) => void
  addEntry: () => void
  duplicateEntry: (id: string) => void
  updateEntry: (id: string, patch: Partial<JournalEntry>) => void
  removeEntry: (id: string) => void
  addLeg: (entryId: string) => void
  updateLeg: (entryId: string, legIndex: number, patch: Partial<JournalLeg>) => void
  removeLeg: (entryId: string, legIndex: number) => void
  moveEntry: (id: string, dir: -1 | 1) => void
  addAdjustment: () => void
  updateAdjustment: (id: string, patch: Partial<Adjustment>) => void
  removeAdjustment: (id: string) => void
  setAccountOverride: (account: string, classification: string) => void
  clearAccountOverride: (account: string) => void
  addFromTemplate: (template: TemplateDef, amount: number, party?: string) => void
  appendEntries: (newEntries: JournalEntry[]) => void
  importSet: (data: WorkbookRequest) => void
  loadSample: () => void
  clearAll: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  setGenerating: (v: boolean) => void
  setResult: (r: AccountingState['lastResult']) => void
  pruneStaleOverrides: () => void
  asRequest: () => WorkbookRequest

  // UI state (not persisted)
  uiTab: string
  uiSearchQuery: string
  setUiTab: (tab: string) => void
  setUiSearchQuery: (q: string) => void
  drillDownToAccount: (accountName: string) => void
}

const defaultCompany: CompanyInfo = {
  name: '',
  financialYear: '2024-25',
  currency: 'NPR',
  yearEndDate: '31 March 2025',
}

// ─── Store creation — NO persist middleware, NO closures ────────────────────
// The store is created with all data fields AND all functions in a single
// flat object. This is the simplest possible pattern and avoids any closure
// or hydration issues that were causing functions to be lost.

export const useAccountingStore = create<AccountingState>()((set, get) => ({
  company: defaultCompany,
  entries: [],
  adjustments: [],
  accountOverrides: {},
  isGenerating: false,
  lastResult: null,
  _past: [],
  _future: [],
  uiTab: 'company',
  uiSearchQuery: '',

  setCompany: (patch) => {
    const s = get()
    const now = Date.now()
    const shouldSnap = (now - _lastSnapshotTime) > COALESCE_MS
    if (shouldSnap) {
      _lastSnapshotTime = now
      set({
        _past: [...s._past, snapshotData(s)].slice(-MAX_HISTORY),
        _future: [],
        company: { ...s.company, ...patch },
      })
    } else {
      set({ company: { ...s.company, ...patch } })
    }
  },

  addEntry: () => {
    const s = get()
    _lastSnapshotTime = Date.now()
    set({
      _past: [...s._past, snapshotData(s)].slice(-MAX_HISTORY),
      _future: [],
      entries: [...s.entries, newEntry()],
    })
  },

  duplicateEntry: (id) => {
    const s = get()
    const orig = s.entries.find((e) => e.id === id)
    if (!orig) return
    const copy: JournalEntry = {
      ...orig,
      id: `e_${Math.random().toString(36).slice(2, 9)}`,
      legs: orig.legs.map((l) => ({ ...l })),
    }
    const idx = s.entries.findIndex((e) => e.id === id)
    const arr = [...s.entries]
    arr.splice(idx + 1, 0, copy)
    _lastSnapshotTime = Date.now()
    set({
      _past: [...s._past, snapshotData(s)].slice(-MAX_HISTORY),
      _future: [],
      entries: arr,
    })
  },

  updateEntry: (id, patch) => {
    const s = get()
    const now = Date.now()
    const shouldSnap = (now - _lastSnapshotTime) > COALESCE_MS
    if (shouldSnap) {
      _lastSnapshotTime = now
      set({
        _past: [...s._past, snapshotData(s)].slice(-MAX_HISTORY),
        _future: [],
        entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      })
    } else {
      set({ entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) })
    }
  },

  removeEntry: (id) => {
    const s = get()
    _lastSnapshotTime = Date.now()
    set({
      _past: [...s._past, snapshotData(s)].slice(-MAX_HISTORY),
      _future: [],
      entries: s.entries.filter((e) => e.id !== id),
    })
  },

  addLeg: (entryId) => {
    const s = get()
    _lastSnapshotTime = Date.now()
    set({
      _past: [...s._past, snapshotData(s)].slice(-MAX_HISTORY),
      _future: [],
      entries: s.entries.map((e) =>
        e.id === entryId ? { ...e, legs: [...e.legs, newLeg()] } : e
      ),
    })
  },

  updateLeg: (entryId, legIndex, patch) => {
    const s = get()
    const now = Date.now()
    const shouldSnap = (now - _lastSnapshotTime) > COALESCE_MS
    const newEntries = s.entries.map((e) =>
      e.id === entryId
        ? { ...e, legs: e.legs.map((l, i) => (i === legIndex ? { ...l, ...patch } : l)) }
        : e
    )
    if (shouldSnap) {
      _lastSnapshotTime = now
      set({ _past: [...s._past, snapshotData(s)].slice(-MAX_HISTORY), _future: [], entries: newEntries })
    } else {
      set({ entries: newEntries })
    }
  },

  removeLeg: (entryId, legIndex) => {
    const s = get()
    _lastSnapshotTime = Date.now()
    set({
      _past: [...s._past, snapshotData(s)].slice(-MAX_HISTORY),
      _future: [],
      entries: s.entries.map((e) =>
        e.id === entryId ? { ...e, legs: e.legs.filter((_, i) => i !== legIndex) } : e
      ),
    })
  },

  moveEntry: (id, dir) => {
    const s = get()
    const idx = s.entries.findIndex((e) => e.id === id)
    if (idx < 0) return
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= s.entries.length) return
    const arr = [...s.entries]
    const [item] = arr.splice(idx, 1)
    arr.splice(newIdx, 0, item)
    _lastSnapshotTime = Date.now()
    set({
      _past: [...s._past, snapshotData(s)].slice(-MAX_HISTORY),
      _future: [],
      entries: arr,
    })
  },

  addAdjustment: () => {
    const s = get()
    _lastSnapshotTime = Date.now()
    set({
      _past: [...s._past, snapshotData(s)].slice(-MAX_HISTORY),
      _future: [],
      adjustments: [...s.adjustments, newAdjustment()],
    })
  },

  updateAdjustment: (id, patch) => {
    const s = get()
    const now = Date.now()
    const shouldSnap = (now - _lastSnapshotTime) > COALESCE_MS
    if (shouldSnap) {
      _lastSnapshotTime = now
      set({
        _past: [...s._past, snapshotData(s)].slice(-MAX_HISTORY),
        _future: [],
        adjustments: s.adjustments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      })
    } else {
      set({ adjustments: s.adjustments.map((a) => (a.id === id ? { ...a, ...patch } : a)) })
    }
  },

  removeAdjustment: (id) => {
    const s = get()
    _lastSnapshotTime = Date.now()
    set({
      _past: [...s._past, snapshotData(s)].slice(-MAX_HISTORY),
      _future: [],
      adjustments: s.adjustments.filter((a) => a.id !== id),
    })
  },

  setAccountOverride: (account, classification) => {
    const s = get()
    _lastSnapshotTime = Date.now()
    set({
      _past: [...s._past, snapshotData(s)].slice(-MAX_HISTORY),
      _future: [],
      accountOverrides: { ...s.accountOverrides, [account]: classification },
      lastResult: null,
    })
  },

  clearAccountOverride: (account) => {
    const s = get()
    const next = { ...s.accountOverrides }
    delete next[account]
    _lastSnapshotTime = Date.now()
    set({
      _past: [...s._past, snapshotData(s)].slice(-MAX_HISTORY),
      _future: [],
      accountOverrides: next,
      lastResult: null,
    })
  },

  addFromTemplate: (template, amount, party) => {
    const s = get()
    const id = `e_${Math.random().toString(36).slice(2, 9)}`
    const fill = (acct: string) => acct.replace(/\{\{party\}\}/g, party || '').trim()
    const entry: JournalEntry = {
      id,
      date: new Date().toISOString().slice(0, 10),
      narration: template.label,
      legs: template.legs.map((l) => {
        const account = fill(l.account)
        const hasDebitKey = Object.prototype.hasOwnProperty.call(l, 'debit')
        const hasCreditKey = Object.prototype.hasOwnProperty.call(l, 'credit')
        return {
          account,
          debit: hasDebitKey ? amount : null,
          credit: hasCreditKey ? amount : null,
        }
      }),
    }
    _lastSnapshotTime = Date.now()
    set({
      _past: [...s._past, snapshotData(s)].slice(-MAX_HISTORY),
      _future: [],
      entries: [...s.entries, entry],
      lastResult: null,
    })
  },

  appendEntries: (newEntries) => {
    const s = get()
    _lastSnapshotTime = Date.now()
    set({
      _past: [...s._past, snapshotData(s)].slice(-MAX_HISTORY),
      _future: [],
      entries: [...s.entries, ...newEntries],
      lastResult: null,
    })
  },

  importSet: (data) => {
    const s = get()
    _lastSnapshotTime = Date.now()
    set({
      _past: [...s._past, snapshotData(s)].slice(-MAX_HISTORY),
      _future: [],
      company: { ...data.company },
      entries: data.entries.map((e) => ({ ...e, legs: e.legs.map((l) => ({ ...l })) })),
      adjustments: data.adjustments.map((a) => ({ ...a })),
      accountOverrides: {},
      lastResult: null,
    })
  },

  loadSample: () => {
    const s = get()
    _lastSnapshotTime = Date.now()
    set({
      _past: [...s._past, snapshotData(s)].slice(-MAX_HISTORY),
      _future: [],
      company: { ...SAMPLE_DATA.company },
      entries: SAMPLE_DATA.entries.map((e) => ({ ...e, legs: e.legs.map((l) => ({ ...l })) })),
      adjustments: SAMPLE_DATA.adjustments.map((a) => ({ ...a })),
      accountOverrides: {},
      lastResult: null,
    })
  },

  clearAll: () => {
    const s = get()
    _lastSnapshotTime = Date.now()
    set({
      _past: [...s._past, snapshotData(s)].slice(-MAX_HISTORY),
      _future: [],
      company: defaultCompany,
      entries: [],
      adjustments: [],
      accountOverrides: {},
      lastResult: null,
    })
  },

  undo: () => {
    const s = get()
    if (s._past.length === 0) return
    const previous = s._past[s._past.length - 1]
    const current = snapshotData(s)
    set({
      _past: s._past.slice(0, -1),
      _future: [...s._future, current].slice(-MAX_HISTORY),
      company: previous.company,
      entries: previous.entries,
      adjustments: previous.adjustments,
      accountOverrides: previous.accountOverrides,
      lastResult: null,
    })
    _lastSnapshotTime = Date.now()
  },

  redo: () => {
    const s = get()
    if (s._future.length === 0) return
    const next = s._future[s._future.length - 1]
    const current = snapshotData(s)
    set({
      _past: [...s._past, current].slice(-MAX_HISTORY),
      _future: s._future.slice(0, -1),
      company: next.company,
      entries: next.entries,
      adjustments: next.adjustments,
      accountOverrides: next.accountOverrides,
      lastResult: null,
    })
    _lastSnapshotTime = Date.now()
  },

  canUndo: () => get()._past.length > 0,
  canRedo: () => get()._future.length > 0,

  setGenerating: (v) => set({ isGenerating: v }),
  setResult: (r) => set({ lastResult: r }),

  pruneStaleOverrides: () => {
    const s = get()
    if (Object.keys(s.accountOverrides).length === 0) return
    const liveAccounts = new Set<string>()
    for (const e of s.entries) {
      for (const leg of e.legs) {
        const name = (leg.account || '').trim()
        if (name) liveAccounts.add(name)
      }
    }
    const pruned: Record<string, string> = {}
    let changed = false
    for (const [k, v] of Object.entries(s.accountOverrides)) {
      if (liveAccounts.has(k)) pruned[k] = v
      else changed = true
    }
    if (changed) set({ accountOverrides: pruned })
  },

  asRequest: () => {
    const s = get()
    return {
      company: s.company,
      entries: s.entries,
      adjustments: s.adjustments,
      accountOverrides: s.accountOverrides,
    }
  },

  setUiTab: (tab) => set({ uiTab: tab }),
  setUiSearchQuery: (q) => set({ uiSearchQuery: q }),
  drillDownToAccount: (accountName) => set({
    uiTab: 'transactions',
    uiSearchQuery: accountName,
  }),
}))

// ─── Manual localStorage hydration + persistence ─────────────────────────────
let _hydrated = false
let _saveScheduled = false

function hydrate() {
  if (_hydrated || typeof window === 'undefined') return
  _hydrated = true
  const stored = loadFromStorage()
  if (stored) {
    useAccountingStore.setState({
      company: stored.company || defaultCompany,
      entries: stored.entries || [],
      adjustments: stored.adjustments || [],
      accountOverrides: stored.accountOverrides || {},
    })
  }
}

useAccountingStore.subscribe(() => {
  if (typeof window === 'undefined' || _saveScheduled) return
  _saveScheduled = true
  queueMicrotask(() => {
    _saveScheduled = false
    const s = useAccountingStore.getState()
    saveToStorage({
      company: s.company,
      entries: s.entries,
      adjustments: s.adjustments,
      accountOverrides: s.accountOverrides,
    })
  })
})

hydrate()

export { useShallow } from 'zustand/react/shallow'

export function computeTotals(state: AccountingState): Totals {
  let totalDr = 0
  let totalCr = 0
  let unbalanced = 0
  for (const e of state.entries) {
    if (!entryBalanced(e)) unbalanced++
    for (const l of e.legs) {
      totalDr += Number(l.debit) || 0
      totalCr += Number(l.credit) || 0
    }
  }
  return { totalDr, totalCr, unbalanced, entryCount: state.entries.length }
}

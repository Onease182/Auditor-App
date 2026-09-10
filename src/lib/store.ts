'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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

interface AccountingState {
  company: CompanyInfo
  entries: JournalEntry[]
  adjustments: Adjustment[]
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
  } | null

  setCompany: (patch: Partial<CompanyInfo>) => void
  addEntry: () => void
  updateEntry: (id: string, patch: Partial<JournalEntry>) => void
  removeEntry: (id: string) => void
  addLeg: (entryId: string) => void
  updateLeg: (entryId: string, legIndex: number, patch: Partial<JournalLeg>) => void
  removeLeg: (entryId: string, legIndex: number) => void
  moveEntry: (id: string, dir: -1 | 1) => void

  addAdjustment: () => void
  updateAdjustment: (id: string, patch: Partial<Adjustment>) => void
  removeAdjustment: (id: string) => void

  addFromTemplate: (template: TemplateDef, amount: number, party?: string) => void
  appendEntries: (newEntries: JournalEntry[]) => void
  importSet: (data: WorkbookRequest) => void

  loadSample: () => void
  clearAll: () => void

  setGenerating: (v: boolean) => void
  setResult: (r: AccountingState['lastResult']) => void

  asRequest: () => WorkbookRequest
}

const defaultCompany: CompanyInfo = {
  name: '',
  financialYear: '2024-25',
  currency: 'NPR',
  yearEndDate: '31 March 2025',
}

export const useAccountingStore = create<AccountingState>()(
  persist(
    (set, get) => ({
      company: defaultCompany,
      entries: [],
      adjustments: [],
      isGenerating: false,
      lastResult: null,

      setCompany: (patch) =>
        set((s) => ({ company: { ...s.company, ...patch } })),

      addEntry: () =>
        set((s) => ({ entries: [...s.entries, newEntry()] })),

      updateEntry: (id, patch) =>
        set((s) => ({
          entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

      removeEntry: (id) =>
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),

      addLeg: (entryId) =>
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === entryId ? { ...e, legs: [...e.legs, newLeg()] } : e
          ),
        })),

      updateLeg: (entryId, legIndex, patch) =>
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === entryId
              ? {
                  ...e,
                  legs: e.legs.map((l, i) => (i === legIndex ? { ...l, ...patch } : l)),
                }
              : e
          ),
        })),

      removeLeg: (entryId, legIndex) =>
        set((s) => ({
          entries: s.entries.map((e) =>
            e.id === entryId
              ? { ...e, legs: e.legs.filter((_, i) => i !== legIndex) }
              : e
          ),
        })),

      moveEntry: (id, dir) =>
        set((s) => {
          const idx = s.entries.findIndex((e) => e.id === id)
          if (idx < 0) return s
          const newIdx = idx + dir
          if (newIdx < 0 || newIdx >= s.entries.length) return s
          const arr = [...s.entries]
          const [item] = arr.splice(idx, 1)
          arr.splice(newIdx, 0, item)
          return { entries: arr }
        }),

      addAdjustment: () =>
        set((s) => ({ adjustments: [...s.adjustments, newAdjustment()] })),

      updateAdjustment: (id, patch) =>
        set((s) => ({
          adjustments: s.adjustments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),

      removeAdjustment: (id) =>
        set((s) => ({ adjustments: s.adjustments.filter((a) => a.id !== id) })),

      addFromTemplate: (template, amount, party) =>
        set((s) => {
          const id = `e_${Math.random().toString(36).slice(2, 9)}`
          const fill = (acct: string) =>
            acct.replace(/\{\{party\}\}/g, party || '').trim()
          // In TEMPLATES each leg defines EITHER `debit: null` OR `credit: null`
          // (never both). Whichever key is present is the side to receive `amount`.
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
          return { entries: [...s.entries, entry], lastResult: null }
        }),

      appendEntries: (newEntries) =>
        set((s) => ({ entries: [...s.entries, ...newEntries], lastResult: null })),

      importSet: (data) =>
        set({
          company: { ...data.company },
          entries: data.entries.map((e) => ({ ...e, legs: e.legs.map((l) => ({ ...l })) })),
          adjustments: data.adjustments.map((a) => ({ ...a })),
          lastResult: null,
        }),

      loadSample: () =>
        set({
          company: { ...SAMPLE_DATA.company },
          entries: SAMPLE_DATA.entries.map((e) => ({ ...e, legs: e.legs.map((l) => ({ ...l })) })),
          adjustments: SAMPLE_DATA.adjustments.map((a) => ({ ...a })),
          lastResult: null,
        }),

      clearAll: () =>
        set({
          company: defaultCompany,
          entries: [],
          adjustments: [],
          lastResult: null,
        }),

      setGenerating: (v) => set({ isGenerating: v }),
      setResult: (r) => set({ lastResult: r }),

      asRequest: () => {
        const s = get()
        return {
          company: s.company,
          entries: s.entries,
          adjustments: s.adjustments,
        }
      },
    }),
    {
      name: 'final-accounts-builder',
      partialize: (s) => ({
        company: s.company,
        entries: s.entries,
        adjustments: s.adjustments,
      }),
    }
  )
)

// Convenience hook — returns derived totals with shallow comparison so the
// consumer does not re-render in an infinite loop (object identity changes
// every call without useShallow).
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

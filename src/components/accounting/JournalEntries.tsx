'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAccountingStore, computeTotals, useShallow } from '@/lib/store'
import { entryBalanced, entryTotals, fmtCurrency } from '@/lib/accounting'
import type { JournalEntry, JournalLeg } from '@/lib/accounting'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus, Trash2, ChevronUp, ChevronDown, BookOpen, AlertTriangle, CheckCircle2,
  Copy, GripVertical, ClipboardPaste, Lightbulb, Wand2, Sparkles, Search, X, ArrowLeft,
} from 'lucide-react'
import { QuickAddTemplates } from './QuickAddTemplates'
import { BulkPasteDialog } from './BulkPasteDialog'
import { ImportExportPanel } from './ImportExportPanel'
import { TrialBalancePreview } from './TrialBalancePreview'

const ACCOUNT_SUGGESTIONS = [
  'Cash in Hand', 'Bank A/c', 'Capital Account', 'Drawings',
  'Purchases', 'Sales', 'Purchase Returns', 'Sales Returns',
  'Opening Stock', 'Closing Stock',
  'Creditors - ', 'Debtors - ', 'Bills Payable', 'Bills Receivable',
  'Furniture & Fixtures', 'Machinery', 'Building', 'Land', 'Computer', 'Vehicle',
  'Loan (Long-term)', 'Bank Overdraft',
  'Rent Paid', 'Rent Received', 'Salary', 'Wages', 'Insurance', 'Stationery',
  'Postage', 'Telephone', 'Electricity', 'Advertisement', 'Repairs',
  'Discount Allowed', 'Discount Received', 'Commission Paid', 'Commission Received',
  'Interest Paid', 'Interest Received', 'Bank Charges', 'Depreciation',
  'Bad Debts', 'Provision for Doubtful Debts',
  'General Expenses', 'Administrative Expenses', 'Conveyance', 'Travelling',
]

interface EntryCardProps {
  entry: JournalEntry
  index: number
  total: number
}

function EntryCard({ entry, index, total }: EntryCardProps) {
  const updateEntry = useAccountingStore((s) => s.updateEntry)
  const removeEntry = useAccountingStore((s) => s.removeEntry)
  const duplicateEntry = useAccountingStore((s) => s.duplicateEntry)
  const addLeg = useAccountingStore((s) => s.addLeg)
  const updateLeg = useAccountingStore((s) => s.updateLeg)
  const removeLeg = useAccountingStore((s) => s.removeLeg)
  const moveEntry = useAccountingStore((s) => s.moveEntry)

  const balanced = entryBalanced(entry)
  const { dr, cr } = entryTotals(entry)
  const diff = dr - cr
  const currency = useAccountingStore((s) => s.company.currency)

  // Auto-balance suggestion: which side needs to increase, and by how much
  const suggestion = !balanced
    ? {
        side: diff > 0 ? 'credit' : 'debit',
        amount: Math.abs(diff),
      }
    : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
    >
      <Card className={`border-border/60 shadow-sm transition-shadow hover:shadow-md ${!balanced ? 'border-destructive/40 bg-destructive/[0.02]' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <GripVertical className="h-4 w-4" />
              Entry #{index + 1}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => duplicateEntry(entry.id)}
                title="Duplicate entry"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => moveEntry(entry.id, -1)}
                disabled={index === 0}
                title="Move up"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={() => moveEntry(entry.id, 1)}
                disabled={index === total - 1}
                title="Move down"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => removeEntry(entry.id)}
                title="Delete entry"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <Input
              type="date"
              value={entry.date}
              onChange={(e) => updateEntry(entry.id, { date: e.target.value })}
              className="bg-background"
            />
            <Input
              placeholder="Narration — e.g. Cash purchase of goods from Supplier A"
              value={entry.narration}
              onChange={(e) => updateEntry(entry.id, { narration: e.target.value })}
              className="bg-background"
            />
          </div>

          {/* Legs table */}
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <div className="grid grid-cols-[1fr_130px_130px_36px] gap-2 bg-muted/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <div>Account</div>
              <div className="text-right">Debit (Dr)</div>
              <div className="text-right">Credit (Cr)</div>
              <div></div>
            </div>
            <div className="divide-y divide-border/40">
              {entry.legs.map((leg, i) => (
                <LegRow
                  key={i}
                  leg={leg}
                  onChange={(patch) => updateLeg(entry.id, i, patch)}
                  onRemove={() => removeLeg(entry.id, i)}
                  canRemove={entry.legs.length > 2}
                />
              ))}
            </div>
            <div className="flex items-center justify-between gap-2 bg-muted/30 px-3 py-2">
              <Button
                variant="ghost" size="sm" className="h-7 text-xs"
                onClick={() => addLeg(entry.id)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add leg
              </Button>
              <div className="flex items-center gap-4 text-sm">
                <span className="font-mono text-muted-foreground">
                  Dr <span className="font-semibold text-foreground">{fmtCurrency(dr, currency)}</span>
                </span>
                <span className="font-mono text-muted-foreground">
                  Cr <span className="font-semibold text-foreground">{fmtCurrency(cr, currency)}</span>
                </span>
                {balanced ? (
                  <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Balanced
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Δ {fmtCurrency(Math.abs(dr - cr), currency)}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Validation suggestion when Dr ≠ Cr */}
          {suggestion && (
            <div className="flex items-center gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              <Lightbulb className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">
                Add <strong className="font-mono">{fmtCurrency(suggestion.amount, currency)}</strong> to the{' '}
                <strong>{suggestion.side === 'credit' ? 'Credit (Cr)' : 'Debit (Dr)'}</strong> side to balance this entry.
              </span>
              <Button
                variant="outline" size="sm" className="h-6 text-[11px] border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20"
                onClick={() => {
                  // Auto-balance: add the missing amount to the last empty leg,
                  // or create a new leg if none is empty.
                  const emptyLegIdx = entry.legs.findIndex(
                    (l) => !l.debit && !l.credit && l.account
                  )
                  if (emptyLegIdx >= 0) {
                    const patch = suggestion.side === 'credit'
                      ? { credit: suggestion.amount, debit: null }
                      : { debit: suggestion.amount, credit: null }
                    updateLeg(entry.id, emptyLegIdx, patch)
                  } else {
                    addLeg(entry.id)
                    // After adding, the new leg is at index entry.legs.length.
                    // Use a microtask to update it once it exists.
                    const newIdx = entry.legs.length
                    const patch = suggestion.side === 'credit'
                      ? { credit: suggestion.amount, debit: null }
                      : { debit: suggestion.amount, credit: null }
                    setTimeout(() => updateLeg(entry.id, newIdx, patch), 0)
                  }
                }}
              >
                <Wand2 className="h-3 w-3 mr-1" /> Auto-balance
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

interface LegRowProps {
  leg: JournalLeg
  onChange: (patch: Partial<JournalLeg>) => void
  onRemove: () => void
  canRemove: boolean
}

function LegRow({ leg, onChange, onRemove, canRemove }: LegRowProps) {
  return (
    <div className="grid grid-cols-[1fr_130px_130px_36px] gap-2 px-3 py-2 items-center bg-card">
      <Input
        list="account-suggestions"
        placeholder="Account name (e.g. Cash in Hand)"
        value={leg.account}
        onChange={(e) => onChange({ account: e.target.value })}
        className="h-8 bg-background"
      />
      <Input
        type="number"
        inputMode="decimal"
        step="0.01"
        placeholder="0.00"
        value={leg.debit ?? ''}
        onChange={(e) => onChange({ debit: e.target.value === '' ? null : Number(e.target.value), credit: null })}
        className="h-8 bg-background text-right font-mono"
      />
      <Input
        type="number"
        inputMode="decimal"
        step="0.01"
        placeholder="0.00"
        value={leg.credit ?? ''}
        onChange={(e) => onChange({ credit: e.target.value === '' ? null : Number(e.target.value), debit: null })}
        className="h-8 bg-background text-right font-mono"
      />
      <Button
        variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        disabled={!canRemove}
        title="Remove leg"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

export function JournalEntries() {
  const entries = useAccountingStore((s) => s.entries)
  const addEntry = useAccountingStore((s) => s.addEntry)
  const loadSample = useAccountingStore((s) => s.loadSample)
  const totals = useAccountingStore(useShallow(computeTotals))
  const currency = useAccountingStore((s) => s.company.currency)
  const search = useAccountingStore((s) => s.uiSearchQuery)
  const setSearch = useAccountingStore((s) => s.setUiSearchQuery)

  // Filter entries by search query (narration, account name, date, amount)
  const filtered = useMemo(() => {
    if (!search.trim()) return entries.map((e, i) => ({ entry: e, originalIndex: i }))
    const q = search.trim().toLowerCase()
    return entries
      .map((e, i) => ({ entry: e, originalIndex: i }))
      .filter(({ entry }) => {
        if (entry.narration.toLowerCase().includes(q)) return true
        if (entry.date.includes(q)) return true
        for (const leg of entry.legs) {
          if (leg.account.toLowerCase().includes(q)) return true
          if (leg.debit && String(leg.debit).includes(q)) return true
          if (leg.credit && String(leg.credit).includes(q)) return true
        }
        return false
      })
  }, [entries, search])

  return (
    <div className="space-y-4">
      <datalist id="account-suggestions">
        {ACCOUNT_SUGGESTIONS.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>

      {/* Toolbar */}
      <Card className="border-border/60 bg-muted/30">
        <CardContent className="py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="font-medium">{totals.entryCount} entries</span>
          </div>
          <div className="text-sm font-mono text-muted-foreground">
            Total Dr: <span className="font-semibold text-foreground">{fmtCurrency(totals.totalDr, currency)}</span>
          </div>
          <div className="text-sm font-mono text-muted-foreground">
            Total Cr: <span className="font-semibold text-foreground">{fmtCurrency(totals.totalCr, currency)}</span>
          </div>
          {totals.unbalanced > 0 ? (
            <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
              <AlertTriangle className="h-3 w-3 mr-1" /> {totals.unbalanced} unbalanced
            </Badge>
          ) : (
            totals.entryCount > 0 && (
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3 mr-1" /> All balanced
              </Badge>
            )
          )}
          <div className="ml-auto flex items-center gap-1.5 flex-wrap">
            <QuickAddTemplates />
            <BulkPasteDialog />
            <ImportExportPanel />
            <Button size="sm" onClick={addEntry}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Entry
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search bar */}
      {entries.length > 3 && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search entries by narration, account, date or amount…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {search && filtered.length !== entries.length && (
              <div className="absolute right-9 top-1/2 -translate-y-1/2 text-xs text-muted-foreground whitespace-nowrap">
                {filtered.length}/{entries.length}
              </div>
            )}
          </div>
          {/* Drill-down banner — shown when search is active (e.g. from Top Accounts click) */}
          {search && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs"
            >
              <Search className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span className="text-muted-foreground">
                Showing entries for <strong className="text-foreground">"{search}"</strong>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 text-xs"
                onClick={() => setSearch('')}
              >
                <X className="h-3 w-3 mr-1" /> Clear filter
              </Button>
              <span className="text-muted-foreground/40">·</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-primary"
                onClick={() => useAccountingStore.getState().setUiTab('generate')}
              >
                <ArrowLeft className="h-3 w-3 mr-1" /> Back to Generate
              </Button>
            </motion.div>
          )}
        </div>
      )}

      {/* Live Trial Balance Preview */}
      {totals.entryCount > 0 && <TrialBalancePreview />}

      {entries.length === 0 ? (
        <Card className="border-dashed border-border/70 bg-card/50">
          <CardContent className="py-14 px-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20 shadow-inner">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mt-5 text-base font-semibold text-foreground">
              No journal entries yet
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
              Start by adding your first transaction. Use{' '}
              <strong className="text-foreground">Quick Add</strong> for a common pattern,
              <strong className="text-foreground"> Bulk Paste</strong> to import from a
              spreadsheet, or write one from scratch.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" onClick={addEntry}>
                <Plus className="h-4 w-4 mr-1.5" /> Add your first entry
              </Button>
              <Button size="sm" variant="outline" onClick={loadSample}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5 text-amber-600" />
                Load Sample
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground/80">
              Tip: every entry must have matching Dr and Cr totals.
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-border/70">
          <CardContent className="py-12 text-center">
            <Search className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              No entries match <strong className="text-foreground">"{search}"</strong>.
            </p>
            <Button size="sm" variant="ghost" className="mt-3" onClick={() => setSearch('')}>
              Clear search
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ entry, originalIndex }) => (
            <EntryCard key={entry.id} entry={entry} index={originalIndex} total={entries.length} />
          ))}
        </div>
      )}
    </div>
  )
}

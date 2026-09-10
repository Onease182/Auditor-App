'use client'

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
  Copy, GripVertical,
} from 'lucide-react'

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
  const addLeg = useAccountingStore((s) => s.addLeg)
  const updateLeg = useAccountingStore((s) => s.updateLeg)
  const removeLeg = useAccountingStore((s) => s.removeLeg)
  const moveEntry = useAccountingStore((s) => s.moveEntry)

  const balanced = entryBalanced(entry)
  const { dr, cr } = entryTotals(entry)
  const currency = useAccountingStore((s) => s.company.currency)

  return (
    <Card className={`border-border/60 shadow-sm transition-colors ${!balanced ? 'border-destructive/40 bg-destructive/[0.02]' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <GripVertical className="h-4 w-4" />
            Entry #{index + 1}
          </div>
          <div className="ml-auto flex items-center gap-1">
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
      </CardContent>
    </Card>
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
  const totals = useAccountingStore(useShallow(computeTotals))
  const currency = useAccountingStore((s) => s.company.currency)

  return (
    <div className="space-y-4">
      <datalist id="account-suggestions">
        {ACCOUNT_SUGGESTIONS.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>

      <Card className="border-border/60 bg-muted/30">
        <CardContent className="py-3 flex flex-wrap items-center gap-4">
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
          <Button size="sm" className="ml-auto" onClick={addEntry}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Entry
          </Button>
        </CardContent>
      </Card>

      {entries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">
              No journal entries yet. Click <strong>Add Entry</strong> above, or use
              <strong> Load Sample Data</strong> in the header to try a worked example.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((e, i) => (
            <EntryCard key={e.id} entry={e} index={i} total={entries.length} />
          ))}
        </div>
      )}
    </div>
  )
}

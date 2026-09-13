'use client'

import { useState, useMemo } from 'react'
import { useAccountingStore } from '@/lib/store'
import { TEMPLATES, type TemplateDef, fmtCurrency } from '@/lib/accounting'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Zap, ArrowRight, Check, Clock } from 'lucide-react'
import { toast } from 'sonner'

const USAGE_KEY = 'qa-template-usage'

function loadUsage(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(USAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveUsage(u: Record<string, number>) {
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(u))
  } catch { /* ignore */ }
}

export function QuickAddTemplates() {
  const addFromTemplate = useAccountingStore((s) => s.addFromTemplate)
  const currency = useAccountingStore((s) => s.company.currency)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<TemplateDef | null>(null)
  const [amount, setAmount] = useState<string>('')
  const [party, setParty] = useState<string>('')
  const [justAdded, setJustAdded] = useState<string | null>(null)
  // Lazy init from localStorage — avoids the set-state-in-effect lint rule
  const [usage, setUsage] = useState<Record<string, number>>(() => loadUsage())

  // Top 3 most-used templates (by count)
  const recentTemplates = useMemo(() => {
    const sorted = Object.entries(usage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => TEMPLATES.find((t) => t.id === id))
      .filter(Boolean) as TemplateDef[]
    return sorted
  }, [usage])

  function reset() {
    setSelected(null)
    setAmount('')
    setParty('')
  }

  function handleAdd() {
    if (!selected) return
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (selected.legs.some((l) => l.account.includes('{{party}}')) && !party.trim()) {
      toast.error('This template needs a party name (supplier / customer / account)')
      return
    }
    addFromTemplate(selected, amt, party.trim() || undefined)
    toast.success(`Added: ${selected.label}`, {
      description: `${fmtCurrency(amt, currency)}${party ? ` · ${party}` : ''}`,
    })
    // Track usage
    const next = { ...loadUsage(), [selected.id]: (loadUsage()[selected.id] || 0) + 1 }
    saveUsage(next)
    setUsage(next)
    setJustAdded(selected.id)
    setTimeout(() => setJustAdded(null), 1200)
    reset()
  }

  function handleSelect(t: TemplateDef) {
    setSelected(t)
    // Pre-fill party hint for templates that need it
    if (!t.legs.some((l) => l.account.includes('{{party}}'))) {
      setParty('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Zap className="h-3.5 w-3.5 mr-1.5 text-amber-600" />
          Quick Add
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-600" />
            Quick-Add a Transaction
          </DialogTitle>
          <DialogDescription>
            Pick a common journal pattern, enter the amount (and party name where needed),
            and a balanced entry is inserted into your journal.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[1fr_280px]">
          {/* Template grid */}
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              1. Choose a template
            </Label>
            <ScrollArea className="h-[320px] pr-2">
              {recentTemplates.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400 font-semibold mb-1.5 px-1">
                    <Clock className="h-3 w-3" /> Most used
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {recentTemplates.map((t) => (
                      <TemplateButton
                        key={t.id}
                        t={t}
                        active={selected?.id === t.id}
                        done={justAdded === t.id}
                        count={usage[t.id]}
                        onClick={() => handleSelect(t)}
                      />
                    ))}
                  </div>
                  <div className="my-2 border-t border-border/40" />
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5 px-1">
                    All templates
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TEMPLATES.map((t) => (
                  <TemplateButton
                    key={t.id}
                    t={t}
                    active={selected?.id === t.id}
                    done={justAdded === t.id}
                    onClick={() => handleSelect(t)}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Detail panel */}
          <div className="border-l border-border/60 pl-4 sm:pl-4">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              2. Fill &amp; add
            </Label>
            {!selected ? (
              <div className="flex flex-col items-center justify-center h-[320px] text-center text-sm text-muted-foreground border border-dashed rounded-lg p-4">
                <Zap className="h-8 w-8 mb-2 text-muted-foreground/40" />
                Select a template to see its details.
              </div>
            ) : (
              <div className="space-y-3 h-[320px] flex flex-col">
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="text-lg">{selected.icon}</span>
                    {selected.label}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{selected.description}</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="qa-amount" className="text-xs">Amount ({currency})</Label>
                  <Input
                    id="qa-amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-background text-right font-mono"
                    autoFocus
                  />
                </div>

                {selected.legs.some((l) => l.account.includes('{{party}}')) && (
                  <div className="space-y-1.5">
                    <Label htmlFor="qa-party" className="text-xs">Party / Account name</Label>
                    <Input
                      id="qa-party"
                      placeholder="e.g. Supplier A, Customer X, Rent Paid"
                      value={party}
                      onChange={(e) => setParty(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                )}

                {/* Preview legs */}
                <div className="rounded-md border border-border/60 overflow-hidden">
                  <div className="bg-muted/50 px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Preview
                  </div>
                  <div className="divide-y divide-border/40">
                    {selected.legs.map((l, i) => {
                      const filled = l.account.replace(/\{\{party\}\}/g, party || '…')
                      return (
                        <div key={i} className="px-2 py-1.5 text-xs">
                          <div className="font-medium truncate">{filled}</div>
                          <div className="font-mono text-muted-foreground">
                            {Object.prototype.hasOwnProperty.call(l, 'debit') ? 'Dr' : 'Cr'}{' '}
                            {amount ? fmtCurrency(Number(amount), currency) : '—'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <Button onClick={handleAdd} className="mt-auto w-full">
                  <ArrowRight className="h-4 w-4 mr-1.5" />
                  Add to Journal
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TemplateButton({
  t, active, done, count, onClick,
}: {
  t: TemplateDef
  active: boolean
  done: boolean
  count?: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`group text-left rounded-lg border p-3 transition-all hover:shadow-sm relative ${
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
          : 'border-border/60 bg-card hover:border-primary/40'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg leading-none">{t.icon}</span>
        <span className="text-sm font-medium leading-tight">{t.label}</span>
        {done && <Check className="h-3.5 w-3.5 text-emerald-600 ml-auto" />}
        {count !== undefined && count > 0 && !done && (
          <span className="ml-auto inline-flex items-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 text-[9px] font-semibold">
            ×{count}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground leading-snug">{t.description}</p>
    </button>
  )
}

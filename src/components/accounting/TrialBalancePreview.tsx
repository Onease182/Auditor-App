'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAccountingStore } from '@/lib/store'
import {
  computeTrialBalancePreview, CLASS_LABELS, CLASS_COLORS,
  fmtCurrency, type AccountClass,
} from '@/lib/accounting'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Scale, CheckCircle2, ListTree, ShieldCheck, ShieldAlert, RotateCcw } from 'lucide-react'

const ALL_CLASSES: AccountClass[] = [
  'trading_dr', 'trading_cr', 'pl_dr', 'pl_cr',
  'bs_asset', 'bs_liab', 'capital', 'drawings',
]

export function TrialBalancePreview() {
  const entries = useAccountingStore((s) => s.entries)
  const currency = useAccountingStore((s) => s.company.currency)
  const accountOverrides = useAccountingStore((s) => s.accountOverrides)
  const pruneStaleOverrides = useAccountingStore((s) => s.pruneStaleOverrides)
  const setAccountOverride = useAccountingStore((s) => s.setAccountOverride)
  const clearAccountOverride = useAccountingStore((s) => s.clearAccountOverride)

  // Compute the raw preview (auto-classified)
  const rawRows = useMemo(() => computeTrialBalancePreview(entries), [entries])

  // Apply overrides to the classification shown
  const rows = useMemo(
    () => rawRows.map((r) => ({
      ...r,
      cls: (accountOverrides[r.name] as AccountClass) || r.cls,
      overridden: Boolean(accountOverrides[r.name]),
    })),
    [rawRows, accountOverrides]
  )

  // Detect stale overrides (overrides for accounts no longer in the journal)
  // and offer a cleanup button.
  const liveAccountSet = useMemo(
    () => new Set(rawRows.map((r) => r.name)),
    [rawRows]
  )
  const staleOverrides = useMemo(
    () => Object.keys(accountOverrides).filter((k) => !liveAccountSet.has(k)),
    [accountOverrides, liveAccountSet]
  )

  const totalDr = rows.reduce((s, r) => s + r.dr, 0)
  const totalCr = rows.reduce((s, r) => s + r.cr, 0)
  const balanced = Math.abs(totalDr - totalCr) < 0.005
  const hasData = rows.length > 0
  const overrideCount = rows.filter((r) => r.overridden).length

  // Group rows by classification (after overrides)
  const grouped = useMemo(() => {
    const groups: Record<AccountClass, typeof rows> = {
      trading_dr: [], trading_cr: [], pl_dr: [], pl_cr: [],
      bs_asset: [], bs_liab: [], capital: [], drawings: [],
    }
    for (const r of rows) groups[r.cls].push(r)
    return groups
  }, [rows])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-4 w-4 text-primary" />
            Live Trial Balance Preview
            {overrideCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/25 px-2 py-0.5 text-[10px] font-medium text-primary">
                {overrideCount} overridden
              </span>
            )}
            {staleOverrides.length > 0 && (
              <button
                onClick={() => pruneStaleOverrides()}
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                title={`${staleOverrides.length} override(s) for accounts no longer in the journal — click to clean up`}
              >
                <RotateCcw className="h-2.5 w-2.5" />
                {staleOverrides.length} stale
              </button>
            )}
          </CardTitle>
          <CardDescription>
            Auto-computed from your journal entries. Click a class badge to override
            the auto-classification if the keyword matcher guessed wrong — overrides
            are passed to the Python engine and reflected in the final accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasData ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 ring-1 ring-border/60">
                <ListTree className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Add at least one journal entry to see the Trial Balance preview.
              </p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[400px] rounded-md border border-border/60 scrollbar-slim">
                <div className="grid grid-cols-[1fr_auto_auto_140px] gap-x-2 bg-muted/70 backdrop-blur px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sticky top-0 z-10 border-b border-border/60 shadow-sm">
                  <div>Account</div>
                  <div className="text-right w-20">Debit</div>
                  <div className="text-right w-20">Credit</div>
                  <div className="text-center">Classification</div>
                </div>
                <div className="divide-y divide-border/40">
                  {rows.map((r) => (
                    <div key={r.name} className={`zebra-row grid grid-cols-[1fr_auto_auto_140px] gap-x-2 px-3 py-1.5 items-center text-xs transition-colors hover:bg-primary/5 ${r.overridden ? 'bg-primary/[0.04]' : ''}`}>
                      <div className="font-medium truncate" title={r.name}>
                        {r.name}
                        {r.overridden && (
                          <button
                            onClick={() => clearAccountOverride(r.name)}
                            className="ml-1.5 inline-flex items-center text-muted-foreground hover:text-foreground"
                            title="Reset to auto-classification"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <div className="text-right w-20 font-mono">{r.dr ? fmtCurrency(r.dr, currency) : '—'}</div>
                      <div className="text-right w-20 font-mono">{r.cr ? fmtCurrency(r.cr, currency) : '—'}</div>
                      <div className="w-[140px] flex justify-center">
                        <Select
                          value={r.cls}
                          onValueChange={(v) => setAccountOverride(r.name, v)}
                        >
                          <SelectTrigger className={`h-7 w-[130px] text-[10px] font-medium border ${CLASS_COLORS[r.cls]}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_CLASSES.map((c) => (
                              <SelectItem key={c} value={c} className="text-xs">
                                {CLASS_LABELS[c]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Totals row */}
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 px-3 py-2.5 rounded-md bg-primary/10 border border-primary/25 text-sm font-semibold">
                <div className="uppercase tracking-wide text-xs text-primary/80">Total</div>
                <div className="text-right w-20 font-mono">{fmtCurrency(totalDr, currency)}</div>
                <div className="text-right w-20 font-mono">{fmtCurrency(totalCr, currency)}</div>
              </div>

              {/* Balance check */}
              <div className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium ring-1 ${
                balanced
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30'
                  : 'bg-destructive/10 text-destructive dark:text-red-300 ring-destructive/30'
              }`}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  balanced
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : 'bg-destructive/20 text-destructive dark:text-red-300'
                }`}>
                  {balanced ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                  {balanced ? (
                    <>Trial Balance tallies — Dr total = Cr total.</>
                  ) : (
                    <>
                      Out of balance by{' '}
                      <span className="font-mono font-bold">{fmtCurrency(Math.abs(totalDr - totalCr), currency)}</span>{' '}
                      — fix your journal entries before generating.
                    </>
                  )}
                </div>
              </div>

              {/* Classification summary */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground mr-1">Accounts by class:</span>
                {(Object.keys(grouped) as AccountClass[]).map((cls) => {
                  const n = grouped[cls].length
                  if (n === 0) return null
                  return (
                    <span key={cls} className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${CLASS_COLORS[cls]}`}>
                      {CLASS_LABELS[cls]} · {n}
                    </span>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

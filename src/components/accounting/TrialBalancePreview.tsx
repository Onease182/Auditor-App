'use client'

import { useMemo } from 'react'
import { useAccountingStore } from '@/lib/store'
import {
  computeTrialBalancePreview, CLASS_LABELS, CLASS_COLORS,
  classifyAccount, fmtCurrency, type AccountClass,
} from '@/lib/accounting'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Scale, AlertTriangle, CheckCircle2, ListTree } from 'lucide-react'

export function TrialBalancePreview() {
  const entries = useAccountingStore((s) => s.entries)
  const currency = useAccountingStore((s) => s.company.currency)

  const rows = useMemo(() => computeTrialBalancePreview(entries), [entries])

  const totalDr = rows.reduce((s, r) => s + r.dr, 0)
  const totalCr = rows.reduce((s, r) => s + r.cr, 0)
  const balanced = Math.abs(totalDr - totalCr) < 0.005
  const hasData = rows.length > 0

  // Group rows by classification
  const grouped = useMemo(() => {
    const groups: Record<AccountClass, typeof rows> = {
      trading_dr: [], trading_cr: [], pl_dr: [], pl_cr: [],
      bs_asset: [], bs_liab: [], capital: [], drawings: [],
    }
    for (const r of rows) groups[r.cls].push(r)
    return groups
  }, [rows])

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="h-4 w-4 text-primary" />
          Live Trial Balance Preview
        </CardTitle>
        <CardDescription>
          Auto-computed from your journal entries — this is exactly what the
          workbook's Trial Balance sheet will show (pre-adjustment).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <ListTree className="h-10 w-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              Add at least one journal entry to see the Trial Balance preview.
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[360px] rounded-md border border-border/60">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 bg-muted/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sticky top-0">
                <div>Account</div>
                <div className="text-right w-24">Debit</div>
                <div className="text-right w-24">Credit</div>
                <div className="w-24 text-right">Class</div>
              </div>
              <div className="divide-y divide-border/40">
                {rows.map((r) => (
                  <div key={r.name} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-1.5 items-center text-xs hover:bg-muted/30">
                    <div className="font-medium truncate" title={r.name}>{r.name}</div>
                    <div className="text-right w-24 font-mono">{r.dr ? fmtCurrency(r.dr, currency) : '—'}</div>
                    <div className="text-right w-24 font-mono">{r.cr ? fmtCurrency(r.cr, currency) : '—'}</div>
                    <div className="w-24 text-right">
                      <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${CLASS_COLORS[r.cls]}`}>
                        {CLASS_LABELS[r.cls]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Totals row */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3 py-2 rounded-md bg-primary/5 border border-primary/20 text-sm font-semibold">
              <div>TOTAL</div>
              <div className="text-right w-24 font-mono">{fmtCurrency(totalDr, currency)}</div>
              <div className="text-right w-24 font-mono">{fmtCurrency(totalCr, currency)}</div>
            </div>

            {/* Balance check */}
            <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
              balanced
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : 'bg-destructive/10 text-destructive'
            }`}>
              {balanced ? (
                <><CheckCircle2 className="h-4 w-4" /> Trial Balance tallies — Dr total = Cr total.</>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  Out of balance by {fmtCurrency(Math.abs(totalDr - totalCr), currency)} — fix your journal entries before generating.
                </>
              )}
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
  )
}

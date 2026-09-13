'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useAccountingStore } from '@/lib/store'
import {
  computeTrialBalancePreview, classifyAccount, fmtCurrency,
  CLASS_LABELS, CLASS_COLORS, type AccountClass,
} from '@/lib/accounting'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BarChart3, ArrowUp, ArrowDown, Crown, ChevronRight, MousePointerClick } from 'lucide-react'

type SortMode = 'dr' | 'cr' | 'abs'

export function TopAccountsPanel() {
  const entries = useAccountingStore((s) => s.entries)
  const currency = useAccountingStore((s) => s.company.currency)
  const drillDownToAccount = useAccountingStore((s) => s.drillDownToAccount)
  const [sortMode, setSortMode] = useState<SortMode>('abs')
  const [limit, setLimit] = useState(8)

  const tbRows = useMemo(() => computeTrialBalancePreview(entries), [entries])

  const sorted = useMemo(() => {
    const rows = tbRows.map((r) => ({
      ...r,
      abs: Math.abs(r.net),
      cls: classifyAccount(r.name) as AccountClass,
    }))
    if (sortMode === 'dr') rows.sort((a, b) => b.dr - a.dr)
    else if (sortMode === 'cr') rows.sort((a, b) => b.cr - a.cr)
    else rows.sort((a, b) => b.abs - a.abs)
    return rows
  }, [tbRows, sortMode])

  const topAccounts = sorted.slice(0, limit)
  const maxAbs = topAccounts.length > 0 ? topAccounts[0].abs : 0

  const hasData = entries.length > 0
  if (!hasData) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="print:hidden"
    >
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" />
            Top Accounts by Balance
          </CardTitle>
          <CardDescription className="text-xs">
            The largest ledger accounts in your journal — useful for spotting materiality and concentration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Sort toggle */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">Sort by:</span>
            <Button
              variant={sortMode === 'abs' ? 'default' : 'outline'}
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => setSortMode('abs')}
            >
              Magnitude
            </Button>
            <Button
              variant={sortMode === 'dr' ? 'default' : 'outline'}
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => setSortMode('dr')}
            >
              <ArrowUp className="h-3 w-3 mr-0.5" /> Debit
            </Button>
            <Button
              variant={sortMode === 'cr' ? 'default' : 'outline'}
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => setSortMode('cr')}
            >
              <ArrowDown className="h-3 w-3 mr-0.5" /> Credit
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">
              {sorted.length} accounts
            </span>
          </div>

          {/* Bars */}
          <div className="space-y-2">
            {topAccounts.map((r, i) => {
              const pct = maxAbs > 0 ? (r.abs / maxAbs) * 100 : 0
              const isDr = r.dr > 0
              const isCr = r.cr > 0
              const barColor = isDr
                ? 'bg-emerald-500/60'
                : isCr
                ? 'bg-rose-500/60'
                : 'bg-muted-foreground/40'
              return (
                <div key={r.name} className="group cursor-pointer hover:bg-muted/30 -mx-2 px-2 py-0.5 rounded transition-colors" onClick={() => drillDownToAccount(r.name)}>
                  <div className="flex items-center gap-2 text-xs">
                    {i === 0 && <Crown className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />}
                    {i !== 0 && <span className="w-3.5 text-center text-muted-foreground/50 text-[10px]">{i + 1}</span>}
                    <span className="font-medium truncate flex-1 group-hover:text-primary group-hover:underline" title={`Click to view entries for ${r.name}`}>
                      {r.name}
                    </span>
                    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${CLASS_COLORS[r.cls]}`}>
                      {CLASS_LABELS[r.cls]}
                    </span>
                    <span className="font-mono font-semibold text-right tabular-nums whitespace-nowrap">
                      {isDr ? 'Dr ' : 'Cr '}{fmtCurrency(r.abs, currency)}
                    </span>
                  </div>
                  {/* Bar */}
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.05 }}
                        className={`h-full rounded-full ${barColor}`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-10 text-right tabular-nums">
                      {maxAbs > 0 ? Math.round((r.abs / maxAbs) * 100) : 0}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Show more / less */}
          {sorted.length > limit && (
            <Button
              variant="ghost" size="sm" className="w-full text-xs h-7"
              onClick={() => setLimit(limit === 8 ? 20 : 8)}
            >
              {limit === 8 ? (
                <>Show all {sorted.length} accounts <ChevronRight className="h-3 w-3 ml-1" /></>
              ) : (
                <>Show fewer <ChevronRight className="h-3 w-3 ml-1 rotate-90" /></>
              )}
            </Button>
          )}

          {/* Click hint */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 pt-1 border-t border-border/30">
            <MousePointerClick className="h-3 w-3" />
            <span>Click any account name to jump to its transactions</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

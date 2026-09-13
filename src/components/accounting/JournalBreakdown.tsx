'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAccountingStore, computeTotals, useShallow } from '@/lib/store'
import { fmtCurrency, entryBalanced } from '@/lib/accounting'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Calendar, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react'

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export function JournalBreakdown() {
  const entries = useAccountingStore((s) => s.entries)
  const currency = useAccountingStore((s) => s.company.currency)
  const totals = useAccountingStore(useShallow(computeTotals))

  // Group entries by month
  const monthly = useMemo(() => {
    const map = new Map<string, { count: number; dr: number; cr: number; balanced: number }>()
    for (const e of entries) {
      const date = e.date || ''
      // Extract YYYY-MM from the date string
      const monthKey = date.substring(0, 7) // e.g. "2024-04"
      if (!monthKey) continue
      const cur = map.get(monthKey) || { count: 0, dr: 0, cr: 0, balanced: 0 }
      cur.count++
      const dr = e.legs.reduce((s, l) => s + (Number(l.debit) || 0), 0)
      const cr = e.legs.reduce((s, l) => s + (Number(l.credit) || 0), 0)
      cur.dr += dr
      cur.cr += cr
      if (entryBalanced(e)) cur.balanced++
      map.set(monthKey, cur)
    }
    // Sort by month
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [entries])

  const hasData = entries.length > 0
  if (!hasData) return null

  const maxCount = Math.max(...monthly.map((m) => m[1].count), 1)
  const maxAmount = Math.max(...monthly.map((m) => Math.max(m[1].dr, m[1].cr)), 1)

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
            <Calendar className="h-4 w-4 text-primary" />
            Journal Activity by Month
          </CardTitle>
          <CardDescription className="text-xs">
            Transaction volume and value across the financial year — spot busy months and gaps.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Month bars */}
          <div className="space-y-2">
            {monthly.map(([monthKey, data], i) => {
              const [year, month] = monthKey.split('-')
              const monthName = MONTH_NAMES[parseInt(month) - 1] || month
              const countPct = (data.count / maxCount) * 100
              const drPct = (data.dr / maxAmount) * 100
              const allBalanced = data.balanced === data.count
              return (
                <div key={monthKey} className="group">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-12 font-medium text-muted-foreground">{monthName} {year?.slice(2)}</span>
                    <span className="text-[10px] text-muted-foreground/60 w-8">{data.count} entr{data.count === 1 ? 'y' : 'ies'}</span>
                    {/* Count bar */}
                    <div className="flex-1 h-4 rounded-sm bg-muted/40 overflow-hidden relative">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${countPct}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.04 }}
                        className={`h-full rounded-sm ${allBalanced ? 'bg-primary/40' : 'bg-amber-500/40'}`}
                      />
                      {/* Amount overlay */}
                      <div className="absolute inset-0 flex items-center justify-end pr-1.5">
                        <span className="text-[9px] font-mono font-medium text-muted-foreground/80">
                          {fmtCurrency(data.dr, currency).replace(/^[A-Z]+ /, '')}
                        </span>
                      </div>
                    </div>
                    {/* Status icon */}
                    {allBalanced ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Summary stats */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-border/30 text-xs">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3 text-primary" />
              <span className="text-muted-foreground">Peak month:</span>
              <span className="font-semibold">
                {monthly.length > 0
                  ? `${MONTH_NAMES[parseInt(monthly.reduce((max, cur) => cur[1].count > max[1].count ? cur : max)[0].split('-')[1]) - 1] || ''} (${Math.max(...monthly.map(m => m[1].count))} entries)`
                  : '—'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Active months:</span>
              <span className="font-semibold">{monthly.length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Avg entries/month:</span>
              <span className="font-semibold">{(entries.length / Math.max(monthly.length, 1)).toFixed(1)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

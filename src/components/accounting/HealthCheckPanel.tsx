'use client'

import { motion } from 'framer-motion'
import { useAccountingStore, computeTotals, useShallow } from '@/lib/store'
import { fmtCurrency } from '@/lib/accounting'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2, XCircle, AlertTriangle, Circle,
  Building2, BookOpen, SlidersHorizontal, FileSpreadsheet, Stethoscope,
  ArrowRight,
} from 'lucide-react'

type Status = 'pass' | 'warn' | 'fail' | 'pending'

interface CheckItem {
  id: string
  label: string
  status: Status
  detail: string
  icon: React.ReactNode
  tab?: string  // which tab to navigate to for fixing
  actionLabel?: string  // what button says
}

export function HealthCheckPanel() {
  const company = useAccountingStore((s) => s.company)
  const totals = useAccountingStore(useShallow(computeTotals))
  const adjustments = useAccountingStore((s) => s.adjustments)
  const lastResult = useAccountingStore((s) => s.lastResult)
  const currency = useAccountingStore((s) => s.company.currency)
  const setUiTab = useAccountingStore((s) => s.setUiTab)

  const checks: CheckItem[] = [
    {
      id: 'company',
      label: 'Company details',
      status: company.name.trim() ? 'pass' : 'pending',
      detail: company.name.trim()
        ? `${company.name} · FY ${company.financialYear} · ${company.currency}`
        : 'Firm name is required',
      icon: <Building2 className="h-4 w-4" />,
      tab: 'company',
      actionLabel: 'Set up company',
    },
    {
      id: 'entries',
      label: 'Journal entries',
      status: totals.entryCount === 0 ? 'pending' : totals.unbalanced > 0 ? 'warn' : 'pass',
      detail: totals.entryCount === 0
        ? 'At least one journal entry is required'
        : totals.unbalanced > 0
        ? `${totals.unbalanced} of ${totals.entryCount} entries unbalanced (Dr ≠ Cr)`
        : `${totals.entryCount} entries · Dr ${fmtCurrency(totals.totalDr, currency)} = Cr ${fmtCurrency(totals.totalCr, currency)}`,
      icon: <BookOpen className="h-4 w-4" />,
      tab: 'transactions',
      actionLabel: totals.entryCount === 0 ? 'Add entries' : 'Fix entries',
    },
    {
      id: 'adjustments',
      label: 'Period-end adjustments',
      status: adjustments.length === 0 ? 'pass' : 'pass', // adjustments are optional
      detail: adjustments.length === 0
        ? 'None (optional — adjustments improve accuracy but are not required)'
        : `${adjustments.length} adjustments (closing stock, depreciation, etc.)`,
      icon: <SlidersHorizontal className="h-4 w-4" />,
      tab: 'adjustments',
      actionLabel: 'Add adjustments',
    },
    {
      id: 'generate',
      label: 'Workbook generation',
      status: lastResult?.ok ? 'pass' : lastResult?.ok === false ? 'fail' : 'pass', // "not generated yet" is not a problem
      detail: lastResult?.ok
        ? `Last: ${lastResult.fileName} · TB ${lastResult.tbBalanced} · BS ${lastResult.bsBalanced}`
        : lastResult?.ok === false
        ? `Failed: ${lastResult.error || 'unknown error'}`
        : 'Ready to generate — click the button below',
      icon: <FileSpreadsheet className="h-4 w-4" />,
    },
  ]

  // A check needs attention only if it's 'warn' or 'fail' — 'pending' for
  // generate is fine (user hasn't generated yet), and adjustments are optional.
  const needsAttention = checks.filter((c) => c.status === 'warn' || c.status === 'fail')
  const allReady = needsAttention.length === 0
  // Can generate = company name set AND entries exist AND all balanced
  const canGenerate = company.name.trim().length > 0 && totals.entryCount > 0 && totals.unbalanced === 0

  const statusIcon = (status: Status) => {
    switch (status) {
      case 'pass': return <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
      case 'warn': return <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
      case 'fail': return <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
      case 'pending': return <Circle className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
    }
  }

  const statusColor = (status: Status) => {
    switch (status) {
      case 'pass': return 'text-emerald-700 dark:text-emerald-300'
      case 'warn': return 'text-amber-700 dark:text-amber-400'
      case 'fail': return 'text-destructive'
      case 'pending': return 'text-muted-foreground'
    }
  }

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
            <Stethoscope className="h-4 w-4 text-primary" />
            Health Check
            {allReady ? (
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ml-auto text-[10px]">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Ready
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 ml-auto text-[10px]">
                <AlertTriangle className="h-3 w-3 mr-1" /> {needsAttention.length} to fix
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">
            At-a-glance readiness status across all four steps.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {checks.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.25 }}
              className={`flex items-start gap-3 rounded-lg border p-2.5 transition-colors ${
                c.status === 'warn' || c.status === 'fail'
                  ? 'border-amber-500/30 bg-amber-500/[0.03]'
                  : 'border-border/40 bg-card/50 hover:bg-muted/30'
              }`}
            >
              <div className="flex items-center gap-2 flex-shrink-0 w-32">
                <span className="text-muted-foreground">{c.icon}</span>
                <span className="text-xs font-medium">{c.label}</span>
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {statusIcon(c.status)}
                <span className={`text-xs truncate ${statusColor(c.status)}`} title={c.detail}>
                  {c.detail}
                </span>
              </div>
              {/* Action button for items that need attention */}
              {(c.status === 'warn' || c.status === 'pending') && c.tab && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-2 flex-shrink-0"
                  onClick={() => setUiTab(c.tab!)}
                >
                  {c.actionLabel} <ArrowRight className="h-3 w-3 ml-0.5" />
                </Button>
              )}
            </motion.div>
          ))}

          {/* Overall status bar */}
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium ${
            allReady
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
          }`}>
            {allReady ? (
              <>
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>
                  {canGenerate
                    ? "All checks passed — you're ready to generate the workbook. Click the button below."
                    : 'Almost ready — set up your company and add entries to generate.'}
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>
                  {needsAttention.length} item{needsAttention.length === 1 ? '' : 's'} need attention — click the action buttons above to fix them.
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

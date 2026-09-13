'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useAccountingStore, computeTotals, useShallow } from '@/lib/store'
import {
  computeTrialBalancePreview, classifyAccount, fmtCurrency,
  type AccountClass,
} from '@/lib/accounting'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  TrendingUp, TrendingDown, Wallet, Scale, Receipt, PiggyBank,
  AlertCircle, ArrowUpRight, ArrowDownRight, Printer,
} from 'lucide-react'

export function SummaryDashboard() {
  const entries = useAccountingStore((s) => s.entries)
  const adjustments = useAccountingStore((s) => s.adjustments)
  const currency = useAccountingStore((s) => s.company.currency)
  const company = useAccountingStore((s) => s.company)
  const totals = useAccountingStore(useShallow(computeTotals))

  const tbRows = useMemo(() => computeTrialBalancePreview(entries), [entries])

  const metrics = useMemo(() => {
    let purchases = 0, sales = 0, cashBank = 0, debtors = 0, creditors = 0
    let expenses = 0, incomes = 0, capital = 0, drawings = 0, fixedAssets = 0

    for (const r of tbRows) {
      const net = r.net // Dr - Cr
      const cls = classifyAccount(r.name)
      const low = r.name.toLowerCase()

      if (cls === 'trading_dr' || low.includes('purchase')) purchases += Math.abs(net)
      else if (cls === 'trading_cr' || low.includes('sale')) sales += Math.abs(net)
      else if (cls === 'pl_dr') expenses += Math.abs(net)
      else if (cls === 'pl_cr') incomes += Math.abs(net)
      else if (cls === 'capital') capital += Math.abs(net)
      else if (cls === 'drawings') drawings += Math.abs(net)
      else if (cls === 'bs_asset') {
        if (low.includes('cash') || low.includes('bank')) cashBank += Math.abs(net)
        else if (low.includes('debtor')) debtors += Math.abs(net)
        else fixedAssets += Math.abs(net)
      }
      else if (cls === 'bs_liab') {
        if (low.includes('creditor')) creditors += Math.abs(net)
      }
    }

    const grossProfitEst = sales - purchases
    const netProfitEst = grossProfitEst + incomes - expenses
    const netWorthEst = capital + netProfitEst - drawings

    // Closing stock from adjustments
    const closingStock = adjustments
      .filter((a) => a.type === 'closing_stock')
      .reduce((s, a) => s + (Number(a.amount) || 0), 0)

    return {
      purchases, sales, cashBank, debtors, creditors, expenses, incomes,
      capital, drawings, fixedAssets,
      grossProfitEst, netProfitEst, netWorthEst, closingStock,
    }
  }, [tbRows, adjustments])

  const hasData = entries.length > 0
  if (!hasData) return null

  const gpPositive = metrics.grossProfitEst >= 0
  const npPositive = metrics.netProfitEst >= 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="print-summary-target"
    >
      <Card className="border-border/60 shadow-sm overflow-hidden print:shadow-none print:border-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary print:hidden" />
            Financial Summary
            <span className="text-xs font-normal text-muted-foreground ml-1 print:hidden">
              (live estimates from your journal — pre-adjustment)
            </span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto print:hidden h-7 text-xs"
              onClick={() => window.print()}
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Print
            </Button>
          </CardTitle>
          <div className="print:block hidden text-sm text-muted-foreground">
            {company.name} · FY {company.financialYear} · {company.yearEndDate}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Gross Profit */}
            <MetricCard
              icon={gpPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              label="Gross Profit (est.)"
              value={fmtCurrency(Math.abs(metrics.grossProfitEst), currency)}
              sub={`${gpPositive ? 'Profit' : 'Loss'} · Sales ${fmtCurrency(metrics.sales, currency)} − Purchases ${fmtCurrency(metrics.purchases, currency)}`}
              tone={gpPositive ? 'positive' : 'negative'}
            />

            {/* Net Profit */}
            <MetricCard
              icon={npPositive ? <PiggyBank className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              label="Net Profit (est.)"
              value={fmtCurrency(Math.abs(metrics.netProfitEst), currency)}
              sub={`${npPositive ? 'Profit' : 'Loss'} · GP + Income ${fmtCurrency(metrics.incomes, currency)} − Expenses ${fmtCurrency(metrics.expenses, currency)}`}
              tone={npPositive ? 'positive' : 'negative'}
            />

            {/* Cash & Bank */}
            <MetricCard
              icon={<Wallet className="h-4 w-4" />}
              label="Cash & Bank"
              value={fmtCurrency(metrics.cashBank, currency)}
              sub={`Debtors: ${fmtCurrency(metrics.debtors, currency)} · Creditors: ${fmtCurrency(metrics.creditors, currency)}`}
              tone="neutral"
            />

            {/* Net Worth */}
            <MetricCard
              icon={<Scale className="h-4 w-4" />}
              label="Owner's Equity (est.)"
              value={fmtCurrency(metrics.netWorthEst, currency)}
              sub={`Capital ${fmtCurrency(metrics.capital, currency)} ${npPositive ? '+' : '−'} NP ${npPositive ? '' : '−'}${fmtCurrency(Math.abs(metrics.netProfitEst), currency).replace(/^[A-Z]+ /, '')} − Drawings ${fmtCurrency(metrics.drawings, currency)}`}
              tone="primary"
            />
          </div>

          {/* Quick ratio bar */}
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <div className="flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-muted-foreground">Total Dr:</span>
              <span className="font-mono font-semibold">{fmtCurrency(totals.totalDr, currency)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowDownRight className="h-3.5 w-3.5 text-rose-600" />
              <span className="text-muted-foreground">Total Cr:</span>
              <span className="font-mono font-semibold">{fmtCurrency(totals.totalCr, currency)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">Entries:</span>
              <span className="font-semibold">{totals.entryCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-muted-foreground">Fixed Assets:</span>
              <span className="font-mono font-semibold">{fmtCurrency(metrics.fixedAssets, currency)}</span>
            </div>
            {metrics.closingStock > 0 && (
              <div className="flex items-center gap-1.5">
                <PiggyBank className="h-3.5 w-3.5 text-sky-600" />
                <span className="text-muted-foreground">Closing Stock:</span>
                <span className="font-mono font-semibold">{fmtCurrency(metrics.closingStock, currency)}</span>
              </div>
            )}
            {totals.unbalanced > 0 && (
              <div className="flex items-center gap-1.5 text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                <span className="font-semibold">{totals.unbalanced} unbalanced entr{totals.unbalanced === 1 ? 'y' : 'ies'}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function MetricCard({
  icon, label, value, sub, tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  tone: 'positive' | 'negative' | 'neutral' | 'primary'
}) {
  const toneClasses = {
    positive: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/5 border-emerald-500/20',
    negative: 'text-rose-700 dark:text-rose-300 bg-rose-500/5 border-rose-500/20',
    neutral: 'text-foreground bg-muted/40 border-border/40',
    primary: 'text-primary bg-primary/5 border-primary/20',
  }
  const iconBg = {
    positive: 'bg-emerald-500/15 text-emerald-600',
    negative: 'bg-rose-500/15 text-rose-600',
    neutral: 'bg-muted text-muted-foreground',
    primary: 'bg-primary/15 text-primary',
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`rounded-lg border p-3.5 transition-all hover:shadow-sm ${toneClasses[tone]}`}
    >
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-md ${iconBg[tone]}`}>
          {icon}
        </div>
        <span className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</span>
      </div>
      <div className="mt-2 text-xl font-bold tracking-tight">
        <AnimatedValue value={value} />
      </div>
      <div className="mt-1 text-[11px] opacity-70 leading-snug">{sub}</div>
    </motion.div>
  )
}

// Animated value: extracts the numeric portion from a formatted currency
// string and animates it counting up from 0.
function AnimatedValue({ value }: { value: string }) {
  // Parse the currency prefix and numeric value from strings like "NPR 49,000.00"
  const match = value.match(/^([A-Z]+)\s([\d,.−-]+)$/)
  const prefix = match ? match[1] + ' ' : ''
  const numStr = match ? match[2] : value
  const targetNum = parseFloat(numStr.replace(/,/g, '').replace(/−/g, '-')) || 0

  const count = useMotionValue(0)
  const rounded = useTransform(count, (v) => {
    const isNeg = v < 0
    const abs = Math.abs(v)
    return prefix + (isNeg ? '−' : '') + abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  })
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const controls = animate(count, targetNum, {
      duration: 0.8,
      ease: 'easeOut',
    })
    return () => controls.stop()
  }, [targetNum, count])

  return <motion.span ref={ref}>{rounded}</motion.span>
}

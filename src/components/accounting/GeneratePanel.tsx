'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAccountingStore, computeTotals, useShallow } from '@/lib/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Download, FileSpreadsheet, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Database, ShieldCheck, ListChecks, Sparkles,
} from 'lucide-react'
import { SummaryDashboard } from './SummaryDashboard'
import { TopAccountsPanel } from './TopAccountsPanel'
import { JournalBreakdown } from './JournalBreakdown'
import { HealthCheckPanel } from './HealthCheckPanel'
import { Confetti } from './Confetti'

export function GeneratePanel() {
  const company = useAccountingStore((s) => s.company)
  const totals = useAccountingStore(useShallow(computeTotals))
  const adjustments = useAccountingStore((s) => s.adjustments)
  const isGenerating = useAccountingStore((s) => s.isGenerating)
  const lastResult = useAccountingStore((s) => s.lastResult)
  const setGenerating = useAccountingStore((s) => s.setGenerating)
  const setResult = useAccountingStore((s) => s.setResult)
  const asRequest = useAccountingStore((s) => s.asRequest)

  const [downloadReady, setDownloadReady] = useState(false)

  const canGenerate =
    company.name.trim().length > 0 && totals.entryCount > 0 && totals.unbalanced === 0

  async function handleGenerate() {
    // Always use getState() directly — this bypasses the React hook selector
    // and always returns the current store state with all functions intact.
    // The hook-bound selectors (setGenerating, asRequest, etc.) can return
    // undefined during hot-reload or hydration edge cases in the dev server.
    const state = useAccountingStore.getState()
    const doSetGenerating = state.setGenerating
    const doSetResult = state.setResult
    const doAsRequest = state.asRequest

    if (typeof doSetGenerating !== 'function' || typeof doAsRequest !== 'function') {
      console.error('Store not ready — functions are undefined. State keys:', Object.keys(state).join(','))
      if (typeof doSetResult === 'function') {
        doSetResult({ ok: false, error: 'The app is still loading. Please wait a moment and try again.' })
      }
      return
    }
    doSetGenerating(true)
    doSetResult(null)
    setDownloadReady(false)
    try {
      const payload = doAsRequest()
      if (!payload || typeof payload !== 'object' || !payload.company || !Array.isArray(payload.entries) || !Array.isArray(payload.adjustments)) {
        doSetResult({ ok: false, error: 'The workbook data is incomplete. Please add a company, journal entries, and any adjustments before generating.' })
        return
      }

      if (!payload.company.name?.trim()) {
        doSetResult({ ok: false, error: 'Company name is required before generating the workbook.' })
        return
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        let msg = `Server returned ${res.status}`
        let trace: string | undefined
        try {
          const j = await res.json()
          msg = j.error || msg
          trace = j.trace
          if (trace) console.error(trace)
        } catch { /* ignore */ }
        doSetResult({ ok: false, error: msg, trace })
        return
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') || ''
      const match = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="([^"]+)"/i)
      const fileName = match ? decodeURIComponent(match[1]) : `${company.name || 'FinalAccounts'}_FinalAccounts.xlsx`

      // Trigger download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      doSetResult({
        ok: true,
        fileName,
        tbBalanced: res.headers.get('X-Tb-Balanced') || 'unknown',
        bsBalanced: res.headers.get('X-Bs-Balanced') || 'unknown',
        recalcErrors: res.headers.get('X-Recalc-Errors') || 'unknown',
        accountsCount: Number(res.headers.get('X-Accounts-Count') || 0),
        assumptionsCount: Number(res.headers.get('X-Assumptions-Count') || 0),
      })
      setDownloadReady(true)
    } catch (err: any) {
      doSetResult({ ok: false, error: err?.message || 'Network error' })
    } finally {
      doSetGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <Confetti trigger={lastResult?.ok === true} />
      <HealthCheckPanel />
      <SummaryDashboard />
      <TopAccountsPanel />
      <JournalBreakdown />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card className="border-border/60 shadow-sm overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-accent/60 to-primary/40" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Generate Final Accounts Workbook
            </CardTitle>
            <CardDescription>
              Builds a 7-sheet, formula-linked Excel workbook — every derived figure
              is a live <span className="font-mono text-xs">SUMIF</span> / cross-sheet
              reference / balancing-figure <span className="font-mono text-xs">IF</span> — never hardcoded.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Summary grid */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryStat
                icon={<Database className="h-4 w-4" />}
                label="Firm"
                value={company.name || '—'}
                sub={company.financialYear || 'FY not set'}
              />
              <SummaryStat
                icon={<ListChecks className="h-4 w-4" />}
                label="Journal entries"
                value={String(totals.entryCount)}
                sub={`${totals.unbalanced} unbalanced`}
                subTone={totals.unbalanced > 0 ? 'bad' : 'good'}
              />
              <SummaryStat
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Total Dr / Cr"
                value={fmtShort(totals.totalDr)}
                sub={`Cr ${fmtShort(totals.totalCr)} ${company.currency}`}
                subTone={Math.abs(totals.totalDr - totals.totalCr) < 0.005 && totals.entryCount > 0 ? 'good' : 'bad'}
              />
              <SummaryStat
                icon={<Sparkles className="h-4 w-4" />}
                label="Adjustments"
                value={String(adjustments.length)}
                sub="period-end items"
              />
            </div>

            <Separator />

            {/* Validation / generate */}
            {!canGenerate && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Cannot generate yet</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc ml-4 mt-1 space-y-0.5 text-sm">
                    {!company.name.trim() && <li>Set the firm name in the <strong>Company Setup</strong> tab.</li>}
                    {totals.entryCount === 0 && <li>Add at least one journal entry in the <strong>Transactions</strong> tab.</li>}
                    {totals.unbalanced > 0 && <li>{totals.unbalanced} journal {totals.unbalanced === 1 ? 'entry is' : 'entries are'} <strong>not balanced</strong> (Dr ≠ Cr).</li>}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <div className={`relative ${canGenerate && !isGenerating ? 'ring-2 ring-primary/20 ring-offset-2 ring-offset-background rounded-lg' : ''}`}>
                <Button
                  size="lg"
                  onClick={handleGenerate}
                  disabled={!canGenerate || isGenerating}
                  className={`min-w-[200px] ${canGenerate && !isGenerating ? 'animate-pulse-ring bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary' : ''}`}
                >
                  {isGenerating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Building workbook…</>
                  ) : (
                    <><Download className="h-4 w-4 mr-2" /> Generate &amp; Download .xlsx</>
                  )}
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">
                Runs Python (openpyxl) → LibreOffice recalc → structural validate. ~10–20 seconds.
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Loading skeleton */}
      {isGenerating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="border-primary/30">
            <CardContent className="py-6 space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="space-y-1.5 flex-1">
                  <div className="text-sm font-medium">Building your workbook…</div>
                  <div className="text-xs text-muted-foreground">
                    Running Python (openpyxl) → LibreOffice recalc → structural validate
                  </div>
                </div>
              </div>
              {/* Progress steps */}
              <div className="space-y-2">
                {[
                  { label: 'Generating 7 formula-linked sheets', delay: 0 },
                  { label: 'Running LibreOffice recalc', delay: 0.3 },
                  { label: 'Validating TB & BS balance', delay: 0.6 },
                  { label: 'Packaging .xlsx for download', delay: 0.9 },
                ].map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: step.delay, duration: 0.3 }}
                    className="flex items-center gap-2 text-xs"
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                    <span className="text-muted-foreground">{step.label}</span>
                  </motion.div>
                ))}
              </div>
              {/* Skeleton bar */}
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: ['0%', '30%', '60%', '90%', '100%'] }}
                  transition={{ duration: 2.5, ease: 'easeInOut', times: [0, 0.3, 0.6, 0.9, 1] }}
                  className="h-full rounded-full bg-gradient-to-r from-primary/60 via-primary to-primary/60"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Result panel */}
      {lastResult && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
        <Card className={lastResult.ok ? 'border-emerald-500/40' : 'border-destructive/40'}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {lastResult.ok ? (
                <>
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                  >
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </motion.div>
                  Workbook generated
                </>
              ) : (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  >
                    <XCircle className="h-5 w-5 text-destructive" />
                  </motion.div>
                  Generation failed
                </>
              )}
            </CardTitle>
            <CardDescription>
              {lastResult.ok
                ? `Saved as ${lastResult.fileName}. Open it in Excel / LibreOffice / Google Sheets.`
                : 'See the error below — fix the inputs and try again.'}
            </CardDescription>
          </CardHeader>
          {lastResult.ok ? (
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <QACheck
                  label="Trial Balance tallies"
                  value={lastResult.tbBalanced}
                />
                <QACheck
                  label="Balance Sheet tallies"
                  value={lastResult.bsBalanced}
                />
                <QACheck
                  label="Formula errors (recalc)"
                  value={lastResult.recalcErrors === '0' ? 'true' : lastResult.recalcErrors || 'unknown'}
                  display={lastResult.recalcErrors}
                />
                <SummaryStat
                  icon={<Database className="h-4 w-4" />}
                  label="Ledger accounts"
                  value={String(lastResult.accountsCount || 0)}
                  sub={`${lastResult.assumptionsCount || 0} assumptions flagged`}
                />
              </div>
              <div className="rounded-md bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                <strong className="text-foreground">What you get:</strong> 7 sheets —
                Journal · Trial Balance · Adjustments · Trading A/c · Profit &amp; Loss A/c ·
                Balance Sheet · Notes (Formulas Used &amp; Assumptions). Every Dr/Cr figure
                is a live Excel formula, so changing any input in the Journal instantly
                reflows through to the Balance Sheet.
              </div>
            </CardContent>
          ) : (
            <CardContent>
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  <p className="font-mono text-xs whitespace-pre-wrap">{lastResult.error}</p>
                  {lastResult.trace && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                        Show technical details
                      </summary>
                      <pre className="mt-1 text-[10px] font-mono text-muted-foreground/70 overflow-x-auto max-h-40 p-2 rounded bg-muted/50 whitespace-pre-wrap">
                        {lastResult.trace}
                      </pre>
                    </details>
                  )}
                </AlertDescription>
              </Alert>
            </CardContent>
          )}
        </Card>
        </motion.div>
      )}
    </div>
  )
}

function fmtShort(n: number): string {
  if (!n) return '0'
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function SummaryStat({
  icon, label, value, sub, subTone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  subTone?: 'good' | 'bad'
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className="rounded-lg border border-border/60 bg-card p-3 shadow-sm hover:shadow-md hover:border-primary/30 transition-colors"
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span className="uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-1 text-lg font-semibold truncate" title={value}>{value}</div>
      {sub && (
        <div className={`text-xs ${subTone === 'good' ? 'text-emerald-600 dark:text-emerald-400' : subTone === 'bad' ? 'text-destructive' : 'text-muted-foreground'}`}>
          {sub}
        </div>
      )}
    </motion.div>
  )
}

function QACheck({ label, value, display }: { label: string; value: string; display?: string }) {
  const ok = value === 'true' || value === 'True'
  const unknown = value === 'unknown'
  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        unknown
          ? 'border-border/60 bg-card'
          : ok
            ? 'border-emerald-500/40 bg-emerald-500/[0.08]'
            : 'border-destructive/40 bg-destructive/[0.06]'
      }`}
    >
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="mt-1.5 flex items-center gap-2">
        {unknown ? (
          <Badge variant="outline" className="text-muted-foreground">unknown</Badge>
        ) : ok ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            Passed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2 py-0.5 text-sm font-semibold text-destructive dark:text-red-300">
            <XCircle className="h-4 w-4" />
            {display || 'Failed'}
          </span>
        )}
      </div>
    </div>
  )
}

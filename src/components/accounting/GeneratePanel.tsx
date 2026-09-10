'use client'

import { useState } from 'react'
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
    setGenerating(true)
    setResult(null)
    setDownloadReady(false)
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(asRequest()),
      })
      if (!res.ok) {
        let msg = `Server returned ${res.status}`
        try {
          const j = await res.json()
          msg = j.error || msg
          if (j.trace) console.error(j.trace)
        } catch { /* ignore */ }
        setResult({ ok: false, error: msg })
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

      setResult({
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
      setResult({ ok: false, error: err?.message || 'Network error' })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/60 shadow-sm">
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
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={!canGenerate || isGenerating}
              className="min-w-[200px]"
            >
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Building workbook…</>
              ) : (
                <><Download className="h-4 w-4 mr-2" /> Generate &amp; Download .xlsx</>
              )}
            </Button>
            <span className="text-xs text-muted-foreground">
              Runs Python (openpyxl) → LibreOffice recalc → structural validate. ~10–20 seconds.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Result panel */}
      {lastResult && (
        <Card className={lastResult.ok ? 'border-emerald-500/40' : 'border-destructive/40'}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {lastResult.ok ? (
                <><CheckCircle2 className="h-5 w-5 text-emerald-600" /> Workbook generated</>
              ) : (
                <><XCircle className="h-5 w-5 text-destructive" /> Generation failed</>
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
                <AlertDescription className="font-mono text-xs whitespace-pre-wrap">
                  {lastResult.error}
                </AlertDescription>
              </Alert>
            </CardContent>
          )}
        </Card>
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
    <div className="rounded-lg border border-border/60 bg-card p-3">
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
    </div>
  )
}

function QACheck({ label, value, display }: { label: string; value: string; display?: string }) {
  const ok = value === 'true' || value === 'True'
  const unknown = value === 'unknown'
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="mt-1 flex items-center gap-1.5">
        {unknown ? (
          <Badge variant="outline" className="text-muted-foreground">unknown</Badge>
        ) : ok ? (
          <><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span className="text-sm font-medium">Passed</span></>
        ) : (
          <><XCircle className="h-4 w-4 text-destructive" /><span className="text-sm font-medium">{display || 'Failed'}</span></>
        )}
      </div>
    </div>
  )
}

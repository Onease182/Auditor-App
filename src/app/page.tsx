'use client'

import { useState } from 'react'
import { useAccountingStore, computeTotals, useShallow } from '@/lib/store'
import { CompanySetup } from '@/components/accounting/CompanySetup'
import { JournalEntries } from '@/components/accounting/JournalEntries'
import { AdjustmentsPanel } from '@/components/accounting/AdjustmentsPanel'
import { GeneratePanel } from '@/components/accounting/GeneratePanel'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Building2, BookOpen, SlidersHorizontal, FileSpreadsheet, Sparkles,
  Trash2, Github, ArrowRight,
} from 'lucide-react'

type TabId = 'company' | 'transactions' | 'adjustments' | 'generate'

const TABS: { id: TabId; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: 'company', label: 'Company Setup', icon: <Building2 className="h-4 w-4" />, hint: 'Firm name, year, currency' },
  { id: 'transactions', label: 'Transactions', icon: <BookOpen className="h-4 w-4" />, hint: 'Journal entries (Dr / Cr legs)' },
  { id: 'adjustments', label: 'Adjustments', icon: <SlidersHorizontal className="h-4 w-4" />, hint: 'Closing stock, depreciation, accruals' },
  { id: 'generate', label: 'Generate', icon: <FileSpreadsheet className="h-4 w-4" />, hint: 'Build & download the .xlsx' },
]

export default function Home() {
  const [tab, setTab] = useState<TabId>('company')
  const loadSample = useAccountingStore((s) => s.loadSample)
  const clearAll = useAccountingStore((s) => s.clearAll)
  const totals = useAccountingStore(useShallow(computeTotals))
  const company = useAccountingStore((s) => s.company)
  const adjustmentsCount = useAccountingStore((s) => s.adjustments.length)
  const lastResult = useAccountingStore((s) => s.lastResult)

  const stepDone = {
    company: company.name.trim().length > 0,
    transactions: totals.entryCount > 0 && totals.unbalanced === 0,
    adjustments: true, // adjustments are optional
    generate: lastResult?.ok === true,
  }

  function handleSample() {
    loadSample()
    setTab('generate')
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div className="leading-tight">
                <div className="font-semibold text-[15px] tracking-tight">
                  Final Accounts Builder
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Journal → Trial Balance → Trading → P&amp;L → Balance Sheet
                </div>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={handleSample}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5 text-amber-600" />
                Load Sample
              </Button>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => { if (confirm('Clear all company data, entries and adjustments?')) clearAll() }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Clear all data</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Tab navigation */}
          <nav className="flex items-center gap-1 overflow-x-auto pb-2 -mb-px">
            {TABS.map((t, i) => {
              const done = stepDone[t.id as keyof typeof stepDone]
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`group relative flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10 dark:bg-white/10 text-[10px] font-semibold">
                    {done && !active ? '✓' : i + 1}
                  </span>
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className="sm:hidden">{t.label.split(' ')[0]}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6">
        {tab === 'company' && (
          <div className="space-y-4">
            <SectionHeading
              eyebrow="Step 1"
              title="Company / Firm Details"
              description="Identifying information printed at the top of every sheet in the generated workbook."
            />
            <CompanySetup />
            <NextStepHint onClick={() => setTab('transactions')} label="Next: enter transactions" />
          </div>
        )}
        {tab === 'transactions' && (
          <div className="space-y-4">
            <SectionHeading
              eyebrow="Step 2"
              title="Journal Entries"
              description="Every transaction becomes 2+ balanced Dr/Cr legs. Keep supplier and customer accounts separate (e.g. 'Creditors - Supplier A') so subsidiary ledgers reconcile."
            />
            <JournalEntries />
            {totals.entryCount > 0 && totals.unbalanced === 0 && (
              <NextStepHint onClick={() => setTab('adjustments')} label="Next: period-end adjustments" />
            )}
          </div>
        )}
        {tab === 'adjustments' && (
          <div className="space-y-4">
            <SectionHeading
              eyebrow="Step 3"
              title="Period-end Adjustments"
              description="Items not yet in the Journal: closing stock, depreciation, outstanding & prepaid items. Depreciation is a live formula referencing the Trial Balance."
            />
            <AdjustmentsPanel />
            <NextStepHint onClick={() => setTab('generate')} label="Next: generate the workbook" />
          </div>
        )}
        {tab === 'generate' && (
          <div className="space-y-4">
            <SectionHeading
              eyebrow="Step 4"
              title="Generate Final Accounts"
              description="Produces a 7-sheet, formula-linked Excel workbook implementing the full Nepali/Indian accounting pipeline. The server runs LibreOffice recalc + structural validation before delivery."
            />
            <GeneratePanel />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/60 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Github className="h-3.5 w-3.5" />
            Built with Next.js · Python (openpyxl) · LibreOffice recalc pipeline
          </span>
          <span className="hidden sm:inline">·</span>
          <span>
            <span className="font-medium text-foreground">Color convention:</span>{' '}
            <span className="text-blue-600 dark:text-blue-400">blue</span> = input ·{' '}
            <span className="text-foreground">black</span> = formula ·{' '}
            <span className="text-emerald-600 dark:text-emerald-400">green</span> = cross-sheet
          </span>
          <span className="ml-auto">
            Currency: <Badge variant="secondary" className="font-mono">{company.currency || 'NPR'}</Badge>
          </span>
        </div>
      </footer>
    </div>
  )
}

function SectionHeading({
  eyebrow, title, description,
}: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</div>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground max-w-3xl">{description}</p>
    </div>
  )
}

function NextStepHint({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <div className="flex justify-end">
      <Button variant="ghost" size="sm" onClick={onClick} className="text-muted-foreground">
        {label} <ArrowRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  )
}

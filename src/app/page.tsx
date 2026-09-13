'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  Trash2, Github, ArrowRight, Keyboard, Undo2, Redo2,
} from 'lucide-react'
import { toast } from 'sonner'

type TabId = 'company' | 'transactions' | 'adjustments' | 'generate'

const TABS: { id: TabId; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: 'company', label: 'Company Setup', icon: <Building2 className="h-4 w-4" />, hint: 'Firm name, year, currency' },
  { id: 'transactions', label: 'Transactions', icon: <BookOpen className="h-4 w-4" />, hint: 'Journal entries (Dr / Cr legs)' },
  { id: 'adjustments', label: 'Adjustments', icon: <SlidersHorizontal className="h-4 w-4" />, hint: 'Closing stock, depreciation, accruals' },
  { id: 'generate', label: 'Generate', icon: <FileSpreadsheet className="h-4 w-4" />, hint: 'Build & download the .xlsx' },
]

export default function Home() {
  const tab = useAccountingStore((s) => s.uiTab as TabId)
  const setTab = useAccountingStore((s) => s.setUiTab)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const loadSample = useAccountingStore((s) => s.loadSample)
  const clearAll = useAccountingStore((s) => s.clearAll)
  const addEntry = useAccountingStore((s) => s.addEntry)
  const undo = useAccountingStore((s) => s.undo)
  const redo = useAccountingStore((s) => s.redo)
  const pastLen = useAccountingStore((s) => s._past.length)
  const futureLen = useAccountingStore((s) => s._future.length)
  const canUndo = pastLen > 0
  const canRedo = futureLen > 0
  const totals = useAccountingStore(useShallow(computeTotals))
  const company = useAccountingStore((s) => s.company)
  const lastResult = useAccountingStore((s) => s.lastResult)
  const entryCount = useAccountingStore((s) => s.entries.length)
  const adjCount = useAccountingStore((s) => s.adjustments.length)

  const stepDone = {
    company: company.name.trim().length > 0,
    transactions: totals.entryCount > 0 && totals.unbalanced === 0,
    adjustments: true, // adjustments are optional
    generate: lastResult?.ok === true,
  }

  const handleSample = useCallback(() => {
    loadSample()
    setTab('generate')
  }, [loadSample, setTab])

  // Keyboard shortcuts — global, but ignored when focus is inside an input/textarea/select
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Escape closes the shortcuts dialog
      if (e.key === 'Escape' && showShortcuts) {
        setShowShortcuts(false)
        return
      }
      const mod = e.ctrlKey || e.metaKey
      if (!mod) {
        // Non-modifier shortcuts
        if (e.key === '?' && e.shiftKey) {
          e.preventDefault()
          setShowShortcuts((v) => !v)
          return
        }
        return
      }
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable
      // Allow Ctrl+G / Ctrl+S even while typing (user likely wants to generate/save)
      const k = e.key.toLowerCase()
      if (k === 'n') {
        e.preventDefault()
        setTab('transactions')
        if (!isTyping) {
          addEntry()
          toast.success('New entry added', { description: 'Ctrl+N — switch to Transactions tab' })
        }
      } else if (k === 'g') {
        e.preventDefault()
        setTab('generate')
      } else if (k === 's') {
        e.preventDefault()
        const btn = document.querySelector<HTMLButtonElement>('[data-export-json-trigger]')
        if (btn) btn.click()
      } else if (k === 'z' && !e.shiftKey) {
        // Ctrl+Z = undo
        e.preventDefault()
        undo()
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        // Ctrl+Shift+Z or Ctrl+Y = redo
        e.preventDefault()
        redo()
      } else if (k === ',') {
        e.preventDefault()
        setShowShortcuts((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [addEntry, showShortcuts, undo, redo])

  const SHORTCUTS: { keys: string; label: string }[] = [
    { keys: 'Ctrl+N', label: 'Add a new journal entry (jumps to Transactions tab)' },
    { keys: 'Ctrl+G', label: 'Jump to the Generate tab' },
    { keys: 'Ctrl+S', label: 'Export your transaction set as JSON' },
    { keys: 'Ctrl+Z', label: 'Undo the last change' },
    { keys: 'Ctrl+Shift+Z', label: 'Redo the last undone change (or Ctrl+Y)' },
    { keys: 'Ctrl+,', label: 'Show / hide this shortcuts dialog' },
    { keys: 'Shift+?', label: 'Show / hide this shortcuts dialog' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/70 header-glow shadow-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center gap-3">
            <div className="flex items-center gap-2.5">
              <motion.div
                whileHover={{ scale: 1.06, rotate: -2 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md ring-1 ring-primary/20"
              >
                <FileSpreadsheet className="h-5 w-5" />
              </motion.div>
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
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground disabled:opacity-40"
                      onClick={() => undo()}
                      disabled={!canUndo}
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground disabled:opacity-40"
                      onClick={() => redo()}
                      disabled={!canRedo}
                    >
                      <Redo2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="h-5 w-px bg-border/60 mx-0.5" />
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"
                      onClick={() => setShowShortcuts(true)}
                    >
                      <Keyboard className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Keyboard shortcuts (Ctrl+,)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
          <nav className="flex items-center gap-1 overflow-x-auto pb-2 -mb-px scrollbar-slim">
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
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-colors ${
                    active
                      ? 'bg-white/20 text-primary-foreground'
                      : done
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : 'bg-black/10 dark:bg-white/10 text-muted-foreground'
                  }`}>
                    {done && !active ? '✓' : i + 1}
                  </span>
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className="sm:hidden">{t.label.split(' ')[0]}</span>
                  {/* Count badge for Transactions / Adjustments */}
                  {t.id === 'transactions' && entryCount > 0 && (
                    <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${
                      active ? 'bg-white/25 text-primary-foreground' : 'bg-primary/15 text-primary'
                    }`}>
                      {entryCount}
                    </span>
                  )}
                  {t.id === 'adjustments' && adjCount > 0 && (
                    <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${
                      active ? 'bg-white/25 text-primary-foreground' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                    }`}>
                      {adjCount}
                    </span>
                  )}
                  {/* active-tab underline indicator */}
                  {active && (
                    <motion.span
                      layoutId="tab-underline"
                      className="absolute left-1/2 -bottom-[7px] h-1 w-8 -translate-x-1/2 rounded-full bg-amber-500 shadow-[0_0_6px_oklch(0.62_0.13_75/0.6)]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 bg-shell">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            {tab === 'company' && (
              <>
                <SectionHeading
                  eyebrow="Step 1"
                  title="Company / Firm Details"
                  description="Identifying information printed at the top of every sheet in the generated workbook."
                />
                <CompanySetup />
                <NextStepHint onClick={() => setTab('transactions')} label="Next: enter transactions" />
              </>
            )}
            {tab === 'transactions' && (
              <>
                <SectionHeading
                  eyebrow="Step 2"
                  title="Journal Entries"
                  description="Every transaction becomes 2+ balanced Dr/Cr legs. Keep supplier and customer accounts separate (e.g. 'Creditors - Supplier A') so subsidiary ledgers reconcile."
                />
                <JournalEntries />
                {totals.entryCount > 0 && totals.unbalanced === 0 && (
                  <NextStepHint onClick={() => setTab('adjustments')} label="Next: period-end adjustments" />
                )}
              </>
            )}
            {tab === 'adjustments' && (
              <>
                <SectionHeading
                  eyebrow="Step 3"
                  title="Period-end Adjustments"
                  description="Items not yet in the Journal: closing stock, depreciation, outstanding & prepaid items. Depreciation is a live formula referencing the Trial Balance."
                />
                <AdjustmentsPanel />
                <NextStepHint onClick={() => setTab('generate')} label="Next: generate the workbook" />
              </>
            )}
            {tab === 'generate' && (
              <>
                <SectionHeading
                  eyebrow="Step 4"
                  title="Generate Final Accounts"
                  description="Produces a 7-sheet, formula-linked Excel workbook implementing the full Nepali/Indian accounting pipeline. The server runs LibreOffice recalc + structural validation before delivery."
                />
                <GeneratePanel />
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-muted/30 border-top-gradient">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Github className="h-3.5 w-3.5" />
            Built with Next.js · Python (openpyxl) · LibreOffice recalc pipeline
          </span>
          <span className="hidden sm:inline opacity-40">·</span>
          <span>
            <span className="font-medium text-foreground">Color convention:</span>{' '}
            <span className="text-blue-600 dark:text-blue-400">blue</span> = input ·{' '}
            <span className="text-foreground">black</span> = formula ·{' '}
            <span className="text-emerald-600 dark:text-emerald-400">green</span> = cross-sheet
          </span>
          <span className="hidden md:inline opacity-40">·</span>
          <TipsCarousel />
          <span className="ml-auto">
            Currency: <Badge variant="secondary" className="font-mono">{company.currency || 'NPR'}</Badge>
          </span>
        </div>
      </footer>

      {/* Keyboard shortcuts dialog */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowShortcuts(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="bg-card border border-border/60 rounded-xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Keyboard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
                <p className="text-xs text-muted-foreground">Press Esc or click outside to close.</p>
              </div>
            </div>
            <div className="space-y-2">
              {SHORTCUTS.map((s) => (
                <div key={s.keys} className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                  <kbd className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-1 text-xs font-mono font-medium shadow-sm">
                    {s.keys}
                  </kbd>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => setShowShortcuts(false)}>
              Got it
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  )
}

const FOOTER_TIPS = [
  '💡 Ctrl+N adds a new entry · Ctrl+G jumps to Generate',
  '💡 Keep supplier/customer accounts separate for clean subsidiary ledgers',
  '💡 Every adjustment posts on both P&L AND Balance Sheet',
  '💡 Blue = input · Black = formula · Green = cross-sheet link',
  '💡 Ctrl+Z undoes · Ctrl+Shift+Z redoes · Ctrl+, shows shortcuts',
  '💡 Depreciation is a live formula: TB balance × rate%',
  '💡 Click any Top Account name to drill down to its transactions',
  '💡 Export JSON backs up your work · Import JSON restores it',
]

function TipsCarousel() {
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % FOOTER_TIPS.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <span className="hidden md:inline-flex items-center gap-1 overflow-hidden max-w-xs">
      <AnimatePresence mode="wait">
        <motion.span
          key={tipIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="text-muted-foreground/70 italic whitespace-nowrap"
        >
          {FOOTER_TIPS[tipIndex]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

function SectionHeading({
  eyebrow, title, description,
}: { eyebrow: string; title: string; description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</div>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground max-w-3xl">{description}</p>
    </motion.div>
  )
}

function NextStepHint({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <div className="flex justify-end">
      <Button variant="ghost" size="sm" onClick={onClick} className="text-muted-foreground group">
        {label}
        <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-0.5" />
      </Button>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useAccountingStore } from '@/lib/store'
import { parseCsvEntries, entryBalanced, fmtCurrency } from '@/lib/accounting'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ClipboardPaste, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

const SAMPLE_CSV = `Date,Narration,Account,Debit,Credit
2024-04-01,Started business,Cash in Hand,200000,
2024-04-01,Started business,Capital Account,,200000
2024-04-15,Credit purchase,Purchases,25000,
2024-04-15,Credit purchase,Creditors - Supplier A,,25000`

export function BulkPasteDialog() {
  const appendEntries = useAccountingStore((s) => s.appendEntries)
  const currency = useAccountingStore((s) => s.company.currency)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<ReturnType<typeof parseCsvEntries> | null>(null)

  function handleParse(t: string) {
    setText(t)
    if (!t.trim()) {
      setPreview(null)
      return
    }
    setPreview(parseCsvEntries(t))
  }

  function handleAppend() {
    if (!preview || preview.entries.length === 0) {
      toast.error('Nothing to import — paste some rows first')
      return
    }
    appendEntries(preview.entries)
    toast.success(`Added ${preview.entries.length} entries`, {
      description: preview.errors.length
        ? `${preview.errors.length} row(s) were skipped — see preview`
        : 'All rows parsed cleanly',
    })
    setText('')
    setPreview(null)
    setOpen(false)
  }

  const balancedCount = preview?.entries.filter(entryBalanced).length ?? 0
  const unbalancedCount = (preview?.entries.length ?? 0) - balancedCount

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setText(''); setPreview(null) } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ClipboardPaste className="h-3.5 w-3.5 mr-1.5" />
          Bulk Paste
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="h-5 w-5 text-primary" />
            Bulk Paste Journal Entries (CSV / TSV)
          </DialogTitle>
          <DialogDescription>
            Paste rows directly from a spreadsheet. Expected columns:{' '}
            <code className="text-xs">Date · Narration · Account · Debit · Credit</code>.
            A new entry starts on each row that has a Date; following rows without a Date
            are appended as additional legs of that entry.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Paste here</span>
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleParse(SAMPLE_CSV)}>
                Load example
              </Button>
            </div>
            <Textarea
              rows={14}
              placeholder={SAMPLE_CSV}
              value={text}
              onChange={(e) => handleParse(e.target.value)}
              className="bg-background font-mono text-xs resize-none"
            />
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Preview</span>
              {preview && (
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-xs">
                    {preview.entries.length} entries
                  </Badge>
                  {balancedCount > 0 && (
                    <Badge variant="outline" className="text-xs border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3 mr-1" />{balancedCount} ok
                    </Badge>
                  )}
                  {unbalancedCount > 0 && (
                    <Badge variant="outline" className="text-xs border-destructive/40 bg-destructive/10 text-destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />{unbalancedCount} unbalanced
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <ScrollArea className="h-[320px] rounded-md border border-border/60">
              {!preview ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-xs text-muted-foreground p-4">
                  <ClipboardPaste className="h-8 w-8 mb-2 text-muted-foreground/40" />
                  Parsed entries will appear here.
                </div>
              ) : preview.entries.length === 0 ? (
                <div className="p-3 text-xs text-destructive">
                  No entries parsed. {preview.errors[0]?.message || ''}
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {preview.entries.map((e, i) => {
                    const ok = entryBalanced(e)
                    return (
                      <div key={e.id} className={`p-2.5 ${ok ? '' : 'bg-destructive/5'}`}>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-muted-foreground">#{i + 1}</span>
                          <span className="font-mono">{e.date}</span>
                          <span className="font-medium truncate flex-1">{e.narration || '(no narration)'}</span>
                          {ok ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                          )}
                        </div>
                        <div className="mt-1 ml-6 space-y-0.5">
                          {e.legs.map((l, j) => (
                            <div key={j} className="text-xs font-mono text-muted-foreground">
                              {l.account}
                              {l.debit ? <span className="ml-2 text-foreground">Dr {fmtCurrency(l.debit, currency)}</span> : null}
                              {l.credit ? <span className="ml-2 text-foreground">Cr {fmtCurrency(l.credit, currency)}</span> : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
            {preview && preview.errors.length > 0 && (
              <div className="text-xs text-destructive">
                {preview.errors.length} row(s) skipped — first error: row {preview.errors[0].row}: {preview.errors[0].message}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { setOpen(false); setText(''); setPreview(null) }}>
            Cancel
          </Button>
          <Button onClick={handleAppend} disabled={!preview || preview.entries.length === 0}>
            <ArrowRight className="h-4 w-4 mr-1.5" />
            Append {preview?.entries.length ?? 0} Entries
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

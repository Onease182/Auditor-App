'use client'

import { useRef, useState } from 'react'
import { useAccountingStore } from '@/lib/store'
import { buildExportJson, parseImportJson } from '@/lib/accounting'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Download, Upload, FileJson, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

export function ImportExportPanel() {
  const asRequest = useAccountingStore((s) => s.asRequest)
  const importSet = useAccountingStore((s) => s.importSet)
  const entryCount = useAccountingStore((s) => s.entries.length)
  const adjCount = useAccountingStore((s) => s.adjustments.length)
  const companyName = useAccountingStore((s) => s.company.name)

  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleExport() {
    const req = asRequest()
    if (!req.company.name && req.entries.length === 0) {
      toast.error('Nothing to export — add some data first')
      return
    }
    const data = buildExportJson(req)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safe = (companyName || 'transaction-set').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40)
    a.href = url
    a.download = `${safe}_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Exported transaction set as JSON', {
      description: `${req.entries.length} entries · ${req.adjustments.length} adjustments`,
    })
  }

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      setImportText(text)
    }
    reader.readAsText(file)
    // reset the input so the same file can be re-imported
    e.target.value = ''
  }

  function handleImport() {
    if (!importText.trim()) {
      toast.error('Paste a JSON transaction set or pick a file first')
      return
    }
    const result = parseImportJson(importText)
    if (!result.ok || !result.data) {
      toast.error('Import failed', { description: result.error })
      return
    }
    importSet(result.data)
    toast.success('Transaction set imported', {
      description: `${result.data.entries.length} entries · ${result.data.adjustments.length} adjustments`,
    })
    setImportOpen(false)
    setImportText('')
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFileImport}
        className="hidden"
      />
      <Button variant="outline" size="sm" onClick={handleExport} disabled={entryCount === 0 && !companyName}>
        <Download className="h-3.5 w-3.5 mr-1.5" />
        Export JSON
      </Button>
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Import JSON
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5 text-primary" />
              Import Transaction Set (JSON)
            </DialogTitle>
            <DialogDescription>
              Restore a previously-exported transaction set. The current data will be{' '}
              <strong>replaced</strong>.
            </DialogHeader>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary" size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Pick a .json file
              </Button>
              <span className="text-xs text-muted-foreground">
                Or paste JSON below
              </span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="import-text" className="text-xs uppercase tracking-wide text-muted-foreground">
                JSON content
              </Label>
              <Textarea
                id="import-text"
                rows={10}
                placeholder='{"version":1,"company":{...},"entries":[...],"adjustments":[...]}'
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="bg-background font-mono text-xs resize-none"
              />
            </div>
            {importText.trim() && !importText.trim().startsWith('{') && (
              <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>JSON must start with <code>{'{'}</code> — looks like you pasted something else.</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setImportOpen(false); setImportText('') }}>
              Cancel
            </Button>
            <Button onClick={handleImport}>Import &amp; Replace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

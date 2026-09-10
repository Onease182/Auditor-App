'use client'

import { useAccountingStore } from '@/lib/store'
import { ADJUSTMENT_TYPES, fmtCurrency } from '@/lib/accounting'
import type { Adjustment } from '@/lib/accounting'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, SlidersHorizontal, Info } from 'lucide-react'

interface AdjRowProps {
  adj: Adjustment
  index: number
}

function AdjustmentRow({ adj, index }: AdjRowProps) {
  const updateAdj = useAccountingStore((s) => s.updateAdjustment)
  const removeAdj = useAccountingStore((s) => s.removeAdjustment)
  const meta = ADJUSTMENT_TYPES.find((t) => t.value === adj.type)!
  const currency = useAccountingStore((s) => s.company.currency)

  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="py-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm font-semibold text-muted-foreground">
            Adjustment #{index + 1}
          </div>
          <BadgePill label={meta.label} />
          <Button
            variant="ghost" size="icon" className="h-7 w-7 ml-auto text-destructive hover:text-destructive"
            onClick={() => removeAdj(adj.id)}
            title="Delete adjustment"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Type</Label>
            <Select
              value={adj.type}
              onValueChange={(v) => updateAdj(adj.id, { type: v as Adjustment['type'] })}
            >
              <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {adj.type === 'depreciation' ? 'Asset account (from Trial Balance)' : 'Account / party'}
            </Label>
            <Input
              placeholder={adj.type === 'depreciation' ? 'e.g. Furniture & Fixtures' : 'e.g. Salary'}
              value={adj.account}
              onChange={(e) => updateAdj(adj.id, { account: e.target.value })}
              className="bg-background"
            />
          </div>

          {meta.usesAmount && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Amount ({currency})
              </Label>
              <Input
                type="number" step="0.01" placeholder="0.00"
                value={adj.amount ?? ''}
                onChange={(e) => updateAdj(adj.id, { amount: e.target.value === '' ? null : Number(e.target.value) })}
                className="bg-background text-right font-mono"
              />
            </div>
          )}

          {meta.usesRate && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Rate (% p.a.)</Label>
              <Input
                type="number" step="0.5" placeholder="10"
                value={adj.rate ?? ''}
                onChange={(e) => updateAdj(adj.id, { rate: e.target.value === '' ? null : Number(e.target.value) })}
                className="bg-background text-right font-mono"
              />
            </div>
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Narration</Label>
            <Textarea
              rows={2}
              placeholder="Brief description shown on the Adjustments sheet"
              value={adj.narration}
              onChange={(e) => updateAdj(adj.id, { narration: e.target.value })}
              className="bg-background resize-none"
            />
          </div>
        </div>

        {meta.hint && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
            <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-primary" />
            <span>{meta.hint}</span>
          </div>
        )}

        {meta.usesRate && adj.rate && adj.account && (
          <div className="text-xs text-muted-foreground font-mono">
            → formula: (Trial Balance {adj.account} balance) × {adj.rate}% =
            {' computed in workbook'}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function BadgePill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
      {label}
    </span>
  )
}

export function AdjustmentsPanel() {
  const adjustments = useAccountingStore((s) => s.adjustments)
  const addAdjustment = useAccountingStore((s) => s.addAdjustment)

  return (
    <div className="space-y-4">
      <Card className="border-border/60 bg-muted/30">
        <CardContent className="py-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <span className="font-medium">{adjustments.length} adjustments</span>
          </div>
          <Button size="sm" className="ml-auto" onClick={addAdjustment}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Adjustment
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-accent/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Info className="h-4 w-4 text-accent-foreground" />
            How adjustments flow through the statements
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1.5">
          <p>
            <strong className="text-foreground">Closing Stock</strong> → Trading A/c (Cr) + Balance Sheet (Asset).
          </p>
          <p>
            <strong className="text-foreground">Depreciation</strong> → P&L A/c (Dr) + Balance Sheet (deducted from the asset). The amount is a <em>live formula</em>: Trial-Balance balance × rate%.
          </p>
          <p>
            <strong className="text-foreground">Outstanding / Prepaid / Accrued</strong> items are posted on <em>both</em> the P&L and the Balance Sheet — that dual posting is exactly what makes the Balance Sheet tally.
          </p>
        </CardContent>
      </Card>

      {adjustments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <SlidersHorizontal className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">
              No adjustments yet. Add closing stock, depreciation and accruals
              to produce a complete set of final accounts.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {adjustments.map((a, i) => (
            <AdjustmentRow key={a.id} adj={a} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

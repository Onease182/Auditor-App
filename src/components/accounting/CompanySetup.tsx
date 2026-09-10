'use client'

import { useAccountingStore } from '@/lib/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Building2, CalendarDays, Coins, CalendarRange } from 'lucide-react'

const CURRENCIES = [
  { code: 'NPR', name: 'Nepali Rupee (NPR)' },
  { code: 'INR', name: 'Indian Rupee (INR)' },
  { code: 'USD', name: 'US Dollar (USD)' },
  { code: 'EUR', name: 'Euro (EUR)' },
  { code: 'GBP', name: 'Pound Sterling (GBP)' },
  { code: 'PKR', name: 'Pakistani Rupee (PKR)' },
  { code: 'BDT', name: 'Bangladeshi Taka (BDT)' },
]

export function CompanySetup() {
  const company = useAccountingStore((s) => s.company)
  const setCompany = useAccountingStore((s) => s.setCompany)

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-primary" />
          Company / Firm Details
        </CardTitle>
        <CardDescription>
          Identifying information printed at the top of every sheet in the workbook.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="company-name" className="flex items-center gap-1.5 text-sm">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            Firm name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="company-name"
            placeholder="e.g. Himalayan Traders Pvt. Ltd."
            value={company.name}
            onChange={(e) => setCompany({ name: e.target.value })}
            className="bg-background"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fy" className="flex items-center gap-1.5 text-sm">
            <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
            Financial year
          </Label>
          <Input
            id="fy"
            placeholder="2024-25"
            value={company.financialYear}
            onChange={(e) => setCompany({ financialYear: e.target.value })}
            className="bg-background"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="year-end" className="flex items-center gap-1.5 text-sm">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            Year-end date
          </Label>
          <Input
            id="year-end"
            placeholder="31 March 2025"
            value={company.yearEndDate}
            onChange={(e) => setCompany({ yearEndDate: e.target.value })}
            className="bg-background"
          />
          <p className="text-[11px] text-muted-foreground">
            Printed under the Trading A/c, P&L A/c and Balance Sheet headings.
          </p>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="currency" className="flex items-center gap-1.5 text-sm">
            <Coins className="h-3.5 w-3.5 text-muted-foreground" />
            Reporting currency
          </Label>
          <Select
            value={company.currency}
            onValueChange={(v) => setCompany({ currency: v })}
          >
            <SelectTrigger id="currency" className="bg-background">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}

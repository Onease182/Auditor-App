'use client'

import { motion } from 'framer-motion'
import { useAccountingStore } from '@/lib/store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Building2, CalendarDays, Coins, CalendarRange, Eye, FileSpreadsheet } from 'lucide-react'

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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-accent/60 to-primary/40" />
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

      {/* Live preview card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <Card className="mt-4 border-border/40 bg-muted/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Eye className="h-4 w-4 text-muted-foreground" />
              Live Preview
              <span className="text-xs font-normal text-muted-foreground">
                — how your firm info appears on each Excel sheet
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border/60 bg-white dark:bg-zinc-900 p-6 shadow-sm">
              {/* Simulated sheet header */}
              <div className="text-center space-y-1">
                <div className="text-lg font-bold text-foreground tracking-tight">
                  {company.name || <span className="text-muted-foreground/50 italic">Your Firm Name</span>}
                </div>
                <div className="text-sm text-muted-foreground">
                  Trading Account
                </div>
                <div className="text-xs text-muted-foreground/70">
                  for the year ended {company.yearEndDate || <span className="italic">31 March 2025</span>}
                </div>
              </div>
              {/* Simulated sheet body */}
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="border border-border/40 rounded p-2">
                  <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Particulars (Dr)</div>
                  <div className="mt-1 space-y-0.5">
                    <div className="flex justify-between"><span>To Opening Stock</span><span className="font-mono">{company.currency} 0.00</span></div>
                    <div className="flex justify-between"><span>To Purchases</span><span className="font-mono">{company.currency} 0.00</span></div>
                  </div>
                </div>
                <div className="border border-border/40 rounded p-2">
                  <div className="text-muted-foreground text-[10px] uppercase tracking-wide">Particulars (Cr)</div>
                  <div className="mt-1 space-y-0.5">
                    <div className="flex justify-between"><span>By Sales</span><span className="font-mono">{company.currency} 0.00</span></div>
                    <div className="flex justify-between"><span>By Closing Stock</span><span className="font-mono">{company.currency} 0.00</span></div>
                  </div>
                </div>
              </div>
              {/* Footer info */}
              <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground/60">
                <span className="flex items-center gap-1">
                  <FileSpreadsheet className="h-3 w-3" />
                  FY {company.financialYear || '2024-25'} · Currency: {company.currency}
                </span>
                <span>Journal → Trial Balance → Trading → P&L → Balance Sheet</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}

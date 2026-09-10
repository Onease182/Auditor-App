// Shared accounting types for the Audit Report / Financial Statement Builder.

export interface CompanyInfo {
  name: string
  financialYear: string
  currency: string
  yearEndDate: string
}

export interface JournalLeg {
  account: string
  debit?: number | null
  credit?: number | null
}

export interface JournalEntry {
  id: string
  date: string
  narration: string
  legs: JournalLeg[]
}

export type AdjustmentType =
  | 'closing_stock'
  | 'depreciation'
  | 'outstanding'
  | 'prepaid'
  | 'accrued_income'
  | 'accrued_expense'
  | 'unearned_income'
  | 'bad_debts'
  | 'provision'
  | 'other'

export interface Adjustment {
  id: string
  type: AdjustmentType
  account: string
  amount?: number | null
  rate?: number | null
  narration: string
}

export interface WorkbookRequest {
  company: CompanyInfo
  entries: JournalEntry[]
  adjustments: Adjustment[]
}

export const ADJUSTMENT_TYPES: { value: AdjustmentType; label: string; hint: string; usesRate: boolean; usesAmount: boolean }[] = [
  { value: 'closing_stock', label: 'Closing Stock', hint: 'Stock valued at cost at year end → Trading (Cr) + Balance Sheet (Asset)', usesRate: false, usesAmount: true },
  { value: 'depreciation', label: 'Depreciation', hint: 'Formula = Trial Balance asset balance × rate% → P&L (Dr) + BS (reduce asset)', usesRate: true, usesAmount: false },
  { value: 'outstanding', label: 'Outstanding Expense', hint: 'Expense incurred but not paid → P&L (Dr) + BS (Liability)', usesRate: false, usesAmount: true },
  { value: 'prepaid', label: 'Prepaid Expense', hint: 'Expense paid in advance → P&L (Cr, reduce) + BS (Asset)', usesRate: false, usesAmount: true },
  { value: 'accrued_income', label: 'Accrued Income', hint: 'Income earned but not received → P&L (Cr) + BS (Asset)', usesRate: false, usesAmount: true },
  { value: 'accrued_expense', label: 'Accrued Expense', hint: 'Same as outstanding — expense incurred, not yet paid', usesRate: false, usesAmount: true },
  { value: 'unearned_income', label: 'Income Received in Advance', hint: 'Income received but not earned → P&L (Dr, reduce) + BS (Liability)', usesRate: false, usesAmount: true },
  { value: 'bad_debts', label: 'Bad Debts (further)', hint: 'Additional bad debts to be written off → P&L (Dr)', usesRate: false, usesAmount: true },
  { value: 'provision', label: 'Provision for Doubtful Debts', hint: 'Create / increase provision → P&L (Dr)', usesRate: false, usesAmount: true },
  { value: 'other', label: 'Other', hint: 'Custom adjustment — describe in narration', usesRate: false, usesAmount: true },
]

export function newLeg(): JournalLeg {
  return { account: '', debit: null, credit: null }
}

export function newEntry(): JournalEntry {
  return {
    id: `e_${Math.random().toString(36).slice(2, 9)}`,
    date: new Date().toISOString().slice(0, 10),
    narration: '',
    legs: [
      { account: '', debit: null, credit: null },
      { account: '', debit: null, credit: null },
    ],
  }
}

export function newAdjustment(): Adjustment {
  return {
    id: `a_${Math.random().toString(36).slice(2, 9)}`,
    type: 'closing_stock',
    account: '',
    amount: null,
    rate: null,
    narration: '',
  }
}

// Format a number as currency (NPR / INR style — grouped, 2 decimals)
export function fmtCurrency(n: number | null | undefined, currency = 'NPR'): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  return `${sign}${currency} ${abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function entryBalanced(e: JournalEntry): boolean {
  const dr = e.legs.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const cr = e.legs.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  return Math.abs(dr - cr) < 0.005
}

export function entryTotals(e: JournalEntry): { dr: number; cr: number } {
  return {
    dr: e.legs.reduce((s, l) => s + (Number(l.debit) || 0), 0),
    cr: e.legs.reduce((s, l) => s + (Number(l.credit) || 0), 0),
  }
}

// ─── Account classification (mirrors the Python classify_account) ─────────────
export type AccountClass =
  | 'trading_dr' | 'trading_cr'
  | 'pl_dr' | 'pl_cr'
  | 'bs_asset' | 'bs_liab'
  | 'capital' | 'drawings'

const TRADING_DR_KW = [
  'opening stock', 'purchases', 'wages', 'carriage inward', 'carriage inwards',
  'freight inward', 'freight inwards', 'fuel', 'power', 'gas', 'coal',
  'factory rent', 'manufacturing', 'import duty', 'octroi', 'royalty',
]
const TRADING_CR_KW = ['sales']
const PL_DR_KW = [
  'rent', 'salary', 'salaries', 'insurance', 'stationery', 'postage',
  'telephone', 'electricity', 'discount allowed', 'discount', 'commission paid',
  'commission', 'interest paid', 'interest', 'depreciation', 'bank charges',
  'advertisement', 'advertising', 'repairs', 'carriage outward', 'carriage outwards',
  'freight outward', 'general expenses', 'administrative', 'office expenses',
  'printing', 'conveyance', 'travelling', 'audit fee', 'bad debts',
  'provision for doubtful', 'miscellaneous expenses', 'staff welfare',
  'entertainment', 'water', 'internet', 'subscription', 'professional fee',
]
const PL_CR_KW = [
  'discount received', 'commission received', 'interest received',
  'rent received', 'dividend received', 'bad debts recovered', 'profit on sale',
]
const BS_ASSET_KW = [
  'cash', 'bank', 'debtors', 'bills receivable', 'furniture', 'machinery',
  'building', 'land', 'plant', 'equipment', 'vehicle', 'motor', 'computer',
  'stock', 'inventory', 'prepaid', 'advance', 'investments', 'goodwill',
  'patent', 'copyright', 'trademark', 'loose tools', 'tools',
]
const BS_LIAB_KW = [
  'creditors', 'bills payable', 'loan', 'loans', 'bank overdraft', 'overdraft',
  'outstanding', 'payable', 'tax payable', 'gst payable', 'vat payable',
  'unearned', 'income received in advance',
]
const CAPITAL_KW = ['capital']
const DRAWINGS_KW = ['drawings']

export function classifyAccount(name: string): AccountClass {
  const n = (name || '').trim().toLowerCase()
  if (!n) return 'pl_dr'
  if (DRAWINGS_KW.some((k) => n.includes(k))) return 'drawings'
  if (CAPITAL_KW.some((k) => n.includes(k))) return 'capital'
  if (n.includes('sales return') || n.includes('return inward')) return 'trading_dr'
  if (n.includes('purchase return') || n.includes('return outward')) return 'trading_cr'
  if (TRADING_CR_KW.some((k) => n.includes(k))) return 'trading_cr'
  if (TRADING_DR_KW.some((k) => n.includes(k))) return 'trading_dr'
  if (PL_CR_KW.some((k) => n.includes(k))) return 'pl_cr'
  if (PL_DR_KW.some((k) => n.includes(k))) return 'pl_dr'
  if (BS_ASSET_KW.some((k) => n.includes(k))) return 'bs_asset'
  if (BS_LIAB_KW.some((k) => n.includes(k))) return 'bs_liab'
  return 'pl_dr'
}

export const CLASS_LABELS: Record<AccountClass, string> = {
  trading_dr: 'Trading (Dr)',
  trading_cr: 'Trading (Cr)',
  pl_dr: 'P&L (Dr)',
  pl_cr: 'P&L (Cr)',
  bs_asset: 'BS — Asset',
  bs_liab: 'BS — Liability',
  capital: 'BS — Capital',
  drawings: 'BS — Drawings',
}

export const CLASS_COLORS: Record<AccountClass, string> = {
  trading_dr: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30',
  trading_cr: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30',
  pl_dr: 'text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/30',
  pl_cr: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  bs_asset: 'text-sky-700 dark:text-sky-300 bg-sky-500/10 border-sky-500/30',
  bs_liab: 'text-violet-700 dark:text-violet-300 bg-violet-500/10 border-violet-500/30',
  capital: 'text-primary bg-primary/10 border-primary/30',
  drawings: 'text-fuchsia-700 dark:text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/30',
}

// Compute a live Trial Balance preview from entries (Dr = heavier side, Cr = lighter)
export function computeTrialBalancePreview(
  entries: JournalEntry[]
): { name: string; dr: number; cr: number; cls: AccountClass; net: number }[] {
  const map = new Map<string, { dr: number; cr: number }>()
  for (const e of entries) {
    for (const leg of e.legs) {
      const name = (leg.account || '').trim()
      if (!name) continue
      const cur = map.get(name) || { dr: 0, cr: 0 }
      cur.dr += Number(leg.debit) || 0
      cur.cr += Number(leg.credit) || 0
      map.set(name, cur)
    }
  }
  const out: { name: string; dr: number; cr: number; cls: AccountClass; net: number }[] = []
  for (const [name, { dr, cr }] of map.entries()) {
    const net = dr - cr
    out.push({
      name,
      dr: net >= 0 ? net : 0,
      cr: net < 0 ? -net : 0,
      cls: classifyAccount(name),
      net,
    })
  }
  return out
}

// ─── Quick-add transaction templates ────────────────────────────────────────
export interface TemplateDef {
  id: string
  label: string
  icon: string // emoji — kept inline so we don't depend on lucide mapping here
  description: string
  // Each leg's account can contain a {{party}} placeholder to be filled by user
  legs: { account: string; debit?: number | null; credit?: number | null; placeholder?: 'amount' | 'party' }[]
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'capital_intro',
    label: 'Capital Introduced (Cash)',
    icon: '💰',
    description: 'Owner starts / adds capital in cash',
    legs: [
      { account: 'Cash in Hand', debit: null, placeholder: 'amount' },
      { account: 'Capital Account', credit: null, placeholder: 'amount' },
    ],
  },
  {
    id: 'capital_intro_bank',
    label: 'Capital Introduced (Bank)',
    icon: '🏦',
    description: 'Owner starts / adds capital via bank',
    legs: [
      { account: 'Bank A/c', debit: null, placeholder: 'amount' },
      { account: 'Capital Account', credit: null, placeholder: 'amount' },
    ],
  },
  {
    id: 'cash_purchase',
    label: 'Cash Purchase',
    icon: '🛒',
    description: 'Bought goods for cash',
    legs: [
      { account: 'Purchases', debit: null, placeholder: 'amount' },
      { account: 'Cash in Hand', credit: null, placeholder: 'amount' },
    ],
  },
  {
    id: 'credit_purchase',
    label: 'Credit Purchase',
    icon: '📋',
    description: 'Bought goods on credit from a supplier',
    legs: [
      { account: 'Purchases', debit: null, placeholder: 'amount' },
      { account: 'Creditors - {{party}}', credit: null, placeholder: 'amount' },
    ],
  },
  {
    id: 'cash_sale',
    label: 'Cash Sale',
    icon: '💵',
    description: 'Sold goods for cash',
    legs: [
      { account: 'Cash in Hand', debit: null, placeholder: 'amount' },
      { account: 'Sales', credit: null, placeholder: 'amount' },
    ],
  },
  {
    id: 'credit_sale',
    label: 'Credit Sale',
    icon: '🧾',
    description: 'Sold goods on credit to a customer',
    legs: [
      { account: 'Debtors - {{party}}', debit: null, placeholder: 'amount' },
      { account: 'Sales', credit: null, placeholder: 'amount' },
    ],
  },
  {
    id: 'expense_cash',
    label: 'Expense Paid (Cash)',
    icon: '💸',
    description: 'Paid an expense in cash (rent, salary, etc.)',
    legs: [
      { account: '{{party}}', debit: null, placeholder: 'amount' },
      { account: 'Cash in Hand', credit: null, placeholder: 'amount' },
    ],
  },
  {
    id: 'expense_bank',
    label: 'Expense Paid (Bank)',
    icon: '🏦',
    description: 'Paid an expense by cheque / bank transfer',
    legs: [
      { account: '{{party}}', debit: null, placeholder: 'amount' },
      { account: 'Bank A/c', credit: null, placeholder: 'amount' },
    ],
  },
  {
    id: 'receive_from_debtor',
    label: 'Received from Debtor (Bank)',
    icon: '📥',
    description: 'Customer paid into the bank account',
    legs: [
      { account: 'Bank A/c', debit: null, placeholder: 'amount' },
      { account: 'Debtors - {{party}}', credit: null, placeholder: 'amount' },
    ],
  },
  {
    id: 'pay_to_creditor',
    label: 'Paid to Creditor (Bank)',
    icon: '📤',
    description: 'Paid a supplier from the bank account',
    legs: [
      { account: 'Creditors - {{party}}', debit: null, placeholder: 'amount' },
      { account: 'Bank A/c', credit: null, placeholder: 'amount' },
    ],
  },
  {
    id: 'drawings_cash',
    label: 'Drawings (Cash)',
    icon: '👛',
    description: 'Owner withdrew cash for personal use',
    legs: [
      { account: 'Drawings', debit: null, placeholder: 'amount' },
      { account: 'Cash in Hand', credit: null, placeholder: 'amount' },
    ],
  },
  {
    id: 'asset_purchase_bank',
    label: 'Buy Fixed Asset (Bank)',
    icon: '🪑',
    description: 'Purchased furniture / machinery / equipment by cheque',
    legs: [
      { account: '{{party}}', debit: null, placeholder: 'amount' },
      { account: 'Bank A/c', credit: null, placeholder: 'amount' },
    ],
  },
]

// ─── CSV / TSV paste parser ──────────────────────────────────────────────────
// Expected columns (header row optional): Date | Narration | Account | Debit | Credit
// Each ROW is a single Dr/Cr leg. An "entry" boundary is detected when Date is
// non-empty (a new entry starts on each row that has a Date). Multiple legs with
// the same entry share the first row's Date and Narration.
export interface ParsedEntriesResult {
  entries: JournalEntry[]
  errors: { row: number; message: string }[]
}

export function parseCsvEntries(text: string): ParsedEntriesResult {
  const errors: { row: number; message: string }[] = []
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { entries: [], errors: [{ row: 0, message: 'Empty input' }] }

  // Detect delimiter — tab if any line has a tab, else comma
  const delim = lines[0].includes('\t') ? '\t' : ','

  // Detect whether the first row is a header
  const firstCells = lines[0].split(delim).map((c) => c.trim().toLowerCase())
  const hasHeader = firstCells.some((c) =>
    ['date', 'narration', 'account', 'debit', 'credit', 'particulars', 'dr', 'cr'].includes(c)
  )

  const dataLines = hasHeader ? lines.slice(1) : lines

  // Map columns — if header present, use it; else assume positional order
  let dateIdx = 0, narrIdx = 1, acctIdx = 2, drIdx = 3, crIdx = 4
  if (hasHeader) {
    const h = firstCells
    const find = (keys: string[]) => h.findIndex((c) => keys.includes(c))
    dateIdx = find(['date', 'dt']) >= 0 ? find(['date', 'dt']) : 0
    narrIdx = find(['narration', 'narration text', 'description', 'particulars', 'details']) >= 0
      ? find(['narration', 'narration text', 'description', 'particulars', 'details']) : 1
    acctIdx = find(['account', 'account name', 'ledger']) >= 0
      ? find(['account', 'account name', 'ledger']) : 2
    drIdx = find(['debit', 'dr', 'debit (rs)', 'debit amount']) >= 0
      ? find(['debit', 'dr', 'debit (rs)', 'debit amount']) : 3
    crIdx = find(['credit', 'cr', 'credit (rs)', 'credit amount']) >= 0
      ? find(['credit', 'cr', 'credit (rs)', 'credit amount']) : 4
  }

  const entries: JournalEntry[] = []
  let current: JournalEntry | null = null
  dataLines.forEach((line, i) => {
    const rowNo = i + (hasHeader ? 2 : 1)
    const cells = line.split(delim).map((c) => c.trim())
    if (cells.length < 3) {
      errors.push({ row: rowNo, message: `Row has fewer than 3 cells (${cells.length})` })
      return
    }
    const date = cells[dateIdx] || ''
    const narration = cells[narrIdx] || ''
    const account = cells[acctIdx] || ''
    if (!account) {
      errors.push({ row: rowNo, message: 'Account name is empty' })
      return
    }
    const dr = cells[drIdx] ? Number(cells[drIdx].replace(/[^0-9.\-]/g, '')) : null
    const cr = cells[crIdx] ? Number(cells[crIdx].replace(/[^0-9.\-]/g, '')) : null

    // Start a new entry when a Date is present
    if (date) {
      current = {
        id: `e_${Math.random().toString(36).slice(2, 9)}`,
        date,
        narration: narration || '',
        legs: [],
      }
      entries.push(current)
    } else if (!current) {
      // First row without a date — create one with today's date
      current = {
        id: `e_${Math.random().toString(36).slice(2, 9)}`,
        date: new Date().toISOString().slice(0, 10),
        narration: narration || '',
        legs: [],
      }
      entries.push(current)
    } else if (narration) {
      // Continuation row with a narration but no date — attach to current
      // (don't overwrite the entry's existing narration unless it's empty)
      if (!current.narration) current.narration = narration
    }

    current!.legs.push({
      account,
      debit: dr && !isNaN(dr) ? dr : null,
      credit: cr && !isNaN(cr) ? cr : null,
    })
  })

  return { entries, errors }
}

// ─── JSON import/export helpers ─────────────────────────────────────────────
export interface SerializableSet {
  version: 1
  exportedAt: string
  company: CompanyInfo
  entries: JournalEntry[]
  adjustments: Adjustment[]
}

export function buildExportJson(req: WorkbookRequest): SerializableSet {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    company: req.company,
    entries: req.entries,
    adjustments: req.adjustments,
  }
}

export function parseImportJson(text: string): { ok: boolean; data?: WorkbookRequest; error?: string } {
  try {
    const obj = JSON.parse(text)
    if (!obj || typeof obj !== 'object') return { ok: false, error: 'Not a valid JSON object' }
    const company = obj.company || obj.companyInfo
    if (!company || !company.name) return { ok: false, error: 'Missing company.name' }
    if (!Array.isArray(obj.entries)) return { ok: false, error: 'Missing entries array' }
    if (!Array.isArray(obj.adjustments)) return { ok: false, error: 'Missing adjustments array' }
    // Validate each entry has balanced legs
    for (const [i, e] of obj.entries.entries()) {
      if (!Array.isArray(e.legs)) return { ok: false, error: `Entry #${i + 1} has no legs` }
      const dr = e.legs.reduce((s: number, l: any) => s + (Number(l.debit) || 0), 0)
      const cr = e.legs.reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0)
      if (Math.abs(dr - cr) > 0.005) {
        return { ok: false, error: `Entry #${i + 1} "${e.narration || ''}" not balanced (Dr ${dr} ≠ Cr ${cr})` }
      }
    }
    return {
      ok: true,
      data: {
        company,
        entries: obj.entries.map((e: any) => ({
          id: e.id || `e_${Math.random().toString(36).slice(2, 9)}`,
          date: e.date || new Date().toISOString().slice(0, 10),
          narration: e.narration || '',
          legs: (e.legs || []).map((l: any) => ({
            account: l.account || '',
            debit: l.debit ? Number(l.debit) : null,
            credit: l.credit ? Number(l.credit) : null,
          })),
        })),
        adjustments: obj.adjustments.map((a: any) => ({
          id: a.id || `a_${Math.random().toString(36).slice(2, 9)}`,
          type: a.type || 'other',
          account: a.account || '',
          amount: a.amount ? Number(a.amount) : null,
          rate: a.rate ? Number(a.rate) : null,
          narration: a.narration || '',
        })),
      },
    }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Invalid JSON' }
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { spawn, spawnSync } from 'child_process'
import path from 'path'
import os from 'os'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'accounting', 'build_workbook.py')
const DOWNLOAD_DIR = path.join(process.cwd(), 'download')

interface JournalLeg {
  account: string
  debit?: number | null
  credit?: number | null
}

interface JournalEntry {
  id: string
  date: string
  narration: string
  legs: JournalLeg[]
}

interface Adjustment {
  id: string
  type: string
  account: string
  amount?: number | null
  rate?: number | null
  narration: string
}

interface CompanyInfo {
  name: string
  financialYear: string
  currency: string
  yearEndDate: string
}

interface GenerateRequest {
  company: CompanyInfo
  entries: JournalEntry[]
  adjustments: Adjustment[]
  accountOverrides?: Record<string, string>
}

function runPython(reqPath: string, outPath: string): Promise<{
  ok: boolean
  path?: string
  accounts?: string[]
  assumptions?: string[]
  qa?: any
  error?: string
  trace?: string
}> {
  return new Promise((resolve) => {
    const args = [SCRIPT_PATH, reqPath, '--out', outPath]
    // Resolve Python binary: try several candidates because the Next.js
    // dev server may not inherit the shell's PATH that includes the venv.
    // Use the realpath (resolved symlink) to avoid ENOENT on symlink chains.
    const pythonCandidates = [
      process.env.PYTHON_BIN,
      '/home/z/.local/share/uv/python/cpython-3.12.14-linux-x86_64-gnu/bin/python3.12',
      '/home/z/.local/share/uv/python/cpython-3.12-linux-x86_64-gnu/bin/python3.12',
      '/home/z/.venv/bin/python',
      'python3',
    ].filter(Boolean) as string[]
    const venvSitePackages = '/home/z/.venv/lib/python3.12/site-packages'
    const env = { ...process.env, PYTHONPATH: venvSitePackages }

    // Use spawnSync to check which Python binary actually works before
    // committing to async spawn. spawn() errors are async (ENOENT fires
    // as an event, not in try/catch), so we verify synchronously first.
    let workingBin: string | null = null
    for (const bin of pythonCandidates) {
      try {
        const check = spawnSync(bin, ['--version'], {
          stdio: 'pipe',
          timeout: 3000,
          env,
        })
        if (check.status === 0 || (check.error === null && check.stdout)) {
          workingBin = bin
          break
        }
      } catch {
        // Try next candidate
        continue
      }
    }
    if (!workingBin) {
      resolve({ ok: false, error: 'Could not find a working Python binary. Tried: ' + pythonCandidates.join(', ') })
      return
    }

    const proc = spawn(workingBin, args, { cwd: process.cwd(), env })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d: any) => (stdout += d.toString()))
    proc.stderr.on('data', (d: any) => (stderr += d.toString()))
    proc.on('error', (err: any) => resolve({ ok: false, error: `spawn failed: ${err.message}` }))
    proc.on('close', (code: number) => {
      let parsed: any = null
      try {
        const trimmed = stdout.trim().split('\n').pop() || ''
        parsed = JSON.parse(trimmed)
      } catch {
        // ignore parse error
      }
      if (parsed && parsed.ok) {
        resolve(parsed)
      } else {
        resolve({
          ok: false,
          error: parsed?.error || `python exited ${code}`,
          trace: parsed?.trace || stderr.slice(-2000),
        })
      }
    })
  })
}

function validateGenerateRequest(value: unknown): { ok: true; body: GenerateRequest } | { ok: false; error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'Request body must be a JSON object.' }
  }

  const body = value as Partial<GenerateRequest>
  const company = body.company
  const entries = body.entries
  const adjustments = body.adjustments

  if (!company || typeof company !== 'object') {
    return { ok: false, error: 'Company details are required.' }
  }
  if (typeof company.name !== 'string' || !company.name.trim()) {
    return { ok: false, error: 'Company name is required.' }
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    return { ok: false, error: 'At least one journal entry is required.' }
  }
  if (!Array.isArray(adjustments)) {
    return { ok: false, error: 'Adjustments must be an array.' }
  }

  for (const [i, e] of entries.entries()) {
    if (!e || typeof e !== 'object') {
      return { ok: false, error: `Entry #${i + 1} is invalid.` }
    }
    if (!Array.isArray(e.legs)) {
      return { ok: false, error: `Entry #${i + 1} must include a legs array.` }
    }
    for (const [j, leg] of e.legs.entries()) {
      if (!leg || typeof leg !== 'object' || typeof leg.account !== 'string') {
        return { ok: false, error: `Entry #${i + 1}, leg #${j + 1} is missing an account name.` }
      }
    }

    const dr = e.legs.reduce((s, l) => s + (Number(l.debit) || 0), 0)
    const cr = e.legs.reduce((s, l) => s + (Number(l.credit) || 0), 0)
    if (Math.abs(dr - cr) > 0.005) {
      return {
        ok: false,
        error: `Entry #${i + 1} "${e.narration || 'Untitled'}" is not balanced (Dr ${dr} ≠ Cr ${cr}).`,
      }
    }
  }

  return { ok: true, body: body as GenerateRequest }
}

export async function POST(req: NextRequest) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body. Check the request payload and Content-Type header.' }, { status: 400 })
  }

  const validated = validateGenerateRequest(raw)
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 })
  }

  const requestBody = validated.body
  const { company, entries, adjustments } = requestBody

  const id = randomUUID().slice(0, 8)
  const tmpReq = path.join(os.tmpdir(), `req_${id}.json`)
  const safeName = (company.name || 'FinalAccounts').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40)
  const outPath = path.join(DOWNLOAD_DIR, `${safeName}_${id}.xlsx`)

  try {
    await mkdir(DOWNLOAD_DIR, { recursive: true })
    await writeFile(tmpReq, JSON.stringify(requestBody), 'utf8')
    const result = await runPython(tmpReq, outPath)
    if (!result.ok || !existsSync(outPath)) {
      return NextResponse.json({
        ok: false,
        error: result.error || 'Workbook generation failed',
        trace: result.trace,
      }, { status: 500 })
    }

    const fileBuffer = await readFile(outPath)
    const downloadName = `${safeName}_FinalAccounts.xlsx`

    // Parse the QA results from the Python script (recalc/validate are returned
    // as JSON strings; we want the scalar totals for the response headers).
    let recalcErrors = 'unknown'
    let tbBalanced = 'unknown'
    let bsBalanced = 'unknown'
    try {
      const qa = result.qa || {}
      if (typeof qa.recalc === 'string') {
        const r = JSON.parse(qa.recalc)
        recalcErrors = String(r.total_errors ?? 'unknown')
      } else if (qa.recalc && typeof qa.recalc === 'object') {
        recalcErrors = String((qa.recalc as any).total_errors ?? 'unknown')
      }
      if (typeof qa.tb_balanced === 'boolean') tbBalanced = String(qa.tb_balanced)
      if (typeof qa.bs_balanced === 'boolean') bsBalanced = String(qa.bs_balanced)
    } catch {
      // leave defaults
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${downloadName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
        'Cache-Control': 'no-store',
        'X-Accounts': encodeURIComponent((result.accounts || []).join('|')),
        'X-Accounts-Count': String((result.accounts || []).length),
        'X-Assumptions-Count': String((result.assumptions || []).length),
        'X-Tb-Balanced': tbBalanced,
        'X-Bs-Balanced': bsBalanced,
        'X-Recalc-Errors': recalcErrors,
      },
    })
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err?.message || 'Unexpected server error',
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Audit Report / Financial Statement Builder API',
    endpoint: 'POST /api/generate',
    description:
      'Send company info + journal entries + adjustments; returns a formula-linked .xlsx workbook ' +
      '(Journal -> Trial Balance -> Adjustments -> Trading A/c -> P&L A/c -> Balance Sheet -> Notes).',
    sampleShape: {
      company: { name: 'Firm Name', financialYear: '2024-25', currency: 'NPR', yearEndDate: '31 March 2025' },
      entries: [
        {
          id: 'e1', date: '2024-04-01', narration: 'Started business',
          legs: [{ account: 'Cash in Hand', debit: 100000 }, { account: 'Capital Account', credit: 100000 }],
        },
      ],
      adjustments: [
        { id: 'a1', type: 'closing_stock', account: 'Closing Stock', amount: 40000, narration: 'Stock at year end' },
        { id: 'a2', type: 'depreciation', account: 'Furniture & Fixtures', rate: 10, narration: '10% p.a.' },
      ],
    },
  })
}

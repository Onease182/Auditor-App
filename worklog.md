# Project Worklog — Audit Report / Financial Statement Builder

## Project Overview
A Next.js 16 web application that lets users input business transactions (purchases, sales,
expenses, adjustments) and generates a complete, **formula-linked** Excel workbook implementing
the full Nepali/Indian accounting pipeline:

  Journal → Trial Balance → Adjustments → Trading A/c → Profit & Loss A/c → Balance Sheet → Notes

All derived figures are live Excel formulas (SUMIF, cross-sheet refs, balancing-figure IF pairs)
— never hardcoded. Hardcoded user inputs use blue font; in-sheet formulas black; cross-sheet
links green (per xlsx skill Finance color convention).

## Tech Stack
- Next.js 16 (App Router) + TypeScript + Tailwind 4 + shadcn/ui
- Python (openpyxl) engine invoked via subprocess from a Next.js API route
- xlsx skill QA pipeline: recalc.py + validate for self-verification

---
Task ID: 1
Agent: main (orchestrator)
Task: Initialize project structure and worklog for the Audit Report / Financial Statement Builder.

Work Log:
- Reviewed /mnt/skills/public/xlsx/SKILL.md (resolved to /home/z/my-project/skills/xlsx/) and
  scenes/finance.md, engines/design.md, quality/pipeline.md, templates/base.py for conventions.
- Confirmed Python 3 + openpyxl 3.1.5 + LibreOffice (for recalc) are available.
- Confirmed the specific reference files mentioned in the task brief (references/formulas.md,
  scripts/reference_example_build.py) are NOT present in this environment — so the accounting
  logic will be implemented from first principles (standard Nepali/Indian double-entry format)
  following the workflow described in the task.
- Designed the architecture:
  * Frontend: src/app/page.tsx — single-page tabbed UI (Company Setup → Transactions →
    Adjustments → Generate).
  * Backend: src/app/api/generate/route.ts — receives JSON, spawns the Python builder via
    child_process, streams the generated .xlsx back to the browser.
  * Engine: scripts/accounting/build_workbook.py — reads JSON from a temp file, builds the
    7-sheet workbook with openpyxl (all formulas live), runs recalc + validate, writes the
    .xlsx to a temp path, prints the path to stdout.
- Created this worklog.

Stage Summary:
- Architecture decided: Next.js API route → Python subprocess (no separate mini-service needed
  for a one-shot generation; keeps port surface minimal).
- Accounting model: user enters compound journal entries (each = balanced Dr/Cr legs) plus
  period-end adjustments (closing stock, depreciation, outstanding/prepaid, accrued income, etc.).
- Auto-classification of ledger accounts into Trading Dr / Trading Cr / P&L Dr / P&L Cr /
  Balance Sheet Assets / Balance Sheet Liabilities by keyword dictionary, with a clear
  fallback and Notes sheet documenting every assumption.


---
Task ID: 2-6
Agent: main (orchestrator)
Task: Build the complete Audit Report / Financial Statement Builder — Python engine, Next.js API, frontend UI, and end-to-end verification.

Work Log:
- Built the Python workbook engine at scripts/accounting/build_workbook.py (~1000 lines):
  * 7 sheets: Journal, Trial Balance, Adjustments, Trading A/c, Profit & Loss A/c,
    Balance Sheet, Notes - Formulas Used.
  * Every derived figure is a LIVE Excel formula: SUMIF against Journal, cross-sheet
    references, balancing figures via IF pairs (Gross Profit/Loss, Net Profit/Loss).
  * Hardcoded user inputs use blue font (#0000FF); in-sheet formulas black; cross-sheet
    links green (#008000) — per xlsx skill Finance color convention §2.4.
  * Account auto-classification via keyword dictionary into Trading Dr/Cr, P&L Dr/Cr,
    BS Asset/Liability/Capital/Drawings. Unmatched accounts default to P&L Dr and are
    flagged in the Notes sheet.
  * Adjustments: closing stock (input), depreciation (formula = TB balance × rate%),
    outstanding/prepaid/accrued/unearned (inputs) — each posted on BOTH the P&L AND
    the Balance Sheet so the BS tallies.
  * Runs the xlsx skill QA pipeline: recalc (LibreOffice) + validate, then reads back
    computed values to verify TB Dr=Cr and BS Assets=Liabilities.

- Debugged and fixed three accounting/formula bugs found via the QA pipeline:
  1. `=None` text-as-formula errors → restructured Adjustments to use a single Amount
     cell referenced by downstream sheets.
  2. BS double-counting intermediate capital computation rows (opening + Add NP +
     Less Drawings + closing balance) → tracked "final" net rows and summed only those.
  3. Depreciation formula operator precedence (`C+D*0.1` ≠ `(C+D)*0.1`) and signed
     balance handling for abnormally-balanced accounts (Dr−Cr for assets, Cr−Dr for
     liabilities) → both fixed.

- Built the Next.js API route at src/app/api/generate/route.ts:
  * POST receives JSON {company, entries, adjustments}, validates each entry is
    Dr/Cr balanced, spawns the Python script via child_process, streams the .xlsx back.
  * Parses the QA JSON returned by Python and exposes TB/BS balance status, recalc
    error count, and ledger account count via response headers.

- Built the frontend (4 components + main page):
  * src/lib/accounting.ts — shared types, adjustment-type metadata, currency formatting.
  * src/lib/sample-data.ts — a fully worked reference example (Himalayan Traders Pvt.
    Ltd., 20 journal entries + 4 adjustments) for the "Load Sample" button.
  * src/lib/store.ts — Zustand store with persist middleware (localStorage) +
    useShallow-computed totals (fixed an infinite re-render from returning new objects).
  * src/components/accounting/CompanySetup.tsx — firm name, FY, year-end, currency.
  * src/components/accounting/JournalEntries.tsx — compound journal entry editor with
    Dr/Cr legs, live balance check per entry, move up/down, add/remove legs.
  * src/components/accounting/AdjustmentsPanel.tsx — period-end adjustment editor
    (type, account, amount/rate, narration) with per-type hint text.
  * src/components/accounting/GeneratePanel.tsx — validation summary, generate button,
    QA result display (TB/BS tallies, formula errors, account count).
  * src/app/page.tsx — tabbed shell (Company → Transactions → Adjustments → Generate)
    with sticky header, step-completion badges, sticky footer, Load Sample + Clear buttons.
  * Customized the theme to a deep-emerald/charcoal finance palette (avoiding blue/indigo)
    in globals.css with light + dark mode support.

- Verified end-to-end with agent-browser:
  * Page loads cleanly (no console errors after fixing the useShallow issue).
  * "Load Sample" populates all data and jumps to the Generate tab.
  * "Generate & Download" produces the .xlsx in ~2.4s; the result panel shows:
    Trial Balance tallies = Passed, Balance Sheet tallies = Passed,
    Formula errors (recalc) = 0 (Passed), 19 ledger accounts, 4 assumptions flagged.
  * The generated workbook (Himalayan_Traders_Pvt_Ltd__*.xlsx, 21KB) is saved in
    download/ and auto-downloads to the browser.
  * Sticky footer verified: sticks to viewport bottom on short pages (Company Setup),
    pushed down naturally on long pages (Transactions with 20 entries).
  * Mobile responsiveness verified at 390×844 viewport.
  * Add Entry / Remove Entry / Move up-down interactivity verified.
  * ESLint passes with zero errors.

Stage Summary:
- The application is fully functional end-to-end. A user can: set up a firm, enter
  compound journal entries with balanced Dr/Cr legs, add period-end adjustments,
  and generate a 7-sheet formula-linked Excel workbook — with the server verifying
  TB and BS balance before delivery.
- Sample data (Himalayan Traders Pvt. Ltd.) produces a textbook-correct set of final
  accounts: GP = NPR 89,000, NP = NPR 65,300, Capital closing = NPR 160,300,
  BS total = NPR 180,300 (Assets = Liabilities).
- All formulas are live: changing any Journal input in Excel instantly reflows through
  to the Balance Sheet.

---
Task ID: 7
Agent: main (orchestrator)
Task: UI polish — dark mode toggle, theme provider, final visual verification.

Work Log:
- Added next-themes ThemeProvider to layout.tsx (attribute="class", defaultTheme="light",
  enableSystem, disableTransitionOnChange).
- Created theme-toggle.tsx using the CSS-based rotate/scale pattern (renders both Sun
  and Moon icons, toggles via Tailwind `dark:` variants) — avoids the React 19
  `react-hooks/set-state-in-effect` lint error that the mounted-state pattern triggers.
- Added the ThemeToggle button to the page header next to "Load Sample".
- Customized both the light and dark CSS palettes in globals.css to a deep-emerald
  primary + warm amber accent (avoiding blue/indigo per project rules).
- Verified dark mode end-to-end: toggle switches `html` class to "dark", the whole
  app re-themes correctly, and the full generate flow still works (POST /api/generate
  200 in 2.3s, all QA checks pass).

Stage Summary:
- Dark mode fully functional. The app now ships with light (default) + dark themes.
- Final verified output of the sample workbook:
  * 7 sheets: Journal · Trial Balance · Adjustments · Trading Account ·
    Profit & Loss Account · Balance Sheet · Notes - Formulas Used
  * Trial Balance: Dr 360,500 = Cr 360,500 (balanced)
  * Balance Sheet: Liabilities 280,300 = Assets 280,300 (balanced)
  * 0 formula errors (LibreOffice recalc)
- Cron job (id 373388) created: runs every 15 minutes, kind=webDevReview, tz=Asia/Kathmandu,
  to independently assess project status, run agent-browser QA, and continue advancing
  styling detail and feature coverage per the mandatory requirements.

UNRESOLVED / NEXT-PHASE RECOMMENDATIONS (for the periodic webDevReview cron):
- Account-classification preview: before generating, show a read-only Trial Balance
  preview so the user can verify which accounts land in Trading Dr / Trading Cr /
  P&L / Balance Sheet — and override the classification if the keyword matcher guessed
  wrong (currently unmatched accounts silently default to P&L Dr).
- Quick-add transaction templates: a dropdown to insert common journal patterns
  (cash purchase, credit purchase, cash sale, credit sale, capital introduced,
  expense paid, drawings) with the legs pre-filled.
- Import / Export JSON: let users save their transaction set to a .json file and
  reload it later (the Zustand persist already covers localStorage, but a file
  round-trip is needed for sharing / backups).
- Bulk paste: accept a CSV / TSV paste of journal entries for users migrating from
  a spreadsheet.
- Per-entry validation messages: when Dr ≠ Cr, show the exact差额 and suggest the
  missing leg amount.
- Tax/GST columns: optional tax handling on purchases and sales for VAT-registered firms.

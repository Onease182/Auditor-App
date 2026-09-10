"""
build_workbook.py
=================
Audit Report / Financial Statement Builder — core engine.

Reads a JSON request (company info + journal entries + adjustments) from a file
path given as argv[1], builds a 7-sheet formula-linked Excel workbook implementing
the Nepali / Indian accounting pipeline:

    Journal -> Trial Balance -> Adjustments -> Trading A/c -> Profit & Loss A/c ->
    Balance Sheet -> Notes - Formulas Used

Every derived figure is a LIVE Excel formula (SUMIF, cross-sheet references,
balancing figures via IF). Hardcoded user inputs use blue font; in-sheet formulas
black; cross-sheet links green (IB / xlsx-skill Finance convention).

After building, the script optionally runs the xlsx skill QA pipeline
(recalc + validate) and prints a JSON result to stdout:

    {"ok": true, "path": "/abs/path/to/FinalAccounts.xlsx",
     "tb_balanced": true, "bs_balanced": true, "errors": []}

Usage:
    python3 build_workbook.py <request.json> [--out <out.xlsx>] [--no-qa]
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import traceback
import uuid
from collections import OrderedDict
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

# ─── xlsx skill design tokens (imported via path manipulation) ────────────────
XLSX_SKILL_DIR = "/home/z/my-project/skills/xlsx"
for _sub in (XLSX_SKILL_DIR, os.path.join(XLSX_SKILL_DIR, "templates")):
    if _sub not in sys.path:
        sys.path.insert(0, _sub)

# ─── Finance color convention (xlsx skill §2.4) ──────────────────────────────
COLOR_INPUT = "0000FF"       # blue  — hardcoded user inputs / assumptions
COLOR_FORMULA = "000000"    # black — in-sheet formulas
COLOR_XREF = "008000"       # green — references to another sheet
COLOR_HEADER_BG = "1B2A4A"  # deep blue — section headers
COLOR_SUB_BG = "D6E4F0"     # light blue — sub-headers / totals
COLOR_NEUTRAL = "37352F"
COLOR_LIGHT_ROW = "F7F7F5"
COLOR_MUTED = "8C8A84"

FONT_NAME = "Calibri"

CURRENCY_FMT = '#,##0.00;(#,##0.00);"-"'

# ─── Account classification keywords ─────────────────────────────────────────
TRADING_DR_KEYWORDS = [
    "opening stock", "purchases", "wages", "carriage inward", "carriage inwards",
    "freight inward", "freight inwards", "fuel", "power", "gas", "coal",
    "factory rent", "manufacturing", "import duty", "octroi", "royalty",
]
TRADING_CR_KEYWORDS = ["sales"]
PL_DR_KEYWORDS = [
    "rent", "salary", "salaries", "insurance", "stationery", "postage",
    "telephone", "electricity", "discount allowed", "discount", "commission paid",
    "commission", "interest paid", "interest", "depreciation", "bank charges",
    "advertisement", "advertising", "repairs", "carriage outward",
    "carriage outwards", "freight outward", "general expenses", "administrative",
    "office expenses", "printing", "conveyance", "travelling", "audit fee",
    "bad debts", "provision for doubtful", "miscellaneous expenses",
    "staff welfare", "entertainment", "water", "internet", "subscription",
    "professional fee",
]
PL_CR_KEYWORDS = [
    "discount received", "commission received", "interest received",
    "rent received", "dividend received", "bad debts recovered", "profit on sale",
]
BS_ASSET_KEYWORDS = [
    "cash", "bank", "debtors", "bills receivable", "furniture", "machinery",
    "building", "land", "plant", "equipment", "vehicle", "motor", "computer",
    "stock", "inventory", "prepaid", "advance", "investments", "goodwill",
    "patent", "copyright", "trademark", "loose tools", "tools",
]
BS_LIAB_KEYWORDS = [
    "creditors", "bills payable", "loan", "loans", "bank overdraft", "overdraft",
    "outstanding", "payable", "tax payable", "gst payable", "vat payable",
    "unearned", "income received in advance",
]
CAPITAL_KEYWORDS = ["capital"]
DRAWINGS_KEYWORDS = ["drawings"]


def classify_account(name: str) -> str:
    """Return one of: 'trading_dr','trading_cr','pl_dr','pl_cr','bs_asset',
    'bs_liab','capital','drawings','pl_dr'(default)."""
    n = (name or "").strip().lower()
    if not n:
        return "pl_dr"
    for k in DRAWINGS_KEYWORDS:
        if k in n:
            return "drawings"
    for k in CAPITAL_KEYWORDS:
        if k in n:
            return "capital"
    # sales return is a Dr-side deduction from sales
    if "sales return" in n or "return inward" in n:
        return "trading_dr"
    if "purchase return" in n or "return outward" in n:
        return "trading_cr"
    for k in TRADING_CR_KEYWORDS:
        if k in n:
            return "trading_cr"
    for k in TRADING_DR_KEYWORDS:
        if k in n:
            return "trading_dr"
    for k in PL_CR_KEYWORDS:
        if k in n:
            return "pl_cr"
    for k in PL_DR_KEYWORDS:
        if k in n:
            return "pl_dr"
    for k in BS_ASSET_KEYWORDS:
        if k in n:
            return "bs_asset"
    for k in BS_LIAB_KEYWORDS:
        if k in n:
            return "bs_liab"
    return "pl_dr"


def fnt(color=COLOR_FORMULA, bold=False, size=11, italic=False):
    return Font(name=FONT_NAME, color=color, bold=bold, size=size, italic=italic)


def fill(color):
    return PatternFill("solid", fgColor=color)


def thin_border():
    s = Side(style="thin", color="BFBFBF")
    return Border(left=s, right=s, top=s, bottom=s)


def header_border():
    return Border(bottom=Side(style="medium", color=COLOR_HEADER_BG))


def total_border():
    return Border(
        top=Side(style="thin", color=COLOR_NEUTRAL),
        bottom=Side(style="double", color=COLOR_NEUTRAL),
    )


# ─── Journal sheet ───────────────────────────────────────────────────────────
def build_journal(wb, company, entries):
    ws = wb.create_sheet("Journal")
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = COLOR_HEADER_BG

    ws.merge_cells("A1:F1")
    ws["A1"] = company.get("name", "The Firm")
    ws["A1"].font = fnt(bold=True, size=16)
    ws["A1"].alignment = Alignment(horizontal="center")
    ws.merge_cells("A2:F2")
    ws["A2"] = f"Journal  —  Financial Year {company.get('financialYear', '')}"
    ws["A2"].font = fnt(bold=True, size=12)
    ws["A2"].alignment = Alignment(horizontal="center")
    ws.merge_cells("A3:F3")
    ws["A3"] = (f"Currency: {company.get('currency', 'NPR')}    |    "
                "Blue = user input    |    Black = formula    |    Green = cross-sheet link")
    ws["A3"].font = fnt(color=COLOR_MUTED, size=9, italic=True)
    ws["A3"].alignment = Alignment(horizontal="center")

    header_row = 5
    headers = ["S.No", "Date", "Narration", "Account", "Debit", "Credit"]
    for c, h in enumerate(headers, 1):
        cell = ws.cell(row=header_row, column=c, value=h)
        cell.font = fnt(color="FFFFFF", bold=True)
        cell.fill = fill(COLOR_HEADER_BG)
        cell.alignment = Alignment(horizontal="center")
        cell.border = header_border()

    r = header_row + 1
    sno = 1
    for entry in entries:
        legs = entry.get("legs", [])
        if not legs:
            continue
        for i, leg in enumerate(legs):
            ws.cell(row=r, column=1, value=sno if i == 0 else None).font = fnt()
            ws.cell(row=r, column=2, value=entry.get("date", "") if i == 0 else None).font = fnt()
            ws.cell(row=r, column=3, value=entry.get("narration", "") if i == 0 else None).font = fnt(italic=True, size=10)
            ws.cell(row=r, column=4, value=leg.get("account", "")).font = fnt()
            d = leg.get("debit")
            c = leg.get("credit")
            dc = ws.cell(row=r, column=5, value=d if d else None)
            cc = ws.cell(row=r, column=6, value=c if c else None)
            dc.font = fnt(color=COLOR_INPUT)
            cc.font = fnt(color=COLOR_INPUT)
            for cc_cell in (dc, cc):
                cc_cell.number_format = CURRENCY_FMT
                cc_cell.alignment = Alignment(horizontal="right")
            for col in range(1, 7):
                ws.cell(row=r, column=col).border = thin_border()
                if (r - header_row) % 2 == 0:
                    ws.cell(row=r, column=col).fill = fill(COLOR_LIGHT_ROW)
            r += 1
        sno += 1

    total_row = r
    ws.cell(row=total_row, column=4, value="TOTAL").font = fnt(bold=True)
    ws.cell(row=total_row, column=4).alignment = Alignment(horizontal="right")
    ws.cell(row=total_row, column=5,
            value=f"=SUM(E{header_row+1}:E{total_row-1})")
    ws.cell(row=total_row, column=6,
            value=f"=SUM(F{header_row+1}:F{total_row-1})")
    for col in (5, 6):
        c = ws.cell(row=total_row, column=col)
        c.font = fnt(bold=True)
        c.number_format = CURRENCY_FMT
        c.fill = fill(COLOR_SUB_BG)
        c.border = total_border()
    chk_row = total_row + 1
    ws.cell(row=chk_row, column=4, value="Dr total − Cr total (should be 0)").font = fnt(italic=True, size=10)
    ws.cell(row=chk_row, column=5,
            value=f"=E{total_row}-F{total_row}").font = fnt(bold=True)
    ws.cell(row=chk_row, column=5).number_format = CURRENCY_FMT

    widths = [6, 12, 44, 30, 16, 16]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = f"A{header_row+1}"

    return {
        "sheet": "Journal",
        "data_start": header_row + 1,
        "data_end": total_row - 1,
        "account_col": "D",
        "debit_col": "E",
        "credit_col": "F",
        "total_row": total_row,
    }


# ─── Trial Balance sheet ────────────────────────────────────────────────────
def build_trial_balance(wb, company, journal_meta):
    ws = wb.create_sheet("Trial Balance")
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = COLOR_HEADER_BG

    ws.merge_cells("A1:E1")
    ws["A1"] = company.get("name", "The Firm")
    ws["A1"].font = fnt(bold=True, size=16)
    ws["A1"].alignment = Alignment(horizontal="center")
    ws.merge_cells("A2:E2")
    ws["A2"] = "Trial Balance"
    ws["A2"].font = fnt(bold=True, size=12)
    ws["A2"].alignment = Alignment(horizontal="center")
    ws.merge_cells("A3:E3")
    ws["A3"] = "as at the close of the financial year (pre-adjustment ledger balances)"
    ws["A3"].font = fnt(color=COLOR_MUTED, size=9, italic=True)
    ws["A3"].alignment = Alignment(horizontal="center")

    header_row = 5
    headers = ["Account", "Classification", "Debit (Rs)", "Credit (Rs)"]
    for c, h in enumerate(headers, 1):
        cell = ws.cell(row=header_row, column=c, value=h)
        cell.font = fnt(color="FFFFFF", bold=True)
        cell.fill = fill(COLOR_HEADER_BG)
        cell.alignment = Alignment(horizontal="center")
        cell.border = header_border()

    j_sheet = journal_meta["sheet"]
    j_start = journal_meta["data_start"]
    j_end = journal_meta["data_end"]
    acct_col = f"'{j_sheet}'!${journal_meta['account_col']}${j_start}:${journal_meta['account_col']}${j_end}"
    dr_range = f"'{j_sheet}'!${journal_meta['debit_col']}${j_start}:${journal_meta['debit_col']}${j_end}"
    cr_range = f"'{j_sheet}'!${journal_meta['credit_col']}${j_start}:${journal_meta['credit_col']}${j_end}"

    accounts = journal_meta.get("accounts", [])
    r = header_row + 1
    acct_rows = {}
    for acc in accounts:
        name = acc["name"]
        ws.cell(row=r, column=1, value=name).font = fnt()
        cls = acc["classification"]
        cls_label = {
            "trading_dr": "Trading (Dr)",
            "trading_cr": "Trading (Cr)",
            "pl_dr": "P&L (Dr)",
            "pl_cr": "P&L (Cr)",
            "bs_asset": "BS — Asset",
            "bs_liab": "BS — Liability",
            "capital": "BS — Capital",
            "drawings": "BS — Drawings",
        }.get(cls, "P&L (Dr)")
        ws.cell(row=r, column=2, value=cls_label).font = fnt(color=COLOR_MUTED, size=10)
        # Dr shown = MAX(net, 0); Cr shown = MAX(-net, 0)
        net_expr = f"(SUMIF({acct_col},A{r},{dr_range})-SUMIF({acct_col},A{r},{cr_range}))"
        ws.cell(row=r, column=3,
                value=f"=IF({net_expr}>=0,{net_expr},0)").font = fnt(color=COLOR_XREF)
        ws.cell(row=r, column=4,
                value=f"=IF({net_expr}<0,-{net_expr},0)").font = fnt(color=COLOR_XREF)
        for col in (3, 4):
            ws.cell(row=r, column=col).number_format = CURRENCY_FMT
            ws.cell(row=r, column=col).alignment = Alignment(horizontal="right")
        for col in range(1, 5):
            ws.cell(row=r, column=col).border = thin_border()
            if (r - header_row) % 2 == 0:
                ws.cell(row=r, column=col).fill = fill(COLOR_LIGHT_ROW)
        acct_rows[name] = r
        r += 1

    total_row = r
    ws.cell(row=total_row, column=1, value="TOTAL").font = fnt(bold=True)
    ws.cell(row=total_row, column=1).alignment = Alignment(horizontal="right")
    ws.cell(row=total_row, column=3,
            value=f"=SUM(C{header_row+1}:C{total_row-1})").font = fnt(bold=True)
    ws.cell(row=total_row, column=4,
            value=f"=SUM(D{header_row+1}:D{total_row-1})").font = fnt(bold=True)
    for col in (3, 4):
        ws.cell(row=total_row, column=col).number_format = CURRENCY_FMT
        ws.cell(row=total_row, column=col).alignment = Alignment(horizontal="right")
        ws.cell(row=total_row, column=col).fill = fill(COLOR_SUB_BG)
        ws.cell(row=total_row, column=col).border = total_border()
    chk_row = total_row + 1
    ws.cell(row=chk_row, column=1, value="Dr total − Cr total (should be 0)").font = fnt(italic=True, size=10)
    ws.cell(row=chk_row, column=3, value=f"=C{total_row}-D{total_row}").font = fnt(bold=True)
    ws.cell(row=chk_row, column=3).number_format = CURRENCY_FMT

    widths = [32, 26, 16, 16]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = f"A{header_row+1}"

    return {
        "sheet": "Trial Balance",
        "header_row": header_row,
        "data_start": header_row + 1,
        "data_end": total_row - 1,
        "total_row": total_row,
        "dr_col": "C",
        "cr_col": "D",
        "acct_rows": acct_rows,
    }


# ─── Adjustments sheet ───────────────────────────────────────────────────────
def build_adjustments(wb, company, adjustments, tb_meta):
    """Each adjustment is one row with a single Amount cell. Depreciation amount
    is a formula referencing TB; others are hardcoded blue inputs. The amount_cell
    is later referenced by Trading / P&L / Balance Sheet as needed."""
    ws = wb.create_sheet("Adjustments")
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = "D4820A"

    ws.merge_cells("A1:E1")
    ws["A1"] = company.get("name", "The Firm")
    ws["A1"].font = fnt(bold=True, size=16)
    ws["A1"].alignment = Alignment(horizontal="center")
    ws.merge_cells("A2:E2")
    ws["A2"] = "Adjustments"
    ws["A2"].font = fnt(bold=True, size=12)
    ws["A2"].alignment = Alignment(horizontal="center")
    ws.merge_cells("A3:E3")
    ws["A3"] = ("Period-end items not yet in the Journal. Blue = assumption; "
                "Green = formula linked to Trial Balance.")
    ws["A3"].font = fnt(color=COLOR_MUTED, size=9, italic=True)
    ws["A3"].alignment = Alignment(horizontal="center")

    header_row = 5
    headers = ["#", "Adjustment", "Account / Base", "Amount", "Narration"]
    for c, h in enumerate(headers, 1):
        cell = ws.cell(row=header_row, column=c, value=h)
        cell.font = fnt(color="FFFFFF", bold=True)
        cell.fill = fill(COLOR_HEADER_BG)
        cell.alignment = Alignment(horizontal="center")
        cell.border = header_border()

    tb_sheet = tb_meta["sheet"]
    tb_acct_rows = tb_meta["acct_rows"]
    r = header_row + 1
    adj_meta = []
    sno = 1
    for adj in adjustments:
        atype = adj.get("type", "other")
        acct = adj.get("account", "")
        amt = adj.get("amount")
        rate = adj.get("rate")
        narration = adj.get("narration", "")

        if atype == "depreciation" and acct in tb_acct_rows:
            tb_row = tb_acct_rows[acct]
            base_ref = f"('{tb_sheet}'!C{tb_row}+'{tb_sheet}'!D{tb_row})"
            amount_val = f"={base_ref}*{rate/100.0}"
            amount_font = fnt(color=COLOR_XREF)
            base_display = f"={base_ref}"
            label = f"Depreciation on {acct} @ {rate}% p.a."
        else:
            amount_val = amt if isinstance(amt, (int, float)) else (amt or 0)
            amount_font = fnt(color=COLOR_INPUT)
            base_display = acct
            label = narration or atype.replace("_", " ").title()

        ws.cell(row=r, column=1, value=sno).font = fnt()
        ws.cell(row=r, column=2, value=label).font = fnt()
        bcell = ws.cell(row=r, column=3, value=base_display)
        bcell.font = fnt(color=COLOR_XREF if atype == "depreciation" else COLOR_MUTED,
                          italic=True, size=10)
        acell = ws.cell(row=r, column=4, value=amount_val)
        acell.font = amount_font
        acell.number_format = CURRENCY_FMT
        acell.alignment = Alignment(horizontal="right")
        ws.cell(row=r, column=5, value=narration).font = fnt(color=COLOR_MUTED, size=10)
        for col in range(1, 6):
            ws.cell(row=r, column=col).border = thin_border()
            if (r - header_row) % 2 == 0:
                ws.cell(row=r, column=col).fill = fill(COLOR_LIGHT_ROW)

        adj_meta.append({
            "row": r,
            "type": atype,
            "account": acct,
            "amount_cell": f"'Adjustments'!D{r}",
            "rate": rate,
        })
        r += 1
        sno += 1

    widths = [5, 38, 26, 16, 44]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = f"A{header_row+1}"

    return {
        "sheet": "Adjustments",
        "header_row": header_row,
        "data_start": header_row + 1,
        "data_end": r - 1,
        "items": adj_meta,
    }


# ─── Trading Account sheet ───────────────────────────────────────────────────
def build_trading_account(wb, company, tb_meta, adj_meta):
    ws = wb.create_sheet("Trading Account")
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = COLOR_HEADER_BG

    ws.merge_cells("A1:D1")
    ws["A1"] = company.get("name", "The Firm")
    ws["A1"].font = fnt(bold=True, size=16)
    ws["A1"].alignment = Alignment(horizontal="center")
    ws.merge_cells("A2:D2")
    ws["A2"] = "Trading Account"
    ws["A2"].font = fnt(bold=True, size=12)
    ws["A2"].alignment = Alignment(horizontal="center")
    ws.merge_cells("A3:D3")
    ws["A3"] = f"for the year ended  {company.get('yearEndDate', '')}"
    ws["A3"].font = fnt(color=COLOR_MUTED, size=9, italic=True)
    ws["A3"].alignment = Alignment(horizontal="center")

    header_row = 5
    for c, h in enumerate(["Particulars", "Amount (Dr)", "Particulars", "Amount (Cr)"], 1):
        cell = ws.cell(row=header_row, column=c, value=h)
        cell.font = fnt(color="FFFFFF", bold=True)
        cell.fill = fill(COLOR_HEADER_BG)
        cell.alignment = Alignment(horizontal="center")
        cell.border = header_border()

    tb_sheet = tb_meta["sheet"]
    tb_dr = tb_meta["dr_col"]
    tb_cr = tb_meta["cr_col"]
    tb_acct_rows = tb_meta["acct_rows"]

    closing_stock_cell = None
    for a in adj_meta["items"]:
        if a["type"] == "closing_stock":
            closing_stock_cell = a["amount_cell"]
            break

    dr_items = []
    cr_items = []
    for name, row in tb_acct_rows.items():
        cls = classify_account(name)
        if cls == "trading_dr":
            dr_items.append((f"To {name}", f"='{tb_sheet}'!{tb_dr}{row}+'{tb_sheet}'!{tb_cr}{row}"
                             if "return" in name.lower() else f"='{tb_sheet}'!{tb_dr}{row}",
                             COLOR_XREF))
        elif cls == "trading_cr":
            cr_items.append((f"By {name}", f"='{tb_sheet}'!{tb_cr}{row}+'{tb_sheet}'!{tb_dr}{row}"
                             if "return" in name.lower() else f"='{tb_sheet}'!{tb_cr}{row}",
                             COLOR_XREF))
    if closing_stock_cell:
        cr_items.append(("By Closing Stock (Adjusted)", f"={closing_stock_cell}", COLOR_XREF))

    r = header_row + 1
    dr_start = r
    n = max(len(dr_items), len(cr_items))
    for i in range(n):
        if i < len(dr_items):
            label, formula, color = dr_items[i]
            ws.cell(row=r, column=1, value=label).font = fnt()
            c = ws.cell(row=r, column=2, value=formula)
            c.font = fnt(color=color)
            c.number_format = CURRENCY_FMT
            c.alignment = Alignment(horizontal="right")
        if i < len(cr_items):
            label, formula, color = cr_items[i]
            ws.cell(row=r, column=3, value=label).font = fnt()
            c = ws.cell(row=r, column=4, value=formula)
            c.font = fnt(color=color)
            c.number_format = CURRENCY_FMT
            c.alignment = Alignment(horizontal="right")
        for col in range(1, 5):
            ws.cell(row=r, column=col).border = thin_border()
            if (r - header_row) % 2 == 0:
                ws.cell(row=r, column=col).fill = fill(COLOR_LIGHT_ROW)
        r += 1
    dr_end = r - 1

    gp_row = r
    ws.cell(row=gp_row, column=1, value="To Gross Profit c/d").font = fnt(bold=True)
    ws.cell(row=gp_row, column=3, value="By Gross Loss c/d").font = fnt(bold=True)
    gl_formula = (f"=IF(SUM(D{dr_start}:D{dr_end})>SUM(B{dr_start}:B{dr_end}),"
                  f"SUM(D{dr_start}:D{dr_end})-SUM(B{dr_start}:B{dr_end}),0)")
    gp_formula = (f"=IF(SUM(B{dr_start}:B{dr_end})>SUM(D{dr_start}:D{dr_end}),"
                  f"SUM(B{dr_start}:B{dr_end})-SUM(D{dr_start}:D{dr_end}),0)")
    glc = ws.cell(row=gp_row, column=2, value=gl_formula)
    gpc = ws.cell(row=gp_row, column=4, value=gp_formula)
    for c in (glc, gpc):
        c.font = fnt(color=COLOR_FORMULA, bold=True)
        c.number_format = CURRENCY_FMT
        c.alignment = Alignment(horizontal="right")
    for col in range(1, 5):
        ws.cell(row=gp_row, column=col).border = total_border()
        ws.cell(row=gp_row, column=col).fill = fill(COLOR_SUB_BG)

    total_row = gp_row + 1
    ws.cell(row=total_row, column=1, value="TOTAL").font = fnt(bold=True)
    ws.cell(row=total_row, column=3, value="TOTAL").font = fnt(bold=True)
    ws.cell(row=total_row, column=2,
            value=f"=SUM(B{dr_start}:B{gp_row})").font = fnt(bold=True)
    ws.cell(row=total_row, column=4,
            value=f"=SUM(D{dr_start}:D{gp_row})").font = fnt(bold=True)
    for col in (2, 4):
        ws.cell(row=total_row, column=col).number_format = CURRENCY_FMT
        ws.cell(row=total_row, column=col).alignment = Alignment(horizontal="right")
        ws.cell(row=total_row, column=col).border = total_border()
        ws.cell(row=total_row, column=col).fill = fill(COLOR_SUB_BG)

    widths = [34, 16, 34, 16]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = f"A{header_row+1}"

    return {
        "sheet": "Trading Account",
        "gp_cell": f"'Trading Account'!D{gp_row}",
        "gl_cell": f"'Trading Account'!B{gp_row}",
        "gp_row": gp_row,
    }


# ─── Profit & Loss Account sheet ─────────────────────────────────────────────
def build_profit_loss(wb, company, tb_meta, adj_meta, trading_meta):
    ws = wb.create_sheet("Profit & Loss Account")
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = COLOR_HEADER_BG

    ws.merge_cells("A1:D1")
    ws["A1"] = company.get("name", "The Firm")
    ws["A1"].font = fnt(bold=True, size=16)
    ws["A1"].alignment = Alignment(horizontal="center")
    ws.merge_cells("A2:D2")
    ws["A2"] = "Profit & Loss Account"
    ws["A2"].font = fnt(bold=True, size=12)
    ws["A2"].alignment = Alignment(horizontal="center")
    ws.merge_cells("A3:D3")
    ws["A3"] = f"for the year ended  {company.get('yearEndDate', '')}"
    ws["A3"].font = fnt(color=COLOR_MUTED, size=9, italic=True)
    ws["A3"].alignment = Alignment(horizontal="center")

    header_row = 5
    for c, h in enumerate(["Particulars", "Amount (Dr)", "Particulars", "Amount (Cr)"], 1):
        cell = ws.cell(row=header_row, column=c, value=h)
        cell.font = fnt(color="FFFFFF", bold=True)
        cell.fill = fill(COLOR_HEADER_BG)
        cell.alignment = Alignment(horizontal="center")
        cell.border = header_border()

    tb_sheet = tb_meta["sheet"]
    tb_dr = tb_meta["dr_col"]
    tb_cr = tb_meta["cr_col"]
    tb_acct_rows = tb_meta["acct_rows"]
    gp_cell = trading_meta["gp_cell"]
    gl_cell = trading_meta["gl_cell"]

    r = header_row + 1
    pl_start = r

    # Cr side starts with Gross Profit b/d (= GP + GL, since only one is nonzero)
    ws.cell(row=r, column=3, value="By Gross Profit b/d").font = fnt(bold=True)
    c = ws.cell(row=r, column=4, value=f"={gp_cell}+{gl_cell}")
    c.font = fnt(color=COLOR_XREF, bold=True)
    c.number_format = CURRENCY_FMT
    c.alignment = Alignment(horizontal="right")
    r += 1

    dr_items = []
    cr_items = []
    for name, row in tb_acct_rows.items():
        cls = classify_account(name)
        if cls == "pl_dr":
            dr_items.append((f"To {name}", f"='{tb_sheet}'!{tb_dr}{row}", COLOR_XREF))
        elif cls == "pl_cr":
            cr_items.append((f"By {name}", f"='{tb_sheet}'!{tb_cr}{row}", COLOR_XREF))

    # Adjustment-driven items
    for a in adj_meta["items"]:
        if a["type"] == "depreciation":
            dr_items.append((f"To Depreciation on {a['account']}",
                             f"={a['amount_cell']}", COLOR_XREF))
        elif a["type"] in ("outstanding", "accrued_expense"):
            dr_items.append((f"To Outstanding {a['account']}",
                             f"={a['amount_cell']}", COLOR_XREF))
        elif a["type"] == "prepaid":
            cr_items.append((f"By Prepaid {a['account']}",
                             f"={a['amount_cell']}", COLOR_XREF))
        elif a["type"] == "accrued_income":
            cr_items.append((f"By Accrued {a['account']}",
                             f"={a['amount_cell']}", COLOR_XREF))
        elif a["type"] == "unearned_income":
            dr_items.append((f"To Income received in advance ({a['account']})",
                             f"={a['amount_cell']}", COLOR_XREF))
        elif a["type"] in ("bad_debts", "provision"):
            dr_items.append((f"To {a['account']} (adjustment)",
                             f"={a['amount_cell']}", COLOR_XREF))

    n = max(len(dr_items), len(cr_items))
    for i in range(n):
        if i < len(dr_items):
            label, formula, color = dr_items[i]
            ws.cell(row=r, column=1, value=label).font = fnt()
            c = ws.cell(row=r, column=2, value=formula)
            c.font = fnt(color=color)
            c.number_format = CURRENCY_FMT
            c.alignment = Alignment(horizontal="right")
        if i < len(cr_items):
            label, formula, color = cr_items[i]
            ws.cell(row=r, column=3, value=label).font = fnt()
            c = ws.cell(row=r, column=4, value=formula)
            c.font = fnt(color=color)
            c.number_format = CURRENCY_FMT
            c.alignment = Alignment(horizontal="right")
        for col in range(1, 5):
            ws.cell(row=r, column=col).border = thin_border()
            if (r - header_row) % 2 == 0:
                ws.cell(row=r, column=col).fill = fill(COLOR_LIGHT_ROW)
        r += 1
    pl_end = r - 1

    np_row = r
    ws.cell(row=np_row, column=1, value="To Net Profit (transferred to Capital)").font = fnt(bold=True)
    ws.cell(row=np_row, column=3, value="By Net Loss (transferred to Capital)").font = fnt(bold=True)
    np_formula = (f"=IF(SUM(D{pl_start}:D{pl_end})>SUM(B{pl_start}:B{pl_end}),"
                  f"SUM(D{pl_start}:D{pl_end})-SUM(B{pl_start}:B{pl_end}),0)")
    nl_formula = (f"=IF(SUM(B{pl_start}:B{pl_end})>SUM(D{pl_start}:D{pl_end}),"
                  f"SUM(B{pl_start}:B{pl_end})-SUM(D{pl_start}:D{pl_end}),0)")
    npc = ws.cell(row=np_row, column=2, value=np_formula)
    nlc = ws.cell(row=np_row, column=4, value=nl_formula)
    for c in (npc, nlc):
        c.font = fnt(color=COLOR_FORMULA, bold=True)
        c.number_format = CURRENCY_FMT
        c.alignment = Alignment(horizontal="right")
    for col in range(1, 5):
        ws.cell(row=np_row, column=col).border = total_border()
        ws.cell(row=np_row, column=col).fill = fill(COLOR_SUB_BG)

    total_row = np_row + 1
    ws.cell(row=total_row, column=1, value="TOTAL").font = fnt(bold=True)
    ws.cell(row=total_row, column=3, value="TOTAL").font = fnt(bold=True)
    ws.cell(row=total_row, column=2,
            value=f"=SUM(B{pl_start}:B{np_row})").font = fnt(bold=True)
    ws.cell(row=total_row, column=4,
            value=f"=SUM(D{pl_start}:D{np_row})").font = fnt(bold=True)
    for col in (2, 4):
        ws.cell(row=total_row, column=col).number_format = CURRENCY_FMT
        ws.cell(row=total_row, column=col).alignment = Alignment(horizontal="right")
        ws.cell(row=total_row, column=col).border = total_border()
        ws.cell(row=total_row, column=col).fill = fill(COLOR_SUB_BG)

    widths = [40, 16, 40, 16]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = f"A{header_row+1}"

    return {
        "sheet": "Profit & Loss Account",
        "net_profit_cell": f"'Profit & Loss Account'!B{np_row}",
        "net_loss_cell": f"'Profit & Loss Account'!D{np_row}",
        "np_row": np_row,
    }


# ─── Balance Sheet ───────────────────────────────────────────────────────────
def build_balance_sheet(wb, company, tb_meta, adj_meta, pl_meta):
    ws = wb.create_sheet("Balance Sheet")
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = "1B7D46"

    ws.merge_cells("A1:D1")
    ws["A1"] = company.get("name", "The Firm")
    ws["A1"].font = fnt(bold=True, size=16)
    ws["A1"].alignment = Alignment(horizontal="center")
    ws.merge_cells("A2:D2")
    ws["A2"] = "Balance Sheet"
    ws["A2"].font = fnt(bold=True, size=12)
    ws["A2"].alignment = Alignment(horizontal="center")
    ws.merge_cells("A3:D3")
    ws["A3"] = f"as at  {company.get('yearEndDate', '')}"
    ws["A3"].font = fnt(color=COLOR_MUTED, size=9, italic=True)
    ws["A3"].alignment = Alignment(horizontal="center")

    header_row = 5
    for c, h in enumerate(["Capital & Liabilities", "Amount", "Assets", "Amount"], 1):
        cell = ws.cell(row=header_row, column=c, value=h)
        cell.font = fnt(color="FFFFFF", bold=True)
        cell.fill = fill(COLOR_HEADER_BG)
        cell.alignment = Alignment(horizontal="center")
        cell.border = header_border()

    tb_sheet = tb_meta["sheet"]
    tb_dr = tb_meta["dr_col"]
    tb_cr = tb_meta["cr_col"]
    tb_acct_rows = tb_meta["acct_rows"]

    closing_stock_cell = None
    for a in adj_meta["items"]:
        if a["type"] == "closing_stock":
            closing_stock_cell = a["amount_cell"]
            break

    r_liab = header_row + 1
    liab_start = r_liab
    liab_final_rows = []  # rows that represent the NET liability/capital (not intermediate)

    # Capital (special): opening + NP - NL - drawings = closing
    capital_name = None
    drawings_name = None
    for name, row in tb_acct_rows.items():
        cls = classify_account(name)
        if cls == "capital":
            capital_name = name
        elif cls == "drawings":
            drawings_name = name

    if capital_name:
        crow = tb_acct_rows[capital_name]
        ws.cell(row=r_liab, column=1, value="Capital Account (opening)").font = fnt(bold=True)
        c = ws.cell(row=r_liab, column=2, value=f"='{tb_sheet}'!{tb_cr}{crow}-'{tb_sheet}'!{tb_dr}{crow}")
        c.font = fnt(color=COLOR_XREF, bold=True)
        c.number_format = CURRENCY_FMT
        c.alignment = Alignment(horizontal="right")
        cap_open_row = r_liab
        r_liab += 1
        ws.cell(row=r_liab, column=1, value="   Add: Net Profit (from P&L A/c)").font = fnt()
        c = ws.cell(row=r_liab, column=2, value=f"={pl_meta['net_profit_cell']}")
        c.font = fnt(color=COLOR_XREF)
        c.number_format = CURRENCY_FMT
        c.alignment = Alignment(horizontal="right")
        np_row = r_liab
        r_liab += 1
        ws.cell(row=r_liab, column=1, value="   Less: Net Loss (from P&L A/c)").font = fnt()
        c = ws.cell(row=r_liab, column=2, value=f"={pl_meta['net_loss_cell']}")
        c.font = fnt(color=COLOR_XREF)
        c.number_format = CURRENCY_FMT
        c.alignment = Alignment(horizontal="right")
        nl_row = r_liab
        r_liab += 1
        if drawings_name:
            drow = tb_acct_rows[drawings_name]
            ws.cell(row=r_liab, column=1, value="   Less: Drawings").font = fnt()
            c = ws.cell(row=r_liab, column=2, value=f"='{tb_sheet}'!{tb_dr}{drow}-'{tb_sheet}'!{tb_cr}{drow}")
            c.font = fnt(color=COLOR_XREF)
            c.number_format = CURRENCY_FMT
            c.alignment = Alignment(horizontal="right")
            dr_row = r_liab
            r_liab += 1
            ws.cell(row=r_liab, column=1, value="Capital (closing balance)").font = fnt(bold=True)
            c = ws.cell(row=r_liab, column=2, value=f"=B{cap_open_row}+B{np_row}-B{nl_row}-B{dr_row}")
        else:
            ws.cell(row=r_liab, column=1, value="Capital (closing balance)").font = fnt(bold=True)
            c = ws.cell(row=r_liab, column=2, value=f"=B{cap_open_row}+B{np_row}-B{nl_row}")
        c.font = fnt(color=COLOR_FORMULA, bold=True)
        c.number_format = CURRENCY_FMT
        c.alignment = Alignment(horizontal="right")
        liab_final_rows.append(r_liab)
        r_liab += 1

    # Liabilities
    for name, row in tb_acct_rows.items():
        cls = classify_account(name)
        if cls == "bs_liab":
            ws.cell(row=r_liab, column=1, value=name).font = fnt()
            c = ws.cell(row=r_liab, column=2, value=f"='{tb_sheet}'!{tb_cr}{row}-'{tb_sheet}'!{tb_dr}{row}")
            c.font = fnt(color=COLOR_XREF)
            c.number_format = CURRENCY_FMT
            c.alignment = Alignment(horizontal="right")
            liab_final_rows.append(r_liab)
            r_liab += 1

    for a in adj_meta["items"]:
        if a["type"] in ("outstanding", "accrued_expense"):
            ws.cell(row=r_liab, column=1, value=f"Outstanding {a['account']}").font = fnt()
            c = ws.cell(row=r_liab, column=2, value=f"={a['amount_cell']}")
            c.font = fnt(color=COLOR_XREF)
            c.number_format = CURRENCY_FMT
            c.alignment = Alignment(horizontal="right")
            liab_final_rows.append(r_liab)
            r_liab += 1
        elif a["type"] == "unearned_income":
            ws.cell(row=r_liab, column=1, value=f"Income received in advance ({a['account']})").font = fnt()
            c = ws.cell(row=r_liab, column=2, value=f"={a['amount_cell']}")
            c.font = fnt(color=COLOR_XREF)
            c.number_format = CURRENCY_FMT
            c.alignment = Alignment(horizontal="right")
            liab_final_rows.append(r_liab)
            r_liab += 1

    liab_end = r_liab - 1

    # Assets side
    r_asset = header_row + 1
    asset_start = r_asset
    asset_final_rows = []  # rows that represent the NET asset value

    # Fixed assets (with optional depreciation)
    fixed_assets = []
    current_assets_tb = []
    for name, row in tb_acct_rows.items():
        cls = classify_account(name)
        if cls == "bs_asset":
            low = name.lower()
            if low.startswith("cash") or "bank" in low or "debtor" in low or "bills receivable" in low:
                current_assets_tb.append((name, row))
            elif "stock" in low or "inventory" in low or "prepaid" in low or "advance" in low:
                pass  # closing stock comes from adjustments; prepaid from adjustments
            else:
                fixed_assets.append((name, row))

    dep_map = {}
    for a in adj_meta["items"]:
        if a["type"] == "depreciation":
            dep_map[a["account"]] = a["amount_cell"]

    for name, row in fixed_assets:
        ws.cell(row=r_asset, column=3, value=name).font = fnt()
        c = ws.cell(row=r_asset, column=4, value=f"='{tb_sheet}'!{tb_dr}{row}-'{tb_sheet}'!{tb_cr}{row}")
        c.font = fnt(color=COLOR_XREF)
        c.number_format = CURRENCY_FMT
        c.alignment = Alignment(horizontal="right")
        gross_row = r_asset
        r_asset += 1
        if name in dep_map:
            ws.cell(row=r_asset, column=3, value="   Less: Depreciation").font = fnt(color=COLOR_MUTED, size=10)
            c = ws.cell(row=r_asset, column=4, value=f"={dep_map[name]}")
            c.font = fnt(color=COLOR_XREF)
            c.number_format = CURRENCY_FMT
            c.alignment = Alignment(horizontal="right")
            dep_row = r_asset
            r_asset += 1
            ws.cell(row=r_asset, column=3, value=f"{name} (after depreciation)").font = fnt(bold=True)
            c = ws.cell(row=r_asset, column=4, value=f"=D{gross_row}-D{dep_row}")
            c.font = fnt(color=COLOR_FORMULA, bold=True)
            c.number_format = CURRENCY_FMT
            c.alignment = Alignment(horizontal="right")
            asset_final_rows.append(r_asset)
            r_asset += 1
        else:
            asset_final_rows.append(gross_row)

    # Closing stock (from adjustments)
    if closing_stock_cell:
        ws.cell(row=r_asset, column=3, value="Closing Stock (Adjusted)").font = fnt()
        c = ws.cell(row=r_asset, column=4, value=f"={closing_stock_cell}")
        c.font = fnt(color=COLOR_XREF)
        c.number_format = CURRENCY_FMT
        c.alignment = Alignment(horizontal="right")
        asset_final_rows.append(r_asset)
        r_asset += 1

    # Current assets from TB
    for name, row in current_assets_tb:
        ws.cell(row=r_asset, column=3, value=name).font = fnt()
        c = ws.cell(row=r_asset, column=4, value=f"='{tb_sheet}'!{tb_dr}{row}-'{tb_sheet}'!{tb_cr}{row}")
        c.font = fnt(color=COLOR_XREF)
        c.number_format = CURRENCY_FMT
        c.alignment = Alignment(horizontal="right")
        asset_final_rows.append(r_asset)
        r_asset += 1

    # Prepaid / accrued income (from adjustments)
    for a in adj_meta["items"]:
        if a["type"] == "prepaid":
            ws.cell(row=r_asset, column=3, value=f"Prepaid {a['account']}").font = fnt()
            c = ws.cell(row=r_asset, column=4, value=f"={a['amount_cell']}")
            c.font = fnt(color=COLOR_XREF)
            c.number_format = CURRENCY_FMT
            c.alignment = Alignment(horizontal="right")
            asset_final_rows.append(r_asset)
            r_asset += 1
        elif a["type"] == "accrued_income":
            ws.cell(row=r_asset, column=3, value=f"Accrued {a['account']}").font = fnt()
            c = ws.cell(row=r_asset, column=4, value=f"={a['amount_cell']}")
            c.font = fnt(color=COLOR_XREF)
            c.number_format = CURRENCY_FMT
            c.alignment = Alignment(horizontal="right")
            asset_final_rows.append(r_asset)
            r_asset += 1

    asset_end = r_asset - 1

    # Borders for filled rows
    max_r = max(r_liab, r_asset)
    for rr in range(header_row + 1, max_r + 1):
        for col in range(1, 5):
            ws.cell(row=rr, column=col).border = thin_border()
            if (rr - header_row) % 2 == 0:
                ws.cell(row=rr, column=col).fill = fill(COLOR_LIGHT_ROW)

    # TOTAL row — placed at max of both sides; sum only the NET (final) cells,
    # not the intermediate capital/depreciation computation rows.
    total_row = max(r_liab, r_asset)
    ws.cell(row=total_row, column=1, value="TOTAL").font = fnt(bold=True)
    ws.cell(row=total_row, column=3, value="TOTAL").font = fnt(bold=True)
    liab_sum = "+".join(f"B{rr}" for rr in liab_final_rows) if liab_final_rows else "0"
    asset_sum = "+".join(f"D{rr}" for rr in asset_final_rows) if asset_final_rows else "0"
    ws.cell(row=total_row, column=2,
            value=f"={liab_sum}").font = fnt(bold=True)
    ws.cell(row=total_row, column=4,
            value=f"={asset_sum}").font = fnt(bold=True)
    for col in (2, 4):
        ws.cell(row=total_row, column=col).number_format = CURRENCY_FMT
        ws.cell(row=total_row, column=col).alignment = Alignment(horizontal="right")
        ws.cell(row=total_row, column=col).border = total_border()
        ws.cell(row=total_row, column=col).fill = fill(COLOR_SUB_BG)

    chk_row = total_row + 1
    ws.cell(row=chk_row, column=1, value="Balance check (Liabilities − Assets, should be 0)").font = fnt(italic=True, size=10)
    c = ws.cell(row=chk_row, column=2, value=f"=B{total_row}-D{total_row}")
    c.font = fnt(bold=True)
    c.number_format = CURRENCY_FMT

    widths = [42, 16, 42, 16]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = f"A{header_row+1}"

    return {
        "sheet": "Balance Sheet",
        "total_row": total_row,
        "liab_total_cell": f"'Balance Sheet'!B{total_row}",
        "asset_total_cell": f"'Balance Sheet'!D{total_row}",
    }


# ─── Notes sheet ─────────────────────────────────────────────────────────────
def build_notes(wb, company, assumptions_log):
    ws = wb.create_sheet("Notes - Formulas Used")
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = COLOR_MUTED

    ws.merge_cells("A1:C1")
    ws["A1"] = "Notes — Formulas Used & Assumptions"
    ws["A1"].font = fnt(bold=True, size=14)
    ws["A1"].alignment = Alignment(horizontal="center")

    ws.merge_cells("A2:C2")
    ws["A2"] = ("Every figure in this workbook is a live Excel formula. "
                "Blue = user input / assumption. Green = cross-sheet reference. "
                "Black = in-sheet formula.")
    ws["A2"].font = fnt(color=COLOR_MUTED, size=9, italic=True)
    ws["A2"].alignment = Alignment(horizontal="center", wrap_text=True)
    ws.row_dimensions[2].height = 30

    header_row = 4
    for c, h in enumerate(["#", "Equation / Rule", "Where used"], 1):
        cell = ws.cell(row=header_row, column=c, value=h)
        cell.font = fnt(color="FFFFFF", bold=True)
        cell.fill = fill(COLOR_HEADER_BG)
        cell.alignment = Alignment(horizontal="center")
        cell.border = header_border()

    notes = [
        ("Double-entry rule: every journal entry has ΣDebit = ΣCredit",
         "Journal sheet — TOTAL row + Dr−Cr check"),
        ("Trial Balance: Account Dr balance = MAX(SUMIF(Journal.Account, name, Journal.Debit) "
         "− SUMIF(...,Journal.Credit), 0); Cr balance = MAX(negative of that, 0)",
         "Trial Balance — columns C (Dr) and D (Cr)"),
        ("Trial Balance must balance: ΣDr = ΣCr (Dr−Cr check row = 0)",
         "Trial Balance — TOTAL + check rows"),
        ("Closing Stock is a period-end input, posted only via Adjustments sheet",
         "Adjustments → Trading A/c (Cr) + Balance Sheet (Asset)"),
        ("Depreciation = (Trial Balance asset balance) × rate%",
         "Adjustments sheet → Balance Sheet (deducted from asset) + P&L (Dr)"),
        ("Gross Profit = (Sales + Closing Stock) − (Opening Stock + Purchases + Direct Expenses)",
         "Trading Account — Gross Profit c/d / Gross Loss c/d (IF pair)"),
        ("Net Profit = (Gross Profit + Indirect Incomes) − Indirect Expenses",
         "P&L A/c — Net Profit / Net Loss (IF pair)"),
        ("Closing Capital = Opening Capital + Net Profit − Net Loss − Drawings",
         "Balance Sheet — Capital (closing balance) row"),
        ("Balance Sheet identity: Total Assets = Total Capital & Liabilities",
         "Balance Sheet — TOTAL rows + balance check"),
        ("Why it must balance: every adjustment is posted on BOTH the "
         "Trading/P&L (expense/income effect) AND the Balance Sheet "
         "(asset/liability effect). If you post only one side, the Balance "
         "Sheet will not tally.",
         "All adjustment rows — see Adjustments sheet"),
    ]
    r = header_row + 1
    for i, (eqn, where) in enumerate(notes, 1):
        ws.cell(row=r, column=1, value=i).font = fnt()
        ws.cell(row=r, column=2, value=eqn).font = fnt()
        ws.cell(row=r, column=3, value=where).font = fnt(color=COLOR_MUTED, size=10)
        ws.cell(row=r, column=2).alignment = Alignment(wrap_text=True, vertical="top")
        ws.cell(row=r, column=3).alignment = Alignment(wrap_text=True, vertical="top")
        for col in range(1, 4):
            ws.cell(row=r, column=col).border = thin_border()
            if (r - header_row) % 2 == 0:
                ws.cell(row=r, column=col).fill = fill(COLOR_LIGHT_ROW)
        ws.row_dimensions[r].height = 36
        r += 1

    # Assumptions section
    r += 1
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=3)
    ws.cell(row=r, column=1, value="Assumptions (clearly flagged — NOT from user data)").font = fnt(bold=True, size=12)
    ws.cell(row=r, column=1).fill = fill(COLOR_SUB_BG)
    r += 1
    for i, a in enumerate(assumptions_log, 1):
        ws.cell(row=r, column=1, value=f"A{i}").font = fnt(bold=True)
        ws.cell(row=r, column=2, value=a).font = fnt()
        ws.cell(row=r, column=2).alignment = Alignment(wrap_text=True, vertical="top")
        ws.merge_cells(start_row=r, start_column=2, end_row=r, end_column=3)
        for col in range(1, 4):
            ws.cell(row=r, column=col).border = thin_border()
        ws.row_dimensions[r].height = 30
        r += 1

    ws.column_dimensions["A"].width = 5
    ws.column_dimensions["B"].width = 72
    ws.column_dimensions["C"].width = 40


# ─── Main build function ─────────────────────────────────────────────────────
def build(request: dict, out_path: str) -> dict:
    company = request.get("company", {})
    entries = request.get("entries", [])
    adjustments = request.get("adjustments", [])

    wb = Workbook()
    wb.properties.creator = "Z.ai"
    wb.remove(wb.active)

    accounts = OrderedDict()
    assumptions_log = []
    all_keywords = (TRADING_DR_KEYWORDS + TRADING_CR_KEYWORDS + PL_DR_KEYWORDS
                    + PL_CR_KEYWORDS + BS_ASSET_KEYWORDS + BS_LIAB_KEYWORDS
                    + CAPITAL_KEYWORDS + DRAWINGS_KEYWORDS)
    for entry in entries:
        for leg in entry.get("legs", []):
            name = (leg.get("account") or "").strip()
            if not name or name in accounts:
                continue
            cls = classify_account(name)
            accounts[name] = {"name": name, "classification": cls}
            if cls == "pl_dr" and not any(k in name.lower() for k in all_keywords):
                assumptions_log.append(
                    f'Account "{name}" did not match any classification keyword; '
                    f'defaulted to "P&L (Dr) — expense". Rename or re-tag if incorrect.')

    for adj in adjustments:
        atype = adj.get("type", "other")
        if atype == "closing_stock":
            assumptions_log.append(
                f"Closing Stock value Rs {adj.get('amount', 0)} is a period-end "
                f"assumption (not derived from the Journal).")
        elif atype == "depreciation":
            assumptions_log.append(
                f"Depreciation @ {adj.get('rate', 0)}% on {adj.get('account', '')} "
                f"is a policy assumption.")
        elif atype in ("outstanding", "prepaid", "accrued_income", "accrued_expense",
                       "unearned_income", "bad_debts", "provision"):
            assumptions_log.append(
                f"Adjustment \"{adj.get('narration', atype)}\" (Rs {adj.get('amount', 0)}) "
                f"is a period-end assumption.")
    if not adjustments:
        assumptions_log.append("No period-end adjustments were provided. "
                               "Closing stock, depreciation and accruals are all zero.")
    if not company.get("yearEndDate"):
        assumptions_log.append("Year-end date was not provided; left blank in statements.")

    j_meta = build_journal(wb, company, entries)
    j_meta["accounts"] = list(accounts.values())
    tb_meta = build_trial_balance(wb, company, j_meta)
    adj_meta = build_adjustments(wb, company, adjustments, tb_meta)
    tr_meta = build_trading_account(wb, company, tb_meta, adj_meta)
    pl_meta = build_profit_loss(wb, company, tb_meta, adj_meta, tr_meta)
    bs_meta = build_balance_sheet(wb, company, tb_meta, adj_meta, pl_meta)
    build_notes(wb, company, assumptions_log)

    wb.save(out_path)
    return {
        "out_path": out_path,
        "tb_total_row": tb_meta["total_row"],
        "bs_total_row": bs_meta["total_row"],
        "accounts": list(accounts.keys()),
        "assumptions": assumptions_log,
    }


def run_qa(path: str, tb_total_row: int) -> dict:
    results = {"recalc": None, "validate": None, "tb_balanced": None,
               "bs_balanced": None, "errors": []}
    xlsx_py = os.path.join(XLSX_SKILL_DIR, "xlsx.py")
    try:
        out = subprocess.run(["python3", xlsx_py, "recalc", path],
                             capture_output=True, text=True, timeout=120)
        results["recalc"] = out.stdout + out.stderr
        if out.returncode != 0:
            results["errors"].append(f"recalc exit {out.returncode}")
    except Exception as e:
        results["errors"].append(f"recalc exception: {e}")

    try:
        out = subprocess.run(["python3", xlsx_py, "validate", path],
                             capture_output=True, text=True, timeout=60)
        results["validate"] = out.stdout + out.stderr
        if out.returncode != 0:
            results["errors"].append(f"validate exit {out.returncode}")
    except Exception as e:
        results["errors"].append(f"validate exception: {e}")

    try:
        from openpyxl import load_workbook
        wb = load_workbook(path, data_only=True)
        tb = wb["Trial Balance"]
        tb_dr = tb.cell(row=tb_total_row, column=3).value
        tb_cr = tb.cell(row=tb_total_row, column=4).value
        results["tb_dr_total"] = tb_dr
        results["tb_cr_total"] = tb_cr
        results["tb_balanced"] = (isinstance(tb_dr, (int, float)) and
                                  isinstance(tb_cr, (int, float)) and
                                  abs(tb_dr - tb_cr) < 0.01)
        bs = wb["Balance Sheet"]
        bs_total_row = None
        for row in range(6, bs.max_row + 1):
            if bs.cell(row=row, column=1).value == "TOTAL":
                bs_total_row = row
                break
        if bs_total_row:
            bs_liab = bs.cell(row=bs_total_row, column=2).value
            bs_asset = bs.cell(row=bs_total_row, column=4).value
            results["bs_liab_total"] = bs_liab
            results["bs_asset_total"] = bs_asset
            results["bs_balanced"] = (isinstance(bs_liab, (int, float)) and
                                      isinstance(bs_asset, (int, float)) and
                                      abs(bs_liab - bs_asset) < 0.01)
    except Exception as e:
        results["errors"].append(f"verify exception: {e}")

    return results


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "missing request json path"}))
        sys.exit(2)
    req_path = sys.argv[1]
    out_path = None
    no_qa = False
    i = 2
    while i < len(sys.argv):
        a = sys.argv[i]
        if a == "--out" and i + 1 < len(sys.argv):
            out_path = sys.argv[i + 1]
            i += 2
            continue
        if a == "--no-qa":
            no_qa = True
        i += 1
    with open(req_path, "r", encoding="utf-8") as f:
        request = json.load(f)
    if not out_path:
        out_path = os.path.join(tempfile.gettempdir(),
                               f"FinalAccounts_{uuid.uuid4().hex[:8]}.xlsx")
    try:
        meta = build(request, out_path)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e),
                          "trace": traceback.format_exc()}))
        sys.exit(1)

    qa = None
    if not no_qa:
        qa = run_qa(out_path, meta["tb_total_row"])

    result = {
        "ok": True,
        "path": out_path,
        "accounts": meta["accounts"],
        "assumptions": meta["assumptions"],
        "qa": qa,
    }
    print(json.dumps(result, default=str))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Render the UI-only user manual to a paginated, printable PDF."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import simpleSplit
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    LongTable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    TableStyle,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "USER_MANUAL_UI_TESTING.md"
VERSION = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
OUTPUT = ROOT / "output" / "pdf" / f"MobileShopERP_User_Manual_UI_Test_Guide_v{VERSION}.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

REGULAR = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
BOLD = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
MONO = Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf")
pdfmetrics.registerFont(TTFont("Manual", str(REGULAR)))
pdfmetrics.registerFont(TTFont("Manual-Bold", str(BOLD)))
pdfmetrics.registerFont(TTFont("Manual-Mono", str(MONO)))
pdfmetrics.registerFontFamily("Manual", normal="Manual", bold="Manual-Bold")

GREEN = colors.HexColor("#047857")
DARK = colors.HexColor("#172522")
MUTED = colors.HexColor("#52625d")
PALE = colors.HexColor("#ecfdf5")
BORDER = colors.HexColor("#dbe7df")

styles = {
    "cover_title": ParagraphStyle("cover_title", fontName="Manual-Bold", fontSize=28, leading=34, textColor=DARK, spaceAfter=15),
    "cover_sub": ParagraphStyle("cover_sub", fontName="Manual", fontSize=16, leading=23, textColor=GREEN, spaceAfter=24),
    "h1": ParagraphStyle("h1", fontName="Manual-Bold", fontSize=18, leading=24, textColor=DARK, spaceAfter=13, spaceBefore=4),
    "h2": ParagraphStyle("h2", fontName="Manual-Bold", fontSize=12.5, leading=18, textColor=GREEN, spaceBefore=18, spaceAfter=6, keepWithNext=True),
    "h3": ParagraphStyle("h3", fontName="Manual-Bold", fontSize=10.5, leading=15, textColor=DARK, spaceBefore=12, spaceAfter=5, keepWithNext=True),
    "body": ParagraphStyle("body", fontName="Manual", fontSize=9.1, leading=14.3, textColor=DARK, spaceAfter=8),
    "list": ParagraphStyle("list", fontName="Manual", fontSize=9.1, leading=14.3, textColor=DARK, leftIndent=14, firstLineIndent=-11, spaceAfter=5),
    "cell": ParagraphStyle("cell", fontName="Manual", fontSize=7.7, leading=11.3, textColor=DARK),
    "cell_head": ParagraphStyle("cell_head", fontName="Manual-Bold", fontSize=7.8, leading=11.4, textColor=colors.white),
}


def inline(value: str) -> str:
    value = html.escape(value.strip())
    value = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"`(.+?)`", r'<font name="Manual-Mono" size="8">\1</font>', value)
    return value.replace("  ", "<br/>")


def table_widths(rows: list[list[str]], available: float) -> list[float]:
    columns = len(rows[0])
    if columns == 2:
        ratios = [0.27, 0.73]
    elif columns == 3 and rows[0][0].strip() == "ID":
        ratios = [0.09, 0.45, 0.46]
    elif columns == 3:
        ratios = [0.25, 0.28, 0.47]
    else:
        ratios = [1 / columns] * columns
    return [available * ratio for ratio in ratios]


def build_table(raw_rows: list[str], available: float) -> LongTable:
    rows = [[item.strip() for item in line.strip().strip("|").split("|")] for line in raw_rows]
    rows = [rows[0]] + rows[2:]  # Skip Markdown's separator row.
    widths = table_widths(rows, available)
    cells = [
        [Paragraph(inline(item), styles["cell_head" if index == 0 else "cell"]) for item in row]
        for index, row in enumerate(rows)
    ]
    table = LongTable(cells, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GREEN),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7faf8")]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, GREEN),
        ("LINEBELOW", (0, 1), (-1, -1), 0.35, BORDER),
        ("BOX", (0, 0), (-1, -1), 0.4, BORDER),
    ]))
    return table


def on_page(canvas, doc):
    width, height = A4
    canvas.saveState()
    if doc.page == 1:
        canvas.setFillColor(GREEN)
        canvas.rect(0, height - 20, width, 20, fill=1, stroke=0)
        canvas.setFillColor(PALE)
        canvas.rect(0, 0, width, 175, fill=1, stroke=0)
        canvas.setFillColor(GREEN)
        canvas.roundRect(48, 128, width - 96, 4, 2, fill=1, stroke=0)
    else:
        canvas.setStrokeColor(BORDER)
        canvas.line(46, height - 43, width - 46, height - 43)
        canvas.setFont("Manual-Bold", 8)
        canvas.setFillColor(GREEN)
        canvas.drawString(48, height - 34, "MOBILE SHOP ERP  /  USER MANUAL + UI TEST GUIDE")
        canvas.line(46, 44, width - 46, 44)
        canvas.setFont("Manual", 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(48, 30, f"Desktop v{VERSION}  |  UI-only testing")
        canvas.drawRightString(width - 48, 30, str(doc.page))
    canvas.restoreState()


def render():
    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    story = []
    paragraph: list[str] = []
    available = A4[0] - 96
    first_heading = True
    first_subtitle = True

    def flush_paragraph():
        if paragraph:
            story.append(Paragraph(inline(" ".join(paragraph)), styles["body"]))
            paragraph.clear()

    index = 0
    while index < len(lines):
        line = lines[index].strip()
        if not line:
            flush_paragraph()
            index += 1
            continue
        if line.startswith("|"):
            flush_paragraph()
            table_lines = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                table_lines.append(lines[index])
                index += 1
            story.append(build_table(table_lines, available))
            story.append(Spacer(1, 10))
            continue
        if line.startswith("# "):
            flush_paragraph()
            if first_heading:
                story.extend([Spacer(1, 90), Paragraph(inline(line[2:]), styles["cover_title"])])
                first_heading = False
            else:
                story.extend([PageBreak(), Paragraph(inline(line[2:]), styles["h1"]), HRFlowable(width="100%", thickness=1, color=GREEN, spaceAfter=16)])
            index += 1
            continue
        if line.startswith("## "):
            flush_paragraph()
            style = "cover_sub" if first_subtitle else "h2"
            story.append(Paragraph(inline(line[3:]), styles[style]))
            first_subtitle = False
            index += 1
            continue
        if line.startswith("### "):
            flush_paragraph()
            story.append(Paragraph(inline(line[4:]), styles["h3"]))
            index += 1
            continue
        if re.match(r"^\d+\. ", line):
            flush_paragraph()
            story.append(Paragraph(inline(line), styles["list"]))
            index += 1
            continue
        if line.startswith("- "):
            flush_paragraph()
            story.append(Paragraph("- " + inline(line[2:]), styles["list"]))
            index += 1
            continue
        paragraph.append(line)
        index += 1
    flush_paragraph()

    pdf = SimpleDocTemplate(
        str(OUTPUT), pagesize=A4, rightMargin=48, leftMargin=48,
        topMargin=60, bottomMargin=58, title="Mobile Shop ERP User Manual and UI Test Guide",
        author="Mobile Shop ERP", subject="End-to-end desktop user manual and UI-only QA guide",
    )
    pdf.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(OUTPUT)


if __name__ == "__main__":
    render()

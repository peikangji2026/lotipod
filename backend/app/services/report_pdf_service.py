"""
生成测试计划 PDF 报告（使用 reportlab）
"""
import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_CENTER, TA_LEFT

import os

# 注册中文字体（macOS 内置 PingFang / Windows 内置 SimHei）
_FONT_NAME = "Helvetica"   # 回退英文字体
_FONT_REGISTERED = False

def _try_register_chinese_font():
    global _FONT_NAME, _FONT_REGISTERED
    if _FONT_REGISTERED:
        return
    candidates = [
        # macOS
        "/System/Library/Fonts/PingFang.ttc",
        "/Library/Fonts/Arial Unicode MS.ttf",
        # Linux
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        "/usr/share/fonts/truetype/arphic/uming.ttc",
        # Windows
        "C:/Windows/Fonts/simhei.ttf",
        "C:/Windows/Fonts/msyh.ttc",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont("ChineseFont", path))
                _FONT_NAME = "ChineseFont"
                break
            except Exception:
                continue
    _FONT_REGISTERED = True


_STATUS_LABELS = {
    "passed":  "通过",
    "failed":  "失败",
    "blocked": "阻塞",
    "skipped": "跳过",
    "pending": "待执行",
}

_RESULT_COLORS = {
    "passed":  colors.HexColor("#52c41a"),
    "failed":  colors.HexColor("#ff4d4f"),
    "blocked": colors.HexColor("#fa8c16"),
    "skipped": colors.HexColor("#8c8c8c"),
    "pending": colors.HexColor("#bfbfbf"),
}


def generate_plan_report_pdf(summary: dict) -> bytes:
    """
    接收 plan_summary 字典（与 /summary 端点返回结构相同），
    生成 PDF 并返回 bytes。
    """
    _try_register_chinese_font()
    fn = _FONT_NAME

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title", fontName=fn, fontSize=18, alignment=TA_CENTER,
        spaceAfter=6, textColor=colors.HexColor("#1677ff"),
    )
    h2_style = ParagraphStyle(
        "H2", fontName=fn, fontSize=13, spaceAfter=4, spaceBefore=12,
        textColor=colors.HexColor("#262626"),
    )
    body_style = ParagraphStyle(
        "Body", fontName=fn, fontSize=10, leading=14,
        textColor=colors.HexColor("#595959"),
    )
    meta_style = ParagraphStyle(
        "Meta", fontName=fn, fontSize=9, textColor=colors.HexColor("#8c8c8c"),
        alignment=TA_CENTER, spaceAfter=4,
    )

    plan = summary.get("plan", {})
    overview = summary.get("overview", {})
    items = summary.get("items", [])

    story = []

    # ── 标题 ────────────────────────────────────────────────────────
    story.append(Paragraph(f"测试报告：{plan.get('name', '')}", title_style))
    date_range = ""
    if plan.get("start_date"):
        date_range = f"{plan['start_date']} ~ {plan.get('end_date', '至今')}"
    story.append(Paragraph(
        f"状态：{plan.get('status', '')}　　时间范围：{date_range or '未设置'}　　"
        f"生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}",
        meta_style,
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e8e8e8"), spaceAfter=10))

    # ── 执行概况 ─────────────────────────────────────────────────────
    story.append(Paragraph("执行概况", h2_style))
    ov_data = [
        ["总用例", "已执行", "通过", "失败", "阻塞", "通过率", "执行率"],
        [
            str(overview.get("total", 0)),
            str(overview.get("executed", 0)),
            str(overview.get("passed", 0)),
            str(overview.get("failed", 0)),
            str(overview.get("blocked", 0)),
            f"{overview.get('pass_rate', 0)}%",
            f"{overview.get('execute_rate', 0)}%",
        ],
    ]
    ov_table = Table(ov_data, colWidths=[None] * 7, repeatRows=1)
    ov_table.setStyle(TableStyle([
        ("FONTNAME",    (0, 0), (-1, -1), fn),
        ("FONTSIZE",    (0, 0), (-1, -1), 10),
        ("BACKGROUND",  (0, 0), (-1, 0), colors.HexColor("#1677ff")),
        ("TEXTCOLOR",   (0, 0), (-1, 0), colors.white),
        ("ALIGN",       (0, 0), (-1, -1), "CENTER"),
        ("GRID",        (0, 0), (-1, -1), 0.5, colors.HexColor("#d9d9d9")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f5f5")]),
        ("TOPPADDING",  (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(ov_table)
    story.append(Spacer(1, 10))

    # ── 执行明细 ─────────────────────────────────────────────────────
    story.append(Paragraph("用例执行明细", h2_style))

    detail_header = ["类型", "用例名称", "优先级", "执行结果", "备注"]
    detail_rows = [detail_header]
    for item in items:
        case_type_label = "API" if item.get("case_type") == "api" else "功能"
        result = item.get("result", "pending")
        detail_rows.append([
            case_type_label,
            item.get("case_name", f"#{item.get('case_id', '')}"),
            item.get("priority", "-"),
            _STATUS_LABELS.get(result, result),
            item.get("comment") or "",
        ])

    col_widths = [25 * mm, 70 * mm, 20 * mm, 25 * mm, None]
    detail_table = Table(detail_rows, colWidths=col_widths, repeatRows=1)

    row_styles: list = [
        ("FONTNAME",    (0, 0), (-1, -1), fn),
        ("FONTSIZE",    (0, 0), (-1, -1), 9),
        ("BACKGROUND",  (0, 0), (-1, 0), colors.HexColor("#1677ff")),
        ("TEXTCOLOR",   (0, 0), (-1, 0), colors.white),
        ("ALIGN",       (0, 0), (0, -1), "CENTER"),
        ("ALIGN",       (2, 0), (3, -1), "CENTER"),
        ("GRID",        (0, 0), (-1, -1), 0.5, colors.HexColor("#d9d9d9")),
        ("TOPPADDING",  (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("WORDWRAP",    (1, 1), (1, -1), True),
    ]
    # 行交替背景
    for i in range(1, len(detail_rows)):
        bg = colors.white if i % 2 == 1 else colors.HexColor("#f5f5f5")
        row_styles.append(("BACKGROUND", (0, i), (-1, i), bg))
    # 结果列着色
    for i, item in enumerate(items, start=1):
        result = item.get("result", "pending")
        c = _RESULT_COLORS.get(result, colors.HexColor("#8c8c8c"))
        row_styles.append(("TEXTCOLOR", (3, i), (3, i), c))

    detail_table.setStyle(TableStyle(row_styles))
    story.append(detail_table)

    doc.build(story)
    return buf.getvalue()

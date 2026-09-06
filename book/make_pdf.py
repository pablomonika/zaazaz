# -*- coding: utf-8 -*-
"""
مولّد PDF لكتاب «نظام الطيبات» — مقاس A5، RTL، بهوامش تجليد متبادلة،
ترويسات وأرقام صفحات، جداول، صناديق، وفهرس بنقاط واصلة.
يعتمد على: reportlab + arabic_reshaper + python-bidi + خط Amiri.
"""
import re, html as htmlmod
from html.parser import HTMLParser

from reportlab.lib.pagesizes import A5
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily, stringWidth
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
    Table, TableStyle, PageBreak, HRFlowable, Image
)

import arabic_reshaper
from bidi.algorithm import get_display

# ----------------------------- الخطوط -----------------------------
FONT_DIR = '/tmp/amiri/fonts/'
pdfmetrics.registerFont(TTFont('Amiri', FONT_DIR + 'Amiri-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Amiri-Bold', FONT_DIR + 'Amiri-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Amiri-Italic', FONT_DIR + 'Amiri-Italic.ttf'))
pdfmetrics.registerFont(TTFont('Amiri-BoldItalic', FONT_DIR + 'Amiri-BoldItalic.ttf'))
registerFontFamily('Amiri', normal='Amiri', bold='Amiri-Bold',
                   italic='Amiri-Italic', boldItalic='Amiri-BoldItalic')

# ----------------------------- الألوان -----------------------------
GREEN = colors.HexColor('#1E4620')
GREEN_SOFT = colors.HexColor('#2C5A2E')
GOLD = colors.HexColor('#C5A059')
GOLD_LIGHT = colors.HexColor('#D9BD85')
GOLD_PALE = colors.HexColor('#F8F3E7')
TEXT = colors.HexColor('#222222')
MUTED = colors.HexColor('#6B6B6B')
LINE = colors.HexColor('#E2DBC9')
TABLE_ALT = colors.HexColor('#F5F2E9')
BOX_QUOTE = colors.HexColor('#FBF8EF')
BOX_SUMMARY = colors.HexColor('#EEF3EC')
BOX_WARN = colors.HexColor('#FBF3E7')

# ----------------------------- المقاسات -----------------------------
PAGE_W, PAGE_H = A5
M_TOP = M_BOTTOM = 18 * mm
OUTER = 15 * mm
INNER = 18 * mm
FRAME_W = PAGE_W - OUTER - INNER
FRAME_H = PAGE_H - M_TOP - M_BOTTOM

# ----------------------------- تحويل النص -----------------------------
def reshape(t):
    # رموز غير متوفرة في خط Amiri → بدائل متوفرة
    t = (t.replace('❋', '٭')
          .replace('✦', '٭')
          .replace('✓', '•'))
    try:
        return arabic_reshaper.reshape(t)
    except Exception:
        return t

def bidi(t):
    try:
        return get_display(t)
    except Exception:
        return t

def shaped(t):
    return bidi(reshape(t))

def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def ar_num(n):
    d = {'0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤',
         '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩'}
    return ''.join(d.get(c, c) for c in str(n))

# ----------------------------- الأنماط -----------------------------
def S(name, **kw):
    base = dict(fontName='Amiri', fontSize=11, leading=20,
                textColor=TEXT, alignment=TA_JUSTIFY,
                spaceBefore=0, spaceAfter=6)
    base.update(kw)
    return ParagraphStyle(name, **base)

STYLES = {
    'cover_basmala': S('cover_basmala', fontSize=15, textColor=GREEN,
                       alignment=TA_CENTER, spaceAfter=10),
    'cover_title': S('cover_title', fontName='Amiri-Bold', fontSize=30, leading=44,
                     textColor=GREEN, alignment=TA_CENTER, spaceAfter=8),
    'cover_sub': S('cover_sub', fontSize=13.5, leading=24,
                   textColor=MUTED, alignment=TA_CENTER),
    'cover_foot': S('cover_foot', fontSize=10, leading=18,
                    textColor=MUTED, alignment=TA_CENTER),
    'orn': S('orn', fontSize=11, textColor=GOLD, alignment=TA_CENTER),
    'part_kicker': S('part_kicker', fontSize=13, textColor=GOLD,
                     alignment=TA_CENTER, spaceAfter=4),
    'part_h1': S('part_h1', fontName='Amiri-Bold', fontSize=26, leading=40,
                 textColor=GREEN, alignment=TA_CENTER, spaceAfter=10),
    'verse': S('verse', fontSize=15, leading=28, textColor=GREEN,
               alignment=TA_CENTER, spaceAfter=0),
    'verse_ref': S('verse_ref', fontSize=9.5, textColor=GOLD,
                   alignment=TA_CENTER, spaceAfter=10),
    'h1': S('h1', fontName='Amiri-Bold', fontSize=20, leading=30,
            textColor=GREEN, alignment=TA_RIGHT, spaceBefore=4, spaceAfter=10),
    'h2': S('h2', fontName='Amiri-Bold', fontSize=15.5, leading=26,
            textColor=GREEN, alignment=TA_RIGHT, spaceBefore=8, spaceAfter=8),
    'h3': S('h3', fontName='Amiri-Bold', fontSize=12.5, leading=22,
            textColor=GREEN_SOFT, alignment=TA_RIGHT, spaceBefore=6, spaceAfter=4),
    'kicker': S('kicker', fontSize=10.5, textColor=GOLD,
                alignment=TA_RIGHT, spaceAfter=2),
    'body': S('body'),
    'lead': S('lead', fontSize=11.5, textColor=GREEN_SOFT),
    'box_title': S('box_title', fontName='Amiri-Bold', fontSize=10.5,
                   textColor=GREEN, alignment=TA_RIGHT, spaceAfter=4),
    'box_body': S('box_body', fontSize=10, leading=17),
    'quote_body': S('quote_body', fontName='Amiri', fontSize=11, leading=20),
    'quote_source': S('quote_source', fontSize=9, textColor=MUTED,
                      alignment=TA_RIGHT, spaceBefore=2),
    'toc_h': S('toc_h', fontName='Amiri-Bold', fontSize=20, textColor=GREEN,
               alignment=TA_RIGHT, spaceAfter=12),
    'toc_part': S('toc_part', fontName='Amiri-Bold', fontSize=11.5, leading=20,
                  textColor=GREEN, alignment=TA_RIGHT, spaceBefore=6, spaceAfter=2),
    'toc_ch': S('toc_ch', fontSize=10, leading=18, alignment=TA_RIGHT,
                spaceAfter=1),
    'cell': S('cell', fontSize=9.5, leading=15, alignment=TA_RIGHT),
}

# ----------------------------- محلل HTML -----------------------------
VOID_TAGS = {'meta', 'link', 'hr', 'input', 'col', 'wbr',
             'source', 'area', 'base', 'embed', 'param', 'track'}
SELF_CLOSING = {'img', 'br'}

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = {'tag': '#root', 'attrs': {}, 'children': []}
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        if tag in VOID_TAGS:
            return
        if tag in SELF_CLOSING:
            node = {'tag': tag, 'attrs': dict(attrs), 'children': []}
            self.stack[-1]['children'].append(node)
            return
        node = {'tag': tag, 'attrs': dict(attrs), 'children': []}
        self.stack[-1]['children'].append(node)
        self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        node = {'tag': tag, 'attrs': dict(attrs), 'children': []}
        self.stack[-1]['children'].append(node)

    def handle_endtag(self, tag):
        if tag in VOID_TAGS:
            return
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i]['tag'] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        self.stack[-1]['children'].append({'tag': '#text', 'text': data})

def cls(node):
    return node['attrs'].get('class', '').split()

def has_id(node):
    return node['attrs'].get('id', '')

def flatten_text(node):
    out = []
    for c in node['children']:
        if c['tag'] == '#text':
            out.append(c['text'])
        else:
            out.append(flatten_text(c))
    return ''.join(out)

# ----------------------------- بناء الفقرات -----------------------------
def segs(node):
    """قائمة مقاطع (نص، عريض) بالترتيب المنطقي."""
    parts = []
    def walk(n):
        for c in n['children']:
            if c['tag'] == '#text':
                parts.append((c['text'], False))
            elif c['tag'] in ('strong', 'b'):
                parts.append((flatten_text(c), True))
            elif c['tag'] == 'br':
                parts.append(('<br/>', False))
            else:
                walk(c)
    walk(node)
    return parts

def para_markup(node):
    """تحويل عقدة نصية إلى markup عربي RTL جاهز للعرض."""
    parts = segs(node)
    visual = []
    for text, bold in reversed(parts):
        if text == '<br/>':
            visual.append('<br/>')
            continue
        s = esc(shaped(text))
        if bold:
            s = '<b>' + s + '</b>'
        visual.append(s)
    return ''.join(visual)

def P(node, style):
    return Paragraph(para_markup(node), STYLES[style])

def plain_shaped(node):
    return shaped(flatten_text(node))

# ----------------------------- صناديق -----------------------------
BOX_STYLE = {
    'note':    (GOLD_PALE, GOLD),
    'quote':   (BOX_QUOTE, GOLD),
    'summary': (BOX_SUMMARY, GREEN),
    'warning': (BOX_WARN, colors.HexColor('#B9822F')),
}

def render_box(node):
    bg, border = BOX_STYLE.get(cls(node)[0], (GOLD_PALE, GOLD))
    inner = []
    title = None
    for c in node['children']:
        if c['tag'] == 'span' and 'box-title' in cls(c):
            title = P(c, 'box_title')
        elif c['tag'] == 'p':
            inner.append(P(c, 'box_body'))
        elif c['tag'] in ('ol', 'ul'):
            inner.extend(render_list(c, 'box_body'))
        elif c['tag'] == '#text':
            pass
        else:
            inner.append(P(c, 'box_body'))
    if title:
        inner.insert(0, title)
    if not inner:
        return []
    cell_flow = inner
    t = Table([[cell_flow]], colWidths=[FRAME_W])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), bg),
        ('BOX', (0, 0), (-1, -1), 0.75, border),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
    ]))
    return [Spacer(1, 4 * mm), t, Spacer(1, 4 * mm)]

# ----------------------------- قوائم -----------------------------
def render_list(node, style='body', ordered=False):
    flow = []
    idx = 0
    for c in node['children']:
        if c['tag'] == 'li':
            idx += 1
            mark = f'{ar_num(idx)}. ' if ordered else '• '
            txt = flatten_text(c)
            p = Paragraph(shaped(esc(mark + txt)), STYLES[style])
            flow.append(p)
    return flow

# ----------------------------- جداول -----------------------------
def render_table(node):
    caption = None
    rows = []
    for c in node['children']:
        if c['tag'] == 'caption':
            caption = plain_shaped(c)
        elif c['tag'] == 'thead':
            for tr in c['children']:
                if tr['tag'] == 'tr':
                    rows.append(('head', [plain_shaped(td) for td in tr['children'] if td['tag'] == 'th']))
        elif c['tag'] == 'tbody':
            for tr in c['children']:
                if tr['tag'] == 'tr':
                    cells = [plain_shaped(td) for td in tr['children'] if td['tag'] == 'td']
                    rows.append(('body', cells))
    if not rows:
        return []
    # عكس الأعمدة ليكون الجدول RTL (العمود الأول يمينًا)
    data = []
    for kind, cells in rows:
        data.append(list(reversed(cells)))
    ncol = max(len(r) for r in data)
    col_w = FRAME_W / ncol
    t = Table(data, colWidths=[col_w] * ncol, repeatRows=1)
    style = [
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, LINE),
        ('FONT', (0, 0), (-1, -1), 'Amiri', 9.5),
        ('TEXTCOLOR', (0, 0), (-1, -1), TEXT),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]
    # رأس الجدول
    style.append(('BACKGROUND', (0, 0), (-1, 0), GREEN))
    style.append(('TEXTCOLOR', (0, 0), (-1, 0), colors.white))
    style.append(('FONT', (0, 0), (-1, 0), 'Amiri-Bold', 9.5))
    # تظليل الصفوف البديلة
    for i in range(1, len(data)):
        if i % 2 == 0:
            style.append(('BACKGROUND', (0, i), (-1, i), TABLE_ALT))
    t.setStyle(TableStyle(style))
    flow = [Spacer(1, 3 * mm)]
    if caption:
        flow.append(Paragraph(esc(caption), S('caption', fontName='Amiri-Bold',
                                              fontSize=10.5, textColor=GREEN,
                                              alignment=TA_RIGHT, spaceAfter=3)))
    flow.append(t)
    flow.append(Spacer(1, 4 * mm))
    return flow

# ----------------------------- العناوين (مع تسجيل للفهرس) -----------------------------
class HeadingRecorder:
    def __init__(self):
        self.entries = []   # (level, title, id)
        self.page_map = {}

def render_img(node):
    src = node['attrs'].get('src', '')
    path = '/home/user/zaazaz/book/' + src
    classes = cls(node)
    width = None
    if 'cover-img' in classes:
        width = 56 * mm
    elif 'foods' in classes:
        width = 70 * mm
    elif 'part-img' in classes:
        width = 44 * mm
    try:
        from PIL import Image as PILImage
        w, h = PILImage.open(path).size
        height = width * (h / w)
        return [Image(path, width=width, height=height), Spacer(1, 4 * mm)]
    except Exception:
        return []

def render_section(node, rec, out, new_page=True):
    classes = cls(node)
    ident = has_id(node)

    if 'cover' in classes:
        # صفحة العنوان أو الإهداء
        if new_page:
            out.append(PageBreak())
        if 'dedication' in classes:
            out.append(Spacer(1, 30 * mm))
            first = True
            for c in node['children']:
                if c['tag'] == 'p' and 'basmala' in cls(c):
                    p = P(c, 'cover_basmala')
                    if ident and first:
                        p._toc_id = ident
                        first = False
                    out.append(p)
            out.append(Spacer(1, 14 * mm))
            for c in node['children']:
                if c['tag'] == 'div' and 'dedication-body' in cls(c):
                    for d in c['children']:
                        if d['tag'] == 'p':
                            out.append(P(d, 'cover_sub'))
                        elif d['tag'] == 'div':
                            out.append(P(d, 'orn'))
            return
        # صفحة العنوان
        out.append(Spacer(1, 20 * mm))
        for c in node['children']:
            if c['tag'] == 'p' and 'basmala' in cls(c):
                out.append(P(c, 'cover_basmala'))
            elif c['tag'] == 'img':
                out.extend(render_img(c))
        out.append(Spacer(1, 10 * mm))
        for c in node['children']:
            if c['tag'] == 'div' and 'cover-ornament' in cls(c):
                out.append(P(c, 'orn'))
        out.append(Paragraph(shaped('نظام الطَّيِّبات'), STYLES['cover_title']))
        for c in node['children']:
            if c['tag'] == 'p' and 'book-subtitle' in cls(c):
                out.append(P(c, 'cover_sub'))
        for c in node['children']:
            if c['tag'] == 'div' and 'cover-ornament' in cls(c):
                out.append(P(c, 'orn'))
        out.append(Spacer(1, 34 * mm))
        for c in node['children']:
            if c['tag'] == 'div' and 'cover-foot' in cls(c):
                out.append(P(c, 'cover_foot'))
        return

    if 'copyright' in classes:
        if new_page:
            out.append(PageBreak())
        out.append(Spacer(1, 30 * mm))
        for c in node['children']:
            if c['tag'] == 'div' and 'cp-title' in cls(c):
                out.append(P(c, 'cover_title'))
            elif c['tag'] == 'p':
                out.append(P(c, 'cover_foot'))
            elif c['tag'] == 'div' and 'ornament' in cls(c):
                out.append(P(c, 'orn'))
        return

    if 'bookmap' in classes or 'toc' in classes:
        return  # نتجاوز خريطة الكتاب وفهرس HTML، ونبني فهرسًا خاصًا بنا

    if 'part' in classes:
        if new_page:
            out.append(PageBreak())
        out.append(Spacer(1, 10 * mm))
        for c in node['children']:
            if c['tag'] == 'div' and 'part-kicker' in cls(c):
                out.append(P(c, 'part_kicker'))
        for c in node['children']:
            if c['tag'] == 'h1':
                p = P(c, 'part_h1')
                if ident:
                    p._toc_id = ident
                    rec.entries.append((0, flatten_text(c), ident))
                out.append(p)
        for c in node['children']:
            if c['tag'] == 'div' and 'ornament' in cls(c):
                out.append(P(c, 'orn'))
            elif c['tag'] == 'img':
                out.extend(render_img(c))
            if c['tag'] == 'p' and 'verse' in cls(c):
                out.append(P(c, 'verse'))
            if c['tag'] == 'p' and 'verse-ref' in cls(c):
                out.append(P(c, 'verse_ref'))
        for c in node['children']:
            if c['tag'] == 'p' and 'part-lead' in cls(c):
                out.append(P(c, 'body'))
        return

    if 'chapter' in classes or 'front' in classes:
        if new_page:
            out.append(PageBreak())
        for c in node['children']:
            if c['tag'] == 'div' and ('chapter-kicker' in cls(c) or 'part-kicker' in cls(c)):
                out.append(P(c, 'kicker'))
            elif c['tag'] == 'h1':
                p = P(c, 'h1')
                if ident:
                    p._toc_id = ident
                    rec.entries.append((0, flatten_text(c), ident))
                out.append(p)
                out.append(HRFlowable(width='100%', thickness=1, color=GOLD))
                out.append(Spacer(1, 3 * mm))
            elif c['tag'] == 'h2':
                p = P(c, 'h2')
                if ident:
                    p._toc_id = ident
                    rec.entries.append((1, flatten_text(c), ident))
                out.append(p)
            elif c['tag'] == 'h3':
                out.append(P(c, 'h3'))
            elif c['tag'] == 'img':
                out.extend(render_img(c))
            elif c['tag'] == 'p':
                out.append(P(c, 'body'))
            elif c['tag'] == 'ul':
                out.extend(render_list(c, 'body'))
            elif c['tag'] == 'ol':
                out.extend(render_list(c, 'body', ordered=True))
            elif c['tag'] == 'table':
                out.extend(render_table(c))
            elif c['tag'] == 'div':
                dcls = cls(c)
                if set(dcls) & {'note', 'quote', 'summary', 'warning'}:
                    out.extend(render_box(c))
                elif 'ornament' in dcls:
                    out.append(P(c, 'orn'))
                else:
                    out.extend(render_div_generic(c))
    return

def render_div_generic(node):
    flow = []
    for c in node['children']:
        if c['tag'] == 'p':
            flow.append(P(c, 'body'))
        elif c['tag'] in ('ul',):
            flow.extend(render_list(c, 'body'))
        elif c['tag'] in ('ol',):
            flow.extend(render_list(c, 'body', ordered=True))
    return flow

# ----------------------------- الفهرس -----------------------------
def collect_entries(sections):
    entries = []
    for s in sections:
        if s['tag'] == 'nav':
            continue
        classes = cls(s)
        if 'bookmap' in classes or 'toc' in classes:
            continue
        ident = has_id(s)
        if 'cover' in classes and 'dedication' in classes:
            entries.append((0, 'الإهداء', ident))
            continue
        if 'part' in classes:
            for c in s.get('children', []):
                if c['tag'] == 'h1':
                    entries.append((0, flatten_text(c), ident))
        elif 'front' in classes:
            for c in s.get('children', []):
                if c['tag'] == 'h1':
                    entries.append((0, flatten_text(c), ident))
        elif 'chapter' in classes:
            for c in s.get('children', []):
                if c['tag'] == 'h1':
                    entries.append((0, flatten_text(c), ident))
                elif c['tag'] == 'h2':
                    entries.append((1, flatten_text(c), ident))
    return entries

def build_toc(entries, page_map):
    flow = [Paragraph(shaped('فهرس المحتويات'), STYLES['toc_h'])]
    for level, title, ident in entries:
        pg = page_map.get(ident) or 0
        tt = reshape(title)               # نص منطقي مشكّل (بدون bidi)
        pgnum = ar_num(pg)
        style = STYLES['toc_part'] if level == 0 else STYLES['toc_ch']
        size = style.fontSize
        font = style.fontName
        avail = FRAME_W - (12 * mm if level == 1 else 0)
        dot = '·'
        dw = stringWidth(dot, font, size)
        tw = stringWidth(tt, font, size)
        pw = stringWidth(pgnum, font, size)
        ndots = max(1, int((avail - tw - pw - 14) / dw))
        indent = '    ' if level == 1 else ''
        line = indent + tt + ' ' + (dot * ndots) + ' ' + pgnum
        p = Paragraph(bidi(line), style)
        flow.append(p)
    return flow

# ----------------------------- قالب المستند -----------------------------
class BookDoc(BaseDocTemplate):
    def __init__(self, filename, rec):
        self.rec = rec
        frame_odd = Frame(OUTER, M_BOTTOM, FRAME_W, FRAME_H, id='fo')
        frame_even = Frame(INNER, M_BOTTOM, FRAME_W, FRAME_H, id='fe')
        BaseDocTemplate.__init__(self, filename, pagesize=A5,
                                 leftMargin=OUTER, rightMargin=INNER,
                                 topMargin=M_TOP, bottomMargin=M_BOTTOM,
                                 title='نظام الطيبات — الدليل الشامل',
                                 author='توثيق منهج الدكتور ضياء العوضي')
        self.addPageTemplates([
            PageTemplate(id='odd', frames=[frame_odd], onPage=self.on_page),
            PageTemplate(id='even', frames=[frame_even], onPage=self.on_page),
        ])

    def handle_pageBegin(self):
        self._handle_pageBegin()
        self._handle_nextPageTemplate('odd' if (self.page % 2 == 1) else 'even')

    def afterFlowable(self, flowable):
        if getattr(flowable, '_toc_id', None):
            self.rec.page_map[flowable._toc_id] = self.page

    def on_page(self, canvas, doc):
        if doc.page == 1:
            return
        w, h = PAGE_W, PAGE_H
        # ترويسة
        header = shaped('altayebaat.com ٭ نظام الطيبات ٭')
        canvas.saveState()
        canvas.setFont('Amiri', 8)
        canvas.setFillColor(GOLD)
        canvas.drawCentredString(w / 2, h - 34, header)
        canvas.setStrokeColor(GOLD_LIGHT)
        canvas.setLineWidth(0.4)
        canvas.line(OUTER, h - 40, w - OUTER, h - 40)
        # تذييل
        page_no = shaped(f'٭ صفحة {ar_num(doc.page)} ٭')
        canvas.setFont('Amiri', 9)
        canvas.setFillColor(GREEN)
        if doc.page % 2 == 1:
            canvas.drawRightString(w - OUTER, 30, page_no)
        else:
            canvas.drawString(INNER, 30, page_no)
        canvas.setStrokeColor(GOLD_LIGHT)
        canvas.setLineWidth(0.4)
        canvas.line(OUTER, 40, w - OUTER, 40)
        canvas.restoreState()

# ----------------------------- التنفيذ -----------------------------
def main():
    html = open('/home/user/zaazaz/book/index.html', encoding='utf-8').read()
    parser = Parser()
    parser.feed(html)
    root = parser.root

    body = None
    def find_body(n):
        for c in n.get('children', []):
            if c['tag'] == 'body':
                return c
            r = find_body(c)
            if r:
                return r
        return None
    body = find_body(root)
    assert body is not None

    sections = [c for c in body['children'] if c['tag'] in ('section', 'nav')]

    entries = collect_entries(sections)

    def render_story(sections, with_toc=None):
        rec = HeadingRecorder()
        story = []
        for idx, s in enumerate(sections):
            if 'toc' in cls(s) or 'bookmap' in cls(s):
                continue
            if with_toc is not None and 'part' in cls(s) and has_id(s) == 'part1':
                story.append(PageBreak())
                story.extend(build_toc(entries, with_toc))
            render_section(s, rec, story, new_page=(idx != 0))
        return story, rec

    # التمريرة 1: بدون فهرس (لأخذ رقم بدئي)
    story0, rec0 = render_story(sections, with_toc=None)
    doc0 = BookDoc('/tmp/book_pass1.pdf', rec0)
    doc0.build(story0)

    # التمريرة 2: مع فهرس (أرقام ابتدائية) — يجمع المواضع الصحيحة
    story1, rec1 = render_story(sections, with_toc=rec0.page_map)
    doc1 = BookDoc('/tmp/book_pass2.pdf', rec1)
    doc1.build(story1)

    # التمريرة 3: نهائية بأرقام صفحات صحيحة
    story2, rec2 = render_story(sections, with_toc=rec1.page_map)
    out_path = '/home/user/zaazaz/book/Nizam-AlTayyibat-book.pdf'
    doc2 = BookDoc(out_path, rec2)
    doc2.build(story2)
    print('PDF written:', out_path)

if __name__ == '__main__':
    main()

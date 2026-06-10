"""Generate FR + EN datasheet PDFs for each product from products.json."""
import json
import os
import re
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak, Flowable
)
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT, TA_CENTER

ROOT = Path(__file__).parent
DATA = json.loads((ROOT / "data" / "products.json").read_text(encoding="utf-8"))
IMG_DIR = ROOT / "assets" / "images"
OUT_DIR = ROOT / "assets" / "datasheets"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Brand fonts (embedded). Falls back to Helvetica if the TTFs are absent. ──
_FONTS = ROOT / "assets" / "fonts"
def _reg(name, fn):
    p = _FONTS / fn
    if p.exists():
        try:
            pdfmetrics.registerFont(TTFont(name, str(p)))
            return name
        except Exception:
            pass
    return None
F_TITLE = _reg("SSATitle", "BebasNeue-Regular.ttf") or "Helvetica-Bold"
F_REG   = _reg("SSA",      "Jost-Regular.ttf")      or "Helvetica"
F_MED   = _reg("SSAMed",   "Jost-Medium.ttf")       or "Helvetica"
F_SB    = _reg("SSASB",    "Jost-SemiBold.ttf")     or "Helvetica-Bold"
F_B     = _reg("SSAB",     "Jost-Bold.ttf")         or "Helvetica-Bold"

# Embedded product images are downsized to PDF_IMG_MAX before being placed in
# the PDF. The image is only rendered at 60mm in the layout, so 400px @ 150dpi
# is more than enough for print quality — this slashes datasheet PDF size by ~60%.
PDF_IMG_MAX = 400
_PDF_IMG_CACHE = ROOT / "assets" / "_pdf_img_cache"
_PDF_IMG_CACHE.mkdir(exist_ok=True)

def _pdf_optimized_image_path(src_path, max_px=PDF_IMG_MAX):
    """Return a downsized (max_px) cached copy suitable for PDF embedding.
    Text-containing images (spec grid, dimension diagrams) use a higher max_px so
    they stay crisp at full width; product photos stay light. The cache is keyed by
    (max_px, name) and invalidated when the source mtime is newer."""
    try:
        from PIL import Image as _PILImage
    except ImportError:
        return src_path
    if not src_path.exists():
        return src_path
    cache_path = _PDF_IMG_CACHE / f"{max_px}_{src_path.name}"
    if cache_path.exists() and cache_path.stat().st_mtime > src_path.stat().st_mtime:
        return cache_path
    try:
        im = _PILImage.open(src_path)
        w, h = im.size
        if max(w, h) > max_px:
            scale = max_px / max(w, h)
            im = im.resize((int(w*scale), int(h*scale)), _PILImage.LANCZOS)
        if im.mode == 'RGBA':
            im.save(cache_path, 'PNG', optimize=True)
        else:
            im = im.convert('RGB')
            cache_path = cache_path.with_suffix('.jpg')
            im.save(cache_path, 'JPEG', quality=82, optimize=True)
        return cache_path
    except Exception:
        return src_path

# Charte graphique SSA 2019 : orange #f7a600, noir #1d1d1b, gris #969696
PRIMARY = colors.HexColor("#f7a600")
PRIMARY_DARK = colors.HexColor("#d68f00")
SECONDARY = colors.HexColor("#1d1d1b")
ACCENT = colors.HexColor("#1d1d1b")
BG = colors.HexColor("#faf8f3")
TEXT = colors.HexColor("#1d1d1b")
TEXT_SOFT = colors.HexColor("#3c3c3a")
MUTED = colors.HexColor("#757572")
BORDER = colors.HexColor("#e9e5dc")
CODE_COL = colors.HexColor("#a87100")        # codes SSA dans le tableau
LOGO_PATH = ROOT / "assets" / "brand" / "ssa-logo-white.png"

# Company contact block — printed in the footer of every PDF page.
# TODO: compléter avec les vraies coordonnées SSA (site, email, téléphone, adresse).
CONTACT = {
    "company": "SSA — Solutions Solaires Adaptées",
    "website": "ssa.green",
    "address": "118 rue Anthonin Bonnaud, 84120 Pertuis, FRANCE",
    "email": "ssa@ssa.green",
    "phone": "04 84 85 60 32",
}

LABELS = {
    "fr": {
        "family": "Famille",
        "description": "Description technique",
        "features": "Caractéristiques",
        "variants": "Tableau des variants",
        # Headers are now read from DATA["i18n"]["fr"]["table_headers"] (dict
        # keyed by column name) to support family-specific table schemas.
        "footer": "Fiche technique · 2026",
        "disclaimer": "Les données techniques peuvent être modifiées sans préavis.",
        "references": "Références",
        "cap_dim": "Dimensions",
        "cap_use": "En situation",
        "tagline": "Solutions Solaires Adaptées",
    },
    "en": {
        "family": "Family",
        "description": "Technical description",
        "features": "Features",
        "variants": "Variants table",
        "footer": "Technical datasheet · 2026",
        "disclaimer": "Technical data is subject to change without prior notice.",
        "references": "References",
        "cap_dim": "Dimensions",
        "cap_use": "In use",
        "tagline": "Solar & LED lighting solutions",
    },
}


def family_name(family, lang):
    return family["name_fr"] if lang == "fr" else family["name_en"]


# ─── Badge system: colored chips for features/certifications ───────────────
# Each badge gets categorized into a color family. Pure ReportLab (no SVG
# imports / no copyrighted logos used).
BADGE_PALETTE = {
    "ip":         ("#1e4379", "#142e57"),  # IP rating       — primary blue
    "ik":         ("#536878", "#3a4855"),  # IK rating       — steel gray
    "cert":       ("#1e7a3a", "#155a2b"),  # Certifications  — green (safety)
    "protocol":   ("#6c3a8e", "#4d2965"),  # DALI/CASAMBI/SPD — purple (tech)
    "sensor":     ("#10728c", "#0a4f63"),  # PIR/Microwave/Photocell — teal
    "corrosion":  ("#b35500", "#7a3a00"),  # Anti-corrosion  — orange (protective)
    "battery":    ("#b88010", "#7d5610"),  # Solar/battery   — gold
    "food":       ("#728900", "#4c5b00"),  # Food-grade NSF/HACCP — olive
    "default":    ("#5a6478", "#3e4555"),  # Anything else   — slate
}

_CERT_LITERALS = {
    "ATEX", "IECEx", "NEC", "NEC / CEC", "NEMA 4X", "UL 1598",
    "Class I", "Class II", "Class I / II", "DIN 57710-13",
}
_PROTOCOL_LITERALS = {
    "DALI 2.0", "CASAMBI", "Zhaga", "Zhaga Book18", "0-10V", "1-10V",
    "10KV SPD", "20KV SPD",
}
_SENSOR_LITERALS = {
    "PIR", "Microwave", "Photocell", "Emergency", "Emergency optional",
    "Plug & Play", "Smart control", "Step dim", "Timer dim",
}
_BATTERY_LITERALS = {"LiFePO4", "MPPT", "PWM", "Ternary lithium"}
_FOOD_LITERALS = {"NSF", "HACCP", "Food-grade", "Food safety"}


def categorize_badge(feature):
    """Return (fill_hex, border_hex) for a feature string."""
    if re.match(r"^IP\d+K?$", feature, re.I):
        return BADGE_PALETTE["ip"]
    if re.match(r"^IK\d+$", feature, re.I):
        return BADGE_PALETTE["ik"]
    if feature in _CERT_LITERALS or feature.startswith("Ex "):
        return BADGE_PALETTE["cert"]
    if feature in _PROTOCOL_LITERALS or "SPD" in feature:
        return BADGE_PALETTE["protocol"]
    if feature in _SENSOR_LITERALS:
        return BADGE_PALETTE["sensor"]
    if ("corrosion" in feature.lower() or feature.startswith("C4") or feature.startswith("C5")
            or "NH3" in feature):
        return BADGE_PALETTE["corrosion"]
    if feature in _BATTERY_LITERALS or "battery" in feature.lower() or "batterie" in feature.lower():
        return BADGE_PALETTE["battery"]
    if any(literal in feature for literal in _FOOD_LITERALS):
        return BADGE_PALETTE["food"]
    return BADGE_PALETTE["default"]


class BadgeRow(Flowable):
    """A wrapping row of colored, rounded-rectangle badges for features/certs.
    Pack-and-wrap: badges flow left-to-right and break to a new line when the
    available width is exceeded."""

    def __init__(self, features, font_name="Helvetica-Bold", font_size=7,
                 padding_x=4.5, padding_y=2.5, gap=4, line_gap=4, corner_radius=2.5):
        super().__init__()
        self.badges = [
            {"text": f, "fill": colors.HexColor(fill), "border": colors.HexColor(border)}
            for f in features
            for (fill, border) in [categorize_badge(f)]
        ]
        self.font_name = font_name
        self.font_size = font_size
        self.padding_x = padding_x
        self.padding_y = padding_y
        self.gap = gap
        self.line_gap = line_gap
        self.corner_radius = corner_radius
        self._lines = []
        self._height = 0

    def wrap(self, avail_w, avail_h):
        lines = [[]]
        line_widths = [0]
        for b in self.badges:
            tw = stringWidth(b["text"], self.font_name, self.font_size)
            bw = tw + 2 * self.padding_x
            cur_line = lines[-1]
            extra_gap = self.gap if cur_line else 0
            if line_widths[-1] + bw + extra_gap <= avail_w or not cur_line:
                cur_line.append((b, bw))
                line_widths[-1] += bw + extra_gap
            else:
                lines.append([(b, bw)])
                line_widths.append(bw)
        self._lines = lines
        line_height = self.font_size + 2 * self.padding_y
        n = len(lines)
        self._height = n * line_height + max(0, n - 1) * self.line_gap
        return (avail_w, self._height)

    def draw(self):
        c = self.canv
        c.setFont(self.font_name, self.font_size)
        c.setLineWidth(0.5)
        line_height = self.font_size + 2 * self.padding_y
        y = self._height - line_height  # top of first row
        for line in self._lines:
            x = 0
            for (b, bw) in line:
                c.setFillColor(b["fill"])
                c.setStrokeColor(b["border"])
                c.roundRect(x, y, bw, line_height, self.corner_radius, fill=1, stroke=1)
                c.setFillColor(colors.white)
                # Baseline tuning: ~+1pt above bottom padding for visual centering
                c.drawString(x + self.padding_x, y + self.padding_y + 0.8, b["text"])
                x += bw + self.gap
            y -= line_height + self.line_gap


def _spaced(canvas, x, y, text, font, size, fill, track):
    """Draw letter-spaced (tracked) uppercase text; returns end-x."""
    canvas.setFont(font, size)
    canvas.setFillColor(fill)
    for ch in text:
        canvas.drawString(x, y, ch)
        x += canvas.stringWidth(ch, font, size) + track
    return x


def header_footer(canvas, doc, lang):
    canvas.saveState()
    w, h = A4
    L = LABELS[lang]

    # ── HEADER: thin blue band, logo left + tracked label right ──
    band_h = 13 * mm
    canvas.setFillColor(PRIMARY)
    canvas.rect(0, h - band_h, w, band_h, fill=1, stroke=0)
    canvas.setFillColor(ACCENT)
    canvas.rect(0, h - band_h - 0.6 * mm, w, 0.6 * mm, fill=1, stroke=0)
    if LOGO_PATH.exists():
        canvas.drawImage(str(LOGO_PATH), 15 * mm, h - band_h + 3 * mm,
                         width=24 * mm, height=7.5 * mm,
                         preserveAspectRatio=True, mask='auto')
    lab = L["footer"].upper()
    lw = sum(canvas.stringWidth(c, F_REG, 8) + 1.2 for c in lab)
    _spaced(canvas, w - 15 * mm - lw, h - band_h + 4.6 * mm, lab, F_REG, 8,
            colors.HexColor("#5c3f00"), 1.2)

    # ── FOOTER: blue band, logo + tagline (left), contacts (right) ──
    fb = 17 * mm
    canvas.setFillColor(PRIMARY)
    canvas.rect(0, 0, w, fb, fill=1, stroke=0)
    canvas.setFillColor(ACCENT)
    canvas.rect(0, fb, w, 0.7 * mm, fill=1, stroke=0)
    # disclaimer just above the band
    canvas.setFillColor(MUTED)
    canvas.setFont(F_REG, 6.5)
    canvas.drawString(15 * mm, fb + 2.5 * mm, L["disclaimer"])
    # logo + tagline (left)
    if LOGO_PATH.exists():
        canvas.drawImage(str(LOGO_PATH), 15 * mm, fb - 8.5 * mm,
                         width=22 * mm, height=6.5 * mm,
                         preserveAspectRatio=True, mask='auto')
    _spaced(canvas, 15 * mm, fb - 13 * mm, L["tagline"].upper(), F_SB, 6,
            colors.HexColor("#5c3f00"), 1.0)
    # contacts (right), dot-separated — les entrées vides sont ignorées
    pairs = [(CONTACT.get("website", ""), "https://" + CONTACT.get("website", "")),
             (CONTACT.get("email", ""), "mailto:" + CONTACT.get("email", "")),
             (CONTACT.get("phone", ""), "tel:" + CONTACT.get("phone", "").replace(" ", ""))]
    pairs = [(s, u) for (s, u) in pairs if s]
    items = [s for s, _ in pairs]
    uris = [u for _, u in pairs]
    canvas.setFont(F_MED, 8.5)
    widths = [canvas.stringWidth(s, F_MED, 8.5) for s in items]
    dot_gap = 9
    total = sum(widths) + dot_gap * max(0, len(items) - 1)
    x = w - 15 * mm - total
    cy = fb - 7 * mm
    if not items:
        canvas.setFillColor(colors.HexColor("#1d1d1b"))
        canvas.setFont(F_SB, 8.5)
        canvas.drawRightString(w - 15 * mm, cy, CONTACT["company"])
    for i, (s, wd, uri) in enumerate(zip(items, widths, uris)):
        canvas.setFillColor(colors.HexColor("#1d1d1b"))
        canvas.drawString(x, cy, s)
        canvas.linkURL(uri, (x, cy - 1, x + wd, cy + 8), relative=0, thickness=0)
        x += wd
        if i < len(items) - 1:
            canvas.setFillColor(ACCENT)
            canvas.circle(x + dot_gap / 2, cy + 2.5, 0.7, fill=1, stroke=0)
            x += dot_gap
    # address + page (right, lower)
    canvas.setFillColor(colors.HexColor("#5c3f00"))
    canvas.setFont(F_REG, 7)
    if CONTACT["address"]:
        canvas.drawRightString(w - 15 * mm, fb - 11.5 * mm, CONTACT["address"])
    canvas.drawRightString(w - 15 * mm, fb - 15 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_styles():
    styles = getSampleStyleSheet()
    return {
        "kicker": ParagraphStyle("kicker", parent=styles["Normal"],
                                 fontName=F_SB, fontSize=9.5, leading=12,
                                 textColor=PRIMARY_DARK, spaceAfter=3),
        "title": ParagraphStyle("title", parent=styles["Heading1"],
                                fontName=F_TITLE, fontSize=27, leading=30,
                                textColor=TEXT, spaceAfter=0),
        "pdfref": ParagraphStyle("pdfref", parent=styles["Normal"],
                                 fontName=F_REG, fontSize=9, leading=12,
                                 textColor=MUTED, spaceAfter=10),
        "section": ParagraphStyle("section", parent=styles["Heading2"],
                                  fontName=F_SB, fontSize=10.5, leading=14,
                                  textColor=PRIMARY_DARK, spaceBefore=8, spaceAfter=6),
        "body": ParagraphStyle("body", parent=styles["Normal"],
                               fontName=F_REG, fontSize=10, leading=15,
                               textColor=TEXT_SOFT, spaceAfter=6, alignment=TA_LEFT),
        "feature": ParagraphStyle("feature", parent=styles["Normal"],
                                  fontName=F_SB, fontSize=9, leading=12,
                                  textColor=PRIMARY, alignment=TA_CENTER),
        "label": ParagraphStyle("label", parent=styles["Normal"],
                                fontName=F_SB, fontSize=7.5, leading=10,
                                textColor=MUTED, spaceAfter=2),
        "cell": ParagraphStyle("cell", parent=styles["Normal"],
                               fontName=F_REG, fontSize=7, leading=9,
                               textColor=TEXT, alignment=TA_LEFT),
        "speclabel": ParagraphStyle("speclabel", parent=styles["Normal"],
                                    fontName=F_SB, fontSize=7, leading=9,
                                    textColor=MUTED, alignment=TA_LEFT),
        "specvalue": ParagraphStyle("specvalue", parent=styles["Normal"],
                                    fontName=F_SB, fontSize=7.5, leading=9.5,
                                    textColor=TEXT, alignment=TA_LEFT),
    }


def build_product_pdf(product, lang):
    L = LABELS[lang]
    s = build_styles()
    family = next(f for f in DATA["families"] if f["id"] == product["family_id"])
    description = product["description_fr"] if lang == "fr" else product["description_en"]
    features = product["features_fr"] if lang == "fr" else product["features_en"]

    suffix = "fr" if lang == "fr" else "en"
    out_path = OUT_DIR / f"{product['id']}-{suffix}.pdf"
    tmp_path = OUT_DIR / f"{product['id']}-{suffix}.pdf.new"

    doc = SimpleDocTemplate(
        str(tmp_path),
        pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=20 * mm, bottomMargin=24 * mm,
        title=f"{product['name_slx']} — SSA Catalogue",
        author="SSA",
    )

    story = []

    # ── Top section ──
    # LEFT column = image stack (main product photo + dimensions + use-case),
    # RIGHT column = product info (name, family, description, features).
    def _img(fn, w_mm, h_mm, max_px=PDF_IMG_MAX):
        ip = IMG_DIR / fn
        if not ip.exists():
            return None
        return Image(str(_pdf_optimized_image_path(ip, max_px)),
                     width=w_mm * mm, height=h_mm * mm, kind="proportional")

    # ── Title block: kicker + product name + accent bar ──
    story.append(Paragraph(family_name(family, lang).upper(), s["kicker"]))
    story.append(Paragraph(product["name_slx"], s["title"]))
    story.append(Spacer(1, 3 * mm))
    accent = Table([[""]], colWidths=[22 * mm], rowHeights=[1.4 * mm])
    accent.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), PRIMARY)]))
    story.append(accent)
    story.append(Spacer(1, 7 * mm))

    # ── Visual row: product image (left) | dimensions + use-case (right) ──
    gallery = product.get("gallery") or [product["image"]]
    extras = [fn for fn in gallery[1:] if (IMG_DIR / fn).exists()][:2]
    main_im = _img(product["image"], 92, 66)
    panel = TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BG),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ])
    card_style = TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ])
    if extras:
        right_flow = []
        for fn in extras:
            lblkey = "cap_dim" if "-dim" in fn else ("cap_use" if "-use" in fn else None)
            # dimension diagrams contain text labels → render at higher res
            ci = _img(fn, 70, 28, max_px=900 if "-dim" in fn else PDF_IMG_MAX)
            if not ci:
                continue
            boxed = Table([[ci]], colWidths=[76 * mm], rowHeights=[28 * mm])
            boxed.setStyle(card_style)
            if right_flow:
                right_flow.append(Spacer(1, 4 * mm))
            if lblkey:
                right_flow.append(Paragraph(L[lblkey].upper(), s["label"]))
            right_flow.append(boxed)
        main_box = Table([[main_im or Paragraph("", s["body"])]],
                         colWidths=[96 * mm], rowHeights=[60 * mm])
        main_box.setStyle(panel)
        row = Table([[main_box, right_flow]], colWidths=[98 * mm, 82 * mm])
        row.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (0, 0), 6),
            ("RIGHTPADDING", (1, 0), (1, 0), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(row)
    elif main_im:
        main_box = Table([[main_im]], colWidths=[180 * mm], rowHeights=[62 * mm])
        main_box.setStyle(panel)
        story.append(main_box)
    story.append(Spacer(1, 4 * mm))

    # ── Upshine-style spec grid (generated image), if present ──
    specs_fn = f"{product['image'].rsplit('.', 1)[0]}-specs.png"
    has_specs = (IMG_DIR / specs_fn).exists()
    if has_specs:
        sp = _img(specs_fn, 180, 56, max_px=2100)   # full width + text → keep crisp
        if sp:
            story.append(sp)
            story.append(Spacer(1, 4 * mm))

    # ── Description + features ──
    story.append(Paragraph(L["description"].upper(), s["section"]))
    story.append(Paragraph(description, s["body"]))
    # When the spec grid is shown it already lists the features, so skip the chips.
    if features and not has_specs:
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph(L["features"].upper(), s["section"]))
        story.append(BadgeRow(features, font_name=F_SB))

    # ── Technical specifications (label/value grid, from the SSA catalogue) ──
    tech_specs = product.get("tech_specs") or []
    if tech_specs:
        i18n_lang = DATA.get("i18n", {}).get(lang, {})
        tech_labels = i18n_lang.get("tech_labels", {})
        tech_title = i18n_lang.get("technical_specs",
                                   "Caractéristiques techniques" if lang == "fr"
                                   else "Technical specifications")
        story.append(Spacer(1, 4 * mm))
        story.append(Paragraph(tech_title.upper(), s["section"]))
        story.append(Spacer(1, 1 * mm))
        # Arrange specs two-per-row → table columns [label, value, label, value].
        cells = []
        for sp in tech_specs:
            label = tech_labels.get(sp["k"], sp["k"])
            value = sp["fr"] if lang == "fr" else sp["en"]
            cells.append((Paragraph(label.upper(), s["speclabel"]),
                          Paragraph(value, s["specvalue"])))
        spec_rows = []
        for i in range(0, len(cells), 2):
            left = cells[i]
            right = cells[i + 1] if i + 1 < len(cells) else ("", "")
            spec_rows.append([left[0], left[1], right[0], right[1]])
        spec_tbl = Table(spec_rows,
                         colWidths=[30 * mm, 60 * mm, 30 * mm, 60 * mm])
        spec_tbl.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("TOPPADDING", (0, 0), (-1, -1), 3.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LINEBELOW", (0, 0), (-1, -1), 0.4, BORDER),
            ("LINEABOVE", (0, 0), (-1, 0), 1.0, PRIMARY),
        ]))
        story.append(spec_tbl)

    # Variants table
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph(L["references"].upper(), s["section"]))
    story.append(Spacer(1, 2 * mm))

    def multiline_cell(text):
        """Render '; '-separated values on separate lines (mirrors site behaviour).
        Split BEFORE XML-escaping so the ';' inside escaped entities like &amp;
        is not mistaken for a value separator."""
        if not text:
            return ""
        parts = re.split(r";\s*", text)
        escaped = [p.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                   for p in parts]
        return Paragraph("<br/>".join(escaped), s["cell"])

    # Resolve the schema. Priority:
    #  1. product.table_columns (per-product pruning written by build_data.py —
    #     drops columns where every variant of THIS product is empty)
    #  2. family.table_schema → table_schemas[name]
    #  3. luminaire default
    schemas = DATA.get("table_schemas", {})
    default_schema = ["code_slx", "designation", "power", "efficacy", "lumen",
                      "weight", "dimensions", "voltage", "qty_ctn"]
    schema_name = family.get("table_schema", "luminaire")
    pruned = product.get("table_columns")
    if isinstance(pruned, list) and pruned:
        schema = pruned
    else:
        schema = schemas.get(schema_name, default_schema)

    headers_dict = DATA.get("i18n", {}).get(lang, {}).get("table_headers", {})
    headers = [headers_dict.get(col, col) for col in schema]
    def wrappable_cell(text):
        """Render Power / Efficacy / Lumen cells as Paragraph with explicit
        line breaks before '(' or ' or ' so long selectable-power values like
        '100W(80/60 select)' or '100lm/W or 130lm/W' don't overflow."""
        if not text:
            return ""
        escaped = (str(text).replace("&", "&amp;")
                            .replace("<", "&lt;")
                            .replace(">", "&gt;"))
        # Break before '(' (selectable wattage variant)
        html = re.sub(r"\s*\(", "<br/>(", escaped)
        # Break before ' or ' (efficacy/lumen variants)
        html = re.sub(r"\s+or\s+", "<br/>or ", html, flags=re.IGNORECASE)
        return Paragraph(html, s["cell"])

    rows = [headers]
    for v in product["variants"]:
        row = []
        for col in schema:
            val = v.get(col, "")
            if col == "designation":
                row.append(Paragraph(val or "", s["cell"]))
            elif col in ("weight", "dimensions"):
                row.append(multiline_cell(val))
            elif col in ("power", "efficacy", "lumen"):
                row.append(wrappable_cell(val))
            else:
                row.append(val)
        rows.append(row)

    # Column-width assignment: each column has a preferred-width "weight" in mm.
    # When per-product pruning drops columns, the remaining weights are scaled
    # proportionally to fill the 180 mm A4 portrait usable width.
    USABLE_MM = 180.0
    COL_WEIGHTS = {
        "code_slx": 16, "designation": 32,
        "power": 15, "efficacy": 18, "lumen": 20,
        "weight": 18, "dimensions": 24,
        "cut_out": 16, "voltage": 22, "qty_ctn": 15,
        "ip_class": 12,
        # atex-box
        "max_current": 14, "conductor_cross_section": 28,
        "max_cable_cores": 14, "num_terminals": 14, "num_tapped_entries": 14,
    }
    weights = [COL_WEIGHTS.get(col, 16) for col in schema]
    total = sum(weights) or 1
    col_widths = [(w / total) * USABLE_MM * mm for w in weights]
    table = Table(rows, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), SECONDARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), F_SB),
        ("FONTSIZE", (0, 0), (-1, 0), 7),
        ("ALIGN", (0, 0), (-1, 0), "LEFT"),
        ("FONTNAME", (0, 1), (-1, -1), F_REG),
        ("FONTSIZE", (0, 1), (-1, -1), 7),
        ("TEXTCOLOR", (0, 1), (-1, -1), TEXT),
        ("TEXTCOLOR", (0, 1), (0, -1), CODE_COL),
        ("FONTNAME", (0, 1), (0, -1), F_SB),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#faf7ef")]),
        # Modern: horizontal separators only, no vertical gridlines
        ("LINEBELOW", (0, 1), (-1, -1), 0.5, BORDER),
        ("LINEBELOW", (0, 0), (-1, 0), 1.2, PRIMARY),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    table.setStyle(TableStyle(style_cmds))
    story.append(table)

    doc.build(
        story,
        onFirstPage=lambda c, d: header_footer(c, d, lang),
        onLaterPages=lambda c, d: header_footer(c, d, lang),
    )
    try:
        if out_path.exists():
            out_path.unlink()
        tmp_path.rename(out_path)
        return out_path
    except (PermissionError, OSError):
        print(f"  ! {out_path.name} is locked — kept as {tmp_path.name}. Close any PDF viewer and rerun.")
        return tmp_path


def main():
    import sys
    fams = set(sys.argv[1:])  # optional: regenerate only these family_ids
    n = 0
    for product in DATA["products"]:
        if fams and product["family_id"] not in fams:
            continue
        for lang in ("fr", "en"):
            p = build_product_pdf(product, lang)
            print(f"  + {p.name}")
            n += 1
    scope = f"families {sorted(fams)}" if fams else "all families"
    print(f"\nDone ({n} PDFs, {scope}). Output: {OUT_DIR}")


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""
build_data.py — SSA (Solutions Solaires Adaptées)
=================================================
Génère data/products.json à partir de sources/data ssa.xlsx.

Pipeline :
    Excel (Feuil1)  ──►  groupage par préfixe code SSA  ──►  normalisation
    des images (P2/ + dossiers galerie)  ──►  data/products.json

Colonnes Excel : code ssa | ref usine (interne, jamais affichée) | Designation
                 | Nom produit | Puissance | Flux | Temp Lum | Panel | Batterie

Images :
    assets/images/P2/<code>.png      → image principale d'un produit
    assets/images/<code dossier>/    → galerie multi-vues d'un produit
    Les fichiers sont copiés/renommés en <slug>.png, <slug>-2.png… (pas
    d'espaces dans les noms servis).

Run:  python -X utf8 build_data.py
"""
import json, re
from pathlib import Path

import openpyxl
from PIL import Image

ROOT = Path(__file__).parent
SOURCE = ROOT / "sources" / "data ssa.xlsx"
IMAGES = ROOT / "assets" / "images"
OUT = ROOT / "data" / "products.json"

# Images servies : converties en WebP (allègement ~90% vs PNG d'origine).
# Les originaux PNG (P2/ + dossiers galerie) restent en sources pour rebuild.
WEBP_MAX = 1280      # plus grand côté en px (downscale si plus grand)
WEBP_QUALITY = 82


def save_webp(src, dst):
    """Ouvre src (PNG), downscale à WEBP_MAX, enregistre en WebP optimisé."""
    im = Image.open(src)
    if im.mode in ("P", "LA"):
        im = im.convert("RGBA")
    if max(im.size) > WEBP_MAX:
        scale = WEBP_MAX / max(im.size)
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    if im.mode == "RGBA":
        im.save(dst, "WEBP", quality=WEBP_QUALITY, method=6)
    else:
        im.convert("RGB").save(dst, "WEBP", quality=WEBP_QUALITY, method=6)

# ── 1. Familles ────────────────────────────────────────────────────────────
FAMILIES = [
    {
        "id": "solaire",
        "name_fr": "Éclairage Solaire", "name_en": "Solar Lighting",
        "image": "solar-street.webp",
        "table_schema": "ssa",
        "tagline_fr": "Lampadaires solaires autonomes, tout-en-un et hybrides.",
        "tagline_en": "Autonomous all-in-one and hybrid solar street lights.",
        "highlights_fr": ["Tout-en-un & all-in-two", "Batteries LiFePO4", "Panneaux haut rendement", "Autonomie 2 jours et +"],
        "highlights_en": ["All-in-one & all-in-two", "LiFePO4 batteries", "High-efficiency panels", "2+ days autonomy"],
    },
    {
        "id": "eclairage-public",
        "name_fr": "Éclairage Public & Résidentiel", "name_en": "Street & Area Lighting",
        "image": "azur.webp",
        "table_schema": "ssa",
        "tagline_fr": "Luminaires routiers et résidentiels raccordés réseau, jusqu'à 200 lm/W.",
        "tagline_en": "Mains-powered road and residential luminaires, up to 200 lm/W.",
        "highlights_fr": ["Jusqu'à 200 lm/W", "IP66 · IK08", "40 W à 200 W", "Lanterne, crosse, potence, suspension"],
        "highlights_en": ["Up to 200 lm/W", "IP66 · IK08", "40 W to 200 W", "Lantern, cross, bracket, pendant"],
    },
    {
        "id": "industriel",
        "name_fr": "Éclairage Industriel & Sportif", "name_en": "Industrial & Sports Lighting",
        "image": "arena.webp",
        "table_schema": "ssa",
        "tagline_fr": "Projecteurs et suspensions industrielles, du local technique au grand stade.",
        "tagline_en": "Floodlights and high-bay luminaires, from workshops to stadiums.",
        "highlights_fr": ["50 W à 2500 W", "Jusqu'à 450 000 lm", "IP65/IP66 · IK08", "Stades, halls, poursuites"],
        "highlights_en": ["50 W to 2500 W", "Up to 450,000 lm", "IP65/IP66 · IK08", "Stadiums, halls, tracking"],
    },
    {
        "id": "accessoires",
        "name_fr": "Accessoires Solaires", "name_en": "Solar Accessories",
        "image": "tub.webp",
        "table_schema": "ssa",
        "tagline_fr": "Panneaux solaires tubulaires et accessoires d'installation.",
        "tagline_en": "Tubular solar panels and installation accessories.",
        "highlights_fr": ["Panneaux TUB 200-265 W", "Montage sur mât", "Design compact", "Compatible gamme solaire"],
        "highlights_en": ["TUB 200-265 W panels", "Pole mounting", "Compact design", "Solar range compatible"],
    },
]

# ── 2. Produits (groupage par préfixe « code ssa ») ───────────────────────
# p2: fichier image principal dans assets/images/P2/
# gallery_dirs: dossiers d'images multi-vues dans assets/images/
# Les codes internes usine (ref usine) ne sont JAMAIS rendus.
PRODUCTS = [
    {
        "id": "solar-street", "name": "Solar Street", "family": "solaire",
        "prefixes": ["42 00"], "exclude_codes": ["42 00 99"],
        "p2": "42 00 00.png", "gallery_dirs": ["42 00 00"],
        "description_fr": "Lampadaire solaire tout-en-un : panneau, batterie LiFePO4 et luminaire LED intégrés dans un seul bloc compact. Installation sans tranchée ni raccordement réseau — idéal voiries résidentielles, parkings et chemins. Option détecteur radar disponible (réf. 42 00 99).",
        "description_en": "All-in-one solar street light: panel, LiFePO4 battery and LED luminaire integrated in a single compact unit. No trenching or grid connection required — ideal for residential roads, car parks and pathways. Radar motion-sensor option available (ref. 42 00 99).",
        "features_fr": ["Tout-en-un", "15-30W", "2700-5400 lm", "2200-6500K", "Batterie 12.8V LiFePO4", "Option radar"],
        "features_en": ["All-in-one", "15-30W", "2700-5400 lm", "2200-6500K", "12.8V LiFePO4 battery", "Radar option"],
    },
    {
        "id": "solar-street-pro", "name": "Solar Street Pro", "family": "solaire",
        "prefixes": ["42 01"],
        "p2": "42 01 00.png", "gallery_dirs": ["42 01 00"],
        "description_fr": "Version renforcée du lampadaire solaire tout-en-un avec batterie surdimensionnée 35 Ah offrant deux jours d'autonomie sans soleil. Pour sites exigeant une continuité de service maximale.",
        "description_en": "Heavy-duty version of the all-in-one solar street light with an oversized 35 Ah battery delivering two full days of autonomy without sun. For sites demanding maximum service continuity.",
        "features_fr": ["Tout-en-un", "Autonomie 2 jours", "25W", "5000 lm", "2200-6500K", "Batterie 12.8V 35AH"],
        "features_en": ["All-in-one", "2-day autonomy", "25W", "5000 lm", "2200-6500K", "12.8V 35AH battery"],
    },
    {
        "id": "resilight", "name": "ResiLight", "family": "solaire",
        "prefixes": ["42 02"],
        "p2": "42 02 10.png", "gallery_dirs": ["42 02 00"],
        "description_fr": "Borne solaire résidentielle compacte pour jardins, allées et résidences. Panneau 25 W et batterie LiFePO4 intégrés, lumière chaude à froide réglable.",
        "description_en": "Compact residential solar garden light for gardens, driveways and estates. Integrated 25 W panel and LiFePO4 battery, adjustable warm-to-cool light.",
        "features_fr": ["Résidentiel", "10W", "1800 lm", "2200-6500K", "Batterie 12.8V 15AH"],
        "features_en": ["Residential", "10W", "1800 lm", "2200-6500K", "12.8V 15AH battery"],
    },
    {
        "id": "all-in-two-solar", "name": "All In Two Solar", "family": "solaire",
        "prefixes": ["42 03"],
        "p2": "42 03 00.png", "gallery_dirs": ["42 03 00"],
        "description_fr": "Lampadaire solaire « all-in-two » : panneau séparé orientable pour une captation optimale, luminaire LED haute puissance jusqu'à 16 000 lm. Deux jours d'autonomie pour l'éclairage routier sans réseau.",
        "description_en": "All-in-two solar street light: separate adjustable panel for optimal harvesting, high-output LED luminaire up to 16,000 lm. Two days of autonomy for off-grid road lighting.",
        "features_fr": ["All-in-two", "Autonomie 2 jours", "60-80W", "12000-16000 lm", "2300-6500K"],
        "features_en": ["All-in-two", "2-day autonomy", "60-80W", "12000-16000 lm", "2300-6500K"],
    },
    {
        "id": "solar-road", "name": "Solar Road", "family": "solaire",
        "prefixes": ["42 04"],
        "p2": "42 04 00.png", "gallery_dirs": [],
        "description_fr": "Lampadaire solaire hybride « all-in-two » 100 % : fonctionne sur batterie solaire avec basculement réseau, pour un éclairage routier garanti toute l'année. Panneau et batterie dimensionnés par puissance.",
        "description_en": "100% hybrid all-in-two solar street light: runs on solar battery with grid fallback for guaranteed road lighting all year round. Panel and battery sized per wattage.",
        "features_fr": ["Hybride 100%", "All-in-two", "30-80W", "5700-15200 lm", "2300-6500K"],
        "features_en": ["100% hybrid", "All-in-two", "30-80W", "5700-15200 lm", "2300-6500K"],
    },
    {
        "id": "solar-road-pro", "name": "Solar Road Pro", "family": "solaire",
        "prefixes": ["42 05"],
        "p2": "42 05 00.png", "gallery_dirs": [],
        "description_fr": "La version premium du lampadaire hybride all-in-two : optique routière optimisée et électronique renforcée, du 30 W au 80 W. Pour axes principaux et zones à fort trafic.",
        "description_en": "The premium version of the hybrid all-in-two street light: optimised road optics and reinforced electronics, from 30 W to 80 W. For main roads and high-traffic areas.",
        "features_fr": ["Hybride 100%", "All-in-two", "30-80W", "5700-15200 lm", "2300-6500K"],
        "features_en": ["100% hybrid", "All-in-two", "30-80W", "5700-15200 lm", "2300-6500K"],
    },
    {
        "id": "azur", "name": "Azur", "family": "eclairage-public",
        "prefixes": ["50 00", "50 01", "50 02", "50 03", "50 04"],
        "p2": "50 00 00.png", "gallery_dirs": ["50 04 00"],
        "description_fr": "Luminaire résidentiel Azur 160 lm/W, décliné en cinq montages : lanterne, crosse (cross), potence, lanterne D et suspension. Deux puissances (40 W et 100 W) pour places, lotissements et centres-villes. Transformateur d'alimentation dédié disponible.",
        "description_en": "Azur residential luminaire, 160 lm/W, available in five mountings: lantern, cross, bracket, lantern D and pendant. Two wattages (40 W and 100 W) for squares, residential areas and town centres. Dedicated power supply unit available.",
        "features_fr": ["160 lm/W", "IP66", "IK08", "40-100W", "2300-6500K", "5 montages"],
        "features_en": ["160 lm/W", "IP66", "IK08", "40-100W", "2300-6500K", "5 mountings"],
    },
    {
        "id": "mistral", "name": "Mistral", "family": "eclairage-public",
        "prefixes": ["50 05"],
        "p2": "50 05 00.png", "gallery_dirs": [],
        "description_fr": "Lanterne résidentielle Mistral 160 lm/W au design contemporain, 50 W à 80 W. Driver intégré déposable, photocellule et NEMA en option — pensée pour les espaces urbains et parcs.",
        "description_en": "Mistral residential lantern, 160 lm/W, contemporary design, 50 W to 80 W. Detachable built-in driver, optional photocell and NEMA socket — designed for urban spaces and parks.",
        "features_fr": ["160 lm/W", "IP66", "IK08", "50-80W", "2300-6500K"],
        "features_en": ["160 lm/W", "IP66", "IK08", "50-80W", "2300-6500K"],
    },
    {
        "id": "street-core", "name": "Street Core", "family": "eclairage-public",
        "prefixes": ["51 00", "51 01", "51 02"],
        "p2": "51 00 00.png", "gallery_dirs": [],
        "description_fr": "Luminaire routier d'entrée de gamme à 150 lm/W, de 50 W à 200 W. Le bon rapport performance/prix pour la rénovation des voiries communales.",
        "description_en": "Entry-level road luminaire at 150 lm/W, from 50 W to 200 W. The right performance/price ratio for municipal road retrofits.",
        "features_fr": ["150 lm/W", "50-200W", "7500-30000 lm", "2300-6500K"],
        "features_en": ["150 lm/W", "50-200W", "7500-30000 lm", "2300-6500K"],
    },
    {
        "id": "street-plus", "name": "Street Plus", "family": "eclairage-public",
        "prefixes": ["52 00", "52 01", "52 02"],
        "p2": "52 00 00.png", "gallery_dirs": ["52 00 50"],
        "description_fr": "Luminaire routier 170 lm/W de milieu de gamme, 50 W à 200 W. Efficacité accrue et optique routière soignée pour les axes structurants.",
        "description_en": "Mid-range road luminaire at 170 lm/W, 50 W to 200 W. Higher efficacy and refined road optics for main thoroughfares.",
        "features_fr": ["170 lm/W", "50-200W", "8500-34000 lm", "2300-6500K"],
        "features_en": ["170 lm/W", "50-200W", "8500-34000 lm", "2300-6500K"],
    },
    {
        "id": "street-pro", "name": "Street Pro", "family": "eclairage-public",
        "prefixes": ["53 00", "53 01", "53 02"],
        "p2": "53 00 50.png", "gallery_dirs": ["53 00 00", "53 00 50"],
        "description_fr": "Le haut de gamme routier SSA : 200 lm/W, de 50 W à 200 W (jusqu'à 40 000 lm). Consommation minimale pour les grands axes et l'éclairage public intensif.",
        "description_en": "SSA's flagship road luminaire: 200 lm/W, from 50 W to 200 W (up to 40,000 lm). Minimal consumption for major roads and intensive public lighting.",
        "features_fr": ["200 lm/W", "50-200W", "10000-40000 lm", "2300-6500K"],
        "features_en": ["200 lm/W", "50-200W", "10000-40000 lm", "2300-6500K"],
    },
    {
        "id": "rock", "name": "Rock", "family": "industriel",
        "prefixes": ["60 00"],
        "p2": "60 00 50.png", "gallery_dirs": [],
        "description_fr": "Projecteur industriel Rock 170 lm/W, IP65 et IK08, de 50 W à 400 W. Polyvalent : façades, cours, zones de stockage et terrains de sport de proximité.",
        "description_en": "Rock industrial floodlight, 170 lm/W, IP65 and IK08, from 50 W to 400 W. Versatile: facades, yards, storage areas and local sports grounds.",
        "features_fr": ["170 lm/W", "IP65", "IK08", "50-400W", "2300-6500K"],
        "features_en": ["170 lm/W", "IP65", "IK08", "50-400W", "2300-6500K"],
    },
    {
        "id": "arena", "name": "Aréna", "family": "industriel",
        "prefixes": ["61 00"],
        "p2": "61 00 00.png", "gallery_dirs": ["61 00 00"],
        "description_fr": "Projecteur de stade Aréna 160 lm/W, IP66 et IK08, modules orientables de 500 W à 1500 W (jusqu'à 240 000 lm). Conçu pour les grandes hauteurs de feu et les enceintes sportives.",
        "description_en": "Aréna stadium floodlight, 160 lm/W, IP66 and IK08, adjustable modules from 500 W to 1500 W (up to 240,000 lm). Designed for high masts and sports venues.",
        "features_fr": ["160 lm/W", "IP66", "IK08", "500-1500W", "2200-6500K"],
        "features_en": ["160 lm/W", "IP66", "IK08", "500-1500W", "2200-6500K"],
    },
    {
        "id": "ride-stadium", "name": "Ride / Stadium", "family": "industriel",
        "prefixes": ["62 00", "62 01", "62 20", "62 25"],
        "p2": "62 00 00.png", "gallery_dirs": [],
        "description_fr": "Projecteur de stade haute performance 180 lm/W, IP66 et IK08, de 250 W à 2500 W (jusqu'à 450 000 lm). La référence pour stades, grands halls et éclairage événementiel.",
        "description_en": "High-performance stadium floodlight, 180 lm/W, IP66 and IK08, from 250 W to 2500 W (up to 450,000 lm). The reference for stadiums, large halls and event lighting.",
        "features_fr": ["180 lm/W", "IP66", "IK08", "250-2500W", "2300-6500K"],
        "features_en": ["180 lm/W", "IP66", "IK08", "250-2500W", "2300-6500K"],
    },
    {
        "id": "poursuit-focus", "name": "Poursuit / Focus", "family": "industriel",
        "prefixes": ["63 00", "63 01"],
        "p2": "63 00 00.png", "gallery_dirs": ["63 00 00"],
        "description_fr": "Projecteur de poursuite longue portée 160 lm/W, IP66 et IK08, de 400 W à 1800 W. Faisceau concentré pour la mise en valeur, les ports et les très grandes hauteurs.",
        "description_en": "Long-throw tracking floodlight, 160 lm/W, IP66 and IK08, from 400 W to 1800 W. Concentrated beam for floodlighting, ports and very high masts.",
        "features_fr": ["160 lm/W", "IP66", "IK08", "400-1800W", "2300-6500K"],
        "features_en": ["160 lm/W", "IP66", "IK08", "400-1800W", "2300-6500K"],
    },
    {
        "id": "ufo", "name": "UFO", "family": "industriel",
        "prefixes": ["64 00"], "ref_filter": "UFS01",
        "p2": None, "gallery_dirs": [],
        "description_fr": "Suspension industrielle UFO 180 lm/W, IP65 et IK08, de 100 W à 200 W. Pour halls, entrepôts et ateliers à grande hauteur sous plafond.",
        "description_en": "UFO industrial high-bay, 180 lm/W, IP65 and IK08, from 100 W to 200 W. For halls, warehouses and workshops with high ceilings.",
        "features_fr": ["180 lm/W", "IP65", "IK08", "100-200W", "2300-6500K"],
        "features_en": ["180 lm/W", "IP65", "IK08", "100-200W", "2300-6500K"],
    },
    {
        "id": "ufi", "name": "UFI", "family": "industriel",
        "prefixes": ["64 00", "64 01"], "ref_filter": "UFP23",
        "p2": None, "gallery_dirs": [],
        "description_fr": "Suspension industrielle UFI 180 lm/W, IP65 et IK08, de 100 W à 300 W. La version haute puissance pour les très grands volumes industriels.",
        "description_en": "UFI industrial high-bay, 180 lm/W, IP65 and IK08, from 100 W to 300 W. The high-power version for very large industrial volumes.",
        "features_fr": ["180 lm/W", "IP65", "IK08", "100-300W", "2300-6500K"],
        "features_en": ["180 lm/W", "IP65", "IK08", "100-300W", "2300-6500K"],
    },
    {
        "id": "tub", "name": "TUB", "family": "accessoires",
        "prefixes": ["10 00"],
        "p2": "10 00 00.png", "gallery_dirs": [],
        "description_fr": "Panneau solaire tubulaire TUB : design cylindrique anti-vandalisme et anti-accumulation (sable, neige), montage direct sur mât. Disponible en 200 W et 265 W.",
        "description_en": "TUB tubular solar panel: cylindrical anti-vandal, self-cleaning design (sand, snow), direct pole mounting. Available in 200 W and 265 W.",
        "features_fr": ["Panneau tubulaire", "200-265W", "Montage sur mât", "Anti-vandalisme"],
        "features_en": ["Tubular panel", "200-265W", "Pole mounting", "Anti-vandal"],
    },
]

TABLE_COLUMNS = ["code_slx", "designation", "power", "lumen", "efficacy", "cct",
                 "panel", "battery", "dimensions", "weight"]

# ── Dimensions par puissance (catalogue SSA 2026) ─────────────────────────
# Clé = produit, sous-clé = puissance en W, valeur = "L × l × H mm".
# Uniquement pour les produits dont les puissances du catalogue coïncident
# exactement avec celles du fichier Excel (sinon → spec « dimensions » globale).
DIMENSIONS = {
    "street-plus": {
        50: "179 × 510 × 100 mm", 100: "230 × 584 × 100 mm",
        150: "230 × 635 × 100 mm", 200: "288 × 737 × 100 mm",
    },
    "rock": {
        50: "240 × 213 × 51.5 mm", 100: "255 × 263 × 51.5 mm",
        150: "300 × 263 × 51.5 mm", 200: "310 × 313 × 56.5 mm",
        300: "370 × 363 × 61.5 mm", 400: "504 × 365 × 62.9 mm",
    },
    "arena": {
        500: "534 × 130 × 338 mm", 1000: "544 × 178 × 800 mm",
        1500: "544 × 178 × 1179 mm",
    },
    "ride-stadium": {
        250: "507 × 183 × 150 mm", 500: "507 × 183 × 320 mm",
        750: "507 × 183 × 490 mm", 1000: "507 × 183 × 660 mm",
        1500: "983 × 251 × 490 mm", 2000: "983 × 251 × 660 mm",
        2500: "983 × 251 × 830 mm",
    },
    "poursuit-focus": {
        400: "438 × 434 × 356 mm", 600: "592 × 509 × 423 mm",
        1200: "697 × 649 × 520 mm", 1800: "831 × 772 × 570 mm",
    },
    "tub": {
        200: "A/F 245 × H1556 mm", 265: "A/F 245 × H2030 mm",
    },
}
# Poids par puissance (panneaux TUB uniquement, catalogue)
WEIGHTS = {
    "tub": {200: "17.2 kg", 265: "23.5 kg"},
}

# ── Caractéristiques techniques (catalogue SSA 2026) ──────────────────────
# Par produit : liste de (clé_label, valeur_fr, valeur_en). Le label est résolu
# via i18n["tech_labels"]. Données issues des fiches « Parameter » du catalogue.
def _s(k, fr, en=None):
    return {"k": k, "fr": fr, "en": en if en is not None else fr}

TECH_SPECS = {
    "solar-street": [
        _s("cct", "2200K–6500K"),
        _s("light_mode", "Horloge / radar / télécommande", "Time control / radar / remote"),
        _s("autonomy", "2 jours de pluie", "2 rainy days"),
        _s("solar_panel", "18V · 60–120W"),
        _s("battery", "12.8V LiFePO4 · 15–30Ah"),
    ],
    "solar-street-pro": [
        _s("cct", "2200K–6500K"),
        _s("light_mode", "Horloge / télécommande", "Time control / remote"),
        _s("autonomy", "2 jours de pluie", "2 rainy days"),
        _s("solar_panel", "18V · 80W"),
        _s("battery", "12.8V LiFePO4 · 35Ah"),
    ],
    "all-in-two-solar": [
        _s("cct", "2300K–6500K"),
        _s("light_mode", "Horloge / radar", "Time control / radar"),
        _s("autonomy", "2 jours de pluie", "2 rainy days"),
        _s("work_temp", "0°C ~ +45°C"),
        _s("glass", "Verre auto-nettoyant anti-reflet", "Self-cleaning anti-reflective glass"),
        _s("assembly", "100% solaire, sans câblage réseau", "100% solar, no mains wiring"),
        _s("dimensions", "684 × 153 mm (luminaire)"),
        _s("certif", "CB · CE · ErP · ISO9001 · ISO14001 · UN38.4"),
    ],
    "solar-road": [
        _s("cct", "2300K–6500K"),
        _s("light_mode", "Hybride solaire + réseau", "Hybrid solar + mains"),
        _s("autonomy", "1 à 3 jours de pluie", "1 to 3 rainy days"),
        _s("solar_panel", "18–36V · 100–280W"),
        _s("battery", "12.8–25.6V LiFePO4 · 25–70Ah"),
    ],
    "solar-road-pro": [
        _s("cct", "2300K–6500K"),
        _s("light_mode", "Hybride solaire + réseau", "Hybrid solar + mains"),
        _s("autonomy", "1 à 3 jours de pluie", "1 to 3 rainy days"),
        _s("solar_panel", "18–36V · 100–280W"),
        _s("battery", "12.8–25.6V LiFePO4 · 25–70Ah"),
    ],
    "resilight": [
        _s("led_chip", "SMD5054 (40 pcs)"),
        _s("cct", "3000K–6500K"),
        _s("cri", "≥70"),
        _s("beam", "111.6°"),
        _s("lifespan", "> 50 000 h"),
        _s("charge_time", "6–10 h (plein soleil)", "6–10 h (sunny day)"),
        _s("light_mode", "Horloge + cellule (100→30%)", "Time + light control (100→30%)"),
        _s("material", "Aluminium moulé + PC", "Die-cast aluminium + PC"),
        _s("pole_d", "76 mm"),
        _s("mount_h", "3 m"),
        _s("optic", "Lentille PC Type I/II/III/IV/V", "PC lens Type I/II/III/IV/V"),
        _s("work_temp", "-20°C ~ 50°C"),
        _s("ip", "IP65"), _s("ik", "IK08"),
        _s("dimensions", "450 × 450 × 600 mm"),
        _s("warranty", "Batterie 3 ans · Produit 5 ans", "Battery 3 yr · Product 5 yr"),
    ],
    "azur": [
        _s("efficacy", "180 lm/W"),
        _s("voltage", "AC85–305V"), _s("frequency", "50/60 Hz"),
        _s("cct", "2200K–6500K"),
        _s("lifespan", "> 100 000 h"),
        _s("led_chip", "SMD2835 | SMD3030 | SMD5050"),
        _s("driver", "Philips | Inventronics"),
        _s("beam", "Type I / II / III"),
        _s("material", "Aluminium (ADC12) + verre trempé", "Aluminium (ADC12) + tempered glass"),
        _s("pole_d", "60 mm"),
        _s("work_temp", "-30°C ~ 50°C"),
        _s("ip", "IP66"), _s("ik", "IK10"),
        _s("dimensions", "500 × 500 × 450 mm"),
        _s("performance", "> 90%"),
    ],
    "mistral": [
        _s("efficacy", "180 lm/W"),
        _s("voltage", "AC90–305V"), _s("frequency", "50/60 Hz"),
        _s("cct", "2200K–6500K"),
        _s("lifespan", "> 100 000 h"),
        _s("led_chip", "SMD3030 | SMD5050"),
        _s("driver", "Philips | Inventronics"),
        _s("beam", "Type I / II / III"),
        _s("material", "Aluminium (ADC12)"),
        _s("pole_d", "60 / 76 mm"),
        _s("work_temp", "-30°C ~ 50°C"),
        _s("ip", "IP65"), _s("ik", "IK08"),
        _s("dimensions", "430 × 430 × 490.5 mm"),
        _s("options", "Driver intégré ou déposable · NEMA · cellule", "Built-in or detachable driver · NEMA · photocell"),
    ],
    "street-core": [
        _s("voltage", "AC100–277V"), _s("frequency", "50/60 Hz"),
        _s("cct", "2200K–6500K"),
        _s("lifespan", "> 100 000 h"),
        _s("led_chip", "SMD3030"),
        _s("driver", "Philips | Inventronics"),
        _s("beam", "160 × 100°"),
        _s("material", "Aluminium (ADC12) + PC"),
        _s("pole_d", "60 mm"),
        _s("work_temp", "-30°C ~ 50°C"),
        _s("ip", "IP66"), _s("ik", "IK08"),
        _s("dimensions", "326 × 175 × 71 → 545 × 230 × 86 mm"),
        _s("performance", "> 90%"),
    ],
    "street-plus": [
        _s("voltage", "AC85–305V"), _s("frequency", "50/60 Hz"),
        _s("cct", "2200K–6500K"),
        _s("lifespan", "> 100 000 h"),
        _s("led_chip", "SMD3030 | SMD5050"),
        _s("driver", "Philips | Inventronics"),
        _s("beam", "Type I / II / III"),
        _s("material", "Aluminium (ADC12) + verre trempé", "Aluminium (ADC12) + tempered glass"),
        _s("pole_d", "60 mm"),
        _s("work_temp", "-30°C ~ 50°C"),
        _s("ip", "IP66"), _s("ik", "IK08"),
        _s("performance", "> 90%"),
    ],
    "street-pro": [
        _s("voltage", "AC85–305V"), _s("frequency", "50/60 Hz"),
        _s("cct", "2200K–6500K"),
        _s("lifespan", "> 100 000 h"),
        _s("led_chip", "SMD5050"),
        _s("driver", "Philips | Inventronics"),
        _s("beam", "Type I / II / III"),
        _s("material", "Aluminium (ADC12) + verre trempé", "Aluminium (ADC12) + tempered glass"),
        _s("pole_d", "60 mm"),
        _s("work_temp", "-30°C ~ 50°C"),
        _s("ip", "IP66"), _s("ik", "IK10"),
        _s("dimensions", "539.7–589.7 × 205.5 × 102.8 mm"),
        _s("performance", "> 90%"),
    ],
    "rock": [
        _s("efficacy", "180 lm/W"),
        _s("voltage", "AC100–265V"), _s("frequency", "50/60 Hz"),
        _s("cct", "2200K–6500K"),
        _s("lifespan", "> 50 000 h"),
        _s("led_chip", "SMD3030 | SMD5050"),
        _s("driver", "DOB | Non-isolé", "DOB | Non-isolated"),
        _s("beam", "Type I / II / III"),
        _s("material", "Aluminium moulé + verre", "Die-cast aluminium + glass"),
        _s("work_temp", "-30°C ~ 50°C"),
        _s("ip", "IP65"), _s("ik", "IK08"),
        _s("performance", "> 90%"),
    ],
    "arena": [
        _s("efficacy", "170 lm/W"),
        _s("voltage", "AC85–305V"), _s("frequency", "50/60 Hz"),
        _s("cct", "2200K–6500K"),
        _s("lifespan", "> 100 000 h"),
        _s("led_chip", "SMD3030 | SMD5050"),
        _s("driver", "Philips | Inventronics"),
        _s("beam", "30° | 60° | 90° | 60°×120°"),
        _s("material", "Aluminium (ADC12) + verre trempé", "Aluminium (ADC12) + tempered glass"),
        _s("work_temp", "-30°C ~ 50°C"),
        _s("ip", "IP66"), _s("ik", "IK08"),
        _s("performance", "> 90%"),
    ],
    "ride-stadium": [
        _s("efficacy", "180 lm/W"),
        _s("voltage", "AC85–305V"), _s("frequency", "50/60 Hz"),
        _s("cct", "2200K–6500K"),
        _s("lifespan", "> 100 000 h"),
        _s("led_chip", "SMD3030"),
        _s("driver", "Philips | Inventronics"),
        _s("beam", "30° | 60° | 90° | 45°"),
        _s("material", "Aluminium (ADC12)"),
        _s("work_temp", "-30°C ~ 50°C"),
        _s("ip", "IP66"), _s("ik", "IK08"),
        _s("performance", "> 90%"),
    ],
    "poursuit-focus": [
        _s("efficacy", "180 lm/W"),
        _s("voltage", "AC85–305V"), _s("frequency", "50/60 Hz"),
        _s("cct", "2200K–6500K"),
        _s("lifespan", "> 100 000 h"),
        _s("led_chip", "SMD3030 | SMD5050"),
        _s("driver", "Philips | Inventronics"),
        _s("beam", "15° | 30° | 45° | 60°"),
        _s("material", "Aluminium (ADC12) + PC"),
        _s("work_temp", "-30°C ~ 50°C"),
        _s("ip", "IP66"), _s("ik", "IK08"),
        _s("performance", "> 90%"),
    ],
    "ufo": [
        _s("cct", "2300K–6500K"),
        _s("efficacy", "180 lm/W"),
        _s("ip", "IP65"), _s("ik", "IK08"),
        _s("work_temp", "-30°C ~ 50°C"),
    ],
    "ufi": [
        _s("cct", "2300K–6500K"),
        _s("efficacy", "180 lm/W"),
        _s("ip", "IP65"), _s("ik", "IK08"),
        _s("work_temp", "-30°C ~ 50°C"),
    ],
    "tub": [
        _s("cell", "Cellule Topcon", "Topcon cell"),
        _s("cell_eff", "25%"),
        _s("glass", "Verre trempé super blanc 3.2 mm", "3.2 mm super white tempered glass"),
        _s("frame", "Cadre aluminium anodisé", "Anodized aluminium frame"),
        _s("max_voltage", "1000V (TUV) / 600V (UL)"),
        _s("work_temp", "-40°C ~ 85°C"),
        _s("warranty", "10 ans produit · 25 ans puissance", "10 yr product · 25 yr output"),
        _s("features_extra", "Réception 360° · auto-nettoyant", "360° reception · self-cleaning"),
    ],
}

I18N = {
    "fr": {
        "site_title": "SSA Catalogue — Éclairage Solaire & LED",
        "hero_kicker": "Édition 2026",
        "hero_title": "L'éclairage solaire et LED qui illumine vos espaces",
        "hero_subtitle": "Lampadaires solaires, éclairage public, projecteurs industriels : l'énergie du soleil au service de vos projets.",
        "hero_cta": "Explorer le catalogue",
        "hero_cta_secondary": "Découvrir les familles",
        "search_placeholder": "Rechercher un produit, un code SSA ou une désignation...",
        "search_btn": "Rechercher",
        "no_suggestions": "Aucun produit trouvé",
        "featured_label": "Produit vedette",
        "featured_cta": "Voir le produit",
        "featured_products": "Produits phares",
        "featured_products_subtitle": "Une sélection représentative de la gamme SSA",
        "download_datasheet": "Fiche technique",
        "browse_intro": "Parcourir le catalogue",
        "browse_by_family": "Par famille",
        "products_count": "produit(s)",
        "view_catalogue": "Voir tout le catalogue",
        "families_label": "famille(s)",
        "jump_to": "Aller à",
        "download_family_zip": "Télécharger toutes les fiches de la famille",
        "datasheets_zip": "Fiches (ZIP)",
        "zip_preparing": "Préparation du ZIP…",
        "zip_error": "Erreur lors de la préparation du ZIP.",
        "no_results": "Aucun produit ne correspond à votre recherche.",
        "sort_default": "Tri par défaut",
        "sort_name_asc": "Nom A→Z",
        "sort_power_asc": "Puissance croissante",
        "sort_power_desc": "Puissance décroissante",
        "family": "Famille",
        "supplier": "Fournisseur",
        "all_families": "Toutes les familles",
        "all_suppliers": "Tous",
        "power_label": "Puissance",
        "filtered_by": "Filtré par",
        "clear_filter": "Réinitialiser",
        "advanced_filters": "Filtres avancés",
        "ip_label": "Indice IP",
        "ik_label": "Indice IK",
        "features_label": "Caractéristiques",
        "cap_dimensions": "Dimensions",
        "cap_usecase": "Mise en situation",
        "cap_view": "Vue produit",
        "home": "Accueil",
        "catalogue": "Catalogue",
        "description": "Description",
        "references": "Références",
        "export_csv": "Exporter CSV",
        "print": "Imprimer",
        "print_catalogue": "Imprimer le catalogue",
        "product_not_found": "Produit introuvable.",
        "recent_products": "Récemment consultés",
        "related_products": "Produits de la même famille",
        "see_all_family": "Voir toute la famille",
        "features": "Caractéristiques",
        "remove": "Retirer",
        "compare": "Comparer",
        "compare_add": "Ajouter au comparateur",
        "compare_added": "Ajouté au comparateur",
        "compare_max": "Vous pouvez comparer 4 produits maximum.",
        "compare_bar_title": "Comparateur",
        "compare_clear": "Tout effacer",
        "compare_view": "Comparer",
        "compare_title": "Comparaison de produits",
        "compare_empty": "Aucun produit à comparer. Ajoutez des produits depuis le catalogue.",
        "compare_attribute": "Caractéristique",
        "compare_variants": "Références",
        "technical_specs": "Caractéristiques techniques",
        "table_headers": {
            "code_slx": "Code SSA",
            "designation": "Désignation",
            "power": "Puissance",
            "lumen": "Flux (lm)",
            "efficacy": "Efficacité (lm/W)",
            "cct": "Temp. couleur",
            "panel": "Panneau",
            "battery": "Batterie",
            "weight": "Poids",
            "dimensions": "Dimensions",
            "voltage": "Tension",
            "qty_ctn": "Qté/carton",
        },
        "tech_labels": {
            "efficacy": "Efficacité lumineuse", "voltage": "Tension",
            "frequency": "Fréquence", "cct": "Température de couleur",
            "cri": "IRC", "lifespan": "Durée de vie LED",
            "led_chip": "Type de LED", "driver": "Driver",
            "beam": "Angle de faisceau", "material": "Matériau",
            "work_temp": "Température de service", "ip": "Indice de protection",
            "ik": "Résistance aux chocs", "dimensions": "Dimensions",
            "pole_d": "Diamètre de fixation", "mount_h": "Hauteur de montage",
            "optic": "Optique", "performance": "Maintien du flux",
            "solar_panel": "Panneau solaire", "battery": "Batterie",
            "autonomy": "Autonomie", "charge_time": "Temps de charge",
            "light_mode": "Mode d'éclairage", "warranty": "Garantie",
            "glass": "Verre", "assembly": "Assemblage", "certif": "Certifications",
            "options": "Options", "cell": "Cellule", "cell_eff": "Rendement cellule",
            "max_voltage": "Tension système max", "weight": "Poids",
            "features_extra": "Atouts",
        },
    },
    "en": {
        "site_title": "SSA Catalogue — Solar & LED Lighting",
        "hero_kicker": "2026 Edition",
        "hero_title": "Solar and LED lighting that brightens your spaces",
        "hero_subtitle": "Solar street lights, public lighting, industrial floodlights: the sun's energy at the service of your projects.",
        "hero_cta": "Browse the catalogue",
        "hero_cta_secondary": "Discover the families",
        "search_placeholder": "Search a product, an SSA code or a designation...",
        "search_btn": "Search",
        "no_suggestions": "No product found",
        "featured_label": "Featured product",
        "featured_cta": "View product",
        "featured_products": "Highlights",
        "featured_products_subtitle": "A representative selection of the SSA range",
        "download_datasheet": "Datasheet",
        "browse_intro": "Browse the catalogue",
        "browse_by_family": "By family",
        "products_count": "product(s)",
        "view_catalogue": "View full catalogue",
        "families_label": "family(ies)",
        "jump_to": "Jump to",
        "download_family_zip": "Download all datasheets of this family",
        "datasheets_zip": "Datasheets (ZIP)",
        "zip_preparing": "Preparing ZIP…",
        "zip_error": "Error while preparing the ZIP.",
        "no_results": "No product matches your search.",
        "sort_default": "Default order",
        "sort_name_asc": "Name A→Z",
        "sort_power_asc": "Power ascending",
        "sort_power_desc": "Power descending",
        "family": "Family",
        "supplier": "Supplier",
        "all_families": "All families",
        "all_suppliers": "All",
        "power_label": "Power",
        "filtered_by": "Filtered by",
        "clear_filter": "Reset",
        "advanced_filters": "Advanced filters",
        "ip_label": "IP rating",
        "ik_label": "IK rating",
        "features_label": "Features",
        "cap_dimensions": "Dimensions",
        "cap_usecase": "In use",
        "cap_view": "Product view",
        "home": "Home",
        "catalogue": "Catalogue",
        "description": "Description",
        "references": "References",
        "export_csv": "Export CSV",
        "print": "Print",
        "print_catalogue": "Print catalogue",
        "product_not_found": "Product not found.",
        "recent_products": "Recently viewed",
        "related_products": "Products in the same family",
        "see_all_family": "See the whole family",
        "features": "Features",
        "remove": "Remove",
        "compare": "Compare",
        "compare_add": "Add to comparison",
        "compare_added": "Added to comparison",
        "compare_max": "You can compare up to 4 products.",
        "compare_bar_title": "Comparison",
        "compare_clear": "Clear all",
        "compare_view": "Compare",
        "compare_title": "Product comparison",
        "compare_empty": "No product to compare. Add products from the catalogue.",
        "compare_attribute": "Attribute",
        "compare_variants": "References",
        "technical_specs": "Technical specifications",
        "table_headers": {
            "code_slx": "SSA code",
            "designation": "Designation",
            "power": "Power",
            "lumen": "Flux (lm)",
            "efficacy": "Efficacy (lm/W)",
            "cct": "Colour temp.",
            "panel": "Panel",
            "battery": "Battery",
            "weight": "Weight",
            "dimensions": "Dimensions",
            "voltage": "Voltage",
            "qty_ctn": "Qty/carton",
        },
        "tech_labels": {
            "efficacy": "Luminous efficacy", "voltage": "Voltage",
            "frequency": "Frequency", "cct": "Colour temperature",
            "cri": "CRI", "lifespan": "LED lifespan",
            "led_chip": "LED chip type", "driver": "Driver",
            "beam": "Beam angle", "material": "Material",
            "work_temp": "Working temperature", "ip": "IP rating",
            "ik": "IK rating", "dimensions": "Dimensions",
            "pole_d": "Mounting diameter", "mount_h": "Mounting height",
            "optic": "Optics", "performance": "Lumen maintenance",
            "solar_panel": "Solar panel", "battery": "Battery",
            "autonomy": "Autonomy", "charge_time": "Charging time",
            "light_mode": "Lighting mode", "warranty": "Warranty",
            "glass": "Glass", "assembly": "Assembly", "certif": "Certifications",
            "options": "Options", "cell": "Cell", "cell_eff": "Cell efficiency",
            "max_voltage": "Max system voltage", "weight": "Weight",
            "features_extra": "Highlights",
        },
    },
}


def norm(s):
    """Collapse whitespace; '' for None."""
    if s is None:
        return ""
    return re.sub(r"\s+", " ", str(s)).strip()


def parse_watts(val):
    m = re.search(r"(\d+(?:[.,]\d+)?)", norm(val))
    return float(m.group(1).replace(",", ".")) if m else None


def fmt_power(val):
    """'10w' / 30 → '10 W' / '30 W' (display form)."""
    w = parse_watts(val)
    if w is None:
        return norm(val)
    return f"{int(w) if w == int(w) else w} W"


def load_rows():
    wb = openpyxl.load_workbook(SOURCE, data_only=True)
    ws = wb["Feuil1"]
    rows = []
    for r in ws.iter_rows(values_only=True):
        code = norm(r[0])
        if not re.match(r"^\d{2} \d{2} \d{2}$", code):
            continue
        rows.append({
            "code": code,
            "ref": norm(r[1]),          # interne — jamais rendu
            "designation": norm(r[2]),
            "nom": norm(r[3]),
            "power": norm(r[4]),
            "lumen": r[5],
            "cct": norm(r[6]).upper().replace("K", "K"),
            "panel": norm(r[7]),
            "battery": norm(r[8]),
        })
    return rows


def normalize_images(meta, slug):
    """Convertit P2/<code>.png → <slug>.webp et la galerie → <slug>-N.webp.
    Retourne (image, gallery[])."""
    if not meta.get("p2"):
        return f"{slug}.webp", []      # pas de photo dédiée → placeholder front
    main_src = IMAGES / "P2" / meta["p2"]
    main_dst = IMAGES / f"{slug}.webp"
    if main_src.exists():
        save_webp(main_src, main_dst)
    gallery = [f"{slug}.webp"]
    n = 2
    for d in meta.get("gallery_dirs", []):
        folder = IMAGES / d
        if not folder.exists():
            continue
        for f in sorted(folder.glob("*.png"), key=lambda p: (len(p.stem), p.stem)):
            dst = IMAGES / f"{slug}-{n}.webp"
            save_webp(f, dst)
            gallery.append(dst.name)
            n += 1
    return f"{slug}.webp", (gallery if len(gallery) > 1 else [])


def build():
    rows = load_rows()
    used = set()
    products = []

    for meta in PRODUCTS:
        variants = []
        for row in rows:
            prefix = row["code"][:5]
            if prefix not in meta["prefixes"]:
                continue
            if row["code"] in meta.get("exclude_codes", []):
                continue
            if meta.get("ref_filter") and meta["ref_filter"] not in row["ref"]:
                continue
            if not row["nom"] and not row["power"]:
                continue                    # ligne squelette sans données
            used.add(id(row))
            w = parse_watts(row["power"])
            lm = row["lumen"] if isinstance(row["lumen"], (int, float)) else parse_watts(row["lumen"])
            eff = str(int(round(lm / w))) if (w and lm) else ""
            wkey = int(w) if w is not None else None
            variants.append({
                "code_slx": row["code"],
                "designation": row["designation"] or row["nom"],
                "power": fmt_power(row["power"]),
                "lumen": str(int(lm)) if lm else "",
                "efficacy": eff,
                "cct": row["cct"],
                "panel": row["panel"],
                "battery": row["battery"],
                "dimensions": DIMENSIONS.get(meta["id"], {}).get(wkey, ""),
                "weight": WEIGHTS.get(meta["id"], {}).get(wkey, ""),
            })
        if not variants:
            print(f"! {meta['name']}: aucune référence trouvée — produit ignoré")
            continue

        image, gallery = normalize_images(meta, meta["id"])
        cols = [c for c in TABLE_COLUMNS
                if any(v.get(c) for v in variants)]

        # Anti-doublons : on retire du bloc « caractéristiques techniques » toute
        # spec dont la donnée figure déjà comme colonne du tableau de CE produit
        # (cct, efficacité, panneau, batterie, dimensions, poids).
        SPEC_COL_EQUIV = {
            "cct": "cct", "efficacy": "efficacy",
            "solar_panel": "panel", "battery": "battery",
            "dimensions": "dimensions", "weight": "weight",
        }
        specs = [sp for sp in TECH_SPECS.get(meta["id"], [])
                 if SPEC_COL_EQUIV.get(sp["k"]) not in cols]
        p = {
            "id": meta["id"],
            "family_id": meta["family"],
            "name_slx": meta["name"],
            "image": image,
            # Code SSA du 1er variant : sert au placeholder stylé quand la
            # photo manque (produits sans image dédiée) — jamais une ref usine.
            "code_prefix": variants[0]["code_slx"],
            "description_fr": meta["description_fr"],
            "description_en": meta["description_en"],
            "features_fr": meta["features_fr"],
            "features_en": meta["features_en"],
            "datasheet_fr": f"{meta['id']}-fr.pdf",
            "datasheet_en": f"{meta['id']}-en.pdf",
            "table_columns": cols,
            "tech_specs": specs,
            "variants": variants,
        }
        if gallery:
            p["gallery"] = gallery
        products.append(p)

    n_rows = sum(len(p["variants"]) for p in products)
    data = {
        "site": {
            "brand": "SSA",
            "featured_product_id": "street-pro",
            "featured_products_ids": [
                "solar-street", "street-pro", "azur", "arena",
                "all-in-two-solar", "mistral", "rock", "poursuit-focus",
            ],
        },
        "families": FAMILIES,
        "suppliers": [],                  # jamais affichés
        "products": products,
        "table_schemas": {"ssa": TABLE_COLUMNS},
        "i18n": I18N,
    }
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT} — {len(products)} produits, {n_rows} références, {len(FAMILIES)} familles")


if __name__ == "__main__":
    build()

# -*- coding: utf-8 -*-
"""Generate the Upshine-style spec-grid image (<stem>-specs.png) per product,
driven by each product's feature chips. Embedded on the web product page and in
the PDF datasheet. Gated to SPEC_FAMILIES (rolled out family by family).
Rendered at SS× supersampling so the text stays crisp at full width."""
import json, math, re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).parent
IMG = ROOT / "assets" / "images"; FT = ROOT / "assets" / "fonts"
DATA = json.loads((ROOT / "data" / "products.json").read_text(encoding="utf-8"))

# Roll-out gate — add families here one at a time after the user validates each.
SPEC_FAMILIES = set()  # TODO: add family ids one at a time, e.g. {"high-bay"}

SS = 3  # supersampling factor (crisp text)
BLUE=(30,67,121); ACC=(87,126,184); CHIP=(233,239,248); MUT=(120,128,142); LINE=(228,233,240); DARK=(26,34,49)
def arch(s): return ImageFont.truetype(str(FT/"ArchivoBlack-Regular.ttf"),s*SS)
def pop(s,w="r"): return ImageFont.truetype(str(FT/{"r":"Poppins-Regular.ttf","m":"Poppins-Medium.ttf","sb":"Poppins-SemiBold.ttf","b":"Poppins-Bold.ttf"}.get(w,"Poppins-Regular.ttf")),s*SS)

def spaced(dr,xy,txt,font,fill,track=2):
    x,y=xy
    for ch in txt: dr.text((x,y),ch,font=font,fill=fill); x+=dr.textlength(ch,font=font)+track*SS
    return x
def beam_icon(dr,cx,cy,deg,r=18):
    r*=SS; a=math.radians(min(deg,80)/2)
    dr.ellipse([cx-r,cy-r,cx+r,cy+r],outline=ACC,width=3*SS)
    dr.line([(cx,cy-r+4*SS),(cx-math.sin(a)*r*0.8,cy-r+4*SS+math.cos(a)*r*1.3)],fill=BLUE,width=2*SS)
    dr.line([(cx,cy-r+4*SS),(cx+math.sin(a)*r*0.8,cy-r+4*SS+math.cos(a)*r*1.3)],fill=BLUE,width=2*SS)
def badge(dr,x,y,txt,font,fill=BLUE,bg=CHIP,pad=11,h=30,outline=None):
    pad*=SS; h*=SS
    w=dr.textlength(txt,font=font)+pad*2
    dr.rounded_rectangle([x,y,x+w,y+h],h//2,fill=bg,outline=outline,width=2*SS if outline else 0)
    dr.text((x+pad,y+(h-font.size)//2-1*SS),txt,font=font,fill=fill); return x+w+8*SS

def categorize(feats):
    g={"controls":[], "protection":[], "quality":[], "certs":[]}; beam=None
    for f in feats:
        fl=f.lower()
        cri=re.match(r"^(>=|≥)?\s*(\d{2})$", f.strip())  # bare CRI value e.g. "80" / ">=80"
        if "beam" in fl or "faisceau" in fl or re.search(r"\d{2,3}\s?°(?!\s*C)", f):
            beam=f                                       # angle, but not "25°C" temperature
        elif any(k in f for k in ["CASAMBI","DALI","Microwave","PIR","Zhaga","0-10V","Triac","Emergency","Audio","selectable","Dimming","Gradation"]) or any(k in fl for k in ["photocell","cellule","dimm","gradation"]):
            g["controls"].append(f)
        elif f.startswith("IP") or f.startswith("IK") or "corrosion" in fl or "vibration" in fl:
            g["protection"].append(f)
        elif any(k in f for k in ["UGR","CRI","IRC","Ra","SDCM","lm/W","comfort","Ta","flicker","Flicker"]) or "lm/w" in fl:
            g["quality"].append(f)
        elif cri:
            g["quality"].append(f"CRI {cri.group(1) or ''}{cri.group(2)}")
        elif any(k in fl for k in ["warranty","garantie","din","nsf","haccp","food","sustainable","durable","dark-sky","cut-off","full cut"]):
            g["certs"].append(f)
    return beam,g

def compute_cct(product):
    """Dynamic CCT per product: real K values from variants OR features, else
    'selectable'/'switchable', else none → CCT bar is hidden."""
    text = " ".join(str(v) for var in product.get("variants", []) for v in var.values())
    text += " " + " ".join(product.get("features_fr") or [])
    ks = sorted({int(m) for m in re.findall(r"(\d{3,4})\s?K\b", text) if 2000 <= int(m) <= 7000})
    if ks:
        return ("values", ks[:4])
    if any(w in text.lower() for w in ["cct", "selectable", "switchable", "interchangeable", "tunable"]):
        return ("selectable", None)
    return (None, None)

def render(product):
    feats = product.get("features_fr") or []
    beam,g = categorize(feats)
    W=1180*SS; M=0
    fL=pop(13,"sb"); fB=pop(15,"sb")
    H=320*SS
    c=Image.new("RGB",(W,H),(255,255,255)); dr=ImageDraw.Draw(c)
    colw=W//2
    # LEFT col
    x=M; yL=4*SS
    if beam:
        spaced(dr,(x,yL),"ANGLE DE FAISCEAU",fL,MUT,2); yL+=24*SS
        degs=[int(d) for d in re.findall(r"(\d{2,3})", beam)]
        degs=[d for d in dict.fromkeys(degs) if 8 <= d <= 160][:5]  # dedupe + plausible cone angles
        if "selectable" in beam.lower() or not degs:
            beam_icon(dr,x+22*SS,yL+20*SS,40); dr.text((x+50*SS,yL+14*SS),beam.replace("Beam","").strip() or "Sélectionnable",font=pop(16,"b"),fill=DARK)
        else:
            bx=x+22*SS
            for dg in degs[:6]:
                beam_icon(dr,bx,yL+20*SS,dg); dr.text((bx-12*SS,yL+42*SS),f"{dg}°",font=pop(13,"sb"),fill=DARK); bx+=68*SS
        yL+=72*SS
    spaced(dr,(x,yL),"CONTRÔLE / GRADATION",fL,MUT,2); yL+=24*SS
    bx=x
    for t in (g["controls"] or ["—"]):
        if bx+dr.textlength(t,font=fB)+30*SS>x+colw-16*SS: bx=x; yL+=42*SS
        bx=badge(dr,bx,yL,t,fB)
    yL+=48*SS
    # RIGHT col
    rx=M+colw; yR=4*SS
    spaced(dr,(rx,yR),"PROTECTION & RÉSISTANCE",fL,MUT,2); yR+=24*SS
    bx=rx
    for t in (g["protection"] or ["—"]):
        if bx+dr.textlength(t,font=fB)+30*SS>W: bx=rx; yR+=42*SS
        bx=badge(dr,bx,yR,t,fB)
    yR+=44*SS
    spaced(dr,(rx,yR),"QUALITÉ DE LUMIÈRE",fL,MUT,2); yR+=24*SS
    bx=rx
    for t in (g["quality"] or ["—"]):
        if bx+dr.textlength(t,font=fB)+30*SS>W: bx=rx; yR+=42*SS
        bx=badge(dr,bx,yR,t,fB)
    yR+=44*SS
    spaced(dr,(rx,yR),"CERTIFICATIONS & NORMES",fL,MUT,2); yR+=24*SS
    bx=rx
    certs=(g["certs"]+["CE","RoHS"])[:6]
    for t in certs:
        if bx+dr.textlength(t,font=fB)+30*SS>W: bx=rx; yR+=42*SS
        bx=badge(dr,bx,yR,t,fB,fill=BLUE,bg=(255,255,255),outline=ACC)
    yR+=44*SS
    bottom=max(yL,yR)+8*SS

    # ---- CCT + Finitions row — DYNAMIC per product (hidden when no data) ----
    cct = compute_cct(product)
    finishes = product.get("finishes")   # list of (label, "#rrggbb"); None if unknown
    if cct[0] or finishes:
        fS=pop(12,"sb")
        dr.line([0,bottom,W,bottom],fill=LINE,width=1*SS); yb=bottom+12*SS
        cy=yb+26*SS; bh=24*SS
        if cct[0]:
            spaced(dr,(0,yb),"TEMPÉRATURE DE COULEUR",fL,MUT,2)
            bw=300*SS
            grad=Image.new("RGB",(300,1))
            for i in range(300):
                t=i/299
                if t<0.5: tt=t/0.5; r=255; gg=int(214+(244-214)*tt); b=int(170+(229-170)*tt)
                else: tt=(t-0.5)/0.5; r=int(255-(255-235)*tt); gg=int(244+(248-244)*tt); b=int(229+(255-229)*tt)
                grad.putpixel((i,0),(r,gg,b))
            grad=grad.resize((bw,bh),Image.BILINEAR); c.paste(grad,(0,cy))
            dr.rounded_rectangle([0,cy,bw,cy+bh],4*SS,outline=LINE,width=1*SS)
            if cct[0]=="values":
                labs=[f"{k}K" for k in cct[1]]
            else:  # selectable
                labs=["2700K","Sélectionnable","6500K"]
            n=max(1,len(labs)-1)
            for i,lab in enumerate(labs):
                tw=dr.textlength(lab,font=fS); px=int(i*(bw-0)/n)
                px=min(max(0,px-(0 if i==0 else int(tw) if i==len(labs)-1 else int(tw//2))), bw-int(tw))
                dr.text((px,cy+bh+8*SS),lab,font=fS,fill=DARK)
        if finishes:
            tx=int(W*0.46); spaced(dr,(tx,yb),"FINITIONS",fL,MUT,2)
            for i,(lab,hexc) in enumerate(finishes[:4]):
                col=tuple(int(hexc.lstrip('#')[j:j+2],16) for j in (0,2,4))
                oc=LINE if sum(col)>700 else col
                cx=tx+18*SS+i*110*SS; rr=16*SS
                dr.ellipse([cx-rr,cy-2*SS,cx+rr,cy-2*SS+2*rr],fill=col,outline=oc,width=2*SS)
                dr.text((cx-dr.textlength(lab,font=fS)//2,cy+2*rr+2*SS),lab,font=fS,fill=DARK)
        bottom=cy+bh+8*SS+(18*SS if (cct[0]=='values' or finishes) else 28*SS)
    return c.crop((0,0,W,bottom))

def main():
    n=0
    for p in DATA["products"]:
        if p["family_id"] not in SPEC_FAMILIES: continue
        img=render(p)
        stem=p["image"].rsplit(".",1)[0]
        img.save(IMG/f"{stem}-specs.png"); n+=1
    print(f"Generated {n} spec-grid images (SS={SS}) for families {sorted(SPEC_FAMILIES)}")

if __name__=="__main__":
    main()

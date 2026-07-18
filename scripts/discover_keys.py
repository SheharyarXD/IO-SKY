import re, pathlib

ROOT = pathlib.Path("client/src/lib/i18n")

OVERWRITE = {
    "discover.body": {
        "en": "The IO SKY AI Scan maps bottlenecks, automation opportunities and infrastructure improvements.",
        "nl": "De IO SKY AI Scan brengt knelpunten, automatiseringskansen en infrastructuurverbeteringen in kaart.",
        "de": "Der IO SKY AI Scan erfasst Engpässe, Automatisierungschancen und Infrastrukturverbesserungen.",
        "fr": "L'AI Scan d'IO SKY cartographie les goulots d'étranglement, les opportunités d'automatisation et les améliorations d'infrastructure.",
        "es": "El AI Scan de IO SKY mapea cuellos de botella, oportunidades de automatización y mejoras de infraestructura.",
        "it": "L'AI Scan di IO SKY mappa colli di bottiglia, opportunità di automazione e miglioramenti dell'infrastruttura.",
        "pt": "O AI Scan da IO SKY mapeia estrangulamentos, oportunidades de automação e melhorias de infraestrutura.",
        "ar": "يرسم فحص IO SKY بالذكاء الاصطناعي خريطة للاختناقات وفرص الأتمتة وتحسينات البنية التحتية.",
        "zh": "IO SKY AI 扫描可绘制瓶颈、自动化机会和基础设施改进。",
        "ja": "IO SKY AI スキャンは、ボトルネック、自動化の機会、インフラ改善をマッピングします。",
    },
    "discover.cta.btn": {
        "en": "Start free AI Scan", "nl": "Start gratis AI Scan", "de": "Kostenlosen AI Scan starten",
        "fr": "Lancer l'AI Scan gratuit", "es": "Iniciar AI Scan gratis", "it": "Avvia AI Scan gratuito",
        "pt": "Iniciar AI Scan gratuito", "ar": "ابدأ فحص الذكاء الاصطناعي المجاني",
        "zh": "启动免费 AI 扫描", "ja": "無料 AI スキャンを開始",
    },
}

NEW = {
    "discover.cta.secondary": {
        "en": "View AI Scan", "nl": "Bekijk AI Scan", "de": "AI Scan ansehen", "fr": "Voir l'AI Scan",
        "es": "Ver AI Scan", "it": "Vedi AI Scan", "pt": "Ver AI Scan", "ar": "عرض فحص الذكاء الاصطناعي",
        "zh": "查看 AI 扫描", "ja": "AI スキャンを見る",
    },
}

def esc(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')

locales = ["en","nl","de","fr","es","it","pt","ar","zh","ja"]
for code in locales:
    path = ROOT / f"{code}.ts"
    src = path.read_text(encoding="utf-8")
    for key, vals in OVERWRITE.items():
        pat = re.compile(r'("' + re.escape(key) + r'"\s*:\s*)"(?:[^"\\]|\\.)*"', re.S)
        src, n = pat.subn(lambda m: m.group(1) + '"' + esc(vals[code]) + '"', src, count=1)
        if n != 1:
            print(f"[{code}] WARN overwrite {key} not matched")
    anchor = re.search(r'^([ \t]*)"discover\.cta\.btn"\s*:\s*"(?:[^"\\]|\\.)*"\s*,?\s*$', src, re.M)
    if not anchor:
        print(f"[{code}] WARN no discover.cta.btn anchor")
        path.write_text(src, encoding="utf-8")
        continue
    indent = anchor.group(1)
    lines = []
    for key, vals in NEW.items():
        if re.search(r'"' + re.escape(key) + r'"\s*:', src):
            continue
        lines.append(f'{indent}"{key}": "{esc(vals[code])}",')
    if lines:
        block = "\n" + "\n".join(lines)
        src = src[:anchor.end()] + block + src[anchor.end():]
    path.write_text(src, encoding="utf-8")
    print(f"[{code}] discover done ({len(lines)} new)")
print("done")

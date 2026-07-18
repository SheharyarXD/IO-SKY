import re, pathlib

ROOT = pathlib.Path("client/src/lib/i18n")

OVERWRITE = {
    "results.title": {
        "en": "Operational clarity leads to scalable growth.",
        "nl": "Operationele helderheid leidt tot schaalbare groei.",
        "de": "Operative Klarheit führt zu skalierbarem Wachstum.",
        "fr": "La clarté opérationnelle mène à une croissance évolutive.",
        "es": "La claridad operativa conduce a un crecimiento escalable.",
        "it": "La chiarezza operativa porta a una crescita scalabile.",
        "pt": "A clareza operacional leva a um crescimento escalável.",
        "ar": "الوضوح التشغيلي يؤدي إلى نمو قابل للتوسّع.",
        "zh": "运营的清晰度带来可扩展的增长。",
        "ja": "運用の明確さがスケーラブルな成長につながります。",
    },
}

NEW = {
    "results.card1.title": {
        "en": "Automation potential", "nl": "Automatiseringspotentieel", "de": "Automatisierungspotenzial",
        "fr": "Potentiel d'automatisation", "es": "Potencial de automatización", "it": "Potenziale di automazione",
        "pt": "Potencial de automação", "ar": "إمكانات الأتمتة", "zh": "自动化潜力", "ja": "自動化のポテンシャル",
    },
    "results.card1.body": {
        "en": "Where processes can be designed to work smarter.",
        "nl": "Waar processen slimmer kunnen worden ingericht.",
        "de": "Wo Prozesse intelligenter gestaltet werden können.",
        "fr": "Là où les processus peuvent être conçus pour travailler plus intelligemment.",
        "es": "Dónde los procesos pueden diseñarse para trabajar de forma más inteligente.",
        "it": "Dove i processi possono essere progettati per lavorare in modo più intelligente.",
        "pt": "Onde os processos podem ser concebidos para funcionar de forma mais inteligente.",
        "ar": "حيث يمكن تصميم العمليات لتعمل بذكاء أكبر.",
        "zh": "流程可以更智能地设计之处。",
        "ja": "プロセスをより賢く設計できる領域。",
    },
    "results.card2.title": {
        "en": "Process optimization", "nl": "Procesoptimalisatie", "de": "Prozessoptimierung",
        "fr": "Optimisation des processus", "es": "Optimización de procesos", "it": "Ottimizzazione dei processi",
        "pt": "Otimização de processos", "ar": "تحسين العمليات", "zh": "流程优化", "ja": "プロセスの最適化",
    },
    "results.card2.body": {
        "en": "Where manual work can be reduced.",
        "nl": "Waar handmatig werk kan worden verminderd.",
        "de": "Wo manuelle Arbeit reduziert werden kann.",
        "fr": "Là où le travail manuel peut être réduit.",
        "es": "Dónde se puede reducir el trabajo manual.",
        "it": "Dove il lavoro manuale può essere ridotto.",
        "pt": "Onde o trabalho manual pode ser reduzido.",
        "ar": "حيث يمكن تقليل العمل اليدوي.",
        "zh": "可以减少人工操作之处。",
        "ja": "手作業を削減できる領域。",
    },
    "results.card3.title": {
        "en": "Decision-making", "nl": "Besluitvorming", "de": "Entscheidungsfindung",
        "fr": "Prise de décision", "es": "Toma de decisiones", "it": "Processo decisionale",
        "pt": "Tomada de decisão", "ar": "اتخاذ القرار", "zh": "决策", "ja": "意思決定",
    },
    "results.card3.body": {
        "en": "Where data can lead to action faster.",
        "nl": "Waar data sneller tot actie kan leiden.",
        "de": "Wo Daten schneller zu Handlungen führen können.",
        "fr": "Là où les données peuvent mener à l'action plus rapidement.",
        "es": "Dónde los datos pueden conducir a la acción más rápido.",
        "it": "Dove i dati possono portare all'azione più rapidamente.",
        "pt": "Onde os dados podem levar à ação mais rapidamente.",
        "ar": "حيث يمكن للبيانات أن تؤدي إلى إجراء أسرع.",
        "zh": "数据能更快转化为行动之处。",
        "ja": "データがより速く行動につながる領域。",
    },
    "results.card4.title": {
        "en": "Operational visibility", "nl": "Operationele zichtbaarheid", "de": "Operative Transparenz",
        "fr": "Visibilité opérationnelle", "es": "Visibilidad operativa", "it": "Visibilità operativa",
        "pt": "Visibilidade operacional", "ar": "الوضوح التشغيلي", "zh": "运营可见性", "ja": "運用の可視性",
    },
    "results.card4.body": {
        "en": "Where performance, risks and opportunities become visible.",
        "nl": "Waar prestaties, risico's en kansen zichtbaar worden.",
        "de": "Wo Leistung, Risiken und Chancen sichtbar werden.",
        "fr": "Là où la performance, les risques et les opportunités deviennent visibles.",
        "es": "Dónde el rendimiento, los riesgos y las oportunidades se hacen visibles.",
        "it": "Dove prestazioni, rischi e opportunità diventano visibili.",
        "pt": "Onde o desempenho, os riscos e as oportunidades se tornam visíveis.",
        "ar": "حيث يصبح الأداء والمخاطر والفرص مرئية.",
        "zh": "绩效、风险和机会变得可见之处。",
        "ja": "パフォーマンス・リスク・機会が可視化される領域。",
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
    # insert new keys after results.title
    anchor = re.search(r'^([ \t]*)"results\.title"\s*:\s*"(?:[^"\\]|\\.)*"\s*,?\s*$', src, re.M)
    if not anchor:
        print(f"[{code}] WARN no results.title anchor")
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
    print(f"[{code}] results done ({len(lines)} new)")
print("done")

import re, pathlib

ROOT = pathlib.Path("client/src/lib/i18n")

# key -> {locale: value}
DATA = {
    "problem.body": {
        "en": "Most companies don’t stall from a lack of demand. They stall because processes, systems and decision-making can’t scale with them.",
        "nl": "De meeste bedrijven lopen niet vast door gebrek aan vraag. Ze lopen vast doordat processen, systemen en besluitvorming niet kunnen meegroeien.",
        "de": "Die meisten Unternehmen scheitern nicht an fehlender Nachfrage. Sie scheitern, weil Prozesse, Systeme und Entscheidungsfindung nicht mitwachsen können.",
        "fr": "La plupart des entreprises ne calent pas par manque de demande. Elles calent parce que les processus, les systèmes et la prise de décision ne peuvent pas évoluer avec elles.",
        "es": "La mayoría de las empresas no se estancan por falta de demanda. Se estancan porque los procesos, los sistemas y la toma de decisiones no pueden escalar con ellas.",
        "it": "La maggior parte delle aziende non si blocca per mancanza di domanda. Si blocca perché processi, sistemi e decisioni non riescono a crescere con loro.",
        "pt": "A maioria das empresas não estagna por falta de procura. Estagna porque os processos, os sistemas e a tomada de decisão não conseguem escalar com elas.",
        "ar": "معظم الشركات لا تتعثر بسبب نقص الطلب، بل تتعثر لأن العمليات والأنظمة واتخاذ القرار لا تستطيع التوسّع معها.",
        "zh": "大多数企业陷入停滞并非因为需求不足，而是因为流程、系统和决策无法随之扩展。",
        "ja": "多くの企業は需要不足で停滞するのではありません。プロセス、システム、意思決定が成長に追いつけないために停滞するのです。",
    },
    "problem.card1.title": {
        "en": "Less manual work", "nl": "Minder handmatig werk", "de": "Weniger manuelle Arbeit",
        "fr": "Moins de travail manuel", "es": "Menos trabajo manual", "it": "Meno lavoro manuale",
        "pt": "Menos trabalho manual", "ar": "عمل يدوي أقل", "zh": "减少人工操作", "ja": "手作業を削減",
    },
    "problem.card1.body": {
        "en": "Automate recurring processes that slow teams down.",
        "nl": "Automatiseer terugkerende processen die teams vertragen.",
        "de": "Automatisieren Sie wiederkehrende Prozesse, die Teams ausbremsen.",
        "fr": "Automatisez les processus récurrents qui ralentissent les équipes.",
        "es": "Automatice los procesos recurrentes que ralentizan a los equipos.",
        "it": "Automatizza i processi ricorrenti che rallentano i team.",
        "pt": "Automatize processos recorrentes que atrasam as equipas.",
        "ar": "أتمتة العمليات المتكررة التي تبطئ الفرق.",
        "zh": "自动化拖慢团队的重复性流程。",
        "ja": "チームの足を引っ張る繰り返し作業を自動化します。",
    },
    "problem.card2.title": {
        "en": "Faster decision-making", "nl": "Snellere besluitvorming", "de": "Schnellere Entscheidungen",
        "fr": "Décisions plus rapides", "es": "Decisiones más rápidas", "it": "Decisioni più rapide",
        "pt": "Decisões mais rápidas", "ar": "اتخاذ قرارات أسرع", "zh": "更快的决策", "ja": "意思決定の高速化",
    },
    "problem.card2.body": {
        "en": "Bring data, signals and priorities together in one operational view.",
        "nl": "Breng data, signalen en prioriteiten samen in één operationeel overzicht.",
        "de": "Führen Sie Daten, Signale und Prioritäten in einer operativen Übersicht zusammen.",
        "fr": "Réunissez données, signaux et priorités dans une vue opérationnelle unique.",
        "es": "Reúna datos, señales y prioridades en una única vista operativa.",
        "it": "Riunisci dati, segnali e priorità in un'unica vista operativa.",
        "pt": "Reúna dados, sinais e prioridades numa única visão operacional.",
        "ar": "اجمع البيانات والإشارات والأولويات في عرض تشغيلي واحد.",
        "zh": "将数据、信号和优先级汇聚到一个运营视图中。",
        "ja": "データ・シグナル・優先順位を一つの運用ビューに集約します。",
    },
    "problem.card3.title": {
        "en": "More operational visibility", "nl": "Meer operationele zichtbaarheid", "de": "Mehr operative Transparenz",
        "fr": "Plus de visibilité opérationnelle", "es": "Mayor visibilidad operativa", "it": "Maggiore visibilità operativa",
        "pt": "Mais visibilidade operacional", "ar": "وضوح تشغيلي أكبر", "zh": "更高的运营可见性", "ja": "運用の可視性を向上",
    },
    "problem.card3.body": {
        "en": "Surface bottlenecks, performance and opportunities before they slow growth.",
        "nl": "Maak knelpunten, prestaties en kansen zichtbaar voordat ze groei vertragen.",
        "de": "Machen Sie Engpässe, Leistung und Chancen sichtbar, bevor sie das Wachstum bremsen.",
        "fr": "Mettez en lumière les goulots d'étranglement, la performance et les opportunités avant qu'ils ne freinent la croissance.",
        "es": "Visibilice cuellos de botella, rendimiento y oportunidades antes de que frenen el crecimiento.",
        "it": "Porta alla luce colli di bottiglia, prestazioni e opportunità prima che rallentino la crescita.",
        "pt": "Torne visíveis estrangulamentos, desempenho e oportunidades antes que travem o crescimento.",
        "ar": "اكشف الاختناقات والأداء والفرص قبل أن تبطئ النمو.",
        "zh": "在瓶颈、绩效和机会拖慢增长之前将其显现。",
        "ja": "ボトルネック・パフォーマンス・機会を、成長を妨げる前に可視化します。",
    },
    "problem.card4.title": {
        "en": "Systems that scale with you", "nl": "Systemen die meegroeien", "de": "Systeme, die mitwachsen",
        "fr": "Des systèmes qui évoluent avec vous", "es": "Sistemas que escalan con usted", "it": "Sistemi che crescono con te",
        "pt": "Sistemas que crescem consigo", "ar": "أنظمة تتوسّع معك", "zh": "随您扩展的系统", "ja": "ともに拡張するシステム",
    },
    "problem.card4.body": {
        "en": "Build infrastructure that stays scalable as your organization grows.",
        "nl": "Bouw infrastructuur die schaalbaar blijft wanneer uw organisatie groeit.",
        "de": "Bauen Sie Infrastruktur, die skalierbar bleibt, während Ihr Unternehmen wächst.",
        "fr": "Construisez une infrastructure qui reste évolutive à mesure que votre organisation grandit.",
        "es": "Construya una infraestructura que siga siendo escalable a medida que su organización crece.",
        "it": "Costruisci un'infrastruttura che resta scalabile mentre la tua organizzazione cresce.",
        "pt": "Construa uma infraestrutura que permanece escalável à medida que a sua organização cresce.",
        "ar": "ابنِ بنية تظل قابلة للتوسّع مع نمو مؤسستك.",
        "zh": "构建在组织成长时依然可扩展的基础设施。",
        "ja": "組織の成長に合わせて拡張し続けられるインフラを構築します。",
    },
}

def esc(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')

locales = ["en","nl","de","fr","es","it","pt","ar","zh","ja"]
for code in locales:
    path = ROOT / f"{code}.ts"
    src = path.read_text(encoding="utf-8")
    changed = 0
    for key, vals in DATA.items():
        val = vals[code]
        # Replace the value of an existing key (handles multi-line via DOTALL up to closing quote-comma)
        pat = re.compile(r'("' + re.escape(key) + r'"\s*:\s*)"(?:[^"\\]|\\.)*"', re.S)
        new_src, n = pat.subn(lambda m: m.group(1) + '"' + esc(val) + '"', src, count=1)
        if n == 1:
            src = new_src
            changed += 1
        else:
            print(f"[{code}] MISSING key {key}")
    path.write_text(src, encoding="utf-8")
    print(f"[{code}] replaced {changed}/{len(DATA)}")
print("done")

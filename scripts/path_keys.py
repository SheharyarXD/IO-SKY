import re, pathlib

ROOT = pathlib.Path("client/src/lib/i18n")

KEYS = {
    "path.eyebrow": {
        "en": "FROM ANALYSIS TO EXECUTION", "nl": "VAN ANALYSE NAAR UITVOERING",
        "de": "VON DER ANALYSE ZUR UMSETZUNG", "fr": "DE L'ANALYSE À L'EXÉCUTION",
        "es": "DEL ANÁLISIS A LA EJECUCIÓN", "it": "DALL'ANALISI ALL'ESECUZIONE",
        "pt": "DA ANÁLISE À EXECUÇÃO", "ar": "من التحليل إلى التنفيذ",
        "zh": "从分析到执行", "ja": "分析から実行へ",
    },
    "path.title": {
        "en": "From analysis to execution.", "nl": "Van analyse naar uitvoering.",
        "de": "Von der Analyse zur Umsetzung.", "fr": "De l'analyse à l'exécution.",
        "es": "Del análisis a la ejecución.", "it": "Dall'analisi all'esecuzione.",
        "pt": "Da análise à execução.", "ar": "من التحليل إلى التنفيذ.",
        "zh": "从分析到执行。", "ja": "分析から実行へ。",
    },
    "path.body": {
        "en": "Start with insight, choose the right ecosystem, and build an operational infrastructure that grows with your organization step by step.",
        "nl": "Start met inzicht, kies het juiste ecosysteem en bouw stap voor stap een operationele infrastructuur die met uw organisatie meegroeit.",
        "de": "Beginnen Sie mit Erkenntnissen, wählen Sie das richtige Ökosystem und bauen Sie Schritt für Schritt eine operative Infrastruktur, die mit Ihrer Organisation wächst.",
        "fr": "Commencez par l'analyse, choisissez le bon écosystème et construisez pas à pas une infrastructure opérationnelle qui grandit avec votre organisation.",
        "es": "Comience con el análisis, elija el ecosistema adecuado y construya paso a paso una infraestructura operativa que crezca con su organización.",
        "it": "Parti dall'analisi, scegli l'ecosistema giusto e costruisci passo dopo passo un'infrastruttura operativa che cresce con la tua organizzazione.",
        "pt": "Comece com a análise, escolha o ecossistema certo e construa passo a passo uma infraestrutura operacional que cresce com a sua organização.",
        "ar": "ابدأ بالتحليل، واختر النظام المناسب، وابنِ خطوة بخطوة بنية تشغيلية تنمو مع مؤسستك.",
        "zh": "从洞察开始，选择合适的生态系统，并逐步构建随组织成长的运营基础设施。",
        "ja": "インサイトから始め、適切なエコシステムを選び、組織とともに段階的に成長する運用インフラを構築します。",
    },
    # Card 1 — AI Scan
    "path.aiscan.title": {
        "en": "AI Scan", "nl": "AI Scan", "de": "AI Scan", "fr": "AI Scan", "es": "AI Scan",
        "it": "AI Scan", "pt": "AI Scan", "ar": "فحص الذكاء الاصطناعي", "zh": "AI 扫描", "ja": "AI スキャン",
    },
    "path.aiscan.body": {
        "en": "Discover operational bottlenecks, opportunities and automation potential.",
        "nl": "Ontdek operationele knelpunten, kansen en automatiseringspotentieel.",
        "de": "Entdecken Sie operative Engpässe, Chancen und Automatisierungspotenzial.",
        "fr": "Découvrez les goulots d'étranglement opérationnels, les opportunités et le potentiel d'automatisation.",
        "es": "Descubra cuellos de botella operativos, oportunidades y potencial de automatización.",
        "it": "Scopri colli di bottiglia operativi, opportunità e potenziale di automazione.",
        "pt": "Descubra estrangulamentos operacionais, oportunidades e potencial de automação.",
        "ar": "اكتشف الاختناقات التشغيلية والفرص وإمكانات الأتمتة.",
        "zh": "发现运营瓶颈、机会和自动化潜力。",
        "ja": "業務上のボトルネック、機会、自動化のポテンシャルを発見します。",
    },
    "path.aiscan.cta": {
        "en": "Start AI Scan", "nl": "Start AI Scan", "de": "AI Scan starten", "fr": "Lancer l'AI Scan",
        "es": "Iniciar AI Scan", "it": "Avvia AI Scan", "pt": "Iniciar AI Scan",
        "ar": "ابدأ فحص الذكاء الاصطناعي", "zh": "启动 AI 扫描", "ja": "AI スキャンを開始",
    },
    # Card 2 — Growth
    "path.growth.title": {
        "en": "Growth Ecosystem", "nl": "Growth Ecosystem", "de": "Growth Ecosystem", "fr": "Growth Ecosystem",
        "es": "Growth Ecosystem", "it": "Growth Ecosystem", "pt": "Growth Ecosystem",
        "ar": "Growth Ecosystem", "zh": "Growth Ecosystem", "ja": "Growth Ecosystem",
    },
    "path.growth.body": {
        "en": "For startups and growing SMBs that want to automate and structure their processes.",
        "nl": "Voor startups en groeiende MKB-bedrijven die hun processen willen automatiseren en structureren.",
        "de": "Für Start-ups und wachsende KMU, die ihre Prozesse automatisieren und strukturieren möchten.",
        "fr": "Pour les start-ups et les PME en croissance qui souhaitent automatiser et structurer leurs processus.",
        "es": "Para startups y pymes en crecimiento que quieren automatizar y estructurar sus procesos.",
        "it": "Per startup e PMI in crescita che vogliono automatizzare e strutturare i propri processi.",
        "pt": "Para startups e PME em crescimento que querem automatizar e estruturar os seus processos.",
        "ar": "للشركات الناشئة والمتوسطة النامية التي تريد أتمتة عملياتها وهيكلتها.",
        "zh": "面向希望自动化和规范流程的初创企业与成长型中小企业。",
        "ja": "プロセスの自動化と体系化を目指すスタートアップや成長中の中小企業向け。",
    },
    "path.growth.cta": {
        "en": "View Growth", "nl": "Bekijk Growth", "de": "Growth ansehen", "fr": "Voir Growth",
        "es": "Ver Growth", "it": "Vedi Growth", "pt": "Ver Growth", "ar": "عرض Growth",
        "zh": "查看 Growth", "ja": "Growth を見る",
    },
    # Card 3 — Elite
    "path.elite.title": {
        "en": "Elite Ecosystem", "nl": "Elite Ecosystem", "de": "Elite Ecosystem", "fr": "Elite Ecosystem",
        "es": "Elite Ecosystem", "it": "Elite Ecosystem", "pt": "Elite Ecosystem",
        "ar": "Elite Ecosystem", "zh": "Elite Ecosystem", "ja": "Elite Ecosystem",
    },
    "path.elite.body": {
        "en": "For larger SMBs and scale-ups that need advanced automation, integrations and optimization.",
        "nl": "Voor grotere MKB-organisaties en scale-ups die geavanceerde automatisering, integraties en optimalisatie nodig hebben.",
        "de": "Für größere KMU und Scale-ups, die fortschrittliche Automatisierung, Integrationen und Optimierung benötigen.",
        "fr": "Pour les PME plus grandes et les scale-ups qui ont besoin d'automatisation avancée, d'intégrations et d'optimisation.",
        "es": "Para pymes más grandes y scale-ups que necesitan automatización avanzada, integraciones y optimización.",
        "it": "Per PMI più grandi e scale-up che necessitano di automazione avanzata, integrazioni e ottimizzazione.",
        "pt": "Para PME maiores e scale-ups que precisam de automação avançada, integrações e otimização.",
        "ar": "للمؤسسات المتوسطة الأكبر والشركات سريعة النمو التي تحتاج أتمتة وتكاملات وتحسيناً متقدماً.",
        "zh": "面向需要高级自动化、集成和优化的大型中小企业与扩张型企业。",
        "ja": "高度な自動化・統合・最適化を必要とする大規模中小企業やスケールアップ向け。",
    },
    "path.elite.cta": {
        "en": "View Elite", "nl": "Bekijk Elite", "de": "Elite ansehen", "fr": "Voir Elite",
        "es": "Ver Elite", "it": "Vedi Elite", "pt": "Ver Elite", "ar": "عرض Elite",
        "zh": "查看 Elite", "ja": "Elite を見る",
    },
    # Card 4 — Custom
    "path.custom.title": {
        "en": "Custom Intelligence Infrastructure", "nl": "Custom Intelligence Infrastructure",
        "de": "Custom Intelligence Infrastructure", "fr": "Custom Intelligence Infrastructure",
        "es": "Custom Intelligence Infrastructure", "it": "Custom Intelligence Infrastructure",
        "pt": "Custom Intelligence Infrastructure", "ar": "Custom Intelligence Infrastructure",
        "zh": "Custom Intelligence Infrastructure", "ja": "Custom Intelligence Infrastructure",
    },
    "path.custom.body": {
        "en": "For organizations that need custom software, portals, AI systems or private infrastructure.",
        "nl": "Voor organisaties die maatwerksoftware, portalen, AI-systemen of private infrastructuur nodig hebben.",
        "de": "Für Organisationen, die maßgeschneiderte Software, Portale, KI-Systeme oder private Infrastruktur benötigen.",
        "fr": "Pour les organisations qui ont besoin de logiciels sur mesure, de portails, de systèmes d'IA ou d'une infrastructure privée.",
        "es": "Para organizaciones que necesitan software a medida, portales, sistemas de IA o infraestructura privada.",
        "it": "Per organizzazioni che necessitano di software su misura, portali, sistemi IA o infrastruttura privata.",
        "pt": "Para organizações que precisam de software à medida, portais, sistemas de IA ou infraestrutura privada.",
        "ar": "للمؤسسات التي تحتاج برمجيات مخصصة أو بوابات أو أنظمة ذكاء اصطناعي أو بنية خاصة.",
        "zh": "面向需要定制软件、门户、AI 系统或私有基础设施的组织。",
        "ja": "カスタムソフトウェア、ポータル、AI システム、またはプライベートインフラを必要とする組織向け。",
    },
    "path.custom.cta": {
        "en": "View Custom", "nl": "Bekijk Custom", "de": "Custom ansehen", "fr": "Voir Custom",
        "es": "Ver Custom", "it": "Vedi Custom", "pt": "Ver Custom", "ar": "عرض Custom",
        "zh": "查看 Custom", "ja": "Custom を見る",
    },
}

def esc(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')

locales = ["en","nl","de","fr","es","it","pt","ar","zh","ja"]
for code in locales:
    path = ROOT / f"{code}.ts"
    src = path.read_text(encoding="utf-8")
    # find last "}" of the dictionary -> insert before the final "};"
    # Strategy: insert keys right after the first "{" of the exported const object.
    m = re.search(r'(export const \w+\s*:\s*[^=]*=\s*\{)', src)
    if not m:
        m = re.search(r'(\{)', src)
    insert_at = m.end()
    lines = []
    for key, vals in KEYS.items():
        if re.search(r'"' + re.escape(key) + r'"\s*:', src):
            continue
        lines.append(f'  "{key}": "{esc(vals[code])}",')
    if lines:
        block = "\n" + "\n".join(lines)
        src = src[:insert_at] + block + src[insert_at:]
    path.write_text(src, encoding="utf-8")
    print(f"[{code}] inserted {len(lines)} path keys")
print("done")

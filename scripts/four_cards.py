import re, pathlib

ROOT = pathlib.Path("client/src/lib/i18n")

# Existing keys to overwrite (body) + new keys to insert (cta)
BODY = {
    "pillars.infra.body": {
        "en": "CRM systems, dashboards, portals and integrations designed to create operational control.",
        "nl": "CRM-systemen, dashboards, portalen en integraties ontworpen om operationele controle te creëren.",
        "de": "CRM-Systeme, Dashboards, Portale und Integrationen, die operative Kontrolle schaffen.",
        "fr": "Systèmes CRM, tableaux de bord, portails et intégrations conçus pour créer un contrôle opérationnel.",
        "es": "Sistemas CRM, paneles, portales e integraciones diseñados para crear control operativo.",
        "it": "Sistemi CRM, dashboard, portali e integrazioni progettati per creare controllo operativo.",
        "pt": "Sistemas CRM, dashboards, portais e integrações concebidos para criar controlo operacional.",
        "ar": "أنظمة CRM ولوحات معلومات وبوابات وتكاملات مصمّمة لإيجاد تحكّم تشغيلي.",
        "zh": "旨在建立运营管控的 CRM 系统、仪表板、门户和集成。",
        "ja": "運用上のコントロールを生み出すために設計された CRM システム、ダッシュボード、ポータル、インテグレーション。",
    },
    "pillars.intel.body": {
        "en": "AI agents, intelligence workflows and automation systems that reduce manual execution.",
        "nl": "AI-agenten, intelligence workflows en automatiseringssystemen die handmatige uitvoering verminderen.",
        "de": "KI-Agenten, Intelligence-Workflows und Automatisierungssysteme, die manuelle Ausführung reduzieren.",
        "fr": "Agents IA, workflows d'intelligence et systèmes d'automatisation qui réduisent l'exécution manuelle.",
        "es": "Agentes de IA, flujos de inteligencia y sistemas de automatización que reducen la ejecución manual.",
        "it": "Agenti IA, workflow di intelligence e sistemi di automazione che riducono l'esecuzione manuale.",
        "pt": "Agentes de IA, workflows de inteligência e sistemas de automação que reduzem a execução manual.",
        "ar": "وكلاء ذكاء اصطناعي وسير عمل ذكي وأنظمة أتمتة تقلّل التنفيذ اليدوي.",
        "zh": "减少人工执行的 AI 智能体、智能工作流和自动化系统。",
        "ja": "手作業を削減する AI エージェント、インテリジェンスワークフロー、自動化システム。",
    },
    "pillars.growth.body": {
        "en": "Productized operational ecosystems: Growth, Elite and Custom Intelligence.",
        "nl": "Pakketgerichte operationele ecosystemen: Growth, Elite en Custom Intelligence.",
        "de": "Produktisierte operative Ökosysteme: Growth, Elite und Custom Intelligence.",
        "fr": "Écosystèmes opérationnels packagés : Growth, Elite et Custom Intelligence.",
        "es": "Ecosistemas operativos en paquetes: Growth, Elite y Custom Intelligence.",
        "it": "Ecosistemi operativi pacchettizzati: Growth, Elite e Custom Intelligence.",
        "pt": "Ecossistemas operacionais em pacotes: Growth, Elite e Custom Intelligence.",
        "ar": "أنظمة تشغيلية متكاملة جاهزة: Growth وElite وCustom Intelligence.",
        "zh": "产品化的运营生态系统：Growth、Elite 和 Custom Intelligence。",
        "ja": "製品化された運用エコシステム：Growth、Elite、Custom Intelligence。",
    },
    "pillars.enterprise.body": {
        "en": "Custom-built systems and advanced infrastructure tailored to complex organizations.",
        "nl": "Op maat gemaakte systemen en geavanceerde infrastructuur afgestemd op complexe organisaties.",
        "de": "Maßgeschneiderte Systeme und fortschrittliche Infrastruktur für komplexe Organisationen.",
        "fr": "Systèmes sur mesure et infrastructure avancée adaptés aux organisations complexes.",
        "es": "Sistemas a medida e infraestructura avanzada adaptados a organizaciones complejas.",
        "it": "Sistemi su misura e infrastruttura avanzata pensati per organizzazioni complesse.",
        "pt": "Sistemas à medida e infraestrutura avançada adaptados a organizações complexas.",
        "ar": "أنظمة مصمّمة خصيصاً وبنية متقدمة مصمّمة للمؤسسات المعقّدة.",
        "zh": "为复杂组织量身打造的定制系统与先进基础设施。",
        "ja": "複雑な組織に合わせて構築されたカスタムシステムと高度なインフラ。",
    },
}

# New per-card CTA keys
CTA = {
    "pillars.infra.cta": {
        "en": "View infrastructure", "nl": "Bekijk infrastructuur", "de": "Infrastruktur ansehen",
        "fr": "Voir l'infrastructure", "es": "Ver infraestructura", "it": "Vedi l'infrastruttura",
        "pt": "Ver infraestrutura", "ar": "عرض البنية", "zh": "查看基础设施", "ja": "インフラを見る",
    },
    "pillars.intel.cta": {
        "en": "View intelligence", "nl": "Bekijk intelligentie", "de": "Intelligenz ansehen",
        "fr": "Voir l'intelligence", "es": "Ver inteligencia", "it": "Vedi l'intelligence",
        "pt": "Ver inteligência", "ar": "عرض الذكاء", "zh": "查看智能", "ja": "インテリジェンスを見る",
    },
    "pillars.solutions.cta": {
        "en": "View solutions", "nl": "Bekijk oplossingen", "de": "Lösungen ansehen",
        "fr": "Voir les solutions", "es": "Ver soluciones", "it": "Vedi le soluzioni",
        "pt": "Ver soluções", "ar": "عرض الحلول", "zh": "查看解决方案", "ja": "ソリューションを見る",
    },
    "pillars.enterprise.cta": {
        "en": "View enterprise", "nl": "Bekijk enterprise", "de": "Enterprise ansehen",
        "fr": "Voir enterprise", "es": "Ver enterprise", "it": "Vedi enterprise",
        "pt": "Ver enterprise", "ar": "عرض Enterprise", "zh": "查看企业版", "ja": "エンタープライズを見る",
    },
}

def esc(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')

locales = ["en","nl","de","fr","es","it","pt","ar","zh","ja"]
for code in locales:
    path = ROOT / f"{code}.ts"
    src = path.read_text(encoding="utf-8")
    # 1) Overwrite bodies
    for key, vals in BODY.items():
        pat = re.compile(r'("' + re.escape(key) + r'"\s*:\s*)"(?:[^"\\]|\\.)*"', re.S)
        src, n = pat.subn(lambda m: m.group(1) + '"' + esc(vals[code]) + '"', src, count=1)
        if n != 1:
            print(f"[{code}] WARN body {key} not matched")
    # 2) Insert CTA keys after pillars.growth.body line (anchor)
    anchor = re.search(r'^([ \t]*)"pillars\.growth\.body"\s*:\s*"(?:[^"\\]|\\.)*"\s*,?\s*$', src, re.M)
    if not anchor:
        print(f"[{code}] WARN no anchor for cta insert")
        continue
    indent = anchor.group(1)
    cta_lines = []
    for key, vals in CTA.items():
        # skip if already present
        if re.search(r'"' + re.escape(key) + r'"\s*:', src):
            continue
        cta_lines.append(f'{indent}"{key}": "{esc(vals[code])}",')
    if cta_lines:
        block = "\n" + "\n".join(cta_lines)
        src = src[:anchor.end()] + block + src[anchor.end():]
    path.write_text(src, encoding="utf-8")
    print(f"[{code}] bodies+cta done ({len(cta_lines)} cta inserted)")
print("done")

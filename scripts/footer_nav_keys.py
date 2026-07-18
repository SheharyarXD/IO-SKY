import re, pathlib

ROOT = pathlib.Path("client/src/lib/i18n")

# Per-locale translations for the 10 footer nav keys
KEYS = {
    "de": {
        "footer.nav.infra.operational": "Operative Infrastruktur",
        "footer.nav.infra.automation": "Automatisierungssysteme",
        "footer.nav.infra.data": "Daten & Einblick",
        "footer.nav.infra.integrations": "Integrationen",
        "footer.nav.infra.security": "Security & Governance",
        "footer.nav.intel.agents": "KI-Agenten",
        "footer.nav.intel.operational": "Operative Intelligenz",
        "footer.nav.intel.predictive": "Prädiktive Systeme",
        "footer.nav.intel.executive": "Executive Analytics",
        "footer.nav.intel.hub": "Intelligence-Hub",
    },
    "fr": {
        "footer.nav.infra.operational": "Infrastructure opérationnelle",
        "footer.nav.infra.automation": "Systèmes d'automatisation",
        "footer.nav.infra.data": "Données & visibilité",
        "footer.nav.infra.integrations": "Intégrations",
        "footer.nav.infra.security": "Sécurité & gouvernance",
        "footer.nav.intel.agents": "Agents IA",
        "footer.nav.intel.operational": "Intelligence opérationnelle",
        "footer.nav.intel.predictive": "Systèmes prédictifs",
        "footer.nav.intel.executive": "Analytique exécutive",
        "footer.nav.intel.hub": "Hub d'intelligence",
    },
    "es": {
        "footer.nav.infra.operational": "Infraestructura operativa",
        "footer.nav.infra.automation": "Sistemas de automatización",
        "footer.nav.infra.data": "Datos y visibilidad",
        "footer.nav.infra.integrations": "Integraciones",
        "footer.nav.infra.security": "Seguridad y gobernanza",
        "footer.nav.intel.agents": "Agentes de IA",
        "footer.nav.intel.operational": "Inteligencia operativa",
        "footer.nav.intel.predictive": "Sistemas predictivos",
        "footer.nav.intel.executive": "Analítica ejecutiva",
        "footer.nav.intel.hub": "Hub de inteligencia",
    },
    "it": {
        "footer.nav.infra.operational": "Infrastruttura operativa",
        "footer.nav.infra.automation": "Sistemi di automazione",
        "footer.nav.infra.data": "Dati e visibilità",
        "footer.nav.infra.integrations": "Integrazioni",
        "footer.nav.infra.security": "Sicurezza e governance",
        "footer.nav.intel.agents": "Agenti IA",
        "footer.nav.intel.operational": "Intelligence operativa",
        "footer.nav.intel.predictive": "Sistemi predittivi",
        "footer.nav.intel.executive": "Analisi executive",
        "footer.nav.intel.hub": "Hub di intelligence",
    },
    "pt": {
        "footer.nav.infra.operational": "Infraestrutura operacional",
        "footer.nav.infra.automation": "Sistemas de automação",
        "footer.nav.infra.data": "Dados e visibilidade",
        "footer.nav.infra.integrations": "Integrações",
        "footer.nav.infra.security": "Segurança e governação",
        "footer.nav.intel.agents": "Agentes de IA",
        "footer.nav.intel.operational": "Inteligência operacional",
        "footer.nav.intel.predictive": "Sistemas preditivos",
        "footer.nav.intel.executive": "Análise executiva",
        "footer.nav.intel.hub": "Hub de inteligência",
    },
    "ar": {
        "footer.nav.infra.operational": "البنية التشغيلية",
        "footer.nav.infra.automation": "أنظمة الأتمتة",
        "footer.nav.infra.data": "البيانات والوضوح",
        "footer.nav.infra.integrations": "التكاملات",
        "footer.nav.infra.security": "الأمن والحوكمة",
        "footer.nav.intel.agents": "وكلاء الذكاء الاصطناعي",
        "footer.nav.intel.operational": "الذكاء التشغيلي",
        "footer.nav.intel.predictive": "الأنظمة التنبؤية",
        "footer.nav.intel.executive": "تحليلات تنفيذية",
        "footer.nav.intel.hub": "مركز الذكاء",
    },
    "zh": {
        "footer.nav.infra.operational": "运营基础设施",
        "footer.nav.infra.automation": "自动化系统",
        "footer.nav.infra.data": "数据与可见性",
        "footer.nav.infra.integrations": "集成",
        "footer.nav.infra.security": "安全与治理",
        "footer.nav.intel.agents": "AI 智能体",
        "footer.nav.intel.operational": "运营智能",
        "footer.nav.intel.predictive": "预测系统",
        "footer.nav.intel.executive": "高管分析",
        "footer.nav.intel.hub": "智能中枢",
    },
    "ja": {
        "footer.nav.infra.operational": "オペレーショナルインフラ",
        "footer.nav.infra.automation": "自動化システム",
        "footer.nav.infra.data": "データと可視性",
        "footer.nav.infra.integrations": "インテグレーション",
        "footer.nav.infra.security": "セキュリティとガバナンス",
        "footer.nav.intel.agents": "AIエージェント",
        "footer.nav.intel.operational": "オペレーショナルインテリジェンス",
        "footer.nav.intel.predictive": "予測システム",
        "footer.nav.intel.executive": "エグゼクティブ分析",
        "footer.nav.intel.hub": "インテリジェンスハブ",
    },
}

# Localized copyright (no B.V.), with period after IO SKY
COPYRIGHT = {
    "de": "© 2026 IO SKY. Alle Rechte vorbehalten.",
    "fr": "© 2026 IO SKY. Tous droits réservés.",
    "es": "© 2026 IO SKY. Todos los derechos reservados.",
    "it": "© 2026 IO SKY. Tutti i diritti riservati.",
    "pt": "© 2026 IO SKY. Todos os direitos reservados.",
    "ar": "© 2026 IO SKY. جميع الحقوق محفوظة.",
    "zh": "© 2026 IO SKY. 保留所有权利。",
    "ja": "© 2026 IO SKY. All rights reserved.",
}

def esc(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')

for code, kv in KEYS.items():
    path = ROOT / f"{code}.ts"
    src = path.read_text(encoding="utf-8")
    # Find the footer.copyright line
    m = re.search(r'^([ \t]*)"footer\.copyright"\s*:\s*"(?:[^"\\]|\\.)*"\s*,?\s*$', src, re.M)
    if not m:
        print(f"[{code}] WARN: footer.copyright not found")
        continue
    indent = m.group(1)
    # Replace copyright value
    new_copyright = f'{indent}"footer.copyright": "{esc(COPYRIGHT[code])}",'
    # Build new key lines
    lines = [new_copyright]
    for k, v in kv.items():
        lines.append(f'{indent}"{k}": "{esc(v)}",')
    block = "\n".join(lines)
    src = src[:m.start()] + block + src[m.end():]
    path.write_text(src, encoding="utf-8")
    print(f"[{code}] updated copyright + {len(kv)} keys")

print("done")

import re, pathlib

ROOT = pathlib.Path("client/src/lib/i18n")

NEW = {
    "hov.opScore": {
        "en": "Operational Intelligence Score", "nl": "Operationele intelligentiescore",
        "de": "Operational-Intelligence-Score", "fr": "Score d'intelligence opérationnelle",
        "es": "Puntuación de inteligencia operativa", "it": "Punteggio di intelligenza operativa",
        "pt": "Pontuação de inteligência operacional", "ar": "درجة الذكاء التشغيلي",
        "zh": "运营智能评分", "ja": "オペレーショナルインテリジェンススコア",
    },
    "hov.readiness": {
        "en": "Automation readiness", "nl": "Automatiseringsgereedheid", "de": "Automatisierungsbereitschaft",
        "fr": "Maturité d'automatisation", "es": "Preparación para la automatización",
        "it": "Prontezza all'automazione", "pt": "Prontidão para automação",
        "ar": "جاهزية الأتمتة", "zh": "自动化就绪度", "ja": "自動化の準備度",
    },
    "hov.efficiency": {
        "en": "Efficiency opportunities", "nl": "Efficiëntiekansen", "de": "Effizienzchancen",
        "fr": "Opportunités d'efficacité", "es": "Oportunidades de eficiencia",
        "it": "Opportunità di efficienza", "pt": "Oportunidades de eficiência",
        "ar": "فرص الكفاءة", "zh": "效率提升机会", "ja": "効率化の機会",
    },
    "hov.opp.intake": {
        "en": "Streamline intake handling", "nl": "Intakeproces stroomlijnen", "de": "Eingang straffen",
        "fr": "Rationaliser la réception", "es": "Optimizar la recepción", "it": "Semplificare l'intake",
        "pt": "Otimizar a triagem", "ar": "تبسيط معالجة الطلبات", "zh": "简化接收处理", "ja": "受付処理の効率化",
    },
    "hov.opp.handover": {
        "en": "Reduce manual handovers", "nl": "Handmatige overdrachten verminderen", "de": "Manuelle Übergaben reduzieren",
        "fr": "Réduire les transferts manuels", "es": "Reducir traspasos manuales", "it": "Ridurre i passaggi manuali",
        "pt": "Reduzir transferências manuais", "ar": "تقليل عمليات التسليم اليدوية", "zh": "减少人工交接", "ja": "手動の引き継ぎを削減",
    },
    "hov.opp.tag.process": {
        "en": "Process", "nl": "Proces", "de": "Prozess", "fr": "Processus", "es": "Proceso",
        "it": "Processo", "pt": "Processo", "ar": "عملية", "zh": "流程", "ja": "プロセス",
    },
    "hov.opp.tag.workflow": {
        "en": "Workflow", "nl": "Workflow", "de": "Workflow", "fr": "Workflow", "es": "Flujo de trabajo",
        "it": "Workflow", "pt": "Fluxo de trabalho", "ar": "سير العمل", "zh": "工作流", "ja": "ワークフロー",
    },
    "hov.systemHealth": {
        "en": "System health", "nl": "Systeemstatus", "de": "Systemzustand", "fr": "État du système",
        "es": "Estado del sistema", "it": "Stato del sistema", "pt": "Estado do sistema",
        "ar": "حالة النظام", "zh": "系统健康", "ja": "システムの健全性",
    },
    "hov.health.integrations": {
        "en": "Integrations", "nl": "Integraties", "de": "Integrationen", "fr": "Intégrations",
        "es": "Integraciones", "it": "Integrazioni", "pt": "Integrações", "ar": "التكاملات",
        "zh": "集成", "ja": "統合",
    },
    "hov.health.data": {
        "en": "Data pipelines", "nl": "Datapijplijnen", "de": "Datenpipelines", "fr": "Pipelines de données",
        "es": "Canalizaciones de datos", "it": "Pipeline di dati", "pt": "Pipelines de dados",
        "ar": "مسارات البيانات", "zh": "数据管道", "ja": "データパイプライン",
    },
    "hov.health.automations": {
        "en": "Automations", "nl": "Automatiseringen", "de": "Automatisierungen", "fr": "Automatisations",
        "es": "Automatizaciones", "it": "Automazioni", "pt": "Automações", "ar": "الأتمتة",
        "zh": "自动化", "ja": "自動化",
    },
    "hov.health.ok": {
        "en": "Healthy", "nl": "Gezond", "de": "Stabil", "fr": "Sain", "es": "Saludable",
        "it": "Stabile", "pt": "Saudável", "ar": "سليم", "zh": "正常", "ja": "良好",
    },
    "hov.health.watch": {
        "en": "Watch", "nl": "Aandacht", "de": "Beobachten", "fr": "À surveiller", "es": "Vigilar",
        "it": "Da monitorare", "pt": "Atenção", "ar": "مراقبة", "zh": "关注", "ja": "要注意",
    },
    "hov.nextActions": {
        "en": "Next best actions", "nl": "Volgende beste acties", "de": "Nächste beste Schritte",
        "fr": "Prochaines actions prioritaires", "es": "Próximas mejores acciones",
        "it": "Prossime azioni migliori", "pt": "Próximas melhores ações",
        "ar": "أفضل الإجراءات التالية", "zh": "下一步最佳行动", "ja": "次に取るべき最善のアクション",
    },
    "hov.action.mapIntake": {
        "en": "Map the intake workflow", "nl": "Breng het intakeproces in kaart", "de": "Eingangs-Workflow erfassen",
        "fr": "Cartographier le flux de réception", "es": "Mapear el flujo de recepción",
        "it": "Mappare il flusso di intake", "pt": "Mapear o fluxo de triagem",
        "ar": "رسم خريطة سير عمل الاستقبال", "zh": "梳理接收工作流", "ja": "受付ワークフローを可視化",
    },
    "hov.action.connectData": {
        "en": "Connect data sources", "nl": "Verbind databronnen", "de": "Datenquellen verbinden",
        "fr": "Connecter les sources de données", "es": "Conectar fuentes de datos",
        "it": "Collegare le fonti di dati", "pt": "Ligar as fontes de dados",
        "ar": "ربط مصادر البيانات", "zh": "连接数据源", "ja": "データソースを接続",
    },
    "hov.action.autoFollowups": {
        "en": "Automate follow-ups", "nl": "Automatiseer opvolging", "de": "Follow-ups automatisieren",
        "fr": "Automatiser les relances", "es": "Automatizar los seguimientos",
        "it": "Automatizzare i follow-up", "pt": "Automatizar os seguimentos",
        "ar": "أتمتة المتابعات", "zh": "自动化跟进", "ja": "フォローアップを自動化",
    },
}

def esc(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')

locales = ["en","nl","de","fr","es","it","pt","ar","zh","ja"]
for code in locales:
    path = ROOT / f"{code}.ts"
    src = path.read_text(encoding="utf-8")
    anchor = re.search(r'^([ \t]*)"hov\.title"\s*:\s*"(?:[^"\\]|\\.)*"\s*,?\s*$', src, re.M)
    if not anchor:
        print(f"[{code}] WARN no hov.title anchor"); path.write_text(src, encoding="utf-8"); continue
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
    print(f"[{code}] hov done ({len(lines)} new)")
print("done")

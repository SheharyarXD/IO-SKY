#!/usr/bin/env python3
"""Inject Infrastructure page i18n keys for the Italian locale."""
import re
import pathlib

I18N = pathlib.Path(__file__).resolve().parent.parent / "client/src/lib/i18n"

IT = {
    "infra.hero.eyebrow": "INFRASTRUTTURA",
    "infra.hero.title.part1": "Infrastruttura operativa che supporta la tua organizzazione mentre",
    "infra.hero.title.accent": "cresci",
    "infra.hero.title.dot": ".",
    "infra.hero.body": "Progettiamo sistemi che collegano i processi, aumentano la visibilit\u00e0 e riducono la complessit\u00e0 operativa.",
    "infra.hero.cta.book": "Avvia AI Scan",
    "infra.hero.cta.explore": "Prenota una call strategica",
    "infra.viz.badge": "CENTRO DI COMANDO OPERATIVO",
    "infra.viz.left.title": "Sistemi",
    "infra.viz.left.crm": "CRM", "infra.viz.left.erp": "ERP",
    "infra.viz.left.comms": "Comunicazione", "infra.viz.left.integrations": "Integrazioni",
    "infra.viz.core.title": "IO SKY Operational Layer",
    "infra.viz.core.sub": "Tutto converge qui",
    "infra.viz.right.title": "Risultati",
    "infra.viz.right.visibility": "Visibilit\u00e0 operativa",
    "infra.viz.right.automation": "Automazione",
    "infra.viz.right.health": "Salute dei flussi di lavoro",
    "infra.viz.right.status": "Stato dei processi",
    "infra.cap.crm.title": "Infrastruttura CRM",
    "infra.cap.crm.body": "Centralizza dati dei clienti, processi e flussi di lavoro operativi in un ambiente gestibile.",
    "infra.cap.crm.cta": "Vedi infrastruttura CRM",
    "infra.cap.automation.title": "Sistemi di automazione",
    "infra.cap.automation.body": "Automatizza le attivit\u00e0 ricorrenti affinch\u00e9 i team possano concentrarsi sulla crescita.",
    "infra.cap.automation.cta": "Vedi automazione",
    "infra.cap.data.title": "Dati e Visibilit\u00e0",
    "infra.cap.data.body": "Riunisci prestazioni, rischi e opportunit\u00e0 in dashboard in tempo reale.",
    "infra.cap.data.cta": "Vedi dati e visibilit\u00e0",
    "infra.cap.integrations.title": "Integrazioni",
    "infra.cap.integrations.body": "Collega i sistemi affinch\u00e9 le informazioni fluiscano automaticamente tra i reparti.",
    "infra.cap.integrations.cta": "Vedi integrazioni",
    "infra.cap.security.title": "Sicurezza e Governance",
    "infra.cap.security.body": "Proteggi i dati, gestisci gli accessi e crea controllo sui processi critici.",
    "infra.cap.security.cta": "Vedi sicurezza",
    "infra.cap.scalability.title": "Scalabilit\u00e0",
    "infra.cap.scalability.body": "Costruisci un'infrastruttura che funziona oggi e ti supporta ancora domani.",
    "infra.cap.scalability.cta": "Vedi scalabilit\u00e0",
    "infra.benefit.control.title": "Controllo operativo",
    "infra.benefit.control.sub": "Maggiore visibilit\u00e0 su processi e prestazioni.",
    "infra.benefit.automation.title": "Automazione",
    "infra.benefit.automation.sub": "Meno lavoro manuale e meno errori.",
    "infra.benefit.integration.title": "Integrazione",
    "infra.benefit.integration.sub": "Sistemi che collaborano senza lavoro duplicato.",
    "infra.benefit.scalability.title": "Scalabilit\u00e0",
    "infra.benefit.scalability.sub": "Infrastruttura che cresce con la tua organizzazione.",
    "infra.benefit.governance.title": "Governance",
    "infra.benefit.governance.sub": "Processi chiari, controllo degli accessi e conformit\u00e0.",
    "infra.midcta.title": "Scopri dove la tua infrastruttura pu\u00f2 essere migliorata.",
    "infra.midcta.body": "Inizia con un AI Scan o prenota una call strategica.",
    "infra.midcta.scan": "Avvia AI Scan",
    "infra.midcta.book": "Prenota una call strategica",
    "infra.results.eyebrow": "COSA RIVELA L'AI SCAN",
    "infra.results.title": "Chiarezza operativa, non metriche di vanit\u00e0.",
    "infra.results.i1": "Potenziale di automazione",
    "infra.results.i2": "Efficienza dei flussi di lavoro",
    "infra.results.i3": "Ottimizzazione dei processi",
    "infra.results.i4": "Visibilit\u00e0 operativa",
    "infra.diagram.eyebrow": "TUTTO SI UNISCE",
    "infra.diagram.title": "Un unico livello operativo che collega tutta la tua azienda.",
    "infra.diagram.core": "IO SKY Operational Layer",
    "infra.diagram.left.title": "Fonti",
    "infra.diagram.left.crm": "CRM", "infra.diagram.left.erp": "ERP",
    "infra.diagram.left.comms": "Comunicazione", "infra.diagram.left.support": "Supporto",
    "infra.diagram.right.title": "Risultati",
    "infra.diagram.right.dashboards": "Dashboard", "infra.diagram.right.analytics": "Analisi",
    "infra.diagram.right.ai": "AI", "infra.diagram.right.automation": "Automazione",
}


def esc(v: str) -> str:
    return v.replace("\\", "\\\\").replace('"', '\\"')


def upsert(path: pathlib.Path, kv: dict):
    text = path.read_text(encoding="utf-8")
    for key, val in kv.items():
        line = f'  "{key}": "{esc(val)}",'
        pat = re.compile(r'^[ \t]*"' + re.escape(key) + r'"\s*:\s*(?:"(?:[^"\\]|\\.)*"|\s*\n\s*"(?:[^"\\]|\\.)*")\s*,?[ \t]*$',
                         re.MULTILINE)
        if pat.search(text):
            text = pat.sub(line, text, count=1)
        else:
            idx = text.rfind("};")
            text = text[:idx] + line + "\n" + text[idx:]
    path.write_text(text, encoding="utf-8")


upsert(I18N / "it.ts", IT)
print(f"it: upserted {len(IT)} keys")

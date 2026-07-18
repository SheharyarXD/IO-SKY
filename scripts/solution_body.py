import re, pathlib

ROOT = pathlib.Path("client/src/lib/i18n")

BODY = {
    "en": "IO SKY connects processes, automation, data and AI into one operational layer that makes growth controllable.",
    "nl": "IO SKY verbindt processen, automatisering, data en AI in één operationele laag die groei bestuurbaar maakt.",
    "de": "IO SKY verbindet Prozesse, Automatisierung, Daten und KI zu einer operativen Schicht, die Wachstum steuerbar macht.",
    "fr": "IO SKY connecte les processus, l'automatisation, les données et l'IA en une seule couche opérationnelle qui rend la croissance pilotable.",
    "es": "IO SKY conecta procesos, automatización, datos e IA en una única capa operativa que hace que el crecimiento sea gobernable.",
    "it": "IO SKY collega processi, automazione, dati e IA in un unico livello operativo che rende la crescita governabile.",
    "pt": "A IO SKY liga processos, automação, dados e IA numa única camada operacional que torna o crescimento controlável.",
    "ar": "تربط IO SKY العمليات والأتمتة والبيانات والذكاء الاصطناعي في طبقة تشغيلية واحدة تجعل النمو قابلاً للتحكم.",
    "zh": "IO SKY 将流程、自动化、数据和 AI 连接到一个可让增长可控的运营层中。",
    "ja": "IO SKY はプロセス、自動化、データ、AI を一つの運用レイヤーに統合し、成長を制御可能にします。",
}

def esc(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')

for code, val in BODY.items():
    path = ROOT / f"{code}.ts"
    src = path.read_text(encoding="utf-8")
    pat = re.compile(r'("solution\.body"\s*:\s*)"(?:[^"\\]|\\.)*"', re.S)
    new_src, n = pat.subn(lambda m: m.group(1) + '"' + esc(val) + '"', src, count=1)
    if n == 1:
        path.write_text(new_src, encoding="utf-8")
        print(f"[{code}] solution.body updated")
    else:
        print(f"[{code}] WARN solution.body not matched")
print("done")

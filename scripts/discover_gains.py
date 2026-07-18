import re, pathlib

ROOT = pathlib.Path("client/src/lib/i18n")

# Replace fabricated percentage gains with qualitative opportunity tags.
GAINS = {
    "discover.gain1": {
        "en": "Efficiency", "nl": "Efficiëntie", "de": "Effizienz", "fr": "Efficacité",
        "es": "Eficiencia", "it": "Efficienza", "pt": "Eficiência", "ar": "الكفاءة",
        "zh": "效率", "ja": "効率",
    },
    "discover.gain2": {
        "en": "Visibility", "nl": "Zichtbaarheid", "de": "Transparenz", "fr": "Visibilité",
        "es": "Visibilidad", "it": "Visibilità", "pt": "Visibilidade", "ar": "الوضوح",
        "zh": "可见性", "ja": "可視性",
    },
    "discover.gain3": {
        "en": "Conversion", "nl": "Conversie", "de": "Conversion", "fr": "Conversion",
        "es": "Conversión", "it": "Conversione", "pt": "Conversão", "ar": "التحويل",
        "zh": "转化", "ja": "コンバージョン",
    },
}

def esc(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')

locales = ["en","nl","de","fr","es","it","pt","ar","zh","ja"]
for code in locales:
    path = ROOT / f"{code}.ts"
    src = path.read_text(encoding="utf-8")
    n = 0
    for key, vals in GAINS.items():
        val = esc(vals[code])
        pat = re.compile(r'("' + re.escape(key) + r'"\s*:\s*)"(?:[^"\\]|\\.)*"')
        new, cnt = pat.subn(lambda m: m.group(1) + '"' + val + '"', src)
        if cnt:
            src = new; n += cnt
    path.write_text(src, encoding="utf-8")
    print(f"[{code}] replaced {n} gain values")
print("done")

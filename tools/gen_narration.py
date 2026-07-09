#!/usr/bin/env python3
"""數感實驗室示範旁白生成器(離線,Kokoro zf_xiaoxiao + misaki[zh])。
用法:
  ~/Desktop/AI_MAC/tools/kokoro-venv/bin/python gen_narration.py [--force]
  ~/Desktop/AI_MAC/tools/kokoro-venv/bin/python gen_narration.py --subject science7a [--force]

  --subject <name>  指定科目:讀 tools/captions_<name>.json,輸出 audio/<id>_<i>.mp3
                    (預設:讀 tools/captions.json,行為與原來一致)
  --force           強制重新生成已存在的 mp3

讀 captions JSON → 每句符號轉口語 → 生成 audio/<ID>_<i>.mp3
音色:zf_xiaoxiao(大陸腔,使用者定案 2026-07-06);中文 G2P 必用 misaki(espeak 唸不了)。
字幕寫作規則:禁用括號(舊版會吞成黏音);座標/數對用「3、負2」式寫法;符號轉換表見 WORDS。
"""
import re, os, sys, json, subprocess, tempfile
import soundfile as sf
from kokoro_onnx import Kokoro
from misaki import zh

KROOT = os.path.expanduser("~/Desktop/AI_MAC/tools/kokoro-venv")
FF = os.path.expanduser("~/Desktop/AI_MAC/tools/ffmpeg/ffmpeg")
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE = "zf_xiaoxiao"

# 多字元詞先換(順序重要)
WORDS = [
    ("≈", "約等於"), ("≠", "不等於"), ("≤", "小於等於"), ("≥", "大於等於"),
    ("det", "行列式"), ("sin", "正弦"), ("cos", "餘弦"), ("span", "張成空間"),
    ("PPV", "P P V"), ("SVD", "S V D"),
    ("σ", "西格瑪"), ("λ", "拉姆達"), ("μ", "謬"), ("π", "派"), ("θ", "西塔"),
    ("Σ", "西格瑪"), ("Δ", "德爾塔"),
    ("î", "i"), ("ĵ", "j"), ("₁", "一"), ("₂", "二"), ("²", "平方"), ("³", "立方"),
    ("×", "乘以"), ("−", "減"), ("±", "正負"), ("∪", "聯集"), ("∩", "交集"), ("⊥", "垂直"),
    ("°", "度"), ("′", "撇"), ("·", " "), ("|", ""),
    ("—", "，"), ("…", "，"), ("~", "到"),
    ("<", "小於"), (">", "大於"), ("=", " 等於 "), ("+", " 加 "),
    ("(", "，"), (")", "，"), ("（", "，"), ("）", "，"),  # 括號=停頓非刪除(黏音教訓 2026-07-08);字幕寫作規則:盡量別用括號,改逗號
]

def say(t):
    # 代數字母:x/y 唸中文名(kokoro zh 對孤立拉丁字母發音不清,STT 回讀驗證 2026-07-08)
    t = re.sub(r"(?<![A-Za-z0-9])(\d+)\s*[xX](?![A-Za-z])", r"\1 艾克斯", t)
    t = re.sub(r"(?<![A-Za-z])[xX](?![A-Za-z])", "艾克斯", t)
    t = re.sub(r"(?<![A-Za-z])[yY](?![A-Za-z])", "歪", t)
    # 箭頭接數字 = 趨近;其餘箭頭 = 停頓
    t = re.sub(r"→\s*(-?[0-9∞])", r" 趨近 \1", t)
    t = t.replace("→", "，")
    # 斜線先處理:數字間的 /(如 68/95/99.7)是並列分隔 → 頓號(需在 % 轉換前,否則 99.7% 會斷掉相鄰)
    while re.search(r"\d\s*/\s*\d", t):
        t = re.sub(r"(?<=\d)\s*/\s*(?=\d)", "、", t, count=1)
    t = t.replace("/", "除以")   # 其餘(如 sin x/x)是除法
    # 百分比:「50%」→「百分之50」(語序),裸 % → 百分比
    t = re.sub(r"(\d+(?:\.\d+)?)\s*%", r"百分之\1", t)
    t = t.replace("%", "百分比")
    for a, b in WORDS:
        t = t.replace(a, b)
    t = re.sub(r"[，,、]\s*[，,]+", "，", t)   # 收合重複逗號
    t = re.sub(r"\s{2,}", " ", t).strip(" ，")
    return t

def main():
    force = "--force" in sys.argv
    # --subject <name> 參數:讀 tools/captions_<name>.json;未指定則讀 captions.json
    subject = None
    if "--subject" in sys.argv:
        idx = sys.argv.index("--subject")
        if idx + 1 < len(sys.argv):
            subject = sys.argv[idx + 1]
    if subject:
        cap_file = os.path.join(HERE, "tools", f"captions_{subject}.json")
        if not os.path.exists(cap_file):
            print(f"錯誤:找不到 {cap_file}", file=sys.stderr)
            sys.exit(1)
        print(f"[gen_narration] subject={subject}, captions={cap_file}")
    else:
        cap_file = os.path.join(HERE, "tools", "captions.json")
    caps = json.load(open(cap_file, encoding="utf-8"))
    outdir = os.path.join(HERE, "audio"); os.makedirs(outdir, exist_ok=True)
    k = Kokoro(f"{KROOT}/kokoro-v1.0.onnx", f"{KROOT}/voices-v1.0.bin")
    g2p = zh.ZHG2P()
    manifest = {}
    made = skipped = 0
    for c in caps:
        key = f"{c['id']}_{c['i']}"
        mp3 = os.path.join(outdir, f"{key}.mp3")
        spoken = say(c["cap"])
        manifest[key] = spoken
        if os.path.exists(mp3) and not force:
            skipped += 1; continue
        ph, _ = g2p(spoken)
        samples, sr = k.create(ph, voice=VOICE, speed=1.0, is_phonemes=True)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
            sf.write(tf.name, samples, sr)
            subprocess.run([FF, "-y", "-i", tf.name, "-b:a", "80k", mp3],
                           check=True, capture_output=True)
            os.unlink(tf.name)
        made += 1
        print(f"  {key}: {spoken[:42]}")
    json.dump(manifest, open(os.path.join(outdir, "narration.json"), "w"),
              ensure_ascii=False, indent=1)
    print(f"done: {made} generated, {skipped} skipped, manifest={len(manifest)}")

if __name__ == "__main__":
    main()

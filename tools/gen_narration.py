#!/usr/bin/env python3
"""數感實驗室示範旁白生成器(雙引擎:中文=edge-tts 曉臻台灣腔 / 英文=Kokoro zf_xiaoxiao)。
用法:
  # 預設:科目含 science → edge-tts 曉臻;其餘(數學) → Kokoro
  ~/Desktop/AI_MAC/tools/kokoro-venv/bin/python gen_narration.py [--force]
  ~/Desktop/AI_MAC/tools/kokoro-venv/bin/python gen_narration.py --subject science7a [--force]

  --subject <name>  指定科目:讀 tools/captions_<name>.json,輸出 audio/<id>_<i>.mp3
                    (預設:讀 tools/captions.json,行為與原來一致)
  --engine  <eng>   強制指定引擎:kokoro | edge(預設依科目自動選)
  --force           強制重新生成已存在的 mp3

引擎選擇規則(不傳 --engine 時):
  subject 名稱含 "science" → edge-tts zh-TW-HsiaoChenNeural(台灣腔)
  其餘(數學) → Kokoro zf_xiaoxiao(保留既有行為不變)

讀 captions JSON → 每句符號轉口語 → 生成 audio/<ID>_<i>.mp3
字幕寫作規則:禁用括號(舊版會吞成黏音);座標/數對用「3、負2」式寫法;符號轉換表見 WORDS。
"""
import asyncio
import os
import re
import sys
import json
import subprocess
import tempfile

KROOT = os.path.expanduser("~/Desktop/AI_MAC/tools/kokoro-venv")
FF    = os.path.expanduser("~/Desktop/AI_MAC/tools/ffmpeg/ffmpeg")
HERE  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

KOKORO_VOICE = "zf_xiaoxiao"
EDGE_VOICE   = "zh-TW-HsiaoChenNeural"

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
    """符號轉口語(Kokoro/edge-tts 共用前處理)。"""
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


# ── Kokoro 引擎 ───────────────────────────────────────────────────────────────

def gen_kokoro(caps, outdir, force):
    """用 Kokoro zf_xiaoxiao 產 mp3。"""
    try:
        import soundfile as sf
        from kokoro_onnx import Kokoro
        from misaki import zh
    except ImportError as e:
        print(f"錯誤:Kokoro 依賴未安裝({e}),請用 kokoro-venv 執行", file=sys.stderr)
        sys.exit(1)

    k   = Kokoro(f"{KROOT}/kokoro-v1.0.onnx", f"{KROOT}/voices-v1.0.bin")
    g2p = zh.ZHG2P()
    manifest = {}
    made = skipped = 0

    for c in caps:
        key    = f"{c['id']}_{c['i']}"
        mp3    = os.path.join(outdir, f"{key}.mp3")
        spoken = say(c["cap"])
        manifest[key] = spoken
        if os.path.exists(mp3) and not force:
            skipped += 1
            continue
        ph, _ = g2p(spoken)
        samples, sr = k.create(ph, voice=KOKORO_VOICE, speed=1.0, is_phonemes=True)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
            sf.write(tf.name, samples, sr)
            subprocess.run([FF, "-y", "-i", tf.name, "-b:a", "80k", mp3],
                           check=True, capture_output=True)
            os.unlink(tf.name)
        made += 1
        print(f"  [kokoro] {key}: {spoken[:42]}")

    return manifest, made, skipped


# ── edge-tts 引擎 ─────────────────────────────────────────────────────────────

async def _edge_synth_one(text: str, out_mp3: str, retries: int = 3) -> bool:
    """edge-tts 合成單句;失敗明確報錯,不靜默。"""
    import edge_tts as _et
    for attempt in range(retries):
        try:
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tf:
                tmp = tf.name
            comm = _et.Communicate(text, EDGE_VOICE)
            await comm.save(tmp)
            result = subprocess.run(
                [FF, "-y", "-i", tmp, "-b:a", "128k", out_mp3],
                capture_output=True
            )
            os.unlink(tmp)
            if result.returncode == 0:
                return True
            else:
                print(f"  ffmpeg error(attempt {attempt+1}): "
                      f"{result.stderr[-200:].decode(errors='replace')}", file=sys.stderr)
        except Exception as e:
            print(f"  edge-tts attempt {attempt+1} failed: {e}", file=sys.stderr)
            if attempt < retries - 1:
                await asyncio.sleep(2)
    return False


async def _gen_edge_async(caps, outdir, force):
    try:
        import edge_tts  # noqa: F401  — 確認已安裝
    except ImportError:
        print("錯誤:edge-tts 未安裝。pip install edge-tts", file=sys.stderr)
        sys.exit(1)

    manifest = {}
    made = skipped = failed = 0

    for c in caps:
        key    = f"{c['id']}_{c['i']}"
        mp3    = os.path.join(outdir, f"{key}.mp3")
        text   = c["cap"]          # edge-tts 直接給原文,標點自然停頓
        manifest[key] = text
        if os.path.exists(mp3) and not force:
            skipped += 1
            print(f"  [edge-tts] skip {key} (exists)")
            continue
        print(f"  [edge-tts] voice={EDGE_VOICE} synth {key}: {text[:50]}")
        ok = await _edge_synth_one(text, mp3)
        if ok:
            made += 1
            print(f"    -> {mp3}")
        else:
            failed += 1
            print(f"  [edge-tts] FAILED: {key} — 無法產生 mp3,請檢查網路連線", file=sys.stderr)
            sys.exit(1)   # 失敗明確報錯,不靜默

    return manifest, made, skipped


def gen_edge(caps, outdir, force):
    """同步包裝,呼叫 async edge-tts 路徑。"""
    return asyncio.run(_gen_edge_async(caps, outdir, force))


# ── 主程式 ────────────────────────────────────────────────────────────────────

# 科目 → 自動引擎對應表:名稱含這些前綴 → edge-tts(台灣腔中文)
_EDGE_SUBJECTS = ("science",)


def _auto_engine(subject: str | None) -> str:
    if subject and any(subject.startswith(p) for p in _EDGE_SUBJECTS):
        return "edge"
    return "kokoro"


def main():
    force  = "--force"  in sys.argv

    # --subject <name>
    subject = None
    if "--subject" in sys.argv:
        idx = sys.argv.index("--subject")
        if idx + 1 < len(sys.argv):
            subject = sys.argv[idx + 1]

    # --engine <kokoro|edge>  (不傳則依科目自動選)
    engine = None
    if "--engine" in sys.argv:
        idx = sys.argv.index("--engine")
        if idx + 1 < len(sys.argv):
            engine = sys.argv[idx + 1]
            if engine not in ("kokoro", "edge"):
                print(f"錯誤:--engine 必須是 kokoro 或 edge,收到 {engine!r}", file=sys.stderr)
                sys.exit(1)
    if engine is None:
        engine = _auto_engine(subject)

    # 讀字幕
    if subject:
        cap_file = os.path.join(HERE, "tools", f"captions_{subject}.json")
        if not os.path.exists(cap_file):
            print(f"錯誤:找不到 {cap_file}", file=sys.stderr)
            sys.exit(1)
        print(f"[gen_narration] subject={subject}, engine={engine}, captions={cap_file}")
    else:
        cap_file = os.path.join(HERE, "tools", "captions.json")
        print(f"[gen_narration] (default math), engine={engine}, captions={cap_file}")

    caps   = json.load(open(cap_file, encoding="utf-8"))
    outdir = os.path.join(HERE, "audio")
    os.makedirs(outdir, exist_ok=True)

    # 呼叫對應引擎
    if engine == "kokoro":
        manifest, made, skipped = gen_kokoro(caps, outdir, force)
    else:
        manifest, made, skipped = gen_edge(caps, outdir, force)

    json.dump(manifest, open(os.path.join(outdir, "narration.json"), "w"),
              ensure_ascii=False, indent=1)
    print(f"done: {made} generated, {skipped} skipped, manifest={len(manifest)}")


if __name__ == "__main__":
    main()

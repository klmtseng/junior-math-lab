#!/usr/bin/env python3
"""數感實驗室旁白生成器 — canonical 唯一入口(2026-07-10 整併 gen_narration_edge.py)。

中文走 edge-tts zh-TW-HsiaoChenNeural 台灣腔(預設 +12%);英文走 Kokoro zf_xiaoxiao。
gen_narration_edge.py 已標棄用,請勿再新增呼叫。

用法:
  python3 tools/gen_narration.py [--subject <name>] [--engine <kokoro|edge>]
                                  [--rate <+12%>] [--force]

  --subject <name>  指定科目:讀 tools/captions_<name>.json,輸出 audio/<id>_<i>.mp3
                    預設(無 --subject):讀 tools/captions.json(數學 J1-J10)
  --engine  <eng>   強制引擎:kokoro | edge(預設依科目自動選)
  --rate    <rate>  edge-tts 語速,如 +12% / +0% / -5%(預設 +12%,僅 edge 引擎生效)
  --force           強制重新生成已存在的 mp3

引擎自動選擇(不傳 --engine 時):
  subject 名稱含 "science" 或 subject=None(數學) → edge zh-TW-HsiaoChenNeural
  明確傳 --engine kokoro → Kokoro(保留英文未來路徑)

符號正規化(say() 函式):數學符號統一轉口語,edge 路徑也套用;
  x→艾克斯、y→歪、=→等於、²→平方、×→乘以 …等(見 WORDS 表)。
字幕寫作規則:禁用括號(舊版會吞成黏音);座標/數對用「3、負2」式寫法。
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

KOKORO_VOICE    = "zf_xiaoxiao"   # 中文預設(zh)
KOKORO_VOICE_EN = "af_heart"      # 英文預設(en-us 美式女聲,使用者定案 2026-07-10)
EDGE_VOICE      = "zh-TW-HsiaoChenNeural"

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

def gen_kokoro(caps, outdir, force, lang="zh"):
    """用 Kokoro 產 mp3。
    lang="zh": misaki.zh G2P + zf_xiaoxiao(中文);say() 符號正規化。
    lang="en": Kokoro 內建 en-us 音素化 + af_heart(英文句子直接餵原文,不套 say())。
    """
    try:
        import soundfile as sf
        from kokoro_onnx import Kokoro
    except ImportError as e:
        print(f"錯誤:Kokoro 依賴未安裝({e}),請用 kokoro-venv 執行", file=sys.stderr)
        sys.exit(1)

    is_en = (lang == "en")
    if not is_en:
        try:
            from misaki import zh
        except ImportError as e:
            print(f"錯誤:misaki.zh 未安裝({e})", file=sys.stderr)
            sys.exit(1)
        g2p = zh.ZHG2P()

    k = Kokoro(f"{KROOT}/kokoro-v1.0.onnx", f"{KROOT}/voices-v1.0.bin")
    voice = KOKORO_VOICE_EN if is_en else KOKORO_VOICE
    manifest = {}
    made = skipped = 0

    for c in caps:
        key    = f"{c['id']}_{c['i']}"
        mp3    = os.path.join(outdir, f"{key}.mp3")
        # 英文句子直接發音(不套 say() 中文符號正規化);中文走 say()
        spoken = c["cap"] if is_en else say(c["cap"])
        manifest[key] = spoken
        if os.path.exists(mp3) and not force:
            skipped += 1
            continue
        if is_en:
            samples, sr = k.create(spoken, voice=voice, speed=1.0,
                                   lang="en-us", is_phonemes=False)
        else:
            ph, _ = g2p(spoken)
            samples, sr = k.create(ph, voice=voice, speed=1.0, is_phonemes=True)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
            sf.write(tf.name, samples, sr)
            subprocess.run([FF, "-y", "-i", tf.name, "-b:a", "80k", mp3],
                           check=True, capture_output=True)
            os.unlink(tf.name)
        made += 1
        print(f"  [kokoro:{lang}/{voice}] {key}: {spoken[:42]}")

    return manifest, made, skipped


# ── edge-tts 引擎 ─────────────────────────────────────────────────────────────

async def _edge_synth_one(text: str, out_mp3: str, rate: str = "+12%", retries: int = 3) -> bool:
    """edge-tts 合成單句;失敗明確報錯,不靜默。
    rate: edge-tts 語速字串(預設 +12%,使用者定案)。
    """
    import edge_tts as _et
    for attempt in range(retries):
        try:
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tf:
                tmp = tf.name
            comm = _et.Communicate(text, EDGE_VOICE, rate=rate)
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


async def _gen_edge_async(caps, outdir, force, rate: str = "+12%"):
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
        # say() 符號正規化(x→艾克斯、=→等於、²→平方 等),edge 路徑也套用
        text   = say(c["cap"])
        manifest[key] = text
        if os.path.exists(mp3) and not force:
            skipped += 1
            print(f"  [edge-tts] skip {key} (exists)")
            continue
        print(f"  [edge-tts] voice={EDGE_VOICE} rate={rate} synth {key}: {text[:50]}")
        ok = await _edge_synth_one(text, mp3, rate=rate)
        if ok:
            made += 1
            print(f"    -> {mp3}")
        else:
            failed += 1
            print(f"  [edge-tts] FAILED: {key} — 無法產生 mp3,請檢查網路連線", file=sys.stderr)
            sys.exit(1)   # 失敗明確報錯,不靜默

    return manifest, made, skipped


def gen_edge(caps, outdir, force, rate: str = "+12%"):
    """同步包裝,呼叫 async edge-tts 路徑。"""
    return asyncio.run(_gen_edge_async(caps, outdir, force, rate=rate))


# ── 主程式 ────────────────────────────────────────────────────────────────────

# 科目 → 自動引擎對應表:數學(None)和 science 系列都走 edge-tts 台灣腔
# 若未來有英文科目傳 --engine kokoro 即可
_EDGE_SUBJECTS = ("science",)

# edge-tts 中文預設語速(使用者定案 2026-07-10)
EDGE_DEFAULT_RATE = "+12%"


# 英文科目:走 Kokoro 英文引擎(af_heart, en-us)
_EN_SUBJECTS = ("english",)


def _auto_engine(subject: str | None) -> str:
    # 英文科目 → Kokoro(英文語系由 _auto_lang 決定 af_heart)
    if subject and any(subject.startswith(p) for p in _EN_SUBJECTS):
        return "kokoro"
    # 數學(None)也走 edge:曉臻台灣腔,含 say() 符號正規化
    if subject is None or any(subject.startswith(p) for p in _EDGE_SUBJECTS):
        return "edge"
    return "kokoro"


def _auto_lang(subject: str | None) -> str:
    """Kokoro 語系:english* → en(af_heart);其餘 → zh(zf_xiaoxiao)。"""
    if subject and any(subject.startswith(p) for p in _EN_SUBJECTS):
        return "en"
    return "zh"


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

    # --lang <zh|en>  (僅 kokoro 引擎生效;不傳則依科目自動選)
    lang = None
    if "--lang" in sys.argv:
        idx = sys.argv.index("--lang")
        if idx + 1 < len(sys.argv):
            lang = sys.argv[idx + 1]
            if lang not in ("zh", "en"):
                print(f"錯誤:--lang 必須是 zh 或 en,收到 {lang!r}", file=sys.stderr)
                sys.exit(1)
    if lang is None:
        lang = _auto_lang(subject)

    # --rate <+12%>  (僅 edge 引擎生效;預設 EDGE_DEFAULT_RATE)
    rate = EDGE_DEFAULT_RATE
    if "--rate" in sys.argv:
        idx = sys.argv.index("--rate")
        if idx + 1 < len(sys.argv):
            rate = sys.argv[idx + 1]

    # 讀字幕
    if subject:
        cap_file = os.path.join(HERE, "tools", f"captions_{subject}.json")
        if not os.path.exists(cap_file):
            print(f"錯誤:找不到 {cap_file}", file=sys.stderr)
            sys.exit(1)
        print(f"[gen_narration] subject={subject}, engine={engine}, rate={rate}, captions={cap_file}")
    else:
        cap_file = os.path.join(HERE, "tools", "captions.json")
        print(f"[gen_narration] (default math), engine={engine}, rate={rate}, captions={cap_file}")

    caps   = json.load(open(cap_file, encoding="utf-8"))
    outdir = os.path.join(HERE, "audio")
    os.makedirs(outdir, exist_ok=True)

    # 呼叫對應引擎
    if engine == "kokoro":
        manifest, made, skipped = gen_kokoro(caps, outdir, force, lang=lang)
    else:
        manifest, made, skipped = gen_edge(caps, outdir, force, rate=rate)

    json.dump(manifest, open(os.path.join(outdir, "narration.json"), "w"),
              ensure_ascii=False, indent=1)
    print(f"done: {made} generated, {skipped} skipped, manifest={len(manifest)}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""edge-tts 台灣腔旁白生成器(zh-TW-HsiaoChenNeural)。
用法:
  python3 tools/gen_narration_edge.py [--subject science7a|math7] [--ids S7A_01,S7A_02] [--force]

  --subject science7a  讀 tools/captions_science7a.json(預設)
  --subject math7      讀 tools/captions.json(數學旁白,套用 edge_norm 極簡正規化)

讀 captions JSON → 用 edge-tts 產 mp3 → 覆蓋 audio/<ID>_<i>.mp3
"""
import asyncio, json, os, sys, subprocess, tempfile, time

FF = os.path.expanduser("~/Desktop/AI_MAC/tools/ffmpeg/ffmpeg")
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE = "zh-TW-HsiaoChenNeural"

try:
    import edge_tts
except ImportError:
    print("請先安裝 edge-tts: pip install edge-tts", file=sys.stderr)
    sys.exit(1)


def edge_norm(text: str) -> str:
    """數學字幕極簡正規化:只轉 edge-tts 無法自然發音的符號。
    絕對不套用 Kokoro say() 的轉換(x→艾克斯等),edge-tts zh-TW 原生正確。
    """
    text = text.replace("=", " 等於 ")
    text = text.replace("×", " 乘以 ")
    return text

async def synth_one(text: str, out_mp3: str, retries: int = 3, rate: str = "") -> bool:
    """用 edge-tts 合成一段文字,成功回 True。
    rate: edge-tts 語速調整字串(如 "+12%");空字串=預設語速(使用者對 S7A_01 定案為 +12%)。
    """
    for attempt in range(retries):
        try:
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tf:
                tmp = tf.name
            comm = edge_tts.Communicate(text, VOICE, rate=rate) if rate else edge_tts.Communicate(text, VOICE)
            await comm.save(tmp)
            # 用 ffmpeg 轉碼保證 128k CBR
            result = subprocess.run(
                [FF, "-y", "-i", tmp, "-b:a", "128k", out_mp3],
                capture_output=True
            )
            os.unlink(tmp)
            if result.returncode == 0:
                return True
            else:
                print(f"  ffmpeg error: {result.stderr[-200:]}", file=sys.stderr)
        except Exception as e:
            print(f"  attempt {attempt+1} failed: {e}", file=sys.stderr)
            if attempt < retries - 1:
                await asyncio.sleep(2)
    return False

def volumedetect(mp3: str) -> str:
    """跑 ffmpeg volumedetect,回傳 mean_volume 字串。"""
    r = subprocess.run(
        [FF, "-i", mp3, "-af", "volumedetect", "-f", "null", "/dev/null"],
        capture_output=True, text=True
    )
    for line in (r.stdout + r.stderr).splitlines():
        if "mean_volume" in line:
            return line.strip()
    return "volumedetect failed"

async def main():
    force = "--force" in sys.argv
    subject = "science7a"
    if "--subject" in sys.argv:
        idx = sys.argv.index("--subject")
        if idx + 1 < len(sys.argv):
            subject = sys.argv[idx + 1]

    # 過濾 ids
    filter_ids = None
    if "--ids" in sys.argv:
        idx = sys.argv.index("--ids")
        if idx + 1 < len(sys.argv):
            filter_ids = set(sys.argv[idx + 1].split(","))

    # 語速(edge-tts rate,如 "+12%");不傳=預設語速
    rate = ""
    if "--rate" in sys.argv:
        idx = sys.argv.index("--rate")
        if idx + 1 < len(sys.argv):
            rate = sys.argv[idx + 1]

    # math7: 讀 captions.json(不帶科目後綴);其餘讀 captions_<subject>.json
    if subject == "math7":
        cap_file = os.path.join(HERE, "tools", "captions.json")
        use_math_norm = True
    else:
        cap_file = os.path.join(HERE, "tools", f"captions_{subject}.json")
        use_math_norm = False

    if not os.path.exists(cap_file):
        print(f"找不到 {cap_file}", file=sys.stderr)
        sys.exit(1)

    print(f"[gen_narration_edge] subject={subject}, voice={VOICE}, captions={cap_file}, force={force}")

    caps = json.load(open(cap_file, encoding="utf-8"))
    outdir = os.path.join(HERE, "audio")
    os.makedirs(outdir, exist_ok=True)

    made = skipped = failed = 0
    for c in caps:
        if filter_ids and c["id"] not in filter_ids:
            continue
        key = f"{c['id']}_{c['i']}"
        mp3 = os.path.join(outdir, f"{key}.mp3")
        if os.path.exists(mp3) and not force:
            skipped += 1
            print(f"  skip {key} (exists)")
            continue
        # 數學字幕套極簡正規化;自然科原文直送
        text = edge_norm(c["cap"]) if use_math_norm else c["cap"]
        print(f"  synth {key}: {text[:60]}{('  rate=' + rate) if rate else ''}")
        ok = await synth_one(text, mp3, rate=rate)
        if ok:
            vol = volumedetect(mp3)
            print(f"    -> {mp3}  {vol}")
            made += 1
        else:
            print(f"  FAILED: {key}", file=sys.stderr)
            failed += 1

    print(f"\ndone: made={made} skipped={skipped} failed={failed}")

if __name__ == "__main__":
    asyncio.run(main())

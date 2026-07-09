#!/usr/bin/env python3
"""edge-tts 台灣腔旁白生成器(zh-TW-HsiaoChenNeural)。
用法:
  python3 tools/gen_narration_edge.py [--subject science7a] [--ids S7A_01,S7A_02] [--force]

讀 captions_<subject>.json → 用 edge-tts 產 mp3 → 覆蓋 audio/<ID>_<i>.mp3
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

async def synth_one(text: str, out_mp3: str, retries: int = 3) -> bool:
    """用 edge-tts 合成一段文字,成功回 True。"""
    for attempt in range(retries):
        try:
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tf:
                tmp = tf.name
            comm = edge_tts.Communicate(text, VOICE)
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

    cap_file = os.path.join(HERE, "tools", f"captions_{subject}.json")
    if not os.path.exists(cap_file):
        print(f"找不到 {cap_file}", file=sys.stderr)
        sys.exit(1)

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
        print(f"  synth {key}: {c['cap'][:50]}")
        ok = await synth_one(c["cap"], mp3)
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

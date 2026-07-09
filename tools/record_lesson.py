#!/usr/bin/env python3
"""record_lesson.py — 把互動關卡 demo() 轉成 mp4 影片

用法:
    python3 tools/record_lesson.py --level J1 --mode frames
    python3 tools/record_lesson.py --level J1 --mode screen

modes:
  frames  逐幀截圖式(穩定,音視訊理論零漂移)
  screen  Playwright recordVideo 錄屏式(webm→mp4)

輸出:
  media/<LEVEL>_frames.mp4  (frames 模式)
  media/<LEVEL>_screen.mp4  (screen 模式)
  media/<LEVEL>_video_meta.txt

需求: Playwright + Chromium、ffmpeg/ffprobe 在 tools/ffmpeg/
"""

import argparse
import json
import math
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

# ── 路徑常數 ──────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent.resolve()
AUDIO_DIR = ROOT / "audio"
MEDIA_DIR = ROOT / "media"
FFMPEG = ROOT.parent.parent / "tools" / "ffmpeg" / "ffmpeg"
FFPROBE = ROOT.parent.parent / "tools" / "ffmpeg" / "ffprobe"
HTTP_PORT = 8971  # 與其他 test 腳本避開
W, H = 1280, 720   # 輸出解析度
FPS = 30

# demo() 步驟數量與 JS 裡 dur(ms) 的對應(作備用fallback;優先用 mp3 實際時長)
# 格式: { level_id: [(cap, dur_ms), ...] }
DEMO_META = {
    "J1": [
        ("從 3 出發。題目:三 加 負五", 2000),
        ("加負數=轉身往左,走 5 步,停在 負2", 2600),
        ("換一題:負四 減 負六", 2200),
        ("減負數=轉兩次身,其實是往右走 6 步,停在 2", 2600),
        ("換你走走看!", 1400),
    ]
}


def run(cmd, **kw):
    """執行外部指令,回傳 CompletedProcess;失敗就 sys.exit。"""
    result = subprocess.run(cmd, **kw)
    if result.returncode != 0:
        print(f"[ERROR] 指令失敗: {' '.join(str(c) for c in cmd)}")
        sys.exit(1)
    return result


def get_mp3_duration(path: Path) -> float:
    """用 ffprobe 取 mp3 秒數。"""
    r = subprocess.run(
        [FFPROBE, "-v", "quiet", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(path)],
        capture_output=True, text=True
    )
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def collect_durations(level_id: str) -> list[float]:
    """收集各步驟的有效時長(秒):優先 mp3 實際時長,否則用 JS dur 換算。"""
    meta = DEMO_META.get(level_id, [])
    durations = []
    for idx, (_, js_dur_ms) in enumerate(meta):
        mp3 = AUDIO_DIR / f"{level_id}_{idx}.mp3"
        if mp3.exists():
            d = get_mp3_duration(mp3)
            durations.append(d if d > 0.1 else js_dur_ms / 1000.0)
        else:
            durations.append(js_dur_ms / 1000.0)
    if not durations:
        print(f"[WARN] 找不到 {level_id} 的 demo 元數據,請在 DEMO_META 補上")
    return durations


def start_http_server(root: Path, port: int):
    """啟動 python3 -m http.server,回傳 Popen。"""
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port)],
        cwd=str(root), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    time.sleep(1.2)
    return proc


# ── frames 模式 ────────────────────────────────────────────────────────────

def run_frames_mode(level_id: str):
    """逐幀截圖式:每步截一張 PNG → ffmpeg concat → 合音軌。"""
    from playwright.sync_api import sync_playwright

    step_count = len(DEMO_META.get(level_id, []))
    if step_count == 0:
        print("[ERROR] 找不到 demo 步驟定義,請在 DEMO_META 補上")
        sys.exit(1)

    durations = collect_durations(level_id)
    total_audio = sum(durations)
    print(f"[frames] {level_id}: {step_count} 步, 音軌總長 {total_audio:.3f}s")

    MEDIA_DIR.mkdir(exist_ok=True)
    srv = start_http_server(ROOT, HTTP_PORT)

    try:
        with tempfile.TemporaryDirectory(prefix="jml_frames_") as tmp:
            tmp = Path(tmp)
            screenshots = []

            with sync_playwright() as pw:
                browser = pw.chromium.launch(headless=True)
                ctx = browser.new_context(viewport={"width": W, "height": H})
                page = ctx.new_page()

                url = f"http://localhost:{HTTP_PORT}/"
                page.goto(url, wait_until="networkidle", timeout=15000)

                # 確認頁面載入:等 canvas 出現
                page.wait_for_selector("#board", timeout=10000)
                time.sleep(0.5)

                # 確保是 J1 (預設 b1 第 0 個就是 J1)
                # 若 level_id 不是 J1,需要點到對應 tab
                if level_id != "J1":
                    # 找對應 tab 按鈕
                    tabs = page.query_selector_all("#tabs button")
                    for tab in tabs:
                        txt = tab.text_content() or ""
                        if level_id in txt:
                            tab.click()
                            time.sleep(0.3)
                            break

                # 停掉可能已自動開始的 demo,清 localStorage 的 demoSeen 讓我們控制
                page.evaluate("""() => {
                    if (typeof player !== 'undefined') player.cancel();
                    // 關閉語音(純截圖不需要播音)
                    if (typeof voiceOn !== 'undefined') voiceOn = false;
                }""")
                time.sleep(0.2)

                # 逐步推進 demo 並截圖
                for idx in range(step_count):
                    # 注入:讓 player 跳到第 idx 步的終態
                    page.evaluate(f"""() => {{
                        const lv = cur();
                        if (!lv || !lv.demo) return;
                        // 重置狀態
                        if (idx_val === 0 && lv.enter) lv.enter();
                        // 執行 call,推進到第 idx 步
                        const steps = lv.demo();
                        // 逐步 apply 到 idx(完整走一遍到 idx,模擬 player 跑完)
                        for (let i = 0; i <= {idx}; i++) {{
                            const st = steps[i];
                            if (st.call) st.call();
                            // 插值動畫設為終態 t=1
                            for (const key of ['num', 'num2']) {{
                                if (!st[key]) continue;
                                const [get, set, to] = st[key];
                                set(to);
                            }}
                            for (const key of ['vec', 'vec2']) {{
                                if (!st[key]) continue;
                                const [get, set, to] = st[key];
                                set(to);
                            }}
                        }}
                        // 強制重繪
                        if (lv._sync) lv._sync();
                        // caption
                        const capEl = document.getElementById('caption');
                        if (capEl && steps[{idx}].cap != null) {{
                            capEl.textContent = steps[{idx}].cap;
                            capEl.classList.add('show');
                        }}
                    }}""".replace("idx_val", str(idx)))

                    # 等一幀渲染完
                    time.sleep(0.25)

                    png_path = tmp / f"step_{idx:03d}.png"
                    page.screenshot(path=str(png_path), clip={"x": 0, "y": 0, "width": W, "height": H})
                    screenshots.append(png_path)
                    print(f"  截圖 step {idx}: {durations[idx]:.3f}s → {png_path.name}")

                browser.close()

            # 用 ffmpeg concat demuxer 合成無聲影片
            # 每張 PNG 重複 dur*fps 幀
            concat_list = tmp / "concat.txt"
            with open(concat_list, "w") as f:
                for idx, (png_path, dur) in enumerate(zip(screenshots, durations)):
                    f.write(f"file '{png_path}'\n")
                    f.write(f"duration {dur:.6f}\n")
                # ffmpeg concat demuxer 需要最後一張重複一次(無 duration 結束)
                f.write(f"file '{screenshots[-1]}'\n")

            silent_mp4 = tmp / "silent.mp4"
            run([
                FFMPEG, "-y", "-f", "concat", "-safe", "0",
                "-i", str(concat_list),
                "-vf", f"scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(FPS),
                str(silent_mp4)
            ])
            print(f"  無聲影片: {silent_mp4}")

            # 串接 mp3 音軌
            audio_mp4 = tmp / "audio_track.mp3"
            mp3_files = [AUDIO_DIR / f"{level_id}_{i}.mp3" for i in range(step_count)]
            # 確認所有 mp3 存在
            for mp3 in mp3_files:
                if not mp3.exists():
                    print(f"[ERROR] 找不到音訊: {mp3}")
                    sys.exit(1)

            if len(mp3_files) == 1:
                import shutil
                shutil.copy(str(mp3_files[0]), str(audio_mp4))
            else:
                # 用 ffmpeg concat filter 串接 mp3
                inputs = []
                for mp3 in mp3_files:
                    inputs += ["-i", str(mp3)]
                run([
                    FFMPEG, "-y", *inputs,
                    "-filter_complex", f"concat=n={len(mp3_files)}:v=0:a=1[outa]",
                    "-map", "[outa]", str(audio_mp4)
                ])
            print(f"  音軌串接: {audio_mp4}")

            # 合流
            out_mp4 = MEDIA_DIR / f"{level_id}_frames.mp4"
            run([
                FFMPEG, "-y",
                "-i", str(silent_mp4),
                "-i", str(audio_mp4),
                "-c:v", "copy", "-c:a", "aac", "-shortest",
                str(out_mp4)
            ])
            print(f"[frames] 輸出: {out_mp4}")

    finally:
        srv.terminate()

    # 量測對齊
    verify_alignment(out_mp4, total_audio, threshold=0.1, label="frames")
    return out_mp4


# ── screen 模式 ────────────────────────────────────────────────────────────

def run_screen_mode(level_id: str):
    """Playwright recordVideo 錄屏式。"""
    from playwright.sync_api import sync_playwright

    durations = collect_durations(level_id)
    total_audio = sum(durations)
    step_count = len(durations)
    total_demo_time = total_audio + 1.5  # 多等一點確保最後步驟走完

    print(f"[screen] {level_id}: {step_count} 步, 預計錄製 {total_demo_time:.1f}s")

    MEDIA_DIR.mkdir(exist_ok=True)
    srv = start_http_server(ROOT, HTTP_PORT)

    try:
        with tempfile.TemporaryDirectory(prefix="jml_screen_") as tmp:
            tmp = Path(tmp)
            video_dir = tmp / "videos"
            video_dir.mkdir()

            with sync_playwright() as pw:
                browser = pw.chromium.launch(headless=True)
                ctx = browser.new_context(
                    viewport={"width": W, "height": H},
                    record_video_dir=str(video_dir),
                    record_video_size={"width": W, "height": H},
                )
                page = ctx.new_page()

                url = f"http://localhost:{HTTP_PORT}/"
                page.goto(url, wait_until="networkidle", timeout=15000)
                page.wait_for_selector("#board", timeout=10000)
                time.sleep(0.3)

                # 確保在正確關卡
                if level_id != "J1":
                    tabs = page.query_selector_all("#tabs button")
                    for tab in tabs:
                        txt = tab.text_content() or ""
                        if level_id in txt:
                            tab.click()
                            time.sleep(0.3)
                            break

                # 停掉自動示範,關語音(錄屏模式靠 Python 後期混音)
                page.evaluate("""() => {
                    if (typeof player !== 'undefined') player.cancel();
                    if (typeof voiceOn !== 'undefined') voiceOn = false;
                }""")
                time.sleep(0.2)

                # 手動逐步推進 demo,讓頁面動畫播放
                demo_steps = DEMO_META.get(level_id, [])
                for idx, (cap, js_dur_ms) in enumerate(demo_steps):
                    dur_sec = durations[idx]
                    page.evaluate(f"""() => {{
                        const lv = cur();
                        if (!lv || !lv.demo) return;
                        const steps = lv.demo();
                        const st = steps[{idx}];
                        if (st.call) st.call();
                        // 設終態
                        for (const key of ['num', 'num2']) {{
                            if (!st[key]) continue;
                            const [get, set, to] = st[key];
                            set(to);
                        }}
                        for (const key of ['vec', 'vec2']) {{
                            if (!st[key]) continue;
                            const [get, set, to] = st[key];
                            set(to);
                        }}
                        if (lv._sync) lv._sync();
                        const capEl = document.getElementById('caption');
                        if (capEl && st.cap != null) {{
                            capEl.textContent = st.cap;
                            capEl.classList.add('show');
                        }}
                    }}""")
                    # 等這一步的旁白時長(+ 小 buffer)
                    time.sleep(dur_sec + 0.1)

                # 最後 hold 0.5s 確保最後畫面錄到
                time.sleep(0.5)

                # 取得錄下的 webm 路徑
                video_path = page.video.path()
                page.close()
                ctx.close()
                browser.close()

            # 找 webm 檔
            webm = Path(video_path)
            if not webm.exists():
                # 有時 Playwright 把 webm 命名在 video_dir 下
                candidates = list(video_dir.glob("*.webm"))
                if not candidates:
                    print(f"[ERROR] 找不到錄屏 webm: {video_dir}")
                    sys.exit(1)
                webm = max(candidates, key=lambda p: p.stat().st_size)
            print(f"  錄屏 webm: {webm} ({webm.stat().st_size//1024}KB)")

            # 串接 mp3 音軌
            mp3_files = [AUDIO_DIR / f"{level_id}_{i}.mp3" for i in range(step_count)]
            for mp3 in mp3_files:
                if not mp3.exists():
                    print(f"[ERROR] 找不到音訊: {mp3}")
                    sys.exit(1)

            audio_track = tmp / "audio_track.mp3"
            if len(mp3_files) == 1:
                import shutil
                shutil.copy(str(mp3_files[0]), str(audio_track))
            else:
                inputs = []
                for mp3 in mp3_files:
                    inputs += ["-i", str(mp3)]
                run([
                    FFMPEG, "-y", *inputs,
                    "-filter_complex", f"concat=n={len(mp3_files)}:v=0:a=1[outa]",
                    "-map", "[outa]", str(audio_track)
                ])

            # 合流 webm + 音軌 → mp4
            out_mp4 = MEDIA_DIR / f"{level_id}_screen.mp4"
            run([
                FFMPEG, "-y",
                "-i", str(webm),
                "-i", str(audio_track),
                "-c:v", "libx264", "-c:a", "aac",
                "-vf", f"scale={W}:{H}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2",
                "-shortest",
                str(out_mp4)
            ])
            print(f"[screen] 輸出: {out_mp4}")

    finally:
        srv.terminate()

    verify_alignment(out_mp4, total_audio, threshold=0.3, label="screen")
    return out_mp4


# ── 共用驗證 ───────────────────────────────────────────────────────────────

def probe_mp4(path: Path) -> dict:
    """用 ffprobe 取 mp4 的 duration/解析度/codec。"""
    r = subprocess.run(
        [FFPROBE, "-v", "quiet", "-print_format", "json",
         "-show_streams", "-show_format", str(path)],
        capture_output=True, text=True
    )
    try:
        data = json.loads(r.stdout)
    except json.JSONDecodeError:
        return {}
    info = {}
    for stream in data.get("streams", []):
        codec_type = stream.get("codec_type", "")
        if codec_type == "video":
            info["v_codec"] = stream.get("codec_name")
            info["v_width"] = stream.get("width")
            info["v_height"] = stream.get("height")
            info["v_duration"] = float(stream.get("duration", 0) or stream.get("tags", {}).get("DURATION", 0) or 0)
        elif codec_type == "audio":
            info["a_codec"] = stream.get("codec_name")
            info["a_duration"] = float(stream.get("duration", 0) or 0)
    info["fmt_duration"] = float(data.get("format", {}).get("duration", 0) or 0)
    return info


def verify_alignment(mp4_path: Path, expected_audio: float, threshold: float, label: str):
    """量測 mp4 視訊/音訊時長差距並報告。"""
    info = probe_mp4(mp4_path)
    v_dur = info.get("v_duration") or info.get("fmt_duration", 0)
    a_dur = info.get("a_duration") or info.get("fmt_duration", 0)
    fmt_dur = info.get("fmt_duration", 0)

    print(f"\n[verify:{label}] {mp4_path.name}")
    print(f"  格式時長:   {fmt_dur:.3f}s")
    print(f"  視訊串流:   {v_dur:.3f}s  codec={info.get('v_codec')}  {info.get('v_width')}x{info.get('v_height')}")
    print(f"  音訊串流:   {a_dur:.3f}s  codec={info.get('a_codec')}")
    print(f"  預期音軌:   {expected_audio:.3f}s")

    # 音視訊偏移 = |視訊時長 - 音訊時長|
    diff = abs(v_dur - a_dur) if (v_dur > 0 and a_dur > 0) else abs(fmt_dur - expected_audio)
    ok = diff < threshold
    print(f"  音視訊偏移: {diff:.4f}s  (門檻 <{threshold}s) → {'PASS ✓' if ok else 'FAIL ✗'}")
    if not ok:
        print(f"  [WARN] 偏移超過門檻!請檢查 concat 時長計算。")
    return ok


# ── YouTube 元數據 ─────────────────────────────────────────────────────────

YOUTUBE_META = {
    "J1": {
        "frames_title": "國中數學 關1 負數:在數線上走路【逐步圖解版】",
        "frames_desc": (
            "用動畫步驟拆解「負數加減」:加負數=轉身往左走,減負數=轉兩次身往右走。\n"
            "適合國一新生、小六預備生。\n\n"
            "▶ 互動練習版:https://junior-math-lab.vercel.app\n"
            "#國中數學 #負數 #數線 #國一數學 #數感實驗室"
        ),
        "screen_title": "國中數學 關1 負數:在數線上走路【互動示範錄屏版】",
        "screen_desc": (
            "完整錄製互動頁面的示範動畫:看著圓點在數線上一步一步走,理解負數加減的直覺。\n"
            "適合國一新生、小六預備生。\n\n"
            "▶ 親自操作:https://junior-math-lab.vercel.app\n"
            "#國中數學 #負數 #數線 #國一數學"
        ),
    }
}


def write_video_meta(level_id: str):
    meta = YOUTUBE_META.get(level_id)
    if not meta:
        print(f"[WARN] 找不到 {level_id} 的 YouTube 元數據")
        return
    out = MEDIA_DIR / f"{level_id}_video_meta.txt"
    with open(out, "w", encoding="utf-8") as f:
        f.write(f"=== {level_id} frames 版 ===\n")
        f.write(f"標題: {meta['frames_title']}\n\n")
        f.write(f"描述:\n{meta['frames_desc']}\n\n")
        f.write(f"=== {level_id} screen 版 ===\n")
        f.write(f"標題: {meta['screen_title']}\n\n")
        f.write(f"描述:\n{meta['screen_desc']}\n")
    print(f"[meta] 已寫: {out}")


# ── 主程式 ─────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="關卡 demo → mp4 產線")
    parser.add_argument("--level", default="J1", help="關卡 ID,如 J1")
    parser.add_argument("--mode", choices=["frames", "screen", "both"], default="frames",
                        help="frames=逐幀截圖 / screen=錄屏 / both=兩者")
    args = parser.parse_args()

    level_id = args.level
    mode = args.mode

    # 驗證 ffmpeg 存在
    if not FFMPEG.exists():
        print(f"[ERROR] ffmpeg 找不到: {FFMPEG}")
        sys.exit(1)
    if not FFPROBE.exists():
        print(f"[ERROR] ffprobe 找不到: {FFPROBE}")
        sys.exit(1)

    print(f"=== record_lesson.py  level={level_id}  mode={mode} ===")

    if mode in ("frames", "both"):
        run_frames_mode(level_id)

    if mode in ("screen", "both"):
        run_screen_mode(level_id)

    write_video_meta(level_id)

    print("\n=== 完成 ===")


if __name__ == "__main__":
    main()

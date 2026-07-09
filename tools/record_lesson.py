#!/usr/bin/env python3
"""
record_lesson.py — 網頁互動關卡 → YouTube 影片膠水層

用法:
  python tools/record_lesson.py --level J1 --mode explain --out /path/to/dir
  python tools/record_lesson.py --level J1 --mode screen  --out /path/to/dir
  python tools/record_lesson.py --level J1 --mode both    --out /path/to/dir

依賴:
  - Playwright (playwright install chromium)
  - ffmpeg / ffprobe 路徑見 FFMPEG_DIR

兩種模式:
  explain: 逐幀截圖 + mp3 驅動時間軸 → {level}_explain.mp4 (零漂移)
  screen:  Playwright 錄屏 → .webm → 接旁白軌 → {level}_screen.mp4
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

# ── 路徑設定 ──────────────────────────────────────────────────────────────────
REPO_ROOT  = Path(__file__).parent.parent.resolve()
FFMPEG_DIR = Path.home() / "Desktop/AI_MAC/tools/ffmpeg/ffmpeg-7.0.2-amd64-static"
FFMPEG     = str(FFMPEG_DIR / "ffmpeg")
FFPROBE    = str(FFMPEG_DIR / "ffprobe")

PORT   = 8802
WIDTH  = 1280
HEIGHT = 720
FPS    = 30

# ── 關卡 demo 步驟元資料 ──────────────────────────────────────────────────────
# True = 有插值動畫(取 4 張截圖均分時長); False = 靜態(取 1 張)
# J1: step0=call(靜), step1=num動畫, step2=call(靜), step3=num動畫, step4=call(靜)
DEMO_META = {
    "J1": [False, True, False, True, False],
}

# ── JS helper:找 level 物件 ──────────────────────────────────────────────────
FIND_LEVEL_JS = """
(function(levelId) {
    const all = Array.from(JH_LEVELS);
    if (typeof J7  !== 'undefined') all.push(J7);
    if (typeof J8  !== 'undefined') all.push(J8);
    if (typeof J9  !== 'undefined') all.push(J9);
    if (typeof J10 !== 'undefined') all.push(J10);
    return all.find(l => l.id === levelId) || null;
})
"""

# ── 輔助函式 ──────────────────────────────────────────────────────────────────

def ffprobe_duration(mp3_path: Path) -> float:
    r = subprocess.run(
        [FFPROBE, "-v", "quiet",
         "-show_entries", "format=duration",
         "-of", "csv=p=0", str(mp3_path)],
        capture_output=True, text=True, check=True
    )
    return float(r.stdout.strip())


def get_mp3_list(level: str, audio_dir: Path) -> list[Path]:
    files, i = [], 0
    while (p := audio_dir / f"{level}_{i}.mp3").exists():
        files.append(p); i += 1
    if not files:
        raise FileNotFoundError(f"找不到 {audio_dir}/{level}_0.mp3")
    return files


def concat_mp3_to_aac(mp3_paths: list[Path], out_path: Path):
    inputs = []
    for p in mp3_paths:
        inputs += ["-i", str(p)]
    n = len(mp3_paths)
    filt = "".join(f"[{i}:a]" for i in range(n)) + f"concat=n={n}:v=0:a=1[outa]"
    subprocess.run(
        [FFMPEG, "-y"] + inputs +
        ["-filter_complex", filt,
         "-map", "[outa]",
         "-c:a", "aac", "-b:a", "128k",
         str(out_path)],
        check=True, capture_output=True
    )


def probe_streams(path: Path) -> dict:
    r = subprocess.run(
        [FFPROBE, "-v", "quiet",
         "-show_entries", "stream=codec_type",
         "-show_entries", "format=duration",
         "-of", "json", str(path)],
        capture_output=True, text=True, check=True
    )
    data = json.loads(r.stdout)
    types = {s["codec_type"] for s in data.get("streams", [])}
    return {
        "has_video": "video" in types,
        "has_audio": "audio" in types,
        "duration":  float(data.get("format", {}).get("duration", 0)),
    }


def start_server(root: Path, port: int):
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port),
         "--directory", str(root)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    time.sleep(1.5)
    return proc


def navigate_to_level(page, level: str):
    ok = page.evaluate(FIND_LEVEL_JS + f"('{level}')" + """
        !== null
        ? (function(levelId) {
            const all = Array.from(JH_LEVELS);
            if (typeof J7  !== 'undefined') all.push(J7);
            if (typeof J8  !== 'undefined') all.push(J8);
            if (typeof J9  !== 'undefined') all.push(J9);
            if (typeof J10 !== 'undefined') all.push(J10);
            const lv = all.find(l => l.id === levelId);
            if (lv && typeof loadLevel === 'function') { loadLevel(lv); return true; }
            return false;
          })
        : false
    """)
    # 更簡單的版本:直接執行
    ok = page.evaluate(f"""
    (function() {{
        const all = Array.from(JH_LEVELS);
        if (typeof J7  !== 'undefined') all.push(J7);
        if (typeof J8  !== 'undefined') all.push(J8);
        if (typeof J9  !== 'undefined') all.push(J9);
        if (typeof J10 !== 'undefined') all.push(J10);
        const lv = all.find(l => l.id === '{level}');
        if (!lv) return false;
        if (typeof loadLevel === 'function') loadLevel(lv);
        return true;
    }})()
    """)
    if not ok:
        raise ValueError(f"找不到 level: {level}")
    page.wait_for_timeout(400)


def get_demo_steps_info(page, level: str) -> list[dict]:
    return page.evaluate(f"""
    (function() {{
        const all = Array.from(JH_LEVELS);
        if (typeof J7  !== 'undefined') all.push(J7);
        if (typeof J8  !== 'undefined') all.push(J8);
        if (typeof J9  !== 'undefined') all.push(J9);
        if (typeof J10 !== 'undefined') all.push(J10);
        const lv = all.find(l => l.id === '{level}');
        if (!lv || !lv.demo) return [];
        return lv.demo().map(function(s) {{
            return {{
                hasCap:  s.cap != null,
                cap:     s.cap || '',
                hasNum:  !!(s.num || s.num2),
                hasVec:  !!(s.vec || s.vec2),
                dur:     s.dur || 1400
            }};
        }});
    }})()
    """)


def set_step_state(page, level: str, step_i: int, t_frac: float = 1.0):
    """
    在瀏覽器裡把 demo 的第 step_i 步設到時間分位 t_frac (0=起點,1=終點)。
    靜態步 t_frac 無意義,固定終態。
    """
    page.evaluate(f"""
    (function() {{
        const all = Array.from(JH_LEVELS);
        if (typeof J7  !== 'undefined') all.push(J7);
        if (typeof J8  !== 'undefined') all.push(J8);
        if (typeof J9  !== 'undefined') all.push(J9);
        if (typeof J10 !== 'undefined') all.push(J10);
        const lv = all.find(l => l.id === '{level}');
        if (!lv || !lv.demo) return;
        const steps = lv.demo();
        const st = steps[{step_i}];
        if (!st) return;

        function ease(t) {{ return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }}
        function lerp(p, q, t) {{ return p + (q - p) * t; }}

        // 執行 call (設置此步的初始狀態)
        if (st.call) st.call();

        const t_ease = ease({t_frac});

        // num 插值
        for (const key of ['num', 'num2']) {{
            if (!st[key]) continue;
            const [get, set, to] = st[key];
            const from = get();
            set(lerp(from, to, t_ease));
        }}

        // vec 插值
        for (const key of ['vec', 'vec2']) {{
            if (!st[key]) continue;
            const [get, set, to] = st[key];
            const from = {{...get()}};
            set({{ x: lerp(from.x, to.x, t_ease), y: lerp(from.y, to.y, t_ease) }});
        }}

        // caption
        if (st.cap != null) {{
            const el = document.getElementById('caption');
            if (el) {{ el.textContent = st.cap; el.classList.add('show'); }}
        }}

        // 同步渲染
        if (typeof lv._sync === 'function') lv._sync();
    }})()
    """)
    page.wait_for_timeout(100)


# ── 講解式模式 ────────────────────────────────────────────────────────────────

def mode_explain(level: str, out_dir: Path, base_url: str):
    audio_dir = REPO_ROOT / "audio"
    mp3_files = get_mp3_list(level, audio_dir)
    durations = [ffprobe_duration(p) for p in mp3_files]
    total_mp3 = sum(durations)
    n_steps   = len(durations)

    print(f"[explain] mp3 秒數: {[f'{d:.3f}' for d in durations]}")
    print(f"[explain] Σmp3 = {total_mp3:.3f}s, {n_steps} 步")

    step_meta = list(DEMO_META.get(level, [False] * n_steps))
    while len(step_meta) < n_steps:
        step_meta.append(False)

    tmp_dir = out_dir / "tmp_frames"
    tmp_dir.mkdir(exist_ok=True)

    frames: list[tuple[Path, float]] = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx     = browser.new_context(viewport={"width": WIDTH, "height": HEIGHT})
        page    = ctx.new_page()

        page.goto(base_url, wait_until="networkidle")
        page.wait_for_timeout(800)
        navigate_to_level(page, level)

        for step_i in range(n_steps):
            is_animated = step_meta[step_i]
            dur         = durations[step_i]
            n_shots     = 4 if is_animated else 1

            if not is_animated:
                set_step_state(page, level, step_i, t_frac=1.0)
                png = tmp_dir / f"step_{step_i:02d}_00.png"
                page.screenshot(path=str(png))
                frames.append((png, dur))
                print(f"  step {step_i}: static, {dur:.3f}s → {png.name}")
            else:
                sub_dur = dur / n_shots
                for frac_i in range(n_shots):
                    t_frac = (frac_i + 0.5) / n_shots
                    set_step_state(page, level, step_i, t_frac=t_frac)
                    png = tmp_dir / f"step_{step_i:02d}_{frac_i:02d}.png"
                    page.screenshot(path=str(png))
                    frames.append((png, sub_dur))
                print(f"  step {step_i}: animated, {n_shots} shots × {sub_dur:.3f}s")

        browser.close()

    # 建 ffmpeg concat demuxer list
    concat_list = out_dir / "concat_explain.txt"
    with open(concat_list, "w") as f:
        for png, d in frames:
            f.write(f"file '{png.resolve()}'\n")
            f.write(f"duration {d:.6f}\n")
        # 末幀重複一次(ffmpeg concat demuxer 的最後一幀不自帶 duration)
        if frames:
            f.write(f"file '{frames[-1][0].resolve()}'\n")

    # 合成無聲影片
    silent_mp4 = out_dir / f"{level}_silent.mp4"
    subprocess.run(
        [FFMPEG, "-y",
         "-f", "concat", "-safe", "0", "-i", str(concat_list),
         "-vf", f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=decrease,"
                f"pad={WIDTH}:{HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black",
         "-r", str(FPS),
         "-c:v", "libx264", "-pix_fmt", "yuv420p",
         "-preset", "medium", "-crf", "20",
         str(silent_mp4)],
        check=True, capture_output=True
    )

    # 串接 mp3 → aac
    concat_audio = out_dir / f"{level}_narration.aac"
    concat_mp3_to_aac(mp3_files, concat_audio)

    # 合成最終 mp4
    out_mp4 = out_dir / f"{level}_explain.mp4"
    subprocess.run(
        [FFMPEG, "-y",
         "-i", str(silent_mp4),
         "-i", str(concat_audio),
         "-c:v", "copy", "-c:a", "copy",
         "-shortest",
         str(out_mp4)],
        check=True, capture_output=True
    )

    vid_dur = probe_streams(out_mp4)["duration"]
    diff    = abs(vid_dur - total_mp3)
    print(f"[explain] 完成: {out_mp4}")
    print(f"[explain] Σmp3={total_mp3:.3f}s, 影片={vid_dur:.3f}s, 誤差={diff:.3f}s")
    return out_mp4, total_mp3, vid_dur


# ── 錄屏式模式 ────────────────────────────────────────────────────────────────

def mode_screen(level: str, out_dir: Path, base_url: str):
    audio_dir = REPO_ROOT / "audio"
    mp3_files = get_mp3_list(level, audio_dir)
    durations = [ffprobe_duration(p) for p in mp3_files]
    total_mp3 = sum(durations)

    print(f"[screen] mp3 Σ={total_mp3:.3f}s, {len(durations)} 段")

    tmp_dir = out_dir / "tmp_screen"
    tmp_dir.mkdir(exist_ok=True)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(
            viewport={"width": WIDTH, "height": HEIGHT},
            record_video_dir=str(tmp_dir),
            record_video_size={"width": WIDTH, "height": HEIGHT},
        )
        page = ctx.new_page()

        page.goto(base_url, wait_until="networkidle")
        page.wait_for_timeout(800)
        navigate_to_level(page, level)

        # 記錄錄影起點 + 每步時間戳
        page.evaluate("""
        (function() {
            window.__rec_start = performance.now();
            window.__timestamps = [];
        })()
        """)

        # 取得 demo steps 總時長
        steps_info = get_demo_steps_info(page, level)
        total_js_ms = sum(s["dur"] for s in steps_info)
        print(f"[screen] demo JS 總時長={total_js_ms}ms, {len(steps_info)} 步")

        # 注入 monkey-patch:記錄每步 next() 呼叫時刻,然後啟動 player
        page.evaluate(f"""
        (function() {{
            const all = Array.from(JH_LEVELS);
            if (typeof J7  !== 'undefined') all.push(J7);
            if (typeof J8  !== 'undefined') all.push(J8);
            if (typeof J9  !== 'undefined') all.push(J9);
            if (typeof J10 !== 'undefined') all.push(J10);
            const lv = all.find(l => l.id === '{level}');
            if (!lv || !lv.demo) return;

            const orig_next = player.next.bind(player);
            player.next = function() {{
                window.__timestamps.push({{
                    idx:  this.idx + 1,   // 即將進入的 idx
                    t_ms: performance.now() - window.__rec_start
                }});
                orig_next.call(this);
            }};

            player.start(lv.demo());
        }})()
        """)

        # 輪詢等待 demo 完成(上限 = JS 時長 + 10s buffer)
        deadline = time.time() + (total_js_ms / 1000) + 10
        while time.time() < deadline:
            active = page.evaluate("(function() { return player.active; })()")
            if not active:
                break
            page.wait_for_timeout(200)

        print("[screen] demo 結束")

        # 取時間戳
        timestamps = page.evaluate("(function() { return window.__timestamps || []; })()")
        print(f"[screen] 時間戳(ms): {[(t['idx'], round(t['t_ms'])) for t in timestamps]}")

        page.close()
        ctx.close()
        browser.close()

    # 找 .webm
    webm_files = list(tmp_dir.glob("*.webm"))
    if not webm_files:
        raise RuntimeError("找不到錄屏 .webm 檔")
    webm_path = webm_files[0]
    webm_dur  = probe_streams(webm_path)["duration"]
    print(f"[screen] webm={webm_path.name}, 時長={webm_dur:.3f}s")

    # 串接 mp3 → aac
    concat_audio = out_dir / f"{level}_narration_screen.aac"
    concat_mp3_to_aac(mp3_files, concat_audio)

    # 合成最終 mp4(旁白從 t=0 開始)
    out_mp4 = out_dir / f"{level}_screen.mp4"
    subprocess.run(
        [FFMPEG, "-y",
         "-i", str(webm_path),
         "-i", str(concat_audio),
         "-c:v", "libx264", "-pix_fmt", "yuv420p",
         "-preset", "medium", "-crf", "20",
         "-c:a", "aac", "-b:a", "128k",
         "-shortest",
         str(out_mp4)],
        check=True, capture_output=True
    )

    # 量測偏移:
    # - 旁白 step 0 從 t=0 開始
    # - timestamps[0] 是 idx=0 被呼叫時 (player.start → next → idx=0 → 這裡記錄 idx=1 即將發生)
    #   實際上第 0 步在 t=0 就開始了,timestamps[0] 是 idx=0 開始時的 t_ms
    # 所以偏移 = timestamps[0].t_ms / 1000 (demo 啟動到錄影起點的延遲)
    offset_sec = timestamps[0]["t_ms"] / 1000.0 if timestamps else 0.0
    vid_dur    = probe_streams(out_mp4)["duration"]
    print(f"[screen] 完成: {out_mp4}, 時長={vid_dur:.3f}s")
    print(f"[screen] 音視訊偏移={offset_sec:.3f}s (方法:timestamps[0].t_ms 即 demo啟動→錄影起點差)")
    return out_mp4, offset_sec


# ── 縮圖 ──────────────────────────────────────────────────────────────────────

def make_thumbnail(level: str, out_dir: Path, base_url: str) -> Path:
    thumb_raw = out_dir / f"{level}_thumb_raw.png"

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx  = browser.new_context(viewport={"width": WIDTH, "height": HEIGHT})
        page = ctx.new_page()

        page.goto(base_url, wait_until="networkidle")
        page.wait_for_timeout(800)
        navigate_to_level(page, level)

        # 設到代表性一幀(J1: 步驟3終態,點在 2)
        n_demo_steps = page.evaluate(f"""
        (function() {{
            const all = Array.from(JH_LEVELS);
            if (typeof J7  !== 'undefined') all.push(J7);
            if (typeof J8  !== 'undefined') all.push(J8);
            if (typeof J9  !== 'undefined') all.push(J9);
            if (typeof J10 !== 'undefined') all.push(J10);
            const lv = all.find(l => l.id === '{level}');
            return lv && lv.demo ? lv.demo().length : 0;
        }})()
        """)
        target_step = min(3, n_demo_steps - 1) if n_demo_steps > 0 else 0
        # 執行到目標步前的所有 call
        for si in range(target_step + 1):
            set_step_state(page, level, si, t_frac=1.0)

        page.screenshot(path=str(thumb_raw))
        browser.close()

    # 嘗試用 ffmpeg 加文字
    thumb_out = out_dir / "thumbnail.png"

    # 找可用的 CJK 字型
    cjk_fonts = [
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/noto-cjk/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    ]
    cjk_font = next((f for f in cjk_fonts if Path(f).exists()), None)
    en_font = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

    if cjk_font:
        vf = (
            f"drawtext=fontfile={en_font}:"
            f"text='Junior Math Lab':"
            f"fontcolor=white:fontsize=36:borderw=2:bordercolor=black:"
            f"x=(w-text_w)/2:y=h-70,"
            f"drawtext=fontfile={cjk_font}:"
            f"text='\\u95dc1\\u8ca0\\u6578\\u5728\\u6578\\u7dda\\u4e0a\\u8d70\\u8def':"
            f"fontcolor=#ffd166:fontsize=56:borderw=3:bordercolor=black:"
            f"x=(w-text_w)/2:y=20"
        )
    else:
        vf = (
            f"drawtext=fontfile={en_font}:"
            f"text='Junior Math Lab - Lesson 1 Negative Numbers':"
            f"fontcolor=white:fontsize=36:borderw=2:bordercolor=black:"
            f"x=(w-text_w)/2:y=h-70"
        )

    r = subprocess.run(
        [FFMPEG, "-y", "-i", str(thumb_raw), "-vf", vf, str(thumb_out)],
        capture_output=True
    )
    if r.returncode != 0 or not thumb_out.exists():
        import shutil
        shutil.copy(thumb_raw, thumb_out)

    print(f"[thumb] {thumb_out}")
    return thumb_out


# ── metadata ──────────────────────────────────────────────────────────────────

def write_metadata(level: str, out_dir: Path) -> Path:
    path = out_dir / "metadata.md"
    path.write_text(f"""# {level} 影片 YouTube Metadata

## {level}_explain.mp4 — 講解式動畫

**標題**
關1負數在數線上走路｜國中數學動畫講解｜國中數感實驗室

**描述**
🎓 七年級數學開學第一課：負數怎麼算？
用數線走路的方式，直覺感受「加負數＝往左走、減負數＝往右走」。
不死背規則，用腳步記住負數！

本影片由「國中數感實驗室」互動關卡自動生成。
👉 互動練習版（可自己拖動）：https://junior-math-lab.vercel.app

📌 章節：
0:00 從 3 出發，算 3＋(−5)
0:02 加負數＝轉身往左走 5 步，停在 −2
0:05 換題：(−4)−(−6)
0:07 減負數＝轉兩次身＝往右走 6 步，停在 2

#國中數學 #負數 #數線 #七年級數學 #國中數感實驗室

**受眾**：台灣國中生家長、七年級學生、暑期預習

---

## {level}_screen.mp4 — 互動錄屏示範

**標題**
關1負數在數線上走路｜互動示範錄屏｜國中數感實驗室

**描述**
🎓 七年級數學：負數在數線上的直覺示範
看老師在網頁上「走」數線展示 3＋(−5)＝−2 與 (−4)−(−6)＝2。

本影片錄製自「國中數感實驗室」互動關卡。
👉 自己動手玩：https://junior-math-lab.vercel.app

#國中數學 #負數 #數線 #七年級數學 #互動數學

**受眾**：台灣國中生家長、七年級學生
""", encoding="utf-8")
    print(f"[meta] {path}")
    return path


# ── CLI 入口 ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="網頁互動關卡 → YouTube 影片膠水層")
    parser.add_argument("--level",  default="J1",
                        help="關卡 ID (如 J1)")
    parser.add_argument("--mode",   choices=["explain", "screen", "both"],
                        default="both")
    parser.add_argument("--out",    type=Path,
                        default=Path.home() / "Desktop/AI_MAC/media/video_poc_20260709")
    args = parser.parse_args()

    out_dir = args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    srv = start_server(REPO_ROOT, PORT)
    base_url = f"http://localhost:{PORT}/"
    print(f"[server] {base_url} → {REPO_ROOT}")

    try:
        explain_mp4 = None
        screen_mp4  = None
        total_mp3   = None
        vid_dur_ex  = None
        offset_sec  = None

        if args.mode in ("explain", "both"):
            print("\n=== 講解式模式 ===")
            explain_mp4, total_mp3, vid_dur_ex = mode_explain(
                args.level, out_dir, base_url)

        if args.mode in ("screen", "both"):
            print("\n=== 錄屏式模式 ===")
            screen_mp4, offset_sec = mode_screen(args.level, out_dir, base_url)

        print("\n=== 縮圖 ===")
        make_thumbnail(args.level, out_dir, base_url)

        write_metadata(args.level, out_dir)

        # ── 驗收報告 ──
        print("\n" + "="*50)
        print("驗收報告")
        print("="*50)

        if explain_mp4 and explain_mp4.exists():
            info = probe_streams(explain_mp4)
            vc1 = "PASS" if info["has_video"] and info["has_audio"] and info["duration"] > 0 else "FAIL"
            diff = abs(info["duration"] - total_mp3) if total_mp3 else 999
            vc2 = "PASS" if diff < 0.5 else "FAIL"
            print(f"[VC1] explain mp4: duration={info['duration']:.3f}s "
                  f"video={info['has_video']} audio={info['has_audio']} → {vc1}")
            print(f"[VC2] Σmp3={total_mp3:.3f}s vs 影片={info['duration']:.3f}s "
                  f"誤差={diff:.3f}s → {vc2}")
        else:
            print("[VC1] explain mp4: 未產生")
            print("[VC2] -")

        if screen_mp4 and screen_mp4.exists():
            info = probe_streams(screen_mp4)
            vc1 = "PASS" if info["has_video"] and info["has_audio"] and info["duration"] > 0 else "FAIL"
            vc3 = "PASS" if offset_sec is not None and offset_sec < 0.3 else "FAIL"
            print(f"[VC1] screen  mp4: duration={info['duration']:.3f}s "
                  f"video={info['has_video']} audio={info['has_audio']} → {vc1}")
            print(f"[VC3] 音視訊偏移={offset_sec:.3f}s (方法:demo step0 timestamp) → {vc3}")
        else:
            print("[VC1] screen mp4: 未產生")
            print("[VC3] -")

        print("\n產物清單:")
        for p in sorted(out_dir.glob("*.mp4")) + sorted(out_dir.glob("*.png")) + sorted(out_dir.glob("*.md")):
            print(f"  {p}")

    finally:
        srv.terminate()
        print("\n[server] 已停止")


if __name__ == "__main__":
    main()

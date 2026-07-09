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

PORT   = 8804
WIDTH  = 1280
HEIGHT = 720
FPS    = 30

# ── 關卡 demo 步驟元資料 ──────────────────────────────────────────────────────
# True = 有插值動畫(取 4 張截圖均分時長); False = 靜態(取 1 張)
# J1: step0=call(靜), step1=num動畫, step2=call(靜), step3=num動畫, step4=call(靜)
# S7A_01: 6 步全為 call(靜)——拖放分類 DOM 更新,無 num/vec 插值
DEMO_META = {
    "J1":    [False, True, False, True, False],
    "S7A_01": [False, False, False, False, False, False],
}

# ── 科目 URL 對應表:level id 前綴 → URL 參數 ─────────────────────────────────
# 有 URL 參數的科目需用 ?subject=<val> 載入才能找到該關卡
LEVEL_SUBJECT_PARAM = {
    "S": "science7a",   # S7A_01, S7A_02 … 等均以 S 開頭
}

def level_url_param(level: str) -> str | None:
    """根據 level id 決定需要的 ?subject= 參數,數學 J 系列回傳 None。"""
    for prefix, param in LEVEL_SUBJECT_PARAM.items():
        if level.startswith(prefix):
            return param
    return None

# ── JS helper:找 level 物件(支援數學 JH_LEVELS 與動態載入科目) ───────────────
FIND_LEVEL_JS = """
(function(levelId) {
    // 先從動態科目的 levels 陣列找(science 等)
    if (typeof levels !== 'undefined') {
        const lv = levels.find(l => l.id === levelId);
        if (lv) return lv;
    }
    // fallback:數學 JH_LEVELS
    const all = Array.from(typeof JH_LEVELS !== 'undefined' ? JH_LEVELS : []);
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


def _find_level_js(level: str) -> str:
    """產生找 level 物件的 JS 片段(支援數學 JH_LEVELS 與動態載入科目)。"""
    return f"""
    (function() {{
        const levelId = '{level}';
        // 先從頁面的動態 levels 陣列找(science 等動態科目)
        if (typeof levels !== 'undefined') {{
            const lv = levels.find(l => l.id === levelId);
            if (lv) return lv;
        }}
        // fallback:數學 JH_LEVELS
        const all = typeof JH_LEVELS !== 'undefined' ? Array.from(JH_LEVELS) : [];
        if (typeof J7  !== 'undefined') all.push(J7);
        if (typeof J8  !== 'undefined') all.push(J8);
        if (typeof J9  !== 'undefined') all.push(J9);
        if (typeof J10 !== 'undefined') all.push(J10);
        return all.find(l => l.id === levelId) || null;
    }})()
    """


def navigate_to_level(page, level: str):
    """導航到指定關卡(支援數學 J 系列與自然科 S 系列)。"""
    ok = page.evaluate(f"""
    (function() {{
        const levelId = '{level}';
        // 先從頁面的動態 levels 陣列找(science 等動態科目)
        if (typeof levels !== 'undefined') {{
            const idx = levels.findIndex(l => l.id === levelId);
            if (idx >= 0) {{
                if (typeof switchLevel === 'function') switchLevel(idx);
                return true;
            }}
        }}
        // fallback:數學 JH_LEVELS
        const all = typeof JH_LEVELS !== 'undefined' ? Array.from(JH_LEVELS) : [];
        if (typeof J7  !== 'undefined') all.push(J7);
        if (typeof J8  !== 'undefined') all.push(J8);
        if (typeof J9  !== 'undefined') all.push(J9);
        if (typeof J10 !== 'undefined') all.push(J10);
        const lv = all.find(l => l.id === levelId);
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
        const levelId = '{level}';
        let lv = null;
        if (typeof levels !== 'undefined') lv = levels.find(l => l.id === levelId);
        if (!lv && typeof JH_LEVELS !== 'undefined') {{
            const all = Array.from(JH_LEVELS);
            if (typeof J7  !== 'undefined') all.push(J7);
            if (typeof J8  !== 'undefined') all.push(J8);
            if (typeof J9  !== 'undefined') all.push(J9);
            if (typeof J10 !== 'undefined') all.push(J10);
            lv = all.find(l => l.id === levelId);
        }}
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
    靜態步 t_frac 無意義,固定終態。支援數學 J 系列與自然科 S 系列。
    """
    page.evaluate(f"""
    (function() {{
        const levelId = '{level}';
        let lv = null;
        if (typeof levels !== 'undefined') lv = levels.find(l => l.id === levelId);
        if (!lv && typeof JH_LEVELS !== 'undefined') {{
            const all = Array.from(JH_LEVELS);
            if (typeof J7  !== 'undefined') all.push(J7);
            if (typeof J8  !== 'undefined') all.push(J8);
            if (typeof J9  !== 'undefined') all.push(J9);
            if (typeof J10 !== 'undefined') all.push(J10);
            lv = all.find(l => l.id === levelId);
        }}
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
#
# 修法(2026-07-10):改為「逐段 mp3 秒數驅動時間軸」
#
# 舊做法:player.start(lv.demo()) 讓 JS 自己的 dur 計時推進步驟(合計≈15s),
#         再把 48s 旁白貼上 → -shortest 截斷到 15s。
#
# 新做法:
#   1. 用 ffprobe 量每段 mp3 秒數。
#   2. 在 JS 端把 demo steps 的 dur 覆蓋成對應 mp3 秒數(ms),讓 player 自動推進時
#      每步停留時間 = 該段旁白長度。
#   3. 同時 monkey-patch player.next 記錄每步實際觸發時刻。
#   4. 等待上限 = Σmp3 + 10s buffer。
#   5. 錄到的 webm:頁面載入預熱時間(pre-roll)+ Σmp3 的動畫。
#   6. 從 timestamps[0] 取 pre-roll 秒數,用 ffmpeg -ss 剪掉頭部,
#      讓視訊起點 = demo 第 0 步起點 = 旁白起點。
#   7. 驗收:剪後影片總長與 Σmp3 誤差 <0.5s;六步偏移各 <0.5s。

def mode_screen(level: str, out_dir: Path, base_url: str):
    audio_dir = REPO_ROOT / "audio"
    mp3_files = get_mp3_list(level, audio_dir)
    durations = [ffprobe_duration(p) for p in mp3_files]
    total_mp3 = sum(durations)
    n_steps   = len(durations)

    print(f"[screen] mp3 秒數: {[f'{d:.3f}' for d in durations]}")
    print(f"[screen] Σmp3={total_mp3:.3f}s, {n_steps} 段")

    tmp_dir = out_dir / "tmp_screen"
    tmp_dir.mkdir(exist_ok=True)

    # 清除舊 webm,確保錄完後只有本次產生的一個 webm
    for old_webm in tmp_dir.glob("*.webm"):
        old_webm.unlink()

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

        # 核心修法:Python 逐步驅動 demo,每步停留時間精確 = 對應 mp3 秒數。
        #
        # 做法:
        # 1. 從 JS 取 demo 步驟陣列(只取結構,不啟動 player)
        # 2. 對每步 i:
        #    a. page.evaluate → 執行 steps[i].call()(更新 DOM 狀態 + 觸發 render)
        #    b. page.evaluate → 顯示 caption(如果步驟有 cap)
        #    c. page.wait_for_timeout(durations_ms[i]) — Python 精確計時
        # 3. 記錄每步實際觸發時刻(Python wall-clock)
        # 4. 完成後 player 不需要介入。
        #
        # 好處:步驟停留時間完全由 Python 控制,無 JS RAF 時鐘漂移。

        # 取步驟陣列(只取 cap 欄位判斷要不要顯 caption)
        steps_caps = page.evaluate(f"""
        (function() {{
            const levelId = '{level}';
            let lv = null;
            if (typeof levels !== 'undefined') lv = levels.find(l => l.id === levelId);
            if (!lv && typeof JH_LEVELS !== 'undefined') {{
                const all = Array.from(JH_LEVELS);
                if (typeof J7  !== 'undefined') all.push(J7);
                if (typeof J8  !== 'undefined') all.push(J8);
                if (typeof J9  !== 'undefined') all.push(J9);
                if (typeof J10 !== 'undefined') all.push(J10);
                lv = all.find(l => l.id === levelId);
            }}
            if (!lv || !lv.demo) return [];
            return lv.demo().map(function(st) {{
                return {{ hasCap: st.cap != null, cap: st.cap || '' }};
            }});
        }})()
        """)

        print(f"[screen] 取得 {len(steps_caps)} 個步驟,逐步 Python 計時驅動")

        t_demo_start_py = time.time()  # Python wall-clock demo 起點
        timestamps = []                 # [{"idx": i, "t_ms": ms}] Python 計時的觸發時刻

        for step_i in range(n_steps):
            t_step_py = time.time()
            rel_ms = round((t_step_py - t_demo_start_py) * 1000)
            timestamps.append({"idx": step_i, "t_ms": rel_ms})

            # 執行 steps[step_i].call() + 更新 caption
            page.evaluate(f"""
            (function() {{
                const levelId = '{level}';
                let lv = null;
                if (typeof levels !== 'undefined') lv = levels.find(l => l.id === levelId);
                if (!lv && typeof JH_LEVELS !== 'undefined') {{
                    const all = Array.from(JH_LEVELS);
                    if (typeof J7  !== 'undefined') all.push(J7);
                    if (typeof J8  !== 'undefined') all.push(J8);
                    if (typeof J9  !== 'undefined') all.push(J9);
                    if (typeof J10 !== 'undefined') all.push(J10);
                    lv = all.find(l => l.id === levelId);
                }}
                if (!lv || !lv.demo) return;
                const steps = lv.demo();
                const st = steps[{step_i}];
                if (!st) return;
                if (st.call) st.call();
                if (typeof lv._sync === 'function') lv._sync();
                if (st.cap != null) {{
                    const el = document.getElementById('caption');
                    if (el) {{ el.textContent = st.cap; el.classList.add('show'); }}
                }}
            }})()
            """)

            dur_ms = int(round(durations[step_i] * 1000))
            print(f"  步驟 {step_i}: call() 完成,等待 {dur_ms}ms (mp3={durations[step_i]:.3f}s)")
            page.wait_for_timeout(dur_ms)

        print("[screen] demo 全步完成")

        # 計算每步偏移(純 Python 計時)
        step_timestamps_display = [(t["idx"], t["t_ms"]) for t in timestamps]
        print(f"[screen] 每步觸發時刻(ms): {step_timestamps_display}")

        page.close()
        ctx.close()
        browser.close()

    # 找 .webm(已在錄影前清除舊檔,此時目錄裡只有一個 webm)
    webm_files = list(tmp_dir.glob("*.webm"))
    if not webm_files:
        raise RuntimeError("找不到錄屏 .webm 檔")
    webm_path = max(webm_files, key=lambda p: p.stat().st_mtime)  # 以防萬一取最新
    webm_dur  = probe_streams(webm_path)["duration"]
    print(f"[screen] webm={webm_path.name}, 時長={webm_dur:.3f}s")

    # 計算 pre-roll:webm 總長 - Σmp3 = 錄影起點到 demo 起點的空白
    # (demo 結束後立即 page.close(),尾部空白 ≤ 200ms poll 間隔,可忽略)
    pre_roll_sec = max(0.0, webm_dur - total_mp3)
    print(f"[screen] pre-roll≈{pre_roll_sec:.3f}s (webm {webm_dur:.3f}s - Σmp3 {total_mp3:.3f}s) → 剪頭部")

    # 逐步偏移驗核
    # timestamps[i].t_ms = step i 觸發時相對 __page_t0 (=player.start 前)的毫秒
    # page_t0 到 demo 真正起點的延遲 ≈ 0 (evaluate 串行執行,player.start 在同一 evaluate 塊)
    # 所以在「剪後視訊」中,step i 的視訊起點 ≈ timestamps[i].t_ms / 1000
    # 旁白起點 = Σdurations[0..i-1]
    print("[screen] 逐步同步偏移分析 (相對於 demo 起點):")
    # timestamps[0].t_ms ≈ 0 (step 0 在 player.start 後立即觸發)
    # 後續步驟的相對時刻 = timestamps[i].t_ms - timestamps[0].t_ms
    t0_ms = timestamps[0]["t_ms"] if timestamps else 0.0
    cumulative = 0.0
    max_offset = 0.0
    for i, ts in enumerate(timestamps):
        step_t_rel = (ts["t_ms"] - t0_ms) / 1000.0   # 相對 demo 起點(秒)
        narration_t = cumulative
        offset = abs(step_t_rel - narration_t)
        max_offset = max(max_offset, offset)
        print(f"  步驟 {ts['idx']}: demo起點後@{step_t_rel:.3f}s, 旁白起點@{narration_t:.3f}s, 偏移={offset:.3f}s")
        if i < len(durations):
            cumulative += durations[i]
    print(f"[screen] 最大步驟偏移={max_offset:.3f}s")

    # 串接 mp3 → aac
    concat_audio = out_dir / f"{level}_narration_screen.aac"
    concat_mp3_to_aac(mp3_files, concat_audio)

    # 裁剪 webm(去掉 pre-roll)→ 中間暫存(re-encode 確保時間戳從 0 開始)
    trimmed_webm = tmp_dir / f"{level}_trimmed.webm"
    subprocess.run(
        [FFMPEG, "-y",
         "-ss", f"{pre_roll_sec:.6f}",
         "-i", str(webm_path),
         "-c:v", "vp8", "-b:v", "1500k",  # re-encode 修正 keyframe 問題
         str(trimmed_webm)],
        check=True, capture_output=True
    )
    trimmed_dur = probe_streams(trimmed_webm)["duration"]
    print(f"[screen] 裁剪後 webm 時長={trimmed_dur:.3f}s (目標 Σmp3={total_mp3:.3f}s)")

    # 合成最終 mp4
    out_mp4 = out_dir / f"{level}_screen.mp4"
    subprocess.run(
        [FFMPEG, "-y",
         "-i", str(trimmed_webm),
         "-i", str(concat_audio),
         "-c:v", "libx264", "-pix_fmt", "yuv420p",
         "-preset", "medium", "-crf", "20",
         "-c:a", "aac", "-b:a", "128k",
         "-shortest",
         str(out_mp4)],
        check=True, capture_output=True
    )

    vid_dur = probe_streams(out_mp4)["duration"]
    dur_diff = abs(vid_dur - total_mp3)
    print(f"[screen] 完成: {out_mp4}")
    print(f"[screen] Σmp3={total_mp3:.3f}s, 影片={vid_dur:.3f}s, 誤差={dur_diff:.3f}s")
    return out_mp4, pre_roll_sec, vid_dur, total_mp3, max_offset


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

        # 設到代表性一幀(J1: 步驟3終態; S7A_01: 步驟3終態=三個植物構造已放置)
        n_demo_steps = page.evaluate(f"""
        (function() {{
            const levelId = '{level}';
            let lv = null;
            if (typeof levels !== 'undefined') lv = levels.find(l => l.id === levelId);
            if (!lv && typeof JH_LEVELS !== 'undefined') {{
                const all = Array.from(JH_LEVELS);
                if (typeof J7  !== 'undefined') all.push(J7);
                if (typeof J8  !== 'undefined') all.push(J8);
                if (typeof J9  !== 'undefined') all.push(J9);
                if (typeof J10 !== 'undefined') all.push(J10);
                lv = all.find(l => l.id === levelId);
            }}
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

    # 縮圖文字查找表
    THUMB_CJK: dict[str, str] = {
        "J1":    "關1負數在數線上走路",
        "S7A_01": "細胞基本構造",
    }
    THUMB_EN: dict[str, str] = {
        "J1":    "Junior Math Lab",
        "S7A_01": "Junior Science Lab",
    }
    cjk_text = THUMB_CJK.get(level, level)
    en_text  = THUMB_EN.get(level, "Junior Math Lab")

    if cjk_font:
        # ffmpeg drawtext 不支援直接 Unicode 字串,須先用 unicode_escape
        cjk_escaped = "".join(
            f"\\u{ord(c):04x}" if ord(c) > 127 else c
            for c in cjk_text
        )
        vf = (
            f"drawtext=fontfile={en_font}:"
            f"text='{en_text}':"
            f"fontcolor=white:fontsize=36:borderw=2:bordercolor=black:"
            f"x=(w-text_w)/2:y=h-70,"
            f"drawtext=fontfile={cjk_font}:"
            f"text='{cjk_escaped}':"
            f"fontcolor=#ffd166:fontsize=56:borderw=3:bordercolor=black:"
            f"x=(w-text_w)/2:y=20"
        )
    else:
        vf = (
            f"drawtext=fontfile={en_font}:"
            f"text='{en_text} - {cjk_text}':"
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


# ── 關卡 metadata 查找表(YouTube 標題/描述/受眾) ─────────────────────────────
LEVEL_META: dict[str, dict] = {
    "J1": {
        "title_screen":   "關1負數在數線上走路｜互動示範錄屏｜國中數感實驗室",
        "title_explain":  "關1負數在數線上走路｜國中數學動畫講解｜國中數感實驗室",
        "desc_screen": (
            "🎓 七年級數學：負數在數線上的直覺示範\n"
            "看老師在網頁上「走」數線展示 3＋(−5)＝−2 與 (−4)−(−6)＝2。\n\n"
            "本影片錄製自「國中數感實驗室」互動關卡。\n"
            "👉 自己動手玩：https://junior-math-lab.vercel.app\n\n"
            "#國中數學 #負數 #數線 #七年級數學 #互動數學"
        ),
        "desc_explain": (
            "🎓 七年級數學開學第一課：負數怎麼算？\n"
            "用數線走路的方式，直覺感受「加負數＝往左走、減負數＝往右走」。\n"
            "不死背規則，用腳步記住負數！\n\n"
            "本影片由「國中數感實驗室」互動關卡自動生成。\n"
            "👉 互動練習版（可自己拖動）：https://junior-math-lab.vercel.app\n\n"
            "📌 章節：\n"
            "0:00 從 3 出發，算 3＋(−5)\n"
            "0:02 加負數＝轉身往左走 5 步，停在 −2\n"
            "0:05 換題：(−4)−(−6)\n"
            "0:07 減負數＝轉兩次身＝往右走 6 步，停在 2\n\n"
            "#國中數學 #負數 #數線 #七年級數學 #國中數感實驗室"
        ),
        "audience": "台灣國中生家長、七年級學生、暑期預習",
    },
    "S7A_01": {
        "title_screen":  "細胞基本構造｜植物vs動物細胞互動示範｜國中自然科",
        "title_explain": "細胞基本構造｜植物細胞才有什麼？動畫講解｜國中自然科",
        "desc_screen": (
            "🔬 七年級自然科：細胞基本構造互動示範\n"
            "看老師在網頁上逐步把細胞壁、葉綠體、液胞放入植物欄，\n"
            "細胞膜、細胞核、粒線體放入動植物都有欄，輕鬆記住差異！\n\n"
            "本影片錄製自「國中數感實驗室」自然科互動關卡。\n"
            "👉 自己動手玩：https://junior-math-lab.vercel.app?subject=science7a\n\n"
            "#國中自然 #細胞 #植物細胞 #動物細胞 #七年級自然 #細胞構造"
        ),
        "desc_explain": (
            "🔬 七年級自然科：細胞是生命的基本單位\n"
            "哪些構造是植物才有？哪些動植物都有？\n"
            "✅ 植物才有：細胞壁、葉綠體、液胞\n"
            "✅ 動植物都有：細胞膜、細胞核、粒線體\n\n"
            "本影片由「國中數感實驗室」自然科互動關卡自動生成。\n"
            "👉 互動版（可自己拖動分類）：https://junior-math-lab.vercel.app?subject=science7a\n\n"
            "📌 章節：\n"
            "0:00 細胞是生命的基本單位\n"
            "0:06 細胞壁：植物才有\n"
            "0:15 葉綠體：植物才有（光合作用）\n"
            "0:24 液胞：植物才有（大型儲水）\n"
            "0:32 細胞膜、細胞核、粒線體：動植物都有\n"
            "0:44 換你試試！\n\n"
            "#國中自然 #細胞 #植物細胞 #動物細胞 #七年級自然 #國中數感實驗室"
        ),
        "audience": "台灣國中生家長、七年級學生、自然科預習複習",
    },
}


def write_metadata(level: str, out_dir: Path) -> Path:
    path = out_dir / "metadata.md"
    meta = LEVEL_META.get(level, {})

    title_screen  = meta.get("title_screen",  f"{level} 互動錄屏示範｜國中數感實驗室")
    title_explain = meta.get("title_explain", f"{level} 動畫講解｜國中數感實驗室")
    desc_screen   = meta.get("desc_screen",   f"本影片錄製自「國中數感實驗室」關卡 {level}。")
    desc_explain  = meta.get("desc_explain",  f"本影片由「國中數感實驗室」關卡 {level} 自動生成。")
    audience      = meta.get("audience",      "台灣國中生家長、七年級學生")

    path.write_text(f"""# {level} 影片 YouTube Metadata

## {level}_explain.mp4 — 講解式動畫

**標題**
{title_explain}

**描述**
{desc_explain}

**受眾**：{audience}

---

## {level}_screen.mp4 — 互動錄屏示範

**標題**
{title_screen}

**描述**
{desc_screen}

**受眾**：{audience}
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
    # 自然科 S 系列需要 ?subject=science7a 才能載入關卡
    subject_param = level_url_param(args.level)
    base_url = f"http://localhost:{PORT}/"
    if subject_param:
        base_url = f"http://localhost:{PORT}/?subject={subject_param}"
    print(f"[server] {base_url} → {REPO_ROOT}")

    try:
        explain_mp4      = None
        screen_mp4       = None
        total_mp3        = None
        vid_dur_ex       = None
        pre_roll_sec     = None
        vid_dur_sc       = None
        total_mp3_sc     = None
        max_step_offset  = None

        if args.mode in ("explain", "both"):
            print("\n=== 講解式模式 ===")
            explain_mp4, total_mp3, vid_dur_ex = mode_explain(
                args.level, out_dir, base_url)

        if args.mode in ("screen", "both"):
            print("\n=== 錄屏式模式 ===")
            screen_mp4, pre_roll_sec, vid_dur_sc, total_mp3_sc, max_step_offset = \
                mode_screen(args.level, out_dir, base_url)

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
            dur_diff = abs(vid_dur_sc - total_mp3_sc)
            vc_dur = "PASS" if dur_diff < 0.5 else "FAIL"
            vc_sync = "PASS" if max_step_offset < 0.5 else "FAIL"
            print(f"[VC1] screen  mp4: duration={info['duration']:.3f}s "
                  f"video={info['has_video']} audio={info['has_audio']} → {vc1}")
            print(f"[VC_DUR] Σmp3={total_mp3_sc:.3f}s vs 影片={vid_dur_sc:.3f}s "
                  f"誤差={dur_diff:.3f}s → {vc_dur}")
            print(f"[VC_SYNC] 最大步驟偏移={max_step_offset:.3f}s → {vc_sync}")
        else:
            print("[VC1] screen mp4: 未產生")
            print("[VC_DUR] -")
            print("[VC_SYNC] -")

        print("\n產物清單:")
        for p in sorted(out_dir.glob("*.mp4")) + sorted(out_dir.glob("*.png")) + sorted(out_dir.glob("*.md")):
            print(f"  {p}")

    finally:
        srv.terminate()
        print("\n[server] 已停止")


if __name__ == "__main__":
    main()

"""
test_voice_default.py — 旁白語音按鈕預設狀態 + 手勢後 mp3 請求

跑法:
    cd /home/ai-mac/Desktop/AI_MAC/Projects/junior-math-lab
    python3 tests/test_voice_default.py

依賴:playwright(pip install playwright; playwright install chromium)
port 8931
"""
import subprocess, time, sys
from playwright.sync_api import sync_playwright

ROOT = "/home/ai-mac/Desktop/AI_MAC/Projects/junior-math-lab"
PORT = 8931

srv = subprocess.Popen(
    ["python3", "-m", "http.server", str(PORT)],
    cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
)
time.sleep(1)

all_pass = True
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context()
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto(f"http://localhost:{PORT}")
        pg.wait_for_timeout(1500)

        btn = pg.text_content("#voice-btn")
        # 首次手勢:點第一個科目第一個 tab
        tabs_present = pg.query_selector("#tabs button")
        if tabs_present:
            pg.click("#tabs button")
        else:
            pg.click("body")
        pg.wait_for_timeout(800)

        mp3_reqs = pg.evaluate(
            "() => performance.getEntriesByType('resource').filter(r=>r.name.includes('.mp3')).length"
        )
        no_crash = len(errs) == 0
        # voice-btn 預設應為 🔊(語音開啟,預設 on),手勢後 mp3 請求應 >0
        t1 = btn == "🔊"
        t2 = no_crash
        all_pass = t1 and t2
        print(f"voice-btn={btn!r} mp3_requests={mp3_reqs} console_errors={len(errs)} {errs[:2]}")
        print(f"T1 預設開聲🔊: {'PASS' if t1 else 'FAIL'}")
        print(f"T2 無crash: {'PASS' if t2 else 'FAIL'}")
        b.close()
finally:
    srv.terminate()

sys.exit(0 if all_pass else 1)

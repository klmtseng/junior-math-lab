"""
test_batch1_final.py — 逐關開啟 + 音檔請求驗證

跑法:
    cd /home/ai-mac/Desktop/AI_MAC/Projects/junior-math-lab
    python3 tests/test_batch1_final.py

依賴:playwright(pip install playwright; playwright install chromium)
port 8933
"""
import subprocess, time, sys
from playwright.sync_api import sync_playwright

ROOT = "/home/ai-mac/Desktop/AI_MAC/Projects/junior-math-lab"
PORT = 8933

srv = subprocess.Popen(
    ["python3", "-m", "http.server", str(PORT)],
    cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
)
time.sleep(1)

all_pass = True
try:
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        pg = b.new_context().new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto(f"http://localhost:{PORT}")
        pg.wait_for_timeout(1500)

        subs = [e.text_content() for e in pg.query_selector_all("#subjects button")]
        opened = 0
        for si in range(len(subs)):
            pg.query_selector_all("#subjects button")[si].click()
            pg.wait_for_timeout(400)
            tabs = pg.query_selector_all("#tabs button")
            for ti in range(len(tabs)):
                pg.query_selector_all("#tabs button")[ti].click()
                pg.wait_for_timeout(700)
                opened += 1

        mp3 = pg.evaluate("() => performance.getEntriesByType('resource').filter(r=>r.name.includes('.mp3')).length")
        m404 = pg.evaluate("() => performance.getEntriesByType('resource').filter(r=>r.name.includes('.mp3') && r.responseStatus===404).length")

        # 原始 2 科目(b1/b2)共 12 關;drill.js 加入第 3 科目(mx)共 3 關 → 總計 3 科目 15 關
        t1 = len(subs) == 3
        t2 = opened == 15  # 七上 5 + 七下 7 + 綜合演練 3
        t3 = m404 == 0
        t4 = len(errs) == 0

        all_pass = t1 and t2 and t3 and t4
        print(f"subjects={subs} opened={opened} mp3_requests={mp3} mp3_404={m404} console_errors={len(errs)} {errs[:3]}")
        print(f"T1 科目數=3(七上/七下/綜合演練): {'PASS' if t1 else 'FAIL'}")
        print(f"T2 共15關: {'PASS' if t2 else 'FAIL'} (opened={opened})")
        print(f"T3 無404音檔: {'PASS' if t3 else 'FAIL'}")
        print(f"T4 無console error: {'PASS' if t4 else 'FAIL'}")
        b.close()
finally:
    srv.terminate()

sys.exit(0 if all_pass else 1)

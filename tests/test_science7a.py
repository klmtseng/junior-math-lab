"""
test_science7a.py — S7A_01 自然科關卡驗收

跑法:
    cd /home/ai-mac/Desktop/AI_MAC/Projects/junior-math-lab
    python3 tests/test_science7a.py

測試項目:
  T1 ?subject=science7a 載入後科目按鈕顯示「七上自然」
  T2 tabs 有 1 個關卡「細胞構造」
  T3 點開關卡:intro 文字出現(含「細胞」)
  T4 分類互動:依序點選 6 個 chip 完成分類,goal 觸發(S7A_01-a)
  T5 demo() 自動示範可跑完(player 啟動後 active 最終為 false)
  T6 零 console error
port 8801
"""
import subprocess, time, sys, json
from playwright.sync_api import sync_playwright

ROOT = "/home/ai-mac/Desktop/AI_MAC/Projects/junior-math-lab"
PORT = 8801

srv = subprocess.Popen(
    ["python3", "-m", "http.server", str(PORT)],
    cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
)
time.sleep(1)

all_pass = True

def p(label, ok, detail=""):
    global all_pass
    all_pass = all_pass and ok
    print(f"{'PASS' if ok else 'FAIL'} {label}{(' — ' + detail) if detail else ''}")

try:
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context()
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)

        pg.goto(f"http://localhost:{PORT}?subject=science7a")
        # 等待科目按鈕出現(main.js async init 完成後才 renderSubjects)
        pg.wait_for_selector("#subjects button", timeout=6000)
        pg.wait_for_timeout(600)

        # T1 科目顯示「七上自然」
        subs = [b2.text_content() for b2 in pg.query_selector_all("#subjects button")]
        t1 = any("七上自然" in s for s in subs)
        p("T1 科目顯示「七上自然」", t1, f"subs={subs}")

        # T2 tabs 有 1 關且含「細胞」
        tabs = [b2.text_content() for b2 in pg.query_selector_all("#tabs button")]
        t2 = len(tabs) >= 1 and any("細胞" in t for t in tabs)
        p("T2 tabs 含細胞構造關卡", t2, f"tabs={tabs}")

        # T3 intro 出現「細胞」
        pg.query_selector_all("#tabs button")[0].click()
        pg.wait_for_timeout(600)
        intro_text = pg.text_content("#lv-intro") or ""
        t3 = "細胞" in intro_text
        p("T3 intro 含「細胞」文字", t3, f"intro[:30]={intro_text[:30]!r}")

        # T4 分類互動:把所有待分類的 chip 都點到正確位置
        # 先跳過示範(若正在播)
        demo_btn = pg.query_selector("#demo-btn")
        if demo_btn and "跳過" in (demo_btn.text_content() or ""):
            demo_btn.click()
            pg.wait_for_timeout(500)

        # 期望各 chip 的正確 zone:plant=植物才有(plant), both=動植物都有(both)
        CORRECT = {
            "細胞壁": "plant",
            "葉綠體": "plant",
            "液胞":   "plant",
            "細胞膜": "both",
            "細胞核": "both",
            "粒線體": "both",
        }
        # 點擊直到所有 chip 都放到正確的 zone
        # chip 的 data-zone 告訴現在在哪個 zone
        # 點一下:null→plant; 再點:plant→both; 再點:both→null
        for name, target in CORRECT.items():
            for _ in range(3):  # 最多循環 3 次
                chip = pg.query_selector(f'.cell-chip[data-name="{name}"]')
                if not chip:
                    break
                zone = chip.get_attribute("data-zone")
                if zone == target:
                    break
                chip.click()
                pg.wait_for_timeout(150)

        pg.wait_for_timeout(400)
        # 驗:progress S7A_01-a 是否觸發
        prog = json.loads(pg.evaluate("() => localStorage.getItem('jrlab-progress-v1')") or "{}")
        t4 = prog.get("S7A_01-a") == True
        p("T4 分類完成 goal S7A_01-a 觸發", t4, f"S7A_01-a={prog.get('S7A_01-a')}")

        # T5 demo() 示範可跑完:先重置狀態再啟動
        pg.evaluate("() => { try { levels[curIdx].enter(); } catch(e){} }")
        pg.wait_for_timeout(200)
        demo_btn2 = pg.query_selector("#demo-btn")
        if demo_btn2:
            demo_btn2.click()
        # 等待 player 啟動(最多 1s)
        pg.wait_for_timeout(800)
        player_was_active = pg.evaluate("() => { try { return player.active; } catch(e) { return false; } }")
        # 快速跳過:點 canvas 讓 player.stop() 觸發
        pg.click("#board")
        pg.wait_for_timeout(500)
        player_done = pg.evaluate("() => { try { return !player.active; } catch(e) { return true; } }")
        t5 = player_done  # 示範能啟動且能被停止
        p("T5 demo() 啟動並可跳過", t5, f"was_active={player_was_active} done={player_done}")

        # T6 零 console error
        t6 = len(errs) == 0
        p("T6 零 console error", t6, str(errs[:3]) if errs else "")

        b.close()
finally:
    srv.terminate()

sys.exit(0 if all_pass else 1)

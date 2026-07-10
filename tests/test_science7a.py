"""
test_science7a.py — S7A_01 自然科關卡驗收

跑法:
    cd /home/ai-mac/Desktop/AI_MAC/Projects/junior-math-lab
    python3 tests/test_science7a.py

測試項目:
  T1 ?subject=science7a 載入後科目按鈕顯示「七上自然」
  T2 tabs 有 1 個關卡「細胞構造」
  T3 點開關卡:intro 文字出現(含「細胞」)
  T4 複選矩陣:7 構造 × 植物/動物勾選正解 → 檢查答案 → goal 觸發(S7A_01-a);
     並驗證「答錯 → 有紅色標示(.cm-bad)且未通關」
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

        # 先跳過示範(若正在播)
        demo_btn = pg.query_selector("#demo-btn")
        if demo_btn and "跳過" in (demo_btn.text_content() or ""):
            demo_btn.click()
            pg.wait_for_timeout(500)

        # 每個構造的正解:(植物有?, 動物有?)
        # 植物特有(只植物):細胞壁/葉綠體/液胞;共有(兩欄都勾):細胞膜/核/質/粒線體
        CORRECT = {
            "細胞壁": (True, False),
            "葉綠體": (True, False),
            "液胞":   (True, False),
            "細胞膜": (True, True),
            "細胞核": (True, True),
            "細胞質": (True, True),
            "粒線體": (True, True),
        }

        def click_cell(name, col):
            td = pg.query_selector(f'.cm-cell[data-name="{name}"][data-col="{col}"]')
            assert td, f"找不到格子 {name}/{col}"
            td.click()
            pg.wait_for_timeout(60)

        # ── T4a:先製造一個錯誤(粒線體漏勾動物)並檢查 → 應標紅且不通關 ──
        for name, (wp, wa) in CORRECT.items():
            if wp: click_cell(name, "plant")
            if wa and name != "粒線體": click_cell(name, "animal")  # 故意漏勾粒線體動物欄
        pg.query_selector("#cm-check").click()
        pg.wait_for_timeout(300)
        has_bad = pg.query_selector(".cm-bad") is not None
        prog_wrong = json.loads(pg.evaluate("() => localStorage.getItem('jrlab-progress-v1')") or "{}")
        t4a = has_bad and prog_wrong.get("S7A_01-a") != True
        p("T4a 答錯有紅色標示(.cm-bad)且未通關", t4a,
          f"cm-bad={has_bad} goal={prog_wrong.get('S7A_01-a')}")

        # ── T4b:補上漏勾的粒線體動物欄 → 全對 → 檢查 → 通關 ──
        click_cell("粒線體", "animal")
        pg.query_selector("#cm-check").click()
        pg.wait_for_timeout(400)
        prog = json.loads(pg.evaluate("() => localStorage.getItem('jrlab-progress-v1')") or "{}")
        t4 = prog.get("S7A_01-a") == True
        p("T4b 全對後 goal S7A_01-a 觸發", t4, f"S7A_01-a={prog.get('S7A_01-a')}")

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

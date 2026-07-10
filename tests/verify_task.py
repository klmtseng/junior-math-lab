"""
verify_task.py — 一次性驗收:
(1) S7A_03 換算練習已改為選擇題,可點選作答,答案正確
(2) 綜合練習入口(hub.html)能選數學/自然並作答對應總測驗
(3) 數學預設模式與 ?subject=science7a 各 smoke:無 console error、關卡未壞
截圖存 media/。
"""
import subprocess, time, sys, os
from playwright.sync_api import sync_playwright

ROOT = "/home/ai-mac/Desktop/AI_MAC/Projects/junior-math-lab"
MEDIA = os.path.join(ROOT, "media")
PORT = 8802
srv = subprocess.Popen(["python3", "-m", "http.server", str(PORT)], cwd=ROOT,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
all_pass = True
def p(label, ok, detail=""):
    global all_pass; all_pass = all_pass and ok
    print(f"{'PASS' if ok else 'FAIL'} {label}{(' — ' + detail) if detail else ''}")

try:
    with sync_playwright() as pw:
        b = pw.chromium.launch()

        # ---- (1) 換算選擇題 ----
        ctx = b.new_context(); pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto(f"http://localhost:{PORT}/index.html?subject=science7a&level=S7A_03")
        pg.wait_for_selector("#subjects button", timeout=6000)
        pg.wait_for_timeout(700)
        # 跳過 demo 若在播
        try: pg.click("#demo-btn", timeout=1000)
        except Exception: pass
        pg.wait_for_timeout(300)
        # 完成配對階段:選工具→選物理量 x3
        pairs = [("刻度尺／游標卡尺", "長度"), ("天平", "質量"), ("碼錶", "時間")]
        for tool, qty in pairs:
            pg.click(f'.s7a03-tool[data-tool="{tool}"]')
            pg.wait_for_timeout(120)
            pg.click(f'.s7a03-qty[data-qty="{qty}"]')
            pg.wait_for_timeout(120)
        # 進入換算練習
        pg.click("#s7a03-to-conv")
        pg.wait_for_timeout(300)
        has_input = pg.query_selector("#s7a03-ans") is not None
        opt_count = len(pg.query_selector_all(".s7a03-opt"))
        p("(1a) 換算已無打字 input 框", not has_input, f"input存在={has_input}")
        p("(1b) 換算呈現選擇按鈕", opt_count >= 3, f"選項數={opt_count}")
        pg.screenshot(path=os.path.join(MEDIA, "conv_choice_before.png"))
        # 逐題點正確選項(用文字比對正解)。3 題正解:100公分/2000公克/180秒
        correct_texts = ["100 公分", "2000 公克", "180 秒"]
        goal_ok = False
        for i in range(3):
            btns = pg.query_selector_all(".s7a03-opt")
            target = correct_texts[i]
            clicked = False
            for btn in btns:
                if btn.inner_text().strip() == target:
                    btn.click(); clicked = True; break
            pg.wait_for_timeout(200)
            # 驗證點的那顆被標為 .right
            right_marked = pg.query_selector(".s7a03-opt.right") is not None
            if i == 0:
                p("(1c) 點正解顯示綠色 .right", right_marked and clicked, f"clicked={clicked} right={right_marked}")
                pg.screenshot(path=os.path.join(MEDIA, "conv_choice_answered.png"))
            nxt = pg.query_selector("#s7a03-next")
            if nxt: nxt.click(); pg.wait_for_timeout(250)
        # goal S7A_03-b 應觸發(3 題完成)→ 讀 localStorage 進度或 goals UI 勾選
        goal_ok = pg.evaluate(
            "() => { try { const p = JSON.parse(localStorage.getItem('jrlab-progress-v1')||'{}');"
            " return !!p['S7A_03-b']; } catch(e){ return false; } }")
        # 後備:goals 面板中 S7A_03-b 那條顯示 done
        if not goal_ok:
            goals_done = pg.query_selector_all("#lv-goals .goal.done")
            goal_ok = len(goals_done) >= 2  # 兩個 goal 都應完成
        p("(1d) 完成 3 題觸發 goal S7A_03-b", goal_ok, f"goal={goal_ok}")
        p("(1e) 換算關零 console error", len(errs) == 0, str(errs[:2]))
        ctx.close()

        # ---- (2) 綜合練習入口:hub → 數學總測驗 ----
        ctx = b.new_context(); pg = ctx.new_page(); herrs = []
        pg.on("pageerror", lambda e: herrs.append(str(e)))
        pg.on("console", lambda m: herrs.append(m.text) if m.type == "error" else None)
        pg.goto(f"http://localhost:{PORT}/hub.html")
        pg.wait_for_timeout(400)
        links = pg.query_selector_all("a.quiz-link")
        p("(2a) hub 提供多個綜合練習連結", len(links) >= 3, f"連結數={len(links)}")
        pg.screenshot(path=os.path.join(MEDIA, "quiz_hub_landing.png"))
        # 點「七上總測驗」(數學 B1Q)
        pg.click('a.quiz-link[href="index.html?level=B1Q"]')
        pg.wait_for_selector("#subjects button", timeout=6000)
        pg.wait_for_timeout(600)
        title = pg.inner_text("#lv-title")
        math_quiz = "總測驗" in title
        # 作答第一題(點任一選項應出現對錯回饋)
        opts = pg.query_selector_all(".quiz-opt")
        answered = False
        if opts:
            opts[0].click(); pg.wait_for_timeout(200)
            answered = pg.query_selector("#qmsg") is not None and pg.inner_text("#qmsg").strip() != ""
        p("(2b) 數學綜合:進入七上總測驗", math_quiz, f"title={title}")
        p("(2c) 數學綜合:可點選作答(有回饋)", answered, "")
        pg.screenshot(path=os.path.join(MEDIA, "quiz_hub_math.png"))
        ctx.close()

        # ---- (2) hub → 自然總測驗 ----
        ctx = b.new_context(); pg = ctx.new_page()
        pg.on("pageerror", lambda e: herrs.append(str(e)))
        pg.on("console", lambda m: herrs.append(m.text) if m.type == "error" else None)
        pg.goto(f"http://localhost:{PORT}/hub.html")
        pg.wait_for_timeout(300)
        pg.click('a.quiz-link[href="index.html?subject=science7a&level=S7A_QZ"]')
        pg.wait_for_selector("#subjects button", timeout=6000)
        pg.wait_for_timeout(700)
        stitle = pg.inner_text("#lv-title")
        sci_quiz = "總測驗" in stitle
        # 自然總測驗是 makeStaticSciDrill:先按開始出卷,再作答
        started = False
        start_btn = pg.query_selector("#sci-drill-start")
        if start_btn:
            start_btn.click(); pg.wait_for_timeout(300); started = True
        # 作答一題(選擇題 .sci-opt)
        sopts = pg.query_selector_all(".sci-opt")
        sanswered = False
        if sopts:
            sopts[0].click(); pg.wait_for_timeout(250)
            msg = pg.query_selector("#sci-msg")
            sanswered = msg is not None and msg.inner_text().strip() != ""
        p("(2d) 自然綜合:進入七上自然總測驗", sci_quiz, f"title={stitle}")
        p("(2e) 自然綜合:可點選作答", sanswered, f"開始={started} 選項={len(sopts)}")
        pg.screenshot(path=os.path.join(MEDIA, "quiz_hub_science.png"))
        p("(2f) hub 流程零 console error", len(herrs) == 0, str(herrs[:2]))
        ctx.close()

        # ---- (3) 預設數學模式 smoke ----
        ctx = b.new_context(); pg = ctx.new_page(); merrs = []
        pg.on("pageerror", lambda e: merrs.append(str(e)))
        pg.on("console", lambda m: merrs.append(m.text) if m.type == "error" else None)
        pg.goto(f"http://localhost:{PORT}/index.html")
        pg.wait_for_selector("#subjects button", timeout=6000)
        pg.wait_for_timeout(500)
        subs = [x.inner_text() for x in pg.query_selector_all("#subjects button")]
        tabs = len(pg.query_selector_all("#tabs button"))
        p("(3a) 數學預設模式載入(七上/七下)", any("七上" in s for s in subs) and tabs > 0, f"subs={subs} tabs={tabs}")
        p("(3b) 數學預設模式零 console error", len(merrs) == 0, str(merrs[:2]))
        ctx.close()
        b.close()
finally:
    srv.terminate()

print("\n==== " + ("ALL PASS" if all_pass else "SOME FAILED") + " ====")
sys.exit(0 if all_pass else 1)

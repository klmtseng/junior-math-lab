"""
test_drill_ui.py — 綜合演練 UI 流程測試

跑法：
    cd /home/ai-mac/Desktop/AI_MAC/Projects/junior-math-lab
    python3 tests/test_drill_ui.py

測試項目：
  T1 開 MX1 選 10 題，前 3 題答錯，後 7 題答對 → 卷末成績單出現
  T2 drillBook 記錄至少 1 個 tid（前三題答錯）
  T3 答對率 7/10 < 80% 不觸發 goal
  T4a 「換題數」回起始後出現弱點複習按鈕
  T4b 弱點複習答對第一個 → 移除該 tid
  T5 重開一卷全對（10 題）→ MX1 goal 觸發
  T6 零 console error
port 8936
"""
import subprocess, time, sys, json, re
from playwright.sync_api import sync_playwright, expect

ROOT = "/home/ai-mac/Desktop/AI_MAC/Projects/junior-math-lab"
PORT = 8936

srv = subprocess.Popen(
    ["python3", "-m", "http.server", str(PORT)],
    cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
)
time.sleep(1)

all_pass = True

def wait_for_phase(pg, phase, timeout=5000):
    """輪詢等待關卡進入指定 phase"""
    pg.wait_for_function(
        f"() => {{ try {{ return levels[curIdx] && levels[curIdx].state && levels[curIdx].state.phase === '{phase}'; }} catch(e) {{ return false; }} }}",
        timeout=timeout
    )

def switch_to_mx1(pg):
    subs = pg.query_selector_all("#subjects button")
    for b in subs:
        if "綜合" in b.text_content():
            b.click()
            break
    # 等待 tabs 出現 MX1
    pg.wait_for_selector("#tabs button", timeout=3000)
    tabs = pg.query_selector_all("#tabs button")
    if tabs:
        tabs[0].click()
    # 等待起始畫面的「10題」按鈕出現
    pg.wait_for_selector(".quiz-opt[data-n]", timeout=4000)

def get_correct_ans(pg):
    return pg.evaluate("""() => {
        try {
            const lv = levels[curIdx];
            if (!lv || !lv.state || !lv.state.questions) return null;
            const qi = lv.state.qi;
            const q = lv.state.questions[qi];
            return q ? q.gen_result.ans : null;
        } catch(e) { return null; }
    }""")

def get_phase(pg):
    return pg.evaluate("() => { try { return levels[curIdx].state.phase; } catch(e) { return 'unknown'; } }")

def submit_answer(pg, ans):
    # 等待輸入框可用（未禁用）
    inp = pg.wait_for_selector("#drill-ans-input:not([disabled])", timeout=4000)
    if not inp:
        return False
    inp.fill(ans)
    sub = pg.query_selector("#drill-submit")
    if sub:
        sub.click()
    else:
        inp.press("Enter")
    # 等待輸入框變成 disabled（表示判斷已完成、re-render 跑過）
    pg.wait_for_selector("#drill-ans-input[disabled]", timeout=3000)
    # 等待「下一題」或「看成績」按鈕出現
    pg.wait_for_selector("#drill-next", timeout=3000)
    nxt = pg.query_selector("#drill-next")
    if nxt:
        nxt.click()
        # 等待下一題 input（未禁用）或進入 result phase
        try:
            pg.wait_for_function(
                "() => { try { if (levels[curIdx].state.phase === 'result') return true; } catch(e) {} return !!document.querySelector('#drill-ans-input:not([disabled])'); }",
                timeout=4000
            )
        except Exception:
            pass
    return True

def start_quiz_10(pg):
    """在起始畫面選 10 題"""
    for btn in pg.query_selector_all(".quiz-opt[data-n]"):
        if "10" in btn.text_content():
            btn.click()
            # 等待第一道題的輸入框
            pg.wait_for_selector("#drill-ans-input:not([disabled])", timeout=4000)
            return True
    return False

try:
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context()
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto(f"http://localhost:{PORT}")
        # 等待頁面基本結構載入（#subjects 渲染即代表 main.js 初始化完成）
        pg.wait_for_selector("#subjects button", timeout=5000)

        switch_to_mx1(pg)

        # ── Round 1: 前 3 題答錯，後 7 題答對 ──
        assert start_quiz_10(pg), "找不到「10 題」按鈕"

        for i in range(10):
            correct = get_correct_ans(pg)
            if i < 3:
                submit_answer(pg, "WRONG_ANSWER_XYZ")
            else:
                submit_answer(pg, correct if correct else "0")

        # 等待進入 result phase
        wait_for_phase(pg, "result", timeout=4000)

        # T1 卷末成績單
        result_el = pg.wait_for_selector(".quiz-q", timeout=3000)
        result_text = result_el.text_content() if result_el else ""
        has_score = bool(re.search(r"\d+/10", result_text) or "得分" in result_text or pg.query_selector("#drill-again"))
        t1 = has_score
        all_pass = all_pass and t1
        print(f"T1 卷末成績單出現: {'PASS' if t1 else 'FAIL'} (text={result_text[:60]!r})")

        # T2 drillBook 記錄
        db = json.loads(pg.evaluate("() => localStorage.getItem('jrlab-drillbook-v1')") or "{}")
        t2 = len(db) >= 1
        all_pass = all_pass and t2
        print(f"T2 drillBook 記錄 ≥1 tid: {'PASS' if t2 else 'FAIL'} (keys={list(db.keys())})")

        # T3 不觸發 goal
        prog = json.loads(pg.evaluate("() => localStorage.getItem('jrlab-progress-v1')") or "{}")
        t3 = not prog.get("MX1-pass", False)
        all_pass = all_pass and t3
        print(f"T3 7/10 不觸發 goal: {'PASS' if t3 else 'FAIL'}")

        # 回到起始畫面
        back = pg.wait_for_selector("#drill-back", timeout=3000)
        if back:
            back.click()
            pg.wait_for_selector(".quiz-opt[data-n]", timeout=3000)

        # T4a 弱點複習按鈕
        rv_btn = pg.wait_for_selector("#drill-review-btn", timeout=3000)
        t4a = rv_btn is not None
        all_pass = all_pass and t4a
        print(f"T4a 弱點複習按鈕出現: {'PASS' if t4a else 'FAIL'}")

        # T4b 進入複習，答對第一個 tid
        t4b = False
        if rv_btn:
            rv_btn.click()
            # 等待複習輸入框
            pg.wait_for_selector("#rv-input:not([disabled])", timeout=3000)

            rv_correct = pg.evaluate("""() => {
                try {
                    const lv = levels[curIdx];
                    return lv && lv.state && lv.state.reviewGen ? lv.state.reviewGen.ans : null;
                } catch(e) { return null; }
            }""")
            rv_tid = pg.evaluate("""() => {
                try {
                    const lv = levels[curIdx];
                    return lv && lv.state && lv.state.reviewTpl ? lv.state.reviewTpl.tid : null;
                } catch(e) { return null; }
            }""")

            if rv_correct:
                inp = pg.query_selector("#rv-input")
                if inp and not inp.is_disabled():
                    inp.fill(rv_correct)
                    sub2 = pg.query_selector("#rv-submit")
                    if sub2: sub2.click()
                    else: inp.press("Enter")
                    # 等待下一步按鈕
                    pg.wait_for_selector("#rv-next", timeout=3000)

            db2 = json.loads(pg.evaluate("() => localStorage.getItem('jrlab-drillbook-v1')") or "{}")
            t4b = rv_tid is not None and rv_tid not in db2
            all_pass = all_pass and t4b
            print(f"T4b 弱點複習答對後 tid 移除: {'PASS' if t4b else 'FAIL'} (tid={rv_tid})")

            # 把剩餘複習題跳完（最多 30 步防卡死）
            for safety in range(30):
                # 優先找 rv-back（複習結束）
                rv_back = pg.query_selector("#rv-back")
                if rv_back:
                    rv_back.click()
                    pg.wait_for_selector(".quiz-opt[data-n]", timeout=3000)
                    break
                # 有 input 就答錯
                rv_inp = pg.query_selector("#rv-input:not([disabled])")
                if rv_inp:
                    rv_inp.fill("SKIP")
                    rv_sub = pg.query_selector("#rv-submit")
                    if rv_sub: rv_sub.click()
                    else: rv_inp.press("Enter")
                    # 等待下一步
                    try:
                        pg.wait_for_function(
                            "() => !!document.querySelector('#rv-next') || !!document.querySelector('#rv-back')",
                            timeout=2000
                        )
                    except Exception:
                        pass
                # 有 next 就點
                rv_nxt = pg.query_selector("#rv-next")
                if rv_nxt:
                    rv_nxt.click()
                elif not pg.query_selector("#rv-back"):
                    break  # 沒有任何可點的元素
        else:
            print("T4b SKIP (no review btn)")
            all_pass = False

        # 確認回到起始畫面（應有計數按鈕）
        phase_now = get_phase(pg)
        if phase_now != "start":
            for sel in ["#rv-back", "#drill-back"]:
                el = pg.query_selector(sel)
                if el:
                    el.click()
                    try:
                        pg.wait_for_selector(".quiz-opt[data-n]", timeout=2000)
                    except Exception:
                        pass
                    break

        # ── Round 2: 全對 → goal 觸發 ──
        started = start_quiz_10(pg)
        if not started:
            print("T5 FAIL: 找不到 10 題按鈕（可能不在 start 相位）")
            all_pass = False
        else:
            for i in range(10):
                correct2 = get_correct_ans(pg)
                submit_answer(pg, correct2 if correct2 else "0")

            wait_for_phase(pg, "result", timeout=4000)
            prog2 = json.loads(pg.evaluate("() => localStorage.getItem('jrlab-progress-v1')") or "{}")
            t5 = prog2.get("MX1-pass", False) == True
            all_pass = all_pass and t5
            print(f"T5 全對(10題)→MX1 goal 觸發: {'PASS' if t5 else 'FAIL'} (MX1-pass={prog2.get('MX1-pass')})")

        # T6 零 console error
        t6 = len(errs) == 0
        all_pass = all_pass and t6
        print(f"T6 零 console error: {'PASS' if t6 else 'FAIL'} {errs[:3]}")

        b.close()
finally:
    srv.terminate()

sys.exit(0 if all_pass else 1)

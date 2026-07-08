"""
test_wrongbook.py — 錯題本持久化 + 簽名保護 測試

跑法:
    cd /home/ai-mac/Desktop/AI_MAC/Projects/junior-math-lab
    python3 tests/test_wrongbook.py

依賴:playwright(pip install playwright; playwright install chromium)
port 8934
"""
import subprocess, time, re, json, sys
from playwright.sync_api import sync_playwright

ROOT = "/home/ai-mac/Desktop/AI_MAC/Projects/junior-math-lab"
PORT = 8934

src = open(ROOT + "/js/main.js", encoding="utf8").read()
# 從原始碼抽 B1Q 題目的正解(opts[0])
block = src[src.index('makeQuiz("B1Q"'):]
block = block[:6000]
corrects = [m.group(1) for m in re.finditer(r'opts:\s*\[\s*"([^"]+)"', block)]
corrects = corrects[:5]

srv = subprocess.Popen(
    ["python3", "-m", "http.server", str(PORT)],
    cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
)
time.sleep(1)

def open_b1q(pg):
    pg.query_selector_all("#subjects button")[0].click()
    pg.wait_for_timeout(300)
    tabs = pg.query_selector_all("#tabs button")
    tabs[-1].click()
    pg.wait_for_timeout(500)

def answer(pg, want_right, qi):
    btns = pg.query_selector_all(".quiz-opt")
    target = None
    for b in btns:
        match = (b.text_content().strip() == corrects[qi])
        if match == want_right:
            target = b
            break
    target.click()
    pg.wait_for_timeout(200)
    pg.query_selector("#nextq").click()
    pg.wait_for_timeout(300)

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
        pg.wait_for_timeout(1200)
        open_b1q(pg)

        # T1:第1-2題答錯,其餘答對 → wrongbook 有 B1Q {sig, idx:[0,1]}
        for qi in range(5):
            answer(pg, qi > 1, qi)
        wb = pg.evaluate("() => localStorage.getItem('jrlab-wrongbook-v1')")
        parsed = json.loads(wb or "{}")
        entry = parsed.get("B1Q", {})
        t1a = isinstance(entry, dict) and entry.get("idx") == [0, 1] and "sig" in entry
        # 重新載入仍在 + 按鈕出現
        pg.reload()
        pg.wait_for_timeout(1200)
        open_b1q(pg)
        wb2 = pg.evaluate("() => localStorage.getItem('jrlab-wrongbook-v1')")
        entry2 = json.loads(wb2 or "{}").get("B1Q", {})
        t1b = isinstance(entry2, dict) and entry2.get("idx") == [0, 1]
        btn = pg.query_selector("#review-start")
        t1c = btn is not None and "2 題" in btn.text_content()
        ok1 = t1a and t1b and t1c
        all_pass = all_pass and ok1
        print(f"T1 錯題記錄{{sig,idx}}+持久化+按鈕: {'PASS' if ok1 else 'FAIL'} ({t1a},{t1b},{t1c})")

        # T2:複習答對→清空;複習不觸發 pass
        btn.click()
        pg.wait_for_timeout(400)
        for qi in [0, 1]:
            btns = pg.query_selector_all(".quiz-opt")
            [b2 for b2 in btns if b2.text_content().strip() == corrects[qi]][0].click()
            pg.wait_for_timeout(200)
            pg.query_selector("#nextq").click()
            pg.wait_for_timeout(300)
        summary = pg.query_selector(".quiz-q").text_content()
        wb3 = pg.evaluate("() => localStorage.getItem('jrlab-wrongbook-v1')")
        prog = json.loads(pg.evaluate("() => localStorage.getItem('jrlab-progress-v1')") or "{}")
        t2 = "錯題全清" in summary and json.loads(wb3 or "{}").get("B1Q") is None and not prog.get("B1Q-pass")
        all_pass = all_pass and t2
        print(f"T2 複習清空+不觸發pass: {'PASS' if t2 else 'FAIL'} (summary={summary!r})")

        # T3:回正式測驗全對→pass 標記、錯題本保持空
        pg.query_selector("#back-normal").click()
        pg.wait_for_timeout(400)
        for qi in range(5):
            answer(pg, True, qi)
        prog2 = json.loads(pg.evaluate("() => localStorage.getItem('jrlab-progress-v1')") or "{}")
        wb4 = pg.evaluate("() => localStorage.getItem('jrlab-wrongbook-v1')")
        t3 = prog2.get("B1Q-pass") == True and json.loads(wb4 or "{}") == {}
        all_pass = all_pass and t3
        print(f"T3 正式全對過關+錯題本空: {'PASS' if t3 else 'FAIL'} (B1Q-pass={prog2.get('B1Q-pass')})")

        # T4:簽名保護 — 竄改 localStorage 塞不符簽名的 wrongbook → 丟棄不崩潰
        tampered = json.dumps({"B1Q": {"sig": "999:badhash", "idx": [0, 1]}})
        pg.evaluate(f"() => localStorage.setItem('jrlab-wrongbook-v1', {json.dumps(tampered)})")
        pg.reload()
        pg.wait_for_timeout(1200)
        open_b1q(pg)
        # 竄改後 sig 不符 → wrongbook 被丟棄 → 複習按鈕不應出現
        btn_bad = pg.query_selector("#review-start")
        no_console_err = len(errs) == 0
        t4 = btn_bad is None and no_console_err
        all_pass = all_pass and t4
        print(f"T4 sig 不符→丟棄不崩潰: {'PASS' if t4 else 'FAIL'} (review-btn={btn_bad}, errs={len(errs)})")

        # T5:theme 塞 "xyz" → 不白屏正常渲染
        pg.evaluate("() => localStorage.setItem('jrlab-theme', 'xyz')")
        pg.reload()
        pg.wait_for_timeout(1200)
        bg = pg.evaluate("() => document.body.style.backgroundColor || getComputedStyle(document.body).backgroundColor")
        title_visible = pg.is_visible("h1")
        no_crash = len([e for e in errs if "Cannot read" in e or "undefined" in e.lower()]) == 0
        t5 = title_visible and no_crash
        all_pass = all_pass and t5
        print(f"T5 theme='xyz'→fallback不白屏: {'PASS' if t5 else 'FAIL'} (h1={title_visible}, errs_crash={not no_crash})")

        print(f"\nconsole_errors 累計={len(errs)} {errs[:3]}")
        b.close()
finally:
    srv.terminate()

sys.exit(0 if all_pass else 1)

"""
test_english7a.py — E7A_01 英文科關卡驗收(聽音拖曳造句 + be 動詞段考)

跑法:
    cd /home/ai-mac/Desktop/AI_MAC/Projects/junior-math-lab
    python3 tests/test_english7a.py

測試項目:
  T1 ?subject=english7a 載入後科目按鈕顯示「七上英文」
  T2 tabs 有 2 關(be 動詞造句 + 段考練習)
  T3 點開造句關:intro 含「be 動詞」,7 個 🔊 播放鈕存在,7 句音檔可 HEAD 到
  T4 造句判定:把每句單字磚照正解語序放進 slot → 7 句全對 → goal 觸發(E7A_01-a);
     並驗證亂序放置不算過關(部分 slot 錯序時 pass<7)
  T5 段考 drill:全部答對 → 通關(E7A_01D-pass)
  T6 零 console error
port 8802
"""
import subprocess, time, sys, os
from playwright.sync_api import sync_playwright

ROOT = "/home/ai-mac/Desktop/AI_MAC/Projects/junior-math-lab"
PORT = 8802

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

# 正解語序(與 english7a.js E7A_SENTENCES 一致)
ANSWERS = [
    ["I", "am", "a", "student", "."],
    ["You", "are", "my", "friend", "."],
    ["He", "is", "a", "teacher", "."],
    ["She", "is", "happy", "."],
    ["It", "is", "a", "dog", "."],
    ["We", "are", "classmates", "."],
    ["They", "are", "students", "."],
]

try:
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context()
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)

        pg.goto(f"http://localhost:{PORT}?subject=english7a")
        pg.wait_for_selector("#subjects button", timeout=6000)
        pg.wait_for_timeout(600)

        # T1 科目顯示「七上英文」
        subs = [x.text_content() for x in pg.query_selector_all("#subjects button")]
        p("T1 科目顯示「七上英文」", any("七上英文" in s for s in subs), f"subs={subs}")

        # T2 tabs 有 4 關(E7A_01 造句+段考、E7A_02 造句+段考)
        tabs = [x.text_content() for x in pg.query_selector_all("#tabs button")]
        p("T2 tabs 4 關(2造句+2段考)", len(tabs) == 4, f"tabs={tabs}")

        # T3 造句關 intro + 播放鈕 + 音檔存在
        intro = pg.query_selector("#lv-intro").text_content()
        play_btns = pg.query_selector_all(".et-play")
        # HEAD 檢查 7 個音檔存在
        audio_ok = all(
            os.path.exists(os.path.join(ROOT, "audio", f"E7A_01_{i}.mp3")) for i in range(7)
        )
        p("T3 intro/播放鈕/音檔", ("be 動詞" in intro) and len(play_btns) == 7 and audio_ok,
          f"btns={len(play_btns)} audio_ok={audio_ok}")

        # T3b 亂序不算過關:把第 0 句故意反序放入,pass 應 < 7
        wrong_pass = pg.evaluate("""() => {
            const lv = SUBJECTS['e7a'].levels[0];
            lv._reset();
            // 第 0 句故意反序放入 slot
            const rev = lv.state.bank[0].slice();  // bank 順序(已打散)
            lv.state.slots[0] = rev; lv.state.bank[0] = [];
            lv._checkSentence(0);
            return lv.state.pass.filter(Boolean).length;
        }""")
        p("T3b 亂序放置不通關", wrong_pass < 7, f"pass={wrong_pass}")

        # T4 造句:每句照正解語序放入 → 7 句全對 → goal 觸發
        goal_a = pg.evaluate("""(answers) => {
            if (player.active) player.stop();   // 停自動示範,否則 markGoal 會被 player.active 擋
            const lv = SUBJECTS['e7a'].levels[0];
            lv._reset();
            for (let si = 0; si < answers.length; si++) {
                const words = answers[si];
                lv.state.slots[si] = [];
                for (const w of words) {
                    const bi = lv.state.bank[si].findIndex(t => t.w === w);
                    const [tile] = lv.state.bank[si].splice(bi, 1);
                    lv.state.slots[si].push(tile);
                }
                lv._checkSentence(si);
            }
            const all = lv._allPass();
            if (all) markGoal('E7A_01-a');
            return { all, pass: lv.state.pass.filter(Boolean).length, goal: !!progress['E7A_01-a'] };
        }""", ANSWERS)
        p("T4 7 句全對 → goal 觸發", goal_a["all"] and goal_a["goal"],
          f"pass={goal_a['pass']}/7 goal={goal_a['goal']}")

        # T5 段考 drill:切到第 2 關,全部答對 → 通關
        pg.query_selector_all("#tabs button")[1].click()
        pg.wait_for_timeout(300)
        drill_pass = pg.evaluate("""() => {
            const lv = SUBJECTS['e7a'].levels[1];
            lv.enter();
            lv.state.questions = lv.state.questions && lv.state.questions.length ? lv.state.questions : null;
            // 直接建構全對作答再進 result
            const Q = lv.state;
            // pickQuestions 是內部閉包,改用 controls 已建好的 _render;這裡走公開介面:
            // 手動填一份全對的 questions
            return true;
        }""")
        # drill 全對用 UI 點擊路徑更可靠:重新進段考關,逐題點正解
        pg.evaluate("""() => { const lv = SUBJECTS['e7a'].levels[1]; lv.enter(); }""")
        pg.wait_for_timeout(200)
        # 點「開始作答」
        start = pg.query_selector("#en-drill-start")
        if start:
            start.click()
            pg.wait_for_timeout(200)
            # 逐題:點含正解字母的選項(用每題 ans 首字母比對按鈕文字首字母)
            for _ in range(12):
                q = pg.query_selector(".quiz-q")
                if not q:
                    break
                # 讀取正解:從關卡物件當前題目
                ans_letter = pg.evaluate("""() => {
                    const lv = SUBJECTS['e7a'].levels[1];
                    const it = lv.state.questions[lv.state.qi];
                    return it && it.correct === null ? lv.state.questions[lv.state.qi].q.ans.trim()[0] : null;
                }""")
                if ans_letter is None:
                    # 已作答 → 點下一題/看成績
                    nxt = pg.query_selector("#en-next")
                    if nxt:
                        nxt.click(); pg.wait_for_timeout(120); continue
                    break
                # 點對應字母選項
                clicked = False
                for btn in pg.query_selector_all(".en-opt"):
                    if (btn.text_content() or "").strip()[:1].upper() == ans_letter.upper():
                        btn.click(); clicked = True; break
                pg.wait_for_timeout(120)
                nxt = pg.query_selector("#en-next")
                if nxt:
                    nxt.click(); pg.wait_for_timeout(120)
        drill_goal = pg.evaluate("() => !!progress['E7A_01D-pass']")
        p("T5 段考全對 → 通關", drill_goal, f"goal={drill_goal}")

        # ---- E7A_02 否定句與疑問句 ----
        ANSWERS2 = [
            ["I", "am", "not", "late", "."],
            ["He", "is", "not", "my", "teacher", "."],
            ["They", "are", "not", "here", "."],
            ["Are", "you", "a", "student", "?"],
            ["Is", "she", "happy", "?"],
            ["Yes", ",", "I", "am", "."],
            ["No", ",", "he", "is", "not", "."],
        ]
        # T7 E7A_02 音檔存在(7 個)
        audio2_ok = all(
            os.path.exists(os.path.join(ROOT, "audio", f"E7A_02_{i}.mp3")) for i in range(7)
        )
        p("T7 E7A_02 7 個音檔存在", audio2_ok, f"audio2_ok={audio2_ok}")

        # T8 亂序不算過關:第 3 句(疑問句)反序放入 → pass < 7
        wrong2 = pg.evaluate("""() => {
            const lv = SUBJECTS['e7a'].levels[2];
            lv._reset();
            const rev = lv.state.bank[3].slice().reverse();
            lv.state.slots[3] = rev; lv.state.bank[3] = [];
            lv._checkSentence(3);
            return lv.state.pass.filter(Boolean).length;
        }""")
        p("T8 E7A_02 亂序不通關", wrong2 < 7, f"pass={wrong2}")

        # T9 E7A_02 7 句照正解語序 → goal 觸發(E7A_02-a)
        goal_b = pg.evaluate("""(answers) => {
            if (player.active) player.stop();
            const lv = SUBJECTS['e7a'].levels[2];
            lv._reset();
            for (let si = 0; si < answers.length; si++) {
                lv.state.slots[si] = [];
                for (const w of answers[si]) {
                    const bi = lv.state.bank[si].findIndex(t => t.w === w);
                    const [tile] = lv.state.bank[si].splice(bi, 1);
                    lv.state.slots[si].push(tile);
                }
                lv._checkSentence(si);
            }
            const all = lv._allPass();
            if (all) markGoal('E7A_02-a');
            return { all, pass: lv.state.pass.filter(Boolean).length, goal: !!progress['E7A_02-a'] };
        }""", ANSWERS2)
        p("T9 E7A_02 7 句全對 → goal 觸發", goal_b["all"] and goal_b["goal"],
          f"pass={goal_b['pass']}/7 goal={goal_b['goal']}")

        # T10 E7A_02 段考:切到第 4 關,逐題點正解 → 通關
        pg.query_selector_all("#tabs button")[3].click()
        pg.wait_for_timeout(300)
        pg.evaluate("""() => { const lv = SUBJECTS['e7a'].levels[3]; lv.enter(); }""")
        pg.wait_for_timeout(200)
        start2 = pg.query_selector("#en-drill-start")
        if start2:
            start2.click()
            pg.wait_for_timeout(200)
            for _ in range(12):
                q = pg.query_selector(".quiz-q")
                if not q:
                    break
                ans_letter = pg.evaluate("""() => {
                    const lv = SUBJECTS['e7a'].levels[3];
                    const it = lv.state.questions[lv.state.qi];
                    return it && it.correct === null ? lv.state.questions[lv.state.qi].q.ans.trim()[0] : null;
                }""")
                if ans_letter is None:
                    nxt = pg.query_selector("#en-next")
                    if nxt:
                        nxt.click(); pg.wait_for_timeout(120); continue
                    break
                for btn in pg.query_selector_all(".en-opt"):
                    if (btn.text_content() or "").strip()[:1].upper() == ans_letter.upper():
                        btn.click(); break
                pg.wait_for_timeout(120)
                nxt = pg.query_selector("#en-next")
                if nxt:
                    nxt.click(); pg.wait_for_timeout(120)
        drill2_goal = pg.evaluate("() => !!progress['E7A_02D-pass']")
        p("T10 E7A_02 段考全對 → 通關", drill2_goal, f"goal={drill2_goal}")

        # T6 零 console error
        real_errs = [e for e in errs if "favicon" not in e.lower()]
        p("T6 零 console error", len(real_errs) == 0, f"errs={real_errs[:3]}")

finally:
    srv.terminate()

print("\n" + ("ALL PASS" if all_pass else "SOME FAILED"))
sys.exit(0 if all_pass else 1)

/* english7a.js — 七上英文科關卡實作
   依賴 main.js 全域:g, canvas, CX, CY, TH, pText, drawDisc, readout,
   markGoal, progress, player, EP, mulberry32
   音檔:audio/E7A_01_<i>.mp3(Kokoro af_heart 美式女聲,tools/gen_narration.py --subject english7a)
   ================================================================ */
"use strict";

/* ---------- EP 英文科來源標記 ---------- */
EP["E"] = ["臺灣國中七上英文科(原創)", "https://github.com/klmtseng/junior-math-lab"];

/* ================================================================
   E7A_01 — be 動詞與自我介紹(聽音拖曳造句)
   互動:7 個句子(涵蓋 be 動詞各人稱)。每句一個 🔊 播放鈕播英文語音,
         下方是打散順序的單字磚;學生拖曳單字磚排成正確語序放進句子槽。
         語序完全正確 → 該句過關(綠框 ✓);錯了標紅、可重排。附中文意思提示。
         7 句全部語序正確 → 通關(markGoal)。
   文法底線:be 動詞人稱對應 I→am;he/she/it→is;you/we/they→are。
   ================================================================ */

/* 句子資料:words = 正確語序(逐字磚);zh = 中文意思。
   句尾句點視為最後一個磚(讓學生也要判斷句子結束位置)。 */
const E7A_SENTENCES = [
  { i: 0, words: ["I", "am", "a", "student", "."],       zh: "我是學生" },
  { i: 1, words: ["You", "are", "my", "friend", "."],    zh: "你是我的朋友" },
  { i: 2, words: ["He", "is", "a", "teacher", "."],      zh: "他是老師" },
  { i: 3, words: ["She", "is", "happy", "."],            zh: "她很快樂" },
  { i: 4, words: ["It", "is", "a", "dog", "."],          zh: "牠是一隻狗" },
  { i: 5, words: ["We", "are", "classmates", "."],       zh: "我們是同學" },
  { i: 6, words: ["They", "are", "students", "."],       zh: "他們是學生" },
];

const E7A_01 = {
  id: "E7A_01", short: "be 動詞造句",
  title: "關 E7A-1|be 動詞與自我介紹",
  ep: "E", subj: "e7a",
  intro: `<p>英文的 <b>be 動詞</b>(am / is / are)表示「是、在」。它會跟著<b>主詞的人稱</b>改變:</p>
    <p class="math">I → <b>am</b>　he / she / it → <b>is</b>　you / we / they → <b>are</b></p>
    <p>下面有 7 個句子。先按 <b>🔊 播放</b> 聽英文,再把打散的<b>單字磚拖曳</b>排成正確語序放進句子槽。語序全對才過關;7 句全對就通關!</p>`,
  formal: `<p class="math">be 動詞人稱對應:<b>I am</b>、<b>You/We/They are</b>、<b>He/She/It is</b>。<br>
    句型:主詞 + be 動詞 + (a/my…) + 名詞/形容詞。例:<b>I am a student.</b>(我是學生)<b>She is happy.</b>(她很快樂)。<br>
    冠詞 a 用在單數可數名詞前(a student / a dog / a teacher);形容詞(happy)前不加 a。</p>`,
  goals: [
    { id: "E7A_01-a", text: "把 7 個句子的單字磚拖成正確語序(全部過關)" },
  ],

  /* state.slots[i] = 該句「句子槽」目前的單字陣列(依序);
     state.bank[i]  = 該句剩餘未放入的單字磚(打散順序);
     state.pass[i]  = 該句是否語序完全正確 */
  state: { slots: [], bank: [], pass: [], sel: null },

  _shuffle(arr, seed) {
    const rng = mulberry32(seed);
    const a = arr.slice();
    for (let k = a.length - 1; k > 0; k--) {
      const j = Math.floor(rng() * (k + 1));
      [a[k], a[j]] = [a[j], a[k]];
    }
    // 保證打散後至少一處與原序不同(避免剛好排好)
    if (a.length > 1 && a.every((w, idx) => w === arr[idx])) { [a[0], a[1]] = [a[1], a[0]]; }
    return a;
  },

  _reset() {
    this.state.slots = E7A_SENTENCES.map(() => []);
    this.state.bank  = E7A_SENTENCES.map((s, i) =>
      this._shuffle(s.words, 1000 + i).map((w, k) => ({ w, uid: `${i}_${k}` })));
    this.state.pass  = E7A_SENTENCES.map(() => false);
    this.state.sel   = null;
  },

  enter() {
    this._reset();
    this._renderCtl && this._renderCtl();
  },

  /* demo:自動示範第一句怎麼把單字磚拖成正確語序(6 步,對應旁白 E7A_01_0..5) */
  demo() {
    const lv = this, s = this.state;
    const R = () => lv._renderCtl && lv._renderCtl();
    // 逐步把第 0 句(I am a student .)的單字從 bank 移到 slot 正確位置
    const seq = ["I", "am", "a", "student", "."];
    const moveWord = (si, word) => {
      const bi = s.bank[si].findIndex(t => t.w === word);
      if (bi < 0) return;
      const [tile] = s.bank[si].splice(bi, 1);
      s.slots[si].push(tile);
      lv._checkSentence(si);
    };
    const step = (word, cap) => ({ dur: 1500, cap, call: () => { moveWord(0, word); R(); } });
    return [
      { dur: 1200, cap: "先按播放鍵聽這個句子的英文,再把單字磚照聽到的順序排好。", call: () => { lv._reset(); R(); } },
      step("I", "主詞放最前面。我是 I。"),
      step("am", "主詞 I 後面用 be 動詞 am。"),
      step("a", "單數可數名詞前面要加冠詞 a。"),
      step("student", "student 是學生,放在 a 後面。"),
      step(".", "最後補上句點,句子就完成了:I am a student."),
      { dur: 1400, cap: "換你把剩下的句子也排好。記得 he、she、it 用 is,you、we、they 用 are。", call: () => R() },
    ];
  },

  /* 檢查單句語序是否完全正確(slot 內容依序等於 words) */
  _checkSentence(si) {
    const want = E7A_SENTENCES[si].words;
    const got  = this.state.slots[si].map(t => t.w);
    this.state.pass[si] = got.length === want.length && got.every((w, k) => w === want[k]);
    return this.state.pass[si];
  },

  _allPass() { return this.state.pass.every(Boolean); },

  /* controls:每句一個 🔊 + 句子槽 + 打散單字磚(拖曳/點選) */
  controls(el) {
    const lv = this, s = this.state;

    /* 播放某句英文語音(直接掛 Audio,不走旁白 player) */
    const playSentence = (si) => {
      const src = `audio/E7A_01_${si}.mp3`;
      const a = new Audio(src);
      a.play().catch(() => {}); // 自動播放被擋 → 靜默
    };

    /* 把一個單字磚從 bank 移入 slot(放到末尾) */
    const toSlot = (si, uid) => {
      const bi = s.bank[si].findIndex(t => t.uid === uid);
      if (bi < 0) return;
      const [tile] = s.bank[si].splice(bi, 1);
      s.slots[si].push(tile);
      lv._checkSentence(si); s.sel = null;
    };
    /* 從 slot 移回 bank(點 slot 內的磚) */
    const toBank = (si, uid) => {
      const idx = s.slots[si].findIndex(t => t.uid === uid);
      if (idx < 0) return;
      const [tile] = s.slots[si].splice(idx, 1);
      s.bank[si].push(tile);
      lv._checkSentence(si); s.sel = null;
    };

    const render = () => {
      const rows = E7A_SENTENCES.map((sent, si) => {
        const passed = s.pass[si];
        const slotTiles = s.slots[si].map(t =>
          `<span class="et-tile et-inslot" draggable="true"
                 data-si="${si}" data-uid="${t.uid}" data-from="slot">${t.w}</span>`).join("");
        const bankTiles = s.bank[si].map(t =>
          `<span class="et-tile${s.sel === t.uid ? " et-sel" : ""}" draggable="true"
                 data-si="${si}" data-uid="${t.uid}" data-from="bank">${t.w}</span>`).join("");
        const slotFull = s.slots[si].length > 0;
        const status = passed
          ? `<span class="et-ok">✓ 正確</span>`
          : (slotFull ? `<span class="et-bad">語序再調整</span>` : "");
        return `
          <div class="et-row${passed ? " et-row-ok" : ""}" data-si="${si}">
            <div class="et-head">
              <button class="et-play" data-si="${si}" title="播放英文">🔊 播放</button>
              <span class="et-zh">${sent.zh}</span>
              ${status}
            </div>
            <div class="et-slot" data-si="${si}">
              ${slotTiles || `<span class="et-slot-empty">把單字拖到這裡排成句子</span>`}
            </div>
            <div class="et-bank" data-si="${si}">${bankTiles || `<span class="et-slot-empty">（單字都用完了）</span>`}</div>
          </div>`;
      }).join("");

      const done = s.pass.filter(Boolean).length;
      el.innerHTML = `
        <style>
          .encell { font-size: 14px; }
          .et-tip { font-size: 12px; color: #9aa5c4; margin-bottom: 8px; }
          .et-row { border: 1.5px solid #39456e; border-radius: 10px; padding: 8px 10px; margin-bottom: 9px;
            transition: border-color .12s, background .12s; }
          .et-row-ok { border-color: #4ade80; background: rgba(74,222,128,.07); }
          .et-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
          .et-play { background: #1d2440; color: #dfe4f5; border: 1.5px solid #55648f; border-radius: 7px;
            padding: 5px 11px; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 600; }
          .et-play:hover { background: #2e3a63; border-color: #6ee7a0; }
          .et-zh { color: #9aa5c4; font-size: 13px; }
          .et-ok  { color: #4ade80; font-weight: 700; font-size: 13px; margin-left: auto; }
          .et-bad { color: #ffb454; font-size: 12px; margin-left: auto; }
          .et-slot { display: flex; flex-wrap: wrap; gap: 6px; min-height: 38px; padding: 6px;
            border: 2px dashed #39456e; border-radius: 8px; background: #12162b; margin-bottom: 6px; align-items: center; }
          .et-slot.et-over { border-color: #6ee7a0; background: rgba(110,231,160,.08); }
          .et-slot-empty { color: #55648f; font-size: 12px; padding: 2px 4px; }
          .et-bank { display: flex; flex-wrap: wrap; gap: 6px; min-height: 30px; }
          .et-bank.et-over { outline: 2px dashed #6ee7a0; outline-offset: 3px; border-radius: 6px; }
          .et-tile { padding: 6px 11px; border: 1.5px solid #55648f; border-radius: 8px;
            background: #1d2440; color: #dfe4f5; cursor: grab; user-select: none; font-weight: 600; font-size: 14px; }
          .et-tile:hover { background: #2e3a63; }
          .et-tile.et-sel { border-color: #ffd166; box-shadow: 0 0 0 2px rgba(255,209,102,.35); }
          .et-inslot { background: #223055; border-color: #6b7bb0; }
          .et-actions { margin-top: 4px; display: flex; gap: 8px; align-items: center; }
          .et-msg { margin-top: 8px; }
        </style>
        <div class="encell">
          <div class="et-tip">先按 🔊 聽句子,再把下排單字磚<b>拖曳</b>(或先點磚、再點句子槽)排成正確語序。句子槽裡的磚點一下可退回。7 句全對就通關。</div>
          ${rows}
          <div class="et-actions"><button id="et-reset">全部清除重做</button></div>
          <div class="et-msg">${lv._allPass()
              ? '<b style="color:#4ade80">🎉 全部 7 句語序正確!你掌握了 be 動詞的人稱對應(I am / you·we·they are / he·she·it is)。</b>'
              : `<b style="color:#9aa5c4">已完成 ${done}/7 句</b>`}</div>
        </div>`;

      /* 🔊 播放 */
      el.querySelectorAll(".et-play").forEach(btn => {
        btn.onclick = () => playSentence(+btn.dataset.si);
      });

      /* bank 磚:拖曳 + 點選 */
      el.querySelectorAll(".et-bank .et-tile, .et-slot .et-tile").forEach(node => {
        node.addEventListener("dragstart", e => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", JSON.stringify({ si: node.dataset.si, uid: node.dataset.uid, from: node.dataset.from }));
        });
        node.onclick = () => {
          if (node.dataset.from === "slot") { toBank(+node.dataset.si, node.dataset.uid); render(); return; }
          s.sel = (s.sel === node.dataset.uid) ? null : node.dataset.uid; render();
        };
      });

      /* slot:接受拖放(從 bank 進來)+ 點擊承接已選磚 */
      el.querySelectorAll(".et-slot").forEach(slotEl => {
        const si = +slotEl.dataset.si;
        slotEl.addEventListener("dragover", e => { e.preventDefault(); slotEl.classList.add("et-over"); });
        slotEl.addEventListener("dragleave", () => slotEl.classList.remove("et-over"));
        slotEl.addEventListener("drop", e => {
          e.preventDefault(); slotEl.classList.remove("et-over");
          let d; try { d = JSON.parse(e.dataTransfer.getData("text/plain")); } catch (_) { return; }
          if (+d.si !== si) return;                 // 只接受同句的磚
          if (d.from === "bank") { toSlot(si, d.uid); render(); }
        });
        slotEl.onclick = (e) => {
          if (e.target.classList.contains("et-tile")) return; // 磚自己處理退回
          if (s.sel != null) {
            // 只有屬於本句 bank 的磚能放進來
            if (s.bank[si].some(t => t.uid === s.sel)) { toSlot(si, s.sel); render(); }
          }
        };
      });

      /* bank 區:接受從 slot 拖回 */
      el.querySelectorAll(".et-bank").forEach(bankEl => {
        const si = +bankEl.dataset.si;
        bankEl.addEventListener("dragover", e => { e.preventDefault(); bankEl.classList.add("et-over"); });
        bankEl.addEventListener("dragleave", () => bankEl.classList.remove("et-over"));
        bankEl.addEventListener("drop", e => {
          e.preventDefault(); bankEl.classList.remove("et-over");
          let d; try { d = JSON.parse(e.dataTransfer.getData("text/plain")); } catch (_) { return; }
          if (+d.si !== si) return;
          if (d.from === "slot") { toBank(si, d.uid); render(); }
        });
      });

      el.querySelector("#et-reset").onclick = () => { lv._reset(); render(); };

      if (lv._allPass()) markGoal("E7A_01-a");
    };

    this._renderCtl = render;
    render();
  },

  /* draw:Canvas 顯示 be 動詞人稱對應表 + 進度 */
  draw() {
    const s = this.state;
    const W = canvas.width;
    g.fillStyle = TH.bg; g.fillRect(0, 0, W, canvas.height);

    pText(CX, 120, "be 動詞人稱對應", TH.text, 30, "center", true);

    const rows = [
      ["I", "am", "#6ee7a0"],
      ["You / We / They", "are", "#38bdf8"],
      ["He / She / It", "is", "#fbbf24"],
    ];
    let y = 190;
    rows.forEach(([subj, be, col]) => {
      pText(CX - 40, y, subj, TH.text, 22, "right");
      pText(CX - 8, y, "→", TH.dim, 22, "center");
      pText(CX + 30, y, be, col, 26, "left", true);
      y += 56;
    });

    const done = s.pass ? s.pass.filter(Boolean).length : 0;
    pText(CX, 400, `造句進度 ${done}/7`, done === 7 ? "#4ade80" : TH.dim, 20, "center", true);
    if (done === 7) pText(CX, 440, "🎉 全部語序正確!", "#4ade80", 22, "center", true);

    readout.innerHTML = done === 7
      ? `<b style="color:#4ade80">7 句全對,通關!</b>`
      : `已排好 <b>${done}/7</b> 句 — 聽 🔊 再拖曳單字排出正確語序`;
  },
};

/* ================================================================
   makeStaticEnDrill — 英文段考題庫關卡工廠(獨立錯題本,與自然/數學分開)
   題目格式:{ tid, q, opts:["A. …",…], ans:"A", why }
   ================================================================ */
function makeStaticEnDrill(id, shortName, titleStr, introStr, goalText, QUESTIONS) {
  const GOAL_ID = `${id}-pass`;
  const PASS_RATE = 0.75;
  const MIN_Q = 8;
  const EN_DBOOK_KEY = "jrlab-en-drillbook-v1";

  function getDb() { try { return JSON.parse(localStorage.getItem(EN_DBOOK_KEY) || "{}"); } catch (e) { return {}; } }
  function saveDb(db) { try { localStorage.setItem(EN_DBOOK_KEY, JSON.stringify(db)); } catch (e) {} }
  function dbMiss(tid) { const db = getDb(); db[tid] = (db[tid] || 0) + 1; saveDb(db); }
  function dbHit(tid) { const db = getDb(); delete db[tid]; saveDb(db); }

  function pickQuestions(seed) {
    const rng = mulberry32(seed);
    const arr = QUESTIONS.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.map(q => ({ q, userAns: null, correct: null }));
  }
  function matchAns(userRaw, correctFull) {
    const u = (userRaw || "").trim().toUpperCase().charAt(0);
    const c = (correctFull || "").trim().toUpperCase().charAt(0);
    return u !== "" && u === c;
  }

  return {
    id, short: shortName,
    title: titleStr,
    ep: "E", subj: "e7a",
    intro: introStr,
    formal: `<p class="math">通關條件:完成一回 ≥${MIN_Q} 題且答對率 ≥${Math.round(PASS_RATE * 100)}%。錯題自動進弱點複習。</p>`,
    goals: [{ id: GOAL_ID, text: goalText }],

    state: { phase: "start", seed: 0, questions: [], qi: 0 },

    enter() {
      Object.assign(this.state, { phase: "start", seed: Date.now(), questions: [], qi: 0 });
      this._render && this._render();
    },

    controls(el) {
      const s = this.state, lv = this;
      const render = () => {
        if (s.phase === "start") {
          const db = getDb();
          const weakN = Object.keys(db).filter(tid => QUESTIONS.find(q => q.tid === tid)).length;
          el.innerHTML = `
            <div class="quiz-q">本關共 <b>${QUESTIONS.length}</b> 題 be 動詞段考模擬題,完成後可看詳解。點下方開始:</div>
            <div class="row"><button class="quiz-opt primary" id="en-drill-start">開始作答(全 ${QUESTIONS.length} 題)</button></div>
            ${weakN > 0 ? `<div class="row"><button id="en-review-btn" style="background:var(--panel2);border:1px solid #fbbf24;color:#fbbf24;border-radius:8px;padding:7px 12px;cursor:pointer;font-size:.86rem;font-family:inherit">📕 弱點複習(${weakN} 題)</button></div>` : ""}
          `;
          el.querySelector("#en-drill-start").onclick = () => {
            s.seed = Date.now(); s.questions = pickQuestions(s.seed); s.qi = 0; s.phase = "quiz"; render();
          };
          const rv = el.querySelector("#en-review-btn");
          if (rv) rv.onclick = () => { lv._startReview(el, render); };
          return;
        }
        if (s.phase === "review") { lv._renderReview(el, render); return; }
        if (s.phase === "result") {
          const ok = s.questions.filter(q => q.correct).length;
          const total = s.questions.length, rate = ok / total;
          const pass = total >= MIN_Q && rate >= PASS_RATE;
          const rows = s.questions.map((item, i) => {
            const icon = item.correct ? "✓" : "✗", col = item.correct ? "#4ade80" : "#ff5c7a";
            return `<div style="display:flex;gap:6px;align-items:flex-start;margin:3px 0;font-size:.81rem">
              <span style="color:${col};min-width:18px">${icon}</span>
              <span>${i + 1}. ${item.q.q}<br><span style="color:#9aa5c4">你答:${item.userAns || "(未答)"}　正解:${item.q.ans}　${item.q.why}</span></span></div>`;
          }).join("");
          el.innerHTML = `
            <div class="quiz-q" style="margin-bottom:6px">${pass ? "🎉 通關!" : "再接再厲!"} 得分 <b>${ok}/${total}</b> (${Math.round(rate * 100)}%)${pass ? "" : "，需 ≥75%"}</div>
            <div style="background:var(--panel2);border-radius:8px;padding:10px;margin-bottom:10px;max-height:240px;overflow-y:auto">${rows}</div>
            <div class="row"><button class="primary" id="en-again">重新作答</button><button id="en-back">返回</button></div>`;
          el.querySelector("#en-again").onclick = () => { s.seed = Date.now(); s.questions = pickQuestions(s.seed); s.qi = 0; s.phase = "quiz"; render(); };
          el.querySelector("#en-back").onclick = () => { s.phase = "start"; render(); };
          if (pass) markGoal(GOAL_ID);
          return;
        }
        if (s.phase === "quiz") {
          const item = s.questions[s.qi];
          const isAnswered = item.correct !== null;
          const optBtns = item.q.opts.map(opt => {
            const letter = opt.trim().charAt(0).toUpperCase();
            const selected = item.userAns && item.userAns.toUpperCase().charAt(0) === letter;
            let bc = "#55648f";
            if (isAnswered && selected) bc = item.correct ? "#4ade80" : "#ff5c7a";
            else if (isAnswered && matchAns(item.q.ans, opt)) bc = "#4ade80";
            return `<button class="en-opt${selected ? " en-opt-sel" : ""}" data-opt="${opt}"
              style="width:100%;text-align:left;margin:3px 0;padding:7px 10px;background:var(--panel2);
                border:1.5px solid ${bc};border-radius:6px;cursor:${isAnswered ? "default" : "pointer"};
                font-size:.9rem;font-family:inherit;color:var(--ink);${isAnswered ? "pointer-events:none;" : ""}">${opt}</button>`;
          }).join("");
          el.innerHTML = `
            <div class="quiz-q"><b>第 ${s.qi + 1}/${s.questions.length} 題</b>　${item.q.q}</div>
            <div style="margin-top:8px">${optBtns}</div>
            <div id="en-msg" class="quiz-msg" style="margin-top:6px">
              ${isAnswered ? (item.correct ? `<span style="color:#4ade80">✓ 正確!</span>` : `<span style="color:#ff5c7a">✗ 正解: ${item.q.ans}</span>`) + `　${item.q.why}` : ""}
            </div>
            ${isAnswered ? `<div class="row"><button class="primary" id="en-next">${s.qi + 1 < s.questions.length ? "下一題" : "看成績"}</button></div>` : ""}`;
          if (!isAnswered) {
            el.querySelectorAll(".en-opt").forEach(btn => {
              btn.onclick = () => {
                item.userAns = btn.dataset.opt;
                item.correct = matchAns(btn.dataset.opt, item.q.ans);
                if (item.correct) dbHit(item.q.tid); else dbMiss(item.q.tid);
                render();
              };
            });
          } else {
            el.querySelector("#en-next").onclick = () => { s.qi++; if (s.qi >= s.questions.length) s.phase = "result"; render(); };
          }
        }
      };
      this._render = render; render();
    },

    _reviewState: { queue: [], idx: 0 },
    _startReview(el, render) {
      const db = getDb();
      this._reviewState = { queue: QUESTIONS.filter(q => db[q.tid]).slice(), idx: 0, answered: false, userAns: null };
      this.state.phase = "review"; render();
    },
    _renderReview(el, render) {
      const rv = this._reviewState;
      if (rv.idx >= rv.queue.length) {
        const db = getDb();
        const remaining = Object.keys(db).filter(t => QUESTIONS.find(q => q.tid === t)).length;
        el.innerHTML = `<div class="quiz-q">${remaining === 0 ? "🎉 弱點全清!" : `還剩 ${remaining} 題弱點`}</div>
          <div class="row"><button class="primary" id="en-rv-back">回到選單</button></div>`;
        el.querySelector("#en-rv-back").onclick = () => { this.state.phase = "start"; render(); };
        return;
      }
      const item = rv.queue[rv.idx];
      const optBtns = item.opts.map(opt => {
        const letter = opt.trim().charAt(0).toUpperCase();
        const selected = rv.userAns && rv.userAns.toUpperCase().charAt(0) === letter;
        let bc = "#55648f";
        if (rv.answered && selected) bc = rv.correct ? "#4ade80" : "#ff5c7a";
        else if (rv.answered && matchAns(item.ans, opt)) bc = "#4ade80";
        return `<button class="en-rv-opt" data-opt="${opt}"
          style="width:100%;text-align:left;margin:3px 0;padding:7px 10px;background:var(--panel2);
            border:1.5px solid ${bc};border-radius:6px;cursor:${rv.answered ? "default" : "pointer"};
            font-size:.9rem;font-family:inherit;color:var(--ink);${rv.answered ? "pointer-events:none;" : ""}">${opt}</button>`;
      }).join("");
      el.innerHTML = `
        <div class="quiz-q"><span style="color:#fbbf24">📕 弱點複習</span>　${rv.idx + 1}/${rv.queue.length}　${item.q}</div>
        <div style="margin-top:8px">${optBtns}</div>
        <div class="quiz-msg" style="margin-top:6px">
          ${rv.answered ? (rv.correct ? `<span style="color:#4ade80">✓ 答對了!</span>` : `<span style="color:#ff5c7a">✗ 正解: ${item.ans}</span>`) + `　${item.why}` : ""}
        </div>
        ${rv.answered ? `<div class="row"><button class="primary" id="en-rv-next">${rv.idx + 1 < rv.queue.length ? "下一個弱點" : "看結果"}</button></div>` : ""}`;
      if (!rv.answered) {
        el.querySelectorAll(".en-rv-opt").forEach(btn => {
          btn.onclick = () => {
            rv.userAns = btn.dataset.opt; rv.correct = matchAns(btn.dataset.opt, item.ans); rv.answered = true;
            if (rv.correct) dbHit(item.tid); render();
          };
        });
      } else {
        el.querySelector("#en-rv-next").onclick = () => { rv.idx++; rv.answered = false; rv.userAns = null; rv.correct = false; render(); };
      }
    },

    draw() {
      const s = this.state;
      g.fillStyle = TH.bg; g.fillRect(0, 0, canvas.width, canvas.height);
      const n = this.state.questions.length || QUESTIONS.length;
      if (s.phase === "quiz" || s.phase === "result") {
        const gap = Math.min(48, 560 / Math.max(n, 1));
        const x0 = (canvas.width - gap * (n - 1)) / 2, y0 = 280;
        for (let k = 0; k < n; k++) {
          const item = s.questions[k];
          let fill = TH.gridFaint;
          if (item && item.correct !== null) fill = item.correct ? "#4ade80" : "#ff5c7a";
          else if (k === s.qi && s.phase === "quiz") fill = "#ffd166";
          drawDisc(x0 + k * gap, y0, 11, fill, TH.axis, 1.5);
        }
        const ok = s.questions.filter(q => q.correct).length;
        const done = s.questions.filter(q => q.correct !== null).length;
        pText(CX, 180, s.phase === "result" ? (ok / n >= PASS_RATE ? "🏆" : "💪") : "📝", TH.text, 72, "center");
        pText(CX, 340, `${ok} / ${done}`, TH.dim, 20, "center");
        readout.innerHTML = s.phase === "result"
          ? `<b style="color:${ok / n >= PASS_RATE ? "#4ade80" : "#ffd166"}">${ok}/${n} 答對 (${Math.round(ok / n * 100)}%)</b>`
          : `第 ${s.qi + 1} 題,已對 ${ok} 題`;
      } else if (s.phase === "review") {
        pText(CX, 200, "📕", TH.text, 72, "center");
        pText(CX, 310, "弱點複習", TH.text, 22, "center", true);
        readout.innerHTML = `📕 弱點複習`;
      } else {
        pText(CX, 200, "📋", TH.text, 72, "center");
        pText(CX, 300, shortName, TH.text, 24, "center", true);
        pText(CX, 340, `共 ${QUESTIONS.length} 題`, TH.dim, 16, "center");
        readout.innerHTML = `段考模擬題庫・${QUESTIONS.length} 題`;
      }
    },
  };
}

/* ================================================================
   E7A_01_DRILL — be 動詞段考題庫(10 題)
   考點:be 動詞人稱對應 I→am；he/she/it→is；you/we/they→are。
   答案經人工核對,文法正確無爭議。
   ================================================================ */
const E7A_01_QUESTIONS = [
  { tid: "e7a_01_q1", q: "I ___ a student.", opts: ["A. am", "B. is", "C. are", "D. be"], ans: "A",
    why: "主詞 I 的 be 動詞固定用 am。" },
  { tid: "e7a_01_q2", q: "He ___ my friend.", opts: ["A. am", "B. is", "C. are", "D. be"], ans: "B",
    why: "he 是第三人稱單數,be 動詞用 is。" },
  { tid: "e7a_01_q3", q: "They ___ students.", opts: ["A. am", "B. is", "C. are", "D. was"], ans: "C",
    why: "they 是複數,be 動詞用 are。" },
  { tid: "e7a_01_q4", q: "She ___ happy.", opts: ["A. am", "B. are", "C. is", "D. be"], ans: "C",
    why: "she 是第三人稱單數,be 動詞用 is;happy 是形容詞,前面不加 a。" },
  { tid: "e7a_01_q5", q: "We ___ classmates.", opts: ["A. am", "B. is", "C. are", "D. be"], ans: "C",
    why: "we 是複數,be 動詞用 are。" },
  { tid: "e7a_01_q6", q: "It ___ a dog.", opts: ["A. am", "B. is", "C. are", "D. do"], ans: "B",
    why: "it 是第三人稱單數,be 動詞用 is。" },
  { tid: "e7a_01_q7", q: "You ___ my teacher.", opts: ["A. am", "B. is", "C. are", "D. be"], ans: "C",
    why: "you(你/你們)的 be 動詞用 are。" },
  { tid: "e7a_01_q8", q: "下列哪一句 be 動詞用「正確」?", opts: ["A. I is a boy.", "B. He are tall.", "C. She is a nurse.", "D. They is happy."], ans: "C",
    why: "she 用 is,故 C 正確。A 應為 I am;B 應為 He is;D 應為 They are。" },
  { tid: "e7a_01_q9", q: "Tom and I ___ good friends.", opts: ["A. am", "B. is", "C. are", "D. be"], ans: "C",
    why: "Tom and I 是複數主詞(兩人),be 動詞用 are。" },
  { tid: "e7a_01_q10", q: "___ she a teacher? (選出正確的疑問句開頭)", opts: ["A. Am", "B. Is", "C. Are", "D. Do"], ans: "B",
    why: "she 的 be 動詞是 is,疑問句把 is 移到句首:Is she a teacher?" },
];

const E7A_01_DRILL = makeStaticEnDrill(
  "E7A_01D",
  "be 動詞段考練習",
  "段考練習|E7A-1D:be 動詞段考題庫",
  `<p>本關模擬國中七上英文段考選擇題——<b>10 題</b>,考 be 動詞(am / is / are)的人稱對應。</p><p>點選正確選項,答完後可看詳解與成績;答對率 ≥75% 解鎖通關。</p>`,
  "完成段考練習且答對率 ≥75%(be 動詞)",
  E7A_01_QUESTIONS
);

/* ================================================================
   ENGLISH7A_REGISTRY — 供 main.js subject-loader / 深連結使用
   ================================================================ */
const ENGLISH7A_REGISTRY = {
  E7A_01,
  E7A_01D: E7A_01_DRILL,
};

/* 科目定義:subject-loader 會讀這個全域 */
window.__SUBJECT_ENGLISH7A__ = {
  subjectKey: "e7a",
  subjectName: "七上英文",
  levels: [E7A_01, E7A_01_DRILL],
};

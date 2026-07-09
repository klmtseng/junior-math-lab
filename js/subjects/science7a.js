/* science7a.js — 七上自然科關卡實作
   依賴 main.js 全域:g, canvas, CX, CY, TH, pText, drawDisc, readout,
   markGoal, progress, player, dragTarget, EP
   ================================================================ */
"use strict";

/* ---------- EP 自然科來源標記 ---------- */
// 掛到 EP 讓 switchLevel 能讀到 ep link
EP["S"] = ["臺灣國中七上自然科(原創)", "https://github.com/klmtseng/junior-math-lab"];

/* ================================================================
   S7A_01 — 細胞基本構造(植物 vs 動物分類互動)
   互動:把構造標籤從「待分類區」拖進「植物才有」或「動植物都有」框
   ================================================================ */
const S7A_01 = {
  id: "S7A_01", short: "細胞構造",
  title: "關 S7A-1|細胞:植物與動物的不同長相",
  ep: "S", subj: "s7a",
  intro: `<p>所有生物都由<b>細胞</b>組成。植物細胞和動物細胞有幾個共同的構造,也有幾個「植物才有」的東西。</p><p>把右邊的構造標籤<b>拖進正確的框框</b>:「植物才有」或「動植物都有」。動物細胞沒有的構造,植物細胞才有。</p>`,
  formal: `<p class="math">植物細胞特有:細胞壁、葉綠體、液胞(大型中央液胞)。動植物共有:細胞膜、細胞核、粒線體。</p>`,
  goals: [
    { id: "S7A_01-a", text: "正確分類全部 6 個細胞構造" },
  ],

  /* 構造資料:plant=true → 植物才有;plant=false → 動植物都有 */
  _PARTS: [
    { name: "細胞壁",  plant: true,  desc: "植物細胞外層硬殼,提供支撐與保護" },
    { name: "葉綠體",  plant: true,  desc: "進行光合作用,把陽光轉成有機物" },
    { name: "液胞",    plant: true,  desc: "大型中央液胞儲水調節滲透壓" },
    { name: "細胞膜",  plant: false, desc: "控制物質進出,動植物都有" },
    { name: "細胞核",  plant: false, desc: "含 DNA,控制細胞活動" },
    { name: "粒線體",  plant: false, desc: "細胞的能量工廠,進行細胞呼吸" },
  ],

  /* state.placed: { [name]: "plant"|"both"|null } */
  state: { placed: {} },

  enter() {
    this.state.placed = {};
    this._PARTS.forEach((p) => { this.state.placed[p.name] = null; });
    this._renderCtl && this._renderCtl();
  },

  /* demo:自動播放分類步驟(供示範旁白對應) */
  demo() {
    const s = this.state, lv = this;
    const R = () => lv._renderCtl && lv._renderCtl();
    return [
      {
        call: () => { s.placed = {}; lv._PARTS.forEach(p => s.placed[p.name] = null); R(); },
        cap: "細胞是生命的基本單位。先看哪些構造植物才有?",
        dur: 2800,
      },
      {
        call: () => { s.placed["細胞壁"] = "plant"; R(); },
        cap: "細胞壁:植物才有。提供支撐,動物細胞沒有這層硬殼",
        dur: 2600,
      },
      {
        call: () => { s.placed["葉綠體"] = "plant"; R(); },
        cap: "葉綠體:植物才有。負責光合作用,把陽光轉成養分",
        dur: 2600,
      },
      {
        call: () => { s.placed["液胞"] = "plant"; R(); },
        cap: "液胞:植物才有。大型中央液胞儲水,讓植物挺立不萎縮",
        dur: 2600,
      },
      {
        call: () => { s.placed["細胞膜"] = "both"; s.placed["細胞核"] = "both"; s.placed["粒線體"] = "both"; R(); },
        cap: "細胞膜、細胞核、粒線體:動植物都有。現在換你自己試試看!",
        dur: 3000,
      },
      {
        call: () => {
          s.placed = {};
          lv._PARTS.forEach(p => s.placed[p.name] = null);
          R();
        },
        cap: "換你試試!把每個構造拖進正確的框",
        dur: 1800,
      },
    ];
  },

  /* controls:拖放分類 UI */
  controls(el) {
    const s = this.state, lv = this;
    const render = () => {
      const unplaced = lv._PARTS.filter(p => s.placed[p.name] === null);
      const inPlant  = lv._PARTS.filter(p => s.placed[p.name] === "plant");
      const inBoth   = lv._PARTS.filter(p => s.placed[p.name] === "both");
      const allDone  = unplaced.length === 0;
      const allRight = allDone && lv._PARTS.every(p =>
        (p.plant && s.placed[p.name] === "plant") || (!p.plant && s.placed[p.name] === "both")
      );

      const chip = (p, zone) =>
        `<span class="cell-chip${zone === "pool" ? "" : " placed"}" data-name="${p.name}" data-zone="${zone}" title="${p.desc}">${p.name}</span>`;

      el.innerHTML = `
        <style>
          .cell-zone { border: 2px dashed #55648f; border-radius: 8px; padding: 8px 10px; min-height: 52px; margin: 4px 0; }
          .cell-zone.correct { border-color: #4ade80; background: rgba(74,222,128,.1); }
          .cell-zone.wrong   { border-color: #ff5c7a; background: rgba(255,92,122,.08); }
          .cell-zone-label { font-size: 13px; color: #9aa5c4; margin-bottom: 4px; font-weight: bold; }
          .cell-chip { display: inline-block; background: #1d2440; border: 1.5px solid #55648f;
            border-radius: 6px; padding: 5px 12px; margin: 3px; cursor: pointer; font-size: 14px;
            user-select: none; transition: background .15s; }
          .cell-chip:hover { background: #2e3a63; }
          .cell-chip.placed { border-color: #4ade80; }
          .cell-pool-label { font-size: 13px; color: #9aa5c4; margin: 8px 0 4px; font-weight: bold; }
        </style>
        <div class="cell-zone-label">🌿 植物才有</div>
        <div class="cell-zone${allDone ? (inPlant.every(p=>p.plant) && inBoth.every(p=>!p.plant) ? " correct" : " wrong") : ""}" id="zone-plant">
          ${inPlant.map(p => chip(p, "plant")).join("")}
        </div>
        <div class="cell-zone-label" style="margin-top:8px">🔵 動植物都有</div>
        <div class="cell-zone${allDone ? (inBoth.every(p=>!p.plant) && inPlant.every(p=>p.plant) ? " correct" : " wrong") : ""}" id="zone-both">
          ${inBoth.map(p => chip(p, "both")).join("")}
        </div>
        <div class="cell-pool-label">待分類</div>
        <div id="zone-pool">
          ${unplaced.map(p => chip(p, "pool")).join("")}
        </div>
        ${allDone ? `<div class="row quiz-msg" style="margin-top:8px">${allRight ? '<b style="color:#4ade80">全部正確!植物細胞的三個特有構造都找到了!</b>' : '<b style="color:#ff5c7a">有分錯,再試試</b>'}</div>` : ""}
        ${allDone && !allRight ? `<button id="s7a01-reset" style="margin-top:4px">重新分類</button>` : ""}
      `;

      /* 點擊操作:點待分類的 chip → 循環到「植物才有」→「動植物都有」→ null */
      el.querySelectorAll(".cell-chip").forEach(chip => {
        chip.onclick = () => {
          const name = chip.dataset.name;
          const cur = s.placed[name];
          if (cur === null) s.placed[name] = "plant";
          else if (cur === "plant") s.placed[name] = "both";
          else s.placed[name] = null;
          render();
        };
      });

      el.querySelector("#s7a01-reset") && (el.querySelector("#s7a01-reset").onclick = () => {
        lv._PARTS.forEach(p => s.placed[p.name] = null);
        render();
      });

      if (allRight) markGoal("S7A_01-a");
    };
    this._renderCtl = render;
    render();
  },

  /* draw:Canvas 2D 雙細胞示意圖 */
  draw() {
    const s = this.state;
    const W = canvas.width, H = canvas.height;
    const cx1 = W * 0.28, cx2 = W * 0.72, cy = H * 0.42, R = 105;

    /* ── 植物細胞(左) ── */
    // 細胞壁(外框,方形)
    const wOff = 14;
    g.strokeStyle = s.placed["細胞壁"] === "plant" ? "#4ade80" : "#55648f";
    g.lineWidth = 4;
    g.strokeRect(cx1 - R - wOff, cy - R - wOff, (R + wOff) * 2, (R + wOff) * 2);

    // 細胞膜(橢圓形)
    g.strokeStyle = s.placed["細胞膜"] === "both" ? "#38bdf8" : "#55648f";
    g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(cx1, cy, R, R * 0.88, 0, 0, 7); g.stroke();

    // 液胞(大型中央水藍色)
    g.fillStyle = s.placed["液胞"] === "plant" ? "rgba(56,189,248,.28)" : "rgba(56,189,248,.10)";
    g.strokeStyle = s.placed["液胞"] === "plant" ? "#38bdf8" : "#39456e";
    g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(cx1, cy - 6, 54, 46, 0, 0, 7);
    g.fill(); g.stroke();

    // 葉綠體(3 顆綠色橢圓)
    [[cx1 - 44, cy + 40], [cx1 + 22, cy + 50], [cx1 - 18, cy + 62]].forEach(([ex, ey]) => {
      g.fillStyle = s.placed["葉綠體"] === "plant" ? "rgba(74,222,128,.70)" : "rgba(74,222,128,.25)";
      g.strokeStyle = s.placed["葉綠體"] === "plant" ? "#4ade80" : "#2e3a63";
      g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(ex, ey, 16, 9, 0.4, 0, 7); g.fill(); g.stroke();
    });

    // 細胞核(植物)
    g.fillStyle = s.placed["細胞核"] === "both" ? "rgba(251,191,36,.55)" : "rgba(251,191,36,.2)";
    g.strokeStyle = s.placed["細胞核"] === "both" ? "#fbbf24" : "#39456e";
    g.lineWidth = 2;
    g.beginPath(); g.arc(cx1 - 22, cy - 22, 20, 0, 7); g.fill(); g.stroke();

    // 粒線體(植物,2 個)
    [[cx1 + 50, cy + 14], [cx1 + 60, cy - 30]].forEach(([mx, my]) => {
      g.fillStyle = s.placed["粒線體"] === "both" ? "rgba(167,139,250,.60)" : "rgba(167,139,250,.20)";
      g.strokeStyle = s.placed["粒線體"] === "both" ? "#a78bfa" : "#39456e";
      g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(mx, my, 12, 7, 0.5, 0, 7); g.fill(); g.stroke();
    });

    pText(cx1, cy + R + wOff + 22, "植物細胞", TH.text, 15, "center", true);

    /* ── 動物細胞(右) ── */
    // 細胞膜(不規則橢圓)
    g.strokeStyle = s.placed["細胞膜"] === "both" ? "#38bdf8" : "#55648f";
    g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(cx2, cy, R * 0.92, R, 0.15, 0, 7); g.stroke();

    // 細胞核(動物)
    g.fillStyle = s.placed["細胞核"] === "both" ? "rgba(251,191,36,.55)" : "rgba(251,191,36,.2)";
    g.strokeStyle = s.placed["細胞核"] === "both" ? "#fbbf24" : "#39456e";
    g.lineWidth = 2;
    g.beginPath(); g.arc(cx2 - 10, cy - 10, 22, 0, 7); g.fill(); g.stroke();

    // 粒線體(動物,3 個)
    [[cx2 + 46, cy + 18], [cx2 - 50, cy + 30], [cx2 + 30, cy - 50]].forEach(([mx, my]) => {
      g.fillStyle = s.placed["粒線體"] === "both" ? "rgba(167,139,250,.60)" : "rgba(167,139,250,.20)";
      g.strokeStyle = s.placed["粒線體"] === "both" ? "#a78bfa" : "#39456e";
      g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(mx, my, 12, 7, -0.3, 0, 7); g.fill(); g.stroke();
    });

    pText(cx2, cy + R + 22, "動物細胞", TH.text, 15, "center", true);

    /* ── 標籤(已放置的顯示在圖上) ── */
    const labelPos = {
      "細胞壁":  [cx1,      cy - R - wOff - 14],
      "葉綠體":  [cx1 - 16, cy + 60],
      "液胞":    [cx1,      cy - 16],
      "細胞膜":  [cx1 + R * 0.7, cy + 10],
      "細胞核":  [cx1 - 22, cy - 22],
      "粒線體":  [cx1 + 60, cy - 10],
    };
    Object.entries(labelPos).forEach(([name, [lx, ly]]) => {
      if (s.placed[name]) {
        const col = s.placed[name] === "plant" ? "#4ade80" : "#38bdf8";
        g.fillStyle = "rgba(10,14,26,.7)";
        const tw = name.length * 14 + 8;
        g.fillRect(lx - tw / 2, ly - 14, tw, 20);
        pText(lx, ly, name, col, 13, "center", true);
      }
    });

    /* ── readout ── */
    const placed = this._PARTS.filter(p => s.placed[p.name] !== null).length;
    const total = this._PARTS.length;
    readout.innerHTML = placed === total
      ? `<b style="color:#4ade80">全部分類完成!確認右側結果</b>`
      : `已分類 <b>${placed}/${total}</b> 個構造`;
  },
};

/* ================================================================
   makeStaticSciDrill — 段考題庫關卡工廠
   吃一個靜態題目陣列(選擇題為主),產生與 drill.js makeExamLevel
   外型一致的關卡物件(同 phase/controls/draw 介面),讓 subject-loader
   可直接把它放進 levels 陣列。
   依賴 drill.js 的全域:pText, drawDisc, canvas, g, TH, CX, CY,
   readout, markGoal, mulberry32, normAns
   ================================================================
   題目格式:
   {
     tid:  string,          // 唯一 id(用於錯題本)
     q:    string,          // 題幹
     opts: string[],        // 選項標籤陣列(["A.…","B.…",…])
     ans:  string,          // 正解標籤(例 "A" 或 "A.植物細胞才有的構造是")
     why:  string,          // 解析
   }
   ================================================================ */
function makeStaticSciDrill(id, shortName, titleStr, introStr, goalText, QUESTIONS) {
  const GOAL_ID = `${id}-pass`;
  const PASS_RATE = 0.75;   // 自然段考通關線 75%
  const MIN_Q    = 8;       // 至少答完 8 題才計算通關

  /* 靜態錯題本(與數學 DRILL_BOOK 獨立,key=tid) */
  const SCI_DBOOK_KEY = "jrlab-sci-drillbook-v1";
  function getSciDb() {
    try { return JSON.parse(localStorage.getItem(SCI_DBOOK_KEY) || "{}"); } catch(e) { return {}; }
  }
  function saveSciDb(db) { try { localStorage.setItem(SCI_DBOOK_KEY, JSON.stringify(db)); } catch(e) {} }
  function sciDbMiss(tid) { const db = getSciDb(); db[tid] = (db[tid] || 0) + 1; saveSciDb(db); }
  function sciDbHit(tid)  { const db = getSciDb(); delete db[tid]; saveSciDb(db); }

  /* 抽題(帶 seed,題序亂排但每輪一樣)*/
  function pickQuestions(seed) {
    // 簡單 Fisher-Yates with mulberry32
    const rng = mulberry32(seed);
    const arr = QUESTIONS.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.map(q => ({ q, userAns: null, correct: null }));
  }

  /* 答案正規化比對:只比對首字母(A/B/C/D),忽略後面文字 */
  function matchAns(userRaw, correctFull) {
    const u = (userRaw || "").trim().toUpperCase().charAt(0);
    const c = (correctFull || "").trim().toUpperCase().charAt(0);
    return u !== "" && u === c;
  }

  return {
    id, short: shortName,
    title: titleStr,
    ep: "S", subj: "s7a",
    intro: introStr,
    formal: `<p class="math">通關條件:完成一回 ≥${MIN_Q} 題且答對率 ≥${Math.round(PASS_RATE*100)}%。錯題自動進弱點複習。</p>`,
    goals: [{ id: GOAL_ID, text: goalText }],

    state: {
      phase: "start",     // start | quiz | result
      seed: 0,
      questions: [],      // [{ q, userAns, correct }]
      qi: 0,
    },

    enter() {
      Object.assign(this.state, { phase: "start", seed: Date.now(), questions: [], qi: 0 });
      this._render && this._render();
    },

    controls(el) {
      const s = this.state, lv = this;

      const render = () => {
        /* ── 起始 ── */
        if (s.phase === "start") {
          const sciDb = getSciDb();
          const weakN = Object.keys(sciDb).filter(tid => QUESTIONS.find(q => q.tid === tid)).length;
          el.innerHTML = `
            <div class="quiz-q">本關共 <b>${QUESTIONS.length}</b> 題段考模擬題,完成後可看詳解。點下方開始:</div>
            <div class="row">
              <button class="quiz-opt primary" id="sci-drill-start">開始作答(全 ${QUESTIONS.length} 題)</button>
            </div>
            ${weakN > 0 ? `<div class="row"><button id="sci-review-btn" style="background:var(--panel2);border:1px solid #fbbf24;color:#fbbf24;border-radius:8px;padding:7px 12px;cursor:pointer;font-size:.86rem;font-family:inherit">📕 弱點複習(${weakN} 題)</button></div>` : ""}
          `;
          el.querySelector("#sci-drill-start").onclick = () => {
            s.seed = Date.now();
            s.questions = pickQuestions(s.seed);
            s.qi = 0; s.phase = "quiz";
            render();
          };
          const rvBtn = el.querySelector("#sci-review-btn");
          if (rvBtn) rvBtn.onclick = () => { lv._startSciReview(el, render); };
          return;
        }

        /* ── 弱點複習 ── */
        if (s.phase === "review") {
          lv._renderSciReview(el, render);
          return;
        }

        /* ── 結果 ── */
        if (s.phase === "result") {
          const ok = s.questions.filter(q => q.correct).length;
          const total = s.questions.length;
          const rate = ok / total;
          const pass = total >= MIN_Q && rate >= PASS_RATE;
          const rows = s.questions.map((item, i) => {
            const icon = item.correct ? "✓" : "✗";
            const col  = item.correct ? "#4ade80" : "#ff5c7a";
            return `<div style="display:flex;gap:6px;align-items:flex-start;margin:3px 0;font-size:.81rem">
              <span style="color:${col};min-width:18px">${icon}</span>
              <span>${i+1}. ${item.q.q}<br><span style="color:#9aa5c4">你答:${item.userAns||"(未答)"}　正解:${item.q.ans}　${item.q.why}</span></span>
            </div>`;
          }).join("");
          el.innerHTML = `
            <div class="quiz-q" style="margin-bottom:6px">${pass ? "🎉 通關!" : "再接再厲!"} 得分 <b>${ok}/${total}</b> (${Math.round(rate*100)}%)${pass?"":"，需 ≥75%"}</div>
            <div style="background:var(--panel2);border-radius:8px;padding:10px;margin-bottom:10px;max-height:240px;overflow-y:auto">${rows}</div>
            <div class="row">
              <button class="primary" id="sci-again">重新作答</button>
              <button id="sci-back">返回</button>
            </div>
          `;
          el.querySelector("#sci-again").onclick = () => {
            s.seed = Date.now();
            s.questions = pickQuestions(s.seed);
            s.qi = 0; s.phase = "quiz";
            render();
          };
          el.querySelector("#sci-back").onclick = () => { s.phase = "start"; render(); };
          if (pass) markGoal(GOAL_ID);
          return;
        }

        /* ── 作答 ── */
        if (s.phase === "quiz") {
          const item = s.questions[s.qi];
          const isAnswered = item.correct !== null;
          const optBtns = item.q.opts.map(opt => {
            const letter = opt.trim().charAt(0).toUpperCase();
            const selected = item.userAns && item.userAns.toUpperCase().charAt(0) === letter;
            let borderColor = "#55648f";
            if (isAnswered && selected) borderColor = item.correct ? "#4ade80" : "#ff5c7a";
            else if (isAnswered && matchAns(item.q.ans, opt)) borderColor = "#4ade80";
            return `<button class="sci-opt${selected?" sci-opt-sel":""}" data-opt="${opt}"
              style="width:100%;text-align:left;margin:3px 0;padding:7px 10px;
                background:var(--panel2);border:1.5px solid ${borderColor};
                border-radius:6px;cursor:${isAnswered?"default":"pointer"};
                font-size:.9rem;font-family:inherit;color:var(--ink);
                ${isAnswered?"pointer-events:none;":""}">${opt}</button>`;
          }).join("");
          el.innerHTML = `
            <div class="quiz-q"><b>第 ${s.qi+1}/${s.questions.length} 題</b>　${item.q.q}</div>
            <div style="margin-top:8px">${optBtns}</div>
            <div id="sci-msg" class="quiz-msg" style="margin-top:6px">
              ${isAnswered ? (item.correct ? `<span style="color:#4ade80">✓ 正確!</span>` : `<span style="color:#ff5c7a">✗ 正解: ${item.q.ans}</span>`) + `　${item.q.why}` : ""}
            </div>
            ${isAnswered ? `<div class="row"><button class="primary" id="sci-next">${s.qi+1 < s.questions.length ? "下一題" : "看成績"}</button></div>` : ""}
          `;
          if (!isAnswered) {
            el.querySelectorAll(".sci-opt").forEach(btn => {
              btn.onclick = () => {
                item.userAns = btn.dataset.opt;
                item.correct = matchAns(btn.dataset.opt, item.q.ans);
                if (item.correct) sciDbHit(item.q.tid);
                else sciDbMiss(item.q.tid);
                render();
              };
            });
          } else {
            el.querySelector("#sci-next").onclick = () => {
              s.qi++;
              if (s.qi >= s.questions.length) s.phase = "result";
              render();
            };
          }
        }
      };

      this._render = render;
      render();
    },

    /* ── 弱點複習 ── */
    _sciReviewState: { queue: [], idx: 0 },
    _startSciReview(el, render) {
      const sciDb = getSciDb();
      this._sciReviewState = {
        queue: QUESTIONS.filter(q => sciDb[q.tid]).slice(),
        idx: 0, answered: false, userAns: null,
      };
      this.state.phase = "review";
      render();
    },
    _renderSciReview(el, render) {
      const rv = this._sciReviewState;
      if (rv.idx >= rv.queue.length) {
        const sciDb = getSciDb();
        const remaining = Object.keys(sciDb).filter(t => QUESTIONS.find(q => q.tid === t)).length;
        el.innerHTML = `
          <div class="quiz-q">${remaining === 0 ? "🎉 弱點全清!" : `還剩 ${remaining} 題弱點`}</div>
          <div class="row"><button class="primary" id="sci-rv-back">回到選單</button></div>
        `;
        el.querySelector("#sci-rv-back").onclick = () => { this.state.phase = "start"; render(); };
        return;
      }
      const item = rv.queue[rv.idx];
      const optBtns = item.opts.map(opt => {
        const letter = opt.trim().charAt(0).toUpperCase();
        const selected = rv.userAns && rv.userAns.toUpperCase().charAt(0) === letter;
        let borderColor = "#55648f";
        if (rv.answered && selected) borderColor = rv.correct ? "#4ade80" : "#ff5c7a";
        else if (rv.answered && matchAns(item.ans, opt)) borderColor = "#4ade80";
        return `<button class="sci-rv-opt" data-opt="${opt}"
          style="width:100%;text-align:left;margin:3px 0;padding:7px 10px;
            background:var(--panel2);border:1.5px solid ${borderColor};
            border-radius:6px;cursor:${rv.answered?"default":"pointer"};
            font-size:.9rem;font-family:inherit;color:var(--ink);
            ${rv.answered?"pointer-events:none;":""}">${opt}</button>`;
      }).join("");
      el.innerHTML = `
        <div class="quiz-q"><span style="color:#fbbf24">📕 弱點複習</span>　${rv.idx+1}/${rv.queue.length}　${item.q}</div>
        <div style="margin-top:8px">${optBtns}</div>
        <div id="sci-rv-msg" class="quiz-msg" style="margin-top:6px">
          ${rv.answered ? (rv.correct ? `<span style="color:#4ade80">✓ 答對了!</span>` : `<span style="color:#ff5c7a">✗ 正解: ${item.ans}</span>`) + `　${item.why}` : ""}
        </div>
        ${rv.answered ? `<div class="row"><button class="primary" id="sci-rv-next">${rv.idx+1 < rv.queue.length ? "下一個弱點" : "看結果"}</button></div>` : ""}
      `;
      if (!rv.answered) {
        el.querySelectorAll(".sci-rv-opt").forEach(btn => {
          btn.onclick = () => {
            rv.userAns = btn.dataset.opt;
            rv.correct = matchAns(btn.dataset.opt, item.ans);
            rv.answered = true;
            if (rv.correct) sciDbHit(item.tid);
            render();
          };
        });
      } else {
        el.querySelector("#sci-rv-next").onclick = () => {
          rv.idx++;
          rv.answered = false; rv.userAns = null; rv.correct = false;
          render();
        };
      }
    },

    draw() {
      const s = this.state;
      g.fillStyle = TH.bg; g.fillRect(0, 0, canvas.width, canvas.height);
      const n = this.state.questions.length || QUESTIONS.length;
      if (s.phase === "quiz" || s.phase === "result") {
        const gap = Math.min(48, 560 / Math.max(n, 1));
        const x0 = (canvas.width - gap * (n - 1)) / 2;
        const y0 = 280;
        for (let k = 0; k < n; k++) {
          const item = s.questions[k];
          let fill = TH.gridFaint;
          if (item && item.correct !== null) fill = item.correct ? "#4ade80" : "#ff5c7a";
          else if (k === s.qi && s.phase === "quiz") fill = "#ffd166";
          drawDisc(x0 + k * gap, y0, 11, fill, TH.axis, 1.5);
        }
        const ok = s.questions.filter(q => q.correct).length;
        const done = s.questions.filter(q => q.correct !== null).length;
        pText(CX, 180, s.phase === "result" ? (ok/n >= PASS_RATE ? "🏆" : "💪") : "📝", TH.text, 72, "center");
        pText(CX, 340, `${ok} / ${done}`, TH.dim, 20, "center");
        readout.innerHTML = s.phase === "result"
          ? `<b style="color:${ok/n>=PASS_RATE?"#4ade80":"#ffd166"}">${ok}/${n} 答對 (${Math.round(ok/n*100)}%)</b>`
          : `第 ${s.qi+1} 題,已對 ${ok} 題`;
      } else if (s.phase === "review") {
        pText(CX, 200, "📕", TH.text, 72, "center");
        const sciDb = getSciDb();
        const remaining = Object.keys(sciDb).filter(t => QUESTIONS.find(q => q.tid === t)).length;
        pText(CX, 310, "弱點複習", TH.text, 22, "center", true);
        pText(CX, 350, `目前還有 ${remaining} 個弱點`, TH.dim, 16, "center");
        readout.innerHTML = `📕 弱點複習`;
      } else {
        pText(CX, 200, "📋", TH.text, 72, "center");
        pText(CX, 300, shortName, TH.text, 28, "center", true);
        pText(CX, 340, `共 ${QUESTIONS.length} 題`, TH.dim, 16, "center");
        const sciDb = getSciDb();
        const weakN = Object.keys(sciDb).filter(t => QUESTIONS.find(q => q.tid === t)).length;
        if (weakN > 0) pText(CX, 380, `📕 ${weakN} 個弱點待複習`, "#fbbf24", 14, "center");
        readout.innerHTML = `段考模擬題庫・${QUESTIONS.length} 題`;
      }
    },
  };
}

/* ================================================================
   S7A_01_DRILL — S7A_01 段考題庫(細胞基本構造)
   知識點:Da-Ⅳ-1 細胞構造、植物/動物差異、生物基本單位
   題目全部為單選題,答案無爭議(翰林/南一/康軒共識)
   ================================================================ */
const S7A_01_QUESTIONS = [
  {
    tid: "s7a_01_q1",
    q: "下列哪一項構造是植物細胞「才有」,動物細胞沒有的?",
    opts: ["A. 細胞膜", "B. 細胞核", "C. 細胞壁", "D. 粒線體"],
    ans: "C",
    why: "細胞壁是植物細胞特有的構造,提供支撐與保護;動物細胞有細胞膜但沒有細胞壁。",
  },
  {
    tid: "s7a_01_q2",
    q: "下列關於葉綠體的敘述,何者正確?",
    opts: ["A. 動植物細胞都有葉綠體", "B. 葉綠體負責進行光合作用", "C. 葉綠體是細胞的能量工廠", "D. 葉綠體存在於動物細胞中"],
    ans: "B",
    why: "葉綠體負責光合作用,把光能轉換為化學能(有機物);它是植物才有的構造。粒線體才是能量工廠(進行細胞呼吸)。",
  },
  {
    tid: "s7a_01_q3",
    q: "細胞中進行「細胞呼吸」、負責提供能量的構造是?",
    opts: ["A. 細胞核", "B. 液胞", "C. 葉綠體", "D. 粒線體"],
    ans: "D",
    why: "粒線體是細胞的能量工廠,分解有機物釋放能量(ATP);動植物細胞都有粒線體。",
  },
  {
    tid: "s7a_01_q4",
    q: "下列關於動植物細胞「共同具有」的構造,哪一項正確?",
    opts: ["A. 細胞壁、細胞核、葉綠體", "B. 細胞膜、細胞核、粒線體", "C. 細胞壁、細胞膜、液胞", "D. 葉綠體、粒線體、液胞"],
    ans: "B",
    why: "細胞膜、細胞核、粒線體是動植物細胞共有的基本構造;細胞壁、葉綠體、大液胞是植物細胞特有的。",
  },
  {
    tid: "s7a_01_q5",
    q: "小明在顯微鏡下觀察到一個細胞,發現它有細胞壁、葉綠體和大型液胞,這個細胞最可能是哪種生物的細胞?",
    opts: ["A. 人類皮膚細胞", "B. 青蛙的紅血球", "C. 菠菜葉肉細胞", "D. 草履蟲細胞"],
    ans: "C",
    why: "有細胞壁、葉綠體、大型液胞三者同時出現,是植物細胞的特徵;菠菜葉肉細胞是植物細胞。",
  },
  {
    tid: "s7a_01_q6",
    q: "下列關於細胞的敘述,哪一項是「錯誤」的?",
    opts: ["A. 細胞是生物體的基本單位", "B. 細胞膜能控制物質進出細胞", "C. 動物細胞沒有細胞壁,所以沒有細胞膜", "D. 植物細胞和動物細胞都有細胞核"],
    ans: "C",
    why: "動物細胞沒有細胞壁,但仍然有細胞膜;細胞膜是所有細胞都具備的基本構造。",
  },
  {
    tid: "s7a_01_q7",
    q: "細胞核的主要功能是?",
    opts: ["A. 控制物質進出細胞", "B. 進行光合作用", "C. 儲存水分調節滲透壓", "D. 含有遺傳物質(DNA),控制細胞的生命活動"],
    ans: "D",
    why: "細胞核含有 DNA(遺傳物質),負責控制細胞的各種生命活動;動植物細胞都有細胞核。",
  },
  {
    tid: "s7a_01_q8",
    q: "植物細胞的大型「液胞」主要功能是什麼?",
    opts: ["A. 進行光合作用", "B. 提供支撐與保護", "C. 儲存水分及溶質,調節細胞的滲透壓", "D. 釋放能量供細胞使用"],
    ans: "C",
    why: "大型中央液胞主要儲存水分及溶質(如色素、廢物),調節細胞滲透壓,也讓植物細胞保持膨壓而挺立。",
  },
  {
    tid: "s7a_01_q9",
    q: "以下哪一項,是動物細胞「沒有」而植物細胞「有」的構造?(多選一最完整的答案)",
    opts: ["A. 細胞膜與細胞核", "B. 細胞壁與葉綠體", "C. 粒線體與細胞核", "D. 細胞膜與粒線體"],
    ans: "B",
    why: "細胞壁與葉綠體都是植物細胞特有的,動物細胞皆沒有;選 B 是最完整的答案。",
  },
  {
    tid: "s7a_01_q10",
    q: "細胞是生物體的基本單位。下列哪個選項的說法是「正確」的?",
    opts: ["A. 只有動物才由細胞組成", "B. 細菌沒有細胞核,所以不是由細胞組成的生物", "C. 所有生物都由細胞組成", "D. 植物細胞不需要細胞膜因為有細胞壁保護"],
    ans: "C",
    why: "所有生物(包括植物、動物、菌類、細菌等)都由細胞組成;細菌屬於原核生物,有細胞但細胞核沒有核膜包覆。植物細胞在細胞壁內層仍有細胞膜。",
  },
];

const S7A_01_DRILL = makeStaticSciDrill(
  "S7A_01D",
  "細胞構造段考練習",
  "段考練習|S7A-1D:細胞構造段考題庫",
  `<p>本關模擬國中七上自然科段考選擇題——<b>10 題</b>,涵蓋細胞構造、動植物差異、各構造功能等知識點。</p><p>點選正確選項,答完後可看詳解與成績;答對率 ≥75% 解鎖通關。</p>`,
  "完成段考練習且答對率 ≥75%(細胞構造)",
  S7A_01_QUESTIONS
);

/* ================================================================
   S7A_02 — 細胞的構造層次(細胞→組織→器官→器官系統→個體)
   互動:圖鑑/堆疊互動——按層次順序依序解鎖說明卡片
   ================================================================ */
const S7A_02 = {
  id: "S7A_02", short: "構造層次",
  title: "關 S7A-2|從細胞到個體:生命的五層架構",
  ep: "S", subj: "s7a",
  intro: `<p>生物體的構造有「層次」:最小的<b>細胞</b>聚合成<b>組織</b>,組織再組成<b>器官</b>,器官再組成<b>器官系統</b>,最後形成完整的<b>個體</b>。</p><p>點選每一層次的卡片,依序了解各層次的定義與舉例。當五層都查閱完畢後,試著用拖拉把層次順序排列正確!</p>`,
  formal: `<p class="math">構造層次(由小到大):細胞 → 組織 → 器官 → 器官系統 → 個體<br>課綱對應:Da-Ⅳ-1(生命現象與生物體的組成)</p>`,
  goals: [
    { id: "S7A_02-a", text: "了解五層構造層次(全部查閱卡片)" },
    { id: "S7A_02-b", text: "正確排列層次順序" },
  ],

  _LEVELS: [
    {
      key: "cell",
      name: "細胞",
      icon: "🔬",
      color: "#4ade80",
      def: "生物體結構與功能的基本單位",
      examples: "神經細胞、肌肉細胞、葉肉細胞",
      note: "不同功能的細胞形態各異,但都有細胞膜、細胞質、細胞核(原核生物除外)。",
    },
    {
      key: "tissue",
      name: "組織",
      icon: "🧫",
      color: "#38bdf8",
      def: "由許多形態相似、功能相同的細胞組成的集合",
      examples: "動物:上皮組織、肌肉組織、神經組織、結締組織\n植物:保護組織、輸導組織、基本組織、分生組織",
      note: "組織是細胞聚合後的第一層,每種組織有其特化功能。",
    },
    {
      key: "organ",
      name: "器官",
      icon: "🫀",
      color: "#fbbf24",
      def: "由數種不同的組織組合而成,能執行特定功能的結構",
      examples: "動物:心臟、肺臟、肝臟、胃\n植物:根、莖、葉、花",
      note: "一個器官通常包含多種組織共同運作,才能完成完整的功能。",
    },
    {
      key: "system",
      name: "器官系統",
      icon: "⚙️",
      color: "#a78bfa",
      def: "由數個功能相關的器官共同組成,完成某項生理功能",
      examples: "消化系統、循環系統、呼吸系統、神經系統、運動系統(骨骼+肌肉)",
      note: "器官系統是動物特有的層次;植物通常不區分器官系統,直接由器官組成個體。",
    },
    {
      key: "organism",
      name: "個體",
      icon: "🌿",
      color: "#ff5c7a",
      def: "所有器官(或器官系統)協同運作,形成完整且能獨立生存的生命體",
      examples: "一棵樹、一隻貓、一個人",
      note: "個體是構造層次的最高階,是能夠獨立與環境互動、完成生命活動的完整單位。",
    },
  ],

  /* 排列題的正確順序 */
  _CORRECT_ORDER: ["cell", "tissue", "organ", "system", "organism"],

  state: {
    viewed: new Set(),   // 已查閱的層次 key
    sortArr: [],         // 排列題順序 (key[])
    sortDone: false,
    sortCorrect: false,
    dragging: null,
    phase: "cards",      // cards | sort
  },

  enter() {
    this.state.viewed = new Set();
    this.state.sortArr = ["tissue", "organism", "cell", "system", "organ"]; // 打亂初始順序
    this.state.sortDone = false;
    this.state.sortCorrect = false;
    this.state.dragging = null;
    this.state.phase = "cards";
    this._renderCtl && this._renderCtl();
  },

  demo() {
    const s = this.state, lv = this;
    const R = () => lv._renderCtl && lv._renderCtl();
    return [
      {
        call: () => { s.viewed = new Set(); s.phase = "cards"; R(); },
        cap: "生物體有五個構造層次,從最小到最大:細胞、組織、器官、器官系統、個體",
        dur: 3000,
      },
      {
        call: () => { s.viewed = new Set(["cell"]); R(); },
        cap: "第一層:細胞——生命的最基本單位。神經細胞、肌肉細胞都是不同的細胞",
        dur: 2800,
      },
      {
        call: () => { s.viewed = new Set(["cell","tissue"]); R(); },
        cap: "第二層:組織——形態相似、功能相同的細胞聚集成組織。例如肌肉組織",
        dur: 2800,
      },
      {
        call: () => { s.viewed = new Set(["cell","tissue","organ"]); R(); },
        cap: "第三層:器官——多種組織組合成器官。例如心臟由肌肉+結締+神經組織構成",
        dur: 2800,
      },
      {
        call: () => { s.viewed = new Set(["cell","tissue","organ","system"]); R(); },
        cap: "第四層:器官系統——功能相關的器官組成系統。例如消化系統=口腔+食道+胃+腸",
        dur: 2800,
      },
      {
        call: () => { s.viewed = new Set(["cell","tissue","organ","system","organism"]); R(); },
        cap: "第五層:個體——所有系統協同運作,形成完整的生命體。五層全部認識了!",
        dur: 3000,
      },
      {
        call: () => { s.phase = "sort"; R(); },
        cap: "現在試試看:把五個層次按從小到大排列正確!",
        dur: 2000,
      },
    ];
  },

  controls(el) {
    const s = this.state, lv = this;
    const render = () => {
      const allViewed = lv._CORRECT_ORDER.every(k => s.viewed.has(k));
      if (s.phase === "cards") {
        /* ── 卡片查閱區 ── */
        const cards = lv._LEVELS.map((lv2, i) => {
          const seen = s.viewed.has(lv2.key);
          return `
            <div class="s7a02-card${seen ? " seen" : ""}" data-key="${lv2.key}"
              style="border:2px solid ${seen ? lv2.color : "#55648f"};border-radius:8px;
                padding:8px 12px;margin:4px 0;cursor:pointer;
                background:${seen ? `${lv2.color}18` : "var(--panel2)"};
                transition:border-color .2s">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:1.4rem">${lv2.icon}</span>
                <b style="color:${seen ? lv2.color : "var(--ink)"}">${lv2.name}</b>
                ${seen ? `<span style="font-size:.75rem;color:${lv2.color}">✓ 已查閱</span>` : `<span style="font-size:.75rem;color:#9aa5c4">點擊查看</span>`}
              </div>
              ${seen ? `
              <div style="margin-top:6px;font-size:.83rem;color:var(--ink)">
                <div><b>定義:</b>${lv2.def}</div>
                <div style="margin-top:3px;white-space:pre-line"><b>舉例:</b>${lv2.examples}</div>
                <div style="margin-top:3px;color:#9aa5c4;font-size:.78rem">${lv2.note}</div>
              </div>` : ""}
            </div>`;
        }).join("");
        el.innerHTML = `
          <div style="margin-bottom:6px;font-size:.85rem;color:#9aa5c4">點選每個層次查閱說明,全部查閱後可進行排列練習</div>
          ${cards}
          ${allViewed ? `<button class="primary" id="s7a02-to-sort" style="margin-top:8px;width:100%">進行層次排列練習 →</button>` : ""}
        `;
        el.querySelectorAll(".s7a02-card").forEach(card => {
          card.onclick = () => {
            s.viewed.add(card.dataset.key);
            render();
          };
        });
        const toSortBtn = el.querySelector("#s7a02-to-sort");
        if (toSortBtn) toSortBtn.onclick = () => { s.phase = "sort"; render(); };
      } else {
        /* ── 排列練習區 ── */
        const checkOrder = () => {
          const correct = lv._CORRECT_ORDER;
          return s.sortArr.every((k, i) => k === correct[i]);
        };
        const items = s.sortArr.map((key, i) => {
          const item = lv._LEVELS.find(l => l.key === key);
          return `
            <div class="s7a02-sort-item" data-idx="${i}" data-key="${key}"
              draggable="true"
              style="display:flex;align-items:center;gap:10px;padding:9px 12px;margin:4px 0;
                border-radius:8px;border:2px solid ${s.sortDone && s.sortCorrect ? item.color : "#55648f"};
                background:var(--panel2);cursor:grab;user-select:none;
                ${s.sortDone ? "cursor:default;" : ""}">
              <span style="font-size:1.2rem">${item.icon}</span>
              <span style="font-weight:bold;color:${s.sortDone && s.sortCorrect ? item.color : "var(--ink)"}">${item.name}</span>
              <span style="font-size:.78rem;color:#9aa5c4;flex:1;text-align:right">${item.def.slice(0, 18)}…</span>
              ${!s.sortDone ? `<span style="color:#9aa5c4;font-size:.9rem">☰</span>` : ""}
            </div>`;
        }).join("");
        el.innerHTML = `
          <div style="margin-bottom:6px;font-size:.85rem;color:#9aa5c4">拖拉調整順序:從最小(細胞)到最大(個體)</div>
          <div id="s7a02-sort-zone">${items}</div>
          ${s.sortDone
            ? (s.sortCorrect
                ? `<div class="row"><b style="color:#4ade80">✓ 順序正確!五層層次全通關!</b></div>`
                : `<div class="row"><b style="color:#ff5c7a">✗ 順序不對,再拖拉試試</b><button id="s7a02-sort-reset" style="margin-left:8px">重置</button></div>`)
            : `<div class="row"><button class="primary" id="s7a02-check">確認順序</button><button id="s7a02-back-cards" style="margin-left:8px">回到卡片</button></div>`
          }
        `;

        if (!s.sortDone) {
          /* 拖放實作(PC + touch 用 click 換位) */
          let dragSrcIdx = null;
          el.querySelectorAll(".s7a02-sort-item").forEach(item => {
            item.addEventListener("dragstart", e => {
              dragSrcIdx = parseInt(item.dataset.idx);
              e.dataTransfer.effectAllowed = "move";
            });
            item.addEventListener("dragover", e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; });
            item.addEventListener("drop", e => {
              e.preventDefault();
              const dstIdx = parseInt(item.dataset.idx);
              if (dragSrcIdx === null || dragSrcIdx === dstIdx) return;
              const arr = s.sortArr.slice();
              const [moved] = arr.splice(dragSrcIdx, 1);
              arr.splice(dstIdx, 0, moved);
              s.sortArr = arr;
              dragSrcIdx = null;
              render();
            });
          });

          const checkBtn = el.querySelector("#s7a02-check");
          if (checkBtn) checkBtn.onclick = () => {
            s.sortDone = true;
            s.sortCorrect = checkOrder();
            render();
          };
          const backBtn = el.querySelector("#s7a02-back-cards");
          if (backBtn) backBtn.onclick = () => { s.phase = "cards"; render(); };
          const resetBtn = el.querySelector("#s7a02-sort-reset");
          if (resetBtn) resetBtn.onclick = () => {
            s.sortDone = false; s.sortCorrect = false;
            render();
          };
        } else {
          const resetBtn2 = el.querySelector("#s7a02-sort-reset");
          if (resetBtn2) resetBtn2.onclick = () => {
            s.sortDone = false; s.sortCorrect = false;
            render();
          };
        }
      }
    };
    this._renderCtl = render;
    render();
  },

  draw() {
    const s = this.state;
    const W = canvas.width, H = canvas.height;
    g.fillStyle = TH.bg; g.fillRect(0, 0, W, H);

    const levels = this._LEVELS;
    const N = levels.length;
    const yBase = H * 0.52;
    const yStep = 50;
    const xCenter = W * 0.5;

    /* ── 金字塔層次圖 ── */
    levels.slice().reverse().forEach((lv2, i) => {
      const ri = N - 1 - i;   // 實際 level index(cell=0,organism=4)
      const viewed = s.viewed.has(lv2.key);
      const halfW = 60 + ri * 44;
      const yTop = yBase - ri * yStep - 32;
      const yBot = yBase - ri * yStep + 18;

      /* 填色梯形 */
      g.fillStyle = viewed ? `${lv2.color}28` : `${TH.gridFaint}`;
      g.strokeStyle = viewed ? lv2.color : TH.axis;
      g.lineWidth = viewed ? 2 : 1;
      g.beginPath();
      const topHW = halfW - 16, botHW = halfW;
      g.moveTo(xCenter - topHW, yTop);
      g.lineTo(xCenter + topHW, yTop);
      g.lineTo(xCenter + botHW, yBot);
      g.lineTo(xCenter - botHW, yBot);
      g.closePath();
      g.fill(); g.stroke();

      /* 標籤 */
      const textCol = viewed ? lv2.color : TH.dim;
      pText(xCenter, (yTop + yBot) / 2 + 5, `${lv2.icon} ${lv2.name}`, textCol, 13, "center", true);
    });

    /* ── 箭頭(由下到上) ── */
    for (let i = 0; i < N - 1; i++) {
      const yMid = yBase - i * yStep;
      const col = s.viewed.has(levels[i+1].key) ? levels[i+1].color : TH.gridFaint;
      g.strokeStyle = col; g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(xCenter + 70 + i * 44 + 14, yMid - 8);
      g.lineTo(xCenter + 70 + i * 44 + 14, yMid - 24);
      g.stroke();
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(xCenter + 70 + i * 44 + 14, yMid - 30);
      g.lineTo(xCenter + 70 + i * 44 + 8, yMid - 22);
      g.lineTo(xCenter + 70 + i * 44 + 20, yMid - 22);
      g.closePath();
      g.fill();
    }

    /* ── 目標達成(在 draw 裡重試,等 player 停下來才過關) ── */
    if (s.viewed.size === N) markGoal("S7A_02-a");
    if (s.sortDone && s.sortCorrect) markGoal("S7A_02-b");

    /* ── readout ── */
    const viewedN = s.viewed.size;
    readout.innerHTML = s.phase === "sort"
      ? `拖拉排列:由小到大排列五個構造層次`
      : `已查閱 <b>${viewedN}/${N}</b> 個層次`;
  },
};

/* ================================================================
   S7A_02_DRILL — S7A_02 段考題庫(構造層次)
   知識點:細胞→組織→器官→器官系統→個體;動植物組織;器官系統
   ================================================================ */
const S7A_02_QUESTIONS = [
  {
    tid: "s7a_02_q1",
    q: "生物體的構造層次,由小到大的正確順序是?",
    opts: [
      "A. 細胞 → 器官 → 組織 → 器官系統 → 個體",
      "B. 細胞 → 組織 → 器官 → 器官系統 → 個體",
      "C. 組織 → 細胞 → 器官 → 個體 → 器官系統",
      "D. 細胞 → 組織 → 器官系統 → 器官 → 個體",
    ],
    ans: "B",
    why: "正確順序(由小到大):細胞 → 組織 → 器官 → 器官系統 → 個體。",
  },
  {
    tid: "s7a_02_q2",
    q: "「由許多形態相似、功能相同的細胞聚集而成」,這段描述指的是哪個構造層次?",
    opts: ["A. 器官", "B. 個體", "C. 組織", "D. 器官系統"],
    ans: "C",
    why: "組織的定義:形態相似、功能相同的細胞聚集而成。例如肌肉組織、上皮組織。",
  },
  {
    tid: "s7a_02_q3",
    q: "心臟是由多種不同組織組合而成,能執行特定功能,它屬於哪個構造層次?",
    opts: ["A. 細胞", "B. 組織", "C. 器官", "D. 器官系統"],
    ans: "C",
    why: "心臟由肌肉組織、結締組織、神經組織等組成,能執行特定功能(幫浦血液),因此是器官層次。",
  },
  {
    tid: "s7a_02_q4",
    q: "「消化系統」包含口腔、食道、胃、小腸、大腸等,它屬於哪個構造層次?",
    opts: ["A. 器官", "B. 器官系統", "C. 組織", "D. 個體"],
    ans: "B",
    why: "由多個功能相關的器官共同組成、完成某項生理功能,稱為器官系統;消化系統由多個消化器官組成。",
  },
  {
    tid: "s7a_02_q5",
    q: "下列哪一項不是動物常見的「組織」類型?",
    opts: ["A. 肌肉組織", "B. 神經組織", "C. 輸導組織", "D. 結締組織"],
    ans: "C",
    why: "輸導組織是植物特有的組織(負責運輸水分與養分);動物的四大基本組織為上皮、肌肉、神經、結締組織。",
  },
  {
    tid: "s7a_02_q6",
    q: "植物的根、莖、葉、花分別屬於哪個構造層次?",
    opts: ["A. 細胞", "B. 組織", "C. 器官", "D. 器官系統"],
    ans: "C",
    why: "根、莖、葉、花各自由多種組織組合而成,能執行特定功能(如葉進行光合作用),屬於器官層次。",
  },
  {
    tid: "s7a_02_q7",
    q: "下列關於「個體」的描述,哪一項是正確的?",
    opts: [
      "A. 個體是所有器官(或器官系統)協同運作形成的最高層次,能獨立生存",
      "B. 個體就是器官系統的另一個名稱",
      "C. 植物沒有個體層次",
      "D. 個體是由單一器官所組成的",
    ],
    ans: "A",
    why: "個體是由所有器官(或器官系統)協同運作形成的最高層次,能夠獨立生存與環境互動;動植物都有個體層次。",
  },
  {
    tid: "s7a_02_q8",
    q: "下列哪一項,是「植物」特有而動物沒有的組織類型?",
    opts: ["A. 上皮組織", "B. 肌肉組織", "C. 保護組織", "D. 神經組織"],
    ans: "C",
    why: "保護組織是植物特有的組織,覆蓋在植物體表面(如表皮);動物四大基本組織為上皮、肌肉、神經、結締組織,均為動物才有的組織類型。",
  },
  {
    tid: "s7a_02_q9",
    q: "生物體中構造層次的概念主要在說明什麼?",
    opts: [
      "A. 生物的演化歷史",
      "B. 生物體內部的組織方式,從最基本的細胞到完整個體",
      "C. 不同物種之間的親緣關係",
      "D. 生物分類的依據",
    ],
    ans: "B",
    why: "構造層次描述的是生物體的組成方式——從最基本的細胞,到組織、器官、器官系統,最後形成完整個體;不涉及演化或分類。",
  },
  {
    tid: "s7a_02_q10",
    q: "下列何者正確描述了「組織」和「器官」的差異?",
    opts: [
      "A. 組織由器官組成,器官由細胞組成",
      "B. 組織由相似細胞組成;器官由多種組織組成",
      "C. 組織和器官是同一個層次的不同說法",
      "D. 器官的層次比個體還高",
    ],
    ans: "B",
    why: "組織:由形態相似、功能相同的細胞聚集而成。器官:由多種不同組織組合而成,能執行特定功能。層次:組織 < 器官。",
  },
];

const S7A_02_DRILL = makeStaticSciDrill(
  "S7A_02D",
  "構造層次段考練習",
  "段考練習|S7A-2D:構造層次段考題庫",
  `<p>本關模擬七上自然段考——<b>10 題</b>,涵蓋細胞→組織→器官→器官系統→個體的定義、舉例與辨別。</p><p>點選正確選項,答完後可看詳解與成績;答對率 ≥75% 解鎖通關。</p>`,
  "完成段考練習且答對率 ≥75%(構造層次)",
  S7A_02_QUESTIONS
);

/* ================================================================
   S7A_03 — 自然界的尺度與單位
   互動:測量工具配對(工具卡片點選對應到物理量)
   課綱:Ea-Ⅳ(科學方法與測量/SI 單位)
   ================================================================ */
const S7A_03 = {
  id: "S7A_03", short: "尺度與單位",
  title: "關 S7A-3|自然界的尺度與單位",
  ep: "S", subj: "s7a",
  intro: `<p>科學測量要有共同的語言——<b>SI 單位</b>。長度的單位是<b>公尺</b>(m)、質量是<b>公斤</b>(kg)、時間是<b>秒</b>(s)。</p><p>把右邊的<b>測量工具</b>和它對應的<b>物理量</b>配對起來,再練習常用的單位換算!</p>`,
  formal: `<p class="math">長度:1 m = 100 cm = 1000 mm　質量:1 kg = 1000 g　時間:1 min = 60 s<br>科學記號:3000 = 3×10³　0.002 = 2×10⁻³　課綱:Ea-Ⅳ</p>`,
  goals: [
    { id: "S7A_03-a", text: "正確配對全部 3 種測量工具" },
    { id: "S7A_03-b", text: "完成 3 題單位換算練習" },
  ],

  /* 工具配對資料 */
  _TOOLS: [
    { tool: "刻度尺／游標卡尺", qty: "長度", icon: "📏", color: "#38bdf8",
      note: "刻度尺測公分級;游標卡尺可到 0.1 mm" },
    { tool: "天平",             qty: "質量", icon: "⚖️", color: "#fbbf24",
      note: "天平比較左右兩邊的質量是否平衡" },
    { tool: "碼錶",             qty: "時間", icon: "⏱️", color: "#4ade80",
      note: "碼錶可精確計時到 0.01 秒" },
  ],

  /* 換算練習題 */
  _CONV: [
    { q: "1 公尺 = __ 公分", ans: "100", hint: "1 m = 100 cm" },
    { q: "2 公斤 = __ 公克", ans: "2000", hint: "1 kg = 1000 g, 所以 2 kg = 2000 g" },
    { q: "3 分鐘 = __ 秒",   ans: "180", hint: "1 min = 60 s, 所以 3 min = 180 s" },
  ],

  state: {
    matched: {},   // { qty: tool } 已配對
    selected: null, // 目前選中的工具 tool 字串
    convIdx: 0,
    convInput: "",
    convDone: [],  // 已完成的換算索引
    phase: "match", // match | conv
  },

  enter() {
    Object.assign(this.state, {
      matched: {}, selected: null,
      convIdx: 0, convInput: "", convDone: [],
      phase: "match",
    });
    this._renderCtl && this._renderCtl();
  },

  demo() {
    const s = this.state, lv = this;
    const R = () => lv._renderCtl && lv._renderCtl();
    return [
      {
        call: () => { s.matched = {}; s.selected = null; s.phase = "match"; R(); },
        cap: "科學家測量自然界時,需要統一的單位。長度、質量、時間是最基本的三個量。",
        dur: 3000,
      },
      {
        call: () => { s.matched = {}; s.selected = "刻度尺／游標卡尺"; R(); },
        cap: "長度的國際單位是公尺。一公尺等於一百公分,一公分等於十毫米。",
        dur: 2800,
      },
      {
        call: () => { s.matched = { "長度": "刻度尺／游標卡尺" }; s.selected = null; R(); },
        cap: "質量的國際單位是公斤。一公斤等於一千公克。測量質量要用天平。",
        dur: 2800,
      },
      {
        call: () => { s.matched = { "長度": "刻度尺／游標卡尺", "質量": "天平" }; R(); },
        cap: "時間的國際單位是秒。一分鐘等於六十秒,一小時等於六十分鐘。測量時間用碼錶。",
        dur: 2800,
      },
      {
        call: () => {
          s.matched = { "長度": "刻度尺／游標卡尺", "質量": "天平", "時間": "碼錶" };
          R();
        },
        cap: "測量很大或很小的數,可以用科學記號。例如三千等於三乘以十的三次方。",
        dur: 2800,
      },
      {
        call: () => { s.phase = "conv"; s.convIdx = 0; s.convInput = ""; s.convDone = []; R(); },
        cap: "現在來挑戰:把測量工具和它對應的物理量配對起來吧!",
        dur: 2200,
      },
    ];
  },

  controls(el) {
    const s = this.state, lv = this;
    const render = () => {
      /* ── 配對階段 ── */
      if (s.phase === "match") {
        const allMatched = lv._TOOLS.every(t => s.matched[t.qty] === t.tool);

        /* 工具按鈕列 */
        const toolBtns = lv._TOOLS.map(t => {
          const sel = s.selected === t.tool;
          const usedFor = Object.entries(s.matched).find(([, v]) => v === t.tool);
          const done = !!usedFor;
          const matchedQty = usedFor ? usedFor[0] : null;
          const matchColor = done ? t.color : (sel ? "#ffd166" : "#55648f");
          return `<button class="s7a03-tool" data-tool="${t.tool}"
            style="display:flex;align-items:center;gap:8px;padding:8px 12px;
              margin:4px 0;width:100%;border:2px solid ${matchColor};
              border-radius:8px;background:${done ? t.color + "22" : (sel ? "rgba(255,209,102,.12)" : "var(--panel2)")};
              cursor:${done ? "default" : "pointer"};font-size:.9rem;font-family:inherit;color:var(--ink);
              ${done ? "pointer-events:none;" : ""}">
            <span style="font-size:1.3rem">${t.icon}</span>
            <span style="font-weight:bold">${t.tool}</span>
            ${done ? `<span style="margin-left:auto;font-size:.78rem;color:${t.color}">✓ ${matchedQty}</span>` : ""}
            ${sel ? `<span style="margin-left:auto;font-size:.78rem;color:#ffd166">已選取</span>` : ""}
          </button>`;
        }).join("");

        /* 物理量按鈕列 */
        const qtyBtns = lv._TOOLS.map(t => {
          const matched = s.matched[t.qty];
          const done = !!matched;
          return `<button class="s7a03-qty" data-qty="${t.qty}"
            style="display:flex;align-items:center;gap:8px;padding:8px 12px;
              margin:4px 0;width:100%;border:2px solid ${done ? t.color : (s.selected ? "#a78bfa" : "#55648f")};
              border-radius:8px;background:${done ? t.color + "22" : "var(--panel2)"};
              cursor:${done ? "default" : (s.selected ? "pointer" : "default")};
              font-size:.9rem;font-family:inherit;color:var(--ink);
              ${done ? "pointer-events:none;" : ""}">
            <span style="font-size:1.1rem">📦</span>
            <span style="font-weight:bold">${t.qty}</span>
            ${done ? `<span style="margin-left:auto;font-size:.78rem;color:${t.color}">✓ ${matched}</span>` : ""}
          </button>`;
        }).join("");

        el.innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <div style="font-size:.82rem;color:#9aa5c4;margin-bottom:4px">① 點選測量工具</div>
              ${toolBtns}
            </div>
            <div>
              <div style="font-size:.82rem;color:#9aa5c4;margin-bottom:4px">② 點選對應的物理量</div>
              ${qtyBtns}
            </div>
          </div>
          ${s.selected ? `<div style="margin-top:6px;font-size:.84rem;color:#ffd166">已選:${s.selected}　→ 請點右側物理量完成配對</div>` : ""}
          ${allMatched ? `<div style="margin-top:8px"><button class="primary" id="s7a03-to-conv">進入換算練習 →</button></div>` : ""}
          ${allMatched ? `<div style="color:#4ade80;margin-top:4px;font-size:.85rem">配對全對!繼續換算練習</div>` : ""}
        `;

        /* 選工具 */
        el.querySelectorAll(".s7a03-tool").forEach(btn => {
          btn.onclick = () => {
            s.selected = btn.dataset.tool;
            render();
          };
        });
        /* 配對物理量 */
        el.querySelectorAll(".s7a03-qty").forEach(btn => {
          btn.onclick = () => {
            if (!s.selected) return;
            const qty = btn.dataset.qty;
            /* 若該 qty 已被配對,先解除 */
            if (s.matched[qty]) delete s.matched[qty];
            /* 若 selected 已配到別的 qty,先解除 */
            const old = Object.entries(s.matched).find(([, v]) => v === s.selected);
            if (old) delete s.matched[old[0]];
            s.matched[qty] = s.selected;
            s.selected = null;
            render();
            if (lv._TOOLS.every(t => s.matched[t.qty] === t.tool)) markGoal("S7A_03-a");
          };
        });
        const toConv = el.querySelector("#s7a03-to-conv");
        if (toConv) toConv.onclick = () => { s.phase = "conv"; s.convIdx = 0; s.convInput = ""; render(); };
        return;
      }

      /* ── 換算練習階段 ── */
      if (s.phase === "conv") {
        const allConvDone = s.convDone.length >= lv._CONV.length;
        if (allConvDone) {
          el.innerHTML = `
            <div style="color:#4ade80;font-size:1rem;margin-bottom:8px">換算全對!三種基本量都學會了!</div>
            <div style="font-size:.85rem;color:#9aa5c4;margin-bottom:8px">
              1 m = 100 cm = 1000 mm<br>
              1 kg = 1000 g<br>
              1 min = 60 s
            </div>
            <button class="primary" id="s7a03-back">回到配對</button>
          `;
          el.querySelector("#s7a03-back").onclick = () => { s.phase = "match"; render(); };
          markGoal("S7A_03-b");
          return;
        }
        const ci = s.convIdx < lv._CONV.length ? s.convIdx : 0;
        const cur = lv._CONV[ci];
        const answered = s.convDone.includes(ci);
        const correct = s.convInput.trim() === cur.ans;
        el.innerHTML = `
          <div style="font-size:.82rem;color:#9aa5c4;margin-bottom:4px">換算練習 ${ci + 1}/${lv._CONV.length}</div>
          <div style="font-size:1rem;font-weight:bold;margin-bottom:10px">${cur.q}</div>
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
            <input id="s7a03-ans" type="number" placeholder="填入數字"
              value="${s.convInput}"
              style="width:120px;padding:6px 10px;border-radius:6px;border:1.5px solid ${answered ? (correct ? "#4ade80" : "#ff5c7a") : "#55648f"};
                background:var(--panel2);color:var(--ink);font-size:1rem;font-family:inherit">
            ${!answered ? `<button class="primary" id="s7a03-check">確認</button>` : ""}
          </div>
          ${answered ? `<div class="quiz-msg" style="color:${correct ? "#4ade80" : "#ff5c7a"}">${correct ? "✓ 正確!" : "✗ " + cur.hint}</div>` : ""}
          ${answered ? `<div class="row"><button class="primary" id="s7a03-next">${ci + 1 < lv._CONV.length ? "下一題" : "完成"}</button></div>` : ""}
        `;
        const inp = el.querySelector("#s7a03-ans");
        if (inp && !answered) {
          inp.oninput = () => { s.convInput = inp.value; };
          inp.onkeydown = e => { if (e.key === "Enter") el.querySelector("#s7a03-check") && el.querySelector("#s7a03-check").click(); };
        }
        const checkBtn = el.querySelector("#s7a03-check");
        if (checkBtn) checkBtn.onclick = () => {
          s.convInput = (inp ? inp.value : s.convInput);
          if (!s.convDone.includes(ci)) s.convDone.push(ci);
          render();
        };
        const nextBtn = el.querySelector("#s7a03-next");
        if (nextBtn) nextBtn.onclick = () => {
          s.convIdx = ci + 1;
          s.convInput = "";
          render();
        };
      }
    };
    this._renderCtl = render;
    render();
  },

  draw() {
    const s = this.state;
    const W = canvas.width, H = canvas.height;
    g.fillStyle = TH.bg; g.fillRect(0, 0, W, H);

    const tools = this._TOOLS;
    const yBase = H * 0.38;
    const xStep = W / (tools.length + 1);

    tools.forEach((t, i) => {
      const x = xStep * (i + 1);
      const matched = Object.entries(s.matched).find(([, v]) => v === t.tool);
      const done = !!matched;
      const col = done ? t.color : TH.dim;

      /* 工具圖示圓 */
      drawDisc(x, yBase, 36, done ? t.color + "33" : TH.gridFaint + "88", done ? t.color : TH.axis, 2);
      pText(x, yBase + 9, t.icon, col, 28, "center");
      pText(x, yBase + 54, t.tool, col, 12, "center", true);

      /* 配對箭頭 + 物理量 */
      if (done) {
        g.strokeStyle = t.color; g.lineWidth = 2;
        g.setLineDash([5, 3]);
        g.beginPath();
        g.moveTo(x, yBase + 70);
        g.lineTo(x, yBase + 110);
        g.stroke();
        g.setLineDash([]);
        pText(x, yBase + 130, t.qty, t.color, 15, "center", true);
        pText(x, yBase + 152, t.note, TH.dim, 10.5, "center");
      } else {
        pText(x, yBase + 76, "?", TH.gridFaint, 18, "center");
      }
    });

    /* 科學記號示意 */
    const sciY = H * 0.82;
    pText(CX, sciY, "科學記號: 3000 = 3×10³   0.002 = 2×10⁻³", TH.dim, 12.5, "center");

    /* readout */
    const n = Object.keys(s.matched).length;
    if (s.phase === "conv") {
      readout.innerHTML = `換算練習 ${Math.min(s.convIdx + 1, this._CONV.length)}/${this._CONV.length}`;
    } else {
      readout.innerHTML = `已配對 <b>${n}/${tools.length}</b> 個工具`;
    }
  },
};

/* ================================================================
   S7A_03_QUESTIONS — 段考題庫(自然界的尺度與單位)
   知識點:Ea-Ⅳ SI 單位、單位換算、測量工具、科學記號、尺度比較
   ================================================================ */
const S7A_03_QUESTIONS = [
  {
    tid: "s7a_03_q1",
    q: "下列哪一個是「長度」的 SI 國際單位?",
    opts: ["A. 公克(g)", "B. 公尺(m)", "C. 秒(s)", "D. 公升(L)"],
    ans: "B",
    why: "長度的 SI 基本單位是公尺(m);公克是質量單位,秒是時間單位,公升是體積單位。",
  },
  {
    tid: "s7a_03_q2",
    q: "1 公尺等於多少公分?",
    opts: ["A. 10 公分", "B. 100 公分", "C. 1000 公分", "D. 0.1 公分"],
    ans: "B",
    why: "1 m = 100 cm;公制前綴 c(centi)代表 1/100,所以 1 公尺 = 100 公分。",
  },
  {
    tid: "s7a_03_q3",
    q: "測量物體「質量」時,應使用哪種儀器?",
    opts: ["A. 刻度尺", "B. 碼錶", "C. 天平", "D. 溫度計"],
    ans: "C",
    why: "天平是測量質量的工具;刻度尺測長度,碼錶測時間,溫度計測溫度。",
  },
  {
    tid: "s7a_03_q4",
    q: "2.5 公斤等於多少公克?",
    opts: ["A. 25 公克", "B. 250 公克", "C. 2500 公克", "D. 25000 公克"],
    ans: "C",
    why: "1 kg = 1000 g,所以 2.5 kg = 2.5 × 1000 = 2500 g。",
  },
  {
    tid: "s7a_03_q5",
    q: "下列哪種儀器最適合測量「短跑 100 公尺的時間」?",
    opts: ["A. 刻度尺", "B. 天平", "C. 溫度計", "D. 碼錶"],
    ans: "D",
    why: "碼錶是測量時間的工具,可精確計時到 0.01 秒;適合測量短跑等運動時間。",
  },
  {
    tid: "s7a_03_q6",
    q: "3000 用科學記號表示為何?",
    opts: ["A. 3 × 10²", "B. 30 × 10²", "C. 3 × 10³", "D. 3 × 10⁴"],
    ans: "C",
    why: "3000 = 3 × 1000 = 3 × 10³;科學記號要求係數在 1 以上、10 未滿,再乘以 10 的冪次。",
  },
  {
    tid: "s7a_03_q7",
    q: "1 分鐘等於多少秒?",
    opts: ["A. 10 秒", "B. 60 秒", "C. 100 秒", "D. 3600 秒"],
    ans: "B",
    why: "1 分鐘 = 60 秒;1 小時 = 60 分鐘 = 3600 秒。",
  },
  {
    tid: "s7a_03_q8",
    q: "下列物理量與其 SI 單位的配對,哪一項是正確的?",
    opts: [
      "A. 質量—秒(s)",
      "B. 長度—公克(g)",
      "C. 時間—公尺(m)",
      "D. 質量—公斤(kg)",
    ],
    ans: "D",
    why: "質量的 SI 單位是公斤(kg);長度是公尺(m),時間是秒(s)。",
  },
  {
    tid: "s7a_03_q9",
    q: "下列哪個數值用科學記號表示為 5 × 10⁻³?",
    opts: ["A. 500", "B. 0.5", "C. 0.005", "D. 5000"],
    ans: "C",
    why: "5 × 10⁻³ = 5 × 0.001 = 0.005;負指數代表小數,指數為 −3 即小數點後三位。",
  },
  {
    tid: "s7a_03_q10",
    q: "小明要測量一枚硬幣的直徑,哪種工具最合適?",
    opts: ["A. 碼錶", "B. 天平", "C. 刻度尺或游標卡尺", "D. 溫度計"],
    ans: "C",
    why: "硬幣直徑屬於長度測量,應使用刻度尺或游標卡尺;游標卡尺精度更高(可到 0.1 mm),適合小物體測量。",
  },
];

const S7A_03_DRILL = makeStaticSciDrill(
  "S7A_03D",
  "尺度與單位段考練習",
  "段考練習|S7A-3D:尺度與單位段考題庫",
  `<p>本關模擬七上自然段考——<b>10 題</b>,涵蓋 SI 單位、單位換算、測量工具選擇、科學記號等知識點。</p><p>點選正確選項,答完後可看詳解與成績;答對率 ≥75% 解鎖通關。</p>`,
  "完成段考練習且答對率 ≥75%(尺度與單位)",
  S7A_03_QUESTIONS
);

/* ================================================================
   SCIENCE7A_REGISTRY — 供 main.js subject-loader 使用
   key = level id, value = 完整關卡物件(含 draw/demo/controls)
   ================================================================ */
const SCIENCE7A_REGISTRY = {
  S7A_01,
  S7A_01D: S7A_01_DRILL,
  S7A_02,
  S7A_02D: S7A_02_DRILL,
  S7A_03,
  S7A_03D: S7A_03_DRILL,
};

/* 科目定義:subject-loader 會讀這個全域 */
window.__SUBJECT_SCIENCE7A__ = {
  subjectKey: "s7a",
  subjectName: "七上自然",
  levels: [S7A_01, S7A_01_DRILL, S7A_02, S7A_02_DRILL, S7A_03, S7A_03_DRILL],
};

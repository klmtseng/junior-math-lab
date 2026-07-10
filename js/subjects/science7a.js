/* science7a.js — 七上自然科關卡實作
   依賴 main.js 全域:g, canvas, CX, CY, TH, pText, drawDisc, readout,
   markGoal, progress, player, dragTarget, EP
   ================================================================ */
"use strict";

/* ---------- EP 自然科來源標記 ---------- */
// 掛到 EP 讓 switchLevel 能讀到 ep link
EP["S"] = ["臺灣國中七上自然科(原創)", "https://github.com/klmtseng/junior-math-lab"];

/* ================================================================
   S7A_01 — 細胞基本構造(拖曳:把構造放進植物/動物細胞)
   互動:7 個構造標籤常駐於來源清單,拖曳(或點選)放入「植物細胞」
         或「動物細胞」放置區,宣告「該構造存在於此細胞」。
         共有構造要兩區都放;植物特有只放植物區。來源清單不消失,
         同一構造可放到兩區;已放入的可移除(點 ✕)。
         全部 7×2=14 個歸屬判斷都正確才通關。答錯處標紅並顯示正解。
   ================================================================ */
const S7A_01 = {
  id: "S7A_01", short: "細胞構造",
  title: "關 S7A-1|細胞:植物與動物的不同長相",
  ep: "S", subj: "s7a",
  intro: `<p>所有生物都由<b>細胞</b>組成。有些構造<b>植物才有</b>,有些是<b>動植物共有</b>。</p><p>把下方的 7 個構造標籤,<b>拖曳</b>(或先點標籤再點細胞)放進「植物細胞」或「動物細胞」——<b>共有的構造要兩區都放</b>。全部歸屬正確才過關。</p>`,
  formal: `<p class="math">植物細胞<b>特有</b>:細胞壁、葉綠體。動植物<b>共有</b>:液胞、細胞膜、細胞核、細胞質、粒線體。注意:動植物細胞都有液胞,只有<b>大型中央液胞</b>(大而集中)才是植物特有;拖曳時共有構造記得兩區都放。</p>`,
  goals: [
    { id: "S7A_01-a", text: "正確把 7 個構造拖入植物/動物細胞(共 14 歸屬全對)" },
  ],

  /* 構造資料:hasPlant / hasAnimal = 正解;desc = 提示/解析 */
  _PARTS: [
    { name: "細胞壁",  hasPlant: true,  hasAnimal: false, desc: "植物細胞外層硬殼,提供支撐與保護;動物細胞沒有" },
    { name: "葉綠體",  hasPlant: true,  hasAnimal: false, desc: "進行光合作用,把陽光轉成有機物;動物細胞沒有" },
    { name: "液胞",    hasPlant: true,  hasAnimal: true,  desc: "動植物細胞都有液胞;植物為大型中央液胞(大而集中),動物液胞小而多" },
    { name: "細胞膜",  hasPlant: true,  hasAnimal: true,  desc: "控制物質進出;動植物都有" },
    { name: "細胞核",  hasPlant: true,  hasAnimal: true,  desc: "含 DNA,控制細胞活動;動植物都有" },
    { name: "細胞質",  hasPlant: true,  hasAnimal: true,  desc: "細胞膜內的膠狀基質,胞器懸浮其中;動植物都有" },
    { name: "粒線體",  hasPlant: true,  hasAnimal: true,  desc: "細胞的能量工廠,進行細胞呼吸;動植物都有" },
  ],

  /* state.place: { plant: [name…], animal: [name…] }(拖入各區的構造)
     state.sel:   目前點選待放置的構造名(觸控/點擊 fallback);
     state.checked: 是否已按「檢查答案」(顯示對錯回饋)*/
  state: { place: { plant: [], animal: [] }, sel: null, checked: false },

  _blank() { return { plant: [], animal: [] }; },

  enter() {
    this.state.place = this._blank();
    this.state.sel = null;
    this.state.checked = false;
    this._renderCtl && this._renderCtl();
  },

  /* demo:自動示範如何拖曳放置(6 步,對應旁白 S7A_01_0..5)*/
  demo() {
    const s = this.state, lv = this;
    const R = () => lv._renderCtl && lv._renderCtl();
    const put = (name, zone) => { if (!s.place[zone].includes(name)) s.place[zone].push(name); };
    return [
      {
        call: () => { s.place = lv._blank(); s.sel = null; s.checked = false; R(); },
        cap: "細胞是生命的基本單位。把每個構造拖進它存在的細胞。先看哪些構造只有植物才有?",
        dur: 2800,
      },
      {
        call: () => { put("細胞壁", "plant"); R(); },
        cap: "細胞壁只拖進植物細胞。它就像房子的外牆,提供支撐,動物細胞沒有這層硬殼",
        dur: 2600,
      },
      {
        call: () => { put("葉綠體", "plant"); R(); },
        cap: "葉綠體也只拖進植物細胞。負責光合作用,把陽光轉成養分,動物不行光合作用",
        dur: 2600,
      },
      {
        call: () => { put("液胞", "plant"); put("液胞", "animal"); R(); },
        cap: "液胞動植物都有,所以植物和動物細胞都要放。植物是大型中央液胞,動物的液胞小而多",
        dur: 3000,
      },
      {
        call: () => {
          ["細胞膜", "細胞核", "細胞質", "粒線體"].forEach(n => { put(n, "plant"); put(n, "animal"); });
          R();
        },
        cap: "細胞膜、細胞核、細胞質、粒線體動植物都有,所以植物和動物細胞兩區都要放進去",
        dur: 3200,
      },
      {
        call: () => { s.place = lv._blank(); s.sel = null; s.checked = false; R(); },
        cap: "換你試試!把每個構造拖進它存在的細胞,共有的構造兩區都要放",
        dur: 2000,
      },
    ];
  },

  /* controls:拖曳把構造放進「植物細胞」/「動物細胞」放置區 */
  controls(el) {
    const s = this.state, lv = this;
    const partOf = (name) => lv._PARTS.find(p => p.name === name);

    /* 單一歸屬是否正確(zone = "plant"|"animal") */
    const has = (zone, name) => s.place[zone].includes(name);
    const zoneRight = (p, zone) =>
      (has(zone, p.name) === (zone === "plant" ? p.hasPlant : p.hasAnimal));
    const allRight = () => lv._PARTS.every(p => zoneRight(p, "plant") && zoneRight(p, "animal"));
    const wrongCount = () =>
      lv._PARTS.reduce((n, p) => n + (zoneRight(p, "plant") ? 0 : 1) + (zoneRight(p, "animal") ? 0 : 1), 0);

    /* 放入一個構造(同一構造可入兩區;來源清單不移除)*/
    const place = (name, zone) => {
      if (!s.place[zone].includes(name)) s.place[zone].push(name);
      s.checked = false; s.sel = null;
    };
    const remove = (name, zone) => {
      s.place[zone] = s.place[zone].filter(n => n !== name);
      s.checked = false;
    };

    const render = () => {
      const checked = s.checked;
      const good = allRight();

      /* 來源清單:7 個構造常駐(可重複拖去兩區)*/
      const src = lv._PARTS.map(p =>
        `<div class="dc-src${s.sel === p.name ? " dc-sel" : ""}" draggable="true"
              data-name="${p.name}" title="${p.desc}">${p.name}</div>`).join("");

      /* 一區內的 chip:含對錯底色與 ✕ 移除 */
      const chip = (zone, name) => {
        const p = partOf(name);
        const want = zone === "plant" ? p.hasPlant : p.hasAnimal;
        const ok = want === true;    // 已放入 → 只要「該區確實該有」就是對
        const cls = "dc-chip" + (checked ? (ok ? " dc-ok" : " dc-bad") : "");
        return `<span class="${cls}" data-name="${name}" data-zone="${zone}">
                  ${name}<b class="dc-x" data-name="${name}" data-zone="${zone}">✕</b>
                </span>`;
      };
      /* 檢查後:列出該區「漏放」的正解構造 */
      const missing = (zone) => {
        if (!checked) return "";
        const miss = lv._PARTS.filter(p =>
          (zone === "plant" ? p.hasPlant : p.hasAnimal) && !has(zone, p.name));
        return miss.length
          ? `<div class="dc-fix">還缺:${miss.map(p => p.name).join("、")}</div>` : "";
      };

      const zoneHtml = (zone, label, emoji) => `
        <div class="dc-zone" data-zone="${zone}">
          <div class="dc-zone-h">${emoji} ${label}</div>
          <div class="dc-zone-body">
            ${s.place[zone].map(n => chip(zone, n)).join("") ||
              `<span class="dc-empty">把構造拖到這裡</span>`}
          </div>
          ${missing(zone)}
        </div>`;

      el.innerHTML = `
        <style>
          .dragcell { font-size: 14px; }
          .dc-srclist { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
          .dc-src { padding: 6px 10px; border: 1.5px solid #55648f; border-radius: 7px;
            background: #1d2440; color: #dfe4f5; cursor: grab; user-select: none; font-weight: 600; }
          .dc-src:hover { background: #2e3a63; }
          .dc-src.dc-sel { border-color: #ffd166; box-shadow: 0 0 0 2px rgba(255,209,102,.35); }
          .dc-zones { display: flex; gap: 8px; }
          .dc-zone { flex: 1; border: 2px dashed #39456e; border-radius: 9px; padding: 6px; min-height: 84px;
            transition: border-color .12s, background .12s; }
          .dc-zone.dc-over { border-color: #6ee7a0; background: rgba(110,231,160,.08); }
          .dc-zone-h { font-size: 13px; color: #9aa5c4; margin-bottom: 5px; font-weight: 700; }
          .dc-zone[data-zone="plant"] .dc-zone-h { color: #6ee7a0; }
          .dc-zone[data-zone="animal"] .dc-zone-h { color: #f0b56b; }
          .dc-zone-body { display: flex; flex-wrap: wrap; gap: 5px; min-height: 34px; }
          .dc-empty { color: #55648f; font-size: 12px; padding: 6px 2px; }
          .dc-chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 6px 4px 9px;
            border: 1.5px solid #55648f; border-radius: 14px; background: #1d2440; color: #dfe4f5; font-size: 13px; }
          .dc-chip.dc-ok  { border-color: #4ade80; background: rgba(74,222,128,.14); }
          .dc-chip.dc-bad { border-color: #ff5c7a; background: rgba(255,92,122,.16); }
          .dc-x { cursor: pointer; color: #9aa5c4; font-size: 11px; padding: 0 2px; }
          .dc-x:hover { color: #ff8fa3; }
          .dc-fix { font-size: 11px; color: #ff8fa3; margin-top: 4px; }
          .dc-actions { margin-top: 8px; display: flex; gap: 8px; align-items: center; }
          .dc-msg { margin-top: 6px; }
          .dc-tip { font-size: 12px; color: #9aa5c4; margin-bottom: 6px; }
        </style>
        <div class="dragcell">
          <div class="dc-tip">拖曳構造到細胞區(或先點構造、再點細胞);共有的構造兩區都要放,已放入的點 ✕ 移除。</div>
          <div class="dc-srclist">${src}</div>
          <div class="dc-zones">
            ${zoneHtml("plant", "植物細胞", "🌿")}
            ${zoneHtml("animal", "動物細胞", "🐾")}
          </div>
          <div class="dc-actions">
            <button id="dc-check">檢查答案</button>
            <button id="dc-reset">清除重做</button>
          </div>
          ${checked ? `<div class="row quiz-msg dc-msg">${good
              ? '<b style="color:#4ade80">全部正確!你分清楚了植物特有(細胞壁、葉綠體)與動植物共有的構造。</b>'
              : `<b style="color:#ff5c7a">還有 ${wrongCount()} 個歸屬要修正</b>(紅色標籤是放錯的;各區下方列出漏放的構造;共有構造記得兩區都放)`}</div>` : ""}
        </div>
      `;

      /* ── 來源標籤:HTML5 拖曳 + 點選(觸控 fallback)── */
      el.querySelectorAll(".dc-src").forEach(node => {
        node.addEventListener("dragstart", e => {
          e.dataTransfer.effectAllowed = "copy";
          e.dataTransfer.setData("text/plain", node.dataset.name);
        });
        node.onclick = () => { s.sel = (s.sel === node.dataset.name) ? null : node.dataset.name; render(); };
      });

      /* ── 放置區:接受拖放 + 點擊(承接已選構造)── */
      el.querySelectorAll(".dc-zone").forEach(zoneEl => {
        const zone = zoneEl.dataset.zone;
        zoneEl.addEventListener("dragover", e => {
          e.preventDefault(); e.dataTransfer.dropEffect = "copy";
          zoneEl.classList.add("dc-over");
        });
        zoneEl.addEventListener("dragleave", () => zoneEl.classList.remove("dc-over"));
        zoneEl.addEventListener("drop", e => {
          e.preventDefault(); zoneEl.classList.remove("dc-over");
          const name = e.dataTransfer.getData("text/plain");
          if (name) { place(name, zone); render(); }
        });
        zoneEl.onclick = (e) => {
          if (e.target.classList.contains("dc-x")) return;   // ✕ 自行處理
          if (s.sel) { place(s.sel, zone); render(); }
        };
      });

      /* ── ✕ 移除 ── */
      el.querySelectorAll(".dc-x").forEach(x => {
        x.onclick = (e) => {
          e.stopPropagation();
          remove(x.dataset.name, x.dataset.zone);
          render();
        };
      });

      el.querySelector("#dc-check").onclick = () => { s.checked = true; s.sel = null; render(); };
      el.querySelector("#dc-reset").onclick = () => { s.place = lv._blank(); s.sel = null; s.checked = false; render(); };

      if (s.checked && good) markGoal("S7A_01-a");
    };
    this._renderCtl = render;
    render();
  },

  /* draw:Canvas 2D 雙細胞示意圖(高亮跟著矩陣勾選走) */
  draw() {
    const s = this.state, pl = s.place;
    // 高亮判定:植物側看該構造是否已拖入植物區;動物側看動物區
    const pOn = (n) => pl.plant.includes(n);
    const aOn = (n) => pl.animal.includes(n);

    const W = canvas.width, H = canvas.height;
    const cx1 = W * 0.28, cx2 = W * 0.72, cy = H * 0.42, R = 105;

    /* ── 植物細胞(左) ── */
    // 細胞壁(外框,方形)
    const wOff = 14;
    g.strokeStyle = pOn("細胞壁") ? "#4ade80" : "#55648f";
    g.lineWidth = 4;
    g.strokeRect(cx1 - R - wOff, cy - R - wOff, (R + wOff) * 2, (R + wOff) * 2);

    // 細胞膜(橢圓形)
    g.strokeStyle = pOn("細胞膜") ? "#38bdf8" : "#55648f";
    g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(cx1, cy, R, R * 0.88, 0, 0, 7); g.stroke();

    // 液胞(大型中央水藍色)
    g.fillStyle = pOn("液胞") ? "rgba(56,189,248,.28)" : "rgba(56,189,248,.10)";
    g.strokeStyle = pOn("液胞") ? "#38bdf8" : "#39456e";
    g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(cx1, cy - 6, 54, 46, 0, 0, 7);
    g.fill(); g.stroke();

    // 細胞質(植物,底層淡色填充)
    g.fillStyle = pOn("細胞質") ? "rgba(148,163,184,.20)" : "rgba(148,163,184,.06)";
    g.beginPath(); g.ellipse(cx1, cy, R - 6, R * 0.88 - 6, 0, 0, 7); g.fill();

    // 葉綠體(3 顆綠色橢圓)
    [[cx1 - 44, cy + 40], [cx1 + 22, cy + 50], [cx1 - 18, cy + 62]].forEach(([ex, ey]) => {
      g.fillStyle = pOn("葉綠體") ? "rgba(74,222,128,.70)" : "rgba(74,222,128,.25)";
      g.strokeStyle = pOn("葉綠體") ? "#4ade80" : "#2e3a63";
      g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(ex, ey, 16, 9, 0.4, 0, 7); g.fill(); g.stroke();
    });

    // 細胞核(植物)
    g.fillStyle = pOn("細胞核") ? "rgba(251,191,36,.55)" : "rgba(251,191,36,.2)";
    g.strokeStyle = pOn("細胞核") ? "#fbbf24" : "#39456e";
    g.lineWidth = 2;
    g.beginPath(); g.arc(cx1 - 22, cy - 22, 20, 0, 7); g.fill(); g.stroke();

    // 粒線體(植物,2 個)
    [[cx1 + 50, cy + 14], [cx1 + 60, cy - 30]].forEach(([mx, my]) => {
      g.fillStyle = pOn("粒線體") ? "rgba(167,139,250,.60)" : "rgba(167,139,250,.20)";
      g.strokeStyle = pOn("粒線體") ? "#a78bfa" : "#39456e";
      g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(mx, my, 12, 7, 0.5, 0, 7); g.fill(); g.stroke();
    });

    pText(cx1, cy + R + wOff + 22, "植物細胞", TH.text, 15, "center", true);

    /* ── 動物細胞(右) ── */
    // 細胞膜(不規則橢圓)
    g.strokeStyle = aOn("細胞膜") ? "#38bdf8" : "#55648f";
    g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(cx2, cy, R * 0.92, R, 0.15, 0, 7); g.stroke();

    // 細胞質(動物,底層淡色填充)
    g.fillStyle = aOn("細胞質") ? "rgba(148,163,184,.20)" : "rgba(148,163,184,.06)";
    g.beginPath(); g.ellipse(cx2, cy, R * 0.92 - 6, R - 6, 0.15, 0, 7); g.fill();

    // 細胞核(動物)
    g.fillStyle = aOn("細胞核") ? "rgba(251,191,36,.55)" : "rgba(251,191,36,.2)";
    g.strokeStyle = aOn("細胞核") ? "#fbbf24" : "#39456e";
    g.lineWidth = 2;
    g.beginPath(); g.arc(cx2 - 10, cy - 10, 22, 0, 7); g.fill(); g.stroke();

    // 粒線體(動物,3 個)
    [[cx2 + 46, cy + 18], [cx2 - 50, cy + 30], [cx2 + 30, cy - 50]].forEach(([mx, my]) => {
      g.fillStyle = aOn("粒線體") ? "rgba(167,139,250,.60)" : "rgba(167,139,250,.20)";
      g.strokeStyle = aOn("粒線體") ? "#a78bfa" : "#39456e";
      g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(mx, my, 12, 7, -0.3, 0, 7); g.fill(); g.stroke();
    });

    pText(cx2, cy + R + 22, "動物細胞", TH.text, 15, "center", true);

    /* ── readout:提示已放置幾個構造/已完成 ── */
    const filled = this._PARTS.reduce((n, p) =>
      n + ((pOn(p.name) || aOn(p.name)) ? 1 : 0), 0);
    const total = this._PARTS.length;
    const allOk = this._PARTS.every(p =>
      pOn(p.name) === p.hasPlant && aOn(p.name) === p.hasAnimal);
    readout.innerHTML = s.checked
      ? (allOk
          ? `<b style="color:#4ade80">全部歸屬正確!</b>`
          : `<b style="color:#ff5c7a">有構造放錯或漏放,看右側紅色標示與「還缺」提示</b>`)
      : `已放置 <b>${filled}/${total}</b> 個構造 — 共有的兩區都放,再按「檢查答案」`;
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
    why: "細胞膜、細胞核、粒線體是動植物細胞共有的基本構造(液胞其實動植物也都有);植物細胞特有的是細胞壁、葉綠體(以及大型中央液胞)。選項 C、D 都含植物特有的構造,故非共有。",
  },
  {
    tid: "s7a_01_q5",
    q: "小明在顯微鏡下觀察到一個細胞,發現它有細胞壁、葉綠體和大型中央液胞,這個細胞最可能是哪種生物的細胞?",
    opts: ["A. 人類皮膚細胞", "B. 青蛙的紅血球", "C. 菠菜葉肉細胞", "D. 草履蟲細胞"],
    ans: "C",
    why: "有細胞壁、葉綠體、大型中央液胞三者同時出現,是植物細胞的特徵;菠菜葉肉細胞是植物細胞。(單看液胞不夠,因動植物都有液胞,但大型中央液胞才是植物特徵)",
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
    q: "植物細胞的大型「中央液胞」主要功能是什麼?",
    opts: ["A. 進行光合作用", "B. 提供支撐與保護", "C. 儲存水分及溶質,調節細胞的滲透壓", "D. 釋放能量供細胞使用"],
    ans: "C",
    why: "大型中央液胞主要儲存水分及溶質(如色素、廢物),調節細胞滲透壓,也讓植物細胞保持膨壓而挺立。註:動植物細胞都有液胞,但植物的是大而集中的中央液胞。",
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
   S7A_04 — 生物圈的組成(生態系層次)
   互動:五個生態層次的卡片查閱 + 由小到大排列練習
        (沿用 S7A_02 的 cards+sort 引擎,對此單元最穩)
   課綱:Fc-Ⅳ(生態系的組成與交互作用/生物圈層次)
   版本註記:此單元康軒版編排於七下;課綱內容不受影響
   ================================================================ */
const S7A_04 = {
  id: "S7A_04", short: "生物圈組成",
  title: "關 S7A-4|生物圈的組成:從個體到生物圈",
  ep: "S", subj: "s7a",
  intro: `<p>把生物依「範圍大小」分層:一隻生物是<b>個體</b>,同一種生物的集合是<b>族群</b>,同一區域裡不同族群合起來是<b>群集</b>,群集再加上陽光、空氣、水、土壤等<b>非生物環境</b>就是<b>生態系</b>,地球上所有生態系合起來就是<b>生物圈</b>。</p><p>點選每個層次的卡片了解定義與實例,再用拖拉把五個層次由小到大排列正確!</p><p style="color:#9aa5c4;font-size:.85rem">📖 版本註記:此單元<b>康軒版</b>編排於七下教學;依課綱知識點相同,不影響題目內容。</p>`,
  formal: `<p class="math">生態層次(由小到大):個體 → 族群 → 群集 → 生態系 → 生物圈<br>族群=同種生物集合;群集=同一區域不同族群;生態系=生物群集+非生物環境<br>課綱對應:Fc-Ⅳ(生態系的組成與交互作用)</p>`,
  goals: [
    { id: "S7A_04-a", text: "了解五個生態層次(全部查閱卡片)" },
    { id: "S7A_04-b", text: "正確排列生態層次順序" },
  ],

  _LEVELS: [
    {
      key: "individual",
      name: "個體",
      icon: "🐒",
      color: "#4ade80",
      def: "一個能獨立生存的生物體",
      examples: "一隻台灣獼猴、一棵樟樹、一個人",
      note: "個體是生態層次中最小的單位,就是一個完整的生物。",
    },
    {
      key: "population",
      name: "族群",
      icon: "🐒🐒",
      color: "#38bdf8",
      def: "生活在同一區域內、同一種生物的所有個體",
      examples: "一片森林裡「所有的」台灣獼猴、一座池塘裡所有的吳郭魚",
      note: "族群的關鍵是「同一種」生物;不同種生物不算同一個族群。",
    },
    {
      key: "community",
      name: "群集",
      icon: "🌳🐒🦋",
      color: "#fbbf24",
      def: "生活在同一區域內、所有不同族群(不同種生物)的集合",
      examples: "一片森林裡所有的生物:獼猴、樟樹、蝴蝶、蚯蚓、細菌…全部",
      note: "群集包含「多種」生物;把同一區域裡各個族群加起來就是群集。又稱群落。",
    },
    {
      key: "ecosystem",
      name: "生態系",
      icon: "🏞️",
      color: "#a78bfa",
      def: "某一區域的生物群集,加上陽光、空氣、水、土壤等非生物環境",
      examples: "整片森林(所有生物 + 陽光、土壤、水分、空氣)、一座湖泊生態系",
      note: "生態系 = 生物(群集) + 非生物環境;生物與環境之間會交互作用。",
    },
    {
      key: "biosphere",
      name: "生物圈",
      icon: "🌍",
      color: "#ff5c7a",
      def: "地球上所有生態系的總和,是地球上有生物生存的整個範圍",
      examples: "整個地球:陸地、海洋、大氣中所有生態系合起來",
      note: "生物圈是生態層次的最高階,涵蓋地球上一切生命與其環境。",
    },
  ],

  _CORRECT_ORDER: ["individual", "population", "community", "ecosystem", "biosphere"],

  state: {
    viewed: new Set(),
    sortArr: [],
    sortDone: false,
    sortCorrect: false,
    dragging: null,
    phase: "cards",
  },

  enter() {
    this.state.viewed = new Set();
    this.state.sortArr = ["community", "biosphere", "individual", "ecosystem", "population"]; // 打亂初始順序
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
        cap: "生物圈的組成有五個層次,從最小到最大:個體、族群、群集、生態系、生物圈。",
        dur: 3200,
      },
      {
        call: () => { s.viewed = new Set(["individual"]); R(); },
        cap: "第一層,個體。一隻台灣獼猴、一棵樟樹,就是一個個體。",
        dur: 2800,
      },
      {
        call: () => { s.viewed = new Set(["individual","population"]); R(); },
        cap: "第二層,族群。同一片森林裡「所有的」台灣獼猴,合起來是一個族群。族群是同一種生物的集合。",
        dur: 3400,
      },
      {
        call: () => { s.viewed = new Set(["individual","population","community"]); R(); },
        cap: "第三層,群集。森林裡所有不同種的生物:獼猴、樟樹、蝴蝶全部合起來,就是群集。群集包含多種生物。",
        dur: 3400,
      },
      {
        call: () => { s.viewed = new Set(["individual","population","community","ecosystem"]); R(); },
        cap: "第四層,生態系。群集再加上陽光、空氣、水、土壤這些非生物環境,就是生態系。",
        dur: 3200,
      },
      {
        call: () => { s.viewed = new Set(["individual","population","community","ecosystem","biosphere"]); R(); },
        cap: "第五層,生物圈。地球上所有生態系合起來,就是生物圈。五個層次都認識了!",
        dur: 3200,
      },
      {
        call: () => { s.phase = "sort"; R(); },
        cap: "現在換你試試看:把五個層次由小到大排列正確!",
        dur: 2200,
      },
    ];
  },

  controls(el) {
    const s = this.state, lv = this;
    const render = () => {
      const allViewed = lv._CORRECT_ORDER.every(k => s.viewed.has(k));
      if (s.phase === "cards") {
        const cards = lv._LEVELS.map((lv2) => {
          const seen = s.viewed.has(lv2.key);
          return `
            <div class="s7a04-card${seen ? " seen" : ""}" data-key="${lv2.key}"
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
          ${allViewed ? `<button class="primary" id="s7a04-to-sort" style="margin-top:8px;width:100%">進行層次排列練習 →</button>` : ""}
        `;
        el.querySelectorAll(".s7a04-card").forEach(card => {
          card.onclick = () => {
            s.viewed.add(card.dataset.key);
            render();
          };
        });
        const toSortBtn = el.querySelector("#s7a04-to-sort");
        if (toSortBtn) toSortBtn.onclick = () => { s.phase = "sort"; render(); };
      } else {
        const checkOrder = () => {
          const correct = lv._CORRECT_ORDER;
          return s.sortArr.every((k, i) => k === correct[i]);
        };
        const items = s.sortArr.map((key, i) => {
          const item = lv._LEVELS.find(l => l.key === key);
          return `
            <div class="s7a04-sort-item" data-idx="${i}" data-key="${key}"
              draggable="true"
              style="display:flex;align-items:center;gap:10px;padding:9px 12px;margin:4px 0;
                border-radius:8px;border:2px solid ${s.sortDone && s.sortCorrect ? item.color : "#55648f"};
                background:var(--panel2);cursor:grab;user-select:none;
                ${s.sortDone ? "cursor:default;" : ""}">
              <span style="font-size:1.2rem">${item.icon}</span>
              <span style="font-weight:bold;color:${s.sortDone && s.sortCorrect ? item.color : "var(--ink)"}">${item.name}</span>
              <span style="font-size:.78rem;color:#9aa5c4;flex:1;text-align:right">${item.def.slice(0, 16)}…</span>
              ${!s.sortDone ? `<span style="color:#9aa5c4;font-size:.9rem">☰</span>` : ""}
            </div>`;
        }).join("");
        el.innerHTML = `
          <div style="margin-bottom:6px;font-size:.85rem;color:#9aa5c4">拖拉調整順序:從最小(個體)到最大(生物圈)</div>
          <div id="s7a04-sort-zone">${items}</div>
          ${s.sortDone
            ? (s.sortCorrect
                ? `<div class="row"><b style="color:#4ade80">✓ 順序正確!五個生態層次全通關!</b></div>`
                : `<div class="row"><b style="color:#ff5c7a">✗ 順序不對,再拖拉試試</b><button id="s7a04-sort-reset" style="margin-left:8px">重置</button></div>`)
            : `<div class="row"><button class="primary" id="s7a04-check">確認順序</button><button id="s7a04-back-cards" style="margin-left:8px">回到卡片</button></div>`
          }
        `;

        if (!s.sortDone) {
          let dragSrcIdx = null;
          el.querySelectorAll(".s7a04-sort-item").forEach(item => {
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

          const checkBtn = el.querySelector("#s7a04-check");
          if (checkBtn) checkBtn.onclick = () => {
            s.sortDone = true;
            s.sortCorrect = checkOrder();
            render();
          };
          const backBtn = el.querySelector("#s7a04-back-cards");
          if (backBtn) backBtn.onclick = () => { s.phase = "cards"; render(); };
          const resetBtn = el.querySelector("#s7a04-sort-reset");
          if (resetBtn) resetBtn.onclick = () => {
            s.sortDone = false; s.sortCorrect = false;
            render();
          };
        } else {
          const resetBtn2 = el.querySelector("#s7a04-sort-reset");
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
    const xCenter = W * 0.5;
    const yBase = H * 0.52;

    /* ── 同心圓層次圖(由小到大,個體在最內圈,生物圈在最外圈) ── */
    levels.slice().reverse().forEach((lv2, i) => {
      const ri = N - 1 - i;          // 0=個體(內) … 4=生物圈(外)
      const viewed = s.viewed.has(lv2.key);
      const radius = 34 + ri * 34;
      g.strokeStyle = viewed ? lv2.color : TH.axis;
      g.lineWidth = viewed ? 2.5 : 1;
      g.fillStyle = viewed ? `${lv2.color}14` : "rgba(0,0,0,0)";
      g.beginPath();
      g.arc(xCenter, yBase, radius, 0, 7);
      g.fill(); g.stroke();

      /* 標籤放在每圈上方 */
      const textCol = viewed ? lv2.color : TH.dim;
      pText(xCenter, yBase - radius + 13, `${lv2.icon} ${lv2.name}`, textCol, 12, "center", true);
    });

    /* ── readout ── */
    if (s.sortDone && s.sortCorrect) markGoal("S7A_04-b");
    if (s.viewed.size === N) markGoal("S7A_04-a");

    const viewedN = s.viewed.size;
    readout.innerHTML = s.phase === "sort"
      ? `拖拉排列:由小到大排列五個生態層次`
      : `已查閱 <b>${viewedN}/${N}</b> 個層次`;
  },
};

/* ================================================================
   S7A_04_QUESTIONS — 段考題庫(生物圈的組成)
   知識點:Fc-Ⅳ 生態層次;個體/族群/群集/生態系/生物圈的定義與辨別
   ================================================================ */
const S7A_04_QUESTIONS = [
  {
    tid: "s7a_04_q1",
    q: "生物圈的組成層次,由小到大的正確順序是?",
    opts: [
      "A. 個體 → 群集 → 族群 → 生態系 → 生物圈",
      "B. 個體 → 族群 → 群集 → 生態系 → 生物圈",
      "C. 族群 → 個體 → 群集 → 生物圈 → 生態系",
      "D. 個體 → 族群 → 生態系 → 群集 → 生物圈",
    ],
    ans: "B",
    why: "由小到大的正確順序:個體 → 族群 → 群集 → 生態系 → 生物圈。",
  },
  {
    tid: "s7a_04_q2",
    q: "「生活在同一區域內、同一種生物的所有個體」,這是指哪個生態層次?",
    opts: ["A. 個體", "B. 族群", "C. 群集", "D. 生態系"],
    ans: "B",
    why: "族群的定義是「同一區域內、同一種生物」的所有個體集合;關鍵在「同一種」。",
  },
  {
    tid: "s7a_04_q3",
    q: "一片森林裡「所有的台灣獼猴」,屬於哪個生態層次?",
    opts: ["A. 個體", "B. 族群", "C. 群集", "D. 生態系"],
    ans: "B",
    why: "台灣獼猴是同一種生物,「所有的台灣獼猴」是同種個體的集合,屬於族群。",
  },
  {
    tid: "s7a_04_q4",
    q: "一片森林裡「所有的生物」(獼猴、樹木、昆蟲、細菌等全部),屬於哪個層次?",
    opts: ["A. 族群", "B. 群集", "C. 個體", "D. 生物圈"],
    ans: "B",
    why: "「所有的生物」包含多種不同族群,是同一區域內各族群的集合,屬於群集(群落)。",
  },
  {
    tid: "s7a_04_q5",
    q: "下列關於「生態系」的敘述,何者正確?",
    opts: [
      "A. 生態系只包含生物,不含非生物環境",
      "B. 生態系是指同一種生物的所有個體",
      "C. 生態系是生物群集加上陽光、空氣、水、土壤等非生物環境",
      "D. 生態系就是整個地球所有生物的總和",
    ],
    ans: "C",
    why: "生態系 = 生物群集 + 非生物環境(陽光、空氣、水、土壤等);生物與環境會交互作用。D 描述的是生物圈。",
  },
  {
    tid: "s7a_04_q6",
    q: "「一整片森林,連同其中的陽光、土壤、水分和空氣」,這構成了哪個層次?",
    opts: ["A. 群集", "B. 族群", "C. 生態系", "D. 生物圈"],
    ans: "C",
    why: "生物群集(森林裡所有生物)加上非生物環境(陽光、土壤、水、空氣)就構成生態系。",
  },
  {
    tid: "s7a_04_q7",
    q: "「地球上所有生態系的總和」是指哪個生態層次?",
    opts: ["A. 群集", "B. 生態系", "C. 生物圈", "D. 族群"],
    ans: "C",
    why: "生物圈是地球上所有生態系的總和,涵蓋陸地、海洋、大氣中所有生物與其環境,是生態層次的最高階。",
  },
  {
    tid: "s7a_04_q8",
    q: "關於「族群」與「群集」的差異,下列何者正確?",
    opts: [
      "A. 族群包含多種生物;群集只有一種生物",
      "B. 族群是同一種生物的集合;群集是同一區域內多種族群的集合",
      "C. 族群和群集是同一個層次的不同名稱",
      "D. 群集的層次比個體還小",
    ],
    ans: "B",
    why: "族群 = 同一種生物;群集 = 同一區域內多種族群(多種生物)的集合。層次:族群 < 群集。",
  },
  {
    tid: "s7a_04_q9",
    q: "下列哪一個例子屬於「族群」?",
    opts: [
      "A. 一座池塘裡所有的吳郭魚",
      "B. 一座池塘裡所有的生物",
      "C. 一座池塘連同池水和陽光",
      "D. 一隻吳郭魚",
    ],
    ans: "A",
    why: "「所有的吳郭魚」是同一種生物的集合,屬於族群;B 是群集,C 是生態系,D 是個體。",
  },
  {
    tid: "s7a_04_q10",
    q: "小明在校園觀察:①一隻麻雀 ②校園裡所有的麻雀 ③校園裡所有的生物 ④整個校園連同陽光土壤。這四項依序對應的生態層次是?",
    opts: [
      "A. 個體、族群、群集、生態系",
      "B. 族群、個體、生態系、群集",
      "C. 個體、群集、族群、生態系",
      "D. 個體、族群、生態系、群集",
    ],
    ans: "A",
    why: "①一隻=個體;②所有麻雀(同種)=族群;③所有生物(多種)=群集;④加上非生物環境=生態系。",
  },
];

const S7A_04_DRILL = makeStaticSciDrill(
  "S7A_04D",
  "生物圈組成段考練習",
  "段考練習|S7A-4D:生物圈組成段考題庫",
  `<p>本關模擬七上自然段考——<b>10 題</b>,涵蓋個體→族群→群集→生態系→生物圈的定義、實例辨別。</p><p>點選正確選項,答完後可看詳解與成績;答對率 ≥75% 解鎖通關。</p><p style="color:#9aa5c4;font-size:.85rem">📖 康軒版此單元編排於七下,題目依課綱不受影響。</p>`,
  "完成段考練習且答對率 ≥75%(生物圈組成)",
  S7A_04_QUESTIONS
);

/* ================================================================
   S7A_QZ_QUESTIONS — 七上自然總測驗(綜合抽題)
   跨四單元:S7A_01 細胞構造 / S7A_02 構造層次 / S7A_03 尺度單位 /
             S7A_04 生物圈組成。段考複習卷難度,18 題單選。
   每題答案為三版(翰林/南一/康軒)課綱共識,無爭議。
   ================================================================ */
const S7A_QZ_QUESTIONS = [
  /* ── 單元一:細胞構造 ── */
  {
    tid: "s7a_qz_q1",
    q: "【細胞】下列哪一組構造是植物細胞「才有」,動物細胞完全沒有的?",
    opts: ["A. 細胞膜、細胞核", "B. 細胞壁、葉綠體", "C. 粒線體、細胞核", "D. 細胞膜、粒線體"],
    ans: "B",
    why: "細胞壁與葉綠體(以及大型中央液胞)是植物細胞特有的構造;細胞膜、細胞核、粒線體則是動植物共有。",
  },
  {
    tid: "s7a_qz_q2",
    q: "【細胞】細胞內負責進行「細胞呼吸」、分解養分釋放能量的構造是?",
    opts: ["A. 葉綠體", "B. 細胞核", "C. 粒線體", "D. 液胞"],
    ans: "C",
    why: "粒線體是細胞的能量工廠,進行細胞呼吸釋放能量(ATP);動植物細胞都有粒線體。葉綠體才是進行光合作用的構造。",
  },
  {
    tid: "s7a_qz_q3",
    q: "【細胞】細胞核的主要功能是什麼?",
    opts: ["A. 控制物質進出細胞", "B. 含遺傳物質(DNA),控制細胞生命活動", "C. 進行光合作用", "D. 儲水並調節滲透壓"],
    ans: "B",
    why: "細胞核含有 DNA(遺傳物質),是細胞的控制中心;控制物質進出是細胞膜的功能。",
  },
  {
    tid: "s7a_qz_q4",
    q: "【細胞】小華在顯微鏡下看到某細胞同時具有細胞壁、葉綠體和大型中央液胞,此細胞最可能來自?",
    opts: ["A. 人類的口腔皮膜細胞", "B. 青蛙的紅血球", "C. 菠菜的葉肉細胞", "D. 草履蟲"],
    ans: "C",
    why: "細胞壁、葉綠體、大型中央液胞三者同時出現是植物細胞的特徵;菠菜葉肉細胞為植物細胞。(動植物都有液胞,但大型中央液胞是植物特徵)",
  },
  {
    tid: "s7a_qz_q5",
    q: "【細胞】下列關於細胞的敘述,哪一項「錯誤」?",
    opts: ["A. 細胞是生物體的基本單位", "B. 所有生物都由細胞組成", "C. 動物細胞沒有細胞壁,所以也沒有細胞膜", "D. 細胞膜能控制物質進出細胞"],
    ans: "C",
    why: "動物細胞沒有細胞壁,但仍有細胞膜;細胞膜是所有細胞都具備的基本構造。",
  },
  /* ── 單元二:構造層次 ── */
  {
    tid: "s7a_qz_q6",
    q: "【層次】生物體的構造層次,由小到大的正確順序是?",
    opts: [
      "A. 細胞 → 器官 → 組織 → 器官系統 → 個體",
      "B. 細胞 → 組織 → 器官 → 器官系統 → 個體",
      "C. 組織 → 細胞 → 器官 → 器官系統 → 個體",
      "D. 細胞 → 組織 → 器官系統 → 器官 → 個體",
    ],
    ans: "B",
    why: "由小到大:細胞 → 組織 → 器官 → 器官系統 → 個體。",
  },
  {
    tid: "s7a_qz_q7",
    q: "【層次】「由許多形態相似、功能相同的細胞聚集而成」,指的是哪個層次?",
    opts: ["A. 器官", "B. 組織", "C. 器官系統", "D. 個體"],
    ans: "B",
    why: "組織的定義即為形態相似、功能相同的細胞聚集而成,例如肌肉組織、上皮組織。",
  },
  {
    tid: "s7a_qz_q8",
    q: "【層次】心臟由肌肉組織、結締組織、神經組織等組成,能執行特定功能,它屬於?",
    opts: ["A. 組織", "B. 器官", "C. 器官系統", "D. 個體"],
    ans: "B",
    why: "由多種不同組織組合、能執行特定功能的構造稱為器官;心臟即為器官。",
  },
  {
    tid: "s7a_qz_q9",
    q: "【層次】下列哪一項是「植物特有、動物沒有」的組織?",
    opts: ["A. 上皮組織", "B. 肌肉組織", "C. 輸導組織", "D. 神經組織"],
    ans: "C",
    why: "輸導組織是植物特有的組織(運輸水分與養分);上皮、肌肉、神經、結締組織為動物的四大基本組織。",
  },
  {
    tid: "s7a_qz_q10",
    q: "【層次】「消化系統」由口腔、食道、胃、腸等器官組成,它屬於哪個層次?",
    opts: ["A. 器官", "B. 組織", "C. 器官系統", "D. 個體"],
    ans: "C",
    why: "由多個功能相關的器官共同組成、完成某項生理功能者,稱為器官系統。",
  },
  /* ── 單元三:尺度與單位 ── */
  {
    tid: "s7a_qz_q11",
    q: "【單位】下列物理量與其 SI 單位的配對,哪一項正確?",
    opts: ["A. 質量—秒(s)", "B. 長度—公克(g)", "C. 時間—公尺(m)", "D. 長度—公尺(m)"],
    ans: "D",
    why: "長度的 SI 單位是公尺(m);質量是公斤(kg),時間是秒(s)。",
  },
  {
    tid: "s7a_qz_q12",
    q: "【單位】2.5 公斤等於多少公克?",
    opts: ["A. 25 公克", "B. 250 公克", "C. 2500 公克", "D. 25000 公克"],
    ans: "C",
    why: "1 kg = 1000 g,所以 2.5 kg = 2500 g。",
  },
  {
    tid: "s7a_qz_q13",
    q: "【單位】測量物體「質量」時,應使用哪種儀器?",
    opts: ["A. 刻度尺", "B. 天平", "C. 碼錶", "D. 溫度計"],
    ans: "B",
    why: "天平是測量質量的工具;刻度尺測長度,碼錶測時間,溫度計測溫度。",
  },
  {
    tid: "s7a_qz_q14",
    q: "【單位】0.005 用科學記號表示為何?",
    opts: ["A. 5 × 10³", "B. 5 × 10⁻²", "C. 5 × 10⁻³", "D. 5 × 10⁻⁴"],
    ans: "C",
    why: "0.005 = 5 × 0.001 = 5 × 10⁻³;負指數 −3 代表小數點後第三位。",
  },
  {
    tid: "s7a_qz_q15",
    q: "【單位】1 分鐘等於多少秒?1 小時等於多少秒?",
    opts: ["A. 60 秒;600 秒", "B. 60 秒;3600 秒", "C. 100 秒;6000 秒", "D. 60 秒;360 秒"],
    ans: "B",
    why: "1 分鐘 = 60 秒;1 小時 = 60 分鐘 = 60 × 60 = 3600 秒。",
  },
  /* ── 單元四:生物圈組成 ── */
  {
    tid: "s7a_qz_q16",
    q: "【生物圈】生物圈的組成層次,由小到大的正確順序是?",
    opts: [
      "A. 個體 → 群集 → 族群 → 生態系 → 生物圈",
      "B. 個體 → 族群 → 群集 → 生態系 → 生物圈",
      "C. 族群 → 個體 → 群集 → 生物圈 → 生態系",
      "D. 個體 → 族群 → 生態系 → 群集 → 生物圈",
    ],
    ans: "B",
    why: "由小到大:個體 → 族群 → 群集 → 生態系 → 生物圈。",
  },
  {
    tid: "s7a_qz_q17",
    q: "【生物圈】一座池塘裡「所有的吳郭魚」屬於哪個生態層次?",
    opts: ["A. 個體", "B. 族群", "C. 群集", "D. 生態系"],
    ans: "B",
    why: "「所有的吳郭魚」是同一種生物的所有個體集合,屬於族群;關鍵在「同一種」。",
  },
  {
    tid: "s7a_qz_q18",
    q: "【生物圈】下列關於「生態系」的敘述,何者正確?",
    opts: [
      "A. 生態系只包含生物,不含非生物環境",
      "B. 生態系是同一種生物的所有個體",
      "C. 生態系是生物群集加上陽光、空氣、水、土壤等非生物環境",
      "D. 生態系就是整個地球所有生物的總和",
    ],
    ans: "C",
    why: "生態系 = 生物群集 + 非生物環境(陽光、空氣、水、土壤等);D 描述的是生物圈。",
  },
];

const S7A_QZ = makeStaticSciDrill(
  "S7A_QZ",
  "七上自然總測驗",
  "總測驗|七上自然:四單元綜合測驗",
  `<p>本關為<b>七上自然科總測驗</b>——共 <b>18 題</b>,綜合四個單元:細胞構造、構造層次(細胞→個體)、尺度與單位(SI/科學記號)、生物圈組成(個體→生物圈)。</p><p>題型全為單選,答完後可看詳解與成績;答對率 ≥75% 解鎖通關。適合段考前總複習。</p>`,
  "完成七上自然總測驗且答對率 ≥75%",
  S7A_QZ_QUESTIONS
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
  S7A_04,
  S7A_04D: S7A_04_DRILL,
  S7A_QZ,
};

/* 科目定義:subject-loader 會讀這個全域 */
window.__SUBJECT_SCIENCE7A__ = {
  subjectKey: "s7a",
  subjectName: "七上自然",
  levels: [S7A_01, S7A_01_DRILL, S7A_02, S7A_02_DRILL, S7A_03, S7A_03_DRILL, S7A_04, S7A_04_DRILL, S7A_QZ],
};

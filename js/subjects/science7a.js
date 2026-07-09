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
   SCIENCE7A_REGISTRY — 供 main.js subject-loader 使用
   key = level id, value = 完整關卡物件(含 draw/demo/controls)
   ================================================================ */
const SCIENCE7A_REGISTRY = {
  S7A_01,
};

/* 科目定義:subject-loader 會讀這個全域 */
window.__SUBJECT_SCIENCE7A__ = {
  subjectKey: "s7a",
  subjectName: "七上自然",
  levels: [S7A_01],
};

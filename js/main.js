/* 國中數感實驗室 Junior Math Lab — 零依賴 Canvas 互動數學
   國中銜接六關+總測驗,引擎抽自數感實驗室 */
"use strict";

/* ---------- 向量 / 矩陣工具 ---------- */
const V = (x, y) => ({ x, y });
const add = (a, b) => V(a.x + b.x, a.y + b.y);
const sub = (a, b) => V(a.x - b.x, a.y - b.y);
const scl = (a, k) => V(a.x * k, a.y * k);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const len = (a) => Math.hypot(a.x, a.y);
// 矩陣以「兩個 column(基向量新家)」表示:M = { i:{x,y}, j:{x,y} }
const M = (i, j) => ({ i: { ...i }, j: { ...j } });
const MI = () => M(V(1, 0), V(0, 1));
const applyM = (m, v) => V(m.i.x * v.x + m.j.x * v.y, m.i.y * v.x + m.j.y * v.y);
const mulM = (b, a) => M(applyM(b, a.i), applyM(b, a.j)); // 先 a 後 b = b·a
const detM = (m) => m.i.x * m.j.y - m.j.x * m.i.y;
const lerp = (p, q, t) => p + (q - p) * t;
const lerpM = (a, b, t) => M(V(lerp(a.i.x, b.i.x, t), lerp(a.i.y, b.i.y, t)),
                             V(lerp(a.j.x, b.j.x, t), lerp(a.j.y, b.j.y, t)));
const ease = (t) => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
const fmt = (n) => (Math.abs(n) < 0.005 ? 0 : n).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");

/* ---------- 畫布 ---------- */
const canvas = document.getElementById("board");
const g = canvas.getContext("2d");
const CX = canvas.width / 2, CY = canvas.height / 2;
const cam = { scale: 62, x: 0, y: 0 }; // 世界點 (x,y) 顯示在畫布中心,scale = px/單位
const camReset = () => { cam.scale = 62; cam.x = 0; cam.y = 0; };
const toScr = (v) => V(CX + (v.x - cam.x) * cam.scale, CY - (v.y - cam.y) * cam.scale);
const fromScr = (px, py) => V(cam.x + (px - CX) / cam.scale, cam.y - (py - CY) / cam.scale);

const COL = {
  gridFaint: "#1a2136", grid: "#2e3a63", axis: "#55648f",
  iHat: "#ff5c7a", jHat: "#4ade80", vec: "#ffd166",
  extra: "#a78bfa", blue: "#38bdf8", star: "#ffd166",
  posArea: "rgba(56,189,248,.22)", negArea: "rgba(251,146,60,.28)",
  span: "rgba(255,209,102,.10)", gold: "#fbbf24",
};

// 主題:只切換「背景/格線/文字」這些會在淺底失效的顏色;彩色箭頭兩色皆可讀
const THEMES = {
  dark:  { bg: "#0a0e1a", grid: "#2e3a63", gridFaint: "#1a2136", axis: "#55648f", text: "#e8ecf8", dim: "#9aa5c4", demoGrid: "#212a4b", demoAxis: "#39456e", panel: "#0f1424" },
  light: { bg: "#f4f6fc", grid: "#c4cee6", gridFaint: "#e3e8f3", axis: "#8b98ba", text: "#1b2138", dim: "#5c688a", demoGrid: "#dfe5f2", demoAxis: "#b8c2dc", panel: "#eaeef8" },
};
let themeName = localStorage.getItem("jrlab-theme") || "dark";
let TH = THEMES[themeName];
function applyTheme(name) {
  themeName = name; TH = THEMES[name];
  localStorage.setItem("jrlab-theme", name);
  document.body.classList.toggle("light", name === "light");
  // 同步機率模組調色盤的「文字/座標軸」到主題(彩色資料色不動)
  if (typeof PC !== "undefined") { PC.ink = TH.text; PC.dim = TH.dim; PC.axis = TH.axis; PC.grid = TH.gridFaint; }
}

function clear() { g.fillStyle = TH.bg; g.fillRect(0, 0, canvas.width, canvas.height); }

function drawGrid(m, opt = {}) {
  const N = 9;
  if (opt.original !== false) { // 原始格線(淡)
    g.strokeStyle = TH.gridFaint; g.lineWidth = 1;
    g.beginPath();
    for (let k = -N; k <= N; k++) {
      let a = toScr(V(k, -N)), b = toScr(V(k, N));
      g.moveTo(a.x, a.y); g.lineTo(b.x, b.y);
      a = toScr(V(-N, k)); b = toScr(V(N, k));
      g.moveTo(a.x, a.y); g.lineTo(b.x, b.y);
    }
    g.stroke();
  }
  // 變換後格線(示範播放時降淡,聚焦主角)
  for (let k = -N; k <= N; k++) {
    const isAxis = k === 0;
    g.strokeStyle = isAxis ? (player.active ? TH.demoAxis : TH.axis)
                           : (player.active ? TH.demoGrid : TH.grid);
    g.lineWidth = isAxis ? 2 : 1.2;
    g.beginPath();
    let a = toScr(applyM(m, V(k, -N))), b = toScr(applyM(m, V(k, N)));
    g.moveTo(a.x, a.y); g.lineTo(b.x, b.y);
    a = toScr(applyM(m, V(-N, k))); b = toScr(applyM(m, V(N, k)));
    g.moveTo(a.x, a.y); g.lineTo(b.x, b.y);
    g.stroke();
  }
}

function drawArrow(from, to, color, w = 3, label = "") {
  const a = toScr(from), b = toScr(to);
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
  if (L < 2) return;
  const ux = dx / L, uy = dy / L, head = Math.min(14, L * 0.4);
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = w;
  g.beginPath();
  g.moveTo(a.x, a.y); g.lineTo(b.x - ux * head * 0.7, b.y - uy * head * 0.7);
  g.stroke();
  g.beginPath();
  g.moveTo(b.x, b.y);
  g.lineTo(b.x - ux * head - uy * head * 0.45, b.y - uy * head + ux * head * 0.45);
  g.lineTo(b.x - ux * head + uy * head * 0.45, b.y - uy * head - ux * head * 0.45);
  g.closePath(); g.fill();
  if (label) {
    g.font = "bold 17px 'Cambria Math', serif";
    g.fillText(label, b.x + ux * 14 - 5 + uy * 10, b.y + uy * 14 + ux * -10 + 6);
  }
}

function drawDash(from, to, color) {
  const a = toScr(from), b = toScr(to);
  g.strokeStyle = color; g.lineWidth = 1.5; g.setLineDash([5, 5]);
  g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
  g.setLineDash([]);
}

function drawDot(p, color, r = 6) {
  const s = toScr(p);
  g.fillStyle = color;
  g.beginPath(); g.arc(s.x, s.y, r, 0, 7); g.fill();
}

function drawStar(p, color) {
  const s = toScr(p), R = 11, r = 4.5;
  g.fillStyle = color; g.beginPath();
  for (let k = 0; k < 10; k++) {
    const rad = k % 2 ? r : R, th = -Math.PI / 2 + k * Math.PI / 5;
    g[k ? "lineTo" : "moveTo"](s.x + rad * Math.cos(th), s.y + rad * Math.sin(th));
  }
  g.closePath(); g.fill();
}

function fillQuad(pts, color) {
  g.fillStyle = color; g.beginPath();
  pts.forEach((p, k) => { const s = toScr(p); g[k ? "lineTo" : "moveTo"](s.x, s.y); });
  g.closePath(); g.fill();
}

function labelAt(p, text, color, dx = 10, dy = -10) {
  const s = toScr(p);
  g.fillStyle = color; g.font = "bold 16px 'Cambria Math', serif";
  g.fillText(text, s.x + dx, s.y + dy);
}
function pText(x, y, txt, color, size = 15, align = "left", bold = false) {
  g.fillStyle = color; g.textAlign = align;
  g.font = `${bold ? "bold " : ""}${size}px sans-serif`;
  g.fillText(txt, x, y); g.textAlign = "left";
}
function drawDisc(cx, cy, r, fill, stroke, lw = 2) {
  g.beginPath(); g.arc(cx, cy, r, 0, 7);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}

/* ---------- 進度 ---------- */
const PKEY = "jrlab-progress-v1";
let progress = {};
try { progress = JSON.parse(localStorage.getItem(PKEY) || "{}"); } catch (e) {}
function markGoal(id) {
  if (player.active) return; // 示範不代打過關
  if (progress[id]) return;
  progress[id] = true;
  localStorage.setItem(PKEY, JSON.stringify(progress));
  renderGoals(); renderTabs(); renderSubjects(); renderOverall(); updateCert();
}

/* ---------- 矩陣動畫 ---------- */
let anim = null; // {from,to,t0,dur,cur}
function animateTo(target, dur = 900) {
  anim = { from: anim ? anim.cur : MI(), to: target, t0: performance.now(), dur, cur: anim ? anim.cur : MI() };
}
function setMatrixNow(m) { anim = { from: m, to: m, t0: 0, dur: 1, cur: m }; }
function curMatrix() {
  if (!anim) return MI();
  const t = Math.min(1, (performance.now() - anim.t0) / anim.dur);
  anim.cur = lerpM(anim.from, anim.to, ease(t));
  return anim.cur;
}

/* ---------- 拖曳 ---------- */
let dragTarget = null;
function canvasPos(ev) {
  const r = canvas.getBoundingClientRect();
  return { x: (ev.clientX - r.left) * canvas.width / r.width, y: (ev.clientY - r.top) * canvas.height / r.height };
}
canvas.addEventListener("pointerdown", (ev) => {
  if (player.active) { player.stop(); return; } // 示範中點一下 = 跳過、接手
  const p = canvasPos(ev);
  const dl = cur().draggables ? cur().draggables() : [];
  let best = null, bestD = 30;
  for (const d of dl) {
    const s = d.getScreen ? d.getScreen() : toScr(d.get());
    const dist = Math.hypot(s.x - p.x, s.y - p.y);
    if (dist < bestD) { bestD = dist; best = d; }
  }
  if (best) { dragTarget = best; canvas.setPointerCapture(ev.pointerId); }
});
canvas.addEventListener("pointermove", (ev) => {
  if (!dragTarget) return;
  const p = canvasPos(ev);
  if (dragTarget.setScreen) { // 螢幕座標拖曳(概率模組的門檻線等)
    dragTarget.setScreen(p.x, p.y);
    cur().onChange && cur().onChange();
    return;
  }
  let w = fromScr(p.x, p.y);
  w.x = Math.max(-5.2, Math.min(5.2, w.x));
  w.y = Math.max(-5.2, Math.min(5.2, w.y));
  // 靠近 0.5 格點就吸附,方便精準命中
  const snap = (n) => { const r = Math.round(n * 2) / 2; return Math.abs(n - r) < 0.11 ? r : n; };
  w.x = snap(w.x); w.y = snap(w.y);
  dragTarget.set(w);
  cur().onChange && cur().onChange();
});
window.addEventListener("pointerup", () => { dragTarget = null; });

/* ---------- 示範播放器 ----------
   步驟格式(皆可省略):{ cap 字幕, dur 毫秒,
     vec/vec2:[get,set,目標] 向量補間, num:[get,set,目標] 數字補間,
     cam:{scale,x,y}|"reset" 相機補間, mat:目標矩陣, call:開步時執行 } */
const captionEl = document.getElementById("caption");
const demoBtnEl = document.getElementById("demo-btn");
let demoSeen = {};
try { demoSeen = JSON.parse(localStorage.getItem("jrlab-demoseen") || "{}"); } catch (e) {}

// 旁白語音(預錄 mp3,單一 Audio 元素重用對 iOS 較友善)
let voiceOn = localStorage.getItem("jrlab-voice") === "1";
let voiceAudio = null;
function getAudioEl() { if (!voiceAudio) voiceAudio = new Audio(); return voiceAudio; }
function stopVoice() { if (voiceAudio) { voiceAudio.pause(); voiceAudio.onended = voiceAudio.onerror = null; } }

const player = {
  active: false, steps: [], idx: -1, t0: 0, dur: 0, apply: null, _hideT: 0, clipWaiting: false,
  start(steps) {
    if (!steps || !steps.length) return;
    this.steps = steps; this.idx = -1; this.active = true;
    clearTimeout(this._hideT);
    demoBtnEl.textContent = "⏭ 跳過示範";
    this.next();
  },
  next() {
    this.idx++;
    if (this.idx >= this.steps.length) return this.stop();
    const st = this.steps[this.idx];
    this.dur = st.dur || 1400;
    this.t0 = performance.now();
    const fns = [];
    for (const key of ["vec", "vec2"]) {
      if (!st[key]) continue;
      const [get, set, to] = st[key], from = { ...get() };
      fns.push((t) => set(V(lerp(from.x, to.x, t), lerp(from.y, to.y, t))));
    }
    for (const key of ["num", "num2"]) {
      if (!st[key]) continue;
      const [get, set, to] = st[key], from = get();
      fns.push((t) => set(lerp(from, to, t)));
    }
    if (st.cam) {
      const to = st.cam === "reset" ? { scale: 62, x: 0, y: 0 } : st.cam;
      const from = { ...cam };
      fns.push((t) => {
        if (to.scale != null) cam.scale = lerp(from.scale, to.scale, t);
        if (to.x != null) cam.x = lerp(from.x, to.x, t);
        if (to.y != null) cam.y = lerp(from.y, to.y, t);
      });
    }
    if (st.mat) animateTo(st.mat, this.dur);
    if (st.call) st.call();
    this.apply = fns.length ? (t) => fns.forEach((f) => f(t)) : null;
    if (st.cap != null) { captionEl.textContent = st.cap; captionEl.classList.add("show"); }
    this.playClip(st);
  },
  playClip(st) {
    this.clipWaiting = false;
    if (!voiceOn || st.cap == null) return;
    const a = getAudioEl();
    a.src = `audio/${cur().id}_${this.idx}.mp3`;
    this.clipWaiting = true;
    const done = () => { this.clipWaiting = false; };
    a.onended = done; a.onerror = done;
    try { a.currentTime = 0; } catch (e) {}
    const pr = a.play();
    if (pr && pr.catch) pr.catch(done); // 自動播放被擋(無使用者手勢)→ 靜音續播
  },
  update() {
    if (!this.active) return;
    const t = Math.min(1, (performance.now() - this.t0) / this.dur);
    this.apply && this.apply(ease(t));
    cur()._sync && cur()._sync();
    // 動畫跑完後,若語音還沒唸完就等它(上限 dur+15s 防卡)
    if (t >= 1 && (!this.clipWaiting || performance.now() - this.t0 > this.dur + 15000)) this.next();
  },
  cancel() {
    this.active = false; this.apply = null; this.clipWaiting = false;
    stopVoice();
    clearTimeout(this._hideT);
    captionEl.classList.remove("show");
    demoBtnEl.textContent = "▶ 看示範";
    camReset();
  },
  stop() { // 示範結束/跳過:回到起始狀態,交還控制
    this.cancel();
    const lv = cur();
    lv.enter && lv.enter();
    lv._sync && lv._sync();
    captionEl.textContent = "換你操作了 👆 完成任務清單";
    captionEl.classList.add("show");
    this._hideT = setTimeout(() => captionEl.classList.remove("show"), 2800);
  },
};

/* ---------- 關卡定義 ---------- */
const EP = {
  1: ["EP1 基向量與張成空間 ▶", "https://www.youtube.com/watch?v=ZvDpkXAvWGk"],
  2: ["EP2 行列式與矩陣秩 ▶", "https://www.youtube.com/watch?v=9gRzBcHhYXw"],
  3: ["EP3 特徵值與內積投影 ▶", "https://www.youtube.com/watch?v=Ddw4H_pT_AM"],
  // 概率系列
  P1: ["概率EP04 連續變數與機率密度 ▶", "https://www.youtube.com/watch?v=dGWDybzB8y8"],
  P2: ["概率EP05 正態分佈 ▶", "https://www.youtube.com/watch?v=x_pJlGB0S5c"],
  P3: ["概率EP06 健檢陽性的盲點 ▶", "https://www.youtube.com/watch?v=tFUBBCfnjs8"],
  P4: ["概率EP07 貝氏定理動態修正 ▶", "https://www.youtube.com/watch?v=TKvSIo8kKBg"],
  P5: ["概率EP02 隨機變數如何量化 ▶", "https://www.youtube.com/watch?v=QlKIuWLcdJ8"],
  P6: ["統計推論 大數法則 ▶", "https://www.youtube.com/watch?v=Zz_2gT2RHKU"],
  P7: ["統計推論 中心極限定理 ▶", "https://www.youtube.com/watch?v=Zz_2gT2RHKU"],
  P8: ["概率EP01 機率的本質 ▶", "https://www.youtube.com/watch?v=DKx6p4__gkQ"],
  P9: ["概率EP06 條件機率 ▶", "https://www.youtube.com/watch?v=tFUBBCfnjs8"],
  // 微積分系列
  C1: ["微積分EP1 極限與夾擠 ▶", "https://www.youtube.com/watch?v=hjEMERJlhXQ"],
  C2: ["微積分EP2 微分:瞬間斜率 ▶", "https://www.youtube.com/watch?v=VIVYtZPUGGM"],
  C3: ["微積分EP2 積分:總帳面積 ▶", "https://www.youtube.com/watch?v=VIVYtZPUGGM"],
  C4: ["微積分EP3 基本定理 ▶", "https://www.youtube.com/watch?v=vqzEcFxNN_U"],
  Q: ["JOHNSON-MATH 頻道 ▶", "https://www.youtube.com/@JOHNSON-MATH"],
  J: ["國中銜接系列(本站原創)", "https://github.com/klmtseng/junior-math-lab"],
};
const readout = document.getElementById("readout");


/* ═══════════════════════════════════════════════════════════
   國中銜接模組 — 小六升國一(原創,無對應影片)
   ═══════════════════════════════════════════════════════════ */
const JH_LEVELS = [

/* ─── J1:數線上的負數 ─── */
{
  id: "J1", short: "數線負數", title: "關 1|負數:在數線上走路", ep: "J", subj: "jh",
  intro: `<p>國一第一個大魔王就是<b>負數</b>。祕訣只有一句:<b>加=往右走,減=往左走;遇到負號就轉身</b>。所以「加負 5」= 轉身往左走 5 步;「減負 6」= 轉兩次身,還是往右走 6 步。</p><p>把數線上的小圓點<b>拖到題目的答案位置</b>。用走路的方式在腦中算,不要背規則。</p>`,
  formal: `<p class="math">a + (−b) = a − b;a − (−b) = a + b。數線模型:加法 = 向右位移,加負數 = 向左位移;減去一個數 = 加上它的相反數。</p>`,
  goals: [
    { id: "J1-a", text: "第 1 題:把點拖到 3 + (−5) 的位置" },
    { id: "J1-b", text: "第 2 題:把點拖到 (−4) − (−6) 的位置" },
  ],
  state: { p: 0, task: 0 },
  tasks: [{ expr: "3 + (−5)", ans: -2 }, { expr: "(−4) − (−6)", ans: 2 }],
  enter() { this.state.p = 0; this.state.task = 0; },
  nl() { const X = (v) => 60 + (v + 10) * 28; return { X, invX: (px) => (px - 60) / 28 - 10, Y: 360 }; },
  demo() { const s = this.state; return [
    { call: () => { s.task = 0; s.p = 3; }, cap: "從 3 出發。題目:三 加 負五", dur: 2000 },
    { num: [() => s.p, (v) => s.p = v, -2], cap: "加負數=轉身往左,走 5 步,停在 負2", dur: 2600 },
    { call: () => { s.task = 1; s.p = -4; }, cap: "換一題:負四 減 負六", dur: 2200 },
    { num: [() => s.p, (v) => s.p = v, 2], cap: "減負數=轉兩次身,其實是往右走 6 步,停在 2", dur: 2600 },
    { call: () => { s.task = 0; s.p = 0; }, cap: "換你走走看!", dur: 1400 },
  ]; },
  draggables() {
    const s = this.state, m = this.nl();
    return [{
      getScreen: () => ({ x: m.X(s.p), y: m.Y }),
      setScreen: (px) => { s.p = Math.max(-10, Math.min(10, Math.round(m.invX(px)))); },
    }];
  },
  draw() {
    const s = this.state, m = this.nl(), t = this.tasks[s.task];
    // 數線
    g.strokeStyle = TH.axis; g.lineWidth = 2;
    g.beginPath(); g.moveTo(m.X(-10), m.Y); g.lineTo(m.X(10), m.Y); g.stroke();
    for (let k = -10; k <= 10; k++) {
      const px = m.X(k), zero = k === 0;
      g.strokeStyle = zero ? "#ffd166" : TH.axis; g.lineWidth = zero ? 2.5 : 1.5;
      g.beginPath(); g.moveTo(px, m.Y - (zero ? 14 : 8)); g.lineTo(px, m.Y + (zero ? 14 : 8)); g.stroke();
      if (k % 2 === 0) pText(px, m.Y + 34, String(k), k < 0 ? "#38bdf8" : TH.dim, 14, "center", zero);
    }
    pText(m.X(-8), m.Y - 60, "← 負的方向", "#38bdf8", 14, "center");
    pText(m.X(8), m.Y - 60, "正的方向 →", "#4ade80", 14, "center");
    // 題目
    pText(340, 160, `題目:${t.expr} = ?`, TH.text, 30, "center", true);
    // 小圓點角色
    const px = m.X(Math.round(s.p * 10) / 10);
    drawDisc(px, m.Y, 14, "#ffd166", "#0a0e1a", 2);
    pText(px, m.Y + 6, "🚶", "#0a0e1a", 14, "center");
    pText(px, m.Y - 26, `位置 ${Math.round(s.p)}`, "#ffd166", 15, "center", true);
    const pr = Math.round(s.p);
    readout.innerHTML = `第 ${s.task + 1}/2 題:<b>${t.expr}</b>　你在 <b>${pr}</b>`;
    if (pr === t.ans) {
      // 換題只在手指放開後,且不瞬移(從解對的位置繼續)
      if (s.task === 0) { markGoal("J1-a"); if (progress["J1-a"] && !dragTarget && !player.active) s.task = 1; }
      else markGoal("J1-b");
    }
  },
},

/* ─── J2:天平解方程式 ─── */
{
  id: "J2", short: "天平解方程", title: "關 2|未知數 x:用天平「解」出來", ep: "J", subj: "jh",
  intro: `<p><b>x 不是神祕符號,它就是一個蓋著布的砝碼</b>。等式 = 一座平衡的天平。只要<b>兩邊做一樣的事</b>(各拿走一個、各加一個、各分一半),天平永遠平衡——這叫<b>等量公理</b>。</p><p>目標:把左邊清到<b>只剩 x</b>,右邊剩下的就是答案。</p>`,
  formal: `<p class="math">等量公理:a = b ⇒ a±c = b±c、a·c = b·c、a/c = b/c(c≠0)。解方程 = 用等量公理把 x 孤立。</p>`,
  goals: [
    { id: "J2-a", text: "解出 x + 3 = 7" },
    { id: "J2-b", text: "解出 2x = 6" },
  ],
  state: { q: 0, nx: 1, cL: 3, cR: 7, solved: false },
  qs: [{ nx: 1, cL: 3, cR: 7, label: "x + 3 = 7" }, { nx: 2, cL: 0, cR: 6, label: "2x = 6" }],
  loadQ(k) { const q = this.qs[k]; Object.assign(this.state, { q: k, nx: q.nx, cL: q.cL, cR: q.cR, solved: false }); },
  enter() { this.loadQ(0); this._renderCtl && this._renderCtl(); },
  demo() { const s = this.state, lv = this; const R = () => lv._renderCtl && lv._renderCtl(); return [
    { call: () => { lv.loadQ(0); R(); }, cap: "x 加 3 顆砝碼 = 7 顆砝碼,天平是平的", dur: 2400 },
    { call: () => { s.cL--; s.cR--; R(); }, cap: "兩邊各拿走一顆——還是平的", dur: 1800 },
    { call: () => { s.cL--; s.cR--; R(); }, cap: "再拿走一顆", dur: 1400 },
    { call: () => { s.cL--; s.cR--; R(); }, cap: "左邊只剩 x!右邊剩 4 顆:x = 4", dur: 2600 },
    { call: () => { lv.loadQ(0); R(); }, cap: "換你來,之後還有第二題 2x = 6(提示:分一半)", dur: 2000 },
  ]; },
  controls(el) {
    const s = this.state, lv = this;
    const render = () => {
      const solvedNow = s.nx === 1 && s.cL === 0;
      el.innerHTML = `
        <div class="row quiz-msg">目前:<b>${lv.qs[s.q].label}</b></div>
        <div class="row">
          <button id="take">兩邊各拿走 1</button>
          <button id="add">兩邊各加 1</button>
          <button id="half">兩邊各分一半</button>
        </div>
        <div class="row quiz-msg" id="jmsg">${solvedNow ? `<b style="color:#4ade80">x = ${s.cR}!</b>` : ""}</div>
        <div class="row"><button class="primary" id="jnext" style="display:${solvedNow && s.q === 0 ? "" : "none"}">下一題:2x = 6</button></div>`;
      const msg = (t) => { el.querySelector("#jmsg").innerHTML = t; };
      el.querySelector("#take").onclick = () => {
        if (s.cL > 0 && s.cR > 0) { s.cL--; s.cR--; render(); }
        else msg("有一邊已經沒有砝碼可拿了");
      };
      el.querySelector("#add").onclick = () => { s.cL++; s.cR++; render(); };
      el.querySelector("#half").onclick = () => {
        if (s.nx % 2 === 0 && s.cL % 2 === 0 && s.cR % 2 === 0) { s.nx /= 2; s.cL /= 2; s.cR /= 2; render(); }
        else msg("要兩邊都能公平分一半才行(全部都是偶數)");
      };
      el.querySelector("#jnext").onclick = () => { lv.loadQ(1); render(); };
    };
    this._renderCtl = render;
    render();
  },
  draw() {
    const s = this.state;
    const cx = 340, beamY = 260, panY = 340;
    // 支架與橫樑
    g.strokeStyle = TH.axis; g.lineWidth = 4;
    g.beginPath(); g.moveTo(cx, beamY); g.lineTo(cx, beamY + 60); g.stroke();
    g.beginPath(); g.moveTo(cx - 190, beamY); g.lineTo(cx + 190, beamY); g.stroke();
    for (const side of [-1, 1]) {
      const px = cx + side * 190;
      g.strokeStyle = TH.axis; g.lineWidth = 2;
      g.beginPath(); g.moveTo(px, beamY); g.lineTo(px - 60, panY); g.moveTo(px, beamY); g.lineTo(px + 60, panY); g.stroke();
      g.strokeStyle = TH.axis; g.lineWidth = 3;
      g.beginPath(); g.moveTo(px - 70, panY); g.lineTo(px + 70, panY); g.stroke();
    }
    // 左盤:x 箱 + 砝碼;右盤:砝碼
    const drawItems = (px, nx, c) => {
      let ix = px - 60, iy = panY - 26;
      for (let k = 0; k < nx; k++) {
        g.fillStyle = "#ffd166"; g.fillRect(ix, iy, 34, 24);
        pText(ix + 17, iy + 17, "x", "#1a1a1a", 16, "center", true);
        ix += 40; if (ix > px + 40) { ix = px - 60; iy -= 30; }
      }
      for (let k = 0; k < Math.min(c, 12); k++) {
        drawDisc(ix + 12, iy + 12, 11, "#38bdf8", "#0a0e1a", 1.5);
        ix += 28; if (ix > px + 52) { ix = px - 60; iy -= 28; }
      }
      if (c > 12) pText(px, iy - 14, `共 ${c} 顆`, "#38bdf8", 13, "center");
    };
    drawItems(cx - 190, s.nx, s.cL);
    drawItems(cx + 190, 0, s.cR);
    pText(cx - 190, panY + 28, "左", TH.dim, 14, "center");
    pText(cx + 190, panY + 28, "右", TH.dim, 14, "center");
    pText(cx, 150, this.qs[s.q].label, TH.text, 30, "center", true);
    const solved = s.nx === 1 && s.cL === 0;
    if (solved) {
      pText(cx, 470, `x = ${s.cR}`, "#4ade80", 40, "center", true);
      markGoal(s.q === 0 ? "J2-a" : "J2-b");
    }
    readout.innerHTML = `左邊:${s.nx} 個 x + ${s.cL} 顆砝碼　右邊:${s.cR} 顆砝碼${solved ? "　<b style='color:#4ade80'>解出來了!</b>" : ""}`;
  },
},

/* ─── J3:座標平面尋寶 ─── */
{
  id: "J3", short: "座標尋寶", title: "關 3|座標 (x, y):兩個數字的尋寶指令", ep: "J", subj: "jh",
  intro: `<p>座標就是一組<b>尋寶指令</b>,而且<b>順序固定</b>:第一個數字 x 管<b>左右</b>(正右負左),第二個 y 管<b>上下</b>(正上負下)。(3, −2) 唸作「右 3、下 2」。</p><p>把黃點拖到星星上。虛線會幫你把路拆成「先走 x、再走 y」兩段。</p>`,
  formal: `<p class="math">直角座標系:平面上每點對應唯一有序數對 (x, y)。x > 0, y > 0 為第一象限,逆時針依序為二、三、四象限。</p>`,
  goals: [
    { id: "J3-a", text: "尋寶 1:把點送到 (3, −2)" },
    { id: "J3-b", text: "尋寶 2:把點送到 (−4, 1)" },
  ],
  state: { pt: V(1, 1), stage: 0 },
  targets: [V(3, -2), V(-4, 1)],
  enter() { this.state.pt = V(1, 1); this.state.stage = 0; },
  demo() { const s = this.state; return [
    { call: () => { s.pt = V(0, 0); }, cap: "指令 (3, 負2):第一個數管左右,第二個管上下。從原點出發", dur: 2600 },
    { vec: [() => s.pt, (w) => s.pt = w, V(3, 0)], cap: "先走 x:往右 3", dur: 1800 },
    { vec: [() => s.pt, (w) => s.pt = w, V(3, -2)], cap: "再走 y:往下 2——到了!", dur: 2000 },
    { vec: [() => s.pt, (w) => s.pt = w, V(1, 1)], cap: "換你尋寶。記住:先 x 再 y,順序不能換", dur: 1800 },
  ]; },
  draggables() {
    const s = this.state;
    return [{ get: () => s.pt, set: (w) => { s.pt = w; } }];
  },
  draw() {
    const s = this.state, tgt = this.targets[s.stage];
    drawGrid(MI(), { original: false });
    pText(toScr(V(4.6, 0)).x, toScr(V(4.6, 0)).y - 8, "x", TH.dim, 15);
    pText(toScr(V(0, 4.6)).x + 8, toScr(V(0, 4.6)).y, "y", TH.dim, 15);
    drawStar(tgt, COL.star);
    labelAt(tgt, `(${fmt(tgt.x)}, ${fmt(tgt.y)})`, COL.star, 14, -12);
    drawDash(V(0, 0), V(s.pt.x, 0), "#38bdf8");
    drawDash(V(s.pt.x, 0), s.pt, "#4ade80");
    drawDot(s.pt, "#ffd166", 8);
    readout.innerHTML = `尋寶 ${s.stage + 1}/2:目標 (${fmt(tgt.x)}, ${fmt(tgt.y)})　你在 (<b>${fmt(s.pt.x)}</b>, <b>${fmt(s.pt.y)}</b>)`;
    if (Math.hypot(s.pt.x - tgt.x, s.pt.y - tgt.y) < 0.2) {
      // 換目標只在手指放開後,且不瞬移
      if (s.stage === 0) { markGoal("J3-a"); if (progress["J3-a"] && !dragTarget && !player.active) s.stage = 1; }
      else markGoal("J3-b");
    }
  },
},

/* ─── J4:比與比例 ─── */
{
  id: "J4", short: "比與比例", title: "關 4|等比:放大縮小,形狀不變的祕密", ep: "J", subj: "jh",
  intro: `<p>4:3 的照片放大成 8:6,看起來一模一樣;拉成 8:4 就變形了。<b>「比」相等 = 形狀相同</b>。</p><p>調寬和高,注意那條<b>對角線</b>:只要長方形的角落落在同一條對角線上,比就沒變——這就是等比的幾何長相。</p>`,
  formal: `<p class="math">a:b = c:d ⇔ ad = bc(外項積=內項積)。等比的長方形,對角線的傾斜程度相同,所以角落都落在同一條線上。</p>`,
  goals: [
    { id: "J4-a", text: "做出 4:3 的等比放大版(寬 > 4)" },
    { id: "J4-b", text: "做出比為 2:1 的長方形" },
  ],
  state: { w: 4, h: 3 },
  enter() { this.state.w = 4; this.state.h = 3; },
  demo() { const s = this.state; return [
    { cap: "虛線是原本的 4:3。注意穿過角落的對角線", dur: 2400 },
    // 單一縮放參數同步放大,補間全程保持 3w=4h(角落始終在線上)
    { num: [() => s.w / 4, (t) => { s.w = 4 * t; s.h = 3 * t; }, 2], cap: "放大成 8:6——角落還在同一條線上,比沒變", dur: 2600 },
    { num: [() => s.h, (v) => s.h = Math.round(v), 5], cap: "只把高改掉:角落離開對角線,變形了", dur: 2400 },
    { num: [() => s.w, (v) => s.w = Math.round(v), 4], num2: [() => s.h, (v) => s.h = Math.round(v), 3], cap: "換你:先做等比放大,再做出 2 比 1", dur: 1800 },
  ]; },
  controls(el) {
    const s = this.state;
    el.innerHTML = `
      <div class="row"><label>寬</label><input type="range" id="jw" min="1" max="9" step="1" value="4"><span class="val" id="vjw">4</span></div>
      <div class="row"><label>高</label><input type="range" id="jh" min="1" max="7" step="1" value="3"><span class="val" id="vjh">3</span></div>`;
    el.querySelector("#jw").oninput = (e) => { s.w = +e.target.value; el.querySelector("#vjw").textContent = s.w; };
    el.querySelector("#jh").oninput = (e) => { s.h = +e.target.value; el.querySelector("#vjh").textContent = s.h; };
    this._sync = () => {
      el.querySelector("#jw").value = s.w; el.querySelector("#vjw").textContent = fmt(s.w);
      el.querySelector("#jh").value = s.h; el.querySelector("#vjh").textContent = fmt(s.h);
    };
  },
  draw() {
    const s = this.state;
    const X0 = 110, Y0 = 560, SC = 52; // 原點左下
    const same = 3 * s.w === 4 * s.h;
    // 對角線(沿 4:3 方向延伸)
    g.strokeStyle = same ? "#4ade80" : TH.demoAxis; g.lineWidth = 2; g.setLineDash([6, 5]);
    g.beginPath(); g.moveTo(X0, Y0); g.lineTo(X0 + 9.6 * SC, Y0 - 7.2 * SC); g.stroke(); g.setLineDash([]);
    // 參考 4:3(虛線)
    g.strokeStyle = TH.axis; g.lineWidth = 1.5; g.setLineDash([4, 4]);
    g.strokeRect(X0, Y0 - 3 * SC, 4 * SC, 3 * SC); g.setLineDash([]);
    pText(X0 + 4 * SC - 6, Y0 - 3 * SC - 8, "4:3", TH.dim, 13, "right");
    // 使用者長方形
    g.fillStyle = same ? "rgba(74,222,128,.25)" : "rgba(56,189,248,.25)";
    g.fillRect(X0, Y0 - s.h * SC, s.w * SC, s.h * SC);
    g.strokeStyle = same ? "#4ade80" : "#38bdf8"; g.lineWidth = 2.5;
    g.strokeRect(X0, Y0 - s.h * SC, s.w * SC, s.h * SC);
    drawDisc(X0 + s.w * SC, Y0 - s.h * SC, 7, same ? "#4ade80" : "#ffd166", "#0a0e1a", 1.5);
    // 約分(示範補間時 w,h 可能是小數,只在整數時約分)
    const ints = Number.isInteger(s.w) && Number.isInteger(s.h);
    const gcd = (a, b) => b ? gcd(b, a % b) : a, d = ints ? gcd(s.w, s.h) : 1;
    pText(X0, Y0 + 30, `寬:高 = ${fmt(s.w)}:${fmt(s.h)}${d > 1 ? ` = ${s.w / d}:${s.h / d}` : ""}`, TH.text, 17, "left", true);
    readout.innerHTML = `寬:高 = <b>${fmt(s.w)}:${fmt(s.h)}</b>${same ? "　<b style='color:#4ade80'>和 4:3 等比!角落在線上</b>" : s.w === 2 * s.h ? "　<b style='color:#4ade80'>2:1!</b>" : ""}`;
    if (same && s.w > 4) markGoal("J4-a");
    if (s.w === 2 * s.h) markGoal("J4-b");
  },
},

/* ─── J5:質因數分解 ─── */
{
  id: "J5", short: "質因數分解", title: "關 5|質因數:把數字拆到不能再拆", ep: "J", subj: "jh",
  intro: `<p>每個數都能拆成<b>質數</b>的乘積,而且<b>拆法只有一種</b>(順序不算)——這是算術基本定理,國一因倍數單元的地基。</p><p>用質數按鈕去「除」上面的數字:除得盡就拆下一顆質數,除不盡按了也沒用。把數字拆到剩 1,分解就完成了。</p>`,
  formal: `<p class="math">算術基本定理:任何大於 1 的整數可唯一表示為質數的乘積(不計順序)。60 = 2²×3×5。</p>`,
  goals: [
    { id: "J5-a", text: "完整分解 60" },
    { id: "J5-b", text: "完整分解 84" },
  ],
  state: { q: 0, remain: 60, factors: [] },
  qs: [60, 84],
  loadQ(k) { Object.assign(this.state, { q: k, remain: this.qs[k], factors: [] }); },
  enter() { this.loadQ(0); this._renderCtl && this._renderCtl(); },
  demo() { const s = this.state, lv = this; const R = () => lv._renderCtl && lv._renderCtl(); return [
    { call: () => { lv.loadQ(0); R(); }, cap: "拆 60。先試最小的質數 2", dur: 2200 },
    { call: () => { s.remain = 30; s.factors = [2]; R(); }, cap: "60 除以 2 = 30,拆下一顆 2", dur: 2000 },
    { call: () => { s.remain = 15; s.factors = [2, 2]; R(); }, cap: "30 再除以 2 = 15。15 除不了 2,換 3", dur: 2200 },
    { call: () => { s.remain = 5; s.factors = [2, 2, 3]; R(); }, cap: "15 除以 3 = 5,5 本身是質數", dur: 2000 },
    { call: () => { s.remain = 1; s.factors = [2, 2, 3, 5]; R(); }, cap: "除到剩 1:60 = 2×2×3×5,收工", dur: 2600 },
    { call: () => { lv.loadQ(0); R(); }, cap: "換你拆,拆完 60 還有 84", dur: 1600 },
  ]; },
  controls(el) {
    const s = this.state, lv = this;
    const render = () => {
      const done = s.remain === 1;
      el.innerHTML = `
        <div class="row">${[2, 3, 5, 7].map((p) => `<button data-p="${p}">÷ ${p}</button>`).join("")}</div>
        <div class="row quiz-msg" id="jmsg"></div>
        <div class="row"><button class="primary" id="jnext" style="display:${done && s.q === 0 ? "" : "none"}">下一題:分解 84</button></div>`;
      el.querySelectorAll("button[data-p]").forEach((btn) => {
        btn.onclick = () => {
          if (s.remain === 1) return;
          const p = +btn.dataset.p;
          if (s.remain % p === 0) { s.remain /= p; s.factors.push(p); render(); }
          else el.querySelector("#jmsg").innerHTML = `${s.remain} 不能被 ${p} 整除,換一顆質數試試`;
        };
      });
      el.querySelector("#jnext").onclick = () => { lv.loadQ(1); render(); };
    };
    this._renderCtl = render;
    render();
  },
  draw() {
    const s = this.state, N = this.qs[s.q];
    pText(340, 140, `分解 ${N}`, TH.text, 30, "center", true);
    // 分解鏈
    let x = 120, y = 260;
    const chain = [N]; let r = N;
    for (const f of s.factors) { r /= f; chain.push(r); }
    chain.forEach((v, k) => {
      drawDisc(x, y, 26, v === 1 ? "#4ade80" : "#1d2440", v === 1 ? "#4ade80" : TH.axis, 2);
      pText(x, y + 6, String(v), v === 1 ? "#0a0e1a" : TH.text, 16, "center", true);
      if (k < s.factors.length) {
        pText(x + 45, y - 10, `÷${s.factors[k]}`, "#ffd166", 14, "center", true);
        g.strokeStyle = TH.axis; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(x + 26, y); g.lineTo(x + 64, y); g.stroke();
      }
      x += 90; if (x > 580) { x = 120; y += 90; }
    });
    // 已拆下的質數 + 冪次式
    const cnt = {};
    s.factors.forEach((f) => cnt[f] = (cnt[f] || 0) + 1);
    const sup = { 2: "²", 3: "³", 4: "⁴" };
    const powStr = Object.keys(cnt).sort((a, b) => a - b).map((p) => cnt[p] > 1 ? `${p}${sup[cnt[p]] || "^" + cnt[p]}` : p).join(" × ");
    if (s.factors.length) pText(340, 480, `${N} = ${s.factors.join(" × ")}${s.remain > 1 ? ` × ${s.remain}(還沒拆完)` : ""}`, TH.dim, 17, "center");
    if (s.remain === 1) {
      pText(340, 520, `${N} = ${powStr}`, "#4ade80", 24, "center", true);
      markGoal(s.q === 0 ? "J5-a" : "J5-b");
    }
    readout.innerHTML = s.remain === 1 ? `<b style="color:#4ade80">分解完成:${N} = ${powStr}</b>` : `剩下 <b>${s.remain}</b> 還沒拆完`;
  },
},

/* ─── J6:分數乘法面積模型 ─── */
{
  id: "J6", short: "分數乘法", title: "關 6|分數乘分數:就是「取一部分的一部分」", ep: "J", subj: "jh",
  intro: `<p>「二分之一 乘 三分之二」到底在算什麼?就是<b>先取一半,再取那一半的三分之二</b>。用一塊正方形蛋糕看:橫向取幾格、縱向取幾格,<b>重疊的綠色區域就是答案</b>。</p><p>調兩個滑桿,看分子相乘、分母相乘為什麼是對的——因為格子總數是分母相乘,綠格數是分子相乘。</p>`,
  formal: `<p class="math">(a/b)×(c/d) = ac/bd。面積模型:單位正方形切成 b×d 格,a 直條與 c 橫條重疊的部分共 ac 格。</p>`,
  goals: [
    { id: "J6-a", text: "做出 二分之一 × 三分之二(綠色 = 三分之一)" },
    { id: "J6-b", text: "做出乘積剛好 = 四分之一 的另一種取法" },
  ],
  state: { a: 1, b: 1 },
  enter() { this.state.a = 1; this.state.b = 1; },
  demo() { const s = this.state; return [
    { cap: "蛋糕切成 4 直條 × 3 橫條,共 12 格", dur: 2400 },
    { num: [() => s.a, (v) => s.a = Math.round(v), 2], cap: "橫向取 4 條裡的 2 條——就是一半", dur: 2200 },
    { num: [() => s.b, (v) => s.b = Math.round(v), 2], cap: "縱向再取 3 條裡的 2 條", dur: 2200 },
    { cap: "綠色重疊 = 12 格裡的 4 格 = 三分之一。分子乘分子、分母乘分母的原因就在眼前", dur: 3000 },
    { num: [() => s.a, (v) => s.a = Math.round(v), 1], num2: [() => s.b, (v) => s.b = Math.round(v), 1], cap: "換你切蛋糕!", dur: 1400 },
  ]; },
  controls(el) {
    const s = this.state;
    el.innerHTML = `
      <div class="row"><label>橫向取</label><input type="range" id="ja" min="1" max="4" step="1" value="1"><span class="val" id="vja">1/4</span></div>
      <div class="row"><label>縱向取</label><input type="range" id="jb" min="1" max="3" step="1" value="1"><span class="val" id="vjb">1/3</span></div>`;
    el.querySelector("#ja").oninput = (e) => { s.a = +e.target.value; el.querySelector("#vja").textContent = s.a + "/4"; };
    el.querySelector("#jb").oninput = (e) => { s.b = +e.target.value; el.querySelector("#vjb").textContent = s.b + "/3"; };
    this._sync = () => {
      el.querySelector("#ja").value = s.a; el.querySelector("#vja").textContent = s.a + "/4";
      el.querySelector("#jb").value = s.b; el.querySelector("#vjb").textContent = s.b + "/3";
    };
  },
  draw() {
    const s = this.state;
    const X0 = 150, Y0 = 120, W = 380, H = 380, cw = W / 4, ch = H / 3;
    // 底格
    g.fillStyle = TH.panel; g.fillRect(X0, Y0, W, H);
    // 橫向取 a 直條(黃)
    g.fillStyle = "rgba(255,209,102,.30)"; g.fillRect(X0, Y0, s.a * cw, H);
    // 縱向取 b 橫條(藍)
    g.fillStyle = "rgba(56,189,248,.30)"; g.fillRect(X0, Y0 + H - s.b * ch, W, s.b * ch);
    // 交集(綠)
    g.fillStyle = "rgba(74,222,128,.55)"; g.fillRect(X0, Y0 + H - s.b * ch, s.a * cw, s.b * ch);
    // 格線
    g.strokeStyle = TH.axis; g.lineWidth = 1.5;
    for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(X0 + k * cw, Y0); g.lineTo(X0 + k * cw, Y0 + H); g.stroke(); }
    for (let k = 0; k <= 3; k++) { g.beginPath(); g.moveTo(X0, Y0 + k * ch); g.lineTo(X0 + W, Y0 + k * ch); g.stroke(); }
    pText(X0 + s.a * cw / 2, Y0 - 12, `${s.a}/4`, "#ffd166", 16, "center", true);
    pText(X0 - 14, Y0 + H - s.b * ch / 2 + 5, `${s.b}/3`, "#38bdf8", 16, "right", true);
    const num = s.a * s.b, gcd = (a, b) => b ? gcd(b, a % b) : a, d = gcd(num, 12);
    pText(X0 + W / 2, Y0 + H + 36, `${s.a}/4 × ${s.b}/3 = ${num}/12${d > 1 ? ` = ${num / d}/${12 / d}` : ""}`, TH.text, 20, "center", true);
    readout.innerHTML = `綠色 = <b>${num}</b> 格 / 12 格${num === 4 ? "　<b style='color:#4ade80'>= 1/3!</b>" : num === 3 ? "　<b style='color:#4ade80'>= 1/4!</b>" : ""}`;
    if (s.a === 2 && s.b === 2) markGoal("J6-a");
    if (num === 3) markGoal("J6-b");
  },
},
];

/* ═══════════════════════════════════════════════════════════
   總測驗關 — 每科收尾,通過才算完成該科目(證書條件)
   ═══════════════════════════════════════════════════════════ */
function makeQuiz(id, name, pass, questions) {
  return {
    id, short: "總測驗", title: `總測驗|${name}:把 ${questions.length} 關串起來`, ep: "Q",
    intro: `<p>不看畫布、不動滑桿——現在只考<b>觀念</b>。${questions.length} 題單選,答對 <b>${pass} 題以上</b>過關;每題答完都有解釋,答錯可以整卷重來。</p><p>這些題目全部來自你玩過的關卡。如果哪題卡住,回去把那關再玩一次,比背答案有用。</p>`,
    formal: `<p class="math">通過標準:${pass}/${questions.length}。每題都對應某一關最重要的那個觀念;選項每次重新洗牌,背位置沒有用。</p>`,
    goals: [{ id: `${id}-pass`, text: `答對 ${pass}/${questions.length} 題以上,拿下本科目` }],
    state: { i: 0, score: 0, results: [], done: false, answered: false },
    enter() {
      Object.assign(this.state, { i: 0, score: 0, results: [], done: false, answered: false });
      this._render && this._render();
    },
    controls(el) {
      const s = this.state, lv = this;
      const render = () => {
        if (s.done) {
          const passed = s.score >= pass;
          el.innerHTML = `<div class="quiz-q">${passed ? "🎉 通過!" : "差一點,再來一輪!"}　得分 <b>${s.score}/${questions.length}</b></div>
            <div class="row"><button class="primary" id="again">重新測驗</button></div>`;
          el.querySelector("#again").onclick = () => lv.enter();
          if (passed) markGoal(`${id}-pass`);
          return;
        }
        const q = questions[s.i];
        const opts = q.opts.map((text, k) => ({ text, ok: k === 0 }));
        for (let k = opts.length - 1; k > 0; k--) { // 洗牌:正解不固定在同一格
          const j = Math.floor(Math.random() * (k + 1));
          [opts[k], opts[j]] = [opts[j], opts[k]];
        }
        el.innerHTML = `<div class="quiz-q"><b>第 ${s.i + 1}/${questions.length} 題</b>　${q.q}</div>` +
          opts.map((o, k) => `<button class="quiz-opt" data-k="${k}">${o.text}</button>`).join("") +
          `<div class="quiz-msg" id="qmsg"></div>
           <div class="row"><button class="primary" id="nextq" style="display:none">${s.i + 1 === questions.length ? "看結果" : "下一題"}</button></div>`;
        el.querySelectorAll(".quiz-opt").forEach((btn, k) => {
          btn.onclick = () => {
            if (s.answered) return;
            s.answered = true;
            const ok = opts[k].ok;
            if (ok) s.score++;
            s.results.push(ok);
            btn.classList.add(ok ? "right" : "wrong");
            el.querySelectorAll(".quiz-opt").forEach((b, j) => { if (opts[j].ok) b.classList.add("right"); });
            el.querySelector("#qmsg").innerHTML = (ok ? "✓ " : "✗ ") + q.why;
            el.querySelector("#nextq").style.display = "";
          };
        });
        el.querySelector("#nextq").onclick = () => {
          s.i++; s.answered = false;
          if (s.i >= questions.length) s.done = true;
          render();
        };
      };
      this._render = render;
      render();
    },
    draw() {
      const s = this.state, n = questions.length;
      const X0 = 120, Y = 300, gap = Math.min(70, 440 / n);
      pText(340, 180, s.done ? (s.score >= pass ? "🏆" : "💪") : "📝", TH.text, 72, "center");
      for (let k = 0; k < n; k++) {
        const x = X0 + k * gap + gap / 2;
        let fill = TH.gridFaint, label = "";
        if (k < s.results.length) { fill = s.results[k] ? "#4ade80" : "#ff5c7a"; label = s.results[k] ? "✓" : "✗"; }
        else if (k === s.i && !s.done) fill = "#ffd166";
        drawDisc(x, Y, 16, fill, TH.axis, 1.5);
        if (label) pText(x, Y + 6, label, "#0a0e1a", 16, "center", true);
      }
      pText(340, Y + 70, `${s.score} / ${n}　(通過線 ${pass})`, TH.dim, 18, "center");
      readout.innerHTML = s.done
        ? (s.score >= pass ? `<b style="color:#4ade80">通過!${name} 完成</b>` : `${s.score}/${n},通過線 ${pass}——再來一輪`)
        : `第 ${s.i + 1} 題,目前 ${s.score} 分`;
    },
  };
}
JH_LEVELS.push(makeQuiz("JQ", "國中銜接", 5, [
  { q: "3 + (−5) = ?",
    opts: ["−2", "2", "−8", "8"],
    why: "加負數 = 轉身往左走 5 步:從 3 走到 −2。(關 1)" },
  { q: "天平兩邊各拿走 3 顆砝碼,原本平衡的等式會?",
    opts: ["仍然成立——這就是等量公理", "左邊變重", "右邊變重", "從此無法判斷"],
    why: "兩邊做一樣的事,平衡不會被打破;解方程式全靠這一條。(關 2)" },
  { q: "點 (3, −2) 位在座標平面的哪裡?",
    opts: ["第四象限(右下)", "第一象限(右上)", "第二象限(左上)", "第三象限(左下)"],
    why: "x = 3 往右、y = −2 往下,落在右下的第四象限。(關 3)" },
  { q: "一張 4:3 的照片等比放大後,寬變成 8,高應該是?",
    opts: ["6", "7", "9", "12"],
    why: "4:3 = 8:6;外項積 4×6 = 內項積 3×8,都是 24。(關 4)" },
  { q: "60 的質因數分解是?",
    opts: ["2×2×3×5", "2×3×10", "4×15", "2×2×2×3×5"],
    why: "10、4、15 都不是質數還能再拆;2×2×2×3×5 = 120 不是 60。(關 5)" },
  { q: "二分之一 × 三分之二 = ?",
    opts: ["三分之一", "五分之二", "六分之一", "四分之三"],
    why: "面積模型:12 格裡的綠色佔 4 格 = 1/3;分子乘分子、分母乘分母。(關 6)" },
]));

/* ---------- 科目 ---------- */
/* ---------- 科目 ---------- */
const SUBJECTS = {
  jh: { name: "國中銜接", levels: JH_LEVELS },
};
let curSubject = "jh";

/* ---------- UI 骨架 ---------- */
const tabsEl = document.getElementById("tabs");
const subjEl = document.getElementById("subjects");
let levels = JH_LEVELS;
let curIdx = 0;
const cur = () => levels[curIdx];

function levelDone(lv) { return lv.goals.every((gl) => progress[gl.id]); }
function subjectDone(key) { return SUBJECTS[key].levels.every(levelDone); }
function allLevels() { return Object.values(SUBJECTS).flatMap((s) => s.levels); }

const overallEl = document.getElementById("overall");
const certEl = document.getElementById("cert");
function renderOverall() {
  const all = allLevels(), done = all.filter(levelDone).length;
  overallEl.textContent = `　🎓 總進度 ${done}/${all.length}`;
}
function updateCert() {
  const allDone = Object.keys(SUBJECTS).every(subjectDone);
  const key = curSubject, sub = SUBJECTS[key];
  const date = new Date().toISOString().slice(0, 10);
  if (allDone) {
    certEl.className = "show";
    certEl.innerHTML = `<div class="big">🏆 全通關!國中銜接 ${allLevels().length} 關全部完成</div><div class="sub">國中數感實驗室 · ${date} · 截圖留念吧</div>`;
  } else if (subjectDone(key)) {
    certEl.className = "show";
    certEl.innerHTML = `<div class="big">🎓 恭喜完成【${sub.name}】${sub.levels.length} 關!</div><div class="sub">國中數感實驗室 · ${date} · 截圖留念吧</div>`;
  } else {
    certEl.className = "";
    certEl.innerHTML = "";
  }
}

function renderSubjects() {
  subjEl.innerHTML = "";
  for (const [key, sub] of Object.entries(SUBJECTS)) {
    const b = document.createElement("button");
    const done = sub.levels.filter(levelDone).length;
    b.textContent = `${sub.name} (${done}/${sub.levels.length})`;
    b.className = key === curSubject ? "active" : "";
    b.onclick = () => switchSubject(key);
    subjEl.appendChild(b);
  }
}

function switchSubject(key) {
  if (key === curSubject && levels === SUBJECTS[key].levels) return;
  player.cancel();
  curSubject = key;
  levels = SUBJECTS[key].levels;
  renderSubjects();
  switchLevel(0);
}

function renderTabs() {
  tabsEl.innerHTML = "";
  levels.forEach((lv, k) => {
    const b = document.createElement("button");
    b.textContent = `${k + 1}. ${lv.short}`;
    b.className = (k === curIdx ? "active " : "") + (levelDone(lv) ? "done" : "");
    b.onclick = () => switchLevel(k);
    tabsEl.appendChild(b);
  });
}

function renderGoals() {
  const el = document.getElementById("lv-goals");
  el.innerHTML = "";
  cur().goals.forEach((gl) => {
    const d = document.createElement("div");
    d.className = "goal" + (progress[gl.id] ? " done" : "");
    d.innerHTML = `<span class="box">${progress[gl.id] ? "✓" : "○"}</span>${gl.text}`;
    el.appendChild(d);
  });
}

function switchLevel(k) {
  player.cancel();
  curIdx = k;
  const lv = cur();
  document.getElementById("lv-title").textContent = lv.title;
  const ep = document.getElementById("lv-ep");
  ep.textContent = EP[lv.ep][0]; ep.href = EP[lv.ep][1];
  document.getElementById("lv-intro").innerHTML = lv.intro;
  document.getElementById("lv-formal-body").innerHTML = lv.formal;
  document.getElementById("lv-formal").open = false;
  const ctl = document.getElementById("lv-controls");
  ctl.innerHTML = "";
  lv._sync = null;
  demoBtnEl.style.display = lv.demo ? "" : "none";
  lv.enter && lv.enter();
  lv.controls && lv.controls(ctl);
  renderGoals(); renderTabs(); renderSubjects(); renderOverall(); updateCert();
  // 第一次進入且尚未通關 → 自動播示範
  if (lv.demo && !demoSeen[lv.id] && !levelDone(lv)) {
    demoSeen[lv.id] = true;
    localStorage.setItem("jrlab-demoseen", JSON.stringify(demoSeen));
    player.start(lv.demo());
  }
}

demoBtnEl.onclick = () => {
  if (player.active) player.stop();
  else if (cur().demo) player.start(cur().demo());
};

function frame() {
  player.update();
  clear();
  cur().draw();
  requestAnimationFrame(frame);
}

// 主題初始化 + 切換鈕
applyTheme(themeName);
const themeBtn = document.getElementById("theme-btn");
themeBtn.textContent = themeName === "light" ? "☀️" : "🌙";
themeBtn.onclick = () => {
  applyTheme(themeName === "light" ? "dark" : "light");
  themeBtn.textContent = themeName === "light" ? "☀️" : "🌙";
};

// 旁白語音開關
const voiceBtn = document.getElementById("voice-btn");
function syncVoiceBtn() { voiceBtn.textContent = voiceOn ? "🔊" : "🔇"; voiceBtn.classList.toggle("on", voiceOn); }
syncVoiceBtn();
voiceBtn.onclick = () => {
  voiceOn = !voiceOn;
  localStorage.setItem("jrlab-voice", voiceOn ? "1" : "0");
  syncVoiceBtn();
  if (!voiceOn) { stopVoice(); player.clipWaiting = false; }
  else { getAudioEl(); if (player.active) player.playClip(player.steps[player.idx]); } // 開啟時解鎖音訊+補播當前句
};

renderSubjects();
switchLevel(0);
frame();

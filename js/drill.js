/* ═══════════════════════════════════════════════════════════
   drill.js — 綜合演練出題器
   依賴 main.js 的全域:SUBJECTS, markGoal, progress, PKEY,
   pText, drawDisc, clear, TH, canvas, g, CX, CY, readout,
   player, cur, levels, curIdx, curSubject, renderTabs,
   renderSubjects, renderOverall, updateCert
   ═══════════════════════════════════════════════════════════ */
"use strict";

/* ─── 題型錯題本 ─── */
const DBOOK_KEY = "jrlab-drillbook-v1";
let drillBook = {};
try { drillBook = JSON.parse(localStorage.getItem(DBOOK_KEY) || "{}"); } catch (e) {}
function saveDrillBook() { try { localStorage.setItem(DBOOK_KEY, JSON.stringify(drillBook)); } catch(e) {} }
function dbMiss(tid) { drillBook[tid] = (drillBook[tid] || 0) + 1; saveDrillBook(); }
function dbHit(tid)  { if (drillBook[tid]) { delete drillBook[tid]; saveDrillBook(); } }

/* ─── Seeded RNG (mulberry32) ─── */
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ─── 工具 ─── */
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }
function fracStr(n, d) {
  if (d === 0) return "?";
  if (n === 0) return "0";
  const g = gcd(Math.abs(n), Math.abs(d));
  const sn = (n / g) * (d < 0 ? -1 : 1), sd = Math.abs(d / g);
  return sd === 1 ? String(sn) : `${sn}/${sd}`;
}
function normAns(s) {
  // 去空白、全形→半形、繁體大小寫數字統一不處理(以生活情境整數為主)
  return String(s).replace(/\s/g, "")
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[＋＋]/g, "+").replace(/[－−−]/g, "-")
    .replace(/[＜]/g, "<").replace(/[＞]/g, ">")
    .replace(/[≦]/g, "<=").replace(/[≧]/g, ">=")
    .replace(/[×]/g, "*").replace(/[÷]/g, "/")
    .replace(/，/g, ",")           // 全形逗號 → 半形
    .replace(/（/g, "(").replace(/）/g, ")")  // 全形括號 → 半形
    .toLowerCase();
}
function normIneq(s) {
  // 不等式答案正規化:x<3 / x >-2 / x>=1 → 統一格式
  return normAns(s).replace(/\s/g, "")
    .replace(/=</g, "<=").replace(/=>/g, ">=")
    .replace(/<=/g, "≤").replace(/>=/g, "≥"); // 內部用 unicode 比對
}
function ineqMatch(userRaw, correct) {
  // correct 已是 normIneq 格式
  return normIneq(userRaw) === correct;
}
function fracMatch(userRaw, numer, denom) {
  const s = normAns(userRaw);
  const expected = fracStr(numer, denom);
  if (s === normAns(expected)) return true;
  // 也接受等值分數如 2/4 → 1/2
  const m = s.match(/^(-?\d+)\/(-?\d+)$/);
  if (m) {
    const un = parseInt(m[1]), ud = parseInt(m[2]);
    return un * denom === numer * ud;
  }
  return false;
}

/* ═══════════════════════════════════════════════════════════
   16 個題型模板
   gen(rng) → { q, ans, why, check }
   check(gen_result) → boolean  (獨立驗算,不得重複用 gen 的公式)
   ═══════════════════════════════════════════════════════════ */
const DRILL_TEMPLATES = [

  /* ─── B1-1 負數加減 ─── */
  {
    tid: "b1_neg_add",
    book: "b1",
    gen(rng) {
      const a = Math.floor(rng() * 15) - 7;      // -7..7
      const b = Math.floor(rng() * 15) - 7;
      const op = rng() < 0.5 ? "+" : "-";
      const ans = op === "+" ? a + b : a - b;
      const bStr = b < 0 ? `(${b})` : String(b);
      const q = `計算：${a} ${op} ${bStr} = ?`;
      const why = op === "+"
        ? `${a} 加 ${b}：在數線上從 ${a} 往${b >= 0 ? "右" : "左"}走 ${Math.abs(b)} 步，到達 ${ans}。`
        : `${a} 減 ${b}：減去 ${b} 等於加上 ${-b}，結果 ${a} + (${-b}) = ${ans}。`;
      return {
        q, ans: String(ans), why,
        check: (r) => {
          // 驗算：用反向加減驗
          const parsed = parseInt(r.ans);
          if (op === "+") return parsed - b === a;
          return parsed + b === a;
        },
      };
    },
  },

  /* ─── B1-2 絕對值比較 ─── */
  {
    tid: "b1_abs_compare",
    book: "b1",
    gen(rng) {
      const a = Math.floor(rng() * 12) - 6;  // -6..5
      let b = Math.floor(rng() * 12) - 6;
      // 保證 |a| ≠ |b|（避免退化的「一樣大」佔比過高）
      while (Math.abs(b) === Math.abs(a)) b = Math.floor(rng() * 12) - 6;
      const ansA = Math.abs(a), ansB = Math.abs(b);
      let ans, why;
      if (ansA > ansB) {
        ans = `|${a}|`;
        why = `|${a}| = ${ansA}，|${b}| = ${ansB}，${ansA} > ${ansB}，所以 |${a}| 較大。`;
      } else if (ansA < ansB) {
        ans = `|${b}|`;
        why = `|${a}| = ${ansA}，|${b}| = ${ansB}，${ansB} > ${ansA}，所以 |${b}| 較大。`;
      } else {
        ans = "一樣大";
        why = `|${a}| = ${ansA}，|${b}| = ${ansB}，兩者相等。`;
      }
      return {
        q: `|${a}| 和 |${b}| 哪個比較大？(請回答「|${a}|」、「|${b}|」或「一樣大」)`,
        ans,
        why,
        check: (r) => {
          const absA = Math.abs(a), absB = Math.abs(b);
          if (absA > absB) return normAns(r.ans) === normAns(`|${a}|`);
          if (absA < absB) return normAns(r.ans) === normAns(`|${b}|`);
          return normAns(r.ans).includes("一樣") || normAns(r.ans) === "相等";
        },
      };
    },
  },

  /* ─── B1-3 數線兩點中點 ─── */
  {
    tid: "b1_midpoint",
    book: "b1",
    gen(rng) {
      const a = Math.floor(rng() * 16) - 8;
      // 取非零偶數偏移 k（±2/±4/±6/±8），保證 a+b 為偶數且 b≠a
      const kSign = rng() < 0.5 ? 1 : -1;
      const kAbs = (Math.floor(rng() * 4) + 1) * 2;  // 2,4,6,8
      const b = a + kSign * kAbs;
      const mid = (a + b) / 2;
      const q = `數線上兩點 A(${a}) 和 B(${b})，AB 的中點座標是多少？`;
      const why = `中點 = (A + B) ÷ 2 = (${a} + ${b}) ÷ 2 = ${a + b} ÷ 2 = ${mid}。`;
      return {
        q, ans: String(mid), why,
        check: (r) => {
          const m = parseFloat(r.ans);
          // 驗算：a≠b 且中點到 a、b 距離相等
          return a !== b && Math.abs(Math.abs(m - a) - Math.abs(m - b)) < 0.001;
        },
      };
    },
  },

  /* ─── B1-4 數線跳躍應用 ─── */
  {
    tid: "b1_jump",
    book: "b1",
    gen(rng) {
      const start = Math.floor(rng() * 10) - 5;  // -5..4
      const left = Math.floor(rng() * 6) + 1;     // 1..6
      const right = Math.floor(rng() * 6) + 1;
      const ans = start - left + right;
      const names = ["小明", "阿花", "青蛙", "小狗", "蝸牛"];
      const name = names[Math.floor(rng() * names.length)];
      const q = `${name}站在數線 ${start} 的位置，先往左跳 ${left} 格，再往右跳 ${right} 格，最後在哪個位置？`;
      const why = `出發 ${start}，往左跳 ${left} 格到 ${start - left}，再往右跳 ${right} 格到 ${start - left + right} = ${ans}。`;
      return {
        q, ans: String(ans), why,
        check: (r) => {
          const pos = parseInt(r.ans);
          // 驗算：從終點反向：往左跳 right 再往右跳 left 應回到 start
          return pos - right + left === start;
        },
      };
    },
  },

  /* ─── B1-5 基準量表格應用 ─── */
  {
    tid: "b1_base_table",
    book: "b1",
    gen(rng) {
      const base = (Math.floor(rng() * 4) + 2) * 10;  // 20/30/40/50
      // 五天的偏差量（相對 base）
      const deltas = Array.from({length: 5}, () => Math.floor(rng() * 11) - 5);
      const actuals = deltas.map(d => base + d);
      const total = actuals.reduce((s, v) => s + v, 0);
      // 問哪天的實際量 或 問總量
      const askTotal = rng() < 0.5;
      if (askTotal) {
        const q = `某班 5 天的回收量以 ${base} 個為基準，各天偏差為 ${deltas.join("、")} 個，5 天實際回收總數是多少？`;
        const why = `各天實際量：${actuals.join("、")}，總計 = ${actuals.join(" + ")} = ${total} 個。`;
        return {
          q, ans: String(total), why,
          check: (r) => {
            const t = parseInt(r.ans);
            // 驗算：也可用「5×base + 偏差和」
            return t === 5 * base + deltas.reduce((s, v) => s + v, 0);
          },
        };
      } else {
        const idx = Math.floor(rng() * 5);
        const q = `某班以 ${base} 個為基準記錄回收量，第 ${idx+1} 天的偏差為 ${deltas[idx]} 個，當天實際回收量是多少？`;
        const ans = actuals[idx];
        const why = `實際量 = 基準量 + 偏差 = ${base} + (${deltas[idx]}) = ${ans} 個。`;
        return {
          q, ans: String(ans), why,
          // 驗算：使用者答案 - base 應等於 delta（不同路徑）
          check: (r) => parseInt(r.ans) - base === deltas[idx],
        };
      }
    },
  },

  /* ─── B1-6 質因數分解 ─── */
  {
    tid: "b1_prime_factorize",
    book: "b1",
    gen(rng) {
      // 生成 2-3 個質因數的乘積（結果 12-200）
      const primes = [2, 3, 5, 7];
      const numFactors = Math.floor(rng() * 2) + 3;  // 3 or 4 個質因數（可重複）
      const factors = [];
      for (let i = 0; i < numFactors; i++) factors.push(primes[Math.floor(rng() * 4)]);
      factors.sort((a, b) => a - b);
      const N = factors.reduce((a, b) => a * b, 1);
      // 避免太大
      if (N > 300) { factors.pop(); factors.push(2); factors.sort((a,b)=>a-b); }
      const N2 = factors.reduce((a, b) => a * b, 1);
      // 構造指數表達式
      const cnt = {};
      factors.forEach(f => cnt[f] = (cnt[f] || 0) + 1);
      const sup = {2:"²",3:"³",4:"⁴"};
      const powStr = Object.keys(cnt).sort((a,b)=>+a-+b)
        .map(p => cnt[p] > 1 ? `${p}${sup[cnt[p]] || "^"+cnt[p]}` : p)
        .join("×");
      const flatStr = factors.join("×");
      const q = `將 ${N2} 做質因數分解，寫出結果（例如：2²×3×5）：`;
      const why = `${N2} = ${flatStr} = ${powStr}。逐步除以最小質數：${N2}÷${factors[0]}=…直到商為 1。`;
      return {
        q, ans: powStr, why,
        check: (r) => {
          // 驗算：把使用者的答案解析出所有數相乘，應等於 N2
          const s = normAns(r.ans).replace(/\^(\d+)/g,(m,e)=>{return "^"+e;});
          let product = 1;
          // 解析 p^e 或 p²³ 格式
          const parts = s.split(/[×x*]/);
          for (const part of parts) {
            const m1 = part.match(/^(\d+)\^(\d+)$/);
            const m2 = part.match(/^(\d+)([²³⁴]?)$/);
            if (m1) product *= Math.pow(parseInt(m1[1]), parseInt(m1[2]));
            else if (m2) {
              const base = parseInt(m2[1]);
              const expMap = {"²":2,"³":3,"⁴":4,"":1};
              product *= Math.pow(base, expMap[m2[2]] || 1);
            }
          }
          return product === N2;
        },
      };
    },
  },

  /* ─── B1-7 分數乘法 ─── */
  {
    tid: "b1_frac_mult",
    book: "b1",
    gen(rng) {
      let a = Math.floor(rng() * 4) + 1;  // 1..4
      const b = Math.floor(rng() * 4) + 2;  // 2..5
      let c = Math.floor(rng() * 4) + 1;
      const d = Math.floor(rng() * 4) + 2;
      // 避免兩個分數都等於 1（a==b 且 c==d）
      if (a === b && c === d) { a = a > 1 ? a - 1 : 1; /* 至少其一為真分數 */ }
      // 讓分子 < 分母確保 < 1 的真分數；若違反，截斷分子
      const aFinal = Math.min(a, b - 1) || 1;
      const cFinal = Math.min(c, d - 1) || 1;
      const rn = aFinal * cFinal, rd = b * d;
      const ans = fracStr(rn, rd);
      const q = `計算：${aFinal}/${b} × ${cFinal}/${d} = ?（化簡後填分數如 1/3）`;
      const why = `分子乘分子：${aFinal}×${cFinal}=${rn}；分母乘分母：${b}×${d}=${rd}；化簡 ${rn}/${rd} = ${ans}。`;
      return {
        q, ans, why,
        check: (r) => fracMatch(r.ans, rn, rd),
      };
    },
  },

  /* ─── B1-8 一元一次方程 ─── */
  {
    tid: "b1_linear_eq",
    book: "b1",
    gen(rng) {
      // ax + b = c，整數解；排除 a=1&&b=0（題目退化為 x = c，答案在題幹裡）
      const x = Math.floor(rng() * 15) - 7;  // -7..7
      let a = Math.floor(rng() * 4) + 1;    // 1..4
      let b = Math.floor(rng() * 11) - 5;   // -5..5
      // 守衛：a=1 且 b=0 時退化，把 b 改為 1（仍在範圍內）
      if (a === 1 && b === 0) b = 1;
      const c = a * x + b;
      const bFmt = b === 0 ? "" : (b < 0 ? ` - ${Math.abs(b)}` : ` + ${b}`);
      const q = `解方程式：${a === 1 ? "" : a}x${bFmt} = ${c}，x = ?`;
      const why = `${b !== 0 ? `兩邊各${b > 0 ? "減" : "加"} ${Math.abs(b)}，得 ${a}x = ${c - b}；` : ""}${a !== 1 ? `兩邊除以 ${a}，得 ` : ""}x = ${c - b} ÷ ${a} = ${x}。`;
      return {
        q, ans: String(x), why,
        check: (r) => {
          const xUser = parseInt(r.ans);
          // 驗算：代回原式
          return a * xUser + b === c;
        },
      };
    },
  },

  /* ─── B2-1 座標點象限 ─── */
  {
    tid: "b2_quadrant",
    book: "b2",
    gen(rng) {
      const x = (Math.floor(rng() * 7) + 1) * (rng() < 0.5 ? 1 : -1);
      const y = (Math.floor(rng() * 7) + 1) * (rng() < 0.5 ? 1 : -1);
      let q_name, why_reason;
      if (x > 0 && y > 0)      { q_name = "第一象限（右上）"; why_reason = "x > 0 右，y > 0 上"; }
      else if (x < 0 && y > 0) { q_name = "第二象限（左上）"; why_reason = "x < 0 左，y > 0 上"; }
      else if (x < 0 && y < 0) { q_name = "第三象限（左下）"; why_reason = "x < 0 左，y < 0 下"; }
      else                      { q_name = "第四象限（右下）"; why_reason = "x > 0 右，y < 0 下"; }
      const q = `點 (${x}, ${y}) 位在座標平面的哪個象限？（回答「第一象限」~「第四象限」）`;
      const why = `${why_reason}，落在${q_name}。`;
      return {
        q, ans: q_name.split("（")[0],  // "第一象限" 等
        why,
        check: (r) => {
          const u = normAns(r.ans);
          if (x > 0 && y > 0) return u.includes("第一") || u.includes("1");
          if (x < 0 && y > 0) return u.includes("第二") || u.includes("2");
          if (x < 0 && y < 0) return u.includes("第三") || u.includes("3");
          return u.includes("第四") || u.includes("4");
        },
      };
    },
  },

  /* ─── B2-2 軸平行兩點距離 ─── */
  {
    tid: "b2_axis_dist",
    book: "b2",
    gen(rng) {
      const mode = rng() < 0.5 ? "h" : "v";  // 水平或垂直
      if (mode === "h") {
        const y0 = Math.floor(rng() * 8) - 4;
        let x1 = Math.floor(rng() * 8) - 4;
        let x2 = Math.floor(rng() * 8) - 4;
        // 確保不相等（用偏移而非迴圈）
        if (x1 === x2) x2 = x2 === 4 ? x2 - 1 : x2 + 1;
        const ans = Math.abs(x2 - x1);
        const q = `兩點 A(${x1}, ${y0}) 和 B(${x2}, ${y0}) 的距離是多少？`;
        const why = `兩點同在 y = ${y0} 的水平線上，距離 = |${x2} - ${x1}| = ${ans}。`;
        return {
          q, ans: String(ans), why,
          check: (r) => parseInt(r.ans) === Math.abs(x2 - x1),
        };
      } else {
        const x0 = Math.floor(rng() * 8) - 4;
        let y1 = Math.floor(rng() * 8) - 4;
        let y2 = Math.floor(rng() * 8) - 4;
        if (y1 === y2) y2 = y2 === 4 ? y2 - 1 : y2 + 1;
        const ans = Math.abs(y2 - y1);
        const q = `兩點 A(${x0}, ${y1}) 和 B(${x0}, ${y2}) 的距離是多少？`;
        const why = `兩點同在 x = ${x0} 的垂直線上，距離 = |${y2} - ${y1}| = ${ans}。`;
        return {
          q, ans: String(ans), why,
          check: (r) => parseInt(r.ans) === Math.abs(y2 - y1),
        };
      }
    },
  },

  /* ─── B2-3 正比應用 ─── */
  {
    tid: "b2_proportion",
    book: "b2",
    gen(rng) {
      const mode = rng() < 0.5 ? "price" : "map";
      if (mode === "price") {
        const price = (Math.floor(rng() * 8) + 2) * 5;   // 10~45
        const qty1 = Math.floor(rng() * 5) + 2;           // 2~6
        let qty2 = Math.floor(rng() * 7) + 3;             // 3~9
        // 守衛：qty1===qty2 時答案等於已知值（1:1 無意義），重抽
        while (qty2 === qty1) qty2 = (qty2 % 9) + 3;
        const cost1 = price * qty1;
        const cost2 = price * qty2;
        const q = `一個文具售價 ${price} 元，買 ${qty1} 個要 ${cost1} 元；同樣單價，買 ${qty2} 個要多少元？`;
        const ans = cost2;
        const _ratio = fracStr(qty2, qty1);
        const why = `單價 ${price} 元，${qty2} 個 = ${price} × ${qty2} = ${ans} 元。（正比：qty 翻 ${_ratio} 倍，費用也翻 ${_ratio} 倍）`;
        return {
          q, ans: String(ans), why,
          check: (r) => {
            const u = parseInt(r.ans);
            // 驗算：u / cost1 = qty2 / qty1（整數比例）
            return u * qty1 === cost1 * qty2;
          },
        };
      } else {
        // 比例尺：地圖 k cm = 實際 k*scale km
        const scale = (Math.floor(rng() * 4) + 2) * 50;  // 100~350 km/cm
        const d1 = Math.floor(rng() * 5) + 1;             // 1~5 cm
        let d2 = Math.floor(rng() * 4) + 2;               // 2~5 cm
        // 守衛：d1===d2 時答案等於已知值（1:1 無意義），重抽
        while (d2 === d1) d2 = (d2 % 5) + 2;
        const real1 = d1 * scale;
        const real2 = d2 * scale;
        const q = `地圖上 ${d1} 公分代表實際 ${real1} 公里，同比例尺地圖上 ${d2} 公分代表實際幾公里？`;
        const ans = real2;
        const why = `比例尺 = ${real1}÷${d1} = ${scale} 公里/公分；${d2} 公分 × ${scale} = ${ans} 公里。`;
        return {
          q, ans: String(ans), why,
          check: (r) => {
            const u = parseInt(r.ans);
            return u * d1 === real1 * d2;  // 比例關係驗算
          },
        };
      }
    },
  },

  /* ─── B2-4 比例式求未知 ─── */
  {
    tid: "b2_ratio_unknown",
    book: "b2",
    gen(rng) {
      // a:b = c:x → x = bc/a（整數）
      const a = Math.floor(rng() * 5) + 1;  // 1..5
      const x = Math.floor(rng() * 8) + 2;  // 2..9
      let b = Math.floor(rng() * 5) + 1;
      // 守衛：a===b 時比例式退化（1:1=c:x 無唯一解意義），重抽 b
      while (b === a) b = (b % 5) + 1;
      const c = a * x / b; // 不一定整數，改為讓 c 整數
      // 強制讓 c 為整數：c = k*a, x = k*b
      const k = Math.floor(rng() * 4) + 2;  // 2..5
      const c2 = k * a, x2 = k * b;
      const q = `已知比例式 ${a} : ${b} = ${c2} : x，求 x = ?`;
      const why = `外項積 = 內項積：${a} × x = ${b} × ${c2}，x = ${b * c2} ÷ ${a} = ${x2}。`;
      return {
        q, ans: String(x2), why,
        check: (r) => {
          const u = parseInt(r.ans);
          // 驗算：外項積 = 內項積
          return a * u === b * c2;
        },
      };
    },
  },

  /* ─── B2-5 二元一次聯立 ─── */
  {
    tid: "b2_simultaneous",
    book: "b2",
    gen(rng) {
      // 生成整數解 (sx,sy) 再構造方程（避免用 x/y 與數學參數混淆）
      const sx = Math.floor(rng() * 11) - 5;  // -5..5
      const sy = Math.floor(rng() * 11) - 5;
      const a1 = Math.floor(rng() * 3) + 1;   // 1..3
      let p1 = Math.floor(rng() * 3) + 1;
      const a2 = Math.floor(rng() * 3) + 1;
      let p2 = Math.floor(rng() * 3) + 1;
      // 確保非奇異（行列式非零）：a1*p2 ≠ a2*p1
      if (a1 * p2 === a2 * p1) p2 = p2 < 3 ? p2 + 1 : p2 - 1;
      const c1 = a1 * sx + p1 * sy;
      const c2 = a2 * sx + p2 * sy;
      const a1s = a1 === 1 ? "x" : `${a1}x`;
      const a2s = a2 === 1 ? "x" : `${a2}x`;
      const p1s = p1 === 1 ? " + y" : ` + ${p1}y`;
      const p2s = p2 === 1 ? " + y" : ` + ${p2}y`;
      const q = `解聯立方程式：{ ${a1s}${p1s} = ${c1}；${a2s}${p2s} = ${c2} }，求 x, y（格式：x=數字,y=數字）`;
      const why = `用消去法：${a2}×式1 - ${a1}×式2，消去 x，解出 y = ${sy}；代回得 x = ${sx}。`;
      const ans = `x=${sx},y=${sy}`;
      return {
        q, ans, why,
        check: (r) => {
          const m = normAns(r.ans).match(/x=(-?\d+)[,，]y=(-?\d+)/);
          if (!m) return false;
          const ux = parseInt(m[1]), uy = parseInt(m[2]);
          // 獨立驗算：代入兩條方程式
          return a1*ux + p1*uy === c1 && a2*ux + p2*uy === c2;
        },
      };
    },
  },

  /* ─── B2-6 一元一次不等式 ─── */
  {
    tid: "b2_inequality",
    book: "b2",
    gen(rng) {
      // ax op c + bx →  簡單形式：ax + bConst op cConst，解整數
      const x0 = Math.floor(rng() * 13) - 6;  // 邊界值 -6..6
      const a = (Math.floor(rng() * 3) + 1) * (rng() < 0.3 ? -1 : 1);  // ±1..±3；約30%負係數
      const bConst = Math.floor(rng() * 11) - 5;
      const opIdx = Math.floor(rng() * 4);
      const ops = ["<", ">", "<=", ">="];
      const opDisplay = ["<", ">", "≤", "≥"];
      const opSym = ops[opIdx];
      const opShow = opDisplay[opIdx];
      const cConst = a * x0 + bConst;
      // 解：a < 0 時翻轉
      const flip = {"<":">", ">":"<", "<=":">=", ">=":"<="};
      const ansOp = a < 0 ? flip[opSym] : opSym;
      const ansOpShow = a < 0 ? opDisplay[["<",">","<=",">="].indexOf(flip[opSym])] : opShow;
      // 答案字串：x<3 / x>=-2
      const ansStr = `x${ansOpShow}${x0}`;
      const bDisp = bConst === 0 ? "" : (bConst > 0 ? ` + ${bConst}` : ` - ${Math.abs(bConst)}`);
      const aDisp = a === 1 ? "" : (a === -1 ? "-" : String(a));
      const q = `解不等式：${aDisp}x${bDisp} ${opShow} ${cConst}，寫出解集（格式：x<3 或 x>=-2）：`;
      const flipNote = a < 0 ? `（除以負數 ${a} 要翻轉不等號！）` : "";
      const why = `移項得 ${a}x ${opShow} ${cConst - bConst}；除以 ${a}${flipNote}，得 ${ansStr}。`;
      // 標準答案正規化（供 check 比對用）
      const ansNorm = normIneq(ansStr);
      return {
        q, ans: ansStr, why,
        check: (r) => {
          // 獨立驗算（雙層）：
          // 層1：學生答案經 normIneq 後必須與標準答案字串相等（精確比對不等號開閉）
          if (normIneq(r.ans) !== ansNorm) return false;
          // 層2：邊界值歸屬一致（嚴格不等式：邊界不屬解；非嚴格：邊界屬解）
          const strict = (ansOp === "<" || ansOp === ">");
          const inSet = (v) => {
            const lhs = a * v + bConst;
            if (opSym === "<")  return lhs < cConst;
            if (opSym === ">")  return lhs > cConst;
            if (opSym === "<=") return lhs <= cConst;
            if (opSym === ">=") return lhs >= cConst;
            return false;
          };
          // 邊界值 x0：嚴格時不屬解，非嚴格時屬解
          const boundaryMembership = !strict;
          return inSet(x0) === boundaryMembership &&
                 inSet(x0 - 1) !== inSet(x0 + 1);  // 邊界兩側必須一側在解集一側不在
        },
      };
    },
  },

  /* ─── B2-7 統計平均數 ─── */
  {
    tid: "b2_average",
    book: "b2",
    gen(rng) {
      const n = Math.floor(rng() * 3) + 4;  // 4~6 筆
      const vals = Array.from({length: n}, () => Math.floor(rng() * 16) + 5);
      const total = vals.reduce((s, v) => s + v, 0);
      // 確保平均為整數（調整最後一個值）
      const rem = total % n;
      if (rem !== 0) vals[n-1] += n - rem;
      const total2 = vals.reduce((s, v) => s + v, 0);
      const avg = total2 / n;
      const scenes = ["某班 {n} 位同學的數學成績", "{n} 天的氣溫（度）", "{n} 位選手的跳遠成績（cm）", "每週 {n} 天的零用錢（元）"];
      const scene = scenes[Math.floor(rng() * scenes.length)].replace("{n}", n);
      const q = `${scene}分別為：${vals.join("、")}，平均數是多少？`;
      const why = `總和 = ${vals.join(" + ")} = ${total2}；平均 = ${total2} ÷ ${n} = ${avg}。`;
      return {
        q, ans: String(avg), why,
        check: (r) => {
          const u = parseFloat(r.ans);
          // 驗算：平均 × n = 總和
          return Math.abs(u * n - total2) < 0.001;
        },
      };
    },
  },

  /* ─── B2-8 線對稱點座標 ─── */
  {
    tid: "b2_symmetry",
    book: "b2",
    gen(rng) {
      let x = Math.floor(rng() * 10) - 5;
      let y = Math.floor(rng() * 10) - 5;
      const modes = ["x軸", "y軸", "x=k"];
      const mode = modes[Math.floor(rng() * 3)];
      let ans, why, q;
      if (mode === "x軸") {
        // 守衛：y===0 時點在 x 軸上，對稱點等於自身（自映射）
        if (y === 0) y = 1;
        ans = `(${x},${-y})`;
        why = `對 x 軸對稱：x 座標不變，y 座標取相反數。(${x}, ${y}) → (${x}, ${-y})。`;
        q = `點 (${x}, ${y}) 關於 x 軸的對稱點座標是？（格式：(x,y)）`;
      } else if (mode === "y軸") {
        // 守衛：x===0 時點在 y 軸上，對稱點等於自身（自映射）
        if (x === 0) x = 1;
        ans = `(${-x},${y})`;
        why = `對 y 軸對稱：y 座標不變，x 座標取相反數。(${x}, ${y}) → (${-x}, ${y})。`;
        q = `點 (${x}, ${y}) 關於 y 軸的對稱點座標是？（格式：(x,y)）`;
      } else {
        let k = Math.floor(rng() * 7) - 3;
        // 保證點不在對稱軸上（x≠k，避免自映射）
        while (k === x) k = k < 3 ? k + 1 : k - 1;
        const mx = 2 * k - x;
        ans = `(${mx},${y})`;
        why = `對直線 x = ${k} 對稱：y 不變，x 映射為 2×${k} - ${x} = ${mx}。`;
        q = `點 (${x}, ${y}) 關於直線 x = ${k} 的對稱點座標是？（格式：(x,y)）`;
      }
      return {
        q, ans, why,
        check: (r) => {
          const m = normAns(r.ans).replace(/[()（）]/g,"").split(",");
          if (m.length < 2) return false;
          const ux = parseInt(m[0]), uy = parseInt(m[1]);
          const [ea, eb] = ans.replace(/[()]/g,"").split(",").map(Number);
          return ux === ea && uy === eb;
        },
      };
    },
  },
];

/* ─── 答案比對（通用） ─── */
function checkAnswer(tpl, gen_result, userRaw) {
  const normUser = normAns(userRaw);
  // 1. 直接字串比對（正規化後）
  if (normUser === normAns(gen_result.ans)) return true;
  // 2. 呼叫模板的 check 函式（獨立驗算）
  try { return tpl.gen && gen_result.check && gen_result.check({ ans: userRaw }); } catch(e) { return false; }
}

/* ═══════════════════════════════════════════════════════════
   選擇題選項生成（干擾項）
   makeOptions(tpl, gen_result, rng) → { options:[str], correctIdx }
   安全底線：任何干擾項都必須被 checkAnswer 判為「錯」，
   否則丟棄（絕不出現第二個正解，含等值分數等情形）。
   ═══════════════════════════════════════════════════════════ */
function _isCorrectDistractor(tpl, gen_result, candidate) {
  // 干擾項只要被 checkAnswer 接受（=也是正解）就不安全
  return checkAnswer(tpl, gen_result, candidate);
}

// 依答案格式產生候選干擾項（可能含重複/不合法，之後統一過濾）
function _distractorCandidates(gen_result) {
  const ans = String(gen_result.ans).trim();
  const out = [];

  // (a) 純整數答案：正負號錯、鄰近值、進位/差一位
  if (/^-?\d+$/.test(ans)) {
    const n = parseInt(ans, 10);
    const cands = [n + 1, n - 1, -n, n + 2, n - 2, n + 10, n - 10, n * 2];
    cands.forEach(v => out.push(String(v)));
    return out;
  }

  // (b) 小數答案（如平均、中點）：鄰近值、正負號錯
  if (/^-?\d+\.\d+$/.test(ans)) {
    const n = parseFloat(ans);
    const cands = [n + 1, n - 1, -n, n + 0.5, n - 0.5, n + 2, Math.round(n)];
    cands.forEach(v => out.push(String(v)));
    return out;
  }

  // (c) 分數答案 p/q：分子±1、分母±1、上下顛倒
  const mFrac = ans.match(/^(-?\d+)\/(-?\d+)$/);
  if (mFrac) {
    const p = parseInt(mFrac[1], 10), q = parseInt(mFrac[2], 10);
    [[p + 1, q], [p - 1, q], [p, q + 1], [p, q - 1], [q, p], [p + 1, q + 1]]
      .forEach(([nn, dd]) => { if (dd !== 0) out.push(fracStr(nn, dd)); });
    return out;
  }

  // (d) 座標 (x,y)：各分量取相反數、±1
  const mPt = ans.match(/^\(?\s*(-?\d+)\s*,\s*(-?\d+)\s*\)?$/);
  if (mPt) {
    const x = parseInt(mPt[1], 10), y = parseInt(mPt[2], 10);
    [[-x, y], [x, -y], [-x, -y], [y, x], [x + 1, y], [x, y + 1]]
      .forEach(([a, b]) => out.push(`(${a},${b})`));
    return out;
  }

  // (e) 聯立解 x=?,y=?：各分量取相反數、±1、對調
  const mSim = ans.match(/^x=(-?\d+),y=(-?\d+)$/);
  if (mSim) {
    const x = parseInt(mSim[1], 10), y = parseInt(mSim[2], 10);
    [[-x, y], [x, -y], [-x, -y], [y, x], [x + 1, y], [x, y + 1]]
      .forEach(([a, b]) => out.push(`x=${a},y=${b}`));
    return out;
  }

  // (f) 不等式 x<3 / x>=-2：翻轉不等號、邊界±1（常見錯誤）
  const mIneq = ans.match(/^x(<=|>=|<|>|≤|≥)(-?\d+)$/);
  if (mIneq) {
    const opNorm = mIneq[1].replace("<=", "≤").replace(">=", "≥");
    const k = parseInt(mIneq[2], 10);
    const flip = { "<": ">", ">": "<", "≤": "≥", "≥": "≤" };
    const strictSwap = { "<": "≤", ">": "≥", "≤": "<", "≥": ">" };
    out.push(`x${flip[opNorm]}${k}`);
    out.push(`x${strictSwap[opNorm]}${k}`);
    out.push(`x${opNorm}${k + 1}`);
    out.push(`x${opNorm}${k - 1}`);
    out.push(`x${flip[opNorm]}${k + 1}`);
    return out;
  }

  // (g) 象限：其餘三個象限
  if (/第[一二三四]象限/.test(ans)) {
    ["第一象限", "第二象限", "第三象限", "第四象限"].forEach(o => out.push(o));
    return out;
  }

  // (h) 絕對值比較：|a| / |b| / 一樣大 三選項
  const mAbs = ans.match(/^\|(-?\d+)\|$/);
  if (mAbs || ans === "一樣大") {
    // 直接把另一個 |x| 與「一樣大」列為候選；真正的另一項在 q 文字裡，
    // 這裡先給「一樣大」與符號變體，過濾階段會保留合法者。
    if (ans !== "一樣大") out.push("一樣大");
    if (mAbs) {
      const v = parseInt(mAbs[1], 10);
      out.push(`|${-v}|`, `|${v + 1}|`, `|${v - 1}|`);
    }
    return out;
  }

  // (i) 質因數分解 2²×3×5：把某個指數改掉（乘積會變，必被判錯）
  if (/[×x*]/.test(ans) && /\d/.test(ans)) {
    // 拆出各因數，微調其中一個為相鄰質數或改指數
    const parts = ans.split(/[×x*]/);
    const swaps = [
      ans.replace(/²/, "³"),
      ans.replace(/³/, "²"),
      ans.replace(/(^|[×x*])2([²³⁴]?)/, (m, p) => `${p}3${m.match(/[²³⁴]/) || ""}`),
      parts.length > 1 ? parts.slice(0, -1).join("×") : ans + "×2",
      ans + "×2",
    ];
    swaps.forEach(sw => { if (sw && sw !== ans) out.push(sw); });
    return out;
  }

  return out; // 未知格式 → 空，後續 fallback 處理
}

function makeOptions(tpl, gen_result, rng) {
  const rand = rng || Math.random;
  const correct = String(gen_result.ans).trim();
  const normCorrect = normAns(correct);

  // 收集合法干擾項：格式候選 → 過濾（不得為正解、不得與已選重複）
  const chosen = [];
  const seenNorm = new Set([normCorrect]);
  const pushIfSafe = (cand) => {
    const c = String(cand).trim();
    if (!c) return;
    const nc = normAns(c);
    if (seenNorm.has(nc)) return;                       // 去重（含與正解同值）
    if (_isCorrectDistractor(tpl, gen_result, c)) return; // 安全底線：不得也是正解
    seenNorm.add(nc);
    chosen.push(c);
  };

  const cands = _distractorCandidates(gen_result);
  for (const c of cands) { if (chosen.length >= 3) break; pushIfSafe(c); }

  // fallback：候選不足 3 個時，用整數擾動補齊（適用大多數數值型；
  // 非數值型若補不滿就用少一點的選項，仍保證每項唯一且非正解）
  if (chosen.length < 3) {
    const numMatch = correct.match(/-?\d+(\.\d+)?/);
    if (numMatch) {
      const base = parseFloat(numMatch[0]);
      let delta = 1;
      let guard = 0;
      while (chosen.length < 3 && guard++ < 40) {
        const sign = (guard % 2 === 0) ? 1 : -1;
        const v = base + sign * delta;
        const cand = correct.replace(/-?\d+(\.\d+)?/, Number.isInteger(base) ? String(v) : v.toFixed(1));
        pushIfSafe(cand);
        delta++;
      }
    }
  }

  // 組合正解 + 干擾項，洗牌
  const options = [correct, ...chosen.slice(0, 3)];
  for (let k = options.length - 1; k > 0; k--) {
    const j = Math.floor(rand() * (k + 1));
    [options[k], options[j]] = [options[j], options[k]];
  }
  const correctIdx = options.findIndex(o => normAns(o) === normCorrect);
  return { options, correctIdx };
}

/* ═══════════════════════════════════════════════════════════
   makeExamLevel — 產生一個關卡（MX1/MX2/MX3）
   ═══════════════════════════════════════════════════════════ */
function makeExamLevel(id, shortName, bookFilter, goalText) {
  const templates = bookFilter === "all"
    ? DRILL_TEMPLATES
    : DRILL_TEMPLATES.filter(t => t.book === bookFilter);

  const GOAL_ID = `${id}-pass`;

  return {
    id, short: shortName,
    title: `綜合演練|${shortName}：參數化混題出卷`,
    ep: "MX",
    intro: `<p>這一關會用<b>隨機數字</b>出題——每次開卷都是新題，答案由程式計算，沒有手寫死的答案。</p><p>選題數後開始；逐題填答、送出後顯示詳解。卷末成績單，<b>答對率 ≥ 80%</b> 解鎖通關。</p>`,
    formal: `<p class="math">通關條件：完成一回 ≥10 題且答對率 ≥ 80%。題型錯題本（📕）自動累積弱點，答對即清除。</p>`,
    goals: [{ id: GOAL_ID, text: goalText }],
    state: {
      phase: "start",   // start | quiz | result | review
      count: 10,
      seed: 0,
      questions: [],    // [{ tpl, gen_result, userAns, correct }]
      qi: 0,            // 目前題號
      reviewQueue: [],  // drillBook 弱點 tid 陣列
      reviewIdx: 0,
      reviewGen: null,
      reviewTpl: null,
    },
    enter() {
      Object.assign(this.state, {
        phase: "start", count: 10, seed: Date.now(),
        questions: [], qi: 0, reviewQueue: [], reviewIdx: 0,
        reviewGen: null, reviewTpl: null,
      });
      this._render && this._render();
    },
    _generateQuestions(count, seed) {
      const rng = mulberry32(seed);
      const qs = [];
      for (let i = 0; i < count; i++) {
        const tpl = templates[Math.floor(rng() * templates.length)];
        const rng2 = mulberry32(Math.floor(rng() * 2147483647));
        const gen_result = tpl.gen(rng2);
        const optRng = mulberry32(Math.floor(rng() * 2147483647) ^ (i + 1));
        const { options, correctIdx } = makeOptions(tpl, gen_result, optRng);
        qs.push({ tpl, gen_result, options, correctIdx, userAns: "", correct: null });
      }
      return qs;
    },
    controls(el) {
      const s = this.state, lv = this;
      const render = () => {
        const dbKeys = Object.keys(drillBook);

        /* ── 起始畫面 ── */
        if (s.phase === "start") {
          const hasWeakness = dbKeys.length > 0;
          el.innerHTML = `
            <div class="quiz-q">選擇題數後開始出卷（每次題目數字不同）：</div>
            <div class="row">
              ${[10, 20, 30].map(n => `<button class="quiz-opt" data-n="${n}">${n} 題</button>`).join("")}
            </div>
            ${hasWeakness ? `<div class="row"><button id="drill-review-btn" style="background:var(--panel2);border:1px solid #fbbf24;color:#fbbf24;border-radius:8px;padding:7px 12px;cursor:pointer;font-size:.86rem;font-family:inherit">📕 弱點複習（${dbKeys.length} 個題型）</button></div>` : ""}
          `;
          el.querySelectorAll(".quiz-opt[data-n]").forEach(btn => {
            btn.onclick = () => {
              s.count = parseInt(btn.dataset.n);
              s.seed = Date.now();
              s.questions = lv._generateQuestions(s.count, s.seed);
              s.qi = 0;
              s.phase = "quiz";
              render();
            };
          });
          const rvBtn = el.querySelector("#drill-review-btn");
          if (rvBtn) rvBtn.onclick = () => { lv._startReview(el, render); };
          return;
        }

        /* ── 弱點複習 ── */
        if (s.phase === "review") {
          lv._renderReview(el, render);
          return;
        }

        /* ── 結果畫面 ── */
        if (s.phase === "result") {
          const correct = s.questions.filter(q => q.correct).length;
          const total = s.questions.length;
          const rate = correct / total;
          const pass = total >= 10 && rate >= 0.8;

          // 各題型統計
          const tplStat = {};
          s.questions.forEach(q => {
            const tid = q.tpl.tid;
            if (!tplStat[tid]) tplStat[tid] = { ok: 0, bad: 0 };
            if (q.correct) tplStat[tid].ok++;
            else tplStat[tid].bad++;
          });
          const statRows = Object.entries(tplStat).map(([tid, st]) => {
            const name = (DRILL_TEMPLATES.find(t => t.tid === tid) || {}).tid || tid;
            return `<div style="display:flex;justify-content:space-between;font-size:.82rem;margin-top:4px"><span>${tid.replace(/^b[12]_/, "").replace(/_/g," ")}</span><span style="color:${st.bad > 0 ? "#ff5c7a" : "#4ade80"}">${st.ok}✓ ${st.bad}✗</span></div>`;
          }).join("");

          el.innerHTML = `
            <div class="quiz-q" style="margin-bottom:8px">${pass ? "🎉 通關！" : "差一點，再來一輪！"} 得分 <b>${correct}/${total}</b>（${(rate*100).toFixed(0)}%）${pass ? "" : "（需 ≥80%）"}</div>
            <div style="background:var(--panel2);border-radius:8px;padding:10px;margin-bottom:10px">${statRows}</div>
            <div class="row">
              <button class="primary" id="drill-again">再來一卷</button>
              <button id="drill-back">換題數</button>
            </div>
          `;
          el.querySelector("#drill-again").onclick = () => {
            s.seed = Date.now();
            s.questions = lv._generateQuestions(s.count, s.seed);
            s.qi = 0;
            s.phase = "quiz";
            render();
          };
          el.querySelector("#drill-back").onclick = () => { s.phase = "start"; render(); };
          if (pass) markGoal(GOAL_ID);
          return;
        }

        /* ── 逐題出題 ── */
        if (s.phase === "quiz") {
          const qItem = s.questions[s.qi];
          const isAnswered = qItem.correct !== null;
          const opts = qItem.options;
          const cIdx = qItem.correctIdx;
          const optBtns = opts.map((o, k) => {
            let cls = "quiz-opt";
            if (isAnswered) {
              if (k === cIdx) cls += " right";
              else if (k === qItem.chosenIdx) cls += " wrong";
            }
            return `<button class="${cls}" data-k="${k}" ${isAnswered ? "disabled" : ""}>${o}</button>`;
          }).join("");
          el.innerHTML = `
            <div class="quiz-q"><b>第 ${s.qi + 1}/${s.count} 題</b>　${qItem.gen_result.q}</div>
            <div style="margin-top:8px">${optBtns}</div>
            <div id="drill-msg" class="quiz-msg" style="margin-top:6px">
              ${isAnswered ? (qItem.correct ? `<span style="color:#4ade80">✓ 正確！</span>` : `<span style="color:#ff5c7a">✗ 答案：${qItem.gen_result.ans}</span>`) + `　${qItem.gen_result.why}` : ""}
            </div>
            ${isAnswered ? `<div class="row"><button class="primary" id="drill-next">${s.qi + 1 < s.count ? "下一題" : "看成績"}</button></div>` : ""}
          `;
          if (!isAnswered) {
            el.querySelectorAll(".quiz-opt[data-k]").forEach(btn => {
              btn.onclick = () => {
                if (qItem.correct !== null) return;
                const k = parseInt(btn.dataset.k, 10);
                qItem.chosenIdx = k;
                qItem.userAns = opts[k];
                qItem.correct = (k === cIdx);
                if (qItem.correct) dbHit(qItem.tpl.tid);
                else dbMiss(qItem.tpl.tid);
                render();
              };
            });
          } else {
            el.querySelector("#drill-next").onclick = () => {
              s.qi++;
              if (s.qi >= s.count) { s.phase = "result"; }
              render();
            };
          }
        }
      };
      this._render = render;
      render();
    },
    _startReview(el, render) {
      const s = this.state;
      s.reviewQueue = Object.keys(drillBook).slice();
      s.reviewIdx = 0;
      s.phase = "review";
      // 為第一個題型生成一題
      this._genReviewItem();
      render();
    },
    _genReviewItem() {
      const s = this.state;
      if (s.reviewIdx >= s.reviewQueue.length) return;
      const tid = s.reviewQueue[s.reviewIdx];
      const tpl = DRILL_TEMPLATES.find(t => t.tid === tid);
      if (!tpl) { s.reviewIdx++; this._genReviewItem(); return; }
      s.reviewTpl = tpl;
      s.reviewGen = tpl.gen(mulberry32(Date.now() + s.reviewIdx * 9999));
      const rvOpt = makeOptions(tpl, s.reviewGen, mulberry32(Date.now() ^ (s.reviewIdx * 7919 + 1)));
      s.reviewOptions = rvOpt.options;
      s.reviewCorrectIdx = rvOpt.correctIdx;
      s.reviewAns = "";
      s.reviewAnswered = false;
    },
    _renderReview(el, render) {
      const s = this.state;
      if (s.reviewIdx >= s.reviewQueue.length) {
        // 複習結束
        const remaining = Object.keys(drillBook).length;
        el.innerHTML = `
          <div class="quiz-q">${remaining === 0 ? "🎉 弱點全清！" : `還剩 ${remaining} 個題型沒掌握`}</div>
          <div class="row"><button class="primary" id="rv-back">回到出卷選單</button></div>
        `;
        el.querySelector("#rv-back").onclick = () => { s.phase = "start"; render(); };
        return;
      }
      const tpl = s.reviewTpl;
      const gen = s.reviewGen;
      const tid = tpl.tid;
      const total = s.reviewQueue.length;
      const answered = s.reviewAnswered;
      const rvOpts = s.reviewOptions || [];
      const rvCIdx = s.reviewCorrectIdx;
      const rvOptBtns = rvOpts.map((o, k) => {
        let cls = "quiz-opt";
        if (answered) {
          if (k === rvCIdx) cls += " right";
          else if (k === s.reviewChosenIdx) cls += " wrong";
        }
        return `<button class="${cls}" data-k="${k}" ${answered ? "disabled" : ""}>${o}</button>`;
      }).join("");
      el.innerHTML = `
        <div class="quiz-q"><span style="color:#fbbf24">📕 弱點複習</span>　${s.reviewIdx+1}/${total}　${gen.q}</div>
        <div style="margin-top:8px">${rvOptBtns}</div>
        <div id="rv-msg" class="quiz-msg" style="margin-top:6px">
          ${answered ? (s.reviewCorrect
            ? `<span style="color:#4ade80">✓ 答對了，已從弱點清單移除！</span>`
            : `<span style="color:#ff5c7a">✗ 答案：${gen.ans}</span>`) + `　${gen.why}` : ""}
        </div>
        ${answered ? `<div class="row"><button class="primary" id="rv-next">${s.reviewIdx+1 < total ? "下一個弱點" : "看結果"}</button></div>` : ""}
      `;
      if (!answered) {
        el.querySelectorAll(".quiz-opt[data-k]").forEach(btn => {
          btn.onclick = () => {
            if (s.reviewAnswered) return;
            const k = parseInt(btn.dataset.k, 10);
            s.reviewChosenIdx = k;
            s.reviewAns = rvOpts[k];
            s.reviewCorrect = (k === rvCIdx);
            s.reviewAnswered = true;
            if (s.reviewCorrect) dbHit(tid);
            // 不計分不觸發過關
            render();
          };
        });
      } else {
        el.querySelector("#rv-next").onclick = () => {
          s.reviewIdx++;
          if (s.reviewIdx < s.reviewQueue.length) this._genReviewItem();
          render();
        };
      }
    },
    draw() {
      const s = this.state;
      // 清空 + 背景
      g.fillStyle = TH.bg; g.fillRect(0, 0, canvas.width, canvas.height);
      const n = s.count || 10;
      if (s.phase === "quiz" || s.phase === "result") {
        // 進度圓點列
        const gap = Math.min(48, 580 / Math.max(n, 1));
        const x0 = (canvas.width - gap * (n - 1)) / 2;
        const y0 = 280;
        for (let k = 0; k < n; k++) {
          const qItem = s.questions[k];
          let fill = TH.gridFaint;
          if (qItem && qItem.correct !== null) fill = qItem.correct ? "#4ade80" : "#ff5c7a";
          else if (k === s.qi && s.phase === "quiz") fill = "#ffd166";
          drawDisc(x0 + k * gap, y0, 12, fill, TH.axis, 1.5);
        }
        const done = s.questions.filter(q => q.correct !== null).length;
        const ok = s.questions.filter(q => q.correct).length;
        const icon = s.phase === "result"
          ? (ok / n >= 0.8 ? "🏆" : "💪")
          : "📝";
        pText(CX, 180, icon, TH.text, 72, "center");
        pText(CX, 340, `${ok} / ${done}`, TH.dim, 20, "center");
        readout.innerHTML = s.phase === "result"
          ? `<b style="color:${ok/n>=0.8?"#4ade80":"#ffd166"}">${ok}/${n} 答對（${(ok/n*100).toFixed(0)}%）</b>`
          : `第 ${s.qi+1} 題，已對 ${ok} 題`;
      } else if (s.phase === "review") {
        const icon = "📕";
        pText(CX, 200, icon, TH.text, 72, "center");
        const remaining = Object.keys(drillBook).length;
        pText(CX, 310, `弱點複習`, TH.text, 22, "center", true);
        pText(CX, 350, `目前還有 ${remaining} 個弱點題型`, TH.dim, 16, "center");
        readout.innerHTML = `📕 弱點複習・第 ${s.reviewIdx+1}/${s.reviewQueue.length} 題`;
      } else {
        // 起始畫面
        pText(CX, 200, "📋", TH.text, 72, "center");
        pText(CX, 300, shortName, TH.text, 28, "center", true);
        pText(CX, 340, "選題數後開始出卷", TH.dim, 16, "center");
        const dbN = Object.keys(drillBook).length;
        if (dbN > 0) pText(CX, 380, `📕 ${dbN} 個弱點題型待複習`, "#fbbf24", 14, "center");
        readout.innerHTML = "選取題數開始綜合演練";
      }
    },
  };
}

/* ─── 三個演練關卡 ─── */
const MX1 = makeExamLevel("MX1", "七上演練", "b1", "完成一回 ≥10 題且答對率 ≥80%（七上）");
const MX2 = makeExamLevel("MX2", "七下演練", "b2", "完成一回 ≥10 題且答對率 ≥80%（七下）");
const MX3 = makeExamLevel("MX3", "跨冊綜合", "all", "完成一回 ≥10 題且答對率 ≥80%（跨冊）");

/* ─── 掛入 SUBJECTS ─── */
SUBJECTS.mx = {
  name: "綜合演練",
  levels: [MX1, MX2, MX3],
};

/* ─── EP 登記 ─── */
EP.MX = ["原創綜合演練（隨機出題）", "https://github.com/klmtseng/junior-math-lab"];

/* ─── 重新渲染科目列（drill.js 載入後） ─── */
// 延後到下一 microtask，確保 main.js 的 renderSubjects 定義已執行
Promise.resolve().then(() => { renderSubjects(); });

"""
test_drill_templates.py — 每個模板的獨立驗算閘門

跑法：
    cd /home/ai-mac/Desktop/AI_MAC/Projects/junior-math-lab
    python3 tests/test_drill_templates.py

使用 Node.js 直接執行（不需啟動 HTTP server），每個模板跑 200 個 seed：
  (a) check(gen_result) 全過（獨立驗算）
  (b) 答案正規化冪等（normAns(normAns(x)) == normAns(x)）
  (c) 題目文字 q/why 含至少一個數字（防模板文字忘了帶入）
"""
import subprocess, sys, json, os, tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# 提取 drill.js 的核心邏輯（去掉依賴 main.js 的部份）
# 只需要 DRILL_TEMPLATES + normAns + mulberry32 + gcd + fracStr + fracMatch + normIneq + checkAnswer
HARNESS_JS = r"""
"use strict";

/* ── 工具函式（從 drill.js 複製） ── */
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }
function fracStr(n, d) {
  if (d === 0) return "?";
  if (n === 0) return "0";
  const g = gcd(Math.abs(n), Math.abs(d));
  const sn = (n / g) * (d < 0 ? -1 : 1), sd = Math.abs(d / g);
  return sd === 1 ? String(sn) : `${sn}/${sd}`;
}
function normAns(s) {
  return String(s).replace(/\s/g, "")
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[＋＋]/g, "+").replace(/[－−]/g, "-")
    .replace(/[＜]/g, "<").replace(/[＞]/g, ">")
    .replace(/[≦]/g, "<=").replace(/[≧]/g, ">=")
    .replace(/[×]/g, "*").replace(/[÷]/g, "/")
    .toLowerCase();
}
function normIneq(s) {
  return normAns(s).replace(/\s/g, "")
    .replace(/=</g, "<=").replace(/=>/g, ">=")
    .replace(/<=/g, "≤").replace(/>=/g, "≥");
}
function fracMatch(userRaw, numer, denom) {
  const s = normAns(userRaw);
  const expected = fracStr(numer, denom);
  if (s === normAns(expected)) return true;
  const m = s.match(/^(-?\d+)\/(-?\d+)$/);
  if (m) {
    const un = parseInt(m[1]), ud = parseInt(m[2]);
    return un * denom === numer * ud;
  }
  return false;
}

DRILL_TEMPLATES_SOURCE

function checkAnswer(tpl, gen_result, userRaw) {
  const normUser = normAns(userRaw);
  if (normUser === normAns(gen_result.ans)) return true;
  try { return tpl.gen && gen_result.check && gen_result.check({ ans: userRaw }); } catch(e) { return false; }
}

/* ── T5 答案竄改函式（針對每種題型格式） ── */
function tamperAns(ans) {
  const s = String(ans);
  // 數字型（整數或小數）
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    return String(parseFloat(s) + 1);
  }
  // 分數型 n/d
  const fracM = s.match(/^(-?\d+)\/(\d+)$/);
  if (fracM) return `${parseInt(fracM[1]) + 1}/${fracM[2]}`;
  // 不等式型 x<N / x>=N：方向翻轉
  if (/^x[<>]=?-?\d+$/.test(s)) {
    return s.replace(/[<>]=?/, op => {
      if (op === "<") return ">";
      if (op === ">") return "<";
      if (op === "<=") return ">=";
      return "<=";
    });
  }
  // 座標型 (x,y)
  const coordM = s.match(/^\((-?\d+),(-?\d+)\)$/);
  if (coordM) return `(${parseInt(coordM[1])+1},${coordM[2]})`;
  // 聯立 x=N,y=M
  const simM = s.match(/^x=(-?\d+),y=(-?\d+)$/);
  if (simM) return `x=${parseInt(simM[1])+1},y=${simM[2]}`;
  // 質因數 / 象限 / |N| / 一樣大 / 其他字串 → 固定錯答案
  return "__WRONG__";
}

/* ── T5b 開閉互換竄改（方向不變，只改 < ↔ ≤、> ↔ ≥） ── */
function tamperIneqOpenClose(ans) {
  const s = String(ans);
  // 不等式型 xOPN / x≤N 等（含 unicode ≤ ≥）
  return s
    .replace(/x<=/g, "x<PLACEHOLDER_STRICT_LT")
    .replace(/x>=/g, "x>PLACEHOLDER_STRICT_GT")
    .replace(/x</g, "x<=")
    .replace(/x>/g, "x>=")
    .replace(/x<PLACEHOLDER_STRICT_LT/g, "x<")
    .replace(/x>PLACEHOLDER_STRICT_GT/g, "x>")
    .replace(/x≤/g, "x<")   // normIneq 轉換後的 unicode 形式
    .replace(/x≥/g, "x>");
}

/* ── 主驗算迴圈 ── */
const SEEDS = 200;
const results = {};

for (const tpl of DRILL_TEMPLATES) {
  const tid = tpl.tid;
  const c = { checkOk: 0, checkFail: 0, normIdem: 0, normFail: 0, qOk: 0, qFail: 0,
              t5Ok: 0, t5Fail: 0,
              t5bOk: 0, t5bFail: 0, t5bSkip: 0,  // T5b: open/close swap (b2_inequality only)
              errors: [] };

  for (let seed = 1; seed <= SEEDS; seed++) {
    try {
      const rng = mulberry32(seed * 31337 + 17);
      const gen = tpl.gen(rng);

      // (a) check 獨立驗算
      let ck = false;
      try { ck = gen.check({ ans: gen.ans }); } catch(e) { ck = false; }
      if (ck) c.checkOk++; else {
        c.checkFail++;
        if (c.errors.length < 5) c.errors.push(`seed=${seed} check FAILED ans=${JSON.stringify(gen.ans)} q=${gen.q.slice(0,60)}`);
      }

      // (b) normAns 冪等
      const n1 = normAns(gen.ans), n2 = normAns(n1);
      if (n1 === n2) c.normIdem++; else {
        c.normFail++;
        if (c.errors.length < 5) c.errors.push(`seed=${seed} norm not idempotent: ${gen.ans} -> ${n1} -> ${n2}`);
      }

      // (c) q 和 why 含數字
      if (/\d/.test(gen.q + gen.why) && gen.q.length > 5) c.qOk++;
      else {
        c.qFail++;
        if (c.errors.length < 5) c.errors.push(`seed=${seed} q has no digit: ${gen.q.slice(0,60)}`);
      }

      // (d) T5 反向斷言：竄改後 check/checkAnswer 必須判錯
      const tampered = tamperAns(gen.ans);
      let t5Bad = false;
      try { t5Bad = gen.check({ ans: tampered }); } catch(e) { t5Bad = false; }
      // 也用 checkAnswer（字串比對路徑）
      if (!t5Bad) {
        try { t5Bad = checkAnswer(tpl, gen, tampered); } catch(e) { t5Bad = false; }
      }
      if (!t5Bad) {
        c.t5Ok++;
      } else {
        c.t5Fail++;
        if (c.errors.length < 5) c.errors.push(`seed=${seed} T5 TAMPER ACCEPTED: ans=${gen.ans} tampered=${tampered}`);
      }

      // (e) T5b 開閉互換竄改（只對 b2_inequality；方向不變，< ↔ ≤、> ↔ ≥）
      if (tid === "b2_inequality") {
        const tamperedOC = tamperIneqOpenClose(gen.ans);
        if (tamperedOC === gen.ans) {
          c.t5bSkip++;  // 答案不含不等式符號（不應發生）
        } else {
          let t5bBad = false;
          try { t5bBad = gen.check({ ans: tamperedOC }); } catch(e) { t5bBad = false; }
          if (!t5bBad) {
            try { t5bBad = checkAnswer(tpl, gen, tamperedOC); } catch(e) { t5bBad = false; }
          }
          if (!t5bBad) {
            c.t5bOk++;
          } else {
            c.t5bFail++;
            if (c.errors.length < 5) c.errors.push(`seed=${seed} T5b OPEN/CLOSE ACCEPTED: ans=${gen.ans} tampered=${tamperedOC}`);
          }
        }
      }

    } catch(e) {
      c.checkFail++;
      if (c.errors.length < 5) c.errors.push(`seed=${seed} EXCEPTION: ${e.message}`);
    }
  }

  results[tid] = c;
}

/* ── T6 退化率抽測（2000 seeds）── */
const T6_SEEDS = 2000;
const t6Results = {};

// ratio a==b（b2_ratio_unknown）
{
  const tpl = DRILL_TEMPLATES.find(t => t.tid === "b2_ratio_unknown");
  let degenCount = 0;
  for (let seed = 1; seed <= T6_SEEDS; seed++) {
    const rng = mulberry32(seed * 7919 + 3);
    try {
      const gen = tpl.gen(rng);
      // 退化判定：題目字串含「a : a」形式（a===b 時 a:b=a:a）
      // 更直接：解析 q 中的比例式，判斷兩端比值是否為 1:1
      // 由於 a 和 b 已分離，檢查 q 包含「N : N = 」（兩個相同數字）
      const m = gen.q.match(/(\d+)\s*:\s*(\d+)\s*=/);
      if (m && m[1] === m[2]) degenCount++;
    } catch(e) {}
  }
  t6Results["b2_ratio_unknown_ab_eq"] = degenCount;
}

// symmetry 自映射（b2_symmetry）：x軸模式 y==0、y軸模式 x==0
{
  const tpl = DRILL_TEMPLATES.find(t => t.tid === "b2_symmetry");
  let degenCount = 0;
  for (let seed = 1; seed <= T6_SEEDS; seed++) {
    const rng = mulberry32(seed * 7919 + 3);
    try {
      const gen = tpl.gen(rng);
      // 自映射：對稱點等於原點，即答案座標等於問題座標
      // 從題目中提取原點座標，從 ans 提取對稱座標，比較
      const origM = gen.q.match(/點\s*\((-?\d+),\s*(-?\d+)\)/);
      const ansM = gen.ans.match(/\((-?\d+),(-?\d+)\)/);
      if (origM && ansM && origM[1] === ansM[1] && origM[2] === ansM[2]) degenCount++;
    } catch(e) {}
  }
  t6Results["b2_symmetry_self_map"] = degenCount;
}

// midpoint a==b（b1_midpoint）：原本沒有守衛，檢查是否出現 a==b
{
  const tpl = DRILL_TEMPLATES.find(t => t.tid === "b1_midpoint");
  let degenCount = 0;
  for (let seed = 1; seed <= T6_SEEDS; seed++) {
    const rng = mulberry32(seed * 7919 + 3);
    try {
      const gen = tpl.gen(rng);
      const m = gen.q.match(/A\((-?\d+)\)\s*和\s*B\((-?\d+)\)/);
      if (m && m[1] === m[2]) degenCount++;
    } catch(e) {}
  }
  t6Results["b1_midpoint_ab_eq"] = degenCount;
}

process.stdout.write(JSON.stringify({ results, t6Results }));
"""

# 讀取 drill.js，提取 DRILL_TEMPLATES 陣列
drill_js_path = os.path.join(ROOT, "js", "drill.js")
with open(drill_js_path, encoding="utf-8") as f:
    drill_src = f.read()

# 找 DRILL_TEMPLATES 的定義部分（從 const DRILL_TEMPLATES 到最後一個 ]; 結尾的區塊）
# 注入到 harness 中
# 找到 DRILL_TEMPLATES 開頭
start = drill_src.index("const DRILL_TEMPLATES = [")
# 找結尾 "];" (最外層)
depth = 0
end = start
for i, c in enumerate(drill_src[start:], start):
    if c == '[': depth += 1
    elif c == ']':
        depth -= 1
        if depth == 0:
            end = i + 1
            break

templates_src = drill_src[start:end] + ";"

# 組合 harness
node_script = HARNESS_JS.replace("DRILL_TEMPLATES_SOURCE", templates_src)

# 寫入臨時文件
with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False, encoding='utf-8') as f:
    f.write(node_script)
    tmp_path = f.name

try:
    result = subprocess.run(
        ["node", tmp_path],
        capture_output=True, text=True, timeout=60
    )
    if result.returncode != 0:
        print(f"Node.js error: {result.stderr[:500]}")
        sys.exit(1)

    payload = json.loads(result.stdout)
    data = payload["results"]
    t6data = payload["t6Results"]
    all_pass = True

    print(f"\n=== 模板驗算閘門 (各 {200} seeds) ===")
    for tid, c in data.items():
        check_pass = c["checkFail"] == 0
        norm_pass  = c["normFail"] == 0
        q_pass     = c["qFail"] == 0
        t5_pass    = c["t5Fail"] == 0
        t5b_pass   = c["t5bFail"] == 0  # 非 b2_inequality 時 t5bFail 必為 0
        ok = check_pass and norm_pass and q_pass and t5_pass and t5b_pass
        status = "PASS" if ok else "FAIL"
        t5b_str = f"  t5b={c['t5bOk']}/200" if tid == "b2_inequality" else ""
        print(f"  [{status}] {tid:28s}  check={c['checkOk']}/200  norm={c['normIdem']}/200  q={c['qOk']}/200  t5reject={c['t5Ok']}/200{t5b_str}")
        if not ok:
            all_pass = False
            for e in c["errors"][:3]:
                print(f"         ERR: {e}")

    t_count = len(data) >= 16
    t_check = all(c["checkFail"] == 0 for c in data.values())
    t_norm  = all(c["normFail"] == 0 for c in data.values())
    t_q     = all(c["qFail"] == 0 for c in data.values())
    t5      = all(c["t5Fail"] == 0 for c in data.values())
    t5b_ineq = data["b2_inequality"]["t5bFail"] == 0

    # T6 退化率
    t6_ratio_pass = t6data["b2_ratio_unknown_ab_eq"] == 0
    t6_sym_pass   = t6data["b2_symmetry_self_map"] == 0
    t6_mid_pass   = t6data["b1_midpoint_ab_eq"] == 0
    t6_pass = t6_ratio_pass and t6_sym_pass and t6_mid_pass

    print(f"\nT1 模板數 ≥ 16: {'PASS' if t_count else 'FAIL'} ({len(data)})")
    print(f"T2 所有模板 check() 通過 200 seeds: {'PASS' if t_check else 'FAIL'}")
    print(f"T3 normAns 冪等 200 seeds: {'PASS' if t_norm else 'FAIL'}")
    print(f"T4 q/why 含數字 200 seeds: {'PASS' if t_q else 'FAIL'}")
    print(f"T5 竄改後 check 拒絕 200 seeds (反向斷言): {'PASS' if t5 else 'FAIL'}")
    print(f"T5b b2_inequality 開閉互換竄改被拒 200 seeds: {'PASS' if t5b_ineq else 'FAIL'}")
    print(f"T6 退化率抽測 2000 seeds:")
    print(f"  b2_ratio_unknown a==b: {'PASS' if t6_ratio_pass else 'FAIL'} ({t6data['b2_ratio_unknown_ab_eq']} 例)")
    print(f"  b2_symmetry 自映射:    {'PASS' if t6_sym_pass else 'FAIL'} ({t6data['b2_symmetry_self_map']} 例)")
    print(f"  b1_midpoint a==b:      {'PASS' if t6_mid_pass else 'FAIL'} ({t6data['b1_midpoint_ab_eq']} 例)")

    all_pass = all_pass and t_count and t_check and t_norm and t_q and t5 and t5b_ineq and t6_pass
finally:
    os.unlink(tmp_path)

sys.exit(0 if all_pass else 1)

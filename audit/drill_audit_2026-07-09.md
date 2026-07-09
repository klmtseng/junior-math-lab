# 綜合演練 (mx) 中段審計 — commit d85ce4c (2026-07-09)

對抗式審查者，未參與建造。實跑 node 探針 + 兩支測試 + Playwright。

## P1（必修）

1. **b1_midpoint 6.5% 出退化題 A(k)=B(k)（兩點相同）+ check() 因此恆真**
   drill.js:141-158。`while(b===a)` 之後的 `if((a+b)%2!==0){b=b+1;}` 會把 b 推回 a
   （seed8: a=-3,b=-4 → 奇偶修正 → b=-3=a）。實測 327/5000。此時 check
   `|m-a|==|m-b|` 對任意 m 恆真 → 學生亂填 999999 也判對（實測 44 例假接受）。
   修法：奇偶修正後重新檢查 `while(b===a||(a+b)%2)` 迴圈；或修正時同時避開 a。

2. **模板閘門 T2 是「只驗接受、不驗拒絕」的半邊測試（歷史踩雷同型）**
   test_drill_templates.py:89 `gen.check({ans:gen.ans})` — 只喂正確答案斷言 true，
   從不喂錯答案驗 false。b1_midpoint 的恆真 check 就是靠這個漏網（200 seeds 全 PASS）。
   修法：每模板加「喂已知錯答案，斷言 check()===false」的反向斷言。

3. **test_drill_ui.py 六情境非穩定全過（flaky）**
   冷跑第一次 T2(drillBook)、T4a FAIL；接兩次 PASS。根因為 Playwright 計時競態
   （wait_for_timeout 400ms 太短，render+點 next 有時搶在 correct/dbMiss 落地前），
   非邏輯 bug（已驗 WRONG_ANSWER_XYZ 不被任何 check 接受）。但 flaky 閘門不能支撐
   「六情境全過」宣稱。修法：改用 wait_for_selector / expect 條件等待取代固定 sleep。

## P2（建議）

4. **新科目 mx 併入 SUBJECTS 改變全科證書條件（行為變更，需使用者裁決）**
   drill.js:926 加 `SUBJECTS.mx`；main.js:1296 `allDone=Object.keys(SUBJECTS).every(subjectDone)`。
   原本七上+七下全過=🏆全通關；現在還須完成 3 關 mx 演練才給全通關。allLevels()=15。
   既有 12 關/B1Q/JQ 錯題本不受影響（key 各異：drillbook-v1 vs wrongbook-v1；已實跑 batch1 PASS）。

5. **b1_abs_compare 14.9% 出 |a|==|b| 退化「哪個大」（答案一樣大）**
   drill.js:110 `if(a===b){b+1;}` 是無作用語句（算完丟棄）。等絕對值對如 (-1,1) 佔 14.9%。
   有「一樣大」選項故非錯，但對「比大小」題型偏多。修法：把 b+1 真的賦值或重抽。

6. **全形逗號未正規化：座標/聯立答案 `5，2`、`x=4，y=2` 部分被判錯**
   normAns（drill.js:37-46）未轉全形逗號。sym 用 split(",") → `5，2` REJECT（但全形括號 ok）；
   simul 用 `[,，]` 有處理故 ok。手機注音 IME 常打全形逗號 → 學生答對被判錯。
   修法：normAns 加 `.replace(/，/g,",")`。

## P3（吹毛求疵）

7. **b1_frac_mult 11% 出 `2/2 × 3/3` 類（兩個 1 相乘），答案是整數 1**
   drill.js:280 的 `if(a>=b||c>=d){}` 是空塊，未強制真分數。prompt 說「填分數」但答案整數，
   接受 "1"（已驗）。非錯但對分數乘法練習偏水。

8. **b2_symmetry x=k 模式 ~11% k==px（點在對稱軸上，對稱點=原點自身）** drill.js:596。可接受但偏 trivial。

9. **b2_simultaneous `y=2,x=4`（順序顛倒）REJECT** — 有指定格式，屬合理；提一下。

## 查過沒問題

- 質因數分解正規化穩健：`2×5×7 / 5×2×7 / 2*5*7 / 2x5x7 / 2 × 5 × 7` 皆接受；p^e 與上標²³⁴皆解析（實跑）。
- 不等式 `≤ / <= / x <= -1 / ≦` 皆接受（實跑）；`=<`（非法寫法）拒絕，合理。
- b2_axis_dist 距離 0：0/5000（有守衛）；b2_average 非整數平均：0/5000（有守衛）。
- b1_linear_eq / b2_ratio_unknown / b2_proportion：check 為獨立驗算（代回/交叉相乘），非恆真。
- localStorage 新 key jrlab-drillbook-v1 不撞舊 key；既有 15 關無 console error 無 404（batch1 實跑 PASS）。
- 空白送出有 `if(!val)return` 守衛；inputmode 全 text（純數字題無數字鍵盤，屬 UX 小憾非錯）。

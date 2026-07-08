# PROGRESS — 國中數感實驗室 Junior Math Lab

## 2026-07-08 拆站自 linear-algebra-lab
- 引擎(Canvas 2D / storyboard / 示範旁白 / localStorage 進度)抽自 linear-algebra-lab(數感實驗室)
- 重新定位:108 課綱七年級互動數學練習(取代線代內容)
- 初始 12 關:J1/J2/J5/J6/B1Q(七上)+ J3/J4/J7/J8/J9/J10/JQ(七下)

## 2026-07-08 批次一:七上七下分冊 + J7–J10
- 科目按冊分組(七上 b1 / 七下 b2),各自 tab / goal / 進度
- J7 交點獵人:兩直線交點拖曳,含示範
- J8 數線塗色:不等式解集合塗色,含示範
- J9 數據偵探:拖動數據看平均數+長條圖即時變
- J10 鏡子與積木:線對稱鏡像 + 積木三視圖選擇
- commit: feat: 七上七下分冊 + J7-J10 四關

## 2026-07-08 錯題本
- makeQuiz 錯題本:答錯加入、答對移除、持久化跨輪
- 複習模式:enterReview() 只出錯題,複習不計入 pass
- commit: feat: 錯題本持久化 + 複習模式

## 2026-07-08 可讀性 P1 修正(validity-audit 修復)
- README.md 重寫:移除舊線代內容,改為本專案 12 關說明
- PROGRESS.md 重寫:本專案時間線
- index.html footer:加「清快取會清進度」提醒
- js/main.js:
  - 檔頭「國中銜接六關」→「七年級 12 關」
  - theme fallback:localStorage 非法值改 "dark" 而非 undefined(防白屏)
  - EP 字典刪除孤兒(線代/概率/微積分 16 條),僅保留 J/Q
  - B1Q why 文字「(J1+J5 整合)」→「(J1+統計)」
  - 錯題本資料契約:加 quizSig(djb2 hash),wrongBook 改存 {sig, idx};舊格式自動升遷;sig 不符丟棄
- SYLLABUS.md:涵蓋率修正 + 「✅(待審計)」→「✅」+ 加「已知簡化」節
- tests/ 入 repo:test_wrongbook / test_batch1_final / test_voice_default + README
- commit: fix: validity-audit P1/P2/P3 全修

## 容量備注

音檔成長約 1 MB / 批(46 句 ≈ 1.7 MB),localStorage 用量可忽略(進度 key 約 1–2 KB)。

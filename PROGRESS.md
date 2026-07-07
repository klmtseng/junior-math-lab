# PROGRESS

## 2026-07-03 M1:8 關全建成 + Playwright 驗收 PASS
- 骨架:index.html + style.css + js/main.js(零依賴 Canvas 2D)
- 8 關對應 JOHNSON-MATH 線代 EP1–EP3(見 README 對照表)
- 引擎:column-基向量矩陣、格線變形動畫(lerp+ease)、拖曳吸附 0.5 格點、localStorage 進度
- 驗收(Chromium headless):8 關截圖 OK、零 console/page error;互動測試全過
  - L1 拖 v→(3,2) 過關、L3 滑桿命中 (2,3)、L4 四預設、L5 det=0/det<0、
    L6 S→R 合成矩陣 [0 -1; 1 1] 正確+quiz、L7 dot=0 正交、L8 45° 特徵方向 λ≈3
- 已修:tab 標籤改短名、readout 移畫布上方

## 2026-07-03 M1.5:公開上線
- GitHub: https://github.com/klmtseng/linear-algebra-lab (public, noreply email)
- Vercel: https://linear-algebra-lab-tau.vercel.app (git connect 已串,push 即自動重佈)
- 上線驗證:index 200 含「線代實驗室」、js/main.js 200

## 待辦 / Parking lot
- 手機實機驗收(觸控拖曳已用 pointer events + touch-action:none,理論可用)
- 擴充:概率 7 集系列做第二模組(骨架已可重用 tab/goal/進度系統)
- L5 目標「det=0」會在拖曳路過原點時順手達成——若要更有儀式感可改成需停留 0.5s

## 2026-07-03 M2:示範模式(先看示範→換你玩)
- 相機系統(scale/x/y 可補間,toScr/fromScr 改讀 cam)→ 放大縮小動畫
- 示範播放器:宣告式 storyboard(vec/num/cam/mat/call 補間步),字幕層 CSS 淡入淡出
- 8 關各配 5-9 步示範;首次進入未通關自動播;▶ 按鈕重播;點畫布=跳過
- 節制原則:示範中格線降淡聚焦主角;markGoal 停用(示範不代打過關)
- 驗收(Chromium):自動播/相機還原/goal 抑制/跳過/L6 接力同步/L3 滑桿跟動 全 PASS,零 error

## 2026-07-06 M3:第二科目「機率與統計」(4 關)
- 頂部科目切換(線性代數 / 機率與統計),各自 tab/goal/示範/進度,共用引擎
- 引擎擴充:draggable 支援螢幕座標(getScreen/setScreen)、示範播放器加 num2 補間
- 機率 4 關(自寫 2D 繪圖,不經向量座標系),對應 JOHNSON-MATH 概率 EP04-07:
  - P1 機率密度=麵粉撒桌:拖 a/b 門檻線框面積=P(a<X<b),單點為 0
  - P2 正態分佈:μ/σ 滑桿 + 68-95-99.7 陰影
  - P3 健檢偽陽性:自然頻率方格(有病/健康雙欄+PPV 條),盛行率崩 PPV
  - P4 貝氏更新:先驗→按陽性/陰性→後驗信念條+證據序列
- 驗收(Chromium):科目切換、4 關互動+goal、示範自動播/跳過、切回線代 全 PASS,零 error
- 專案已更名「數感實驗室 Math Lab」(repo/網址不變)

## 2026-07-06 M4:補齊兩科目(線代 8→11、機率 4→7,共 18 關)
- 線代進階 3 關:
  - L9 投影矩陣:投影到直線,影子=v / 影子=0(v⊥d);P=ddᵀ/dᵀd
  - L10 基變換:同一 v 在斜基底下的座標 [v]_B=B⁻¹v,命中 (1,2)+斜基底
  - L11 SVD 奇異值:單位圓→橢圓,σ₁σ₂=|det|;做出正圓(σ₁=σ₂)/塌陷(σ₂=0,秩1)
- 機率補完 3 關:
  - P5 期望值:分布重心(三角支點),灌鉛滑桿推 E[X] 到兩端
  - P6 大數法則:累積平均擲骰收斂到 3.5,早期震盪 vs 500+ 收斂
  - P7 中心極限定理:N 顆骰和(精確卷積)→鐘形,疊理論正態曲線
- 修:L10 初始 v 誤觸過關(改起點非星星,demo reset 同步)
- 驗收(Chromium):6 新關互動+goal+示範全 PASS,零 error

## 2026-07-06 M5:再補 4 關(線代 11→13、機率 7→9,共 22 關)
- 線代:
  - L12 零空間/行空間:塌陷後行空間(金線)+零空間(紫虛線),秩-零化度;拖 u 使 A·u=0
  - L13 馬可夫鏈穩態:2 態轉移矩陣迭代→收斂到穩態(λ=1 特徵向量),與初始無關;軌跡圖+穩態線
- 機率:
  - P8 樣本空間與加法法則:兩圓 Venn,P(A∪B)=P(A)+P(B)−P(A∩B),互斥/重疊;lensArea 精確交集
  - P9 條件機率:把世界縮到 B(框外壓暗+剪裁高亮 A∩B),P(A|B)=P(A∩B)/P(B);A⊆B / P(A|B)=0
- 引擎:新增 lensArea/drawDisc 幾何helper;沿用螢幕座標 draggable
- 驗收(Chromium):4 新關互動+goal 全 PASS,零 error(P8/P9 早期測試失敗是測試座標 stale,非功能問題)

## 2026-07-06 M6:第三科目微積分 + 進度總覽/證書 + 淺色主題(共 26 關)
- 微積分 4 關(函數繪圖 plotMap/plotAxes/plotFn):
  - C1 極限與夾擠:cos x ≤ sin x/x ≤ 1,探針→0 看夾擠+x=0 的「洞」
  - C2 導數:割線 h→0 縮成切線,x 軸握把移動找斜率=0 的極值
  - C3 積分:黎曼和 N 格逼近曲線下面積,粗→細收斂
  - C4 微積分基本定理:上 f(x)/下 A(x) 雙圖,A′(x)=f(x)(f 高處 A 陡、f=0 處 A 平)
- 進度總覽:header「🎓 總進度 X/26」+ 科目 pill 完成數
- 完成證書:單科全過顯示恭喜卡、三科全過顯示 🏆 全通關卡(可截圖)
- 淺色課程主題:🌙/☀️ 切換,CSS var + 畫布顏色(TH/PC)雙層同步,localStorage 記住
- 引擎:C2/C4 改用 x 軸 ▲ 握把(手機好抓,取代 curve 上小點)
- 驗收(Chromium):微積分 4 關互動+goal、證書、主題切換全 PASS,零 error

## 2026-07-06 M7:示範旁白語音(預錄,Kokoro 大陸腔)
- 音色定案:Kokoro zf_xiaoxiao + misaki[zh] G2P(espeak 唸不了中文;使用者選大陸腔預錄,台灣腔 Kokoro 給不了)
- 生成器 tools/gen_narration.py:讀 tools/captions.json(125句)→符號轉口語(say():σ→西格瑪、→→趨近/停頓、÷≤⊥ 等)→ audio/<id>_<i>.mp3(zf_xiaoxiao,80k,共 4MB);manifest=audio/narration.json
- 播放:🔇/🔊 開關(header,localStorage 記住),示範逐句同步;單一 Audio 元素重用(iOS 友善);語音比字幕長會等唸完再跳(上限 dur+15s);瀏覽器擋自動播放→靜音續播(catch);按 ▶看示範/開關=使用者手勢解鎖
- 驗收(Chromium):toggle 持久化、audio 請求正確、檔案 200、跳過停音、自動示範無手勢不報錯 全 PASS
- 重生指令:kokoro-venv/bin/python tools/gen_narration.py [--force]

## 2026-07-07 M8:三科總測驗 + 對外準備(共 29 關)
- makeQuiz 工廠:單選+Fisher-Yates 洗牌(reviewer 24萬次模擬驗證均勻)+逐題解釋+整卷重測;LQ 6題(過5)/PQ 6題(過5)/CQ 5題(過4);通過=該科目完成(證書條件)
- **流程變更(使用者定案):validity-audit 移到管線中段**——測驗內容先過獨立審計才部署:17 題正解全對、引擎無 bug;修 3 個措辭漏洞(LQ4 λ<0 方向反轉改「留在原直線」、LQ5 加非零前提、CQ5 改問斜率封死「開始下降」歧義)
- 對外配套:MIT LICENSE、og meta+og.png、footer 非官方聲明(與 JOHNSON-MATH 無隸屬)
- 驗收:三科 tab 數 14/10/5、洗牌有效(首輪亂點 0/6)、學習後重測過關、goal/證書連動,零 error

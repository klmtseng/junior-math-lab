# 線代實驗室 LA Lab

用手拖出線性代數的幾何直覺。8 個互動關卡,配合 [JOHNSON-MATH](https://www.youtube.com/@JOHNSON-MATH) 《線性代數》EP1–EP3 服用。

純前端、零依賴(Canvas 2D + vanilla JS),開 `index.html` 即用;進度存 localStorage。

## 關卡 ↔ 影片對照

| 關 | 主題 | 對應影片 |
|---|---|---|
| 1 | 向量 = 基向量的配方 | [EP1 基向量與張成空間](https://www.youtube.com/watch?v=ZvDpkXAvWGk) |
| 2 | 基向量搬家,全世界跟著搬(線性變換) | EP1 |
| 3 | 張成空間 span + 共線塌陷 | EP1 |
| 4 | 矩陣 = 變形指令(旋轉/剪切/縮放/鏡射) | [EP2 行列式與矩陣秩](https://www.youtube.com/watch?v=9gRzBcHhYXw) |
| 5 | 行列式 = 面積縮放(det=0 塌陷、det<0 翻面) | EP2 |
| 6 | 矩陣乘法 = 變換接力(AB ≠ BA) | EP2 |
| 7 | 內積 = 投影,親手做出正交 | [EP3 特徵值與內積投影](https://www.youtube.com/watch?v=Ddw4H_pT_AM) |
| 8 | 特徵向量獵人:找出不轉向的方向 | EP3 |

## 旁白語音(選用)

示範模式可開 🔊 旁白(預錄 mp3,Kokoro zf_xiaoxiao 中文女聲)。重生:`~/Desktop/AI_MAC/tools/kokoro-venv/bin/python tools/gen_narration.py`(需 misaki[zh])。字幕改了要重跑。

## 本機開發

```bash
python3 -m http.server 8123   # 然後開 http://localhost:8123/
```

驗收:Playwright + Chromium(本機 Chrome WebGL 壞,但本專案只用 Canvas 2D,不受影響)。

## 版權

本站所有視覺化與文案為原創,僅以連結方式指向 JOHNSON-MATH 頻道的概念講解;亦致敬 3Blue1Brown《Essence of Linear Algebra》的教學路線。

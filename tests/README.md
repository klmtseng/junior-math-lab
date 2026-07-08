# tests/

Playwright 端對端測試,從 repo 根目錄執行。

## 前置

```bash
pip install playwright
playwright install chromium
```

## 跑法

```bash
# 從 repo 根目錄執行
python3 tests/test_wrongbook.py       # 錯題本持久化+簽名保護+theme fallback
python3 tests/test_batch1_final.py    # 全 12 關開啟+科目/tab 計數+無404音檔
python3 tests/test_voice_default.py   # 旁白按鈕預設靜音+無crash
```

## 測試說明

| 檔案 | 測試項目 |
|---|---|
| test_wrongbook.py | T1 錯題記錄 {sig,idx}+持久化+複習按鈕; T2 複習清空+不觸發pass; T3 全對過關+錯題本空; T4 sig 不符→丟棄不崩潰; T5 theme="xyz"→fallback 不白屏 |
| test_batch1_final.py | 科目數=2; 共12關; 無404音檔; 無console error |
| test_voice_default.py | 預設開聲(🔊); 無crash |

各測試退出碼:0=全 PASS,1=有 FAIL。

# Jic-Workhub 工作規範

## 檔案刪除安全

禁止批量刪除檔案或目錄。

不得使用：

- `del /s`
- `rd /s`
- `rmdir /s`
- `Remove-Item -Recurse`
- `rm -rf`

需要刪除檔案時，只能一次刪除一個已確認的明確檔案路徑。若需要批量刪除，停止操作並請使用者手動處理。

## Git 紀錄規範

1. 每完成一項獨立工作，建立一筆獨立的本機 Git commit，不得混入不相干功能。
2. Commit 標題與本文全部使用繁體中文。
3. Commit 本文必須分段說明：
   - 做了什麼
   - 為什麼要做
   - 如何驗證及測試結果
   - 影響、風險或尚未完成事項
4. 測試失敗、內容未確認或含敏感資料時不得 commit。
5. 每筆 commit 前必須列出並核對 staged files。
6. 不得提交 `.env` 真值、憑證、正式資料、`node_modules`、`dist`、log 或備份。
7. 不得 amend、reset、force、rebase 或以其他方式改寫既有歷史。
8. 完成後回報每筆 commit SHA、繁體中文標題、包含檔案與對應測試。
9. 未經使用者明確同意不得 push。

## 雲端與正式環境

未經使用者明確同意，不得部署、修改 DNS／GitHub Pages 設定、建立或修改 Firebase／Google Cloud 資源，也不得讀寫正式資料。

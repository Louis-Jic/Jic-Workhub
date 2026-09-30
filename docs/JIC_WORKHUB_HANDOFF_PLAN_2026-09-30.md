# Jic WorkHub 公司版交接與開發紀錄

本紀錄用於協調個人舊版 WorkHub 與公司新版 Jic WorkHub 的分離、複製、驗證及後續優化。現階段的主要決策是：個人舊版保持不動；公司版先重現原有功能並建立獨立、安全的 Firebase 測試環境，驗證完成後才進行新功能修改與正式切換。

## 專案身分與範圍

- 個人舊版來源：`C:\Users\Louis\Desktop\WorkHub\jimmore-hr`
- 公司新版目標：`C:\Users\Louis\Desktop\Jic-Workhub`
- Codex 專案：`Jic-Workhub`（後續公司新版任務統一建立於此專案）
- 公司 GitHub repository：`Louis-Jic/Jic-Workhub`
- 公司管理帳號：由使用者在公司 Firebase 建立階段指定，不記錄於 repository。
- 個人網域 `workhub.cwli.dev`、個人 repository 與個人 Firebase 在本階段保持不動。
- 公司預定網域：`workhub.jimmore.com.tw`
- 公司 production 保留 Google Cloud 專案：`Workhub`，Project ID
  `workhub-508108`，Project number `1086883330549`。目前沒有已驗證證據可確認
  Firebase 已加入或啟用，因此不得部署、寫入測試資料或作為 staging 使用。
- 公司版先複製原有功能；新功能與流程優化安排在可重現、安全測試環境完成之後。
- 不在本紀錄或程式庫保存 Google、GitHub、Firebase 密碼、私鑰、權杖或其他憑證。

## 今日目標

今天先完成第一階段約一半的基礎工作，不以正式上線為完成標準：

- [x] 公司版保留原有前端功能與頁面，不任意改變既有業務邏輯。
- [x] 建立可重現的本機安裝、建置與測試流程。
- [x] Firebase 設定拆分為 Emulator、staging 與 production。
- [x] 本機與測試環境預設不得連線或寫入原正式 `jimmore-workhub`。
- [x] 補齊必要的 Firebase 設定、Firestore Rules、Indexes、Functions 與最小測試。
- [x] 測試資料只使用合成資料，不複製真實員工個資。
- [x] 確認 `.env`、憑證、備份、匯出資料與建置產物不會提交到 Git。
- [x] 主要執行任務完成第一輪修正與報告。
- [ ] 第二輪修正完成後，由唯讀審查任務再次複查，再決定是否進入 commit、push、Firebase 建立與部署。

## 任務分工與交替規則

### 主要執行任務

「盤點 Jic-Workhub 專案」負責實際修改、建置與安全測試。只修改公司新版目標，不修改個人舊版來源。完成一輪後必須明確回報已停止寫檔，才能交給審查任務。

### 唯讀審查任務

「規劃 Jic WorkHub 測試環境」只在主要執行任務停止寫檔後開始。它負責檢查 Git diff、Firebase 隔離、敏感資料、規則、測試及部署設定，只回報問題，不直接修正。

### 交替方式

1. 主要執行任務修改並測試。
2. 主要執行任務停止寫檔並交付報告。
3. 唯讀審查任務檢查並列出問題。
4. 唯讀審查任務停止後，問題交回主要執行任務修正。
5. 重複審查，直到安全閘門通過。

任何時間只能有一個任務修改 `C:\Users\Louis\Desktop\Jic-Workhub`。若偵測到檔案仍在變動，另一個任務必須停止。

## 必須先詢問使用者的操作

以下事項不得自行決定或執行：

- 使用公司 Google 帳號登入或進行需要人工驗證的操作。
- 建立另一個 staging Firebase／Google Cloud 專案，以及決定其 Project ID、地區與帳單帳戶。
- 在 production 保留專案 `workhub-508108` 加入或啟用 Firebase。
- 啟用付費方案、連結或變更 Google Cloud Billing。
- 匯出、複製或匯入正式 Firebase 資料。
- 決定哪些員工帳號或歷史資料需要移轉。
- 修改 DNS、公司網域或 GitHub Pages 正式設定。
- 建立、刪除或變更正式雲端資源。
- commit、push、發布、部署或切換正式流量。
- 任何可能覆寫、刪除或改寫 Git 歷史的操作。

需要使用者處理時，任務應停在安全狀態，只提出一個清楚問題，說明所需選擇與影響。不得要求使用者提供密碼。

## 已知外部阻塞

- `workhub.jimmore.com.tw` 曾發生公司權威 DNS 伺服器回覆不一致，造成電腦與手機出現 NXDOMAIN。此問題需由公司 DNS 管理端修正，與前端程式或 Firebase 設定分開處理。
- DNS 與 TLS 憑證尚未穩定前，不以公司網域可連線作為程式建置失敗的判定。

## 第一階段完成後的下一步

第一階段通過審查後，再由使用者確認是否：

1. 由公司管理帳號建立公司 Firebase staging 專案。
2. 部署 Rules、Indexes 與 Functions 到 staging。
3. 建立合成測試員工與假勤資料，完成流程驗收。
4. 列出需要優化或新增的功能，逐項在公司版開發。
5. 經使用者核准後，在 production 保留專案 `workhub-508108` 啟用並設定 Firebase，規劃正式資料移轉與切換日期。

## 進度紀錄

- 2026-09-30：確認採用「一個任務修改、另一個任務唯讀審查」的交替方式。
- 2026-09-30：已通知主要執行任務繼續第一階段整備，且不得部署、推送或操作正式雲端資源。
- 2026-09-30：已通知唯讀審查任務等待主要執行任務停止寫檔後再開始審查。
- 2026-09-30：依安全審查要求，repository 不再記錄公司管理帳號的精確 email。
- 2026-09-30：依使用者指示，後續相關任務及本紀錄統一歸入 `Jic-Workhub` 專案。
- 2026-09-30：第一輪完整檢查通過：前端 11 tests、Functions 15 tests、Rules Emulator 3 tests。
- 2026-09-30：唯讀審查提出 App Check 預設、build/deploy guard、Pages artifact 隔離與 Rules 覆蓋問題；已交回主要執行任務進行第二輪修正。
- 2026-09-30：第二輪完整檢查通過：前端與政策 19 tests、Functions 16 tests、Rules Emulator 4 tests，皆為 0 失敗、0 skipped。
- 2026-09-30：staging 與 production artifact 已分離；staging 無 CNAME 與舊 Project ID，合成 production artifact 通過資產、CNAME 與 legacy 掃描。Pages workflow 僅產生 artifact，不含部署工作。
- 2026-09-30：公司正式 Firebase 專案 `workhub-508108` 已啟用，Firestore 已匯入 11,801 筆文件，並建立 `Jimmore WorkHub Web`。Pages workflow 已補上受保護的手動部署工作，待 production variables 與 App Check 完成後執行。
- 2026-09-30：使用者指定 Google Cloud 專案 `Workhub`（Project ID `workhub-508108`、Project number `1086883330549`）保留作未來 production；不得作 staging，且 Firebase 啟用狀態尚未驗證。

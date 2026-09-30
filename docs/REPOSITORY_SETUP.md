# Jic WorkHub repository setup

## Safety boundary

This company repository must never use the legacy `jimmore-workhub` Firebase project.
The committed staging defaults use the Firebase Emulator Suite and the reserved
`demo-jic-workhub-staging` project ID. Demo project IDs do not address a live
Firebase project.

Do not commit `.env.production`, `.env.*.local`, `.firebaserc`, service-account
JSON, private keys, App Check debug tokens, employee exports, or emulator data.

Create and grant the company management account only inside the approved company
Firebase project; never store or request its address or password in this repository.

## Reproducible local verification

Prerequisites are Node.js 22 and Java 21.

```text
npm ci
npm ci --prefix functions
npm run check
```

`npm run check` builds `dist/staging`, runs frontend and Functions unit tests, starts an
isolated Firestore Emulator for rules tests, and validates source and built asset
paths. It does not use a Firebase account or a live Firebase project.

## 本機啟動

這個專案不能使用 VS Code Live Server。Live Server 直接提供 raw HTML，無法
注入 Vite mode 與 `.env.staging`，因此安全防呆會顯示「環境設定已阻擋」。

先完成安裝：

```text
npm ci
npm ci --prefix functions
```

需要互動資料時，在第一個終端機啟動 Emulator（需要 Java 21）：

```text
npm run emulators
```

Emulator 顯示所有服務已啟動後，在另一個終端機建立可重複使用的合成管理員：

```text
npm run emulators:seed
```

本機登入帳號為 `admin@jic-workhub.test`，密碼為 `LocalDemo123!`。這組帳密與
資料只存在 `demo-jic-workhub-staging` Emulator；種子腳本會先驗證 Auth 與
Firestore 主機皆為 localhost，避免誤寫正式 Firebase。

再於第二個終端機啟動 Vite：

```text
npm run dev
```

瀏覽器請開啟 `http://127.0.0.1:5500/`。測試只能使用合成帳號與合成假勤、
打卡資料；不得匯入或複製正式員工資料。若只檢查畫面建置而不操作登入或
資料，可以只執行 `npm run dev`，但依賴資料的頁面需要 Emulator 才能使用。

## Environment separation

- `.env.staging` is committed and emulator-only.
- `.env.production.example` documents required production values.
- Real production values belong in an untracked `.env.production` or protected
  GitHub environment variables.
- `.firebaserc.example` documents separate aliases without binding this checkout
  to a real Firebase project.

### Reserved production project

- Google Cloud project name: `Workhub`
- Project ID: `workhub-508108`
- Project number: `1086883330549`
- Purpose: reserved for future company production only

Firebase enablement has not been verified for this Cloud project. Do not deploy,
write test data, attach staging workflows, or treat it as ready until the user
separately approves Firebase enablement and production configuration. The real
staging environment must use a different company Cloud/Firebase project; the
committed `demo-jic-workhub-staging` Emulator configuration remains the default.

Both staging and production builds reject the legacy project. The runtime accepts
only a Project ID approved by the build, blocks Emulator configuration on public
hosts, and requires an App Check site key for production builds. Functions App
Check enforcement defaults to `false`; enabling enforcement requires a separate,
explicit approval after staging validation.

Firebase deployment must go through `scripts/firebase-deploy.mjs`. Validation
requires an explicit environment, exact Project ID confirmation, and membership
in `JIC_APPROVED_FIREBASE_PROJECTS`. The wrapper performs validation only unless
`--execute` and an explicit `--only` resource list are both provided. Functions
also run the same policy as a Firebase predeploy guard.

Validation-only example:

```text
JIC_APPROVED_FIREBASE_PROJECTS=jic-workhub-staging npm run deploy:check -- jic-workhub-staging staging jic-workhub-staging
```

The three repeated values are target Project ID, environment, and exact Project
ID confirmation. This command does not deploy.

## GitHub Pages

The Pages workflow is manual-only (`workflow_dispatch`). It verifies the full
test suite, builds the production artifact, uploads it, and deploys it through
the protected `github-pages` environment. Staging is built into `dist/staging`
without `CNAME`; production is built separately into `dist/production`, adds
`CNAME`, and receives an additional asset and legacy-project scan.

Before the first manual deployment:

1. Create and validate a separate company staging Firebase project. The approved
   production project is `workhub-508108`, and its web app is
   `Jimmore WorkHub Web` (`1:1086883330549:web:e2318b260d7277813408bc`).
2. Store the documented `PRODUCTION_*` values as protected GitHub environment or
   repository variables. The workflow maps them to `VITE_*` only for
   `npm run build:production`; missing values fail the build.
3. In repository Pages settings, select **GitHub Actions** as the source.
4. Confirm the custom-domain DNS and HTTPS certificate separately.

Running the workflow publishes Pages after all checks pass. Keep the workflow
manual until Authentication, Storage, Functions, Rules, App Check, and the final
data synchronization have been validated.

## Firebase project information still required

- Globally unique staging Project ID; recommended candidate: `jic-workhub-staging`.
- A separate staging Firebase project; production project `workhub-508108` must
  not be reused for staging.
- Firestore location. Keep it immutable and aligned with Taiwan operations;
  `asia-east1` is the current Functions region, but the Firestore location must be
  selected explicitly when the database is created.
- Owning Google Cloud Organization ID/name.
- Billing Account ID/name and the person authorized to attach it.
- reCAPTCHA Enterprise App Check site key for the staging web app, authorized
  staging hostnames, enforcement rollout date, and named debug-token owners.

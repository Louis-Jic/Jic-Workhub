const env = import.meta.env || {};

const envValue = (name, fallback = "") => String(env[name] ?? fallback).trim();
const envFlag = (name, fallback = false) => {
  const value = envValue(name);
  return value ? value === "true" : fallback;
};

export const firebaseConfig = Object.freeze({
  apiKey: envValue("VITE_FIREBASE_API_KEY"),
  authDomain: envValue("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: envValue("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: envValue("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: envValue("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: envValue("VITE_FIREBASE_APP_ID")
});

export const appSecurityConfig = Object.freeze({
  environment: envValue("VITE_APP_ENV", "unconfigured"),
  appCheckSiteKey: envValue("VITE_APP_CHECK_SITE_KEY"),
  functionsRegion: envValue("VITE_FIREBASE_FUNCTIONS_REGION", "asia-east1"),
  emulatorHost: envValue("VITE_FIREBASE_EMULATOR_HOST", "127.0.0.1"),
  enableAppCheckDebug: envFlag("VITE_APP_CHECK_DEBUG"),
  useEmulators: envFlag("VITE_USE_FIREBASE_EMULATORS"),
  projectApproved: typeof __FIREBASE_PROJECT_APPROVED__ !== "undefined"
    && __FIREBASE_PROJECT_APPROVED__ === true,
  enforcementDate: ""
});

export function validateFirebaseRuntime({
  hostname,
  config = firebaseConfig,
  security = appSecurityConfig
}) {
  const host = String(hostname || "").toLowerCase();
  const projectId = String(config.projectId || "").trim();
  const environment = String(security.environment || "").trim();
  const isLocal = new Set(["localhost", "127.0.0.1", "::1"]).has(host);
  const isPublishedHost = host.endsWith(".github.io") || host === "workhub.jimmore.com.tw";

  if (!projectId) {
    throw new Error("Firebase 尚未設定；已停止啟動，未連線至任何資料庫。");
  }
  if (!new Set(["staging", "production"]).has(environment)) {
    throw new Error(`不允許的執行環境 ${environment || "(空白)"}；已停止 Firebase 連線。`);
  }
  if (security.projectApproved !== true) {
    const locationLabel = isLocal || isPublishedHost ? `（目前主機：${host}）` : "";
    throw new Error(`Firebase Project ID 未通過公司版建置核准${locationLabel}；已阻止所有讀寫。`);
  }
  if (security.useEmulators && !isLocal) {
    throw new Error("Firebase Emulator 設定只能在 localhost 使用；已阻止公開網站連線。");
  }
  if (environment === "production" && projectId.startsWith("demo-")) {
    throw new Error("Production build 不得使用 demo Firebase Project ID；已停止啟動。");
  }
  if (environment === "production" && !security.appCheckSiteKey) {
    throw new Error("Production build 缺少 App Check Site Key；已停止 Firebase 連線。");
  }

  return Object.freeze({ environment, isLocal, isPublishedHost, projectId });
}

export const productConfig = Object.freeze({
  productName: "Jimmore WorkHub",
  edition: "attendance-security",
  schemaVersion: 1,
  timezone: "Asia/Taipei",
  defaultLocale: "zh-TW"
});

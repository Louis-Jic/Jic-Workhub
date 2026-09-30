import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { getFunctions, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app-check.js";
import {
  firebaseConfig,
  appSecurityConfig,
  validateFirebaseRuntime
} from "../firebase-config.js";

const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const isLocal = localHosts.has(location.hostname);

function renderConfigurationBlock(error) {
  const message = error instanceof Error ? error.message : String(error);
  const render = () => {
    const escapedMessage = message.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[character]);
    document.body.innerHTML = `
      <main style="max-width:720px;margin:64px auto;padding:24px;font-family:system-ui,sans-serif">
        <h1 style="font-size:1.5rem">環境設定已阻擋</h1>
        <p>${escapedMessage}</p>
        <p>為避免誤用正式資料，本頁不會初始化 Firebase。請聯絡系統管理員確認 staging／production 設定。</p>
      </main>`;
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render, { once: true });
  } else {
    render();
  }
}

let validatedEnvironment;
try {
  validatedEnvironment = validateFirebaseRuntime({
    hostname: location.hostname,
    config: firebaseConfig,
    security: appSecurityConfig
  });
} catch (error) {
  renderConfigurationBlock(error);
  throw error;
}

export const app = initializeApp(firebaseConfig);

const shouldInitializeAppCheck = Boolean(appSecurityConfig.appCheckSiteKey)
  && !appSecurityConfig.useEmulators
  && (!isLocal || appSecurityConfig.enableAppCheckDebug);

// App Check 必須在任何其他 Firebase 服務之前初始化，否則 Auth / Firestore
// 可能先建立未受 App Check 管理的 provider，導致正式站權杖取得失敗。
if (shouldInitializeAppCheck) {
  if (isLocal) {
    // Firebase 會在主控台輸出一次性 Debug Token。只將 Token 登錄到
    // Firebase App Check 後台，不要寫進原始碼或版本控制。
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appSecurityConfig.appCheckSiteKey),
    isTokenAutoRefreshEnabled: true
  });
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, appSecurityConfig.functionsRegion);

if (appSecurityConfig.useEmulators) {
  connectAuthEmulator(auth, `http://${appSecurityConfig.emulatorHost}:9099`, {
    disableWarnings: true
  });
  connectFirestoreEmulator(db, appSecurityConfig.emulatorHost, 8080);
  connectFunctionsEmulator(functions, appSecurityConfig.emulatorHost, 5001);
}

export const runtimeEnvironment = Object.freeze({
  isLocal,
  name: validatedEnvironment.environment,
  projectId: validatedEnvironment.projectId,
  appCheckEnabled: shouldInitializeAppCheck,
  emulatorsEnabled: Boolean(appSecurityConfig.useEmulators)
});

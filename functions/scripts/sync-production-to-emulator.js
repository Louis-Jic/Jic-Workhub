"use strict";

const { Firestore } = require("@google-cloud/firestore");
const { deleteApp, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const SOURCE_PROJECT_ID = "workhub-508108";
const TARGET_PROJECT_ID = "demo-jic-workhub-staging";
const COLLECTIONS = Object.freeze([
  "attendance",
  "attendanceDaily",
  "attendanceExceptions",
  "auditEvents",
  "leaveRequests",
  "overtimeRequests",
  "punchGuards",
  "rateLimits",
  "users",
  "workSettings",
  "workSites"
]);
const DEFAULT_LOCAL_PASSWORD = "LocalDemo123!";
const LEGACY_SEED_UID = "local-admin";

function assertLocalHost(name, value, expectedPort) {
  const normalized = String(value || "").toLowerCase();
  const allowed = new Set([
    `127.0.0.1:${expectedPort}`,
    `localhost:${expectedPort}`
  ]);
  if (!allowed.has(normalized)) {
    throw new Error(`${name} 必須指向本機 ${expectedPort}，目前為 ${value || "(空白)"}。`);
  }
}

function assertSyncSafety(env = process.env) {
  if (env.SOURCE_FIREBASE_PROJECT !== SOURCE_PROJECT_ID) {
    throw new Error(`SOURCE_FIREBASE_PROJECT 必須明確設定為 ${SOURCE_PROJECT_ID}。`);
  }
  if (env.CONFIRM_PRODUCTION_READ !== SOURCE_PROJECT_ID) {
    throw new Error(`CONFIRM_PRODUCTION_READ 必須明確設定為 ${SOURCE_PROJECT_ID}。`);
  }
  if (!env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error("缺少公司帳號的 GOOGLE_APPLICATION_CREDENTIALS。資料不會開始同步。");
  }
  assertLocalHost("FIRESTORE_EMULATOR_HOST", env.FIRESTORE_EMULATOR_HOST, 8080);
  assertLocalHost("FIREBASE_AUTH_EMULATOR_HOST", env.FIREBASE_AUTH_EMULATOR_HOST, 9099);
}

async function copyCollection(source, target, collectionName) {
  const snapshot = await source.collection(collectionName).get();
  let batch = target.batch();
  let pending = 0;
  let copied = 0;

  for (const document of snapshot.docs) {
    batch.set(target.collection(collectionName).doc(document.id), document.data());
    pending += 1;
    copied += 1;
    if (pending === 400) {
      await batch.commit();
      batch = target.batch();
      pending = 0;
    }
  }
  if (pending > 0) await batch.commit();
  return copied;
}

async function upsertLocalLogin(source, email, password) {
  const snapshot = await source.collection("users").where("email", "==", email).limit(2).get();
  if (snapshot.empty) throw new Error(`正式 users 集合找不到 ${email}。`);
  if (snapshot.size > 1) throw new Error(`正式 users 集合有重複 Email：${email}。`);

  const profile = snapshot.docs[0];
  const appName = "production-to-local-auth-sync";
  const oldApp = getApps().find((item) => item.name === appName);
  if (oldApp) await deleteApp(oldApp);
  const app = initializeApp({ projectId: TARGET_PROJECT_ID }, appName);
  const auth = getAuth(app);

  try {
    try {
      await auth.deleteUser(LEGACY_SEED_UID);
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }
    const existing = await auth.getUserByEmail(email);
    if (existing.uid !== profile.id) {
      throw new Error(`本機 Auth 已有相同 Email，但 UID 與正式資料不一致（${existing.uid}）。`);
    }
    await auth.updateUser(profile.id, {
      password,
      displayName: profile.get("name") || email,
      disabled: false
    });
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    await auth.createUser({
      uid: profile.id,
      email,
      password,
      displayName: profile.get("name") || email,
      disabled: false
    });
  } finally {
    await deleteApp(app);
  }

  return profile.id;
}

async function main() {
  process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
  assertSyncSafety(process.env);

  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIRESTORE_EMULATOR_HOST;
  const source = new Firestore({ projectId: SOURCE_PROJECT_ID });
  process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
  const target = new Firestore({ projectId: TARGET_PROJECT_ID });

  let total = 0;
  try {
    // 移除舊 seed 的單一本機假帳號，讓本機員工數與正式資料一致。
    await target.collection("users").doc(LEGACY_SEED_UID).delete();
    for (const collectionName of COLLECTIONS) {
      const copied = await copyCollection(source, target, collectionName);
      total += copied;
      console.log(`${collectionName}: ${copied} 筆`);
    }

    const loginEmail = String(process.env.LOCAL_EMULATOR_LOGIN_EMAIL || "").trim().toLowerCase();
    if (!loginEmail) throw new Error("缺少 LOCAL_EMULATOR_LOGIN_EMAIL，無法建立本機登入帳號。");
    const localPassword = process.env.LOCAL_EMULATOR_LOGIN_PASSWORD || DEFAULT_LOCAL_PASSWORD;
    await upsertLocalLogin(source, loginEmail, localPassword);

    console.log(`正式 Firestore 已唯讀同步 ${total} 筆至本機 Emulator。`);
    console.log(`本機登入帳號：${loginEmail}`);
    console.log("本機密碼使用 LOCAL_EMULATOR_LOGIN_PASSWORD；未設定時為專案既有測試密碼。");
    console.log("沒有修改正式 Firebase，也沒有將公司資料寫入磁碟或 Git。 ");
  } finally {
    await Promise.allSettled([source.terminate(), target.terminate()]);
  }
}

module.exports = {
  COLLECTIONS,
  SOURCE_PROJECT_ID,
  TARGET_PROJECT_ID,
  assertLocalHost,
  assertSyncSafety
};

if (require.main === module) {
  main().catch((error) => {
    console.error("同步正式資料到本機 Emulator 失敗：", error.message || error);
    process.exitCode = 1;
  });
}

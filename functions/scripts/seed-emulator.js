"use strict";

// 這個腳本只允許連線到本機 Emulator，絕不接受正式 Firebase 主機。
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";

const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");

const PROJECT_ID = "demo-jic-workhub-staging";
const TEST_ACCOUNT = Object.freeze({
  uid: "local-admin",
  email: "admin@jic-workhub.test",
  password: "LocalDemo123!",
  displayName: "本機測試管理員"
});

function assertLocalEmulator(name, value, expectedPort) {
  const normalized = String(value || "").toLowerCase();
  const allowedHosts = new Set([
    `127.0.0.1:${expectedPort}`,
    `localhost:${expectedPort}`
  ]);
  if (!allowedHosts.has(normalized)) {
    throw new Error(`${name} 必須指向本機 ${expectedPort}，目前為 ${value || "(空白)"}。`);
  }
}

async function upsertTestUser(auth) {
  try {
    await auth.getUser(TEST_ACCOUNT.uid);
    await auth.updateUser(TEST_ACCOUNT.uid, {
      email: TEST_ACCOUNT.email,
      password: TEST_ACCOUNT.password,
      displayName: TEST_ACCOUNT.displayName,
      disabled: false
    });
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    await auth.createUser(TEST_ACCOUNT);
  }
}

async function main() {
  assertLocalEmulator("FIREBASE_AUTH_EMULATOR_HOST", process.env.FIREBASE_AUTH_EMULATOR_HOST, 9099);
  assertLocalEmulator("FIRESTORE_EMULATOR_HOST", process.env.FIRESTORE_EMULATOR_HOST, 8080);

  initializeApp({ projectId: PROJECT_ID });
  const auth = getAuth();
  const db = getFirestore();

  await upsertTestUser(auth);
  await db.doc(`users/${TEST_ACCOUNT.uid}`).set({
    name: TEST_ACCOUNT.displayName,
    email: TEST_ACCOUNT.email,
    department: "測試部門",
    role: "admin",
    managerId: "",
    workMode: "office",
    attendanceRequired: true,
    defaultShiftId: "default",
    annualLeaveHours: 56,
    compensatoryLeaveHours: 8,
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  await db.doc("workSettings/default").set({
    timezone: "Asia/Taipei",
    lunchStart: "12:00",
    lunchEnd: "13:00",
    shifts: [{
      id: "default",
      name: "本機測試班別",
      startTime: "08:30",
      endTime: "17:30",
      workHours: 8
    }],
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  console.log("本機 Emulator 測試資料已建立。");
  console.log(`帳號：${TEST_ACCOUNT.email}`);
  console.log(`密碼：${TEST_ACCOUNT.password}`);
  console.log("這組帳密只存在本機 Emulator，不可用於正式環境。");
}

main().catch((error) => {
  console.error("建立本機測試資料失敗：", error);
  process.exitCode = 1;
});

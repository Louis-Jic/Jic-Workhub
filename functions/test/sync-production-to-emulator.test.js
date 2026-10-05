"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SOURCE_PROJECT_ID,
  assertLocalHost,
  assertSyncSafety
} = require("../scripts/sync-production-to-emulator");

function safeEnv(overrides = {}) {
  return {
    SOURCE_FIREBASE_PROJECT: SOURCE_PROJECT_ID,
    CONFIRM_PRODUCTION_READ: SOURCE_PROJECT_ID,
    GOOGLE_APPLICATION_CREDENTIALS: "C:\\temp\\company-adc.json",
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    ...overrides
  };
}

test("只接受本機 Emulator 主機", () => {
  assert.doesNotThrow(() => assertLocalHost("FIRESTORE_EMULATOR_HOST", "localhost:8080", 8080));
  assert.throws(
    () => assertLocalHost("FIRESTORE_EMULATOR_HOST", "firestore.googleapis.com:443", 8080),
    /必須指向本機/
  );
});

test("安全設定完整時允許同步", () => {
  assert.doesNotThrow(() => assertSyncSafety(safeEnv()));
});

test("來源專案或確認字串錯誤時拒絕同步", () => {
  assert.throws(
    () => assertSyncSafety(safeEnv({ SOURCE_FIREBASE_PROJECT: "other-project" })),
    /SOURCE_FIREBASE_PROJECT/
  );
  assert.throws(
    () => assertSyncSafety(safeEnv({ CONFIRM_PRODUCTION_READ: "" })),
    /CONFIRM_PRODUCTION_READ/
  );
});

test("目標不是本機 Emulator 時拒絕同步", () => {
  assert.throws(
    () => assertSyncSafety(safeEnv({ FIREBASE_AUTH_EMULATOR_HOST: "example.com:9099" })),
    /必須指向本機/
  );
});

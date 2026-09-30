import test from "node:test";
import assert from "node:assert/strict";
import { assertBuildEnvironment } from "../scripts/build-environment-policy.mjs";

const base = {
  VITE_FIREBASE_API_KEY: "test-api-key",
  VITE_FIREBASE_AUTH_DOMAIN: "localhost",
  VITE_FIREBASE_PROJECT_ID: "demo-jic-workhub-staging",
  VITE_FIREBASE_STORAGE_BUCKET: "demo-jic-workhub-staging.appspot.com",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
  VITE_FIREBASE_APP_ID: "1:000000000000:web:test",
  VITE_APP_ENV: "staging",
  VITE_USE_FIREBASE_EMULATORS: "true",
  VITE_APP_CHECK_SITE_KEY: ""
};

test("staging build accepts the committed demo environment", () => {
  assert.equal(assertBuildEnvironment("staging", base).environment, "staging");
});

test("both build modes reject the legacy project", () => {
  const legacyProject = ["jimmore", "workhub"].join("-");
  assert.throws(() => assertBuildEnvironment("staging", {
    ...base, VITE_FIREBASE_PROJECT_ID: legacyProject
  }), /legacy/);
  assert.throws(() => assertBuildEnvironment("production", {
    ...base,
    VITE_APP_ENV: "production",
    VITE_FIREBASE_PROJECT_ID: legacyProject,
    VITE_USE_FIREBASE_EMULATORS: "false",
    VITE_APP_CHECK_SITE_KEY: "site-key"
  }), /legacy/);
});

test("VITE_APP_ENV must match the selected mode", () => {
  assert.throws(() => assertBuildEnvironment("staging", {
    ...base, VITE_APP_ENV: "production"
  }), /must match/);
  assert.throws(() => assertBuildEnvironment("production", {
    ...base,
    VITE_FIREBASE_PROJECT_ID: "jic-workhub-production",
    VITE_USE_FIREBASE_EMULATORS: "false",
    VITE_APP_CHECK_SITE_KEY: "site-key"
  }), /must match/);
});

test("production rejects demo, staging, emulator, and missing App Check settings", () => {
  const production = {
    ...base,
    VITE_APP_ENV: "production",
    VITE_FIREBASE_PROJECT_ID: "jic-workhub-production",
    VITE_USE_FIREBASE_EMULATORS: "false",
    VITE_APP_CHECK_SITE_KEY: "site-key"
  };
  assert.equal(assertBuildEnvironment("production", production).environment, "production");
  assert.throws(() => assertBuildEnvironment("production", {
    ...production, VITE_FIREBASE_PROJECT_ID: "demo-production"
  }), /demo or staging/);
  assert.throws(() => assertBuildEnvironment("production", {
    ...production, VITE_FIREBASE_PROJECT_ID: "jic-workhub-staging"
  }), /demo or staging/);
  assert.throws(() => assertBuildEnvironment("production", {
    ...production, VITE_USE_FIREBASE_EMULATORS: "true"
  }), /cannot enable/);
  assert.throws(() => assertBuildEnvironment("production", {
    ...production, VITE_APP_CHECK_SITE_KEY: ""
  }), /APP_CHECK/);
});

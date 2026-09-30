import test from "node:test";
import assert from "node:assert/strict";
import {
  firebaseSetupGuidance,
  validateFirebaseRuntime
} from "../js/firebase-config.js";

const staging = {
  environment: "staging",
  useEmulators: true,
  projectApproved: true,
  appCheckSiteKey: ""
};

test("default staging emulator configuration is accepted on localhost", () => {
  const result = validateFirebaseRuntime({
    hostname: "127.0.0.1",
    config: { projectId: "demo-jic-workhub-staging" },
    security: staging
  });
  assert.equal(result.environment, "staging");
});

for (const hostname of ["localhost", "louis-jic.github.io", "workhub.jimmore.com.tw"]) {
  test(`unapproved project is blocked on ${hostname}`, () => {
    assert.throws(() => validateFirebaseRuntime({
      hostname,
      config: { projectId: "unapproved-project" },
      security: { ...staging, useEmulators: false, projectApproved: false }
    }), /未通過公司版建置核准/);
  });
}

test("emulator configuration is blocked on a published host", () => {
  assert.throws(() => validateFirebaseRuntime({
    hostname: "workhub.jimmore.com.tw",
    config: { projectId: "demo-jic-workhub-staging" },
    security: staging
  }), /只能在 localhost/);
});

test("production requires a non-demo project and App Check", () => {
  assert.throws(() => validateFirebaseRuntime({
    hostname: "workhub.jimmore.com.tw",
    config: { projectId: "demo-jic-workhub" },
    security: { environment: "production", useEmulators: false, appCheckSiteKey: "", projectApproved: true }
  }), /不得使用 demo/);
  assert.throws(() => validateFirebaseRuntime({
    hostname: "workhub.jimmore.com.tw",
    config: { projectId: "jic-workhub-production" },
    security: { environment: "production", useEmulators: false, appCheckSiteKey: "", projectApproved: true }
  }), /App Check/);
});

test("localhost block guidance directs developers away from Live Server", () => {
  const guidance = firebaseSetupGuidance("127.0.0.1");
  assert.match(guidance, /停止 Live Server/);
  assert.match(guidance, /npm run dev/);
  assert.match(guidance, /Firebase Emulator/);
});

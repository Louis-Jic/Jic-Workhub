"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const config = require("../src/config");

test("runtime defaults are regionalized with App Check enforcement disabled", () => {
  assert.equal(config.REGION, "asia-east1");
  assert.equal(config.TIME_ZONE, "Asia/Taipei");
  assert.equal(config.CALLABLE_OPTIONS.minInstances, 0);
  assert.equal(config.CALLABLE_OPTIONS.enforceAppCheck, false);
});

test("App Check enforcement requires explicit approval through true", () => {
  const modulePath = require.resolve("../src/config");
  const original = process.env.APP_CHECK_ENFORCEMENT;
  try {
    process.env.APP_CHECK_ENFORCEMENT = "true";
    delete require.cache[modulePath];
    assert.equal(require("../src/config").CALLABLE_OPTIONS.enforceAppCheck, true);

    process.env.APP_CHECK_ENFORCEMENT = "TRUE";
    delete require.cache[modulePath];
    assert.equal(require("../src/config").CALLABLE_OPTIONS.enforceAppCheck, false);
  } finally {
    if (original === undefined) delete process.env.APP_CHECK_ENFORCEMENT;
    else process.env.APP_CHECK_ENFORCEMENT = original;
    delete require.cache[modulePath];
  }
});

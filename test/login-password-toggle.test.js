import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const loginHtml = fs.readFileSync(new URL("../login.html", import.meta.url), "utf8");
const authSource = fs.readFileSync(new URL("../js/auth.js", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../css/style.css", import.meta.url), "utf8");

test("登入密碼欄提供可存取的顯示與隱藏按鈕", () => {
  assert.match(loginHtml, /id="loginPasswordToggle"/);
  assert.match(loginHtml, /aria-controls="loginPassword"/);
  assert.match(loginHtml, /data-password-icon="show"/);
  assert.match(loginHtml, /data-password-icon="hide"/);
  assert.match(authSource, /loginPassword\.type = shouldShow \? "text" : "password"/);
  assert.match(authSource, /setAttribute\("aria-label", shouldShow \? "隱藏密碼" : "顯示密碼"\)/);
  assert.match(styles, /\.password-toggle:focus-visible/);
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const adminSource = fs.readFileSync(new URL("../js/admin.js", import.meta.url), "utf8");
const securitySource = fs.readFileSync(new URL("../js/security-admin.js", import.meta.url), "utf8");
const attendanceHtml = fs.readFileSync(new URL("../admin/attendance.html", import.meta.url), "utf8");

test("出勤報表更新後保留查詢與展開狀態", () => {
  assert.match(adminSource, /ATTENDANCE_VIEW_STATE_KEY/);
  assert.match(adminSource, /persistAttendanceViewState/);
  assert.match(adminSource, /restoreAttendanceViewState/);
  assert.match(adminSource, /attendanceYearFilter/);
  assert.match(adminSource, /attendanceDepartmentFilter/);
  assert.match(adminSource, /attendanceTodayMissingDetails/);
  assert.match(adminSource, /attendanceRawDetails/);
});

test("未打卡審核更新後保留篩選與案件展開狀態", () => {
  const reviewHandlers = securitySource.slice(
    securitySource.indexOf("function bindCaseReviews"),
    securitySource.indexOf("async function renderWorkSites")
  );
  assert.match(securitySource, /ATTENDANCE_SECURITY_STATE_KEY/);
  assert.match(securitySource, /openCaseIds/);
  assert.match(securitySource, /persistAttendanceSecurityState/);
  assert.match(reviewHandlers, /attendance-data-updated/);
  assert.doesNotMatch(reviewHandlers, /location\.reload\(\)/);
});

test("出勤頁載入新版狀態保存程式", () => {
  assert.match(attendanceHtml, /admin\.js\?v=20261014-2/);
});

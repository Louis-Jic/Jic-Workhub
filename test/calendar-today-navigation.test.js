import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../js/calendar.js", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../css/style.css", import.meta.url), "utf8");

test("今天按鈕會在重新渲染後捲動到今天", () => {
  assert.match(source, /renderCalendarMonth\(\);[\s\S]*requestAnimationFrame\([\s\S]*scrollToCalendarDate\(today\)/);
  assert.match(source, /scrollIntoView\(\{ behavior: "smooth", block: "center"/);
});

test("桌機與手機日期都有今天定位點", () => {
  const anchors = source.match(/data-calendar-date=/g) || [];
  assert.ok(anchors.length >= 2);
  assert.match(source, /dayEvents\.length \|\| dayCompanyEvents\.length \|\| isToday/);
  assert.match(source, /aria-current="date"/);
});

test("手機月份工具列固定在導覽列下方", () => {
  assert.match(
    styles,
    /\.calendar-title-with-controls\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*79px;/
  );
});

test("手機滑離月份工具列後仍提供固定的今天按鈕", () => {
  assert.match(source, /id="mobileTodayJumpBtn"[\s\S]*?>[\s\S]*?今天/);
  assert.match(source, /new IntersectionObserver\([\s\S]*?updateMobileTodayJump\(entry\.isIntersecting\)/);
  assert.match(source, /#mobileTodayJumpBtn"\)\.addEventListener\("click", jumpToToday\)/);
  assert.match(
    styles,
    /\.calendar-mobile-today-jump:not\(\[hidden\]\)\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?bottom:/
  );
});

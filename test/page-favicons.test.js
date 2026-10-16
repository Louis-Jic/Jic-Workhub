import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pages = ["dashboard", "attendance", "leave", "overtime", "calendar", "profile"];

test("六個員工頁面各有專屬的正方形 PNG 分頁圖示", () => {
  const iconPaths = new Set();

  for (const page of pages) {
    const html = fs.readFileSync(new URL(`../${page}.html`, import.meta.url), "utf8");
    const iconPath = `assets/favicons/${page}.png`;
    const links = html.match(/<link\b[^>]*\brel="icon"[^>]*>/g) ?? [];

    assert.equal(links.length, 1, `${page}.html 應只有一個分頁圖示`);
    assert.match(links[0], /\btype="image\/png"/);
    assert.ok(links[0].includes(`href="${iconPath}"`));
    assert.ok(!iconPaths.has(iconPath), `${page}.html 的分頁圖示不可與其他頁面共用`);
    iconPaths.add(iconPath);

    const png = fs.readFileSync(new URL(`../${iconPath}`, import.meta.url));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 128, `${iconPath} 寬度應為 128px`);
    assert.equal(png.readUInt32BE(20), 128, `${iconPath} 高度應為 128px`);
  }

  assert.equal(iconPaths.size, pages.length);
});

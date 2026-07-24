// 用 Playwright 给 popup.html 与 options.html 截图，结果落到仓库根目录
// 的 popup-shot.png 与 options-shot.png，用于 README 预览。
//
// 用法：
//   node shot.mjs           # 同时截 popup 与 options（默认）
//   node shot.mjs popup     # 只截 popup
//   node shot.mjs options   # 只截 options
//
// 为什么需要 mock：popup.js / options.js 的 init() 都通过
// chrome.storage.local.get(DEFAULTS, cb) 拉配置，再用结果填表单、构建色块、
// 应用预览样式。用 file:// 直接打开页面时 chrome API 不存在，init() 抛错中断，
// 整张页面停在「未初始化」状态（空输入框、无色块、预览无样式）——这正是过去
// popup 截图与实际效果不一致的根因。这里在页面加载前注入一个纯内存版的
// chrome.storage.local + chrome.runtime，让 init() 正常跑完，截图即等于真实效果。
//
// 依赖：node_modules/playwright（仓库已自带）。首次运行若缺浏览器内核，
// 跑 `npx playwright install chromium`。

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = dirname(fileURLToPath(import.meta.url));

// ---- 参数：截哪些页面 ----
const targets = process.argv.slice(2);
const which = targets.length === 0 ? 'all' : targets[0];
const doPopup = which === 'all' || which === 'popup';
const doOptions = which === 'all' || which === 'options';
if (!doPopup && !doOptions) {
    console.error('✗ 未知参数：' + which + '（可选：popup / options / all）');
    process.exit(1);
}

// 校验 playwright 已安装，给出可操作的错误提示而不是顶层抛栈。
const playwrightEntry = join(ROOT, 'node_modules', 'playwright', 'package.json');
if (!existsSync(playwrightEntry)) {
    console.error('✗ 未找到 playwright，请先在仓库根目录运行：npm install playwright');
    process.exit(1);
}

// 把仓库内的 HTML 路径转成 file:// URL（跨平台，正斜杠）。
function fileUrl(rel) {
    return 'file:///' + join(ROOT, rel).replace(/\\/g, '/');
}

const browser = await chromium.launch();

// ---- popup ----
// 宽 320 / 高 800 的视口匹配实际扩展弹窗的窄高比；fullPage 截到整张弹窗内容。
if (doPopup) {
    const page = await browser.newPage({ viewport: { width: 320, height: 800 } });
    await installChromeMock(page);
    await page.goto(fileUrl('popup.html'));
    // 等 init() 回调链跑完：色块、表单值、预览样式都已就位。
    await page.waitForLoadState('networkidle');
    // 预览时钟每秒 setInterval 重渲染，给首帧一个稳定窗口再截。
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(ROOT, 'popup-shot.png'), fullPage: true });
    console.log('✓ popup-shot.png');
    await page.close();
}

// ---- options ----
// 宽页设置页：1240px 是 options.css body max-width，1280 视口让它完整展开三栏。
// fullPage 截到中栏底部的「关于」分区，体现完整布局。
if (doOptions) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await installChromeMock(page);
    await page.goto(fileUrl('options.html'));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(ROOT, 'options-shot.png'), fullPage: true });
    console.log('✓ options-shot.png');
    await page.close();
}

await browser.close();

// 在每个页面加载前注入 chrome.storage.local / chrome.runtime 的纯内存实现，
// 让 popup.js / options.js 的 init() 在 file:// 下也能正常拉到 DEFAULTS、
// 跑完填表单 + 构建色块 + 应用预览样式的完整流程。set() 写到同一份内存，
// 与 get() 语义一致（虽然截图场景几乎不会触发 set，但 save() 会调到）。
function installChromeMock(page) {
    return page.addInitScript(() => {
        const store = {};
        window.chrome = {
            storage: {
                local: {
                    get(defaults, cb) {
                        // 合并默认值与已存值，复刻 chrome.storage.local.get 语义。
                        const merged = { ...defaults, ...store };
                        if (cb) cb(merged);
                        return Promise.resolve(merged);
                    },
                    set(obj, cb) {
                        Object.assign(store, obj);
                        if (cb) cb();
                        return Promise.resolve();
                    },
                },
            },
            runtime: {
                // popup 的「更多设置」按钮 / options 跳转用的接口；截图里不会被点，
                // 但提供 stub 防止页面加载阶段任何试探性调用抛错。
                openOptionsPage() {},
                getManifest() {
                    return { version: '3.2' };
                },
            },
        };
    });
}

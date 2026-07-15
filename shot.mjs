import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 320, height: 800 } });
await page.goto('file:///D:/coding/TypeScript/BiClock/popup.html');
await page.waitForTimeout(300);
await page.screenshot({ path: 'popup-shot.png', fullPage: true });
const info = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('label')];
  return labels.slice(0, 4).map(l => {
    const cs = getComputedStyle(l);
    const rect = l.getBoundingClientRect();
    return {
      classes: l.className || '(none)',
      display: cs.display,
      gridTemplateColumns: cs.gridTemplateColumns,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      childCount: l.children.length,
    };
  });
});
console.log(JSON.stringify(info, null, 2));
await browser.close();

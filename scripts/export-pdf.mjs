import { chromium } from 'playwright';

// Usage: node scripts/export-pdf.mjs <renderUrl> <outputPath>
const url = process.argv[2] || 'http://localhost:5173/render';
const out = process.argv[3] || 'magazine.pdf';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
// Wait until Paged.js has finished laying out the pages.
await page.waitForSelector('body[data-paged-ready="true"]', { timeout: 30000 });
await page.pdf({ path: out, format: 'A4', printBackground: true,
  margin: { top: '0', bottom: '0', left: '0', right: '0' } });
await browser.close();
console.log(`Wrote ${out}`);

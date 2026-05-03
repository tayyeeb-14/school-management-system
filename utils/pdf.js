const puppeteer = require('puppeteer');

async function generatePdfFromHtml(html, options = {}) {
  const launchOptions = (options.launchOptions || { args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const browser = await puppeteer.launch(launchOptions);
  try {
    const page = await browser.newPage();
    // set content and wait until networkidle0 so assets stabilize
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: options.format || 'A4',
      printBackground: true,
      margin: options.margin || { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' }
    });
    await page.close();
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = {
  generatePdfFromHtml
};

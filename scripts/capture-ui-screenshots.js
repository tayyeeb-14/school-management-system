const fs = require('fs');
const puppeteer = require('puppeteer');

(async () => {
  try {
    const outDir = 'screenshots/ui';
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    // Helper: capture a page in both desktop and mobile
    async function capture(path, name) {
      const url = `http://localhost:3000${path}`;

      // Desktop
      await page.setViewport({ width: 1366, height: 768 });
      await page.goto(url, { waitUntil: 'networkidle2' });
      await page.screenshot({ path: `${outDir}/${name}-desktop.png`, fullPage: true });

      // Mobile
      await page.setViewport({ width: 375, height: 812, isMobile: true });
      await page.goto(url, { waitUntil: 'networkidle2' });
      await page.screenshot({ path: `${outDir}/${name}-mobile.png`, fullPage: true });
    }

    // Home
    await capture('/', 'home');

    // Login page
    await capture('/auth/login', 'login');

    // Try to login with admin credentials to capture dashboard and teacher-shifts
    const adminUser = process.env.UI_ADMIN_USER || 'admin';
    const adminPass = process.env.UI_ADMIN_PASS || 'admin';

    // Perform login
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto('http://localhost:3000/auth/login', { waitUntil: 'networkidle2' });

    // Fill login form — try common selectors
    const selectors = [
      { user: 'input[name=username]', pass: 'input[name=password]', submit: 'button[type=submit]'},
      { user: '#username', pass: '#password', submit: 'button[type=submit]'},
      { user: 'input[name=email]', pass: 'input[name=password]', submit: 'button[type=submit]'}
    ];

    let loggedIn = false;
    for (const s of selectors) {
      try {
        await page.waitForSelector(s.user, { timeout: 2000 });
        await page.type(s.user, adminUser, { delay: 50 });
        await page.type(s.pass, adminPass, { delay: 50 });
        await Promise.all([
          page.click(s.submit),
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => {})
        ]);

        // If not redirected and still on login, maybe login failed; check URL
        const url = page.url();
        if (!url.includes('/auth/login')) {
          loggedIn = true;
          break;
        }
      } catch (err) {
        // try next selector
      }
    }

    // If logged in, capture dashboard and teacher-shifts; otherwise capture post-login state too
    if (loggedIn) {
      await capture('/admin/dashboard', 'admin-dashboard');
      await capture('/admin/teacher-shifts', 'admin-teacher-shifts');
    } else {
      console.warn('Login unsuccessful; admin pages may be redirects. Capturing admin pages as anonymous.');
      await capture('/admin/dashboard', 'admin-dashboard-anon');
      await capture('/admin/teacher-shifts', 'admin-teacher-shifts-anon');
    }

    await browser.close();
    console.log('UI screenshots saved to', outDir);
  } catch (err) {
    console.error('Error capturing UI screenshots:', err);
    process.exit(1);
  }
})();

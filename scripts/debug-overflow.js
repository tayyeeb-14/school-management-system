const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 834, height: 1112 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 400));

  const offenders = await page.evaluate(() => {
    const iw = window.innerWidth;
    const out = [];
    const all = Array.from(document.querySelectorAll('body *'));
    all.forEach(el => {
      try {
        const r = el.getBoundingClientRect();
        if (r.right > iw + 1 || r.left < -1) {
          let path = el.tagName.toLowerCase();
          if (el.id) path += `#${el.id}`;
          if (el.className && typeof el.className === 'string') {
            const cls = el.className.split(' ').slice(0,3).filter(Boolean).map(c=>'.'+c).join('');
            path += cls;
          }
          out.push({ path, left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), tag: el.tagName, classes: el.className });
        }
      } catch(e){}
    });
    out.sort((a,b)=>b.right-a.right);
    return out.slice(0,40);
  });

  console.log('Offending elements at 834x1112:');
  console.log(JSON.stringify(offenders, null, 2));
  await browser.close();
})();

(async()=>{
  const http = require('http');
  function reqp(options, body) {
    return new Promise((resolve, reject) => {
      const req = http.request(options, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve({ res, body: d }));
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  try {
    const loginPost = 'username=admin&password=admin';
    const login = await reqp({ hostname: 'localhost', port: 3000, path: '/auth/login', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(loginPost) } }, loginPost);
    const cookie = (login.res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
    const studentId = '69f6d79839a7bafdc820e085';
    const page = await reqp({ hostname: 'localhost', port: 3000, path: '/admin/students/' + studentId + '/edit', method: 'GET', headers: { Cookie: cookie } }, null);
    console.log('Edit page status', page.res.statusCode, 'len', page.body.length);
    console.log('Contains Edited Student?', page.body.includes('Edited Student'));
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();

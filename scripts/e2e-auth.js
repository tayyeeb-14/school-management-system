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
    const logout = await reqp({ hostname: 'localhost', port: 3000, path: '/auth/logout', method: 'GET', headers: { Cookie: cookie } }, null);
    console.log('Logout status', logout.res.statusCode);
    const dash = await reqp({ hostname: 'localhost', port: 3000, path: '/admin/dashboard', method: 'GET', headers: { Cookie: cookie } }, null);
    console.log('After logout, dashboard status', dash.res.statusCode);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();

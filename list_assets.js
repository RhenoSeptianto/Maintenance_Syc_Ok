(async () => {
  const loginResp = await fetch('http://localhost:4010/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123', role: 'admin' })
  });
  const login = await loginResp.json();
  const token = login.access_token;
  const resp = await fetch('http://localhost:4010/assets', { headers: { Authorization: 'Bearer ' + token } });
  const txt = await resp.text();
  console.log(txt);
})();


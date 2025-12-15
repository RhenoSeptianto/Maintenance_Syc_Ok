(async () => {
  const base = 'http://localhost:4010';
  const login = await (await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123', role: 'admin' }) })).json();
  const token = login.access_token;
  const arr = await (await fetch(base + '/assets', { headers: { Authorization: 'Bearer ' + token } })).json();
  if (!arr.length) { console.log('No assets'); return; }
  const id = arr[0].id;
  const hist = await (await fetch(base + `/assets/${id}/history`, { headers: { Authorization: 'Bearer ' + token } })).text();
  console.log(hist);
})();


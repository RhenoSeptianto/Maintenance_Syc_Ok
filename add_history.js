(async () => {
  const base = 'http://localhost:4010';
  const login = await (await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123', role: 'admin' }) })).json();
  const token = login.access_token;
  const arr = await (await fetch(base + '/assets', { headers: { Authorization: 'Bearer ' + token } })).json();
  if (!arr.length) { console.log('No assets'); return; }
  const id = arr[0].id;
  const today = new Date(); const d = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const resp = await fetch(base + `/assets/${id}/history`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ date: d, note: 'Perbaikan karena mainboard rusak', createdBy: 'admin' }) });
  console.log(await resp.text());
})();


(async () => {
  const base = 'http://localhost:4010';
  const loginRes = await fetch(base + '/auth/login', { method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username:'admin', password:'admin123', role:'admin' }) });
  const { access_token } = await loginRes.json();
  const headers = { 'Content-Type':'application/json', Authorization: 'Bearer ' + access_token };
  const now = new Date(); now.setHours(0,0,0,0);
  const body = {
    title: 'Maintenance Test Asset',
    date: now.toISOString(),
    storeName: 'Demo Store',
    storeId: 101,
    technician: 'admin',
    details: JSON.stringify({ items: [
      { hardware: 'Laptop', sn: 'SN-ABC-001', usia: 72, keterangan: 'Test unit' },
      { hardware: 'Printer', sn: 'PR-XYZ-9', usia: 24 }
    ] })
  };
  const createRes = await fetch(base + '/maintenances', { method:'POST', headers, body: JSON.stringify(body) });
  const created = await createRes.json();
  const listRes = await fetch(base + '/assets', { headers: { Authorization: 'Bearer ' + access_token } });
  const assets = await listRes.json();
  console.log(JSON.stringify({ createdId: created?.id, assetsCount: assets.length, sample: assets.slice(0,3) }, null, 2));
})();


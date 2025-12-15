(async () => {
  const base = 'http://localhost:4010';
  const loginRes = await fetch(base + '/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username:'admin', password:'admin123', role:'admin' }) });
  const j = await loginRes.json();
  const token = j.access_token; const headers = { 'Content-Type':'application/json', Authorization: 'Bearer ' + token };
  const stores = await (await fetch(base + '/stores', { headers })).json();
  const store = stores[0];
  const today = new Date(); today.setHours(0,0,0,0);
  const body = {
    title: 'Maintenance Kondisi Test',
    date: today.toISOString(),
    storeId: store?.id || null,
    storeName: store?.name || null,
    technician: 'ahmad',
    details: JSON.stringify({ items: [
      { hardware: 'Printer Thermal', sn: 'AH-PRT-9', usia: 24, kondisi: 'baik', repairDate: '2025-11-06', repairNote: 'Cek nozzle' },
      { hardware: 'PC', sn: 'AHMAD-PC-001', usia: 72, kondisi: 'tidak', repairDate: '2025-11-06', repairNote: 'Ganti thermal paste' }
    ] })
  };
  const created = await (await fetch(base + '/maintenances', { method:'POST', headers, body: JSON.stringify(body) })).json();
  const assets = await (await fetch(base + `/assets?storeId=${store?.id}`, { headers })).json();
  console.log(JSON.stringify({ store: { id: store?.id, name: store?.name }, maintenanceId: created?.id, assets: assets.map(a=>({ id:a.id, name:a.name, sn:a.serialNumber, status:a.status })) }, null, 2));
})();

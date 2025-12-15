(async () => {
  const base = 'http://localhost:4010';

  async function loginAdmin() {
    const res = await fetch(base + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123', role: 'admin' }),
    });
    const j = await res.json();
    if (!j.access_token) throw new Error('Login failed: ' + JSON.stringify(j));
    return j.access_token;
  }

  function ymd(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  const token = await loginAdmin();
  const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

  // Ensure there is a store assigned to 'ahmad'
  let stores = await (await fetch(base + '/stores', { headers })).json();
  let store = (stores || []).find((s) => (s.tsAssigned || '') === 'ahmad');
  if (!store) {
    if (stores && stores.length > 0) {
      // assign first store
      const sid = stores[0].id;
      await fetch(base + `/stores/${sid}`, { method: 'PUT', headers, body: JSON.stringify({ tsAssigned: 'ahmad' }) });
      store = await (await fetch(base + `/stores/${sid}`, { headers })).json();
    } else {
      // create a demo store
      store = await (await fetch(base + '/stores', { method: 'POST', headers, body: JSON.stringify({ code: 'DEMO', name: 'Demo Store', location: 'HQ', tsAssigned: 'ahmad' }) })).json();
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const body = {
    title: `Maintenance Test - ${store.name}`,
    date: today.toISOString(),
    storeName: store.name,
    storeId: store.id,
    technician: 'ahmad',
    details: JSON.stringify({
      items: [
        { lokasi: 'Back Office', hardware: 'PC', sn: 'AHMAD-PC-001', usia: 72, purchaseDate: ymd(new Date(today.getFullYear() - 6, today.getMonth(), 1)), repairDate: ymd(today), repairNote: 'Ganti thermal paste' },
        { lokasi: 'Counter', hardware: 'Printer Thermal', sn: 'AH-PRT-9', usia: 24, repairDate: ymd(today), repairNote: 'Roller dibersihkan' },
      ],
    }),
  };

  const created = await (await fetch(base + '/maintenances', { method: 'POST', headers, body: JSON.stringify(body) })).json();

  const assets = await (await fetch(base + `/assets?storeId=${store.id}`, { headers })).json();
  console.log(JSON.stringify({ store: { id: store.id, name: store.name }, maintenanceId: created?.id, assetsCount: assets?.length || 0, assetsSample: (assets || []).slice(0, 5) }, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });


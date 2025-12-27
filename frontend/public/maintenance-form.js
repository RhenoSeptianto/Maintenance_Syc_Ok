(() => {
  const qs = new URLSearchParams(location.search);
  const mode = (qs.get('mode')||'user').toLowerCase();
  const isAdmin = mode === 'admin';
  const editId = (function(){ try{ const n=Number(new URLSearchParams(location.search).get('editId')); return Number.isFinite(n)?n:null }catch{return null} })();

  const defaults = [
    { lokasi:'Back Office', hardware:'PC', panduan:'Cleaning PC (blower mainboard, fan processor & fan PSU), update antivirus, memastikan keyboard+mouse berfungsi, memastikan aplikasi (HSIS, LPS, Finger, Helpdesk, Pest control, dll) berfungsi, update database (store, storedb & posdb).'},
    { lokasi:'', hardware:'Monitor', panduan:'Memastikan monitor berfungsi dengan baik.'},
    { lokasi:'', hardware:'UPS', panduan:'Memastikan UPS berfungsi (backup daya).'},
    { lokasi:'', hardware:'Printer Inkjet', panduan:'Memastikan printer berfungsi dengan baik.'},
    { lokasi:'', hardware:'Finger Print', panduan:'Memastikan mesin berfungsi (tombol pad, sensor & koneksi).'},
    { lokasi:'', hardware:'PC Server', panduan:'Memastikan PC server berfungsi dengan baik.'},
    { lokasi:'', hardware:'Kabel / Wire', panduan:'Merapikan instalasi kabel jaringan & kabel power.'},
    { lokasi:'Counter', hardware:'POS 1', panduan:'Aplikasi POS berfungsi dan versi update, touch screen berfungsi.'},
    { lokasi:'', hardware:'Printer Thermal', panduan:'Memastikan hasil print struk baik.'},
    { lokasi:'', hardware:'UPS', panduan:'Memastikan UPS berfungsi (backup daya).'},
  ];

  const state = { rows: [] };

  const el = (sel) => document.querySelector(sel);
  const toYmdLocal = (dt) => {
    try {
      const d = new Date(dt instanceof Date ? dt : (dt || new Date()));
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().slice(0,10);
    } catch { return ''; }
  };

  // Sumber API backend (mobile/iframe friendly)
  // HTML ini bisa dibuka langsung tanpa bundler, jadi definisikan helper di sini.
  function getApiBase(){
    try{
      // 1) Izinkan override via localStorage (dipakai oleh halaman Next.js lain)
      let base = (localStorage.getItem('apiBase') || '').replace(/\/$/, '');
      // 2) Jika kosong atau menunjuk ke localhost generik, turunkan dari lokasi saat ini
      if (!base || /localhost(:\d+)?$/i.test(base)){
        const { protocol, hostname } = window.location || {};
        if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1'){
          base = `${protocol}//${hostname}:4010`;
        }
      }
      // 3) Fallback ke default pengembangan
      if (!base) base = 'http://localhost:4010';
      return base.replace(/\/$/, '');
    }catch{ return 'http://localhost:4010' }
  }
  try { if (typeof window !== 'undefined' && !('getApiBase' in window)) { window.getApiBase = getApiBase } } catch {}

  // Helper untuk ambil angka positif dari querystring
  function getQsPositiveInt(key){
    try{
      const q = new URLSearchParams(location.search);
      const raw = q.get(key);
      if (raw == null || raw === '') return null;
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) return null;
      return n;
    }catch{ return null }
  }
  const tbody = el('#rows');
  const isStatic = !!(tbody && tbody.dataset && tbody.dataset.mode === 'static');
  const btnAdd = el('#btn-add');
  const btnSubmit = el('#btn-submit');
  const btnEdit = el('#btn-edit');
  const btnBack = el('#btn-back');
  const inputStore = el('#store');
  const inputTanggal = el('#tanggal');
  const inputTeknisi = el('#teknisi');
  const logoImg = el('.form-logo');
  const secretInput = (function(){
    let x = document.getElementById('secret_import');
    if (!x) {
      x = document.createElement('input');
      x.type = 'file'; x.accept = '.xlsx,.xls,.json'; x.id = 'secret_import';
      x.style.display = 'none'; document.body.appendChild(x);
    }
    return x;
  })();
  const ttdCanvasTs = el('#ttd_ts');
  const ttdCanvasStore = el('#ttd_store');
  const btnClearSignTs = el('#btn-clear-sign-ts');
  const btnClearSignStore = el('#btn-clear-sign-store');
  const ttdNameTs = el('#ttd_ts_name');
  const ttdNameStore = el('#ttd_store_name');
  const ttdFileTs = el('#ttd_ts_file');
  const ttdFileStore = el('#ttd_store_file');
  let ttdTsDrawn = false, ttdStoreDrawn = false;
  let editMode = false;
  let existingSignature = null; // jika edit, pakai tanda tangan lama

  // Upgrade tabel: tambah kolom Usia & History (jika belum ada) dan sisipkan field per baris
  function injectExtraFields(){
    try{
      tbody.querySelectorAll('tr').forEach((tr)=>{
        const tds = tr.querySelectorAll('td');
        if (!tds || tds.length < 7) return;
        // Pastikan cell keterangan terakhir diberi class
        const last = tds[tds.length-1]; if (last) last.classList.add('col-ket');
        // Jika sudah ada kolom usia, lewati
        if (tr.querySelector('.col-usia')) return;
        const usiaTd = document.createElement('td'); usiaTd.className='col-usia';
        usiaTd.innerHTML = `
          <div class="extra-row">
            <label>Usia (tahun)</label>
            <input type="number" class="age-years w-28" min="0" max="50" step="1" />
          </div>
          <div class="extra-row">
            <label>Tgl Pembelian</label>
            <input type="date" class="purchase-date w-28" />
          </div>`;
        const histTd = document.createElement('td'); histTd.className='col-history';
        histTd.innerHTML = `
          <div class="extra-row">
            <label>Tgl Perbaikan</label>
            <input type="date" class="repair-date w-28" />
          </div>
          <div class="extra-row">
            <label>Catatan</label>
            <input type="text" class="repair-note w-44" placeholder="mis. perbaikan karena mainboard rusak" />
          </div>`;
        // Sisipkan sebelum cell keterangan (terakhir)
        tr.insertBefore(usiaTd, last);
        tr.insertBefore(histTd, last);
      })
    }catch{}
  }

  // Jika sedang mode edit, sembunyikan area TTD sedini mungkin
  // TTD harus bisa diperbaiki saat edit, jadi jangan sembunyikan
  try{ if (editId){ const s = document.querySelector('.sig-grid'); if (s) s.style.display = '' } }catch{}
  // Pertama kali load, sisipkan extra fields
  try{ injectExtraFields() }catch{}
  // SN input enhancement (size/placeholder/normalize)
  function enhanceSnInputs(){
    try{
      tbody.querySelectorAll('tr').forEach((tr)=>{
        const inp = tr.querySelector('td:nth-child(4) input[type="text"]');
        if (!inp) return;
        if (!inp.dataset._snEnhanced){
          inp.dataset._snEnhanced = '1';
          if (!inp.placeholder || /Merk/.test(inp.placeholder)) inp.placeholder = 'Merk / SN (scan/ketik)';
          inp.addEventListener('blur',()=>{
            const v = String(inp.value||'').trim().replace(/\s+/g,' ').toUpperCase();
            inp.value = v;
          });
        }
      })
    }catch{}
  }
  try{ enhanceSnInputs() }catch{}
  try{
    const mo = new MutationObserver(()=> enhanceSnInputs());
    mo.observe(tbody, { childList:true, subtree:true });
  }catch{}

  // Helper: pilih store secara andal (dengan retry singkat untuk kasus mobile lambat)
  function selectStoreReliable(by){
    const maxTry = 10; // ~1 detik total
    let count = 0;
    return new Promise(resolve => {
      const tick = () => {
        if (!inputStore) return resolve(false);
        let picked = false;
        try{
          if (by && by.id != null){
            const opt = Array.from(inputStore.options).find(o => Number(o.value) === Number(by.id));
            if (opt){ inputStore.value = String(by.id); inputStore.disabled = true; picked = true; }
          } else if (by && by.name){
            const nameLc = String(by.name).toLowerCase();
            const opt = Array.from(inputStore.options).find(o => (o.textContent||'').toLowerCase().includes(nameLc));
            if (opt){ inputStore.value = opt.value; inputStore.disabled = true; picked = true; }
          }
          if (picked){ inputStore.dispatchEvent(new Event('change')); return resolve(true); }
        }catch{}
        if (count++ < maxTry) { setTimeout(tick, 100); } else { resolve(false); }
      };
      tick();
    });
  }

  // Prefill seketika dari query (tanpa menunggu API), supaya web & HP konsisten
  (function prefillImmediate(){
    try{
      const q = new URLSearchParams(location.search);
      const qsStoreId = getQsPositiveInt('storeId');
      const qsStoreName = q.get('storeName');
      const qsDate = q.get('date');
      if (inputTanggal && qsDate && /^\d{4}-\d{2}-\d{2}$/.test(qsDate)){
        inputTanggal.value = qsDate; inputTanggal.disabled = true;
      }
      if (inputStore){
        // Prefill langsung dari query agar tidak tergantung API
        if (!inputStore.value && (qsStoreId || qsStoreName)){
          if (!qsStoreId && qsStoreName){
            // Tulis nama store ke opsi placeholder (index 0) supaya tidak kembali ke "Pilih Store"
            const first = inputStore.options && inputStore.options[0];
            if (first && first.value === ''){ first.textContent = qsStoreName; inputStore.selectedIndex = 0; }
            else {
              const opt = document.createElement('option'); opt.value=''; opt.textContent = qsStoreName; inputStore.insertBefore(opt, inputStore.firstChild); inputStore.selectedIndex = 0;
            }
            inputStore.disabled = true;
          } else {
            const tmp = document.createElement('option');
            tmp.value = String(qsStoreId);
            tmp.textContent = qsStoreName || `Store ${qsStoreId}`;
            inputStore.appendChild(tmp);
            inputStore.value = tmp.value; inputStore.disabled = true;
          }
          inputStore.dispatchEvent(new Event('change'));
        }
      }
    }catch{}
  })();

  // Jika mode edit (perbaikan): muat data laporan dan prefill isian
  (async function prefillFromExisting(){
    try{
      if (!editId) return;
      const apiBase = getApiBase();
      const headers = { 'Content-Type':'application/json' };
      const token = localStorage.getItem('token'); if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${apiBase}/maintenances/${editId}`, { headers });
      if (!res.ok) return;
      const m = await res.json();
      // Pastikan blok TTD muncul pada mode edit agar bisa diperbaiki
      try{ const sigWrap = document.querySelector('.sig-grid'); if (sigWrap) sigWrap.style.display = '' }catch{}
      // Prefill store name
      try{
        if (inputStore){
          const name = m.storeName || '';
          const opt = Array.from(inputStore.options||[]).find(o => (o.textContent||'').trim()===name);
          if (opt){ inputStore.value = opt.value; inputStore.disabled = true }
          else {
            const first = inputStore.options && inputStore.options[0];
            if (first && first.value===''){ first.textContent = name; inputStore.selectedIndex=0; inputStore.disabled=true }
          }
        }
      }catch{}
      // Prefill teknisi
      try{ if (inputTeknisi && m.technician) { inputTeknisi.value = m.technician } }catch{}
      // Prefill items ke tabel statis: isi SN/checkbox/keterangan sesuai urutan
      try{
        let items = [];
        let signature = null;
        try { const d = JSON.parse(String(m.details||'{}')); items = d.items||[]; signature = d.signature; } catch {}
        existingSignature = signature || null;
        const trs = Array.from(tbody.querySelectorAll('tr'));
        for (let i=0;i<trs.length;i++){
          const it = items[i]; if (!it) continue;
          const tr = trs[i];
          const sn = tr.querySelector('td:nth-child(4) input, .sn'); if (sn) sn.value = it.sn||'';
          const baik = tr.querySelector('.k-baik') || tr.querySelector('input[type="checkbox"]:nth-of-type(1)');
          const tdk = tr.querySelector('.k-tidak') || tr.querySelector('input[type="checkbox"]:nth-of-type(2)');
          if (String((it.kondisi||'')).toLowerCase()==='baik'){ if(baik) baik.checked=true; if(tdk) tdk.checked=false }
          else if (String((it.kondisi||'')).toLowerCase().includes('tidak')){ if(tdk) tdk.checked=true; if(baik) baik.checked=false }
          const ket = tr.querySelector('.col-ket input, .ket'); if (ket) ket.value = it.keterangan||'';
          // Prefill extra fields
          try{
            const ageEl = tr.querySelector('.col-usia .age-years');
            const pdateEl = tr.querySelector('.col-usia .purchase-date');
            const rdateEl = tr.querySelector('.col-history .repair-date');
            const rnoteEl = tr.querySelector('.col-history .repair-note');
            if (typeof it.usia === 'number' && ageEl) ageEl.value = String(Math.floor(it.usia/12));
            if (it.purchaseDate && pdateEl) pdateEl.value = String(it.purchaseDate).slice(0,10);
            if (it.repairDate && rdateEl) rdateEl.value = String(it.repairDate).slice(0,10);
            if (it.repairNote && rnoteEl) rnoteEl.value = String(it.repairNote);
          }catch{}
        }
      }catch{}
    }catch{}
  })();

  // Ambil user login dari localStorage (untuk mode user)
  const currentUser = (()=>{ try { return JSON.parse(localStorage.getItem('user')||'{}') } catch(e){ return {} } })();
  const currentUsername = currentUser?.username || '';
  const currentName = (currentUser && (currentUser.name || currentUser.fullName)) || '';

  // Pada mode user: sembunyikan tombol Edit dan prefilling teknisi
  if (!isAdmin) {
    if (btnEdit) btnEdit.style.display = 'none';
    if (inputTeknisi) {
      inputTeknisi.value = (currentName || currentUsername || inputTeknisi.value || '');
      inputTeknisi.readOnly = true;
    }
    // Prefill nama TS pada kotak tanda tangan
    if (ttdNameTs && !ttdNameTs.value) {
      ttdNameTs.value = (currentName || currentUsername || '');
    }
  }

  function rowTemplate(idx, r) {
    const canEdit = (editMode || isAdmin);
    return `<tr data-idx="${idx}">
      <td>${idx+1}</td>
      <td>${canEdit ? `<input class="w-40" value="${r.lokasi||''}" placeholder="Lokasi">` : (r.lokasi||'')}</td>
      <td>${canEdit ? `<input class="w-40" value="${r.hardware||''}" placeholder="Hardware">` : (r.hardware||'')}</td>
      <td><input class="sn w-56" placeholder="Merk & SN"></td>
      <td>${canEdit ? `<textarea class="w-80 h-20">${r.panduan||''}</textarea>` : `<div class="sr">${r.panduan||''}</div>`}</td>
      <td class="whitespace-nowrap"><label class="mr-2"><input type="checkbox" class="k-baik"> Baik</label><label><input type="checkbox" class="k-tidak"> Tidak Baik</label></td>
      <td><input class="ket w-56" placeholder="Keterangan"></td>
      ${(canEdit ? `<td><button type="button" class="btn btn-del">Hapus</button></td>` : '<td></td>')}
    </tr>`;
  }

  function bindRowInteractions(){
    // exclusive condition per row (both static and dynamic)
    tbody.querySelectorAll('tr').forEach(tr => {
      const baik = tr.querySelector('.k-baik');
      const td = tr.querySelector('.k-tidak');
      if (baik && td){
        baik.addEventListener('change',()=>{ if (baik.checked) td.checked=false; });
        td.addEventListener('change',()=>{ if (td.checked) baik.checked=false; });
      } else {
        // fallback: first checkbox = baik, second = tidak
        const cbs = tr.querySelectorAll('input[type="checkbox"]');
        if (cbs.length>=2){
          const b=cbs[0], t=cbs[1];
          b.addEventListener('change',()=>{ if (b.checked) t.checked=false });
          t.addEventListener('change',()=>{ if (t.checked) b.checked=false });
        }
      }
      const del = tr.querySelector('.btn-del');
      if (del) del.addEventListener('click',()=>{ const idx = Number(tr.dataset.idx); state.rows.splice(idx,1); render(); });
    });

    // Tambah tombol kamera untuk scan SN di setiap baris
    attachScanButtons();
  }

  function render() {
    if (isStatic) { bindRowInteractions(); return }
    tbody.innerHTML = state.rows.map((r,i)=>rowTemplate(i,r)).join('');
    bindRowInteractions();
  }

  // ====== Fitur Rahasia: Klik logo 5x untuk Import dari Excel/JSON ======
  ;(function initSecretImport(){
    if (!logoImg || !secretInput) return;
    let clicks = 0; let timer = null;
    logoImg.style.cursor = 'pointer';
    logoImg.title = '';
    const reset = ()=>{ clicks = 0; if (timer) { clearTimeout(timer); timer = null; } };
    logoImg.addEventListener('click', ()=>{
      clicks++;
      if (!timer) timer = setTimeout(reset, 1500);
      if (clicks >= 5){ reset(); secretInput.click(); }
    });
    secretInput.addEventListener('change', async ()=>{
      const f = secretInput.files && secretInput.files[0];
      if (!f) return;
      try {
        if (/\.json$/i.test(f.name)){
          const text = await f.text();
          const data = JSON.parse(text);
          applyImportedData(data);
          alert('Data form berhasil diimpor (JSON).');
        } else if (/\.xlsx?$/i.test(f.name)){
          const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
          const ab = await f.arrayBuffer();
          const wb = XLSX.read(ab, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
          const data = parseExcelRows(rows);
          applyImportedData(data);
          alert('Data form berhasil diimpor (Excel).');
        } else {
          alert('Format tidak didukung. Gunakan .xlsx atau .json');
        }
      } catch (e) {
        console.error(e);
        alert('Gagal mengimpor file. Pastikan format sesuai.');
      } finally { secretInput.value=''; }
    });
  })();

  function parseExcelRows(rows){
    // Cari meta di 8 baris pertama: [Key, Value]
    let storeName='', date='', technician='';
    for (let i=0;i<Math.min(8, rows.length); i++){
      const r = rows[i]||[]; const k = String(r[0]||'').toLowerCase();
      const v = String(r[1]||'').trim();
      if (k.includes('store')) storeName = v;
      else if (k.includes('tanggal')) date = v;
      else if (k.includes('teknisi') || k.includes('technician')) technician = v;
    }
    // Temukan header tabel
    let hIdx = rows.findIndex(r => Array.isArray(r) && r.some(c=>String(c||'').toLowerCase()==='merk & sn'));
    if (hIdx < 0) hIdx = rows.findIndex(r => Array.isArray(r) && r.some(c=>String(c||'').toLowerCase().includes('merk')));
    // Petakan kolom berdasar header
    const header = (rows[hIdx] || []).map(c => String(c||'').trim().toLowerCase());
    const findCol = (matcher) => header.findIndex(h => matcher(h));
    const colNo = findCol(h => h === 'no');
    const colLokasi = findCol(h => h.includes('lokasi'));
    const colHw = findCol(h => h.includes('hardware'));
    const colSn = findCol(h => h.includes('merk') || h.includes('sn'));
    const colPanduan = findCol(h => h.includes('panduan'));
    const colKondisi = findCol(h => h.includes('kondisi'));
    const colUsia = findCol(h => h.startsWith('usia'));
    const colTglBeli = findCol(h => h.includes('pembelian'));
    const colTglPerbaikan = findCol(h => h.includes('perbaikan'));
    const colCatatan = findCol(h => h.includes('catatan'));
    const colKet = findCol(h => h.includes('keterangan'));
    const items = [];
    for (let i=hIdx+1; i<rows.length; i++){
      const r = rows[i]||[]; if (!r.length) continue;
      const pick = (idx) => (idx>=0 && idx<r.length) ? r[idx] : '';
      const no = pick(colNo);
      const lokasi = pick(colLokasi);
      const hardware = pick(colHw);
      const sn = pick(colSn);
      const panduan = pick(colPanduan);
      const kondisiRaw = pick(colKondisi);
      const kondisi=(String(kondisiRaw||'').toLowerCase().includes('tidak')? 'tidak' : (String(kondisiRaw||'').toLowerCase().includes('baik')? 'baik' : ''));
      const usia = pick(colUsia);
      const purchaseDate = pick(colTglBeli);
      const repairDate = pick(colTglPerbaikan);
      const repairNote = pick(colCatatan);
      const keterangan = pick(colKet);
      if (no==null && !lokasi && !hardware && !sn && !keterangan && !purchaseDate && !repairDate) continue;
      items.push({ no, lokasi, hardware, sn, panduan, kondisi, keterangan, usia, purchaseDate, repairDate, repairNote });
    }
    return { storeName, date, technician, items };
  }

  function applyImportedData(data){
    try{
      const storeName = data?.storeName || data?.store || '';
      const date = data?.date || data?.tanggal || '';
      const technician = data?.technician || data?.teknisi || '';
      // set meta
      if (inputTeknisi && technician) inputTeknisi.value = technician;
      if (inputTanggal && date && !inputTanggal.disabled) inputTanggal.value = String(date).slice(0,10);
      if (inputStore && storeName){
        const opts = Array.from(inputStore.options||[]);
        const found = opts.find(o => (o.textContent||'').toLowerCase().includes(String(storeName).toLowerCase()));
        if (found) inputStore.value = found.value;
      }
      // apply items ke tabel static berdasar urutan
      const rows = tbody.querySelectorAll('tr');
      for(let i=0;i<rows.length;i++){
        const it = (data.items||[])[i];
        if (!it) continue;
        const tr = rows[i];
        // SN & Keterangan
        (tr.querySelector('.sn') || tr.querySelector('td:nth-child(4) input'))?.setAttribute('value','');
        const snEl = tr.querySelector('.sn') || tr.querySelector('td:nth-child(4) input'); if (snEl) snEl.value = it.sn||'';
        const ketEl = tr.querySelector('.col-ket input') || tr.querySelector('.ket') || tr.querySelector('td:last-child input'); if (ketEl) ketEl.value = it.keterangan||'';
        // Usia & Tgl Pembelian
        const usiaEl = tr.querySelector('.col-usia .age-years');
        const pdateEl = tr.querySelector('.col-usia .purchase-date');
        const rdateEl = tr.querySelector('.col-history .repair-date');
        const rnoteEl = tr.querySelector('.col-history .repair-note');
        const parseUsia = (v) => {
          const s = String(v||'').toLowerCase();
          if (!s) return null;
          const nums = (s.match(/\d+/g)||[]).map(n=>Number(n));
          if (s.includes('th') || s.includes('tahun')){
            const th = nums[0] ?? null;
            return Number.isFinite(th) ? th : null;
          }
          if (nums.length){ return Math.floor(nums[0]/12); }
          return null;
        };
        const usiaYears = parseUsia(it.usia);
        if (usiaEl && usiaYears!=null) usiaEl.value = String(usiaYears);
        if (pdateEl && it.purchaseDate) pdateEl.value = String(it.purchaseDate).slice(0,10);
        if (rdateEl && it.repairDate) rdateEl.value = String(it.repairDate).slice(0,10);
        if (rnoteEl && it.repairNote) rnoteEl.value = String(it.repairNote);
        // Kondisi
        const cbs = tr.querySelectorAll('td:nth-child(6) input[type="checkbox"]');
        const baik = (String(it.kondisi||'').toLowerCase()==='baik');
        const tidak = (String(it.kondisi||'').toLowerCase().includes('tidak'));
        if (cbs && cbs.length>=2){ cbs[0].checked = !!baik; cbs[1].checked = !!tidak; }
      }
    }catch{}
  }

  // =============== Fitur Scan Barcode (Merk & SN) ===============
  let scanner = { stream: null, running: false, targetInput: null };

  function ensureScanOverlay(){
    if (document.getElementById('scan-overlay')) return;
    const wrap = document.createElement('div');
    wrap.id = 'scan-overlay';
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:none;align-items:center;justify-content:center;z-index:9999;';
    wrap.innerHTML = `
      <div style="background:#fff;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.2);width:90%;max-width:520px;padding:16px;">
        <h3 style="margin:0 0 8px 0;font-weight:600;">Scan Kode (SN)</h3>
        <video id="scan-video" playsinline style="width:100%;height:auto;background:#000;border-radius:6px"></video>
        <div id="scan-status" style="margin-top:8px;color:#555;font-size:12px">Membuka kamera...</div>
        <div style="margin-top:10px;display:flex;gap:8px;justify-content:flex-end;">
          <button id="scan-close" class="btn" style="padding:6px 10px;border-radius:4px;border:1px solid #ccc;background:#f3f4f6;">Tutup</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    document.getElementById('scan-close').addEventListener('click', stopScanner);
  }

  async function startScannerFor(input){
    ensureScanOverlay();
    const overlay = document.getElementById('scan-overlay');
    const video = document.getElementById('scan-video');
    const status = document.getElementById('scan-status');
    overlay.style.display = 'flex';
    scanner.targetInput = input;
    scanner.running = true;
    status.textContent = 'Meminta izin kamera...';
    try{
      // Prefer back camera
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      scanner.stream = stream; video.srcObject = stream; await video.play();
      status.textContent = 'Memindai... arahkan kamera ke barcode/QR';

      let Detector = window.BarcodeDetector;
      if (!Detector) {
        // coba load polyfill ringan jika tersedia
        try {
          await import('https://cdn.jsdelivr.net/npm/@undecaf/barcode-detector-polyfill@2.4.5/dist/barcode-detector.umd.js');
          Detector = window.BarcodeDetector;
        }catch{}
      }
      let detector = null;
      if (Detector) {
        try{ detector = new Detector({ formats: ['code_128','code_39','ean_13','ean_8','qr_code','upc_a','upc_e'] }) }catch{ detector = new Detector() }
      }

      const scanLoop = async ()=>{
        if (!scanner.running) return;
        try{
          if (detector) {
            const codes = await detector.detect(video);
            if (codes && codes.length) {
              const val = (codes[0].rawValue || '').trim();
              if (val) {
                scanner.targetInput.value = val;
                stopScanner();
                return;
              }
            }
          }
        }catch{}
        requestAnimationFrame(scanLoop);
      };
      requestAnimationFrame(scanLoop);
    }catch(e){
      status.textContent = 'Gagal membuka kamera. Periksa izin perangkat.';
    }
  }

  function stopScanner(){
    scanner.running = false;
    try{ const tracks = scanner.stream ? scanner.stream.getTracks() : []; tracks.forEach(t=>t.stop()) }catch{}
    scanner.stream = null; scanner.targetInput = null;
    const overlay = document.getElementById('scan-overlay'); if (overlay) overlay.style.display = 'none';
  }

  function attachScanButtons(){
    tbody.querySelectorAll('tr').forEach(tr => {
      // cari input SN: prioritas class .sn, fallback kolom ke-4
      let sn = tr.querySelector('input.sn') || tr.querySelector('td:nth-child(4) input');
      if (!sn) return;
      if (sn.dataset.scanEnhanced === '1') return; // sudah diberi tombol

      // Jika struktur fleksibel (punya parent container), bungkus agar tombol sejajar
      if (sn.parentElement && sn.parentElement.tagName.toLowerCase() === 'td'){
        // Bungkus input + tombol dalam flex agar benar-benar sejajar
        const td = sn.parentElement;
        const flex = document.createElement('div');
        flex.style.cssText = 'display:flex;align-items:center;gap:6px;width:100%';
        td.replaceChild(flex, sn);
        sn.style.flex = '1';
        sn.style.width = '100%';
        flex.appendChild(sn);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.title = 'Scan SN dari kamera';
        btn.textContent = '📷';
        btn.className = 'sn-scan-btn';
        btn.style.cssText = 'border:1px solid #cbd5e1;background:#f8fafc;border-radius:6px;padding:4px 8px;cursor:pointer;white-space:nowrap;';
        btn.addEventListener('click', ()=> startScannerFor(sn));
        flex.appendChild(btn);
      } else {
        // fallback: buat wrap flex
        const wrap = document.createElement('div');
        wrap.className = 'sn-wrap';
        wrap.style.display = 'flex';
        wrap.style.gap = '6px';
        wrap.style.alignItems = 'center';
        sn.parentElement.replaceChild(wrap, sn);
        sn.style.flex = '1';
        wrap.appendChild(sn);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.title = 'Scan SN dari kamera';
        btn.textContent = '📷';
        btn.style.cssText = 'border:1px solid #cbd5e1;background:#f8fafc;border-radius:6px;padding:6px 8px;cursor:pointer;';
        btn.addEventListener('click', ()=> startScannerFor(sn));
        wrap.appendChild(btn);
      }
      sn.dataset.scanEnhanced = '1';
    })
  }

  function addRow(r){ state.rows.push({ ...r, _custom: r && r._custom }); render(); }

  // init
  if (!isStatic){ state.rows = defaults.map(r=>({ ...r })); }
  render();
  if (!isAdmin || isStatic) btnAdd.style.display='none';

  btnAdd.addEventListener('click',()=> addRow({ lokasi:'', hardware:'', panduan:'', _custom:true }));
  function toggleStaticEdit(on){
    const wrap = document.querySelector('.wrapper');
    if (wrap) wrap.classList.toggle('editing', !!on)
    tbody.querySelectorAll('tr').forEach(tr => {
      const tds = tr.querySelectorAll('td')
      const tdLok = tds[1], tdHw = tds[2], tdPanduan = tds[4]
      if (on) {
        if (tdLok && !tdLok.querySelector('input,textarea')){
          const v = (tdLok.innerText||'').trim(); tdLok.innerHTML = `<input class="w-40" value="${v}" placeholder="Lokasi">`
        }
        if (tdHw && !tdHw.querySelector('input,textarea')){
          const v = (tdHw.innerText||'').trim(); tdHw.innerHTML = `<input class="w-40" value="${v}" placeholder="Hardware">`
        }
        if (tdPanduan && !tdPanduan.querySelector('textarea')){
          const v = (tdPanduan.innerText||'').trim(); tdPanduan.innerHTML = `<textarea class="w-80 h-20">${v}</textarea>`
        }
      } else {
        if (tdLok){ const inp = tdLok.querySelector('input,textarea'); if (inp) tdLok.textContent = inp.value }
        if (tdHw){ const inp = tdHw.querySelector('input,textarea'); if (inp) tdHw.textContent = inp.value }
        if (tdPanduan){ const ta = tdPanduan.querySelector('textarea'); if (ta) tdPanduan.textContent = ta.value }
      }
    })
  }

  if (btnEdit) btnEdit.addEventListener('click',()=>{
    editMode=!editMode; btnEdit.textContent = editMode? 'Matikan Edit' : 'Mode Edit'
    if (isStatic) { toggleStaticEdit(editMode) }
    else { if (editMode) btnAdd.style.display='inline-block'; else if (!isAdmin) btnAdd.style.display='none'; render(); }
  })
  if (btnBack) btnBack.addEventListener('click',()=>{ const target = isAdmin? '/admin/dashboard' : '/user/dashboard'; try{ window.parent.location.href = target }catch(e){ window.location.href = target } })

  btnSubmit.addEventListener('click',()=>{
    const items = Array.from(tbody.querySelectorAll('tr')).map((tr,i)=>{
      const get = (sel)=>{ const x=tr.querySelector(sel); return x? (x.value||'') : '' };
      if (isStatic){
        const tds = tr.querySelectorAll('td');
        const lokasi = tds[1] ? (tds[1].querySelector('input,textarea') ? get('td:nth-child(2) input,td:nth-child(2) textarea') : (tds[1].innerText||'').trim()) : '';
        const hardware = tds[2] ? (tds[2].querySelector('input,textarea') ? get('td:nth-child(3) input,td:nth-child(3) textarea') : (tds[2].innerText||'').trim()) : '';
        const sn = get('td:nth-child(4) input');
        const panduan = tds[4] ? (tds[4].querySelector('textarea,input') ? get('td:nth-child(5) textarea,td:nth-child(5) input') : (tds[4].innerText||'').trim()) : '';
        const cbs = tr.querySelectorAll('input[type="checkbox"]');
        const baik = cbs[0]?.checked || false;
        const tidak = cbs[1]?.checked || false;
        const kondisi = baik? 'baik' : (tidak? 'tidak' : '');
        const ketInput = tr.querySelector('.col-ket input') || tr.querySelector('.ket') || tr.querySelector('td:last-child input');
        const ket = ketInput ? (ketInput.value||'') : get('td:last-child input');
        return { no:i+1, lokasi, hardware, sn, panduan, kondisi, keterangan:ket };
      } else {
        const r = state.rows[i];
        const lokasi = r._custom ? get('td:nth-child(2) input') : (r.lokasi||'');
        const hardware = r._custom ? get('td:nth-child(3) input') : (r.hardware||'');
        const panduan = r._custom ? get('td:nth-child(5) textarea') : (r.panduan||'');
        const sn = get('.sn');
        const ket = get('.ket');
        const baik = tr.querySelector('.k-baik')?.checked || false;
        const tidak = tr.querySelector('.k-tidak')?.checked || false;
        const kondisi = baik? 'baik' : (tidak? 'tidak' : '');
        return { no:i+1, lokasi, hardware, sn, panduan, kondisi, keterangan:ket };
      }
    });
    // Validasi: cegah SN duplikat dalam satu form
    try{
      const snMap = new Map(); // sn(lowercase) -> array nomor baris
      for (const it of items){
        const raw = String(it?.sn || '').trim();
        if (!raw) continue;
        const key = raw.toLowerCase();
        const arr = snMap.get(key) || [];
        arr.push(it.no || arr.length + 1);
        snMap.set(key, arr);
      }
      const dup = [];
      for (const [sn, rows] of snMap.entries()){
        if (rows.length > 1){
          dup.push(`${sn} (baris ${rows.join(', ')})`);
        }
      }
      if (dup.length > 0){
        alert('Terdapat SN yang sama pada form ini:\n' + dup.join('\n') + '\n\nPeriksa kembali dan pastikan setiap asset punya SN unik.');
        return;
      }
    }catch{}
    const storeValue = String(inputStore.value||'');
    const storeLabel = (function(){
      try {
        const sel = inputStore && inputStore.options ? inputStore.options[inputStore.selectedIndex] : null;
        let label = (sel && sel.textContent) || storeValue || '';
        // Fallback kuat untuk kasus Perbaiki: ambil dari ?storeName jika label masih placeholder
        if (!label || /Pilih Store/i.test(label)){
          const q = new URLSearchParams(location.search); const sn = (q.get('storeName')||'').trim(); if (sn) label = sn;
        }
        return label;
      } catch { return storeValue }
    })();
    const qsub = new URLSearchParams(location.search);
    const qsDate = (()=>{ try { const x=qsub.get('date'); return (x&&/^\d{4}-\d{2}-\d{2}$/.test(x))?x:'' } catch{return ''} })();
    const dateValue = inputTanggal.value || qsDate || '';
    // Validasi wajib: store, tanggal, dua tanda tangan & nama
    if (!storeLabel || /Pilih Store/i.test(storeLabel)) { alert('Pilih nama store terlebih dahulu'); return }
    if (!dateValue) { alert('Isi tanggal maintenance'); return }
    let signatureTs = null, signatureStore = null;
    if (!ttdTsDrawn || !ttdStoreDrawn) { alert('Tanda tangan TS dan Store wajib diisi'); return }
    if (!(ttdNameTs?.value||'').trim() || !(ttdNameStore?.value||'').trim()) { alert('Nama pada masing-masing TTD wajib diisi'); return }
    // Export signature as PNG to preserve transparency and avoid black background
    // JPEG on transparent canvas often turns background black in PDFs.
    try { signatureTs = ttdCanvasTs.toDataURL('image/png') } catch { signatureTs = ttdCanvasTs.toDataURL() }
    try { signatureStore = ttdCanvasStore.toDataURL('image/png') } catch { signatureStore = ttdCanvasStore.toDataURL() }

    const payload = {
      storeName: storeLabel,
      date: dateValue,
      technician: inputTeknisi.value,
      items,
      signature: { ts: signatureTs, store: signatureStore, tsName: ttdNameTs.value||'', storeName: ttdNameStore.value||'' },
    };
    // Augment items with extra fields (usia/perbaikan)
    try{
      const trs = Array.from(tbody.querySelectorAll('tr'));
      const maintYmd = (inputTanggal?.value||'');
      payload.items = (payload.items||[]).map((it, idx)=>{
        const tr = trs[idx]; if (!tr) return it;
        const usiaCell = tr.querySelector('.col-usia');
        const histCell = tr.querySelector('.col-history');
        const ageYearsRaw = (usiaCell?.querySelector('.age-years')?.value||'').trim();
        const pdate = (usiaCell?.querySelector('.purchase-date')?.value||'').trim();
        const rdate = (histCell?.querySelector('.repair-date')?.value||'').trim();
        const rnote = (histCell?.querySelector('.repair-note')?.value||'').trim();
        let usia = it.usia;
        if (ageYearsRaw !== '') {
          const ageYears = Number(ageYearsRaw);
          if (Number.isFinite(ageYears) && ageYears>=0) usia = ageYears*12;
        }
        if ((usia==null || !Number.isFinite(usia)) && pdate && maintYmd){
          try{
            const p = new Date(pdate+'T00:00:00');
            const m = new Date(maintYmd+'T00:00:00');
            usia = (m.getFullYear()-p.getFullYear())*12 + (m.getMonth()-p.getMonth());
            if (!Number.isFinite(usia) || usia<0) usia = 0;
          }catch{}
        }
        if (Number.isFinite(usia) && usia>0) it.usia = usia;
        else delete it.usia;
        if (pdate) it.purchaseDate = pdate;
        if (rdate) it.repairDate = rdate;
        if (rnote) it.repairNote = rnote;
        return it;
      });
    }catch{}
    // Jika di-embed (iframe), teruskan ke parent. Jika tidak, kirim langsung ke API.
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type:'maintenance_form_submit', mode, payload }, '*');
    } else {
      const user = (()=>{ try { return JSON.parse(localStorage.getItem('user')||'{}') } catch(e){ return {} } })();
      const apiBase = getApiBase();
      const sel = inputStore ? inputStore.options[inputStore.selectedIndex] : null
      const body = {
        title: `Form Maintenance - ${payload.storeName}`,
        details: JSON.stringify({ store: payload.storeName, teknisi: payload.technician || user?.username, tanggal: payload.date, items: payload.items, signature: payload.signature }),
        // Kirim ISO 8601 agar lolos validasi backend; nilai akhir akan dinormalisasi server saat ada scheduleId
        date: `${payload.date}T00:00:00.000Z`,
        storeName: payload.storeName,
        storeId: (function(){ try{ const n = Number(inputStore && inputStore.value); return (Number.isFinite(n) && n>0) ? n : undefined }catch{ return undefined } })(),
        technician: payload.technician || user?.name || user?.username,
        submittedBy: user?.username,
        scheduleId: (function(){ try{ const q = new URLSearchParams(location.search); const x=q.get('scheduleId'); const n=Number(x); return Number.isFinite(n) ? n : undefined }catch{ return undefined } })(),
      };
      const headers = { 'Content-Type': 'application/json' };
      const token = localStorage.getItem('token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const doPost = () => fetch(`${apiBase}/maintenances`,{ method:'POST', headers, body: JSON.stringify(body) })
        .then(async r=>{ if(!r.ok){ let t=''; try{ t=await r.text() }catch{}; throw new Error(`HTTP ${r.status} ${t}`) } return r.json() })
        .then(async (saved)=>{
          try{
            const q = new URLSearchParams(location.search);
            if (q.get('autoApprove')==='1' && saved && saved.id){
              const token = localStorage.getItem('token'); const hdr = { 'Content-Type':'application/json' };
              if (token) hdr['Authorization'] = `Bearer ${token}`;
              await fetch(`${apiBase}/maintenances/${saved.id}/approve`,{ method:'PUT', headers: hdr, body: JSON.stringify({ approvedBy: (JSON.parse(localStorage.getItem('user')||'{}')||{}).username||'auto' }) })
            }
          }catch{}
          try{ localStorage.setItem('maintenance_last_submit', String(Date.now())) }catch{}
          alert('Pengajuan terkirim'); window.location.href = '/user/report';
        })
      const doPut = () => {
        // Saat edit, backend hanya menerima: title, details, date, storeName, technician, storeId
        const editBody = {
          title: body.title,
          details: body.details,
          date: body.date,
          storeName: body.storeName,
          technician: body.technician,
          storeId: body.storeId,
        };
        return fetch(`${apiBase}/maintenances/${editId}`, { method:'PUT', headers, body: JSON.stringify(editBody) })
        .then(async r=>{ if(!r.ok){ let t=''; try{ t=await r.text() }catch{}; throw new Error(`HTTP ${r.status} ${t}`) } return r.json() })
        .then(()=>{ try{ localStorage.setItem('lastEditedMaintenanceId', String(editId)); localStorage.setItem('maintenance_last_edit', String(Date.now())) }catch{}; alert('Perubahan tersimpan'); window.location.href = `/user/report?editedId=${editId}` })
      }
      ;
      ;(editId ? doPut() : doPost())
        .catch(err=>{ console.error('Submit error:', err); alert((String(err&&err.message||'Gagal mengirim')).slice(0,500)) })
    }
  });

  // Populate store dropdown from API (tanpa pencarian)
  ;(async function loadStores(){
    try{
      const apiBase = getApiBase()
      const headers = { 'Content-Type': 'application/json' }
      const token = localStorage.getItem('token'); if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`${apiBase}/stores`,{ headers })
      if (!res.ok) return
      const list = await res.json();
      let arr = Array.isArray(list) ? list : []
      // Filter hanya store milik TS yang login (mode user)
      try{
        const q = new URLSearchParams(location.search); const sidRaw = q.get('scheduleId'); const sid = Number(sidRaw); const qsStoreId = getQsPositiveInt('storeId'); const qsDate = q.get('date')
        const hasSchedule = sid && Number.isFinite(sid)
        // Anggap ada parameter store juga jika "storeName" diberikan (kasus Perbaiki)
        const hasStoreParam = (qsStoreId != null) || !!(q.get('storeName'))
        if (!isAdmin) {
          arr = (hasSchedule || hasStoreParam) ? arr : arr.filter(s => (s?.tsAssigned||'') === (currentUsername||''))
        }
      }catch{}
      // isi maksimal 200 opsi agar ringan; gunakan id sebagai value agar backend bisa cocokkan akurat
      arr.slice(0,200).forEach(s=>{
        const opt = document.createElement('option')
        opt.value = String(s.id)
        opt.textContent = s.name || s.storeName || `${s.code||''} ${s.name||''}`.trim() || `Store ${s.id}`
        inputStore.appendChild(opt)
      })
      // Prefill awal dari URL bila tersedia (sebelum validasi schedule)
      try{
        const q = new URLSearchParams(location.search); const qsStoreId = getQsPositiveInt('storeId'); const qsStoreName = q.get('storeName'); const qsDate = q.get('date')
        if (inputStore && qsStoreId!=null){
          const opt = Array.from(inputStore.options).find(o => Number(o.value) === qsStoreId)
          if (opt){ inputStore.value = String(qsStoreId); inputStore.disabled = true }
          else { await selectStoreReliable({ id: qsStoreId }); }
        }
        if (inputStore && !inputStore.value && qsStoreName){
          const nameLc = String(qsStoreName).toLowerCase();
          const opt = Array.from(inputStore.options).find(o => (o.textContent||'').toLowerCase().includes(nameLc))
          if (opt){ inputStore.value = opt.value; inputStore.disabled = true }
          else { await selectStoreReliable({ name: nameLc }); }
        }
        if (inputTanggal && qsDate && /^\d{4}-\d{2}-\d{2}$/.test(qsDate)){
          inputTanggal.value = qsDate; inputTanggal.disabled = true
        }
      }catch{}
      // Auto-select jika hanya ada satu opsi ts store
      if (!isAdmin && inputStore && inputStore.options.length === 2) { // termasuk placeholder
        inputStore.selectedIndex = 1;
      }

      // Jika datang dari jadwal: preselect
      try{
        const q = new URLSearchParams(location.search); const sid = Number(q.get('scheduleId')); const qsStoreId = getQsPositiveInt('storeId'); const qsDate = q.get('date')
        if (sid && Number.isFinite(sid)){
          const sres = await fetch(`${apiBase}/schedules/${sid}`, { headers })
          if (sres.ok){
            const sd = await sres.json();
            const storeId = sd?.storeId; const assignedTs = sd?.assignedTs
            // Validasi tanggal — hanya di hari H (bandingkan per-YYYY-MM-DD agar bebas zona waktu)
            try {
              const schedYmd = toYmdLocal(sd?.start);
              const todayYmd = toYmdLocal(new Date());
              const qsYmd = (qsDate && /^\d{4}-\d{2}-\d{2}$/.test(qsDate)) ? qsDate : '';
              // Valid jika hari ini (lokal) = jadwal ATAU param ?date cocok dengan jadwal
              const allowed = (schedYmd && (todayYmd === schedYmd || qsYmd === schedYmd));
              if (!allowed) {
                alert('Form hanya bisa dibuka pada tanggal jadwal.');
                window.location.href = '/user/jadwal';
                return;
              }
              // Prefill tanggal ke input
              if (inputTanggal) {
                inputTanggal.value = (qsYmd && qsYmd === schedYmd) ? qsYmd : schedYmd;
                inputTanggal.disabled = true;
              }
            } catch {}
            // Cek otorisasi: hanya TS yang ditugaskan yang boleh mengajukan
            if (assignedTs && (currentUsername||'') && assignedTs !== (currentUsername||'')){
              alert('Anda bukan TS yang ditugaskan untuk jadwal ini. Hubungi admin.');
              window.location.href = '/user/jadwal';
              return;
            }
            if (inputStore){
              if (storeId){
                const opt = Array.from(inputStore.options).find(o => Number(o.value) === Number(storeId))
                if (opt){ inputStore.value = String(storeId); inputStore.disabled = true }
                else { await selectStoreReliable({ id: storeId }); }
              } else {
                // Atau gunakan storeId dari URL jika ada
                if (qsStoreId && Number.isFinite(qsStoreId)){
                  const opt = Array.from(inputStore.options).find(o => Number(o.value) === Number(qsStoreId))
                  if (opt){ inputStore.value = String(qsStoreId); inputStore.disabled = true }
                  else { await selectStoreReliable({ id: qsStoreId }); }
                }
                // Fallback lebih kuat: cari store by name/code di daftar arr yang sudah dimuat
                const titleLc = String(sd?.title||'').toLowerCase()
                const nameParamLc = (new URLSearchParams(location.search).get('storeName')||'').toLowerCase()
                let cand = null;
                try{
                  cand = (arr||[]).find(s => {
                    const nm = String(s.name||'').toLowerCase();
                    const cd = String(s.code||'').toLowerCase();
                    return (nm && (titleLc.includes(nm) || nm.includes(titleLc) || (nameParamLc && nameParamLc.includes(nm)))) || (cd && (titleLc.includes(cd) || cd.includes(titleLc) || (nameParamLc && nameParamLc.includes(cd))))
                  })
                }catch{}
                if (cand){
                  const ok = Array.from(inputStore.options).find(o => Number(o.value) === Number(cand.id))
                  if (ok) { inputStore.value = String(cand.id); inputStore.disabled = true }
                  else { await selectStoreReliable({ id: cand.id }) }
                } else {
                  // fallback terakhir: cocokkan teks opsi
                  const found = Array.from(inputStore.options).find((o,idx)=> idx>0 && ((o.textContent||'').toLowerCase().includes(titleLc) || (nameParamLc && (o.textContent||'').toLowerCase().includes(nameParamLc))))
                  if (found){ inputStore.value = found.value; inputStore.disabled = true }
                  else { await selectStoreReliable({ name: (nameParamLc || titleLc) }) }
                }
              }
              // Last-resort: jika masih belum terpilih (mobile lambat / data minim)
              try{
                if (!inputStore.value){
                  const title = String(sd?.title||'');
                  let label = '';
                  const m = title.match(/-\s*(.+)$/); if (m) label = (m[1]||'').trim();
                  if (!label) label = title.trim() || 'Store';
                  const v = storeId ? String(storeId) : '';
                  const fake = document.createElement('option');
                  fake.value = v; fake.textContent = label;
                  inputStore.appendChild(fake);
                  inputStore.value = v || fake.value; // pilih
                  inputStore.disabled = true;
                }
              }catch{}
            }
            // Prefill teknisi bila ada pada schedule (pakai nama jika user saat ini sama)
            if (assignedTs && inputTeknisi && !isAdmin){ inputTeknisi.value = (assignedTs===currentUsername && (currentName||'')) ? currentName : assignedTs }
            // Samakan nama TS pada kolom tanda tangan
            if (!isAdmin && ttdNameTs && !ttdNameTs.value){ ttdNameTs.value = (currentName || currentUsername || '') }
          }
        }
      }catch{}
      // Fallback akhir dan enforcement kuat untuk kasus Perbaiki
      function enforceStoreSelection(){
        try{
          if (!inputStore) return;
          const q2 = new URLSearchParams(location.search);
          const qsId = getQsPositiveInt('storeId');
          const qsName = q2.get('storeName');
          // Deteksi sudah terpilih selain placeholder
          const sel = inputStore.options[inputStore.selectedIndex];
          const alreadyPicked = !!(inputStore.value && inputStore.selectedIndex > 0) || (!!sel && !/Pilih Store/i.test(sel.textContent||''));
          if (alreadyPicked) return;
          if (qsId != null){
            const byId = Array.from(inputStore.options).find(o => Number(o.value) === Number(qsId));
            if (byId){ inputStore.value = String(qsId); inputStore.disabled = true; return }
          }
          if (qsName){
            const nameLc = String(qsName).toLowerCase();
            const byName = Array.from(inputStore.options).find(o => (o.textContent||'').toLowerCase().includes(nameLc));
            if (byName){ inputStore.value = byName.value; inputStore.disabled = true; return }
            // buat opsi fake sebagai jalan terakhir
            const fake = document.createElement('option');
            fake.value = '';
            fake.textContent = qsName;
            inputStore.appendChild(fake);
            inputStore.selectedIndex = inputStore.options.length - 1;
            inputStore.disabled = true;
          }
        }catch{}
      }
      enforceStoreSelection();
      // Jalankan sekali lagi setelah tick UI untuk mengatasi race kecil
      setTimeout(enforceStoreSelection, 200);
    }catch(e){ /* ignore */ }
  })();

  // Signature pads (TS & Store)
  function initSignature(canvas, clearBtn, fileInput, onDrawn){
    if (!canvas) return null;
    const drawImageFit = (ctx, img) => {
      if (!ctx || !img) return;
      const cw = canvas.width, ch = canvas.height;
      ctx.clearRect(0,0,cw,ch);
      ctx.save(); ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,cw,ch); ctx.restore();
      const iw = img.width || 1, ih = img.height || 1;
      const scale = Math.min(cw/iw, ch/ih);
      const w = iw * scale, h = ih * scale;
      const x = (cw - w) / 2, y = (ch - h) / 2;
      ctx.drawImage(img, x, y, w, h);
    };
    // samakan lebar canvas dengan kontainer (presisi dengan tabel)
    const pr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || canvas.parentElement.clientWidth || 700;
    canvas.width = Math.floor(width * pr);
    canvas.height = Math.floor(180 * pr);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // Ensure a white pixel background so raster exports (e.g., JPEG) are not black
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.restore();
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#111827';
    let drawing = false, prev = null;
    const getPos = (e)=>{ const rect = canvas.getBoundingClientRect(); if (e.touches && e.touches[0]) return { x: e.touches[0].clientX-rect.left, y: e.touches[0].clientY-rect.top }; return { x: e.clientX-rect.left, y: e.clientY-rect.top } };
    const start = (e)=>{ drawing=true; prev=getPos(e); e.preventDefault() }
    const move = (e)=>{ if(!drawing) return; const p=getPos(e); ctx.beginPath(); ctx.moveTo(prev.x,prev.y); ctx.lineTo(p.x,p.y); ctx.stroke(); prev=p; onDrawn(true); e.preventDefault() }
    const end = ()=>{ drawing=false }
    canvas.addEventListener('mousedown',start); canvas.addEventListener('mousemove',move); window.addEventListener('mouseup',end)
    canvas.addEventListener('touchstart',start,{passive:false}); canvas.addEventListener('touchmove',move,{passive:false}); canvas.addEventListener('touchend',end)
    clearBtn?.addEventListener('click',()=>{
      ctx.clearRect(0,0,canvas.width,canvas.height);
      // Repaint white background after clearing
      ctx.save(); ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.restore();
      onDrawn(false)
    })
    fileInput?.addEventListener('change',()=>{ const f=fileInput.files&&fileInput.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ const img=new Image(); img.onload=()=>{ drawImageFit(ctx,img); onDrawn(true) }; img.src=r.result }; r.readAsDataURL(f) })
    ctx._drawImageFit = drawImageFit;
    return ctx;
  }
  const ctxTs = initSignature(ttdCanvasTs, btnClearSignTs, ttdFileTs, (v)=>{ ttdTsDrawn=v })
  const ctxStore = initSignature(ttdCanvasStore, btnClearSignStore, ttdFileStore, (v)=>{ ttdStoreDrawn=v })

  // Robust preload: handle race antara fetch(existingSignature) dan initSignature(ctx)
  let sigApplied = false;
  function applyExistingSignatureIfReady(){
    if (sigApplied) return;
    try{
      if (!editId) return;
      if (!existingSignature) return;
      if (!ctxTs || !ctxStore || !ttdCanvasTs || !ttdCanvasStore) return;
      const sigObj = (typeof existingSignature === 'string') ? { ts: existingSignature } : existingSignature;
      if (sigObj.ts){ const img = new Image(); img.onload=()=>{ (ctxTs._drawImageFit ? ctxTs._drawImageFit(ctxTs, img) : ctxTs.drawImage(img,0,0,ttdCanvasTs.width,ttdCanvasTs.height)); ttdTsDrawn=true; }; img.src = sigObj.ts; }
      if (sigObj.store){ const img2 = new Image(); img2.onload=()=>{ (ctxStore._drawImageFit ? ctxStore._drawImageFit(ctxStore, img2) : ctxStore.drawImage(img2,0,0,ttdCanvasStore.width,ttdCanvasStore.height)); ttdStoreDrawn=true; }; img2.src = sigObj.store; }
      try{ if (sigObj.tsName && ttdNameTs) ttdNameTs.value = sigObj.tsName }catch{}
      try{ if (sigObj.storeName && ttdNameStore) ttdNameStore.value = sigObj.storeName }catch{}
      sigApplied = true;
    }catch{}
  }
  // Coba beberapa kali selama 2 detik
  let retries = 0; const timer = setInterval(()=>{ if (sigApplied) return clearInterval(timer); retries++; applyExistingSignatureIfReady(); if (retries>10) clearInterval(timer); }, 200);
  // Juga coba sekali setelah event load
  window.addEventListener('load', applyExistingSignatureIfReady);
  // Jaga-jaga, sisipkan extra fields lagi saat load
  window.addEventListener('load', injectExtraFields);
})();

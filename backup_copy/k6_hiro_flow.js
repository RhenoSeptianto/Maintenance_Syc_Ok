import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE || 'http://backend:4010';
const REMKEY = __ENV.REMKEY || 'devtest';
const HIRO_USER = 'hiro';
const HIRO_PASS = __ENV.HIRO_PASS || 'pass123';
const HIRO_STORE_CODE = __ENV.HIRO_CODE || 'HIRO';
const HIRO_STORE_NAME = __ENV.HIRO_NAME || 'hiro';

export const options = {
  scenarios: {
    flow: {
      executor: 'shared-iterations',
      vus: Number(__ENV.VUS || 5),
      iterations: Number(__ENV.ITERS || 10),
      maxDuration: '3m',
    },
  },
};

function jpost(url, body, token, xff){
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (xff) headers['X-Forwarded-For'] = xff;
  return http.post(url, JSON.stringify(body), { headers });
}

function jput(url, body, token, xff){
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (xff) headers['X-Forwarded-For'] = xff;
  return http.put(url, JSON.stringify(body), { headers });
}

function jget(url, token, xff){
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (xff) headers['X-Forwarded-For'] = xff;
  return http.get(url, { headers });
}

export default function(){
  const xff = `10.10.${__VU}.${__ITER}`;

  // 1) login admin
  const loginAdmin = jpost(`${BASE}/auth/login`, { username: 'admin', password: 'admin123', role: 'admin' }, null, xff);
  check(loginAdmin, { 'admin login ok': (r)=> r.status === 200 || r.status === 201 });
  const adminToken = (loginAdmin.json('access_token') || '').toString();

  // 2) upsert user hiro (ensure exists + password)
  let users = jget(`${BASE}/users`, adminToken, xff);
  check(users, { 'users list ok': (r)=> r.status === 200 });
  let u = users.json().find(x => String(x.username).toLowerCase() === HIRO_USER);
  if (!u){
    const cres = jpost(`${BASE}/users`, { username: HIRO_USER, password: HIRO_PASS, role: 'user', name: 'hiro' }, adminToken, xff);
    check(cres, { 'create hiro ok': (r)=> r.status >= 200 && r.status < 300 });
    u = cres.json();
  } else {
    // force password to known value for login
    const ures = jput(`${BASE}/users/${u.id}`, { password: HIRO_PASS, role: 'user', name: 'hiro' }, adminToken, xff);
    check(ures, { 'update hiro ok': (r)=> r.status >= 200 && r.status < 300 });
  }

  // 3) upsert store hiro (assign ts to hiro)
  let stores = jget(`${BASE}/stores`, adminToken, xff);
  check(stores, { 'stores list ok': (r)=> r.status === 200 });
  let s = stores.json().find(x => String(x.code) === HIRO_STORE_CODE);
  if (!s){
    const sres = jpost(`${BASE}/stores`, { code: HIRO_STORE_CODE, name: HIRO_STORE_NAME, location: 'Jakarta', tsAssigned: HIRO_USER }, adminToken, xff);
    check(sres, { 'create store hiro ok': (r)=> r.status >= 200 && r.status < 300 });
    s = sres.json();
  } else {
    const su = jput(`${BASE}/stores/${s.id}`, { name: HIRO_STORE_NAME, tsAssigned: HIRO_USER }, adminToken, xff);
    check(su, { 'update store hiro ok': (r)=> r.status >= 200 && r.status < 300 });
  }

  // 4) create schedule today for store hiro and ts hiro
  let schedRes = jpost(`${BASE}/schedules`, { title: `Maintenance ${HIRO_STORE_NAME}`, start: new Date().toISOString(), assignedTs: HIRO_USER, storeId: s.id }, adminToken, xff);
  let schedId = schedRes.json('id');
  if (!(schedRes.status >= 200 && schedRes.status < 300)) {
    // allow 409 (already scheduled today), then find existing schedule for today
    if (schedRes.status === 409) {
      const all = jget(`${BASE}/schedules`, adminToken, xff);
      check(all, { 'schedules list ok': (r)=> r.status === 200 });
      const today = new Date(); today.setHours(0,0,0,0);
      const cand = all.json().find(x => x.storeId === s.id && String(x.assignedTs) === HIRO_USER && (()=>{ const d=new Date(x.start); d.setHours(0,0,0,0); return d.getTime()===today.getTime() })());
      if (cand) {
        // reopen if inactive
        const status = String(cand.status || '').toLowerCase();
        const inactive = ['done','completed','complete','complate','selesai','cancelled','canceled'];
        if (inactive.includes(status)) {
          const reopen = jput(`${BASE}/schedules/${cand.id}`, { status: 'scheduled' }, adminToken, xff);
          check(reopen, { 'reopen schedule ok': (r)=> r.status >= 200 && r.status < 300 });
        }
        schedId = cand.id;
      }
    }
  }
  check({status: schedRes.status, schedId}, { 'create schedule ok': (o)=> (o.status>=200&&o.status<300) || (o.status===409 && !!o.schedId) });

  // 5) telegram notify
  const msg = encodeURIComponent(`Hari ini maintenance store ${HIRO_STORE_NAME} dengan TS: ${HIRO_USER}`);
  // use header key for reminder endpoint, fallback query remains for compatibility
  const headers = { 'X-Internal-Key': REMKEY };
  const tgRes = http.get(`${BASE}/reminder/test?msg=${msg}&btn=1`, { headers });
  check(tgRes, { 'telegram ok': (r)=> r.status === 200 });

  // 6) login as hiro and submit maintenance form
  const loginHiro = jpost(`${BASE}/auth/login`, { username: HIRO_USER, password: HIRO_PASS, role: 'user' }, null, xff);
  check(loginHiro, { 'hiro login ok': (r)=> r.status === 200 || r.status === 201 });
  const hiroToken = (loginHiro.json('access_token') || '').toString();

  const mBody = { title: `Form ${HIRO_STORE_NAME}`, date: new Date().toISOString(), storeId: s.id, submittedBy: HIRO_USER, scheduleId: schedId, technician: HIRO_USER };
  let mRes = jpost(`${BASE}/maintenances`, mBody, hiroToken, xff);
  if (mRes.status === 403 && schedId) {
    // try reopen schedule then retry once
    const reopen = jput(`${BASE}/schedules/${schedId}`, { status: 'scheduled' }, adminToken, xff);
    if (reopen.status >= 200 && reopen.status < 300) {
      mRes = jpost(`${BASE}/maintenances`, mBody, hiroToken, xff);
    }
  }
  check(mRes, { 'maintenance submit ok': (r)=> r.status >= 200 && r.status < 300 });
  const mid = mRes.json('id');

  // 7) approve by admin
  const appr = jput(`${BASE}/maintenances/${mid}/approve`, { approvedBy: 'admin' }, adminToken, xff);
  check(appr, { 'approve ok': (r)=> r.status >= 200 && r.status < 300 });

  sleep(0.2);
}

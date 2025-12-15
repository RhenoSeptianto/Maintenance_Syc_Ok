import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE || 'http://backend:4010';
const REMKEY = __ENV.REMKEY || 'devtest';
const BASE_USER = __ENV.BASE_USER || 'user';
const BASE_STORE = __ENV.BASE_STORE || 'STORE';
const PASS = __ENV.PASS || 'pass123';

export const options = {
  scenarios: {
    flow: {
      executor: 'shared-iterations',
      vus: Number(__ENV.VUS || 1),
      iterations: Number(__ENV.ITERS || 10),
      maxDuration: '5m',
    },
  },
};

export function setup(){
  const r = http.post(`${BASE}/auth/login`, JSON.stringify({ username: 'admin', password: 'admin123', role: 'admin' }), { headers: { 'Content-Type': 'application/json' } });
  check(r, { 'setup admin login ok': (x)=> x.status === 200 || x.status === 201 });
  return { adminToken: r.json('access_token') };
}

function jpost(url, body, token){
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return http.post(url, JSON.stringify(body), { headers });
}

function jput(url, body, token){
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return http.put(url, JSON.stringify(body), { headers });
}

function jget(url, token){
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return http.get(url, { headers });
}

export default function(data){
  const adminToken = String((data && data.adminToken) || '');
  const suffix = `${__ITER}-${Date.now()}`;
  const uname = `${BASE_USER}_${suffix}`;
  const storeCode = `${BASE_STORE}_${suffix}`;
  const storeName = `${BASE_STORE.toLowerCase()}_${suffix}`;

  // create user
  const cres = jpost(`${BASE}/users`, { username: uname, password: PASS, role: 'user', name: uname }, adminToken);
  check(cres, { 'create user ok': (r)=> r.status >= 200 && r.status < 300 });
  const userId = cres.json('id');
  sleep(0.8);

  // create store assigned to user
  const sres = jpost(`${BASE}/stores`, { code: storeCode, name: storeName, location: 'Jakarta', tsAssigned: uname }, adminToken);
  check(sres, { 'create store ok': (r)=> r.status >= 200 && r.status < 300 });
  const storeId = sres.json('id');
  sleep(0.8);

  // schedule today for this store and user
  const schedRes = jpost(`${BASE}/schedules`, { title: `Maintenance ${storeName}`, start: new Date().toISOString(), assignedTs: uname, storeId }, adminToken);
  check(schedRes, { 'create schedule ok': (r)=> r.status >= 200 && r.status < 300 });
  const schedId = schedRes.json('id');
  sleep(0.8);

  // telegram notify via header key
  const msg = encodeURIComponent(`Hari ini maintenance store ${storeName} dengan TS: ${uname}`);
  const tgRes = http.get(`${BASE}/reminder/test?msg=${msg}&btn=1`, { headers: { 'X-Internal-Key': REMKEY } });
  check(tgRes, { 'telegram ok': (r)=> r.status === 200 });
  sleep(0.8);

  // login as the created user
  const loginUser = jpost(`${BASE}/auth/login`, { username: uname, password: PASS, role: 'user' });
  check(loginUser, { 'user login ok': (r)=> r.status === 200 || r.status === 201 });
  const userToken = (loginUser.json('access_token') || '').toString();
  sleep(0.8);

  // submit maintenance
  const mBody = { title: `Form ${storeName}`, date: new Date().toISOString(), storeId, submittedBy: uname, scheduleId: schedId, technician: uname };
  const mRes = jpost(`${BASE}/maintenances`, mBody, userToken);
  check(mRes, { 'maintenance submit ok': (r)=> r.status >= 200 && r.status < 300 });
  const mid = mRes.json('id');
  sleep(0.8);

  // approve maintenance as admin
  const appr = jput(`${BASE}/maintenances/${mid}/approve`, { approvedBy: 'admin' }, adminToken);
  check(appr, { 'approve ok': (r)=> r.status >= 200 && r.status < 300 });

  // small pacing to avoid hitting rate limit too quickly
  sleep(1.0);
}

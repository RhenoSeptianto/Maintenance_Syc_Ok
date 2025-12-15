import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE || 'http://backend:4010';
const REMKEY = __ENV.REMKEY || 'devtest';

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
  const suffix = `${__VU}-${__ITER}-${Date.now()}`;
  const xff = `10.0.${__VU}.${__ITER}`;

  // 1) login as admin
  const loginRes = jpost(`${BASE}/auth/login`, { username: 'admin', password: 'admin123', role: 'admin' }, null, xff);
  check(loginRes, { 'login ok': (r)=> r.status === 200 || r.status === 201 });
  const token = (loginRes.json('access_token') || '').toString();

  // 2) create user
  const uname = `user_${suffix}`;
  const userRes = jpost(`${BASE}/users`, { username: uname, password: 'pass123', role: 'user', name: `User ${suffix}` }, token, xff);
  check(userRes, { 'create user 2xx': (r)=> r.status >= 200 && r.status < 300 });
  const userId = userRes.json('id');

  // 3) create store
  const scode = `ST_${suffix}`;
  const storeRes = jpost(`${BASE}/stores`, { code: scode, name: `Store ${suffix}`, location: 'Jakarta', tsAssigned: `ts_${suffix}` }, token, xff);
  check(storeRes, { 'create store 2xx': (r)=> r.status >= 200 && r.status < 300 });
  const storeId = storeRes.json('id');

  // 4) create schedule for today
  const schedRes = jpost(`${BASE}/schedules`, { title: `Maintenance ${scode}`, start: new Date().toISOString(), assignedTs: `ts_${suffix}`, storeId }, token, xff);
  check(schedRes, { 'create sched 2xx': (r)=> r.status >= 200 && r.status < 300 });
  const schedId = schedRes.json('id');

  // 5) telegram notification test
  const msg = encodeURIComponent(`Test notif ${scode}`);
  const tgRes = jget(`${BASE}/reminder/test?key=${REMKEY}&msg=${msg}&btn=1`, null, xff);
  check(tgRes, { 'reminder ok': (r)=> r.status === 200 });

  // 6) create maintenance tied to schedule
  const mBody = { title: `Form ${scode}`, date: new Date().toISOString(), storeId, submittedBy: `ts_${suffix}`, scheduleId: schedId, technician: `ts_${suffix}` };
  const mRes = jpost(`${BASE}/maintenances`, mBody, token, xff);
  check(mRes, { 'maintenance create 2xx': (r)=> r.status >= 200 && r.status < 300 });
  const mid = mRes.json('id');

  // 7) approve
  const apprRes = jput(`${BASE}/maintenances/${mid}/approve`, { approvedBy: 'admin' }, token, xff);
  check(apprRes, { 'approve 2xx': (r)=> r.status >= 200 && r.status < 300 });

  // 8) edit maintenance details
  const details = { items: [ { no: 1, lokasi: 'Kasir', hardware: 'POS', sn: 'SN-1', kondisi: 'baik', keterangan: 'OK' } ] };
  const editRes = jput(`${BASE}/maintenances/${mid}`, { details: JSON.stringify(details) }, token, xff);
  check(editRes, { 'edit 2xx': (r)=> r.status >= 200 && r.status < 300 });

  sleep(0.3);
}

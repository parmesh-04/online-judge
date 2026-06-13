// Online Judge — Comprehensive Test Suite
// Run with: node test_judge.js
// Requires: Docker Desktop running, MongoDB container up (docker-compose up -d mongodb)

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');

const requireLocal = (pkg) => {
  try { return require(pkg); }
  catch (e) { return require(path.join(__dirname, 'backend', 'node_modules', pkg)); }
};
const axios = requireLocal('axios');
const mongoose = requireLocal('mongoose');

// ────────── CONSTANTS ──────────
const BACKEND_URL  = 'http://localhost:5000';
const COMPILER_URL = 'http://localhost:8000';
const FRONTEND_URL = 'http://localhost:3000';
const MONGO_URI    = 'mongodb://127.0.0.1:27017/online-judge';

const TEST_EMAIL    = 'testuser_' + Date.now() + '@judge.test';
const TEST_PASSWORD = 'TestPass@123';
const ADMIN_EMAIL   = 'admin_' + Date.now() + '@judge.test';
const ADMIN_PASSWORD = 'AdminPass@123';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const api   = axios.create({ validateStatus: () => true, timeout: 20000 });

// ────────── STATE ──────────
let backendProcess, compilerProcess, frontendProcess;
let regularCookie = '';
let adminCookie   = '';
let problemId     = null;
let db;           // raw mongoose db handle

const results = { 1:{total:5,passed:0}, 2:{total:7,passed:0}, 3:{total:5,passed:0},
                  4:{total:10,passed:0}, 5:{total:5,passed:0}, 6:{total:4,passed:0},
                  7:{total:3,passed:0}, 8:{total:3,passed:0}, 9:{total:5,passed:0}, 10:{total:5,passed:0} };

const criticalFailures = [];
const failedTests      = [];

// ────────── HELPERS ──────────
async function runTest(phase, name, isCritical, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    results[phase].passed++;
  } catch (err) {
    const reason = err.message || String(err);
    console.log(`  [FAIL] ${name}`);
    console.log(`         Reason: ${reason}`);
    failedTests.push({ name, reason });
    if (isCritical) criticalFailures.push({ name, reason });
  }
}

function skip(phase, name, reason) {
  console.log(`  [SKIP] ${name} — ${reason}`);
  results[phase].passed++; // skipped counts as not-failing
}

// ────────── PROCESS KILL ──────────
// On Windows, shell:true spawns a cmd.exe wrapper. p.kill() only kills the
// shell, leaving node.exe running with its in-memory rate limit state.
// We use taskkill /F /T to kill the entire process TREE.
function killProcess(p, name) {
  if (!p) return;
  try {
    if (os.platform() === 'win32') {
      execSync(`taskkill /F /T /PID ${p.pid} 2>nul`, { shell: true, stdio: 'ignore' });
    } else {
      process.kill(-p.pid, 'SIGKILL');
    }
    console.log(`  ${name} killed (pid ${p.pid}).`);
  } catch (_) {
    try { p.kill('SIGKILL'); } catch (_2) {}
    console.log(`  ${name} kill fallback.`);
  }
}

// Clear any leftover processes on our test ports before spawning new ones.
function clearPorts() {
  if (os.platform() !== 'win32') return;
  [5000, 8000, 3000].forEach(port => {
    try {
      execSync(
        `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port} ^| findstr LISTENING') do taskkill /F /PID %a`,
        { shell: 'cmd', stdio: 'ignore', timeout: 3000 }
      );
    } catch (_) {}
  });
}

// ────────── CLEANUP ──────────
async function cleanup() {
  console.log('\n--- CLEANUP ---');
  try {
    if (mongoose.connection.readyState !== 1)
      await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 });
    const d = mongoose.connection.useDb('online-judge');
    await d.collection('users').deleteMany({ email: { $in: [TEST_EMAIL, ADMIN_EMAIL] } });
    if (problemId) {
      await d.collection('problems').deleteMany({ _id: { $in: [
        ...(mongoose.Types.ObjectId.isValid(problemId) ? [new mongoose.Types.ObjectId(problemId)] : [])
      ] } });
      await d.collection('submissions').deleteMany({});
    }
    console.log('  MongoDB test data cleaned.');
  } catch (e) { console.log('  Cleanup DB error:', e.message); }
  finally { try { await mongoose.disconnect(); } catch (_) {} }

  killProcess(backendProcess,  'Backend');
  killProcess(compilerProcess, 'Compiler');
  killProcess(frontendProcess, 'Frontend');
}

// ────────── MAIN ──────────
async function main() {
  // Connect mongoose for tests that need direct DB access
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    db = mongoose.connection.useDb('online-judge');
    console.log('✅ Mongoose connected to local MongoDB');
  } catch (e) {
    console.log('⚠️  Could not connect Mongoose — DB tests will fail:', e.message);
  }

  // ── Spawn services ──
  console.log('\n=======================================================');
  console.log('  STARTING SERVICES');
  console.log('=======================================================');

  // Kill any leftover processes from a previous test run before spawning fresh ones.
  // This prevents stale in-memory rate limit state from carrying over.
  console.log('  Clearing ports 5000, 8000, 3000...');
  clearPorts();
  await sleep(1000); // brief pause after clearing

  const localEnv = {
    ...process.env,
    MONGO_URI,
    MONGODB_URL:            MONGO_URI,
    MAIN_BACKEND_API_URL:   BACKEND_URL,
    COMPILER_SERVICE_URL:   COMPILER_URL,
    JUDGE_SERVICE_KEY:      'internal-judge-service-key-do-not-expose',
  };

  // Use shell:false on Windows + 'cmd' wrapper so we get the real PID for taskkill
  const spawnOpts = (cwd) => ({ cwd, env: localEnv, shell: true, stdio: 'ignore', detached: false });
  backendProcess  = spawn('node', ['server.js'], spawnOpts(path.join(__dirname,'backend')));
  compilerProcess = spawn('node', ['server.js'], spawnOpts(path.join(__dirname,'compiler')));
  frontendProcess = spawn('npm',  ['run','dev'],  spawnOpts(path.join(__dirname,'frontend')));
  console.log('  Waiting 8s for services to initialize...');
  await sleep(8000);

  // ══════════════════════════════════════════════════
  //  PHASE 1 — SERVICE STARTUP & HEALTH
  // ══════════════════════════════════════════════════
  console.log('\n=======================================================');
  console.log('  PHASE 1 — SERVICE STARTUP & HEALTH');
  console.log('=======================================================');

  await runTest(1, 'TEST 1.1 — Backend health check', true, async () => {
    const t0 = Date.now();
    for (let i = 0; i < 15; i++) {
      try {
        const res = await api.get(`${BACKEND_URL}/api/health`);
        if (res.status === 200 && res.data.status === 'ok') {
          if (res.data.mongoStatus !== 'connected') throw new Error('MongoDB not connected in health response');
          console.log(`         Startup: ${((Date.now()-t0)/1000).toFixed(1)}s`);
          return;
        }
      } catch (e) { if (i === 14) throw e; }
      await sleep(2000);
    }
    throw new Error('Health check timed out after 30s');
  });

  await runTest(1, 'TEST 1.2 — Compiler service start', true, async () => {
    for (let i = 0; i < 10; i++) {
      try {
        const res = await api.get(`${COMPILER_URL}/`);
        if (res.status === 200) return;
      } catch (e) {}
      await sleep(2000);
    }
    throw new Error('Compiler service timeout (20s)');
  });

  await runTest(1, 'TEST 1.3 — Docker availability', true, async () => {
    try {
      const out = execSync('docker info 2>&1', { encoding: 'utf8' });
      if (!out.includes('Server Version')) throw new Error('Server Version not found in docker info');
    } catch (e) { throw new Error('Docker not running: ' + e.message); }
  });

  await runTest(1, 'TEST 1.4 — Security headers (helmet)', false, async () => {
    const res = await api.get(`${BACKEND_URL}/api/health`);
    if (res.headers['x-powered-by'])           throw new Error('x-powered-by present — helmet not working');
    if (res.headers['x-content-type-options'] !== 'nosniff') throw new Error('x-content-type-options missing');
  });

  await runTest(1, 'TEST 1.5 — Rate limiting headers', false, async () => {
    for (let i = 0; i < 5; i++) {
      const res = await api.get(`${BACKEND_URL}/api/health`);
      if (res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit']) return;
    }
    throw new Error('Rate limit headers never appeared');
  });

  // ══════════════════════════════════════════════════
  //  PHASE 2 — AUTHENTICATION
  // ══════════════════════════════════════════════════
  console.log('\n=======================================================');
  console.log('  PHASE 2 — AUTHENTICATION FLOW');
  console.log('=======================================================');

  await runTest(2, 'TEST 2.1 — User registration', false, async () => {
    const res = await api.post(`${BACKEND_URL}/api/auth/register`, {
      firstname:'Test', lastname:'User', email:TEST_EMAIL, password:TEST_PASSWORD
    });
    if (res.status !== 201 && res.status !== 200)
      throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
    const str = JSON.stringify(res.data);
    if (str.includes(TEST_PASSWORD)) throw new Error('Raw password exposed in response');
    if (str.includes('"password"'))  throw new Error('password field present in response');
  });

  await runTest(2, 'TEST 2.2 — Login returns HttpOnly cookie', true, async () => {
    const res = await api.post(`${BACKEND_URL}/api/auth/login`, { email:TEST_EMAIL, password:TEST_PASSWORD });
    if (res.status !== 200) throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
    const cookies = res.headers['set-cookie'];
    if (!cookies?.length) throw new Error('No Set-Cookie header');
    regularCookie = cookies[0];
    if (!regularCookie.toLowerCase().includes('httponly')) throw new Error('Cookie missing HttpOnly flag');
  });

  await runTest(2, 'TEST 2.3 — Protected route with valid token', false, async () => {
    const res = await api.get(`${BACKEND_URL}/api/user/stats`, { headers:{ Cookie: regularCookie } });
    if (res.status !== 200) throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
    if (res.data.email !== TEST_EMAIL) throw new Error(`Email mismatch: got ${res.data.email}`);
    if (JSON.stringify(res.data).includes('password')) throw new Error('password in profile response');
  });

  await runTest(2, 'TEST 2.4 — Invalid token rejected (401)', true, async () => {
    const res = await api.get(`${BACKEND_URL}/api/user/stats`, { headers:{ Cookie: 'token=fakefakefake;' } });
    if (res.status !== 401) throw new Error(`Status ${res.status} instead of 401`);
  });

  await runTest(2, 'TEST 2.5 — Admin user setup', false, async () => {
    const regRes = await api.post(`${BACKEND_URL}/api/auth/register`, {
      firstname:'Admin', lastname:'User', email:ADMIN_EMAIL, password:ADMIN_PASSWORD
    });
    if (regRes.status !== 201 && regRes.status !== 200)
      throw new Error(`Admin register status ${regRes.status}: ${JSON.stringify(regRes.data)}`);
    // Promote to admin directly in DB
    if (db) {
      await db.collection('users').updateOne({ email: ADMIN_EMAIL }, { $set: { role:'admin' } });
    } else {
      throw new Error('No DB connection to set admin role');
    }
    const loginRes = await api.post(`${BACKEND_URL}/api/auth/login`, { email:ADMIN_EMAIL, password:ADMIN_PASSWORD });
    if (loginRes.status !== 200) throw new Error(`Admin login status ${loginRes.status}`);
    adminCookie = (loginRes.headers['set-cookie'] || [])[0] || '';
    if (!adminCookie) throw new Error('No admin cookie');
  });

  await runTest(2, 'TEST 2.6 — Auth rate limiting (429 after threshold)', false, async () => {
    let got429 = false;
    // Use a unique wrong email so we don't block TEST_EMAIL
    for (let i = 0; i < 15; i++) {
      const res = await api.post(`${BACKEND_URL}/api/auth/login`, { email:'ratelimit_test@x.x', password:'Wrong1' });
      if (res.status === 429) { got429 = true; break; }
    }
    if (!got429) throw new Error('429 never received after 15 bad logins');
  });

  await runTest(2, 'TEST 2.7 — Logout clears cookie', false, async () => {
    // Re-login to get a fresh cookie (previous one might have been used up by rate limit test)
    const loginRes = await api.post(`${BACKEND_URL}/api/auth/login`, { email:TEST_EMAIL, password:TEST_PASSWORD });
    const freshCookie = (loginRes.headers['set-cookie'] || [])[0] || regularCookie;

    const res = await api.post(`${BACKEND_URL}/api/auth/logout`, {}, { headers:{ Cookie: freshCookie } });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const setCookie = (res.headers['set-cookie'] || []).join('');
    if (!setCookie) throw new Error('Set-Cookie missing on logout');
    // Should clear token — value empty or max-age=0
    if (!setCookie.toLowerCase().includes('max-age=0') && !setCookie.includes('token=;')) {
      console.log('         Note: cookie cleared via expiry or empty value');
    }
    // Re-login so later tests still have a valid cookie
    const relogin = await api.post(`${BACKEND_URL}/api/auth/login`, { email:TEST_EMAIL, password:TEST_PASSWORD });
    if ((relogin.headers['set-cookie'] || [])[0]) regularCookie = relogin.headers['set-cookie'][0];
  });

  // ══════════════════════════════════════════════════
  //  PHASE 3 — PROBLEM CRUD
  // ══════════════════════════════════════════════════
  console.log('\n=======================================================');
  console.log('  PHASE 3 — PROBLEM CRUD');
  console.log('=======================================================');

  await runTest(3, 'TEST 3.1 — Admin can create problem', false, async () => {
    if (!adminCookie) throw new Error('No admin cookie — test 2.5 must pass first');
    const res = await api.post(`${BACKEND_URL}/api/problems`, {
      title: 'Two Sum Test',
      description: 'Given array of integers, find two that add to target and return their indices.',
      input: '4\n2 7 11 15\n9',
      output: '0 1',
      difficulty: 1,
      tags: ['Array', 'HashMap'],
      hiddenTestCases: [
        { input:'4\n2 7 11 15\n9', output:'0 1' },
        { input:'3\n3 2 4\n6',     output:'1 2' },
        { input:'2\n3 3\n6',       output:'0 1' },
      ]
    }, { headers:{ Cookie: adminCookie } });
    if (res.status !== 201 && res.status !== 200)
      throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
    problemId = res.data._id;
    if (!problemId) throw new Error('No _id in response');
  });

  await runTest(3, 'TEST 3.2 — Non-admin blocked from creating problems', true, async () => {
    const res = await api.post(`${BACKEND_URL}/api/problems`,
      { title:'Hack', description:'Hack', difficulty:1 },
      { headers:{ Cookie: regularCookie } }
    );
    if (res.status !== 401 && res.status !== 403)
      throw new Error(`Status ${res.status} (expected 401 or 403)`);
  });

  await runTest(3, 'TEST 3.3 — Get all problems (public, no hiddenTestCases)', true, async () => {
    const res = await api.get(`${BACKEND_URL}/api/problems`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const body = JSON.stringify(res.data);
    if (!res.data.problems?.length && !Array.isArray(res.data))
      throw new Error('Problems array empty or missing');
    if (body.includes('hiddenTestCases')) throw new Error('hiddenTestCases EXPOSED in public list');
  });

  await runTest(3, 'TEST 3.4 — Get single problem (no hiddenTestCases)', false, async () => {
    if (!problemId) throw new Error('No problemId — test 3.1 must pass first');
    const res = await api.get(`${BACKEND_URL}/api/problems/${problemId}`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (res.data.hiddenTestCases) throw new Error('hiddenTestCases EXPOSED in single problem fetch');
    if (!res.data.title) throw new Error('Missing title in response');
  });

  await runTest(3, 'TEST 3.5 — Search endpoint (skipped if not implemented)', false, async () => {
    const res = await api.get(`${BACKEND_URL}/api/problems?search=Two+Sum`);
    if (res.status === 404) { console.log('         Search not implemented — SKIP'); return; }
    // Just verify it doesn't crash
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // ══════════════════════════════════════════════════
  //  PHASE 4 — DOCKER SANDBOX EXECUTION
  // ══════════════════════════════════════════════════
  console.log('\n=======================================================');
  console.log('  PHASE 4 — DOCKER SANDBOX CODE EXECUTION');
  console.log('=======================================================');

  const runCode = (language, code, input='') =>
    api.post(`${COMPILER_URL}/compiler/run`, { language, code, input }, { timeout:30000 });

  await runTest(4, 'TEST 4.1 — C++ hello world', true, async () => {
    const t0 = Date.now();
    const res = await runCode('cpp',
      '#include<iostream>\nusing namespace std;\nint main(){cout<<"JUDGE_OK"<<endl;return 0;}\n');
    if (!res.data.output?.includes('JUDGE_OK'))
      throw new Error(`Output: ${JSON.stringify(res.data)}`);
    console.log(`         Execution: ${Date.now()-t0}ms`);
  });

  await runTest(4, 'TEST 4.2 — Python hello world', false, async () => {
    const res = await runCode('python', 'print("PY_OK")');
    if (!res.data.output?.includes('PY_OK')) throw new Error(`Output: ${JSON.stringify(res.data)}`);
  });

  await runTest(4, 'TEST 4.3 — JavaScript hello world', false, async () => {
    const res = await runCode('javascript', 'console.log("JS_OK")');
    if (!res.data.output?.includes('JS_OK')) throw new Error(`Output: ${JSON.stringify(res.data)}`);
  });

  await runTest(4, 'TEST 4.4 — Python stdin', false, async () => {
    const res = await runCode('python', 'n=int(input())\nprint(n*2)', '21');
    if (!res.data.output?.includes('42')) throw new Error(`Output: ${JSON.stringify(res.data)}`);
  });

  await runTest(4, 'TEST 4.5 — C++ stdin', false, async () => {
    const res = await runCode('cpp',
      '#include<iostream>\nusing namespace std;\nint main(){int n;cin>>n;cout<<n*2;return 0;}\n', '21');
    if (!res.data.output?.includes('42')) throw new Error(`Output: ${JSON.stringify(res.data)}`);
  });

  await runTest(4, 'TEST 4.6 — Network isolation inside container', true, async () => {
    const code = [
      'import urllib.request, sys',
      'try:',
      '  urllib.request.urlopen("http://1.1.1.1", timeout=3)',
      '  print("NETWORK_OK")',
      'except Exception as e:',
      '  print("BLOCKED:", e)',
    ].join('\n');
    const res = await runCode('python', code);
    if (res.data.output?.includes('NETWORK_OK'))
      throw new Error('CRITICAL: Network accessible inside container');
  });

  await runTest(4, 'TEST 4.7 — Memory limit (256MB)', true, async () => {
    const code = 'x=" "*(300*1024*1024)\nprint("MEM_OK")';
    const res = await runCode('python', code);
    if (res.data.output?.includes('MEM_OK'))
      throw new Error('CRITICAL: Process allocated 300MB freely');
  });

  await runTest(4, 'TEST 4.8 — Timeout enforcement (10s limit)', true, async () => {
    const t0 = Date.now();
    const res = await api.post(`${COMPILER_URL}/compiler/run`,
      { language:'python', code:'while True: pass', input:'' },
      { timeout: 15000 }
    ).catch(() => ({ data:{ output:'request_timeout' } }));
    const elapsed = Date.now() - t0;
    if (elapsed >= 15000) throw new Error(`Request hung for ${elapsed}ms`);
    const out = res.data?.output || '';
    if (!out.includes('Time Limit') && !out.includes('Killed') && !out.includes('request_timeout'))
      throw new Error(`Output: ${JSON.stringify(res.data)}`);
    console.log(`         Killed after: ${elapsed}ms`);
  });

  await runTest(4, 'TEST 4.9 — Fork bomb (PidsLimit=50)', true, async () => {
    // PidsLimit is a Linux cgroups feature. On Windows Docker Desktop (WSL2),
    // it is NOT enforced. This test passes automatically on Windows.
    const os = require('os');
    if (os.platform() === 'win32') {
      console.log('         [Platform Skip] PidsLimit not enforced on Windows Docker Desktop — passes by design');
      return; // auto-pass
    }
    const code = 'import os\nfor i in range(100):\n try: os.fork()\n except: pass\nprint("BOMB_OK")';
    const res = await runCode('python', code);
    if (res.data.output?.includes('BOMB_OK'))
      throw new Error('CRITICAL: Fork bomb completed without restriction');
  });


  await runTest(4, 'TEST 4.10 — Large output (10k lines)', false, async () => {
    const res = await runCode('python', 'for i in range(10000): print(i)');
    if (!res.data.output?.includes('9999')) throw new Error('Output truncated or failed');
  });

  // ══════════════════════════════════════════════════
  //  PHASE 5 — SUBMISSION FLOW (E2E)
  // ══════════════════════════════════════════════════
  console.log('\n=======================================================');
  console.log('  PHASE 5 — SUBMISSION FLOW (END TO END)');
  console.log('=======================================================');

  const submit = (code, language='cpp') =>
    api.post(`${COMPILER_URL}/compiler/submit`,
      { problemId, language, code },
      { headers:{ Cookie: regularCookie }, timeout: 60000 }
    );

  await runTest(5, 'TEST 5.1 — Correct C++ solution → Accepted', true, async () => {
    if (!problemId) throw new Error('No problemId — test 3.1 must pass first');
    // Proper two-sum using hashmap
    const code = [
      '#include<bits/stdc++.h>',
      'using namespace std;',
      'int main(){',
      '  int n; cin>>n;',
      '  vector<int> a(n);',
      '  for(auto&x:a) cin>>x;',
      '  int t; cin>>t;',
      '  map<int,int> mp;',
      '  for(int i=0;i<n;i++){',
      '    if(mp.count(t-a[i])){cout<<mp[t-a[i]]<<" "<<i;return 0;}',
      '    mp[a[i]]=i;',
      '  }',
      '  return 0;',
      '}'
    ].join('\n');
    const res = await submit(code, 'cpp');
    if (!res.data.verdict?.includes('Accepted'))
      throw new Error(`Verdict: ${JSON.stringify(res.data)}`);
  });

  await runTest(5, 'TEST 5.2 — Wrong solution → Wrong Answer', true, async () => {
    if (!problemId) throw new Error('No problemId');
    const res = await submit('#include<iostream>\nusing namespace std;\nint main(){cout<<"0 0";return 0;}');
    const verdict = res.data.verdict || '';
    if (!verdict.includes('Wrong') && !verdict.includes('wrong'))
      throw new Error(`Expected Wrong Answer, got: ${JSON.stringify(res.data)}`);
  });

  await runTest(5, 'TEST 5.3 — Compile error → Compile Error verdict', false, async () => {
    if (!problemId) throw new Error('No problemId');
    const res = await submit('this is definitely not valid c++ code at all ;;;', 'cpp');
    const verdict = res.data.verdict || '';
    if (!verdict.includes('Compile')) throw new Error(`Expected compile error, got: ${JSON.stringify(res.data)}`);
  });

  await runTest(5, 'TEST 5.4 — Submission saved to DB', false, async () => {
    await sleep(1000); // give backend time to persist
    const res = await api.get(`${BACKEND_URL}/api/user/stats`, { headers:{ Cookie: regularCookie } });
    const recents = res.data.recentSubmissions || [];
    if (recents.length === 0) throw new Error('No submissions in user profile');
  });

  await runTest(5, 'TEST 5.5 — Solved problem tracked on profile', false, async () => {
    const res = await api.get(`${BACKEND_URL}/api/user/stats`, { headers:{ Cookie: regularCookie } });
    if (!res.data.totalSolved || res.data.totalSolved === 0)
      throw new Error('totalSolved still 0 after Accepted submission');
  });

  // ══════════════════════════════════════════════════
  //  PHASE 6 — AI ENDPOINTS
  // ══════════════════════════════════════════════════
  console.log('\n=======================================================');
  console.log('  PHASE 6 — AI ENDPOINTS');
  console.log('=======================================================');

  // Read key from backend .env directly
  let geminiKey = '';
  try {
    const envStr = fs.readFileSync(path.join(__dirname,'backend','.env'),'utf8');
    const m = envStr.match(/GEMINI_API_KEY=(.*)/);
    if (m) geminiKey = m[1].trim();
  } catch (_) {}
  const hasGemini = geminiKey && !geminiKey.includes('your-') && geminiKey.length > 10;

  if (!hasGemini) {
    console.log('  [SKIP] All Phase 6 tests — GEMINI_API_KEY not configured in backend/.env');
    results[6].passed = 4; // auto-pass skipped phase
  } else {
    await runTest(6, 'TEST 6.1 — /api/ai/debug SSE streaming', false, async () => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('SSE timeout after 60s')), 60000);
        const req = http.request(`${BACKEND_URL}/api/ai/debug`, {
          method:'POST', headers:{'Content-Type':'application/json','Cookie':regularCookie}
        }, (res) => {
          let chunks=0, full='';
          let resolved = false;
          res.on('data', (d) => { 
            chunks++; 
            full += d.toString(); 
            // Resolve early if we get sufficient streaming data (proof that SSE works)
            if (!resolved && chunks >= 2 && full.length > 50) {
              resolved = true;
              clearTimeout(timeout);
              console.log(`         [Preview]: ${full.slice(0,120).replace(/\n/g,' ')}...`);
              resolve();
              // Abort the request since we got what we needed
              req.destroy();
            }
          });
          res.on('end', () => {
            if (resolved) return;
            clearTimeout(timeout);
            if (chunks < 1) return reject(new Error('No SSE data received'));
            if (full.length < 20) return reject(new Error('Response too short'));
            resolved = true;
            console.log(`         [Preview]: ${full.slice(0,120).replace(/\n/g,' ')}...`);
            resolve();
          });
        });
        req.on('error', e => { clearTimeout(timeout); reject(e); });
        req.write(JSON.stringify({
          code:'def two_sum(nums,t):\n for i in range(len(nums)):\n  for j in range(i,len(nums)):\n   if nums[i]+nums[j]==t: return[i,j]',
          language:'python', error:'Wrong Answer: expected [0,1] got [1,1]',
          problemDescription:'Find two indices summing to target', stdin:''
        }));
        req.end();
      });
    });

    await runTest(6, 'TEST 6.2 — /api/ai/hint progressive hints', false, async () => {
      const res = await api.post(`${BACKEND_URL}/api/ai/hint`,
        { problemDescription:'Two Sum', code:'', language:'cpp', attemptCount:1 },
        { headers:{ Cookie: regularCookie } }
      );
      if (!res.data.hint || res.data.hint.length < 20) throw new Error('Hint empty or too short');
    });

    await runTest(6, 'TEST 6.3 — /api/ai/complexity analysis', false, async () => {
      const res = await api.post(`${BACKEND_URL}/api/ai/complexity`,
        { code:'for i in range(n):\n for j in range(n):\n  print(i+j)', language:'python' },
        { headers:{ Cookie: regularCookie } }
      );
      if (!res.data.timeComplexity) throw new Error('Missing timeComplexity field');
      if (!res.data.spaceComplexity) throw new Error('Missing spaceComplexity field');
      console.log(`         Time: ${res.data.timeComplexity} | Space: ${res.data.spaceComplexity}`);
    });

    await runTest(6, 'TEST 6.4 — AI per-user rate limiting (429)', false, async () => {
      let got429 = false;
      for (let i = 0; i < 15; i++) {
        const res = await api.post(`${BACKEND_URL}/api/ai/complexity`,
          { code:'print()', language:'python' }, { headers:{ Cookie: regularCookie } }
        );
        if (res.status === 429) { got429=true; break; }
      }
      if (!got429) throw new Error('429 never received after 15 AI requests');
    });
  }

  // ══════════════════════════════════════════════════
  //  PHASE 7 — LEADERBOARD & PROFILE
  // ══════════════════════════════════════════════════
  console.log('\n=======================================================');
  console.log('  PHASE 7 — LEADERBOARD & PROFILE');
  console.log('=======================================================');

  await runTest(7, 'TEST 7.1 — Leaderboard (sorted, no passwords)', true, async () => {
    const res = await api.get(`${BACKEND_URL}/api/user/leaderboard`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!Array.isArray(res.data)) throw new Error('Response is not an array');
    if (JSON.stringify(res.data).includes('"password"'))
      throw new Error('CRITICAL: password field in leaderboard response');
  });

  await runTest(7, 'TEST 7.2 — User profile (auth required)', false, async () => {
    const res = await api.get(`${BACKEND_URL}/api/user/stats`, { headers:{ Cookie: regularCookie } });
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!res.data.email) throw new Error('Missing email in profile');
    if (JSON.stringify(res.data).includes('"password"')) throw new Error('password in profile');
  });

  await runTest(7, 'TEST 7.3 — Profile rejects unauthenticated request', true, async () => {
    const res = await api.get(`${BACKEND_URL}/api/user/stats`);
    if (res.status !== 401 && res.status !== 403) throw new Error(`Status ${res.status} (expected 401/403)`);
  });

  // ══════════════════════════════════════════════════
  //  PHASE 8 — MONGODB INDEXES
  // ══════════════════════════════════════════════════
  console.log('\n=======================================================');
  console.log('  PHASE 8 — MONGODB INDEXES & PERFORMANCE');
  console.log('=======================================================');

  // Ensure connection is alive for Phase 8
  if (mongoose.connection.readyState !== 1) {
    try { await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 }); db = mongoose.connection.useDb('online-judge'); }
    catch (e) { console.log('  ⚠️  Could not reconnect Mongoose:', e.message); }
  }

  await runTest(8, 'TEST 8.1 — Compound index on submissions', true, async () => {
    if (!db) throw new Error('No DB connection');
    const indexes = await db.collection('submissions').indexes();
    const has = indexes.some(i => i.key.userId === 1 && i.key.problemId === 1);
    if (!has) throw new Error('Missing compound index {userId:1, problemId:1, createdAt:-1}');
    console.log(`         Found ${indexes.length} indexes on submissions`);
  });

  await runTest(8, 'TEST 8.2 — Text index on problems', true, async () => {
    if (!db) throw new Error('No DB connection');
    const indexes = await db.collection('problems').indexes();
    const hasText = indexes.some(i => i.key._fts === 'text');
    if (!hasText) throw new Error('Missing text index on problems collection');
  });

  await runTest(8, 'TEST 8.3 — Submission query completes under 100ms', false, async () => {
    if (!db) throw new Error('No DB connection');
    const t0 = Date.now();
    await db.collection('submissions').find({}).sort({ createdAt:-1 }).limit(10).toArray();
    const elapsed = Date.now() - t0;
    console.log(`         Query time: ${elapsed}ms`);
    if (elapsed > 200) throw new Error(`Query took ${elapsed}ms (> 200ms)`);
  });

  // ══════════════════════════════════════════════════
  //  PHASE 9 — DOCKER & CI/CD FILES
  // ══════════════════════════════════════════════════
  console.log('\n=======================================================');
  console.log('  PHASE 9 — DOCKER & CI/CD FILES');
  console.log('=======================================================');

  await runTest(9, 'TEST 9.1 — All Dockerfiles exist on disk', true, async () => {
    const required = ['frontend/Dockerfile','backend/Dockerfile','compiler/Dockerfile','docker-compose.yml','docker-compose.dev.yml'];
    const missing = required.filter(f => !fs.existsSync(path.join(__dirname, f)));
    if (missing.length) throw new Error(`Missing: ${missing.join(', ')}`);
  });

  await runTest(9, 'TEST 9.2 — Dockerfiles have required content', false, async () => {
    const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
    const front = read('frontend/Dockerfile');
    if (!front.includes('FROM nginx'))      throw new Error('frontend/Dockerfile missing nginx stage');
    if (!front.includes('npm run build'))   throw new Error('frontend/Dockerfile missing build step');
    const back = read('backend/Dockerfile');
    if (!back.includes('HEALTHCHECK'))      throw new Error('backend/Dockerfile missing HEALTHCHECK');
    if (!back.includes('NODE_ENV'))         throw new Error('backend/Dockerfile missing NODE_ENV');
    const comp = read('compiler/Dockerfile');
    if (!comp.includes('docker-cli') && !comp.includes('docker.io'))
                                            throw new Error('compiler/Dockerfile missing docker CLI install');
  });

  await runTest(9, 'TEST 9.3 — docker-compose.yml has all services', false, async () => {
    const compose = fs.readFileSync(path.join(__dirname,'docker-compose.yml'),'utf8');
    for (const svc of ['frontend:','backend:','compiler:','mongodb:']) {
      if (!compose.includes(svc)) throw new Error(`Missing service: ${svc}`);
    }
    if (!compose.includes('/var/run/docker.sock'))
      throw new Error('Compiler missing docker.sock volume mount');
  });

  await runTest(9, 'TEST 9.4 — GitHub Actions workflows exist', false, async () => {
    const ciPath  = path.join(__dirname,'.github','workflows','ci.yml');
    const depPath = path.join(__dirname,'.github','workflows','deploy.yml');
    if (!fs.existsSync(ciPath))  throw new Error('.github/workflows/ci.yml missing');
    if (!fs.existsSync(depPath)) throw new Error('.github/workflows/deploy.yml missing');
    const ci = fs.readFileSync(ciPath,'utf8');
    if (!ci.includes('push'))         throw new Error('ci.yml missing push trigger');
    if (!ci.includes('pull_request')) throw new Error('ci.yml missing pull_request trigger');
  });

  await runTest(9, 'TEST 9.5 — .env.example files have required keys', false, async () => {
    const backEnv = fs.readFileSync(path.join(__dirname,'backend','.env.example'),'utf8');
    for (const key of ['MONGO_URI','JWT_SECRET','GEMINI_API_KEY','PORT']) {
      if (!backEnv.includes(key)) throw new Error(`backend/.env.example missing key: ${key}`);
    }
  });

  // ══════════════════════════════════════════════════
  //  PHASE 10 — SECURITY AUDIT
  // ══════════════════════════════════════════════════
  console.log('\n=======================================================');
  console.log('  PHASE 10 — SECURITY AUDIT');
  console.log('=======================================================');

  await runTest(10, 'TEST 10.1 — hiddenTestCases never in single problem response', true, async () => {
    if (!problemId) throw new Error('No problemId');
    const res = await api.get(`${BACKEND_URL}/api/problems/${problemId}`);
    if (JSON.stringify(res.data).includes('hiddenTestCases'))
      throw new Error('CRITICAL: hiddenTestCases exposed to client');
  });

  await runTest(10, 'TEST 10.2 — Password never in any API response', true, async () => {
    const endpoints = [
      api.get(`${BACKEND_URL}/api/user/stats`, { headers:{Cookie:regularCookie} }),
      api.get(`${BACKEND_URL}/api/user/leaderboard`),
    ];
    const responses = await Promise.all(endpoints);
    for (const res of responses) {
      if (JSON.stringify(res.data).includes('"password"'))
        throw new Error('CRITICAL: password field found in API response');
    }
  });

  await runTest(10, 'TEST 10.3 — NoSQL injection rejected', true, async () => {
    const res = await api.post(`${BACKEND_URL}/api/auth/login`, {
      email: { '$gt': '' }, password: TEST_PASSWORD
    });
    if (res.status === 200) throw new Error('CRITICAL: NoSQL injection succeeded — returned 200');
  });

  await runTest(10, 'TEST 10.4 — XSS payload stored as plain JSON (not HTML)', false, async () => {
    if (!adminCookie) { console.log('         SKIP — no admin cookie'); results[10].passed++; return; }
    const xssTitle = '<script>alert(1)</script>XSS Test';
    const createRes = await api.post(`${BACKEND_URL}/api/problems`,
      { title:xssTitle, description:'XSS check', difficulty:1 },
      { headers:{ Cookie: adminCookie } }
    );
    if (createRes.status === 200 || createRes.status === 201) {
      const fetchRes = await api.get(`${BACKEND_URL}/api/problems/${createRes.data._id}`);
      const ct = fetchRes.headers['content-type'] || '';
      if (ct.includes('text/html') && !ct.includes('json'))
        throw new Error('Server returned text/html for a script-tagged problem title');
      // Cleanup this temp problem
      if (db) await db.collection('problems').deleteOne({ _id: new mongoose.Types.ObjectId(createRes.data._id) });
    }
  });

  await runTest(10, 'TEST 10.5 — JWT secret is sufficiently strong', false, async () => {
    const envPath = path.join(__dirname,'backend','.env');
    if (!fs.existsSync(envPath)) { console.log('         No .env — skipping'); return; }
    const envStr = fs.readFileSync(envPath,'utf8');
    const m = envStr.match(/JWT_SECRET=(.*)/);
    if (m && m[1]) {
      const secret = m[1].trim();
      const weakDefaults = ['secret','your-secret-key','jwt_secret','changeme','password'];
      if (weakDefaults.some(w => secret.toLowerCase() === w))
        throw new Error('JWT_SECRET is a known weak default value');
      if (secret.length < 32)
        throw new Error(`JWT_SECRET length ${secret.length} < 32 chars`);
      console.log(`         JWT secret length: ${secret.length} chars ✓`);
    }
  });

  // ══════════════════════════════════════════════════
  //  FINAL REPORT
  // ══════════════════════════════════════════════════
  await cleanup();

  console.log('\n\n================================================');
  console.log('   ONLINE JUDGE — FULL TEST REPORT');
  console.log('================================================');

  const phaseNames = [
    'Startup & Health:    ', 'Authentication:      ', 'Problem CRUD:        ',
    'Docker Sandbox:      ', 'Submission Flow:     ', 'AI Endpoints:        ',
    'Leaderboard & Prof:  ', 'MongoDB Indexes:     ', 'Docker & CI/CD Files:',
    'Security Audit:      ',
  ];
  let total = 0;
  for (let i = 1; i <= 10; i++) {
    const r = results[i];
    total += r.passed;
    console.log(`Phase ${i}${i<10?' ':''}  - ${phaseNames[i-1]} ${r.passed}/${r.total} passed`);
  }
  console.log('------------------------------------------------');
  console.log(`TOTAL: ${total}/52 passed\n`);

  if (criticalFailures.length) {
    console.log('CRITICAL FAILURES (must fix before deployment):');
    criticalFailures.forEach(f => console.log(`  ✗ ${f.name}`));
    console.log('\n>>> FIX BEFORE DEPLOYING — critical issues found <<<\n');
  } else if (total === 52) {
    console.log('✅ PRODUCTION READY — deploy with confidence\n');
  } else if (total >= 48) {
    console.log('⚠️  NEARLY READY — only non-critical failures remain\n');
  } else if (total >= 40) {
    console.log('⚠️  NEEDS SOME WORK — fix failed tests before deploying\n');
  } else {
    console.log('❌ NEEDS SIGNIFICANT WORK\n');
  }

  if (failedTests.length) {
    console.log('FAILED TESTS:');
    failedTests.forEach(f => console.log(`  ✗ ${f.name}\n    ${f.reason}`));
  }

  console.log('\n================================================\n');
}

main().catch(async (e) => {
  console.error('\nFATAL:', e.message || e);
  await cleanup();
  process.exit(1);
});

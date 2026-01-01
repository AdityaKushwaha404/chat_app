import { io } from 'socket.io-client';

const API = process.env.API_URL || 'http://localhost:3000';

function sleep(ms){ return new Promise(res => setTimeout(res, ms)); }

async function waitForServer(timeout = 10000){
  const start = Date.now();
  while(Date.now() - start < timeout){
    try{
      const r = await fetch(`${API}/`);
      if (r.ok) return true;
    }catch(e){/* ignore */}
    await sleep(300);
  }
  return false;
}

async function fetchJson(url, opts, retries = 0){
  try{
    const res = await fetch(url, opts);
    const j = await res.json().catch(()=>null);
    return { ok: res.ok, status: res.status, body: j };
  }catch(err){
    if (retries > 0){
      await sleep(300);
      return fetchJson(url, opts, retries - 1);
    }
    throw err;
  }
}

async function registerIfNeeded(email, name, password){
  const url = `${API}/api/auth/register`;
  const res = await fetchJson(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name, email, password }) }, 1).catch(()=>null);
  if (res && res.ok) return res.body?.data?.token;
  // if already exists try login
  const login = await fetchJson(`${API}/api/auth/login`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) }, 1).catch(()=>null);
  if (login && login.ok) return login.body.data?.token;
  throw new Error('register/login failed');
}

async function verifyToken(token){
  const res = await fetchJson(`${API}/api/auth/verify`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } }, 1);
  if (!res || !res.ok) throw new Error('verify failed');
  return res.body.data?.user;
}

async function createConversation(token, payload){
  const res = await fetchJson(`${API}/api/conversations`, { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }, 1);
  if (!res || !res.ok) throw new Error('create conv failed: '+JSON.stringify(res && res.body));
  return res.body.data;
}

async function run(){
  try{
    console.log('Smoke test start — API', API);
    const ready = await waitForServer(8000);
    if (!ready) throw new Error('API not responding at ' + API);

    const pw = 'Password123!';
    const t1 = await registerIfNeeded('smoke.alice@example.com', 'Alice Smoke', pw);
    const t2 = await registerIfNeeded('smoke.bob@example.com', 'Bob Smoke', pw);
    console.log('Tokens acquired (trim):', t1?.slice(0,30)+'...', t2?.slice(0,30)+'...');

    const user1 = await verifyToken(t1);
    const user2 = await verifyToken(t2);
    console.log('User ids:', user1.id, user2.id);

    // connect sockets
    const s1 = io(API, { auth: { token: t1 }, transports:['websocket'], reconnectionAttempts: 3 });
    const s2 = io(API, { auth: { token: t2 }, transports:['websocket'], reconnectionAttempts: 3 });

    function log(...args){ console.log(new Date().toISOString(), ...args); }

    s1.on('connect', ()=> log('s1 connected', s1.id));
    s2.on('connect', ()=> log('s2 connected', s2.id));

    s1.on('conversation:joined', (m)=> log('s1 conversation:joined', m && (m.conversation?._id || m.conversation)));
    s2.on('conversation:joined', (m)=> log('s2 conversation:joined', m && (m.conversation?._id || m.conversation)));

    s1.on('message:new', (m)=> log('s1 message:new', m._id, m.content, 'from', m.senderName || m.senderId));
    s2.on('message:new', (m)=> log('s2 message:new', m._id, m.content, 'from', m.senderName || m.senderId));

    s1.on('message:read', (m)=> log('s1 message:read', m));
    s2.on('message:read', (m)=> log('s2 message:read', m));

    // wait for connections
    await Promise.race([new Promise(r=>s1.on('connect',r)), new Promise(r=>setTimeout(r,5000))]);
    await Promise.race([new Promise(r=>s2.on('connect',r)), new Promise(r=>setTimeout(r,5000))]);

    // create direct conversation from user1 to user2
    log('creating conversation (direct) via REST');
    const conv = await createConversation(t1, { type: 'direct', participants: [user2.id] });
    log('conversation created', conv._id || conv.id);

    // both join via socket
    s1.emit('joinConversation', { conversationId: conv._id || conv.id }, (resp)=> log('s1 join cb', resp && resp.success));
    s2.emit('joinConversation', { conversationId: conv._id || conv.id }, (resp)=> log('s2 join cb', resp && resp.success));

    await sleep(500);

    // s1 sends a message
    log('s1 sending message');
    s1.emit('sendMessage', { conversationId: conv._id || conv.id, content: 'Hello from Alice' }, (resp)=> log('s1 send cb', resp && resp.success));

    // s2 marks the last message as read when received
    s2.once('message:new', (m)=>{
      log('s2 received message:new, now mark read', m._id);
      s2.emit('message:read', { conversationId: conv._id || conv.id, messageId: m._id }, (r)=> log('s2 read cb', r));
    });

    // wait a bit for read to propagate
    await sleep(1200);

    // Cleanup
    s1.disconnect(); s2.disconnect();
    log('Test complete');
    process.exit(0);
  }catch(err){
    console.error('Smoke test error', err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

run();

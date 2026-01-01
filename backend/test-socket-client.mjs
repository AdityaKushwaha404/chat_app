import { io } from "socket.io-client";

const API = "http://localhost:3000";

async function run() {
  try {
    const loginRes = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'Password123' })
    });

    const j = await loginRes.json();
    if (!j || !j.success) {
      console.error('Login failed', j);
      process.exit(1);
    }

    const token = j.data?.token;
    if (!token) {
      console.error('No token received');
      process.exit(1);
    }

    console.log('Got token, connecting socket...');

    const socket = io(API, { auth: { token }, transports: ['websocket'] });

    socket.on('connect', () => {
      console.log('Socket connected', socket.id);
      socket.emit('test:ping', { ts: Date.now() }, (res) => {
        console.log('test:ping response:', res);
        socket.disconnect();
        process.exit(0);
      });
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connect_error', err);
      process.exit(1);
    });

  } catch (err) {
    console.error('Test client error', err);
    process.exit(1);
  }
}

run();

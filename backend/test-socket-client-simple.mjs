import jwt from 'jsonwebtoken';
import { io } from 'socket.io-client';

const API = 'http://localhost:3000';
const JWT_SECRET = 'dev_jwt_secret_for_local'; // matches backend/.env

async function run() {
  try {
    const payload = { user: { id: 'manual-test-id', name: 'ManualTest', email: 'manual@example.com' } };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1m' });
    console.log('Generated token:', token.slice(0, 40) + '...');

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
      console.error('Socket connect_error', err.message || err);
      process.exit(1);
    });

  } catch (err) {
    console.error('Error in test client', err);
    process.exit(1);
  }
}

run();

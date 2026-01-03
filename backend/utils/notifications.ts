import admin from 'firebase-admin';
import type { Server as SocketIOServer } from 'socket.io';

let initialized = false;

export function initFirebase() {
  if (initialized) return;
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!sa) {
    console.warn('FCM not configured: FIREBASE_SERVICE_ACCOUNT_JSON missing');
    return;
  }
  try {
    const creds = JSON.parse(sa);
    admin.initializeApp({ credential: admin.credential.cert(creds) });
    initialized = true;
    console.log('Firebase admin initialized');
  } catch (e) {
    console.warn('Failed to init Firebase admin', e);
  }
}

export async function sendPushToTokens(tokens: string[], payload: { title: string; body: string; data?: Record<string,string> }) {
  if (!initialized) initFirebase();
  if (!initialized) return;
  try {
    const chunks = chunk(tokens, 500); // FCM limit per call
    for (const tok of chunks) {
      await admin.messaging().sendMulticast({ tokens: tok, notification: { title: payload.title, body: payload.body }, data: payload.data || {} });
    }
  } catch (e) {
    console.warn('FCM send error', e);
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i=0;i<arr.length;i+=size) out.push(arr.slice(i, i+size));
  return out;
}

export function isUserOnline(io: SocketIOServer, userId: string): boolean {
  try {
    const room = io.sockets.adapter.rooms.get(`user:${userId}`);
    return !!(room && room.size && room.size > 0);
  } catch {
    return false;
  }
}

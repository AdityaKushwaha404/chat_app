import axios from 'axios';

// Simple in-memory dedupe cache per process
const sentCache = new Set<string>(); // key: `${userId}:${messageId}`

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, any>;
  collapseKey?: string;
};

export async function sendFcmToTokens(tokens: string[], payload: PushPayload) {
  const serverKey = process.env.FIREBASE_SERVER_KEY;
  if (!serverKey) throw new Error('Missing FIREBASE_SERVER_KEY');
  if (!tokens || tokens.length === 0) return;

  const url = 'https://fcm.googleapis.com/fcm/send';
  const body: any = {
    registration_ids: tokens,
    notification: {
      title: payload.title,
      body: payload.body,
      sound: 'default',
    },
    data: payload.data || {},
  };
  if (payload.collapseKey) body.collapse_key = payload.collapseKey;

  await axios.post(url, body, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `key=${serverKey}`,
    },
    timeout: 10000,
  });
}

export function shouldSend(userId: string, messageId: string): boolean {
  const key = `${userId}:${messageId}`;
  if (sentCache.has(key)) return false;
  sentCache.add(key);
  return true;
}

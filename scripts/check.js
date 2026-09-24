import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf-8'));

initializeApp({
  credential: cert(serviceAccount),
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL
});

const db = getDatabase();

async function check() {
  const snap = await db.ref('circuits/c1').once('value');
  console.log('c1:', snap.val());
  process.exit(0);
}

check();

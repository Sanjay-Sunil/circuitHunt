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

async function fixTeams() {
  try {
    const teamsRef = db.ref('teams');
    const snap = await teamsRef.once('value');
    if (snap.exists()) {
      const updates = {};
      snap.forEach(child => {
        const team = child.val();
        if (team.circuitId && team.circuitId.startsWith('circuit_')) {
          const newId = team.circuitId.replace('circuit_', 'c');
          console.log(`Fixing team ${team.teamName} (${child.key}): ${team.circuitId} -> ${newId}`);
          updates[`${child.key}/circuitId`] = newId;
        }
      });
      if (Object.keys(updates).length > 0) {
        await teamsRef.update(updates);
        console.log('Successfully fixed teams!');
      } else {
        console.log('No teams needed fixing.');
      }
    } else {
      console.log('No teams found.');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fixTeams();

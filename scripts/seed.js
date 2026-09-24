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

const outpostsSlugs = JSON.parse(readFileSync('./outpost-slugs.json', 'utf-8'));

const data = {
  "components": {
    "temp_sensor": { "name": "Temperature Sensor" },
    "buzzer": { "name": "Buzzer" },
    "potentiometer": { "name": "Potentiometer" },
    "capacitor": { "name": "Capacitor" },
    "push_button": { "name": "Push Button" },
    "led": { "name": "LED" },
    "ultrasonic_sensor": { "name": "Ultrasonic Sensor" },
    "photoresistor": { "name": "Photoresistor" },
    "resistor": { "name": "Resistor" }
  },
  "outposts": {
    "outpost1": {
      "name": "Outpost 1",
      "slug": outpostsSlugs.outpost1,
      "prices": {
        "temp_sensor": [20, 25, 30, 35],
        "buzzer": [15, 20, 25, 30],
        "potentiometer": [10, 15, 20, 25],
        "capacitor": [5, 10, 15, 20],
        "push_button": [5, 10, 15, 20],
        "led": [5, 10, 15, 20]
      }
    },
    "outpost2": {
      "name": "Outpost 2",
      "slug": outpostsSlugs.outpost2,
      "prices": {
        "ultrasonic_sensor": [40, 45, 50, 35],
        "buzzer": [20, 25, 30, 15],
        "potentiometer": [15, 20, 25, 10],
        "photoresistor": [15, 20, 25, 10],
        "push_button": [10, 15, 20, 5],
        "led": [10, 15, 20, 5],
        "resistor": [10, 15, 20, 5]
      }
    },
    "outpost3": {
      "name": "Outpost 3",
      "slug": outpostsSlugs.outpost3,
      "prices": {
        "ultrasonic_sensor": [45, 50, 35, 40],
        "temp_sensor": [30, 35, 20, 25],
        "potentiometer": [20, 25, 10, 15],
        "photoresistor": [20, 25, 10, 15],
        "capacitor": [15, 20, 5, 10],
        "led": [15, 20, 5, 10],
        "resistor": [15, 20, 5, 10]
      }
    },
    "outpost4": {
      "name": "Outpost 4",
      "slug": outpostsSlugs.outpost4,
      "prices": {
        "ultrasonic_sensor": [50, 35, 40, 45],
        "temp_sensor": [35, 20, 25, 30],
        "buzzer": [30, 15, 20, 25],
        "photoresistor": [25, 10, 15, 20],
        "capacitor": [20, 5, 10, 15],
        "push_button": [20, 5, 10, 15],
        "resistor": [20, 5, 10, 15]
      }
    }
  },
  "circuits": {
    "c1": { "name": "Circuit 1", "required": ["photoresistor", "led", "resistor"], "budget": 25 },
    "c2": { "name": "Circuit 2", "required": ["push_button", "potentiometer", "led", "resistor"], "budget": 30 },
    "c3": { "name": "Circuit 3", "required": ["temp_sensor", "buzzer", "resistor"], "budget": 45 },
    "c4": { "name": "Circuit 4", "required": ["push_button", "capacitor", "buzzer"], "budget": 30 },
    "c5": { "name": "Circuit 5", "required": ["ultrasonic_sensor", "led", "resistor"], "budget": 50 },
    "c6": { "name": "Circuit 6", "required": ["ultrasonic_sensor", "temp_sensor", "buzzer"], "budget": 75 },
    "c7": { "name": "Circuit 7", "required": ["push_button", "buzzer", "photoresistor"], "budget": 35 },
    "c8": { "name": "Circuit 8", "required": ["led", "resistor", "buzzer"], "budget": 30 }
  },
  "meta": {
    "circuitAssignmentCounts": {
      "c1": 0, "c2": 0, "c3": 0, "c4": 0, "c5": 0, "c6": 0, "c7": 0, "c8": 0
    }
  },
  "gameConfig": {
    "status": "not_started",
    "startingBalance": 200,
    "gameStartTimestamp": null
  }
};

async function seed() {
  try {
    await db.ref('/').update(data);
    console.log('Seed data successfully written to database!');
    console.log(`Database URL: ${process.env.VITE_FIREBASE_DATABASE_URL}`);
    process.exit(0);
  } catch (err) {
    console.error('Error seeding data:', err);
    process.exit(1);
  }
}

seed();

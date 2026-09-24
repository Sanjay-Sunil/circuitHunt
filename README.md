# Circuit Hunt 🔌

Circuit Hunt is a real-world, interactive treasure hunt event built for IIIT Kottayam. Teams of students physically navigate between various "Outposts", buying, selling, and swapping electronic components to successfully assemble a randomly assigned hardware circuit.

This documentation serves as a comprehensive guide for **Players**, **Organizers**, and **Developers**.

---

## 🎮 For Players (The Game Flow)

Players must use their `@iiitkottayam.ac.in` Google accounts to participate. The game is designed for mobile browsers.

### The Player Journey
1. **`/login` (Entry Point):** Players arrive here and authenticate via Google. Only authorized institutional domains are permitted.
2. **`/register`:** If it's the team's first time playing, the leader enters the Team Name and Member Names. The system instantly balances and assigns them 1 of 6 possible Circuits and seeds their account with the global starting balance (e.g., ₹200).
3. **`/mission`:** A temporary, one-time screen revealing the circuit they must build.
4. **`/home` (The Dashboard):** The main hub. Displays current balance, the required components for their circuit, and which ones they have successfully acquired. 
5. **The QR Scanner:** Found on `/home`, players use their phone camera to scan physical QR codes placed at real-world "Outposts".
6. **`/market` (Trading):** Upon scanning an outpost's QR code, the player is securely routed to `/market` for that specific outpost. 
   - **Buy:** Purchase components the outpost is selling.
   - **Swap:** Trade in a component you already own for a different one at that outpost (paying or receiving the price difference).
   - **Sell:** Sell a component back to the outpost for exactly what you paid for it.
   - *Note:* Component prices fluctuate every 10 minutes according to a global clock!
7. **`/finished`:** The moment a team acquires their final required component, the system locks their account from further trades, records their exact finish time, and sends them to the completion screen to show to an organizer.

---

## 🛠️ For Organizers (Event Management)

Organizers control the flow of the game, monitor teams in real-time, and handle physical setup.

### The Organizer Routes
- **`/admin/login`:** Gated by the master passcode (`VITE_ADMIN_PASSCODE` in your `.env` file). Only one admin device can be logged in at a time.
- **`/admin/dashboard`:** The central command center.
  - **Game Status:** Controls the global price-fluctuation clock. You must click **Start Global Clock** to begin the event (which starts the 10-minute price shifts) and **End Game** when the event is over.
  - **Starting Balance:** Adjust how much money newly registered teams receive.
  - **Danger Zone (Wipe & Reset):** Allows you to completely wipe all teams, logs, and game data to start a fresh round. If players are currently logged in, they will be seamlessly bounced back to `/register`.
  - **Live Leaderboard:** A real-time view of all teams, their progress, and their balances. Click "View Logs" to see a full audit trail of a team's financial transactions.
- **`/admin/qr`:** Generates massive, print-ready SVG QR codes for the 4 physical Outposts. **Print these out and tape them to the desks at your real-world outposts.**

---

## 💻 For Developers & Testers

### Local Setup
1. Clone the repository and run `npm install`.
2. Copy `.env.local.example` to `.env.local` (or just `.env`) and fill in your Firebase credentials and `VITE_ADMIN_PASSCODE`.
3. Start the Vite dev server: `npm run dev`.

### E2E Testing Script
For a step-by-step breakdown of how to manually test every edge case in the system (transactions, clock ticks, session kicking, etc.), refer to the [TESTING.md](./TESTING.md) file included in this repository.

### Architecture Notes
- **Firebase RTDB:** Acts as the single source of truth.
- **Atomic Transactions:** Every financial action (registration circuit assignment, buying, selling, swapping) is wrapped in Firebase `runTransaction` blocks to prevent race conditions or double-clicking bugs.
- **Single Session Enforcement:** A custom hook uses UUID tracking to ensure a team (or admin) can only have the app open on a single device/browser at any given time.
- **No Backend:** The entire application runs securely on the client side, enforced entirely by rigorous Firebase Realtime Database Security Rules (`database.rules.json`).

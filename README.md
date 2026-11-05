# Tag — online multiplayer

Create a room, enter a nickname and share its six-character code or invitation link. Two to four players
use separate browser sessions. A/D or left/right moves, W or up jumps. The player marked IT at expiry loses.

The host chooses Grass Gardens, Snow or Desert, toggles buffs, and selects 60, 120 or 180 seconds.
A settings change clears readiness. Once everyone is ready, start the match. The room menu lets the host
return everyone to the lobby. Play Again keeps the settings. A disconnect reserves the seat for 30 seconds
and transfers host control to a connected player.

## Run

Use Node 22.12+ and npm.

```sh
npm ci
npm run build
npm start
```

Open [the game](http://localhost:3001). For development, `npm run dev` runs the server, shared compiler
and Vite client. Open the URL Vite prints (normally port 5173).

For internet play, deploy the included Render Blueprint or Docker image as one persistent web service.
Then open its public HTTPS URL, create a room and use **Copy link** to invite friends.
See [deployment and backend configuration](DEPLOYMENT.md) for the exact steps.

## Simulation and tests

The server advances the shared TypeScript simulation at 60 Hz and broadcasts 20 snapshots per second.
Input prediction uses the same movement and map collision code. The server decides portal state,
pickup spawning, collection, tag transfer and round results. Reconnection receives an authoritative
snapshot including current objects and effect deadlines.

```sh
npm test
npm run test:online
npm run test:release
```

The online suite uses independent Socket.IO clients and exercises each map with two connected players.
Controlled server-side test positions cover pads and portals. It compares both clients' snapshots through
the interaction and tests buffs on/off, settings permissions, restart, recovery and host transfer.
See [the Phase 4 reference addendum](REFERENCE_ANALYSIS.md#phase-4-addendum--measured-layouts-and-pickup-behavior)
for verified pickup rules and documented approximations.

The release test builds the production artifacts and runs three clients through a bidirectional TCP
delay proxy for a full 60-second round, including reconnect and rematch. Allow about 75 seconds.

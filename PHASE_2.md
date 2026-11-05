# Phase 2 — local gameplay

Implemented one two-player grass arena using independently drawn Phaser graphics. Red uses A/D/W;
blue uses left/right/up. Choose 60, 120 or 180 seconds, then start. A white triangle marks IT.
Touch the other player to transfer IT. The tagged player at expiry loses. Play Again creates a
fresh match with the same duration. Escape/pause stops the local clock; losing window focus also
pauses and clears inputs to prevent stuck movement.

## Simulation boundary

`packages/shared/src/physics/simulation.ts` exports `createMatch` and `stepMatch` and a JSON-serializable
state. Each call advances exactly 1/60 second. No browser, Phaser, network, wall clock or randomness
is used. The client accumulates frame time and interpolates render positions. Catch-up is capped
at 250 ms per frame to avoid runaway processing after stalls. In this local build, prolonged stalls
therefore slow the match clock; Phase 3 should schedule server ticks and own the clock.

Movement: immediate horizontal response, gravity, capped fall speed, fixed-height jump, six-tick
coyote time and six-tick input buffer. Swept vertical surface crossing prevents falling through
thin ledges. Grounded players follow linear slopes. All ledges are one-way, allowing upward passage;
outer horizontal world bounds and the bottom floor contain players. Decorative trees/crates are
not colliders. Characters overlap rather than physically push each other.

Tagging uses body overlap with a 45-tick (0.75-second) transfer lock and requires a fresh contact
after separation. A contact on the final tick resolves before the loser is selected. These are
explicit reconstruction choices because the original cooldown and contact ordering were unverified.

## Fidelity and scope

The arena follows the observed grass topology: pink/green tiers, central spawn platform, upper
tree ledges, lower-left slope, right-side steps and continuous floor. Coordinates, movement constants
and sprite geometry are independently created approximations, not an exact measured reproduction.
The full arena stays visible for local testing. No extra maps, buffs, teleporters, trampolines or
online match code were added. Existing Phase 1 server scaffolding is unchanged and not needed to play.

## Validation

`npm test` covers stable ground, jump/landing, one-way surfaces, falls/bounds, thin-platform tunneling,
slope traversal, contact transfer/overlap, all three timer lengths, final-tick tagging, frozen game-over
state, reset and deterministic replay/JSON continuation. Browser checks cover rendering, actual
keyboard movement/jump/tagging, timer selection, pause, end-of-round and restart.

Run `npm run dev:local` and open http://127.0.0.1:5173/. This starts only the frontend after compiling
the shared package. Stop at Phase 2; online synchronization remains for Phase 3.

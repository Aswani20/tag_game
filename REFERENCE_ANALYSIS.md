# Tag reference analysis — Phase 1

Inspected 2026-11-03 using the in-app browser, rendered screenshots and keyboard/mouse input.
Scope: reference inspection and architecture only. No gameplay implementation.

## Sources and evidence quality

- Landing page: https://taggame.io/
- Playable wrapper reached from that page: https://taggame.io/tag-game.embed
- Game frame exposed by browser accessibility: https://taggame.io/game/tag/
- **Observed** means seen in the running game during this session.
- **Page-described** means stated by the host website, not experimentally verified.
- **Unverified** means insufficient evidence; it is not a requirement inferred from another game.
- Theme names below are our descriptive labels; the selection screen does not show map names.

The native Chrome inspection previously failed URL verification. The in-app browser worked:
played grass and snow with two players, desert with four; tested movement, jumping, settings,
pause, tag transfer and one grass round through expiry. Camera motion and zoom prevent treating
screen coordinates as world coordinates. This is a qualitative reference, not a complete measured
map reconstruction. No source code or original assets were extracted.

## Rules, controls and flow

| Feature | Finding | Evidence |
| --- | --- | --- |
| Participants | Main menu offers 2, 3 and 4 players; four-player controls were inspected. | Observed |
| Original multiplayer | Shared-device keyboard play; remote networking is an addition for this project. | Observed controls; page-described local play |
| Controls | Red: A/D move, W jump. Blue: left/right/up arrows. Yellow: J/L/I. Green: F/H/T. | Observed control diagrams; red movement tested |
| Flow | Player count → map selection/settings → controls → Start → match → result. | Observed |
| Tagger indicator | White downward triangle above the tagged character. Initially blue in one grass round and red in the snow round. | Observed; initial selection algorithm unverified |
| Tag transfer | After red traversed blue's position in grass, the indicator moved from blue to red; both remained in play. | Observed; exact contact frame and hitbox unmeasured |
| Round end | Grass countdown expired with red tagged; GAME OVER panel showed red with LOSE, plus RESTART and QUIT. | Observed |
| Winners | Avoid being the tagger at expiry; remaining players win. | Page-described; four-player result not inspected |
| Pause | Escape opens PAUSE with RESUME and EXIT; timer remained unchanged during the grass pause inspection. | Observed |
| Settings | Buffs ON/OFF; time 60/120/180 seconds. White outline marks selection. | Observed |
| Persistence | Settings state survived returning to menus and starting other rounds in this session. Dialog says settings save automatically. | Observed; browser-restart persistence untested |
| Initial settings | First inspected dialog selected OFF and 120; switched to 60 and later ON. | Observed session state, not proven factory defaults |
| HUD | Large white timer centered at top; pause icon at bottom center; GO start overlay. | Observed; full countdown sequence unmeasured |
| Audio | Music-note control at top-right of main menu. | Observed UI; audio/mute behavior not tested |
| Bots | Host page states no CPU mode. | Page-described |

Unverified rule details: tag immunity/cooldown, simultaneous contacts, exact initial-tag selection,
restart settings, ties, tag at the expiry boundary, and whether non-tagged characters collide physically.
Remote rooms, latency, disconnects, reconnection and host authority have no verified original equivalent.

## Character appearance and animation

Observed: compact dark teal/near-black rounded bodies, two pointed ear/hair shapes, oversized paired
white eyes with black pupils, small white mouth, short feet, and red/blue/yellow/green headbands with
side tails. Color is primarily on the headband, not the whole body. Characters appear much smaller
than the arena. Main-menu/pause illustrations use tilted airborne poses and curved motion strokes.

Running/jumping samples showed small white dust/motion particles around feet. The loser portrait
has a worried/open mouth and a color-matched triangle. The game uses bright simple cartoon geometry,
soft gradients and bold white display lettering. All replacement art and sound must be authored
independently; reference images are not production assets.

Unverified: sprite-sheet frame counts, animation rates, idle loop, exact squash/stretch, facing-flip
rules, landing animation duration and all audio cues. Do not claim frame-perfect reproduction.

## Movement, physics and camera

- Observed horizontal travel with held D/A, a rising jump with W, falling after walking off ledges,
  and stable standing after landing. Red returned to its original grass ledge after a vertical jump.
- The camera pans and changes scale as players separate; it does not simply follow red. Stationary
  blue stayed visible while red moved to the arena boundaries. The exact framing rule is unverified.
- Arena edges stopped further horizontal travel in the inspected snow/desert sections. Bottom ground
  supports characters; falling to it did not eliminate red.
- Thin horizontal surfaces and sloped pieces are visible. Whether each slope is a collider and whether
  platforms are one-way is not fully established. A jump directly beneath a desert ledge did not reach
  its top in the sampled frames; that alone does not prove underside collision.
- No reliable numerical speed, gravity, acceleration, jump impulse, apex time, terminal velocity,
  friction, collider dimensions or world bounds were measured. UI input duration is not a precise
  simulation clock, and camera zoom changes apparent speed.
- Double jump, air control, jump buffering, coyote time, variable jump height, held-jump repeat,
  wall jump, snow friction differences and slope response remain unverified.

## Map survey (all three entered)

These are observed topology notes, not authoritative coordinates or an exhaustive platform count.
Off-camera areas and every platform collision need a dedicated measurement pass before fidelity claims.

### Grass

Blue/cyan sky, layered blue ruins/columns, bright pink earth with narrow green tops, magenta tree
trunks, rounded green foliage, flowers and bushes; fossil silhouettes on the right outer wall.

- Central spawn area: broad mid-height horizontal platform with tree on its right; a shorter floating
  ledge above-left, another higher tree ledge above-right, and a long horizontal tier below.
- Left side: staggered short/medium ledges including tree-supported-looking sections; long lower-left
  shelf leads to a pronounced downward-right slope toward the ground.
- Right side: multiple staggered ledges, upper-right short slope, crate stack on a mid-right ledge,
  a very short ledge close to the right wall and another long ledge near the bottom.
- Continuous bottom floor and side walls visible. Pink rounded pad near bottom-right; red was airborne
  beside it after horizontal travel with no jump command, consistent with an automatic bounce.
- Small multicolor swirl objects appeared near the lower-left region and high right-wall ledge.

### Snow

Lavender sky and earth, white/icy platform caps, purple trees with white foliage, layered snowy hills,
snowmen, candy canes, snow heaps and multicolored string-light decorations.

- Central spawn platform is long and ends in a short downward-right slope.
- Wide floating shelf above center; upper-left snowman shelf; higher-right staggered ledges.
- Lower-left horizontal shelf, long low central shelf, and shorter offset lower-right platforms.
- Right side: several stair-like ledges rising toward the wall, broad mid-right shelf, yellow rounded
  pad on a lower-right shelf and a swirl on an upper-right shelf. Floor and vertical right wall visible.
- String lights bridge some gaps visually; their collision behavior was not tested.
- Full left boundary and all uppermost routes were not traversed. Ice/sliding behavior is not confirmed.

### Desert

Green-to-peach gradient sky, distant green hills, golden sandstone ledges and walls, palms, cacti,
pyramids and a sphinx-like statue. Selection thumbnail carries a small video-ticket symbol, but selecting
it proceeded directly to controls in this session; unlock/ad requirements are unverified.

- Long upper-middle spawn ledge with a palm; small isolated palm ledge above-left; high cactus ledge
  above-right; medium pyramid platform to the right beneath that.
- Left side: short wall ledges, a diagonal downward-right slope, statue atop a narrow raised structure,
  and a broad lower shelf with a blue rounded pad near its left end.
- Right side: staggered shelves near the wall and two separated downward-right slopes in lower-middle/right.
- Several narrow floating lower platforms, continuous bottom floor and both side walls observed.
- With buffs ON, small blue running-person/arrow-like symbols and pale pickup-like objects appeared.
  A multicolor swirl later appeared near the upper-left palm ledge. Effects and spawn timing not verified.

## Teleporters, trampolines and buffs

| Mechanic | Confirmed / observed | Still unverified |
| --- | --- | --- |
| Teleport | Host page describes instant relocation; multicolor swirls seen in arenas. | Swirl identification is tentative; no successful traversal/pairing experiment, velocity retention, cooldown or exact locations for all maps. |
| Trampoline | Rounded colored pads visible (pink grass, yellow snow, blue desert); grass no-jump airborne observation is consistent with auto-bounce. Host page describes a higher launch. | Exact activation region, launch speed, retrigger, whether jump can modify boost, all pad locations. |
| Buffs | ON/OFF setting toggles and persists within session; small icons appeared in ON desert round. | Complete buff list, pickup collisions, effect strengths/durations, respawn intervals, stacking and whether any are debuffs. |

Do not invent speed/jump/shield buff behavior from icon appearance. Object classifications are hypotheses
until activation is observed. Normal movement inspection used buffs OFF on grass and snow.

## Later-phase implementation plan (not implemented)

1. Resolve the highest-impact gaps: controlled physics measurements with buffs off; complete per-map
   platform/trigger survey; tag cooldown; teleport pairings; bounce and pickup experiments. Keep uncertain
   values configurable and labeled, with no claim that approximations are confirmed original behavior.
2. Implement pure shared fixed-step movement and collision functions, map schemas and deterministic tests
   for landing, slopes, contact ordering, teleport retrigger and expiry. Phaser renders the shared state;
   do not run a separate conflicting Phaser physics simulation.
3. Add server-owned rooms, player identity, settings, readiness and match lifecycle. Clients send sequenced
   inputs, not trusted positions. Validate/rate-limit messages and own timer/tag/pickups on the server.
4. Add client prediction/reconciliation and remote interpolation, then original independently authored
   character/map/UI assets and animations. Proposed initial rates: 60 Hz simulation, 20 Hz snapshots;
   these are engineering choices, not measured original rates.
5. Verify 2–4 clients under delay/disconnection, reconnect policy, input ordering, round expiry and
   visual comparisons. Decide online pause semantics explicitly; a local Escape menu must not silently
   freeze everyone's match. No hosting or deployment in Phase 1.


## Phase 4 addendum — measured layouts and pickup behavior

The original publishes a Construct level manifest and numeric expression table with its browser build.
This inspection supersedes the earlier uncertainty about platform geometry, portal configurations,
spawn bands and pickup types. Measurement sources: [level manifest](https://taggame.io/game/tag/data.json)
and [runtime tuning table](https://taggame.io/game/tag/scripts/c3runtime.js). Only gameplay measurements
were transcribed. All simulation and drawing code in this project is independently authored.

- Each arena has its own wall-to-wall arrangement of horizontal and sloped surfaces. Three translucent
  shelves in the desert use jump-through behavior. The other main platforms have solid sides and undersides.
  Grass has one trampoline at the right floor, snow has a left floor pad and a right shelf pad,
  and desert has one on the lower-left shelf beside the statue.
- All maps create players in a central horizontal band (original x 2500–3400, y 1450). Two to four players
  drop onto the central platform. The original uses random horizontal positions.
- Each map has five specific portal endpoint pairs. Entering an active endpoint moves the player to its
  partner in a special travel state. After traversal the pair is unavailable for 15 seconds and changes
  to a different pair. A trampoline launches at 1.8 times base jump strength.
- Every eight seconds, with buffs enabled, one random unused item site creates one pickup and is removed
  from the pool. Grass has 31 sites, snow 26 and desert 23. Eight frames are spawnable. The definition
  also contains small/large effects, but its spawn selection excludes them.

| Spawnable pickup | Effect |
| --- | --- |
| Speed | Double maximum run speed for seven seconds |
| Jump | 1.5 times jump strength and 0.9 times normal gravity for seven seconds |
| Swap | Exchange positions with another player, chosen randomly when several are eligible |
| Shield | Prevent incoming tags for seven seconds |
| Super | Double speed and jump strength, with 0.75 times gravity for seven seconds |
| Float | 0.1 times normal gravity for seven seconds |
| Group jump | Issue a jump to all players on pickup |
| Fade | Draw the runner at 25% opacity for seven seconds |

**Reconstruction choices.** The normalized arena is 1280 units wide. Coordinates are rounded to a tenth
of a unit, horizontal boundaries clamp the body, and the player hitbox rounds the scaled 50×65 reference
body to 17×22. Slopes use swept top and underside line segments and vertical edge checks. The top clamp
keeps airborne players inside the visible arena. The earlier project’s run response, base gravity, jump
buffer, coyote time and tag lock remain the baseline. Buff and trampoline multipliers apply to that baseline.

For fairness, the server divides the original spawn band into separate random lanes. A server-chosen seed
drives portal and pickup choices. Portal transit follows a straight line at approximately 508 arena units/sec;
release is on arrival with feet kept above the destination surface. Group jump acts on grounded players.
Repeated timed pickups refresh expiry. Overlapping speed/jump boosts use the strongest applicable modifier,
with float taking priority for gravity. These interaction details, camera framing, pickup icons, scenery,
and travel effects are approximations. Default settings use 120 seconds and buffs off, as first observed.

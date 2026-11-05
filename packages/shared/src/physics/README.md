# Shared physics boundary

`simulation.ts` implements the local match as a pure, fixed-step, serializable simulation.
The client calls `stepMatch` at 60 Hz; a future server can call the identical function.
No DOM, Phaser, Socket.IO, wall clock or randomness is used here.
Constants and one-way collision behavior are reconstruction choices, not measured original values.
See `PHASE_2.md` at the repository root for semantics and tests.

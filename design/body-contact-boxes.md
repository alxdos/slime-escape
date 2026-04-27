# Body Contact Boxes

- Status: accepted
- Created: 2026-04-23
- Updated: 2026-04-23 (follow-up: `projectiles-and-combat.md` reuses the same `contactBox` contract for projectile hit detection against `player` / `enemy` / `boss`; session-builder static/boss spawn fit is no longer part of radius-based transition debt)

## Context

[sprite-assets.md](sprite-assets.md) moved `player` / `enemy` / `boss` to rectangular PNG sprites with `worldSize`, but body contact in simulation remained circle-vs-circle through `radius` ([enemy-contact.md](enemy-contact.md)). In live checks, this created a clear mismatch between what the player sees and when contact happens: especially for tall or wide sprites, contact triggers noticeably before or after the visible boundary.

Moving the whole simulation to ellipses or arbitrary masks for the MVP is excessive. We need a minimal stable contract that:

- makes `player ↔ enemy/boss` contact closer to sprite shape;
- does not introduce heavy physics or require a separate physics engine;
- does not break the asset pipeline already accepted in story 013.

## Decision

### Scope

- The original owner of this decision is **body contact** for `player`, `enemy`, `boss`, and player clamp against arena bounds.
- After the follow-up in [projectiles-and-combat.md](projectiles-and-combat.md), the same `contactBox` is also used as the target shape for projectile hit detection against `player` / `enemy` / `boss`.
- `drop`, zone/hazard overlap, and other circle-based checks are still **not** migrated by this decision; they remain separate work.
- Body-contact shape is an axis-aligned rectangle (`contactBox`), with no rotation and no skew. The box center equals `entity.position`.

### ContactBox contract

- Shared/runtime contracts introduce this for `player`, `enemy`, and `boss`:
  ```ts
  type ContactBox = Readonly<{
    width: number;   // wu
    height: number;  // wu
  }>;
  ```
- `contactBox` is stored:
  - in `PlayerArchetype`;
  - in `PlayerSpawn` inside `SessionDefinition.player`;
  - in `EnemyArchetype`;
  - in `BossArchetype`;
  - on the corresponding runtime entities in `EntityStore`.
- For story 013, `contactBox` is a **derived field from the asset**: it equals sprite `worldSize`, derived from the same PNG and the same `PX_PER_WU` as the visual registry. No separate MD columns `contactBox.width` / `contactBox.height` are introduced.
- This is intentionally a minimal bridge between visual and gameplay. If a tighter box is needed later (for example, ignoring transparent PNG padding or adding a manual override), that will extend this decision rather than revisiting consumers.

### Body contact in CombatSystem

- `player ↔ enemy/boss` contact in `CombatSystem` no longer uses circle-vs-circle by `radius`.
- Overlap check is axis-aligned box-vs-box:
  ```ts
  abs(player.x - enemy.x) <= (player.contactBox.width + enemy.contactBox.width) / 2
  &&
  abs(player.y - enemy.y) <= (player.contactBox.height + enemy.contactBox.height) / 2
  ```
- Other `enemy-contact.md` semantics do not change: cooldown, `DamageIntent`, knockback, runtime events, and system ownership stay the same.

### Broadphase for body-contact

- For the broadphase query before body contact, `CombatSystem` uses **derived bounds radius**, not authored `radius`.
- Bounds radius does not become a new public content field. Runtime computes it as the circumscribed circle for `contactBox`:
  ```ts
  boundsRadius = Math.hypot(contactBox.width / 2, contactBox.height / 2)
  ```
- This guarantees that `queryRadius(...)` cannot miss a potential box-overlap collision.

### Arena clamp for player

- `MovementSystem` clamps the player to arena bounds through `contactBox`, not through `radius`:
  - `minX = -arena.width / 2 + player.contactBox.width / 2`
  - `maxX = +arena.width / 2 - player.contactBox.width / 2`
  - same for `Y`.
- This aligns the player's visible body with the rule "player cannot leave arena bounds".
- Chase enemies and boss movement are still not clamped to the arena by this decision, as already defined in [runtime-systems.md](runtime-systems.md).

### Relationship with existing radius fields

- This decision **does not remove** existing `radius` fields from `PlayerSpawn` / `EnemyArchetype` / `BossArchetype` in this pass.
- After this decision, `radius` is no longer the source of truth for `player ↔ enemy/boss` body contact, projectile hit detection against `player` / `enemy` / `boss`, or player clamp.
- Systems not migrated by this decision (for example, wave edge inset in `SpawnSystem`, boss melee checks, or drop overlap) may keep using `radius` until a separate review. This is explicit transition debt, not hidden semantics.

## Consequences

- Story 013 gets body contact that better matches rectangular sprites without moving to ellipses or pixel-perfect masks.
- Asset pipeline 013 expands: the same derive rule from PNG now feeds not only the visual registry, but also gameplay `contactBox` in shared content, for both body contact and projectile target overlap.
- `radius` remains a transition field for non-migrated consumers. This is an honest compromise: the current change fixes the main visual mismatch without pretending to replace every collision rule.
- A future tighter-fit variant (trimmed opaque bounds, manual override, ellipses) can extend the `contactBox` producer without breaking `CombatSystem` and `MovementSystem`.

## Related

- [sprite-assets.md](sprite-assets.md)
- [content-archetypes.md](content-archetypes.md)
- [session-definition.md](session-definition.md)
- [enemy-contact.md](enemy-contact.md)
- [runtime-systems.md](runtime-systems.md)
- [content-authoring.md](content-authoring.md)
- [../stories/013-sprite-assets-and-loader.md](../stories/013-sprite-assets-and-loader.md)

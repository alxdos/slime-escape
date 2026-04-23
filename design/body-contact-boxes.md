# Body Contact Boxes

- Status: accepted
- Created: 2026-04-23
- Updated: 2026-04-23 (follow-up: `projectiles-and-combat.md` переиспользует тот же `contactBox` контракт для projectile hit detection по `player` / `enemy` / `boss`)

## Context

[sprite-assets.md](sprite-assets.md) перевёл `player` / `enemy` / `boss` на прямоугольные PNG-спрайты с `worldSize`, но body-contact в симуляции остался circle-vs-circle через `radius` ([enemy-contact.md](enemy-contact.md)). На живой проверке это дало явный разрыв между тем, что игрок видит, и тем, когда происходит соприкосновение: особенно у вытянутых или широких спрайтов контакт срабатывает заметно раньше или позже видимой границы.

Полный переход всей симуляции на эллипсы/произвольные маски для MVP избыточен. Нужен минимальный устойчивый контракт, который:

- делает соприкосновение `player ↔ enemy/boss` ближе к форме спрайта;
- не вводит тяжёлую физику и не требует отдельного physics engine;
- не ломает уже принятый asset pipeline из истории 013.

## Decision

### Scope

- Исходный owner решения — **body-contact** для `player`, `enemy`, `boss` и player clamp по границам арены.
- После follow-up в [projectiles-and-combat.md](projectiles-and-combat.md) тот же `contactBox` также используется как target shape для projectile hit detection по `player` / `enemy` / `boss`.
- `drop`, zone/hazard overlap и прочие circle-based проверки этим решением по-прежнему **не** мигрируются; они остаются отдельной задачей.
- Форма body-contact — axis-aligned rectangle (`contactBox`), без rotation и без skew. Центр box совпадает с `entity.position`.

### ContactBox contract

- Для `player`, `enemy`, `boss` в shared/runtime-контрактах вводится:
  ```ts
  type ContactBox = Readonly<{
    width: number;   // wu
    height: number;  // wu
  }>;
  ```
- `contactBox` хранится:
  - в `PlayerArchetype`;
  - в `PlayerSpawn` внутри `SessionDefinition.player`;
  - в `EnemyArchetype`;
  - в `BossArchetype`;
  - на соответствующих runtime-сущностях в `EntityStore`.
- На горизонте истории 013 `contactBox` — **derive-поле из ассета**: оно равно sprite `worldSize`, полученному из того же PNG и того же `PX_PER_WU`, что и visual registry. Отдельных MD-колонок `contactBox.width` / `contactBox.height` не вводится.
- Это намеренно минимальный мост между visual и gameplay. Если позже понадобится tighter box (например, игнорировать прозрачные поля PNG или задавать ручной override), это будет расширение данного решения, а не пересмотр потребителей.

### Body contact in CombatSystem

- Контакт `player ↔ enemy/boss` в `CombatSystem` больше не использует circle-vs-circle по `radius`.
- Проверка overlap выполняется как axis-aligned box-vs-box:
  ```ts
  abs(player.x - enemy.x) <= (player.contactBox.width + enemy.contactBox.width) / 2
  &&
  abs(player.y - enemy.y) <= (player.contactBox.height + enemy.contactBox.height) / 2
  ```
- Остальная семантика `enemy-contact.md` не меняется: cooldown, `DamageIntent`, knockback, runtime events и owner системы остаются теми же.

### Broadphase for body-contact

- Для broadphase-запроса перед body-contact `CombatSystem` использует **derived bounds radius**, а не authored `radius`.
- Bounds radius не становится новым публичным content-полем. Он вычисляется на стороне runtime как circumscribed circle для `contactBox`:
  ```ts
  boundsRadius = Math.hypot(contactBox.width / 2, contactBox.height / 2)
  ```
- Это гарантирует, что `queryRadius(...)` не пропустит потенциальное box-overlap столкновение.

### Arena clamp for player

- `MovementSystem` clamp-ит игрока по границам арены через `contactBox`, а не через `radius`:
  - `minX = -arena.width / 2 + player.contactBox.width / 2`
  - `maxX = +arena.width / 2 - player.contactBox.width / 2`
  - аналогично для `Y`.
- Это выравнивает визуальное тело игрока и правило «игрок не выходит за границы арены».
- Chase-враги и boss-движение этим решением по-прежнему не clamp-ятся к арене, как уже зафиксировано в [runtime-systems.md](runtime-systems.md).

### Relationship with existing radius fields

- Это решение **не удаляет** существующие `radius` поля из `PlayerSpawn` / `EnemyArchetype` / `BossArchetype` в рамках данного прохода.
- После принятия этого решения `radius` больше не является источником правды для body-contact `player ↔ enemy/boss`, для projectile hit detection по `player` / `enemy` / `boss` и для player clamp.
- Системы, которые этим решением не мигрируются (например spawn inset, boss melee checks или drop overlap), могут продолжать использовать `radius` до отдельного пересмотра. Это осознанный переходный долг, а не скрытая семантика.

## Consequences

- История 013 получает body-contact, который лучше совпадает с прямоугольными спрайтами без перехода на ellipses или pixel-perfect masks.
- Asset pipeline 013 расширяется: одно и то же derive-правило из PNG теперь кормит не только visual registry, но и gameplay `contactBox` в shared content, причём и для body-contact, и для projectile target overlap.
- `radius` остаётся переходным полем для не-мигрированных consumers. Это честный компромисс: текущая правка лечит главное визуальное расхождение, не притворяясь полной заменой всех collision rules.
- Будущий tighter-fit вариант (trimmed opaque bounds, ручной override, эллипсы) может расширить producer `contactBox`, не ломая `CombatSystem` и `MovementSystem`.

## Related

- [sprite-assets.md](sprite-assets.md)
- [content-archetypes.md](content-archetypes.md)
- [session-definition.md](session-definition.md)
- [enemy-contact.md](enemy-contact.md)
- [runtime-systems.md](runtime-systems.md)
- [content-authoring.md](content-authoring.md)
- [../stories/013-sprite-assets-and-loader.md](../stories/013-sprite-assets-and-loader.md)

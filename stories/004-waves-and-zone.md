# Waves and Dark Zone

- Status: in-progress
- Created: 2026-04-19
- Updated: 2026-04-19 (добавлен knockback враг → от игрока при контакте; новая задача T8, сдвиг последующих)

## Player-facing

- Sees: тренировочный режим из 1–2 волн с передышками; во время волны видимая область арены линейно сжимается тёмной зоной, в передышке — расширяется обратно. После контакта с врагом игрок отталкивает его прочь — чем сильнее столкновение по векторам скоростей, тем дальше отскок.
- Can do: пройти волны и выжить (победа) либо погибнуть (поражение); видеть переходы между encounter-ами.

## Technical

- `EncounterDefinition` типа `wave` и `break` в `SessionDefinition`; формализованные `ZoneBehavior` и `TransitionRules` — по [../design/session-definition.md](../design/session-definition.md).
- `SpawnPlan` расширяется `'wave'` kind (счётный бюджет спавнов, темп, лимит, позиции на периметре через session RNG) — по [../design/spawn-plan.md](../design/spawn-plan.md).
- `SessionFlowSystem` доращивается до encounter transitions, публикации `win`/`loss` и session-level player-death hook — по [../design/runtime-systems.md](../design/runtime-systems.md), [../design/session-definition.md](../design/session-definition.md), [../design/health-and-death.md](../design/health-and-death.md).
- `ZoneSystem` появляется как новый модуль с scalar `margin` и режимами `disabled`/`shrinkLinear`/`expandLinear` — по [../design/zone.md](../design/zone.md).
- `MovementSystem` поддерживает `behavior: 'chase'`; `EnemyArchetype` получает `maxSpeed`/`contactDamage`/`contactCooldownMs` — по [../design/content-archetypes.md](../design/content-archetypes.md).
- Контактный урон от врагов — новая фаза в `CombatSystem`, `DamageIntent.source: 'enemyContact'`, per-enemy кулдаун — по [../design/enemy-contact.md](../design/enemy-contact.md), [../design/health-and-death.md](../design/health-and-death.md).
- Knockback враг → от игрока при каждом успешном контактном уроне (направление `enemy − player`, скорость с учётом `approachSpeed` относительной скорости, monotonically non-increasing затухание за `knockbackDurationMs`); параметры — поля `EnemyArchetype` — по [../design/enemy-contact.md](../design/enemy-contact.md), [../design/content-archetypes.md](../design/content-archetypes.md).
- Игрок становится damageable: `PlayerSpawn.maxHp`, `Player.hp/maxHp` в `EntityStore`, `PlayerSnapshot.hp/maxHp` — по [../design/content-archetypes.md](../design/content-archetypes.md), [../design/snapshot-shape.md](../design/snapshot-shape.md).
- Снапшот расширяется top-level полями `encounter`, `zone`, `waveProgress` и runtime events `win`/`loss` — по [../design/snapshot-shape.md](../design/snapshot-shape.md).
- Session RNG (`mulberry32` от `seed`) появляется как единственный источник случайности в `sim`; используется `SpawnSystem` для выбора позиций на периметре — по [../design/rng.md](../design/rng.md).
- Контент: новый `ModePreset = 'training'` (`wave1 → break → wave2`), архетипы врагов с `behavior: 'chase'` и контактным уроном — данные в `content library`, не правки систем; границы preset-id — в [../design/session-definition.md](../design/session-definition.md).
- Win condition: `allEncountersComplete`. Loss condition: `playerDeath`.

## Out of scope

- Финальный бой с боссом — `006`.
- Дроп — `005`.
- Полноценный HUD волн/таймеров и экран результата — `007`. В 004 достаточно отладочного индикатора текущего encounter, прогресса волны и HP в углу экрана и того, что снапшот несёт нужные поля, а `win`/`loss` доходят до main.
- AI-стрельба врагов и баллистические атаки — `006`.
- Сглаживание визуала зоны (rounded corners, gradient feather, цвет, blur) — деталь рендера и не часть design-контракта зоны (см. [../design/zone.md](../design/zone.md)); конкретная реализация фиксируется в Renderer.
- Sweep-collision для быстрых врагов — отложено как «контракт контента» в [../design/enemy-contact.md](../design/enemy-contact.md).

## Acceptance

- Запуск тренировочного `ModePreset` стартует первую волну: первый encounter активен, `encounter.type === 'wave'`, `zone.mode` соответствует `wave-zoneBehavior`, `waveProgress` доступен в снапшоте.
- Враги спавнятся согласно `spawnPlan`: соблюдается интервал между спавнами (`spawnIntervalMs`) и лимит одновременно живых (`maxAlive`); позиции — на периметре арены и детерминированы по `seed`.
- Тёмная зона линейно сжимается в волне (`shrinkLinear`) и расширяется в передышке (`expandLinear`); `margin` в снапшоте растёт/убывает линейно за `durationMs` и далее clamps на `toMargin`.
- Переход encounter → encounter работает по `transitionRules`: волна заканчивается, когда `dispatched == total && enemiesAliveFromThisWave == 0`; передышка — по `timer`. На переходе публикуется `encounterEnd` старого и `encounterStart` нового.
- По завершении последнего encounter публикуется ровно один `win`-event; runtime state сбрасывается, clock переходит в idle.
- При смерти игрока публикуется ровно один `loss`-event; дальнейшие тики не выполняются; повторная смерть/контакт не приводит ко второму `loss`.
- Контактный урон от врага уменьшает `player.hp` ровно на `enemy.contactDamage`; повторный урон от того же врага возможен не чаще, чем раз в `enemy.contactCooldownMs`.
- Каждый успешный контактный урон выталкивает враг прочь от игрока: на `knockbackDurationMs` враг движется с monotonically non-increasing скоростью в направлении `normalize(enemy.position − player.position)`; стартовая скорость отскока зависит от `approachSpeed` (max-зажат в нуле); во время knockback штатное `behavior` врага не применяется. Player не отталкивается. Повторный контакт после `contactCooldownMs` переписывает knockback, не складывает.
- Запуск тренировочной сессии с одинаковым `seed` дважды даёт идентичную последовательность спавнов (порядок архетипов и позиции).
- Все combat-системы, `ZoneSystem`, `SpawnSystem` и encounter transitions работают только при активной сессии; `stopSession` сбрасывает их state и не оставляет утечек сущностей.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [ ] | Расширить публичные контракты в `src/shared/**`: `session.ts` (`ZoneBehavior` union, `TransitionRules` union с полем `next`, `WaveSpawnPlan`, обязательное `PlayerSpawn.maxHp`), `snapshot.ts` (`PlayerSnapshot.hp/maxHp`, top-level `encounter`/`zone`/`waveProgress`), `events.ts` (`win`/`loss`), `content/enemies.ts` (`EnemyBehavior` union с `'chase'`, `maxSpeed`, `contactDamage`, `contactCooldownMs`, `knockbackBaseImpulse`, `knockbackVelocityScale`, `knockbackDurationMs`). Только формы и `assertNever`-готовые union-ы; реализация систем — отдельные задачи. | опоры: `design/session-definition.md`, `design/snapshot-shape.md`, `design/spawn-plan.md`, `design/content-archetypes.md`, `design/zone.md`, `design/enemy-contact.md` |
| T2 | [ ] | `src/shared/rng.ts`: `mulberry32` от `seed`, публичный `Rng` API (`nextUint32`/`nextFloat`/`nextInt`/`nextRange`); запрет `Math.random` в `src/sim/**` за пределами этого файла. Создание `Rng` в `SessionFlowSystem.start` из `SessionDefinition.seed`, проброс в `SpawnSystem` как явная зависимость. Тест на воспроизводимость одинаковой последовательности при одинаковом `seed`. | опоры: `design/rng.md`, `design/session-definition.md` |
| T3 | [ ] | Контент: новые архетипы врагов в `src/shared/content/enemies.ts` — `slime-fast` (быстрый, мало HP, средний contact damage, лёгкий и далеко отлетающий knockback) и `slime-tank` (медленный, больше HP, выше contact damage, короткий и слабый knockback); `behavior: 'chase'`, валидные `maxSpeed`/`contactDamage`/`contactCooldownMs`/`knockbackBaseImpulse`/`knockbackVelocityScale`/`knockbackDurationMs`. `PlayerSpawn` (в `players.ts`) получает `maxHp`. Существующий `training-target` обновить нулевыми knockback-полями. Соблюсти ограничения «touring через игрока» и `'stationary' ⇒ maxSpeed === 0 && contactDamage === 0 && knockbackBaseImpulse === 0 && knockbackVelocityScale === 0` на стороне content/builder с warning через `log.warn`. | опоры: `design/content-archetypes.md`, `design/enemy-contact.md`, `design/logging.md` |
| T4 | [ ] | Контент: `'training'` `ModePreset` и его builder в `src/shared/content/buildSession.ts` со структурой `wave1 → break → wave2` (две `WaveSpawnPlan` + один `break` с `transitionRules: { kind: 'timer' }`), `zoneBehavior` для `wave` (`shrinkLinear`) и `break` (`expandLinear`), `loadout: { primaryWeaponArchetypeId: PISTOL.id }`, `winCondition: { kind: 'allEncountersComplete' }`, `lossCondition: { kind: 'playerDeath' }`. Существующие `sandbox` и `sandbox-with-combat` пресеты не ломать. Конкретные числа волн/зоны — внутри builder/контента. | опоры: `design/session-definition.md`, `design/spawn-plan.md`, `design/zone.md`, `design/content-archetypes.md` |
| T5 | [ ] | `EntityStore`: `Player` получает `hp`/`maxHp` (из `SessionDefinition.player.maxHp`) и runtime `velocity: { vx, vy }`; `Enemy` получает `maxSpeed`, `contactDamage`, `contactCooldownMs`, `nextContactSimMs`, runtime `velocity: { vx, vy }` и опциональный `knockback: { vx, vy, startSimMs, endSimMs } | null`. `MovementSystem`: для `behavior: 'chase'` двигает врага к игроку с `maxSpeed`, пишет фактический `velocity` в `Enemy`; пишет `velocity` в `Player` (`input.moveDir * player.maxSpeed`); пока `simTime < enemy.knockback.endSimMs`, штатное `behavior` врага не применяется, вместо этого позиция двигается monotonically non-increasing (например, линейно) затухающим knockback velocity без clamp границами арены; по истечении knockback — возврат к штатному `behavior`. Для `'stationary'` поведение прежнее. Толерантность к `player === null`: `MovementSystem` без player — no-op. | опоры: `design/runtime-systems.md`, `design/health-and-death.md`, `design/enemy-contact.md`, `design/arena-and-coordinates.md` |
| T6 | [ ] | `SpawnSystem`: реализация `'wave'` kind по `design/spawn-plan.md`. Per-tick диспатч с условиями `dispatched < total && aliveFromThisPlan < maxAlive && simTime − lastSpawnSimMs >= spawnIntervalMs`; выбор позиции на периметре арены через session RNG (один `nextFloat` на спавн, нормированная координата вдоль периметра, сжатие на `edgeMargin + archetype.radius`); внутренний `Set<EntityId>` для отслеживания «своих» сущностей и подписка на death hook для `aliveFromThisPlan`; сброс state на `encounterEnd`; `assertNever` на неизвестный `kind`. | опоры: `design/spawn-plan.md`, `design/rng.md`, `design/health-and-death.md` |
| T7 | [ ] | `CombatSystem`: новая фаза contact intents между `lifetime cleanup` и `hit detection` по `design/enemy-contact.md`. SpatialIndex как акселератор; circle-vs-circle overlap player↔enemy; per-enemy `nextContactSimMs`; формирование `DamageIntent` с `source.kind: 'enemyContact', enemyId`; единый список intents за тик. Одновременно с каждым intent инициировать knockback на враге: `normal = normalize(enemy.position − player.position)` (fallback при нулевой дистанции — `normalize(enemy.velocity)`, иначе `(1,0)`); `approachSpeed = max(0, dot(player.velocity − enemy.velocity, normal))`; `impulseSpeed = knockbackBaseImpulse + knockbackVelocityScale * approachSpeed`; `enemy.knockback = { vx: impulseSpeed * normal.x, vy: impulseSpeed * normal.y, startSimMs: simTime, endSimMs: simTime + knockbackDurationMs }` (повторный — переписывает, не складывает). Толерантность к `player === null` (фаза no-op). Никаких новых runtime events. | опоры: `design/enemy-contact.md`, `design/projectiles-and-combat.md`, `design/runtime-systems.md` |
| T8 | [ ] | `HealthDeathSystem`: применение `enemyContact` intents через тот же путь, что и `projectile`; player получает `HasHealth` через `EntityStore`; правило «повторный intent в умершую цель игнорируется» применяется и к игроку. Толерантность к `EntityStore.player() === null` после удаления. | опоры: `design/health-and-death.md`, `design/runtime-systems.md` |
| T9 | [ ] | `ZoneSystem` как новый модуль `src/sim/ZoneSystem.ts` по `design/zone.md`: state `mode/margin/elapsedMs/from/to/duration`, инициализация из `encounter.zoneBehavior` на `encounterStart`, линейная интерполяция с clamp, сброс на `encounterEnd`, экспорт в snapshot через явный getter `zone()`. Встраивание в update order перед `SnapshotExportSystem`. Без damage и без events. | опоры: `design/zone.md`, `design/runtime-systems.md`, `design/simulation-timing.md` |
| T10 | [ ] | `SessionFlowSystem`: encounter transitions по `transitionRules` (`never`/`allEnemiesCleared`/`timer`) с правилом `next: 'sequential' | byId`; проверка раз за тик после `HealthDeathSystem` и до `SnapshotExportSystem`; публикация `encounterEnd`/`encounterStart` на переходе в один тик; завершение run при `winCondition: allEncountersComplete` (публикация `win`) и при срабатывании session-level death hook на игрока (публикация `loss`); сброс runtime state и перевод clock в idle при win/loss; повторные input/pause/resume после win/loss → `log.warn`. | опоры: `design/session-definition.md`, `design/runtime-systems.md`, `design/health-and-death.md`, `design/snapshot-shape.md`, `design/logging.md` |
| T11 | [ ] | `SnapshotExportSystem`: top-level `encounter` (id, type, index, elapsedMs), `zone` (mode, margin), `waveProgress` (dispatched/total/alive для wave-encounter; `null` для прочих), `PlayerSnapshot.hp/maxHp`. Источники: `SessionFlowSystem` (encounter), `ZoneSystem.zone()`, `SpawnSystem.waveProgress()`, `EntityStore.player()`. Чистая агрегация, без gameplay-логики. | опоры: `design/snapshot-shape.md`, `design/zone.md`, `design/spawn-plan.md` |
| T12 | [ ] | `Renderer` (main): рендер chase-врагов (цвет/радиус из `EnemyArchetype`); рендер тёмной зоны overlay-quad с фрагментным шейдером (SDF rounded box, `cornerRadius = 0.25 * arena.height`, фиксированная ширина gradient feather); отладочный текстовый оверлей с `encounter.id/type/index`, `waveProgress.dispatched/total/alive` и `player.hp/maxHp`. Числовые значения визуала зоны живут в `Renderer`, не в `design/` и не в `content library`. | опоры: `design/zone.md`, `design/snapshot-shape.md`, `design/thread-model.md`, `design/arena-and-coordinates.md` |
| T13 | [ ] | Тесты под контракт по `design/testing.md`: `SpawnSystem` для `'wave'` соблюдает `spawnIntervalMs` и `maxAlive`; завершение wave-encounter по `dispatched == total && alive == 0`; линейная интерполяция `margin` за `durationMs` и clamp; transition `wave → break → wave → win` на synthetic-clock; `loss` ровно один раз при playerDeath; повторный intent в умершего игрока не публикует второй `loss`; одинаковый `seed` → одинаковый список `(archetypeId, position)` спавнов; контактный урон от враг инициирует knockback в направлении `enemy − player` с `impulseSpeed`, согласованным с формулой; `approachSpeed = 0` при «скользящем» столкновении даёт ровно `knockbackBaseImpulse`; во время knockback штатное `behavior` врага не применяется и затухание monotonically non-increasing к нулю; повторный контакт переписывает knockback, а не складывает. | опоры: `design/testing.md`, `design/spawn-plan.md`, `design/zone.md`, `design/health-and-death.md`, `design/rng.md`, `design/enemy-contact.md` |
| T14 | [ ] | Закрытие истории: чек-лист закрытия (см. `stories/README.md`); проверка, что `Index` в `design/README.md` остался актуальным; перевод `Status` истории в `done` и обновление таблицы в `stories/README.md`. | архитектор |

## Related

- [../design/session-definition.md](../design/session-definition.md)
- [../design/runtime-systems.md](../design/runtime-systems.md)
- [../design/spawn-plan.md](../design/spawn-plan.md)
- [../design/zone.md](../design/zone.md)
- [../design/enemy-contact.md](../design/enemy-contact.md)
- [../design/rng.md](../design/rng.md)
- [../design/content-archetypes.md](../design/content-archetypes.md)
- [../design/content-boundaries.md](../design/content-boundaries.md)
- [../design/projectiles-and-combat.md](../design/projectiles-and-combat.md)
- [../design/health-and-death.md](../design/health-and-death.md)
- [../design/snapshot-shape.md](../design/snapshot-shape.md)
- [../design/thread-model.md](../design/thread-model.md)
- [../design/arena-and-coordinates.md](../design/arena-and-coordinates.md)
- [../design/simulation-timing.md](../design/simulation-timing.md)
- [../design/input-commands.md](../design/input-commands.md)
- [../design/web-stack.md](../design/web-stack.md)
- [../design/logging.md](../design/logging.md)
- [../design/testing.md](../design/testing.md)
- [../docs/GDD_CORE.md](../docs/GDD_CORE.md)
- [../docs/WAVES_AND_SCALING.md](../docs/WAVES_AND_SCALING.md)
- [../docs/SURVIVAL_SYSTEMS.md](../docs/SURVIVAL_SYSTEMS.md)
- [../docs/BOSS.md](../docs/BOSS.md)

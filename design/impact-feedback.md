# Slime Impact Feedback

- Status: accepted
- Created: 2026-04-24
- Updated: 2026-04-24

## Context

В проекте уже есть authoritative projectile hit/death в `simulation worker`
([projectiles-and-combat.md](projectiles-and-combat.md), [health-and-death.md](health-and-death.md)),
runtime events `hit`/`death` на main thread ([snapshot-shape.md](snapshot-shape.md)),
PNG-спрайты слаймов с render-only breathing ([sprite-assets.md](sprite-assets.md)) и contact
knockback через поля slime/boss архетипов ([enemy-contact.md](enemy-contact.md)).

Новый слой polish должен сделать попадания мокрыми и физичными:

- при попадании слайм выбрасывает слизь по направлению пули;
- более сильное оружие даёт более широкий/тяжёлый брызг и больший отскок;
- при смерти слайм оставляет быстрый fading-ghost и большой burst слизи;
- капли остаются на полу как небольшие пятна, коротко растекаются, потом позже исчезают;
- цвет слизи берётся из цвета целевого слайма.

Это пересекает два слоя. Визуальная слизь и ghost — presentation-only и не должны становиться
gameplay state. Projectile knockback меняет позицию enemy/boss, поэтому принадлежит симуляции.

## Decision

### Ownership split

- Симуляция владеет только authoritative последствиями:
  - projectile hit detection;
  - damage intents и death;
  - projectile knockback для живых `enemy` / `boss`;
  - runtime event payload-ами, описывающими impact.
- Renderer владеет transient impact presentation:
  - каплями слизи и пятнами на полу;
  - hit flash / hit squash impulse;
  - death ghost sprite;
  - death slime burst.
- Визуальная слизь не является `Drop`, не живёт в `EntityStore`, не попадает в snapshots,
  не имеет collision, не подбирается игроком и не влияет на исход сессии.
- История не вводит новую simulation system. Projectile knockback — side effect `CombatSystem`
  на уже существующий target knockback state; render effects — ответственность main-thread renderer.

### Runtime event payloads

- `hit` остаётся edge-фактом, которым владеет `CombatSystem`, но несёт достаточно данных для
  renderer-а без реконструкции impact state из соседних snapshot-ов:
  ```ts
  {
    kind: 'hit';
    simTime: number;
    projectileId: number;
    targetId: number;
    targetKind: 'enemy' | 'player' | 'boss';
    targetArchetypeId: string | null; // enemy/boss id; null для player
    weaponArchetypeId: string;
    damage: number;
    impactDirX: number; // нормализованное направление движения projectile
    impactDirY: number;
    x: number;
    y: number;
  }
  ```
- `death` остаётся edge-фактом, которым владеет `HealthDeathSystem`, но для projectile-caused
  deaths также несёт оружие и направление финального удара:
  ```ts
  {
    kind: 'death';
    simTime: number;
    entityId: number;
    entityKind: 'enemy' | 'player' | 'boss';
    archetypeId: string | null;
    weaponArchetypeId: string | null;
    impactDirX: number | null;
    impactDirY: number | null;
    x: number;
    y: number;
  }
  ```
- `impactDirX/Y` — normalized projectile velocity на момент попадания. Если death вызван не
  projectile-источником, поля `death.impactDirX/Y` равны `null`.
- `DamageIntent.source.kind === 'projectile'` несёт то же normalized impact direction, чтобы
  `HealthDeathSystem` мог опубликовать self-contained `death` event без запроса в `CombatSystem`
  или `EntityStore` после факта.
- Snapshot не расширяется ради impact effects. Runtime events — правильный канал, потому что
  попадания и смерти являются edge-фактами, а не долгоживущим authoritative state.

### Main-thread event fan-out

- `Renderer` получает явный runtime event sink, например:
  ```ts
  type Renderer = Readonly<{
    render(): void;
    handleEvent(event: RuntimeEvent): void;
    fitToWindow(): void;
    applyScalePolicy(preset: RenderScalePreset): void;
    dispose(): void;
  }>;
  ```
- `UiShell` остаётся owner-ом `SimWorkerHost.onEvent`. Он fan-out-ит simulation events в
  presentation consumers: audio, затем renderer если он существует, затем shell-level transitions
  (`win`/`loss`) и logging.
- `Renderer` фильтрует events внутри себя. В этой истории он реагирует на `hit` и `death` для
  `targetKind` / `entityKind` из `{ 'enemy', 'boss' }`.
- Renderer очищает все transient impact effects на `dispose()` и при создании renderer-а следующей
  сессии. Effects не переживают выход в меню.

### Weapon force и projectile knockback

- Projectile impact spec получает обязательное поле `knockbackImpulse: number` в wu/s через [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md).
- `impactDamage` и `knockbackImpulse` намеренно разные поля. Оружие может наносить большой урон с
  маленьким толчком или малый урон с сильным shove.
- При projectile hit по `enemy` или `boss` `CombatSystem` применяет target knockback до передачи
  damage intent в `HealthDeathSystem`:
  ```ts
  impulseSpeed = projectile.knockbackImpulse * target.knockbackVelocityScale;
  target.knockback = {
    vx: impulseSpeed * impactDirX,
    vy: impulseSpeed * impactDirY,
    startSimMs: simTime,
    endSimMs: simTime + target.knockbackDurationMs
  };
  ```
- Переиспользуются существующие поля цели `knockbackVelocityScale` и `knockbackDurationMs`.
  Цель с `knockbackVelocityScale === 0` не двигается от projectile knockback.
- Projectile knockback перезаписывает активный knockback на цели, как уже делает contact
  knockback в [enemy-contact.md](enemy-contact.md). Импульсы не складываются.
- `CombatSystem` по-прежнему не мутирует HP. Новый side effect ограничен target knockback state;
  HP и death остаются у `HealthDeathSystem`.
- Player knockback от enemy/boss projectiles не входит в это решение.

### Slime droplets and floor stains

- Renderer создаёт капли как generated geometry, а не authored PNG assets. Минимальная финальная
  форма — irregular 2D blob из небольшого polygon/radial jitter вокруг центра. Круг допустим
  только как bring-up fallback внутри задачи, не как accepted финальное поведение.
- Капли от `hit` летят в forward-biased cone вокруг `impactDirX/Y`.
- Капли от `death` дают больший burst: больше частиц, шире cone/radial component, крупнее пятна,
  чем у обычного hit.
- Per-weapon variation derive-ится из `WeaponArchetype.projectile`. Основной force-сигнал —
  `knockbackImpulse`; `impactDamage`, `hitRadius` and projectile `size` can be secondary visual inputs.
  Конкретные counts, speeds и spread curves — renderer-owned tuning constants.
- Цвет капель берётся из `EnemyArchetype.color` или `BossArchetype.color`. Base sprite остаётся
  PNG-driven; `color` используется здесь как slime material color для impact effects.
- У капель render-only lifetime:
  - короткая анимация вылета/падения;
  - примерно первые две секунды после landing floor stain чуть растёт;
  - затем stain живёт renderer-owned TTL, стартово около минуты;
  - ближе к концу TTL stain уходит через opacity и удаляется.
- Renderer держит bounded effect budget. Если живых капель слишком много, старые/менее заметные
  можно cull-ить. Это visual degradation, не потеря gameplay state.

### Hit flash and hit squash

- На `hit` целевой sprite может получить короткую render-only реакцию:
  - brief bright/white flash;
  - directional или uniform squash impulse, layered поверх procedural breathing.
- Hit responses transient и keyed by `targetId`. Они decay-ятся без изменения `SpriteVisualSpec`,
  `contactBox`, позиции entity или любых simulation fields.
- Если цель умерла на том же тике, death effects приоритетнее; live hit response можно пропустить
  или он исчезнет вместе с удалением mesh-а.

### Death ghost

- На `death` для `enemy` / `boss` renderer создаёт transient ghost sprite из того же visual
  registry и preloaded texture, что и live sprite.
- Ghost стартует из event `x/y`, а не через lookup live mesh. Это обязательно, потому что entity
  удаляется до следующего snapshot-а.
- Ghost движется быстро:
  - небольшой компонент вдоль `impactDirX/Y`, если direction доступен;
  - больший upward component в world/screen `+Y`;
  - без gameplay collision и arena clamp.
- Ghost полупрозрачный, desaturated или нейтрально tinted, продолжает fade-иться и исчезает
  быстро, стартово за одну-две секунды.
- Death ghost обязан работать даже если текущий snapshot уже не содержит умершую entity, пока
  `archetypeId` резолвится в visual spec и preloaded texture.

### Randomness and determinism

- Projectile knockback — authoritative simulation и не использует random.
- Render-only effects могут визуально варьироваться, но random живёт только на main/render стороне
  и никогда не возвращается в `sim`, snapshots, runtime events или content generation.
- Предпочтителен deterministic local hashing из event fields (`simTime`, ids, archetype ids,
  droplet index), а не прямой `Math.random()`: один event даёт стабильную геометрию effects для
  тестов и debug. Это presentation determinism, не session RNG.

### Tests and verification

- Event-shape tests покрывают новые поля `hit` и `death`.
- Combat tests покрывают projectile knockback direction, weapon impulse scaling, target
  susceptibility через `knockbackVelocityScale` и отсутствие HP mutation внутри `CombatSystem`.
- Health/death tests покрывают propagation projectile impact direction и weapon id в `death`.
- Renderer tests покрывают `handleEvent`, создание effects по `hit`/`death`, фильтр player-hit,
  cleanup/TTL effects и инвариант, что visual droplets не появляются в snapshots.
- Content checks покрывают обязательные значения projectile `knockbackImpulse`.
- Manual visual QA проверяет pistol-like, shotgun-like, laser-like и sniper-like weapons, если они
  есть в текущем content set; иначе проверяет доступные weapons и фиксирует оставшийся tuning follow-up.

## Consequences

- Impact presentation становится juicy без загрязнения `EntityStore` или snapshots визуальным
  мусором.
- Runtime events становятся более self-contained для main-thread consumers. Payload чуть растёт,
  зато renderer не делает fragile lookup-и против snapshot-ов, где цель уже могла исчезнуть.
- `CombatSystem` получает один новый authoritative side effect на projectile hit: target knockback.
  Граница HP сохраняется, потому что damage всё ещё проходит через `HealthDeathSystem`.
- `WeaponArchetype.projectile` теперь отвечает и за impact damage, и за physical force. Existing
  weapon content должен получить явные projectile `knockbackImpulse` values.
- `EnemyArchetype.color` и `BossArchetype.color` перестают быть только future-placeholder-ами:
  теперь их читает render-only slime material effects, но base sprite rendering остаётся
  asset-driven.
- Render effect budgets и visual tuning становятся реальной surface сопровождения. Это допустимо:
  они изолированы в `src/main/render/**` и не влияют на deterministic simulation.

## Related

- [thread-model.md](thread-model.md)
- [runtime-systems.md](runtime-systems.md)
- [snapshot-shape.md](snapshot-shape.md)
- [projectiles-and-combat.md](projectiles-and-combat.md)
- [health-and-death.md](health-and-death.md)
- [enemy-contact.md](enemy-contact.md)
- [content-archetypes.md](content-archetypes.md)
- [sprite-assets.md](sprite-assets.md)
- [main-ui-shell.md](main-ui-shell.md)
- [rng.md](rng.md)
- [testing.md](testing.md)
- [universal-weapons-and-projectiles.md](universal-weapons-and-projectiles.md)

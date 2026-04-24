# Slime Impact Feedback

- Status: in-progress
- Created: 2026-04-24
- Updated: 2026-04-24

## Player-facing

- Sees: при попадании projectile в слайма из него вылетает мокрая слизь по направлению пули. Более сильное оружие даёт более широкий и тяжёлый брызг. Попавший слайм коротко реагирует flash/squash-ом, а уничтоженный слайм оставляет быстрый fading-ghost, который улетает в основном вверх, пока крупный burst слизи падает на пол.
- Can do: считывать силу оружия, направление попадания и подтверждение убийства через движение, мокрые следы и реакцию тела, а не только через HP и звук.

## Technical

- Новый owner-контракт — [impact-feedback.md](../design/impact-feedback.md): authoritative projectile knockback живёт в `sim`, а капли/пятна/ghost/hit squash живут только в `main/render`.
- `hit`/`death` runtime events получают target archetype и impact direction, чтобы renderer реагировал без реконструкции уже удалённых entity из snapshots.
- `WeaponArchetype.knockbackImpulse` становится projectile force, отдельным от `damage`, и применяется к `enemy`/`boss` через существующий target knockback state.
- `UiShell` пробрасывает runtime events в `Renderer.handleEvent(RuntimeEvent)`, оставаясь единственным owner-ом `SimWorkerHost.onEvent`.
- `EnemyArchetype.color` / `BossArchetype.color` используются как цвет материала render-only slime effects; base sprite rendering остаётся PNG-driven.

## Out of scope

- Gameplay puddles: пятна слизи не замедляют, не дамажат, не блокируют, не лечат, не подбираются и не влияют на pathing.
- Player knockback от enemy/boss projectiles.
- Визуальная/звуковая реакция на contact damage.
- Authored particle atlases, sprite sheets, skeleton animation или shader-only deformation.
- Persistent slime decals между сессиями, сохранениями или выходом в меню.
- Новые виды оружия, новые враги или balance redesign, кроме добавления force values текущему weapon content.

## Acceptance

- Projectile hits по `enemy`/`boss` создают капли слизи, смещённые по направлению движения projectile; hits по player не создают slime spray.
- Weapon force влияет на ощущение брызга: большее `knockbackImpulse` заметно даёт более тяжёлый/широкий impact feedback, чем низкое значение.
- Попавшие слаймы коротко flash-ятся и/или squash-атся без изменения simulation geometry, `SpriteVisualSpec`, `contactBox` или snapshot shape.
- Projectile hits применяют simulation knockback к живым `enemy`/`boss` в направлении projectile, масштабируя его через `WeaponArchetype.knockbackImpulse` и susceptibility цели; HP по-прежнему применяет только `HealthDeathSystem`.
- При смерти слайма renderer создаёт transient ghost sprite из visual умершего слайма, двигает его в основном вверх с меньшим компонентом по направлению удара, fade-out-ит примерно за 1-2 секунды и создаёт slime burst крупнее обычного hit.
- Капли слизи — irregular blob shapes, не финальные круги. После landing они слегка растут примерно две секунды, остаются floor stains на renderer-owned TTL, затем исчезают через opacity.
- Цвет капель/пятен берётся из цвета target slime archetype.
- Slime droplets, floor stains и death ghosts — render-only state: они не появляются в `Snapshot.entities`, не входят в `EntityStore` и исчезают на renderer dispose / выходе из run.
- Automated tests покрывают event payload shape, projectile knockback, renderer event handling/effect cleanup и обязательный weapon force content. Manual visual QA проверяет доступные weapons в live run.

## Tasks

| ID | Status | Task | Note |
|----|--------|------|------|
| T1 | [x] | Зафиксировать архитектуру impact feedback | Добавлены `design/impact-feedback.md` и обновления связанных design-контрактов до кодовой работы. |
| T2 | [x] | Расширить runtime event и damage intent payloads | Обновить `RuntimeEvent.hit`, `RuntimeEvent.death`, projectile `DamageIntent.source` и тесты под archetype/direction data. |
| T3 | [x] | Добавить weapon force в content | Добавить обязательный `WeaponArchetype.knockbackImpulse`, обновить MD parsing/rendering/generated content и выставить начальные значения существующим weapons. |
| T4 | [x] | Применить projectile knockback в симуляции | Переиспользовать enemy/boss knockback state на projectile hits, учесть susceptibility/duration цели и оставить HP mutation внутри `HealthDeathSystem`. |
| T5 | [x] | Пробросить runtime events в renderer | Добавить `Renderer.handleEvent`, route events из `UiShell`, очистку renderer effects на dispose/session transitions. |
| T6 | [x] | Собрать render-only impact effect store | Отслеживать transient hit impulses, droplets/stains и death ghosts с bounded budgets, TTL и per-frame updates. |
| T7 | [ ] | Нарисовать slime droplets и floor stains | Генерировать irregular blob geometry, spawn-ить hit/death bursts из event data, коротко settle/grow stains, затем fade/remove. |
| T8 | [ ] | Добавить live hit response | Наложить короткий flash и/или squash impulse на enemy/boss sprites без влияния на breathing, position interpolation или player rendering. |
| T9 | [ ] | Добавить death ghost feedback | Spawn transient sprite copy из death event archetype/texture, двигать вверх плюс impact direction, быстро fade-out-ить и безопасно работать без live mesh. |
| T10 | [ ] | Проверить и настроить общее ощущение | Прогнать unit/build checks и manual browser QA по доступным weapons: direction, force difference, color, cleanup, отсутствие leftovers после выхода из run. |

## Related

- [impact-feedback.md](../design/impact-feedback.md)
- [snapshot-shape.md](../design/snapshot-shape.md)
- [projectiles-and-combat.md](../design/projectiles-and-combat.md)
- [health-and-death.md](../design/health-and-death.md)
- [enemy-contact.md](../design/enemy-contact.md)
- [content-archetypes.md](../design/content-archetypes.md)
- [sprite-assets.md](../design/sprite-assets.md)
- [main-ui-shell.md](../design/main-ui-shell.md)
- [rng.md](../design/rng.md)
- [testing.md](../design/testing.md)

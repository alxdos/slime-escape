import type {
  ParsedCompanionConfig,
  ParsedEncounter,
  ParsedLoadout,
  ParsedLossCondition,
  ParsedSessionPreset,
  ParsedSessionsArea,
  ParsedSpawnOverride,
  ParsedSpawnPlan,
  ParsedStaticSpawn,
  ParsedTransitionRules,
  ParsedWaveSpawn,
  ParsedWinCondition
} from './parse';
import {
  escapeString,
  formatNumber,
  renderHeader,
  renderObjectKey
} from '../util/render';
import { ContentBuildError } from '../util/require';

type ImportBucket = 'bosses' | 'drops' | 'enemies' | 'players' | 'weapons';

const PUBLIC_ARENA_SOURCE_PRESET_ID = 'portal';

export function renderSessionContent(area: ParsedSessionsArea): string {
  const imports = collectImports(area);
  return `${renderHeader(`${area.sourceDirectory}/*.md`)}${renderImports(imports)}

export const SESSION_PRESET_TEMPLATES = {
${area.presets.map(renderPreset).join(',\n')}
} as const satisfies Record<string, SessionPresetTemplate>;\n`;
}

export function renderPublicArenaContent(area: ParsedSessionsArea): string {
  const preset = requirePublicArenaPreset(area);
  const loadout = requirePublicArenaLoadout(preset);
  const imports = collectPublicArenaImports(preset, loadout);
  return `${renderHeader(`${area.sourceDirectory}/${PUBLIC_ARENA_SOURCE_PRESET_ID}.md`)}${renderPublicArenaImports(imports)}

export const PUBLIC_ARENA_PRESENTATION_CONTENT = {
  arena: ${renderArena(preset.arena)},
  player: ${preset.player.constName},
  loadout: ${renderLoadout(loadout)},
  backgrounds: [
${preset.backgrounds.map(renderPublicArenaBackground).join(',\n')}
  ],
  activeBackgroundId: '${escapeString(resolvePublicArenaActiveBackgroundId(preset))}'
} as const;\n`;
}

function renderImports(imports: ReadonlyMap<ImportBucket, ReadonlySet<string>>): string {
  return [
    renderImport(imports, 'bosses', './bosses.generated'),
    renderImport(imports, 'drops', './drops.generated'),
    renderImport(imports, 'enemies', './enemies.generated'),
    renderImport(imports, 'players', './players.generated'),
    "import type { SessionPresetTemplate } from './sessions';",
    renderImport(imports, 'weapons', './weapons.generated'),
    ''
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}

function renderImport(
  imports: ReadonlyMap<ImportBucket, ReadonlySet<string>>,
  bucket: ImportBucket,
  source: string
): string {
  const names = [...(imports.get(bucket) ?? [])].sort();
  if (names.length === 0) {
    return '';
  }
  return `import { ${names.join(', ')} } from '${source}';`;
}

function renderPublicArenaImports(
  imports: ReadonlyMap<ImportBucket, ReadonlySet<string>>
): string {
  return [
    renderImport(imports, 'players', './players.generated.js'),
    renderImport(imports, 'weapons', './weapons.generated.js')
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}

function renderPreset(preset: ParsedSessionPreset): string {
  return `  ${renderObjectKey(preset.presetId)}: {
    presetId: '${escapeString(preset.presetId)}',
    displayName: '${escapeString(preset.displayName)}',
    description: '${escapeString(preset.description)}',
    visibleInMenu: ${preset.visibleInMenu ? 'true' : 'false'},
    order: ${formatNumber(preset.order)},
    arena: ${renderArena(preset.arena)},
    player: ${preset.player.constName},
    companion: ${renderCompanionConfig(preset.companion)},
    loadout: ${renderLoadout(preset.loadout)},
    backgrounds: [
${preset.backgrounds.map(renderBackground).join(',\n')}
    ],
    musicSampleId: ${renderNullableString(preset.musicSampleId)},
    rules: ${renderRules(preset)},
    winCondition: ${renderWinCondition(preset.winCondition)},
    lossCondition: ${renderLossCondition(preset.lossCondition)},
    encounters: [
${preset.encounters.map(renderEncounter).join(',\n')}
    ]
  }`;
}

function renderCompanionConfig(companion: ParsedCompanionConfig | null): string {
  if (companion === null) {
    return 'null';
  }
  return `{
      maxHp: ${formatNumber(companion.maxHp)},
      contactBox: { width: ${formatNumber(companion.contactBox.width)}, height: ${formatNumber(companion.contactBox.height)} },
      movement: { maxSpeed: ${formatNumber(companion.movement.maxSpeed)}, acceleration: ${formatNumber(companion.movement.acceleration)}, orbitRadius: ${formatNumber(companion.movement.orbitRadius)} },
      threat: { acquireRadius: ${formatNumber(companion.threat.acquireRadius)}, releaseRadius: ${formatNumber(companion.threat.releaseRadius)} },
      weaponLoadout: ${renderLoadout(companion.weaponLoadout)},
      boop: { radius: ${formatNumber(companion.boop.radius)}, impulse: ${formatNumber(companion.boop.impulse)}, durationMs: ${formatNumber(companion.boop.durationMs)}, cooldownMs: ${formatNumber(companion.boop.cooldownMs)} },
      rescue: { radius: ${formatNumber(companion.rescue.radius)}, durationMs: ${formatNumber(companion.rescue.durationMs)}, reviveHpFraction: ${formatNumber(companion.rescue.reviveHpFraction)} }
    }`;
}

function renderEncounter(encounter: ParsedEncounter): string {
  return `      {
        id: '${escapeString(encounter.id)}',
        type: '${encounter.type}',
        backgroundId: ${renderNullableString(encounter.backgroundId)},
        introDurationMs: ${formatNumber(encounter.introDurationMs)},
        name: ${renderNullableString(encounter.name)},
        text: ${renderNullableString(encounter.text)},
        spawnPlan: ${renderSpawnPlan(encounter.spawnPlan)},
        zoneBehavior: ${renderZoneBehavior(encounter)},
        objectives: [],
        rewardRules: null,
        transitionRules: ${renderTransitionRules(encounter.transitionRules)},
        tuning: null
      }`;
}

function renderBackground(background: ParsedSessionPreset['backgrounds'][number]): string {
  return `      {
        id: '${escapeString(background.id)}',
        imageUrl: '${escapeString(background.image.url)}'
      }`;
}

function renderPublicArenaBackground(
  background: ParsedSessionPreset['backgrounds'][number]
): string {
  return `    {
      id: '${escapeString(background.id)}',
      imageUrl: '${escapeString(background.image.url)}'
    }`;
}

function renderArena(arena: ParsedSessionPreset['arena']): string {
  return `{ width: ${formatNumber(arena.width)}, height: ${formatNumber(arena.height)} }`;
}

function renderSpawnPlan(spawnPlan: ParsedSpawnPlan): string {
  switch (spawnPlan.kind) {
    case 'empty':
      return "{ kind: 'empty' }";
    case 'wave':
      return `{
          kind: 'wave',
          spawns: [
${spawnPlan.spawns.map(renderWaveSpawn).join(',\n')}
          ],
          spawnIntervalMs: ${formatNumber(spawnPlan.spawnIntervalMs)},
          maxAlive: ${formatNumber(spawnPlan.maxAlive)},
          edgeMargin: ${formatNumber(spawnPlan.edgeMargin)}
        }`;
    case 'static':
      return `{
          kind: 'static',
          spawns: [
${spawnPlan.spawns.map(renderStaticSpawn).join(',\n')}
          ]
        }`;
    case 'boss':
      return `{
          kind: 'boss',
          bossArchetypeId: ${spawnPlan.bossArchetype.constName}.id,
          position: '${spawnPlan.position}',
          bossEdgeMargin: ${formatNumber(spawnPlan.bossEdgeMargin)}
        }`;
    default:
      return assertNever(spawnPlan);
  }
}

function renderWaveSpawn(spawn: ParsedWaveSpawn): string {
  const override = renderSpawnOverride(spawn.override);
  if (override === null) {
    return `            { archetypeId: ${spawn.archetype.constName}.id }`;
  }
  return `            {
              archetypeId: ${spawn.archetype.constName}.id,
              override: ${override}
            }`;
}

function renderStaticSpawn(spawn: ParsedStaticSpawn): string {
  const override = renderSpawnOverride(spawn.override);
  if (override === null) {
    return `            {
              archetypeId: ${spawn.archetype.constName}.id,
              position: { x: ${formatNumber(spawn.position.x)}, y: ${formatNumber(spawn.position.y)} }
            }`;
  }
  return `            {
              archetypeId: ${spawn.archetype.constName}.id,
              position: { x: ${formatNumber(spawn.position.x)}, y: ${formatNumber(spawn.position.y)} },
              override: ${override}
            }`;
}

function renderSpawnOverride(override: ParsedSpawnOverride | undefined): string | null {
  if (override === undefined) {
    return null;
  }
  const fields: string[] = [];
  if (override.guaranteedDrops !== undefined) {
    fields.push(
      `guaranteedDrops: [${override.guaranteedDrops.map((drop) => `${drop.constName}.id`).join(', ')}]`
    );
  }
  if (override.dropTable !== undefined) {
    fields.push(`dropTable: ${renderOverrideDropTable(override.dropTable)}`);
  }
  if (override.retaliation !== undefined) {
    fields.push(
      `retaliation: { enabled: ${override.retaliation.enabled ? 'true' : 'false'}, durationMs: ${formatNumber(override.retaliation.durationMs)} }`
    );
  }
  if (override.loadout !== undefined) {
    fields.push(`loadout: ${renderLoadout(override.loadout)}`);
  }
  return fields.length === 0 ? null : `{ ${fields.join(', ')} }`;
}

function renderOverrideDropTable(
  dropTable: NonNullable<ParsedSpawnOverride['dropTable']>
): string {
  if (dropTable.length === 0) {
    return '[]';
  }
  return `[${dropTable
    .map(
      (entry) =>
        `{ archetypeId: ${entry.archetype.constName}.id, chance: ${formatNumber(entry.chance)} }`
    )
    .join(', ')}]`;
}

function renderZoneBehavior(encounter: ParsedEncounter): string {
  const zone = encounter.zoneBehavior;
  switch (zone.kind) {
    case 'disabled':
      return "{ kind: 'disabled' }";
    case 'shrinkLinear':
    case 'expandLinear':
      return `{ kind: '${zone.kind}', fromMargin: ${formatNumber(zone.fromMargin)}, toMargin: ${formatNumber(zone.toMargin)}, durationMs: ${formatNumber(zone.durationMs)} }`;
    default:
      return assertNever(zone);
  }
}

function renderTransitionRules(transitionRules: ParsedTransitionRules): string {
  switch (transitionRules.kind) {
    case 'never':
    case 'allEnemiesCleared':
      return `{ kind: '${transitionRules.kind}', next: 'sequential' }`;
    case 'timer':
      return `{ kind: 'timer', durationMs: ${formatNumber(transitionRules.durationMs)}, next: 'sequential' }`;
    default:
      return assertNever(transitionRules);
  }
}

function renderLoadout(loadout: ParsedLoadout | null): string {
  if (loadout === null) {
    return 'null';
  }
  return `{ weapons: [${loadout.weapons.map((weapon) => `${weapon.constName}.id`).join(', ')}], selectedIndex: ${renderNullableNumber(loadout.selectedIndex)} }`;
}

function renderRules(preset: ParsedSessionPreset): string {
  const aimAssist = preset.rules.aimAssist;
  return `{ damage: { slimeFriendlyFire: ${preset.rules.damage.slimeFriendlyFire ? 'true' : 'false'} }, aimAssist: { enabled: ${aimAssist.enabled ? 'true' : 'false'}, maxAngleRadians: ${formatNumber(aimAssist.maxAngleRadians)}, maxDistance: ${formatNumber(aimAssist.maxDistance)}, strength: ${formatNumber(aimAssist.strength)} } }`;
}

function renderNullableString(value: string | null): string {
  if (value === null) {
    return 'null';
  }
  return `'${escapeString(value)}'`;
}

function renderWinCondition(winCondition: ParsedWinCondition): string {
  return `{ kind: '${winCondition.kind}' }`;
}

function renderLossCondition(lossCondition: ParsedLossCondition): string {
  return `{ kind: '${lossCondition.kind}' }`;
}

function collectImports(area: ParsedSessionsArea): ReadonlyMap<ImportBucket, ReadonlySet<string>> {
  const imports = new Map<ImportBucket, Set<string>>();
  for (const preset of area.presets) {
    addImport(imports, 'players', preset.player.constName);
    if (preset.loadout !== null) {
      for (const weapon of preset.loadout.weapons) {
        addImport(imports, 'weapons', weapon.constName);
      }
    }
    for (const weapon of preset.companion?.weaponLoadout?.weapons ?? []) {
      addImport(imports, 'weapons', weapon.constName);
    }
    for (const encounter of preset.encounters) {
      collectSpawnImports(imports, encounter.spawnPlan);
    }
  }
  return imports;
}

function collectPublicArenaImports(
  preset: ParsedSessionPreset,
  loadout: ParsedLoadout
): ReadonlyMap<ImportBucket, ReadonlySet<string>> {
  const imports = new Map<ImportBucket, Set<string>>();
  addImport(imports, 'players', preset.player.constName);
  for (const weapon of loadout.weapons) {
    addImport(imports, 'weapons', weapon.constName);
  }
  return imports;
}

function requirePublicArenaPreset(area: ParsedSessionsArea): ParsedSessionPreset {
  const preset = area.presets.find((candidate) => candidate.presetId === PUBLIC_ARENA_SOURCE_PRESET_ID);
  if (preset === undefined) {
    throw new ContentBuildError(
      `${area.sourceDirectory}: missing ${PUBLIC_ARENA_SOURCE_PRESET_ID}.md public arena source preset`
    );
  }
  return preset;
}

function requirePublicArenaLoadout(preset: ParsedSessionPreset): ParsedLoadout {
  if (preset.loadout === null || preset.loadout.weapons.length === 0) {
    throw new ContentBuildError(
      `${preset.sourcePath}: Public Arena source preset must define at least one loadout weapon`
    );
  }
  if (preset.loadout.selectedIndex === null) {
    throw new ContentBuildError(
      `${preset.sourcePath}: Public Arena source preset must select a loadout weapon`
    );
  }
  return preset.loadout;
}

function resolvePublicArenaActiveBackgroundId(preset: ParsedSessionPreset): string {
  const encounterBackgroundId =
    preset.encounters.find((encounter) => encounter.backgroundId !== null)?.backgroundId ?? null;
  if (encounterBackgroundId !== null) {
    return encounterBackgroundId;
  }
  const firstBackground = preset.backgrounds[0];
  if (firstBackground === undefined) {
    throw new ContentBuildError(
      `${preset.sourcePath}: expected at least one background for Public Arena projection`
    );
  }
  return firstBackground.id;
}

function collectSpawnImports(
  imports: Map<ImportBucket, Set<string>>,
  spawnPlan: ParsedSpawnPlan
): void {
  switch (spawnPlan.kind) {
    case 'empty':
      return;
    case 'wave':
    case 'static':
      for (const spawn of spawnPlan.spawns) {
        addImport(imports, 'enemies', spawn.archetype.constName);
        collectOverrideImports(imports, spawn.override);
      }
      return;
    case 'boss':
      addImport(imports, 'bosses', spawnPlan.bossArchetype.constName);
      return;
    default:
      assertNever(spawnPlan);
  }
}

function collectOverrideImports(
  imports: Map<ImportBucket, Set<string>>,
  override: ParsedSpawnOverride | undefined
): void {
  if (override === undefined) return;
  for (const drop of override.guaranteedDrops ?? []) {
    addImport(imports, 'drops', drop.constName);
  }
  for (const entry of override.dropTable ?? []) {
    addImport(imports, 'drops', entry.archetype.constName);
  }
  for (const weapon of override.loadout?.weapons ?? []) {
    addImport(imports, 'weapons', weapon.constName);
  }
}

function addImport(
  imports: Map<ImportBucket, Set<string>>,
  bucket: ImportBucket,
  constName: string
): void {
  const names = imports.get(bucket) ?? new Set<string>();
  names.add(constName);
  imports.set(bucket, names);
}

function assertNever(value: never): never {
  throw new Error(`unhandled sessions render value: ${String(value)}`);
}

function renderNullableNumber(value: number | null): string {
  return value === null ? 'null' : formatNumber(value);
}

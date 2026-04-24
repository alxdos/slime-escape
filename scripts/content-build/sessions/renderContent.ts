import type {
  ParsedEncounter,
  ParsedLoadout,
  ParsedLossCondition,
  ParsedSessionPreset,
  ParsedSessionsArea,
  ParsedSpawnPlan,
  ParsedTransitionRules,
  ParsedWinCondition
} from './parse';
import {
  escapeString,
  formatNumber,
  renderHeader,
  renderObjectKey
} from '../util/render';

type ImportBucket = 'arenas' | 'bosses' | 'enemies' | 'players' | 'weapons';

export function renderSessionContent(area: ParsedSessionsArea): string {
  const imports = collectImports(area);
  return `${renderHeader(`${area.sourceDirectory}/*.md`)}${renderImports(imports)}

export const SESSION_PRESET_TEMPLATES = {
${area.presets.map(renderPreset).join(',\n')}
} as const satisfies Record<string, SessionPresetTemplate>;\n`;
}

function renderImports(imports: ReadonlyMap<ImportBucket, ReadonlySet<string>>): string {
  return [
    renderImport(imports, 'arenas', './arenas'),
    renderImport(imports, 'bosses', './bosses.generated'),
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

function renderPreset(preset: ParsedSessionPreset): string {
  return `  ${renderObjectKey(preset.presetId)}: {
    presetId: '${escapeString(preset.presetId)}',
    displayName: '${escapeString(preset.displayName)}',
    description: '${escapeString(preset.description)}',
    visibleInMenu: ${preset.visibleInMenu ? 'true' : 'false'},
    order: ${formatNumber(preset.order)},
    arena: ${preset.arena.constName},
    player: ${preset.player.constName},
    loadout: ${renderLoadout(preset.loadout)},
    backgrounds: [
${preset.backgrounds.map(renderBackground).join(',\n')}
    ],
    rules: ${renderRules(preset)},
    winCondition: ${renderWinCondition(preset.winCondition)},
    lossCondition: ${renderLossCondition(preset.lossCondition)},
    encounters: [
${preset.encounters.map(renderEncounter).join(',\n')}
    ]
  }`;
}

function renderEncounter(encounter: ParsedEncounter): string {
  return `      {
        id: '${escapeString(encounter.id)}',
        type: '${encounter.type}',
        backgroundId: ${renderNullableString(encounter.backgroundId)},
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

function renderSpawnPlan(spawnPlan: ParsedSpawnPlan): string {
  switch (spawnPlan.kind) {
    case 'empty':
      return "{ kind: 'empty' }";
    case 'wave':
      return `{
          kind: 'wave',
          spawns: [
${spawnPlan.spawns.map((spawn) => `            { archetypeId: ${spawn.archetype.constName}.id }`).join(',\n')}
          ],
          spawnIntervalMs: ${formatNumber(spawnPlan.spawnIntervalMs)},
          maxAlive: ${formatNumber(spawnPlan.maxAlive)},
          edgeMargin: ${formatNumber(spawnPlan.edgeMargin)}
        }`;
    case 'static':
      return `{
          kind: 'static',
          spawns: [
${spawnPlan.spawns
  .map(
    (spawn) => `            {
              archetypeId: ${spawn.archetype.constName}.id,
              position: { x: ${formatNumber(spawn.position.x)}, y: ${formatNumber(spawn.position.y)} }
            }`
  )
  .join(',\n')}
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
    addImport(imports, 'arenas', preset.arena.constName);
    addImport(imports, 'players', preset.player.constName);
    if (preset.loadout !== null) {
      for (const weapon of preset.loadout.weapons) {
        addImport(imports, 'weapons', weapon.constName);
      }
    }
    for (const encounter of preset.encounters) {
      collectSpawnImports(imports, encounter.spawnPlan);
    }
  }
  return imports;
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
      }
      return;
    case 'boss':
      addImport(imports, 'bosses', spawnPlan.bossArchetype.constName);
      return;
    default:
      assertNever(spawnPlan);
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

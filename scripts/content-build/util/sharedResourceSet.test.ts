import { describe, expect, it } from 'vitest';

import { parseMarkdown, type MarkdownSection } from '../parse';
import {
  expandSetToMembers,
  parseSampleIdCellGroup,
  parseSharedResourceSetPartition
} from './sharedResourceSet';
import type { InlineMediaSampleRegistry } from './inlineMedia';

const SAMPLE_REGISTRY: InlineMediaSampleRegistry = {
  get(sampleId: string): Readonly<{ url: string }> | null {
    return (
      {
        'weapons/pistol': { url: '/sfx/weapons/pistol.mp3' },
        'weapons/shotgun': { url: '/sfx/weapons/shotgun.mp3' }
      } satisfies Readonly<Record<string, Readonly<{ url: string }>>>
    )[sampleId] ?? null;
  }
};

describe('shared resource set partition helper', () => {
  it('parses and expands a single-set partition', () => {
    const partition = parseSharedResourceSetPartition(soundSetsPartition(), {
      archetypeIds: ['slime-one-eye', 'slime-hornling'],
      membersColumnName: 'slimes',
      requiredGroups: ['Hit']
    });

    expect([...partition.members]).toEqual([
      ['slime-one-eye', 'default'],
      ['slime-hornling', 'default']
    ]);
    expect([...expandSetToMembers(partition.members, new Map([['default', 'hit-pack']]))]).toEqual([
      ['slime-one-eye', 'hit-pack'],
      ['slime-hornling', 'hit-pack']
    ]);
    expect(partition.groups.get('Hit')?.get('default')?.map((cell) => cell.value)).toEqual([
      'weapons/pistol',
      'weapons/shotgun'
    ]);
  });

  it('parses two sets and inline audio-link sample cells', () => {
    const partition = parseSharedResourceSetPartition(
      soundSetsPartition([
        '# Sound sets',
        '',
        '## Members',
        '',
        '| setId | slimes |',
        '|-------|--------|',
        '| default | slime-one-eye |',
        '| bright | slime-hornling |',
        '',
        '## Hit',
        '',
        '| setId | s1 |',
        '|-------|----|',
        '| default | [weapons/pistol](../public/sfx/weapons/pistol.mp3) |',
        '| bright | [weapons/shotgun](../public/sfx/weapons/shotgun.mp3) |'
      ]),
      {
        archetypeIds: ['slime-one-eye', 'slime-hornling'],
        membersColumnName: 'slimes',
        requiredGroups: ['Hit']
      }
    );
    const parsedSamples = parseSampleIdCellGroup('Hit', requireGroup(partition, 'Hit'), SAMPLE_REGISTRY, {
      sourcePath: 'content/enemies.md'
    });

    expect(parsedSamples.form).toBe('inlineAudioLink');
    expect([...parsedSamples.sampleIdsBySetId]).toEqual([
      ['default', ['weapons/pistol']],
      ['bright', ['weapons/shotgun']]
    ]);
  });

  it('rejects an archetype assigned to two sets', () => {
    const partition = soundSetsPartition([
      '# Sound sets',
      '',
      '## Members',
      '',
      '| setId | slimes |',
      '|-------|--------|',
      '| default | slime-one-eye, slime-hornling |',
      '| bright | slime-hornling |',
      '',
      '## Hit',
      '',
      '| setId | s1 |',
      '|-------|----|',
      '| default | weapons/pistol |',
      '| bright | weapons/shotgun |'
    ]);

    expect(() =>
      parseSharedResourceSetPartition(partition, {
        archetypeIds: ['slime-one-eye', 'slime-hornling'],
        membersColumnName: 'slimes',
        requiredGroups: ['Hit']
      })
    ).toThrow(/archetype "slime-hornling" is a member of multiple sets: default, bright/);
  });

  it('rejects an archetype missing from all sets', () => {
    expect(() =>
      parseSharedResourceSetPartition(soundSetsPartition(), {
        archetypeIds: ['slime-one-eye', 'slime-hornling', 'slime-many-eye'],
        membersColumnName: 'slimes',
        requiredGroups: ['Hit']
      })
    ).toThrow(/archetype "slime-many-eye" is not a member of any set/);
  });

  it('rejects unknown archetype ids in Members', () => {
    const partition = soundSetsPartition([
      '# Sound sets',
      '',
      '## Members',
      '',
      '| setId | slimes |',
      '|-------|--------|',
      '| default | slime-one-eye, slime-ghost |',
      '',
      '## Hit',
      '',
      '| setId | s1 |',
      '|-------|----|',
      '| default | weapons/pistol |'
    ]);

    expect(() =>
      parseSharedResourceSetPartition(partition, {
        archetypeIds: ['slime-one-eye'],
        membersColumnName: 'slimes',
        requiredGroups: ['Hit']
      })
    ).toThrow(/unknown archetype id "slime-ghost"/);
  });

  it('rejects unknown setIds in group tables', () => {
    const partition = soundSetsPartition([
      '# Sound sets',
      '',
      '## Members',
      '',
      '| setId | slimes |',
      '|-------|--------|',
      '| default | slime-one-eye, slime-hornling |',
      '',
      '## Hit',
      '',
      '| setId | s1 |',
      '|-------|----|',
      '| default | weapons/pistol |',
      '| ghost | weapons/shotgun |'
    ]);

    expect(() =>
      parseSharedResourceSetPartition(partition, {
        archetypeIds: ['slime-one-eye', 'slime-hornling'],
        membersColumnName: 'slimes',
        requiredGroups: ['Hit']
      })
    ).toThrow(/unknown setId "ghost"/);
  });

  it('rejects a missing required group', () => {
    const partition = soundSetsPartition([
      '# Sound sets',
      '',
      '## Members',
      '',
      '| setId | slimes |',
      '|-------|--------|',
      '| default | slime-one-eye |'
    ]);

    expect(() =>
      parseSharedResourceSetPartition(partition, {
        archetypeIds: ['slime-one-eye'],
        membersColumnName: 'slimes',
        requiredGroups: ['Hit']
      })
    ).toThrow(/expected required group "Hit"/);
  });

  it('rejects a Members section that is not first', () => {
    const partition = soundSetsPartition([
      '# Sound sets',
      '',
      '## Hit',
      '',
      '| setId | s1 |',
      '|-------|----|',
      '| default | weapons/pistol |',
      '',
      '## Members',
      '',
      '| setId | slimes |',
      '|-------|--------|',
      '| default | slime-one-eye |'
    ]);

    expect(() =>
      parseSharedResourceSetPartition(partition, {
        archetypeIds: ['slime-one-eye'],
        membersColumnName: 'slimes',
        requiredGroups: ['Hit']
      })
    ).toThrow(/expected "## Members" to be the first shared resource set section/);
  });

  it('rejects mixed plain and inline audio-link cells in one group table', () => {
    const partition = parseSharedResourceSetPartition(
      soundSetsPartition([
        '# Sound sets',
        '',
        '## Members',
        '',
        '| setId | slimes |',
        '|-------|--------|',
        '| default | slime-one-eye |',
        '',
        '## Hit',
        '',
        '| setId | s1 | s2 |',
        '|-------|----|----|',
        '| default | weapons/pistol | [weapons/shotgun](../public/sfx/weapons/shotgun.mp3) |'
      ]),
      {
        archetypeIds: ['slime-one-eye'],
        membersColumnName: 'slimes',
        requiredGroups: ['Hit']
      }
    );

    expect(() => parseSampleIdCellGroup('Hit', requireGroup(partition, 'Hit'), SAMPLE_REGISTRY)).toThrow(
      /sampleId cells must not mix plain text and inline audio-link/
    );
  });
});

function soundSetsPartition(markdownLines?: ReadonlyArray<string>): MarkdownSection {
  const document = parseMarkdown(
    'content/enemies.md',
    (
      markdownLines ?? [
        '# Sound sets',
        '',
        '## Members',
        '',
        '| setId | slimes |',
        '|-------|--------|',
        '| default | slime-one-eye, slime-hornling |',
        '',
        '## Hit',
        '',
        '| setId | s1 | s2 |',
        '|-------|----|----|',
        '| default | weapons/pistol | weapons/shotgun |'
      ]
    ).join('\n')
  );
  const partition = document.sections[0];
  if (partition === undefined) {
    throw new Error('test markdown did not produce an H1 partition');
  }
  return partition;
}

function requireGroup(
  partition: ReturnType<typeof parseSharedResourceSetPartition>,
  groupName: string
): ReadonlyMap<string, ReadonlyArray<import('../parse').MarkdownCell>> {
  const group = partition.groups.get(groupName);
  if (group === undefined) {
    throw new Error(`test partition did not include group ${groupName}`);
  }
  return group;
}

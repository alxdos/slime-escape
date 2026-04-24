import type { InputCommand } from '../../shared/input';
import type { AimAssistRule, Vec2 } from '../../shared/session';
import type { Snapshot } from '../../shared/snapshot';

type TargetSnapshot = Extract<Snapshot['entities'][number], { kind: 'enemy' | 'boss' }>;

export function applyAimAssist(
  command: InputCommand,
  rule: AimAssistRule,
  snapshot: Snapshot | null
): InputCommand {
  if (command.kind !== 'aim') return command;
  if (!rule.enabled || rule.strength <= 0 || rule.maxAngleRadians <= 0 || rule.maxDistance <= 0) {
    return command;
  }
  if (snapshot === null) return command;
  const player = snapshot.entities.find((entity) => entity.kind === 'player');
  if (player === undefined) return command;

  const aim = { x: command.x - player.x, y: command.y - player.y };
  const aimDistance = Math.hypot(aim.x, aim.y);
  if (aimDistance <= 0) return command;

  const target = chooseAimAssistTarget(
    snapshot.entities.filter((entity): entity is TargetSnapshot =>
      entity.kind === 'enemy' || entity.kind === 'boss'
    ),
    { x: player.x, y: player.y },
    { x: aim.x / aimDistance, y: aim.y / aimDistance },
    rule
  );
  if (target === null) return command;

  const toTarget = { x: target.x - player.x, y: target.y - player.y };
  const targetDistance = Math.hypot(toTarget.x, toTarget.y);
  if (targetDistance <= 0) return command;
  const targetDir = { x: toTarget.x / targetDistance, y: toTarget.y / targetDistance };
  const strength = clamp(rule.strength, 0, 1);
  const blended = normalize({
    x: aim.x / aimDistance + (targetDir.x - aim.x / aimDistance) * strength,
    y: aim.y / aimDistance + (targetDir.y - aim.y / aimDistance) * strength
  });
  if (blended === null) return command;
  return {
    kind: 'aim',
    x: player.x + blended.x * aimDistance,
    y: player.y + blended.y * aimDistance
  };
}

function chooseAimAssistTarget(
  targets: ReadonlyArray<TargetSnapshot>,
  player: Vec2,
  aimDir: Vec2,
  rule: AimAssistRule
): TargetSnapshot | null {
  let best: TargetSnapshot | null = null;
  let bestAngle = Number.POSITIVE_INFINITY;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const target of targets) {
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0 || distance > rule.maxDistance) continue;
    const dir = { x: dx / distance, y: dy / distance };
    const angle = Math.acos(clamp(aimDir.x * dir.x + aimDir.y * dir.y, -1, 1));
    if (angle > rule.maxAngleRadians) continue;
    if (
      angle < bestAngle ||
      (angle === bestAngle && distance < bestDistance) ||
      (angle === bestAngle && distance === bestDistance && target.id < (best?.id ?? Infinity))
    ) {
      best = target;
      bestAngle = angle;
      bestDistance = distance;
    }
  }
  return best;
}

function normalize(vector: Vec2): Vec2 | null {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= 0) return null;
  return { x: vector.x / length, y: vector.y / length };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

import { describe, expect, it } from 'vitest';

import { LASER, PISTOL, SHOTGUN, SMG, SNIPER, WEAPON_ARCHETYPES } from './weapons';

describe('weapon content', () => {
  it('defines explicit non-negative projectile knockback force for every weapon', () => {
    for (const weapon of Object.values(WEAPON_ARCHETYPES)) {
      expect(Number.isFinite(weapon.knockbackImpulse)).toBe(true);
      expect(weapon.knockbackImpulse).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps weapon force separate from damage tuning', () => {
    expect(PISTOL.knockbackImpulse).toBe(5);
    expect(SHOTGUN.knockbackImpulse).toBe(12);
    expect(SMG.knockbackImpulse).toBe(3);
    expect(SNIPER.knockbackImpulse).toBe(9);
    expect(LASER.knockbackImpulse).toBe(2);
  });
});

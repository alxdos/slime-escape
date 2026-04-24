import { describe, expect, it } from 'vitest';

import { LASER, PISTOL, SHOTGUN, SMG, SNIPER, WEAPON_ARCHETYPES } from './weapons';

describe('weapon content', () => {
  it('defines explicit non-negative projectile knockback force for every weapon', () => {
    for (const weapon of Object.values(WEAPON_ARCHETYPES)) {
      expect(Number.isFinite(weapon.projectile.knockbackImpulse)).toBe(true);
      expect(weapon.projectile.knockbackImpulse).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps weapon force separate from damage tuning', () => {
    expect(PISTOL.projectile.knockbackImpulse).toBe(5);
    expect(SHOTGUN.projectile.knockbackImpulse).toBe(12);
    expect(SMG.projectile.knockbackImpulse).toBe(3);
    expect(SNIPER.projectile.knockbackImpulse).toBe(9);
    expect(LASER.projectile.knockbackImpulse).toBe(2);
  });
});

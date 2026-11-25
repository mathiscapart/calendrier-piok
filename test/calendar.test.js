import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parisDate, unlockedCount, isUnlocked } from '../src/calendar.js';

const s = (today, extra = {}) => ({ today, year: 2026, unlockAll: false, ...extra });

test('la date suit Paris, pas UTC', () => {
  // 30 nov. 23h30 UTC = 1er déc. 00h30 à Paris
  assert.equal(parisDate(new Date('2026-11-30T23:30:00Z')), '2026-12-01');
  assert.equal(parisDate(new Date('2026-11-30T22:59:00Z')), '2026-11-30');
});

test('rien avant le 1er décembre', () => {
  assert.equal(unlockedCount(s('2026-11-30')), 0);
  assert.equal(isUnlocked(1, s('2026-11-30')), false);
});

test('une case par jour, sans pouvoir ouvrir le lendemain', () => {
  assert.equal(unlockedCount(s('2026-12-05')), 5);
  assert.equal(isUnlocked(5, s('2026-12-05')), true);
  assert.equal(isUnlocked(6, s('2026-12-05')), false);
});

test('tout reste ouvert après le 24', () => {
  assert.equal(unlockedCount(s('2026-12-31')), 24);
  assert.equal(unlockedCount(s('2027-01-15')), 24);
});

test('le mode dev ouvre tout', () => {
  assert.equal(unlockedCount(s('2026-06-01', { unlockAll: true })), 24);
});

test('jours invalides refusés', () => {
  for (const d of [0, 25, 1.5, NaN]) assert.equal(isUnlocked(d, s('2026-12-31')), false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { melanger } from '../public/melange.js';

const jours = Array.from({ length: 24 }, (_, i) => i + 1);

test('le mélange garde les 24 jours, sans doublon ni perte', () => {
  assert.deepEqual(melanger(jours, 2026).toSorted((a, b) => a - b), jours);
});

test('le mélange est stable pour une même graine', () => {
  assert.deepEqual(melanger(jours, 2026), melanger(jours, 2026));
});

test('les cases ne sont plus dans l’ordre 1 → 24', () => {
  assert.notDeepEqual(melanger(jours, 2026), jours);
});

test('la liste d’origine n’est pas modifiée', () => {
  const copie = [...jours];
  melanger(copie, 2026);
  assert.deepEqual(copie, jours);
});

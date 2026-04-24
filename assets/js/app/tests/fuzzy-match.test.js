import test from 'node:test';
import assert from 'node:assert/strict';
import { fuzzyMatchPoiName, matchRecommendedPois } from '../domain/fuzzy-match.js';

const pois = [
  { id: '1', name: 'Media Link Bakery Stop' },
  { id: '2', name: 'Portsdown Jerky House' },
  { id: '3', name: 'Mediapolis Porridge Corner' }
];

test('fuzzyMatchPoiName matches slightly different labels', () => {
  const match = fuzzyMatchPoiName('Portsdown Jerky', pois);
  assert.equal(match?.id, '2');
});

test('matchRecommendedPois falls back to first three POIs when nothing matches', () => {
  const matched = matchRecommendedPois(['Completely Different'], pois);
  assert.deepEqual(matched.map((poi) => poi.id), ['1', '2', '3']);
});

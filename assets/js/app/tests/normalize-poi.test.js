import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePois } from '../domain/normalize-poi.js';

test('normalizePois returns a stable tourist POI shape', () => {
  const normalized = normalizePois([
    {
      id: 'poi_live',
      name: 'Bakery Lane',
      category: 'Traditional Bakery',
      lat: 1.3,
      lng: 103.8,
      description: 'Fresh pastries'
    }
  ], { lat: 1.285, lng: 103.8268 });

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].name, 'Bakery Lane');
  assert.equal(normalized[0].category, 'Traditional Bakery');
  assert.equal(normalized[0].icon, '🥐');
  assert.ok(Array.isArray(normalized[0].missions));
  assert.ok(normalized[0].distance.endsWith('km') || normalized[0].distance.endsWith('m'));
});

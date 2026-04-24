const test = require('node:test');
const assert = require('node:assert/strict');
const { createResponseMeta, withResponseMeta } = require('../utils/response-meta');

test('createResponseMeta normalizes missing reasons', () => {
  assert.deepEqual(createResponseMeta({ source: 'mock', fallback: true }), {
    source: 'mock',
    fallback: true,
    reason: null
  });
});

test('withResponseMeta merges payload and metadata', () => {
  assert.deepEqual(withResponseMeta({ ok: true }, { source: 'fallback', fallback: true, reason: 'network' }), {
    ok: true,
    source: 'fallback',
    fallback: true,
    reason: 'network'
  });
});

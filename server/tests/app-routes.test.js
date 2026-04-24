const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fetch = require('node-fetch');
const { createApp } = require('../index');

async function withServer(run) {
  const app = createApp({
    env: {},
    fetchImpl: async () => {
      throw new Error('upstream unavailable');
    }
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test('GET /api/nearby returns explicit mock fallback metadata', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/nearby?lat=1.285&lng=103.8268&radius=1000`);
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.source, 'mock');
    assert.equal(data.fallback, true);
    assert.ok(Array.isArray(data.pois));
    assert.ok(data.reason);
  });
});

test('GET /api/directions returns explicit fallback metadata', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/directions?originLat=1.285&originLng=103.8268&destLat=1.286&destLng=103.827`);
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.source, 'fallback');
    assert.equal(data.fallback, true);
    assert.ok(Array.isArray(data.route));
    assert.ok(data.reason);
  });
});

test('POST /api/chat returns explicit fallback metadata', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userMessage: 'I want street food',
        userLat: 1.285,
        userLng: 103.8268
      })
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.source, 'fallback');
    assert.equal(data.fallback, true);
    assert.equal(data.recommendations.length, 3);
    assert.ok(Array.isArray(data.pois));
  });
});

test('GET /api/health reports provider flags', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.hasGrabKey, false);
    assert.equal(data.hasGrabMcpToken, false);
    assert.equal(data.hasGroqKey, false);
  });
});

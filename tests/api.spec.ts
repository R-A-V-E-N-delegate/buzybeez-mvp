import { test, expect } from '@playwright/test';

test.describe('BuzyBeez API Tests', () => {
  test.describe('Swarm API', () => {
    test('GET /api/swarm returns swarm config', async ({ request }) => {
      const response = await request.get('/api/swarm');
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('bees');
      expect(data).toHaveProperty('connections');
      expect(Array.isArray(data.bees)).toBeTruthy();
    });
  });

  test.describe('Bees API', () => {
    test('GET /api/bees returns list of bees', async ({ request }) => {
      const response = await request.get('/api/bees');
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(Array.isArray(data)).toBeTruthy();
    });

    test('GET /api/bees/:id/status returns bee status', async ({ request }) => {
      // First get list of bees
      const listResponse = await request.get('/api/bees');
      const bees = await listResponse.json();

      if (bees.length > 0) {
        const beeId = bees[0].id;
        const response = await request.get(`/api/bees/${beeId}/status`);
        expect(response.ok()).toBeTruthy();
        const data = await response.json();
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('running');
      }
    });
  });

  test.describe('Skills API', () => {
    test('GET /api/skills returns skills list', async ({ request }) => {
      const response = await request.get('/api/skills');
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data).toHaveProperty('skills');
      expect(Array.isArray(data.skills)).toBeTruthy();
    });

    test('GET /api/skills/:id returns skill details', async ({ request }) => {
      const response = await request.get('/api/skills/basic-tools');
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data).toHaveProperty('entry');
      expect(data.entry).toHaveProperty('id', 'basic-tools');
    });
  });

  test.describe('Mail API', () => {
    test('GET /api/mail/counts returns mail counts', async ({ request }) => {
      const response = await request.get('/api/mail/counts');
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data).toHaveProperty('human');
      expect(data.human).toHaveProperty('inbox');
      expect(data.human).toHaveProperty('outbox');
    });

    test('GET /api/mail/inbox returns human inbox', async ({ request }) => {
      const response = await request.get('/api/mail/inbox');
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(Array.isArray(data)).toBeTruthy();
    });

    test('GET /api/mail/outbox returns human outbox', async ({ request }) => {
      const response = await request.get('/api/mail/outbox');
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(Array.isArray(data)).toBeTruthy();
    });
  });

  test.describe('Canvas API', () => {
    test('GET /api/canvas returns nodes and edges', async ({ request }) => {
      const response = await request.get('/api/canvas');
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data).toHaveProperty('nodes');
      expect(data).toHaveProperty('edges');
      expect(Array.isArray(data.nodes)).toBeTruthy();
      expect(Array.isArray(data.edges)).toBeTruthy();
    });

    test('Canvas edges have bidirectional flag', async ({ request }) => {
      const response = await request.get('/api/canvas');
      const data = await response.json();

      // Check that at least some edges have bidirectional property
      const hasBidirectional = data.edges.some((e: { bidirectional?: boolean }) =>
        e.bidirectional !== undefined
      );
      expect(hasBidirectional).toBeTruthy();
    });
  });

  test.describe('Files API', () => {
    test('POST /api/files uploads a file', async ({ request }) => {
      const response = await request.post('/api/files', {
        multipart: {
          file: {
            name: 'test.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('test content for playwright'),
          },
        },
      });
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('file');
      expect(data.file).toHaveProperty('id');
      expect(data.file).toHaveProperty('filename', 'test.txt');
    });
  });
});

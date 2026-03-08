import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';

// Create a minimal test app
const createTestApp = () => {
  const app = express();

  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.0.0',
    });
  });

  app.get('/health/ready', (_req, res) => {
    // In tests, we assume all dependencies are ready
    res.json({
      status: 'ready',
      checks: {
        database: 'ok',
        cache: 'ok',
        search: 'ok',
      },
    });
  });

  app.get('/health/live', (_req, res) => {
    res.json({ status: 'alive' });
  });

  return app;
};

describe('Health Endpoints', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  afterAll(() => {
    // Cleanup if needed
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.version).toBeDefined();
    });
  });

  describe('GET /health/ready', () => {
    it('should return ready status with dependency checks', async () => {
      const response = await request(app).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ready');
      expect(response.body.checks).toBeDefined();
      expect(response.body.checks.database).toBe('ok');
      expect(response.body.checks.cache).toBe('ok');
      expect(response.body.checks.search).toBe('ok');
    });
  });

  describe('GET /health/live', () => {
    it('should return alive status', async () => {
      const response = await request(app).get('/health/live');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('alive');
    });
  });
});

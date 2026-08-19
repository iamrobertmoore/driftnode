/**
 * Tests for unit test emission (Task 11.7)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { emit } from '../src/emit.js';
import { IntermediateRepresentation, GeneratorConfig } from '../src/types.js';

describe('emitUnitTests (Task 11.7)', () => {
  const tempDir = path.join(process.cwd(), '.tmp-test-unit-tests');
  let testIR: IntermediateRepresentation;
  let testConfig: GeneratorConfig;

  beforeEach(async () => {
    // Create temporary directory
    await fs.promises.mkdir(tempDir, { recursive: true });

    // Sample IR for testing
    testIR = {
      schema_version: '1.0.0',
      source: {
        url: 'https://example.com/docs',
        content_hash: 'abc123',
      },
      base_url: 'https://api.example.com',
      auth: {
        type: 'api_key',
        location: 'header',
        header_name: 'X-API-Key',
      },
      resources: [
        {
          name: 'users',
          display_name: 'Users',
          description: 'User management',
          operations: [
            {
              name: 'list',
              display_name: 'List Users',
              description: 'Get all users',
              http_method: 'GET',
              path: '/users',
              parameters: [
                {
                  name: 'limit',
                  display_name: 'Limit',
                  description: 'Number of results',
                  location: 'query',
                  type: { kind: 'integer' },
                  required: false,
                },
              ],
              response_shape: {
                type: 'array',
                undocumented: false,
              },
              examples: [
                {
                  name: 'List users example',
                  request: { limit: 10 },
                  response: [{ id: 1, name: 'Alice' }],
                  status_code: 200,
                },
              ],
            },
            {
              name: 'create',
              display_name: 'Create User',
              description: 'Create a new user',
              http_method: 'POST',
              path: '/users',
              parameters: [
                {
                  name: 'name',
                  display_name: 'Name',
                  description: 'User name',
                  location: 'body',
                  type: { kind: 'string' },
                  required: true,
                  constraints: {
                    min_length: 3,
                    max_length: 50,
                  },
                },
              ],
              response_shape: {
                type: 'object',
                undocumented: false,
              },
              examples: [],
            },
          ],
        },
      ],
    };

    testConfig = {
      vendor: 'example',
      documentation: {
        type: 'url',
        url: 'https://example.com/docs',
      },
    };
  });

  afterEach(async () => {
    // Clean up
    if (fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true });
    }
  });

  it('should emit unit test file', async () => {
    await emit(testIR, testConfig, tempDir);

    const unitTestPath = path.join(tempDir, 'test', 'unit.test.ts');
    expect(fs.existsSync(unitTestPath)).toBe(true);
  });

  it('should include fixture-backed operation tests', async () => {
    await emit(testIR, testConfig, tempDir);

    const unitTestPath = path.join(tempDir, 'test', 'unit.test.ts');
    const content = await fs.promises.readFile(unitTestPath, 'utf-8');

    expect(content).toContain('Fixture-backed operation tests');
    expect(content).toContain('loadFixture');
    expect(content).toContain('fixtureExists');
  });

  it('should include parameter validation tests', async () => {
    await emit(testIR, testConfig, tempDir);

    const unitTestPath = path.join(tempDir, 'test', 'unit.test.ts');
    const content = await fs.promises.readFile(unitTestPath, 'utf-8');

    expect(content).toContain('Parameter validation');
    expect(content).toContain('required parameter');
  });

  it('should include error mapping tests', async () => {
    await emit(testIR, testConfig, tempDir);

    const unitTestPath = path.join(tempDir, 'test', 'unit.test.ts');
    const content = await fs.promises.readFile(unitTestPath, 'utf-8');

    expect(content).toContain('Error mapping');
    expect(content).toContain('HTTP 400');
    expect(content).toContain('HTTP 401');
    expect(content).toContain('HTTP 403');
    expect(content).toContain('HTTP 404');
    expect(content).toContain('HTTP 429');
    expect(content).toContain('HTTP 500');
  });

  it('should generate tests for operations with examples', async () => {
    await emit(testIR, testConfig, tempDir);

    const unitTestPath = path.join(tempDir, 'test', 'unit.test.ts');
    const content = await fs.promises.readFile(unitTestPath, 'utf-8');

    // Should include test for 'list' operation (has examples)
    expect(content).toContain('List Users');
  });

  it('should generate tests that run in offline mode', async () => {
    await emit(testIR, testConfig, tempDir);

    const unitTestPath = path.join(tempDir, 'test', 'unit.test.ts');
    const content = await fs.promises.readFile(unitTestPath, 'utf-8');

    expect(content).toContain('OFFLINE mode');
    expect(content).toContain('No vendor credentials are required');
  });

  it('should emit valid TypeScript', async () => {
    await emit(testIR, testConfig, tempDir);

    const unitTestPath = path.join(tempDir, 'test', 'unit.test.ts');
    expect(fs.existsSync(unitTestPath)).toBe(true);

    // Check that file has proper imports
    const content = await fs.promises.readFile(unitTestPath, 'utf-8');
    expect(content).toContain("import { describe, it, expect } from 'vitest'");
    expect(content).toContain("import { loadFixture, fixtureExists } from './fixture-loader'");
  });

  it('should emit fixture loader file', async () => {
    await emit(testIR, testConfig, tempDir);

    const loaderPath = path.join(tempDir, 'test', 'fixture-loader.ts');
    expect(fs.existsSync(loaderPath)).toBe(true);

    const content = await fs.promises.readFile(loaderPath, 'utf-8');
    expect(content).toContain('export function loadFixture');
    expect(content).toContain('export function fixtureExists');
  });

  it('should emit fixture files', async () => {
    await emit(testIR, testConfig, tempDir);

    const fixturePath = path.join(tempDir, 'test', 'fixtures', 'users-list-0.json');
    expect(fs.existsSync(fixturePath)).toBe(true);

    const fixture = JSON.parse(await fs.promises.readFile(fixturePath, 'utf-8'));
    expect(fixture.request).toBeDefined();
    expect(fixture.response).toBeDefined();
    expect(fixture.request.method).toBe('GET');
    expect(fixture.response.status).toBe(200);
  });

  it('should emit conformance test file', async () => {
    await emit(testIR, testConfig, tempDir);

    const conformancePath = path.join(tempDir, 'test', 'conformance.test.ts');
    expect(fs.existsSync(conformancePath)).toBe(true);

    const content = await fs.promises.readFile(conformancePath, 'utf-8');
    expect(content).toContain('Conformance test');
    expect(content).toContain('WITHOUT Kiro');
  });
});

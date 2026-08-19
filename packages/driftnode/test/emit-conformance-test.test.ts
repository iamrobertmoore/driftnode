import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { emit } from '../src/emit.js';
import type { IntermediateRepresentation, GeneratorConfig } from '../src/types.js';

describe('Conformance Test Emission', () => {
  const testTempDir = path.join(process.cwd(), '.tmp-test-conformance');
  
  beforeEach(async () => {
    // Clean up any existing test directory
    if (fs.existsSync(testTempDir)) {
      await fs.promises.rm(testTempDir, { recursive: true });
    }
    await fs.promises.mkdir(testTempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    if (fs.existsSync(testTempDir)) {
      await fs.promises.rm(testTempDir, { recursive: true });
    }
  });

  test('emits conformance test file for API with GET operations', async () => {
    const ir: IntermediateRepresentation = {
      schema_version: '1.0.0',
      source: {
        url: 'https://api.example.com/docs',
        content_hash: 'abc123',
      },
      base_url: 'https://api.example.com/v1',
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
              name: 'list-users',
              display_name: 'List Users',
              description: 'Get all users',
              http_method: 'GET',
              path: '/users',
              parameters: [],
              response_shape: {
                type: 'array',
                items_type: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', required: true },
                    name: { type: 'string', required: true },
                  },
                  undocumented: false,
                },
                undocumented: false,
              },
              examples: [],
            },
          ],
        },
      ],
    };

    const config: GeneratorConfig = {
      vendor: 'example',
      documentation: {
        type: 'url',
        url: 'https://api.example.com/docs',
      },
    };

    await emit(ir, config, testTempDir);

    // Verify conformance test file exists
    const conformanceTestPath = path.join(testTempDir, 'test', 'conformance.test.ts');
    expect(fs.existsSync(conformanceTestPath)).toBe(true);

    // Read the generated conformance test
    const conformanceTest = await fs.promises.readFile(conformanceTestPath, 'utf-8');

    // Verify key components are present
    expect(conformanceTest).toContain('import { describe, test, expect, beforeAll } from \'vitest\'');
    expect(conformanceTest).toContain('import * as fs from \'fs\'');
    expect(conformanceTest).toContain('import * as path from \'path\'');
    
    // Verify IR is read from contract file
    expect(conformanceTest).toContain('const irPath = path.join(__dirname, \'../contract/ir.json\')');
    expect(conformanceTest).toContain('const ir = JSON.parse(fs.readFileSync(irPath, \'utf-8\'))');
    
    // Verify API key environment variable check
    expect(conformanceTest).toContain('EXAMPLE_API_KEY');
    expect(conformanceTest).toContain('const hasCredentials = !!apiKey');
    
    // Verify authentication headers function
    expect(conformanceTest).toContain('function getAuthHeaders()');
    expect(conformanceTest).toContain('X-API-Key');
    
    // Verify makeRequest function
    expect(conformanceTest).toContain('async function makeRequest(');
    expect(conformanceTest).toContain('const url = new URL(ir.base_url + path)');
    
    // Verify response validation function
    expect(conformanceTest).toContain('function validateResponseShape(');
    expect(conformanceTest).toContain('responseShape.undocumented');
    
    // Verify test case for list-users operation
    expect(conformanceTest).toContain('List Users');
    expect(conformanceTest).toContain('GET /users');
    expect(conformanceTest).toContain('describeConditional');
    
    // Verify timeout is set to 60 seconds
    expect(conformanceTest).toContain('timeout: 60000');
  });

  test('excludes non-GET operations for safety', async () => {
    const ir: IntermediateRepresentation = {
      schema_version: '1.0.0',
      source: {
        url: 'https://api.example.com/docs',
        content_hash: 'abc123',
      },
      base_url: 'https://api.example.com/v1',
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
              name: 'list-users',
              display_name: 'List Users',
              description: 'Get all users',
              http_method: 'GET',
              path: '/users',
              parameters: [],
              response_shape: {
                type: 'array',
                undocumented: false,
              },
              examples: [],
            },
            {
              name: 'create-user',
              display_name: 'Create User',
              description: 'Create a new user',
              http_method: 'POST',
              path: '/users',
              parameters: [],
              response_shape: {
                type: 'object',
                undocumented: false,
              },
              examples: [],
            },
            {
              name: 'delete-user',
              display_name: 'Delete User',
              description: 'Delete a user',
              http_method: 'DELETE',
              path: '/users/{id}',
              parameters: [
                {
                  name: 'id',
                  display_name: 'User ID',
                  description: 'User ID to delete',
                  location: 'path',
                  type: { kind: 'string' },
                  required: true,
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

    const config: GeneratorConfig = {
      vendor: 'example',
      documentation: {
        type: 'url',
        url: 'https://api.example.com/docs',
      },
    };

    await emit(ir, config, testTempDir);

    // Read the generated conformance test
    const conformanceTestPath = path.join(testTempDir, 'test', 'conformance.test.ts');
    const conformanceTest = await fs.promises.readFile(conformanceTestPath, 'utf-8');

    // Verify GET operation is included
    expect(conformanceTest).toContain('List Users');
    expect(conformanceTest).toContain('GET /users');
    
    // Verify POST and DELETE operations are excluded
    expect(conformanceTest).toContain('documents excluded operations');
    expect(conformanceTest).toContain('Create User');
    expect(conformanceTest).toContain('POST operation excluded for safety');
    expect(conformanceTest).toContain('Delete User');
    expect(conformanceTest).toContain('DELETE operation excluded for safety');
  });

  test('skips GET operations that require path parameters', async () => {
    const ir: IntermediateRepresentation = {
      schema_version: '1.0.0',
      source: {
        url: 'https://api.example.com/docs',
        content_hash: 'abc123',
      },
      base_url: 'https://api.example.com/v1',
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
              name: 'get-user',
              display_name: 'Get User',
              description: 'Get user by ID',
              http_method: 'GET',
              path: '/users/{id}',
              parameters: [
                {
                  name: 'id',
                  display_name: 'User ID',
                  description: 'User ID',
                  location: 'path',
                  type: { kind: 'string' },
                  required: true,
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

    const config: GeneratorConfig = {
      vendor: 'example',
      documentation: {
        type: 'url',
        url: 'https://api.example.com/docs',
      },
    };

    await emit(ir, config, testTempDir);

    // Read the generated conformance test
    const conformanceTestPath = path.join(testTempDir, 'test', 'conformance.test.ts');
    const conformanceTest = await fs.promises.readFile(conformanceTestPath, 'utf-8');

    // Verify operation is excluded because it requires a resource ID
    expect(conformanceTest).toContain('Get User');
    expect(conformanceTest).toContain('requires specific resource ID');
  });

  test('generates correct auth headers for bearer token', async () => {
    const ir: IntermediateRepresentation = {
      schema_version: '1.0.0',
      source: {
        url: 'https://api.example.com/docs',
        content_hash: 'abc123',
      },
      base_url: 'https://api.example.com/v1',
      auth: {
        type: 'bearer_token',
        header_name: 'Authorization',
      },
      resources: [
        {
          name: 'users',
          display_name: 'Users',
          description: 'User management',
          operations: [
            {
              name: 'list-users',
              display_name: 'List Users',
              description: 'Get all users',
              http_method: 'GET',
              path: '/users',
              parameters: [],
              response_shape: {
                type: 'array',
                undocumented: false,
              },
              examples: [],
            },
          ],
        },
      ],
    };

    const config: GeneratorConfig = {
      vendor: 'example',
      documentation: {
        type: 'url',
        url: 'https://api.example.com/docs',
      },
    };

    await emit(ir, config, testTempDir);

    // Read the generated conformance test
    const conformanceTestPath = path.join(testTempDir, 'test', 'conformance.test.ts');
    const conformanceTest = await fs.promises.readFile(conformanceTestPath, 'utf-8');

    // Verify bearer token authentication
    expect(conformanceTest).toContain('EXAMPLE_ACCESS_TOKEN');
    expect(conformanceTest).toContain('case \'bearer_token\':');
    expect(conformanceTest).toContain('Bearer ${apiKey}');
  });

  test('documents safety constraint in generated test', async () => {
    const ir: IntermediateRepresentation = {
      schema_version: '1.0.0',
      source: {
        url: 'https://api.example.com/docs',
        content_hash: 'abc123',
      },
      base_url: 'https://api.example.com/v1',
      auth: {
        type: 'api_key',
        location: 'header',
        header_name: 'X-API-Key',
      },
      resources: [],
    };

    const config: GeneratorConfig = {
      vendor: 'example',
      documentation: {
        type: 'url',
        url: 'https://api.example.com/docs',
      },
    };

    await emit(ir, config, testTempDir);

    // Read the generated conformance test
    const conformanceTestPath = path.join(testTempDir, 'test', 'conformance.test.ts');
    const conformanceTest = await fs.promises.readFile(conformanceTestPath, 'utf-8');

    // Verify safety constraint is documented
    expect(conformanceTest).toContain('Safety Constraint:');
    expect(conformanceTest).toContain('Only read-only operations (GET) are tested');
    expect(conformanceTest).toContain('Incurring charges or costs');
    expect(conformanceTest).toContain('Creating billable resources');
    expect(conformanceTest).toContain('Modifying or deleting production data');
  });
});

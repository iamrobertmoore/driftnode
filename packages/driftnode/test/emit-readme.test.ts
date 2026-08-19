import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { emit } from '../src/emit.js';
import type { IntermediateRepresentation, GeneratorConfig } from '../src/types.js';

describe('README Emission (Task 11.4)', () => {
  it('should generate README with all required sections', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'driftnode-test-'));

    try {
      const ir: IntermediateRepresentation = {
        schema_version: '1.0.0',
        source: {
          url: 'https://example.com/api/docs',
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
            name: 'instances',
            display_name: 'Instances',
            description: 'Manage cloud instances',
            operations: [
              {
                name: 'list',
                display_name: 'List Instances',
                description: 'Get all instances',
                http_method: 'GET',
                path: '/instances',
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
        vendor: 'test-vendor',
        documentation: {
          type: 'url',
          url: 'https://example.com/api/docs',
        },
      };

      await emit(ir, config, tempDir);

      const readmePath = path.join(tempDir, 'README.md');
      expect(fs.existsSync(readmePath), 'README.md should exist').toBe(true);

      const readmeContent = fs.readFileSync(readmePath, 'utf-8');

      // Check for required sections
      expect(readmeContent).toContain('# n8n-nodes-test-vendor');
      expect(readmeContent).toContain('⚠️ This package is generated. Do not edit by hand.');
      expect(readmeContent).toContain('npm install n8n-nodes-test-vendor');
      expect(readmeContent).toContain('https://example.com/api/docs');
      expect(readmeContent).toContain('Conformance Test');
      expect(readmeContent).toContain('npm test');
      expect(readmeContent).toContain('Offline Mode');
      expect(readmeContent).toContain('TEST_VENDOR_API_KEY');
      expect(readmeContent).toContain('1 resources');
      expect(readmeContent).toContain('1 operations');
    } finally {
      // Clean up
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should generate README with local file path when source is file', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'driftnode-test-'));

    try {
      const ir: IntermediateRepresentation = {
        schema_version: '1.0.0',
        source: {
          path: '/path/to/docs.html',
          content_hash: 'abc123',
        },
        base_url: 'https://api.example.com/v1',
        auth: {
          type: 'bearer_token',
          header_name: 'Authorization',
        },
        resources: [{
          name: 'users',
          display_name: 'Users',
          description: 'User management',
          operations: [{
            name: 'list',
            display_name: 'List Users',
            description: 'Get all users',
            http_method: 'GET',
            path: '/users',
            parameters: [],
            response_shape: { type: 'array', undocumented: false },
            examples: [],
          }],
        }],
      };

      const config: GeneratorConfig = {
        vendor: 'example',
        documentation: {
          type: 'file',
          path: '/path/to/docs.html',
        },
      };

      await emit(ir, config, tempDir);

      const readmePath = path.join(tempDir, 'README.md');
      const readmeContent = fs.readFileSync(readmePath, 'utf-8');

      expect(readmeContent).toContain('local file: `/path/to/docs.html`');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

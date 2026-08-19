/**
 * Tests for error mapping in generated node execute method (Task 9.6)
 */

import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { emit } from '../src/emit.js';
import type { IntermediateRepresentation, GeneratorConfig } from '../src/types.js';

describe('Error Mapping in Execute Method', () => {
  it('should generate error handling with try-catch blocks', async () => {
    // Create a sample IR with a simple operation
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
              name: 'get',
              display_name: 'Get User',
              description: 'Get a user by ID',
              http_method: 'GET',
              path: '/users/{user_id}',
              parameters: [
                {
                  name: 'user_id',
                  display_name: 'User ID',
                  description: 'The user ID',
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
      documentation: { type: 'url', url: 'https://api.example.com/docs' },
    };

    // Create a temporary directory for testing
    const tempDir = path.join(process.cwd(), '.tmp-test-error-mapping');
    await fs.promises.mkdir(tempDir, { recursive: true });

    try {
      // Emit the package
      await emit(ir, config, tempDir);

      // Read the generated node file
      const nodePath = path.join(tempDir, 'nodes', 'Example', 'Example.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      // Verify error handling is present
      expect(nodeContent).toContain('try {');
      expect(nodeContent).toContain('} catch (error: any) {');
      
      // Verify status code extraction
      expect(nodeContent).toContain('const statusCode = error.statusCode || error.response?.statusCode || 500;');
      expect(nodeContent).toContain('const responseBody = error.response?.body || error.message || \'\';');
      expect(nodeContent).toContain('const bodyExcerpt = typeof responseBody === \'string\' ? responseBody.substring(0, 200) : JSON.stringify(responseBody).substring(0, 200);');
      
      // Verify operation name is included
      expect(nodeContent).toContain('const operationName = \'Get User\';');

      // Verify status code mappings
      expect(nodeContent).toContain('if (statusCode === 400)');
      expect(nodeContent).toContain('Invalid input for');
      
      expect(nodeContent).toContain('else if (statusCode === 401)');
      expect(nodeContent).toContain('Authentication failed for');
      
      expect(nodeContent).toContain('else if (statusCode === 403)');
      expect(nodeContent).toContain('Access forbidden for');
      
      expect(nodeContent).toContain('else if (statusCode === 404)');
      expect(nodeContent).toContain('Resource not found for');
      
      expect(nodeContent).toContain('else if (statusCode === 429)');
      expect(nodeContent).toContain('Rate limit exceeded for');
      
      expect(nodeContent).toContain('else if (statusCode >= 500)');
      expect(nodeContent).toContain('Server error for');

      // Verify error message includes all required parts
      expect(nodeContent).toContain('${operationName} (HTTP ${statusCode}): ${bodyExcerpt}');
      
      // Verify error is thrown
      expect(nodeContent).toContain('throw new Error(errorMessage);');

      // Verify resolveWithFullResponse is set to true
      expect(nodeContent).toContain('resolveWithFullResponse: true,');

      // Verify response body is extracted correctly
      expect(nodeContent).toContain('json: response.body || response,');

    } finally {
      // Clean up
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should include error handling for all operations', async () => {
    // Create a sample IR with multiple operations
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
          name: 'posts',
          display_name: 'Posts',
          description: 'Post management',
          operations: [
            {
              name: 'list',
              display_name: 'List Posts',
              description: 'List all posts',
              http_method: 'GET',
              path: '/posts',
              parameters: [],
              response_shape: {
                type: 'array',
                undocumented: false,
              },
              examples: [],
            },
            {
              name: 'create',
              display_name: 'Create Post',
              description: 'Create a new post',
              http_method: 'POST',
              path: '/posts',
              parameters: [
                {
                  name: 'title',
                  display_name: 'Title',
                  description: 'Post title',
                  location: 'body',
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
      documentation: { type: 'url', url: 'https://api.example.com/docs' },
    };

    const tempDir = path.join(process.cwd(), '.tmp-test-error-mapping-multi');
    await fs.promises.mkdir(tempDir, { recursive: true });

    try {
      await emit(ir, config, tempDir);

      const nodePath = path.join(tempDir, 'nodes', 'Example', 'Example.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      // Count occurrences of try-catch blocks (one per operation)
      const tryCatchCount = (nodeContent.match(/} catch \(error: any\) {/g) || []).length;
      expect(tryCatchCount).toBe(2); // One for each operation

      // Verify operation-specific error messages
      expect(nodeContent).toContain('const operationName = \'List Posts\';');
      expect(nodeContent).toContain('const operationName = \'Create Post\';');

    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });
});

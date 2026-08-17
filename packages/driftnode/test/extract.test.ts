/**
 * Unit tests for the extract stage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { extract } from '../src/extract.js';
import { DocumentChunk, GeneratorConfig, PartialIR } from '../src/types.js';
import { GeneratorError } from '../src/errors.js';
import { spawn } from 'child_process';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

const mockSpawn = vi.mocked(spawn);

/**
 * Helper to create a successful whoami mock response
 */
function createWhoamiMock() {
  return {
    stdout: {
      on: vi.fn((event, handler) => {
        if (event === 'data') {
          handler(Buffer.from('user@example.com'));
        }
      }),
    },
    stderr: { on: vi.fn() },
    stdin: { write: vi.fn(), end: vi.fn() },
    on: vi.fn((event, handler) => {
      if (event === 'close') {
        setTimeout(() => handler(0), 10);
      }
    }),
    killed: false,
    kill: vi.fn(),
  };
}

/**
 * Helper to mock spawn for authenticated scenarios
 * Takes a callback that handles chunk extraction calls
 */
function mockAuthenticatedSpawn(chunkHandler: (...args: any[]) => any) {
  mockSpawn.mockImplementation((command, args, options) => {
    // First call is always whoami (authentication check)
    if (args && args[0] === 'whoami') {
      return createWhoamiMock() as any;
    }
    
    // Subsequent calls are chunk extraction
    return chunkHandler(command, args, options);
  });
}

describe('extract', () => {
  const testWorkspace = path.join(process.cwd(), 'test-workspace');
  const testTempDir = path.join(testWorkspace, '.tmp-test-vendor');

  beforeEach(async () => {
    // Create test workspace
    await fs.promises.mkdir(testWorkspace, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test workspace
    if (fs.existsSync(testWorkspace)) {
      await fs.promises.rm(testWorkspace, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  describe('successful extraction', () => {
    it('should extract a valid PartialIR from a single chunk', async () => {
      const chunks: DocumentChunk[] = [
        {
          content: 'API documentation content',
          start: 0,
          end: 100,
        },
      ];

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      const partialIR: PartialIR = {
        base_url: 'https://api.example.com',
        auth: {
          type: 'api_key',
          location: 'header',
          header_name: 'X-API-Key',
        },
        resources: [
          {
            name: 'instances',
            display_name: 'Instances',
            description: 'Virtual machine instances',
            operations: [
              {
                name: 'list',
                display_name: 'List Instances',
                description: 'List all instances',
                http_method: 'GET',
                path: '/instances',
                parameters: [],
                response_shape: {
                  type: 'object',
                  undocumented: false,
                  properties: {
                    instances: {
                      type: 'array',
                      required: true,
                    },
                  },
                },
                examples: [],
              },
            ],
          },
        ],
      };

      // Mock kiro-cli subprocess
      mockAuthenticatedSpawn((command, args, options) => {
        const mockChild: any = {
          stdout: {
            on: vi.fn((event, handler) => {
              if (event === 'data') {
                // Simulate stdout output
              }
            }),
          },
          stderr: {
            on: vi.fn(),
          },
          stdin: {
            write: vi.fn(),
            end: vi.fn(),
          },
          on: vi.fn((event, handler) => {
            if (event === 'close') {
              // Write the IR file before calling close handler
              const outputPath = path.join(testTempDir, 'ir-chunk-0.json');
              fs.mkdirSync(testTempDir, { recursive: true });
              fs.writeFileSync(outputPath, JSON.stringify(partialIR, null, 2));
              
              // Simulate successful exit
              setTimeout(() => handler(0), 10);
            }
          }),
          killed: false,
          kill: vi.fn(),
        };

        return mockChild;
      });

      const result = await extract(chunks, config, testWorkspace);

      expect(result).toBeDefined();
      expect(result.schema_version).toBe('1.0.0');
      expect(result.base_url).toBe('https://api.example.com');
      expect(result.auth).toEqual({
        type: 'api_key',
        location: 'header',
        header_name: 'X-API-Key',
      });
      expect(result.resources).toHaveLength(1);
      expect(result.resources[0].name).toBe('instances');
      expect(result.source.url).toBe('https://example.com/docs');
      expect(result.source.content_hash).toBeDefined();
      expect(result.source.extracted_at).toBeDefined();
      
      // Validate ISO 8601 timestamp
      expect(() => new Date(result.source.extracted_at)).not.toThrow();
    });

    it('should merge multiple chunks with consistent base_url and auth', async () => {
      const chunks: DocumentChunk[] = [
        { content: 'Chunk 1', start: 0, end: 100 },
        { content: 'Chunk 2', start: 100, end: 200 },
      ];

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'file', path: '/docs/api.html' },
      };

      const partial1: PartialIR = {
        base_url: 'https://api.example.com',
        auth: {
          type: 'bearer_token',
          header_name: 'Authorization',
        },
        resources: [
          {
            name: 'instances',
            display_name: 'Instances',
            description: 'Instances',
            operations: [],
          },
        ],
      };

      const partial2: PartialIR = {
        resources: [
          {
            name: 'ssh-keys',
            display_name: 'SSH Keys',
            description: 'SSH Keys',
            operations: [],
          },
        ],
      };

      let callCount = 0;
      mockAuthenticatedSpawn(() => {
        const chunkIndex = callCount++;
        const partial = chunkIndex === 0 ? partial1 : partial2;

        const mockChild: any = {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          stdin: {
            write: vi.fn(),
            end: vi.fn(),
          },
          on: vi.fn((event, handler) => {
            if (event === 'close') {
              const outputPath = path.join(testTempDir, `ir-chunk-${chunkIndex}.json`);
              fs.mkdirSync(testTempDir, { recursive: true });
              fs.writeFileSync(outputPath, JSON.stringify(partial, null, 2));
              setTimeout(() => handler(0), 10);
            }
          }),
          killed: false,
          kill: vi.fn(),
        };

        return mockChild;
      });

      const result = await extract(chunks, config, testWorkspace);

      expect(result.base_url).toBe('https://api.example.com');
      expect(result.auth).toEqual({
        type: 'bearer_token',
        header_name: 'Authorization',
      });
      expect(result.resources).toHaveLength(2);
      expect(result.resources.map(r => r.name).sort()).toEqual(['instances', 'ssh-keys']);
      expect(result.source.path).toBe(path.resolve('/docs/api.html'));
    });

    it('should union operations for the same resource across chunks', async () => {
      const chunks: DocumentChunk[] = [
        { content: 'Chunk 1', start: 0, end: 100 },
        { content: 'Chunk 2', start: 100, end: 200 },
      ];

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com' },
      };

      const partial1: PartialIR = {
        base_url: 'https://api.example.com',
        auth: { type: 'basic' },
        resources: [
          {
            name: 'instances',
            display_name: 'Instances',
            description: 'Instances',
            operations: [
              {
                name: 'list',
                display_name: 'List',
                description: 'List',
                http_method: 'GET',
                path: '/instances',
                parameters: [],
                response_shape: { type: 'object', undocumented: true },
                examples: [],
              },
            ],
          },
        ],
      };

      const partial2: PartialIR = {
        resources: [
          {
            name: 'instances',
            display_name: 'Instances',
            description: 'Instances',
            operations: [
              {
                name: 'create',
                display_name: 'Create',
                description: 'Create',
                http_method: 'POST',
                path: '/instances',
                parameters: [],
                response_shape: { type: 'object', undocumented: true },
                examples: [],
              },
            ],
          },
        ],
      };

      let callCount = 0;
      mockAuthenticatedSpawn(() => {
        const chunkIndex = callCount++;
        const partial = chunkIndex === 0 ? partial1 : partial2;

        const mockChild: any = {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          stdin: { write: vi.fn(), end: vi.fn() },
          on: vi.fn((event, handler) => {
            if (event === 'close') {
              const outputPath = path.join(testTempDir, `ir-chunk-${chunkIndex}.json`);
              fs.mkdirSync(testTempDir, { recursive: true });
              fs.writeFileSync(outputPath, JSON.stringify(partial, null, 2));
              setTimeout(() => handler(0), 10);
            }
          }),
          killed: false,
          kill: vi.fn(),
        };

        return mockChild;
      });

      const result = await extract(chunks, config, testWorkspace);

      expect(result.resources).toHaveLength(1);
      expect(result.resources[0].operations).toHaveLength(2);
      expect(result.resources[0].operations.map(op => op.name).sort()).toEqual(['create', 'list']);
    });

    it('should compute SHA-256 content hash over full documentation', async () => {
      const chunks: DocumentChunk[] = [
        { content: 'Part 1', start: 0, end: 6 },
        { content: 'Part 2', start: 6, end: 12 },
      ];

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com' },
      };

      const partial: PartialIR = {
        base_url: 'https://api.example.com',
        auth: { type: 'basic' },
        resources: [],
      };

      mockAuthenticatedSpawn(() => {
        const mockChild: any = {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          stdin: { write: vi.fn(), end: vi.fn() },
          on: vi.fn((event, handler) => {
            if (event === 'close') {
              const outputPath = path.join(testTempDir, 'ir-chunk-0.json');
              fs.mkdirSync(testTempDir, { recursive: true });
              fs.writeFileSync(outputPath, JSON.stringify(partial, null, 2));
              setTimeout(() => handler(0), 10);
            }
          }),
          killed: false,
          kill: vi.fn(),
        };
        return mockChild;
      });

      const result = await extract([chunks[0]], config, testWorkspace);

      // Expected hash for "Part 1"
      const crypto = await import('crypto');
      const expectedHash = crypto.createHash('sha256').update('Part 1', 'utf-8').digest('hex');
      
      expect(result.source.content_hash).toBe(expectedHash);
    });
  });

  describe('error handling', () => {
    it('should throw kiro_not_authenticated error on preflight check before processing any chunks', async () => {
      const chunks: DocumentChunk[] = [
        { content: 'Test', start: 0, end: 4 },
      ];

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com' },
      };

      // Mock whoami call to fail (not authenticated)
      mockSpawn.mockImplementation((command, args) => {
        if (args && args[0] === 'whoami') {
          // whoami call - simulate not authenticated
          const mockChild: any = {
            stdout: { on: vi.fn() },
            stderr: { on: vi.fn() },
            stdin: { write: vi.fn(), end: vi.fn() },
            on: vi.fn((event, handler) => {
              if (event === 'close') {
                // Non-zero exit code means not authenticated
                setTimeout(() => handler(1), 10);
              }
            }),
            killed: false,
            kill: vi.fn(),
          };
          return mockChild;
        }
        
        // Should never get to chunk extraction
        throw new Error('Should not reach chunk extraction when whoami fails');
      });

      await expect(extract(chunks, config, testWorkspace)).rejects.toMatchObject({
        stage: 'extract',
        type: 'kiro_not_authenticated',
      });
      
      // Verify only whoami was called, no chunk extraction
      expect(mockSpawn).toHaveBeenCalledTimes(1);
      expect(mockSpawn).toHaveBeenCalledWith('kiro-cli', ['whoami'], expect.any(Object));
    });

    it('should throw kiro_not_authenticated error when whoami returns empty stdout', async () => {
      const chunks: DocumentChunk[] = [
        { content: 'Test', start: 0, end: 4 },
      ];

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com' },
      };

      // Mock whoami to return exit code 0 but empty stdout
      mockSpawn.mockImplementation((command, args) => {
        if (args && args[0] === 'whoami') {
          const mockChild: any = {
            stdout: { on: vi.fn() },
            stderr: { on: vi.fn() },
            stdin: { write: vi.fn(), end: vi.fn() },
            on: vi.fn((event, handler) => {
              if (event === 'close') {
                // Exit code 0 but stdout was never populated
                setTimeout(() => handler(0), 10);
              }
            }),
            killed: false,
            kill: vi.fn(),
          };
          return mockChild;
        }
        
        throw new Error('Should not reach chunk extraction');
      });

      await expect(extract(chunks, config, testWorkspace)).rejects.toMatchObject({
        stage: 'extract',
        type: 'kiro_not_authenticated',
      });
    });

    it('should throw kiro_not_found error when kiro-cli is not in PATH', async () => {
      const chunks: DocumentChunk[] = [
        { content: 'Test', start: 0, end: 4 },
      ];

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com' },
      };

      mockAuthenticatedSpawn(() => {
        const mockChild: any = {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          stdin: { write: vi.fn(), end: vi.fn() },
          on: vi.fn((event, handler) => {
            if (event === 'error') {
              const error: any = new Error('spawn ENOENT');
              error.code = 'ENOENT';
              setTimeout(() => handler(error), 10);
            }
          }),
          killed: false,
          kill: vi.fn(),
        };
        return mockChild;
      });

      await expect(extract(chunks, config, testWorkspace)).rejects.toMatchObject({
        stage: 'extract',
        type: 'kiro_not_found',
      });
    });

    it('should throw kiro_failed error on non-zero exit code', async () => {
      const chunks: DocumentChunk[] = [
        { content: 'Test', start: 0, end: 4 },
      ];

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com' },
      };

      mockAuthenticatedSpawn(() => {
        const mockChild: any = {
          stdout: { on: vi.fn() },
          stderr: {
            on: vi.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from('Error: something went wrong'));
              }
            }),
          },
          stdin: { write: vi.fn(), end: vi.fn() },
          on: vi.fn((event, handler) => {
            if (event === 'close') {
              setTimeout(() => handler(1), 10);
            }
          }),
          killed: false,
          kill: vi.fn(),
        };
        return mockChild;
      });

      await expect(extract(chunks, config, testWorkspace)).rejects.toMatchObject({
        stage: 'extract',
        type: 'kiro_failed',
        exit_code: 1,
        stderr: 'Error: something went wrong',
      });
    });

    it('should throw ir_file_missing error when output file is not created', async () => {
      const chunks: DocumentChunk[] = [
        { content: 'Test', start: 0, end: 4 },
      ];

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com' },
      };

      mockAuthenticatedSpawn(() => {
        const mockChild: any = {
          stdout: { on: vi.fn() },
          stderr: {
            on: vi.fn((event, handler) => {
              if (event === 'data') {
                handler(Buffer.from('Did not write file'));
              }
            }),
          },
          stdin: { write: vi.fn(), end: vi.fn() },
          on: vi.fn((event, handler) => {
            if (event === 'close') {
              // Exit successfully but don't write the file
              setTimeout(() => handler(0), 10);
            }
          }),
          killed: false,
          kill: vi.fn(),
        };
        return mockChild;
      });

      await expect(extract(chunks, config, testWorkspace)).rejects.toMatchObject({
        stage: 'extract',
        type: 'ir_file_missing',
        chunk_index: 0,
        stderr: 'Did not write file',
      });
    });

    it('should throw ir_file_empty error when output file is empty', async () => {
      const chunks: DocumentChunk[] = [
        { content: 'Test', start: 0, end: 4 },
      ];

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com' },
      };

      mockAuthenticatedSpawn(() => {
        const mockChild: any = {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          stdin: { write: vi.fn(), end: vi.fn() },
          on: vi.fn((event, handler) => {
            if (event === 'close') {
              const outputPath = path.join(testTempDir, 'ir-chunk-0.json');
              fs.mkdirSync(testTempDir, { recursive: true });
              fs.writeFileSync(outputPath, '   '); // Empty/whitespace only
              setTimeout(() => handler(0), 10);
            }
          }),
          killed: false,
          kill: vi.fn(),
        };
        return mockChild;
      });

      await expect(extract(chunks, config, testWorkspace)).rejects.toMatchObject({
        stage: 'extract',
        type: 'ir_file_empty',
        chunk_index: 0,
      });
    });

    it('should throw invalid_ir_json error when output file has invalid JSON', async () => {
      const chunks: DocumentChunk[] = [
        { content: 'Test', start: 0, end: 4 },
      ];

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com' },
      };

      mockAuthenticatedSpawn(() => {
        const mockChild: any = {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          stdin: { write: vi.fn(), end: vi.fn() },
          on: vi.fn((event, handler) => {
            if (event === 'close') {
              const outputPath = path.join(testTempDir, 'ir-chunk-0.json');
              fs.mkdirSync(testTempDir, { recursive: true });
              fs.writeFileSync(outputPath, 'Not valid JSON {');
              setTimeout(() => handler(0), 10);
            }
          }),
          killed: false,
          kill: vi.fn(),
        };
        return mockChild;
      });

      await expect(extract(chunks, config, testWorkspace)).rejects.toMatchObject({
        stage: 'extract',
        type: 'invalid_ir_json',
        chunk_index: 0,
      });
    });

    it('should throw merge_conflict error for conflicting base_url', async () => {
      const chunks: DocumentChunk[] = [
        { content: 'Chunk 1', start: 0, end: 7 },
        { content: 'Chunk 2', start: 7, end: 14 },
      ];

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com' },
      };

      const partial1: PartialIR = {
        base_url: 'https://api.example.com',
        auth: { type: 'basic' },
        resources: [],
      };

      const partial2: PartialIR = {
        base_url: 'https://api.different.com',
        resources: [],
      };

      let callCount = 0;
      mockAuthenticatedSpawn(() => {
        const chunkIndex = callCount++;
        const partial = chunkIndex === 0 ? partial1 : partial2;

        const mockChild: any = {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          stdin: { write: vi.fn(), end: vi.fn() },
          on: vi.fn((event, handler) => {
            if (event === 'close') {
              const outputPath = path.join(testTempDir, `ir-chunk-${chunkIndex}.json`);
              fs.mkdirSync(testTempDir, { recursive: true });
              fs.writeFileSync(outputPath, JSON.stringify(partial, null, 2));
              setTimeout(() => handler(0), 10);
            }
          }),
          killed: false,
          kill: vi.fn(),
        };
        return mockChild;
      });

      await expect(extract(chunks, config, testWorkspace)).rejects.toMatchObject({
        stage: 'extract',
        type: 'merge_conflict',
        field: 'base_url',
        values: ['https://api.example.com', 'https://api.different.com'],
      });
    });

    it('should throw merge_conflict error for conflicting auth types', async () => {
      const chunks: DocumentChunk[] = [
        { content: 'Chunk 1', start: 0, end: 7 },
        { content: 'Chunk 2', start: 7, end: 14 },
      ];

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com' },
      };

      const partial1: PartialIR = {
        base_url: 'https://api.example.com',
        auth: { type: 'basic' },
        resources: [],
      };

      const partial2: PartialIR = {
        auth: {
          type: 'api_key',
          location: 'header',
          header_name: 'X-API-Key',
        },
        resources: [],
      };

      let callCount = 0;
      mockAuthenticatedSpawn(() => {
        const chunkIndex = callCount++;
        const partial = chunkIndex === 0 ? partial1 : partial2;

        const mockChild: any = {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          stdin: { write: vi.fn(), end: vi.fn() },
          on: vi.fn((event, handler) => {
            if (event === 'close') {
              const outputPath = path.join(testTempDir, `ir-chunk-${chunkIndex}.json`);
              fs.mkdirSync(testTempDir, { recursive: true });
              fs.writeFileSync(outputPath, JSON.stringify(partial, null, 2));
              setTimeout(() => handler(0), 10);
            }
          }),
          killed: false,
          kill: vi.fn(),
        };
        return mockChild;
      });

      await expect(extract(chunks, config, testWorkspace)).rejects.toMatchObject({
        stage: 'extract',
        type: 'merge_conflict',
        field: 'auth.type',
        values: ['basic', 'api_key'],
      });
    });

    it('should throw merge_conflict error for conflicting operation http_method', async () => {
      const chunks: DocumentChunk[] = [
        { content: 'Chunk 1', start: 0, end: 7 },
        { content: 'Chunk 2', start: 7, end: 14 },
      ];

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com' },
      };

      const partial1: PartialIR = {
        base_url: 'https://api.example.com',
        auth: { type: 'basic' },
        resources: [
          {
            name: 'instances',
            display_name: 'Instances',
            description: 'Instances',
            operations: [
              {
                name: 'update',
                display_name: 'Update',
                description: 'Update',
                http_method: 'PUT',
                path: '/instances/{id}',
                parameters: [],
                response_shape: { type: 'object', undocumented: true },
                examples: [],
              },
            ],
          },
        ],
      };

      const partial2: PartialIR = {
        resources: [
          {
            name: 'instances',
            display_name: 'Instances',
            description: 'Instances',
            operations: [
              {
                name: 'update',
                display_name: 'Update',
                description: 'Update',
                http_method: 'PATCH',
                path: '/instances/{id}',
                parameters: [],
                response_shape: { type: 'object', undocumented: true },
                examples: [],
              },
            ],
          },
        ],
      };

      let callCount = 0;
      mockAuthenticatedSpawn(() => {
        const chunkIndex = callCount++;
        const partial = chunkIndex === 0 ? partial1 : partial2;

        const mockChild: any = {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          stdin: { write: vi.fn(), end: vi.fn() },
          on: vi.fn((event, handler) => {
            if (event === 'close') {
              const outputPath = path.join(testTempDir, `ir-chunk-${chunkIndex}.json`);
              fs.mkdirSync(testTempDir, { recursive: true });
              fs.writeFileSync(outputPath, JSON.stringify(partial, null, 2));
              setTimeout(() => handler(0), 10);
            }
          }),
          killed: false,
          kill: vi.fn(),
        };
        return mockChild;
      });

      await expect(extract(chunks, config, testWorkspace)).rejects.toMatchObject({
        stage: 'extract',
        type: 'merge_conflict',
        field: 'resource.instances.operation.update.http_method',
        values: ['PUT', 'PATCH'],
      });
    });

    it('should throw merge_conflict error for conflicting operation path', async () => {
      const chunks: DocumentChunk[] = [
        { content: 'Chunk 1', start: 0, end: 7 },
        { content: 'Chunk 2', start: 7, end: 14 },
      ];

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com' },
      };

      const partial1: PartialIR = {
        base_url: 'https://api.example.com',
        auth: { type: 'basic' },
        resources: [
          {
            name: 'instances',
            display_name: 'Instances',
            description: 'Instances',
            operations: [
              {
                name: 'get',
                display_name: 'Get',
                description: 'Get',
                http_method: 'GET',
                path: '/instances/{id}',
                parameters: [],
                response_shape: { type: 'object', undocumented: true },
                examples: [],
              },
            ],
          },
        ],
      };

      const partial2: PartialIR = {
        resources: [
          {
            name: 'instances',
            display_name: 'Instances',
            description: 'Instances',
            operations: [
              {
                name: 'get',
                display_name: 'Get',
                description: 'Get',
                http_method: 'GET',
                path: '/instance/{instance-id}',
                parameters: [],
                response_shape: { type: 'object', undocumented: true },
                examples: [],
              },
            ],
          },
        ],
      };

      let callCount = 0;
      mockAuthenticatedSpawn(() => {
        const chunkIndex = callCount++;
        const partial = chunkIndex === 0 ? partial1 : partial2;

        const mockChild: any = {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          stdin: { write: vi.fn(), end: vi.fn() },
          on: vi.fn((event, handler) => {
            if (event === 'close') {
              const outputPath = path.join(testTempDir, `ir-chunk-${chunkIndex}.json`);
              fs.mkdirSync(testTempDir, { recursive: true });
              fs.writeFileSync(outputPath, JSON.stringify(partial, null, 2));
              setTimeout(() => handler(0), 10);
            }
          }),
          killed: false,
          kill: vi.fn(),
        };
        return mockChild;
      });

      await expect(extract(chunks, config, testWorkspace)).rejects.toMatchObject({
        stage: 'extract',
        type: 'merge_conflict',
        field: 'resource.instances.operation.get.path',
        values: ['/instances/{id}', '/instance/{instance-id}'],
      });
    });

    it('should throw missing_resource error when configured resource not found', async () => {
      const chunks: DocumentChunk[] = [
        { content: 'Test', start: 0, end: 4 },
      ];

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com' },
        include: [
          { resource: 'nonexistent-resource' },
        ],
      };

      const partial: PartialIR = {
        base_url: 'https://api.example.com',
        auth: { type: 'basic' },
        resources: [
          {
            name: 'instances',
            display_name: 'Instances',
            description: 'Instances',
            operations: [],
          },
        ],
      };

      mockAuthenticatedSpawn(() => {
        const mockChild: any = {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          stdin: { write: vi.fn(), end: vi.fn() },
          on: vi.fn((event, handler) => {
            if (event === 'close') {
              const outputPath = path.join(testTempDir, 'ir-chunk-0.json');
              fs.mkdirSync(testTempDir, { recursive: true });
              fs.writeFileSync(outputPath, JSON.stringify(partial, null, 2));
              setTimeout(() => handler(0), 10);
            }
          }),
          killed: false,
          kill: vi.fn(),
        };
        return mockChild;
      });

      await expect(extract(chunks, config, testWorkspace)).rejects.toMatchObject({
        stage: 'extract',
        type: 'missing_resource',
        resource: 'nonexistent-resource',
      });
    });

    it('should throw missing_operation error when configured operation not found', async () => {
      const chunks: DocumentChunk[] = [
        { content: 'Test', start: 0, end: 4 },
      ];

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com' },
        include: [
          { resource: 'instances', operations: ['nonexistent-operation'] },
        ],
      };

      const partial: PartialIR = {
        base_url: 'https://api.example.com',
        auth: { type: 'basic' },
        resources: [
          {
            name: 'instances',
            display_name: 'Instances',
            description: 'Instances',
            operations: [
              {
                name: 'list',
                display_name: 'List',
                description: 'List',
                http_method: 'GET',
                path: '/instances',
                parameters: [],
                response_shape: { type: 'object', undocumented: true },
                examples: [],
              },
            ],
          },
        ],
      };

      mockAuthenticatedSpawn(() => {
        const mockChild: any = {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          stdin: { write: vi.fn(), end: vi.fn() },
          on: vi.fn((event, handler) => {
            if (event === 'close') {
              const outputPath = path.join(testTempDir, 'ir-chunk-0.json');
              fs.mkdirSync(testTempDir, { recursive: true });
              fs.writeFileSync(outputPath, JSON.stringify(partial, null, 2));
              setTimeout(() => handler(0), 10);
            }
          }),
          killed: false,
          kill: vi.fn(),
        };
        return mockChild;
      });

      await expect(extract(chunks, config, testWorkspace)).rejects.toMatchObject({
        stage: 'extract',
        type: 'missing_operation',
        resource: 'instances',
        operation: 'nonexistent-operation',
      });
    });
  });

  describe('include filters', () => {
    it('should filter resources based on include configuration', async () => {
      const chunks: DocumentChunk[] = [
        { content: 'Test', start: 0, end: 4 },
      ];

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com' },
        include: [
          { resource: 'instances' },
        ],
      };

      const partial: PartialIR = {
        base_url: 'https://api.example.com',
        auth: { type: 'basic' },
        resources: [
          {
            name: 'instances',
            display_name: 'Instances',
            description: 'Instances',
            operations: [],
          },
          {
            name: 'ssh-keys',
            display_name: 'SSH Keys',
            description: 'SSH Keys',
            operations: [],
          },
        ],
      };

      mockAuthenticatedSpawn(() => {
        const mockChild: any = {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          stdin: { write: vi.fn(), end: vi.fn() },
          on: vi.fn((event, handler) => {
            if (event === 'close') {
              const outputPath = path.join(testTempDir, 'ir-chunk-0.json');
              fs.mkdirSync(testTempDir, { recursive: true });
              fs.writeFileSync(outputPath, JSON.stringify(partial, null, 2));
              setTimeout(() => handler(0), 10);
            }
          }),
          killed: false,
          kill: vi.fn(),
        };
        return mockChild;
      });

      const result = await extract(chunks, config, testWorkspace);

      expect(result.resources).toHaveLength(1);
      expect(result.resources[0].name).toBe('instances');
    });

    it('should filter operations based on include configuration', async () => {
      const chunks: DocumentChunk[] = [
        { content: 'Test', start: 0, end: 4 },
      ];

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com' },
        include: [
          { resource: 'instances', operations: ['list', 'create'] },
        ],
      };

      const partial: PartialIR = {
        base_url: 'https://api.example.com',
        auth: { type: 'basic' },
        resources: [
          {
            name: 'instances',
            display_name: 'Instances',
            description: 'Instances',
            operations: [
              {
                name: 'list',
                display_name: 'List',
                description: 'List',
                http_method: 'GET',
                path: '/instances',
                parameters: [],
                response_shape: { type: 'object', undocumented: true },
                examples: [],
              },
              {
                name: 'create',
                display_name: 'Create',
                description: 'Create',
                http_method: 'POST',
                path: '/instances',
                parameters: [],
                response_shape: { type: 'object', undocumented: true },
                examples: [],
              },
              {
                name: 'delete',
                display_name: 'Delete',
                description: 'Delete',
                http_method: 'DELETE',
                path: '/instances/{id}',
                parameters: [],
                response_shape: { type: 'object', undocumented: true },
                examples: [],
              },
            ],
          },
        ],
      };

      mockAuthenticatedSpawn(() => {
        const mockChild: any = {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          stdin: { write: vi.fn(), end: vi.fn() },
          on: vi.fn((event, handler) => {
            if (event === 'close') {
              const outputPath = path.join(testTempDir, 'ir-chunk-0.json');
              fs.mkdirSync(testTempDir, { recursive: true });
              fs.writeFileSync(outputPath, JSON.stringify(partial, null, 2));
              setTimeout(() => handler(0), 10);
            }
          }),
          killed: false,
          kill: vi.fn(),
        };
        return mockChild;
      });

      const result = await extract(chunks, config, testWorkspace);

      expect(result.resources).toHaveLength(1);
      expect(result.resources[0].operations).toHaveLength(2);
      expect(result.resources[0].operations.map(op => op.name).sort()).toEqual(['create', 'list']);
    });
  });
});

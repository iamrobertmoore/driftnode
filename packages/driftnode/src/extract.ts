/**
 * Stage 2: Extract
 * 
 * Invokes kiro-cli to extract structured IR from documentation chunks,
 * merges partial IRs, and adds generator-owned metadata.
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import * as crypto from 'crypto';
import { DocumentChunk, PartialIR, IntermediateRepresentation, GeneratorConfig, AuthenticationScheme, Resource, Operation } from './types.js';
import { GeneratorError } from './errors.js';
import { getCacheDirectory, ensureCacheDirectory, computeCacheKey, readFromCache, writeToCache } from './cache.js';

/**
 * Extract intermediate representation from documentation chunks
 * 
 * @param chunks - Normalized documentation chunks
 * @param config - Generator configuration
 * @param workspaceDir - Workspace root directory
 * @param noCache - If true, skip cache lookups and force re-extraction
 * @returns Complete IntermediateRepresentation
 */
export async function extract(
  chunks: DocumentChunk[],
  config: GeneratorConfig,
  workspaceDir: string,
  noCache: boolean = false
): Promise<IntermediateRepresentation> {
  // Create temporary directory for IR chunk files
  const tempDir = path.join(workspaceDir, `.tmp-${config.vendor}`);
  await fs.promises.mkdir(tempDir, { recursive: true });

  // Set up cache directory
  const cacheDir = getCacheDirectory();
  if (!noCache) {
    await ensureCacheDirectory(cacheDir);
  }

  // Preflight: Check kiro-cli authentication before processing chunks
  await checkKiroAuthentication();


  try {
    // Extract partial IRs from each chunk with bounded concurrency
    // Task 3.3: Implement bounded concurrency pool
    // Task 5.1: Track total extraction time
    const extractionStartTime = Date.now();
    const concurrency = config.concurrency ?? 4; // Default to 4 concurrent extractions
    const partialIRs: PartialIR[] = new Array(chunks.length);
    
    // Track cache hits and misses
    let reusedCount = 0;
    let extractedCount = 0;
    
    // Process chunks in batches to limit concurrency
    for (let batchStart = 0; batchStart < chunks.length; batchStart += concurrency) {
      const batchEnd = Math.min(batchStart + concurrency, chunks.length);
      const batch = chunks.slice(batchStart, batchEnd);
      
      // Start all chunks in this batch concurrently
      const batchPromises = batch.map(async (chunk, batchIndex) => {
        const chunkIndex = batchStart + batchIndex;
        const outputPath = path.join(tempDir, `ir-chunk-${chunkIndex}.json`);
        
        const started = Date.now();
        process.stdout.write(`  chunk ${chunkIndex + 1}/${chunks.length}...`);
        
        try {
          let partialIR: PartialIR;
          let fromCache = false;
          
          // Check cache if enabled
          if (!noCache) {
            // Build extraction prompt to compute cache key
            const extractionPrompt = buildExtractionPrompt(chunk.content, outputPath);
            const cacheKey = computeCacheKey(chunk.content, extractionPrompt);
            
            // Try to read from cache
            const cachedIR = await readFromCache(cacheDir, cacheKey);
            
            if (cachedIR) {
              partialIR = cachedIR;
              fromCache = true;
            } else {
              // Cache miss: extract and write to cache
              partialIR = await extractChunk(
                chunk,
                outputPath,
                chunkIndex,
                config.effort,
                config.extractionTimeoutSeconds
              );
              
              // Write to cache for next time
              await writeToCache(cacheDir, cacheKey, partialIR);
            }
          } else {
            // Cache disabled: always extract
            partialIR = await extractChunk(
              chunk,
              outputPath,
              chunkIndex,
              config.effort,
              config.extractionTimeoutSeconds
            );
          }
          
          const elapsed = ((Date.now() - started) / 1000).toFixed(1);
          const found = partialIR.resources?.length ?? 0;
          const cacheStatus = fromCache ? ' (cached)' : '';
          process.stdout.write(
            ` ${elapsed}s, ${found} resource${found === 1 ? '' : 's'}${cacheStatus}\n`
          );
          
          // Update counters
          if (fromCache) {
            reusedCount++;
          } else {
            extractedCount++;
          }
          
          return { chunkIndex, partialIR };
        } catch (error) {
          // On failure, log error and rethrow to cancel remaining chunks
          const elapsed = ((Date.now() - started) / 1000).toFixed(1);
          process.stdout.write(` ${elapsed}s, FAILED\n`);
          throw error;
        }
      });
      
      // Wait for all chunks in this batch to complete
      // If any chunk fails, this will throw and cancel remaining batches
      const batchResults = await Promise.all(batchPromises);
      
      // Store results in correct index order
      for (const { chunkIndex, partialIR } of batchResults) {
        partialIRs[chunkIndex] = partialIR;
      }
    }
    
    const extractionEndTime = Date.now();
    const totalElapsedSeconds = ((extractionEndTime - extractionStartTime) / 1000).toFixed(1);
    
    // Task 5.2: Output extraction summary with cache usage
    process.stdout.write(
      `\nExtraction complete: ${totalElapsedSeconds}s total, ${chunks.length} chunk${chunks.length === 1 ? '' : 's'} processed ` +
      `(${reusedCount} reused, ${extractedCount} extracted)\n`
    );

    // Merge partial IRs into complete IR
    const mergedIR = mergePartialIRs(partialIRs, config);

    // Apply auth override if present in config
    let finalAuth = mergedIR.auth;
    if (config.auth !== undefined) {
      finalAuth = config.auth;
      process.stdout.write('  Auth taken from configuration\n');
    }

    // Compute full normalized documentation for content hash
    const fullContent = chunks.map(c => c.content).join('\n');
    const contentHash = computeContentHash(fullContent);

    // Add generator-owned metadata
    const completeIR: IntermediateRepresentation = {
      schema_version: '1.0.0',
      source: {
        ...(config.documentation.type === 'url' 
          ? { url: config.documentation.url }
          : { path: path.resolve(config.documentation.path) }
        ),
        content_hash: contentHash,
        extracted_at: new Date().toISOString(),
      },
      base_url: mergedIR.base_url,
      auth: finalAuth,
      resources: mergedIR.resources,
      ...(mergedIR.pagination ? { pagination: mergedIR.pagination } : {}),
    };

    return completeIR;
  } finally {
    // Clean up temporary directory
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Extract a partial IR from a single documentation chunk using kiro-cli
 */
async function extractChunk(
  chunk: DocumentChunk,
  outputPath: string,
  chunkIndex: number,
  effort?: GeneratorConfig['effort'],
  timeoutSeconds?: number
): Promise<PartialIR> {
  // Build extraction prompt
  const prompt = buildExtractionPrompt(chunk.content, outputPath);

  // Invoke kiro-cli (Task 1.3: pass effort, Task 4.3: pass timeout)
  const result = await invokeKiroCli(prompt, chunkIndex, effort, timeoutSeconds);

  if (result.exitCode !== 0) {
    const error: GeneratorError = {
      stage: 'extract',
      type: 'kiro_failed',
      exit_code: result.exitCode,
      stderr: result.stderr,
    };
    throw error;
  }

  // Read the IR file
  if (!fs.existsSync(outputPath)) {
    const error: GeneratorError = {
      stage: 'extract',
      type: 'ir_file_missing',
      chunk_index: chunkIndex,
      expected_path: outputPath,
      stderr: result.stderr,
    };
    throw error;
  }

  const fileContent = await fs.promises.readFile(outputPath, 'utf-8');

  if (fileContent.trim().length === 0) {
    const error: GeneratorError = {
      stage: 'extract',
      type: 'ir_file_empty',
      chunk_index: chunkIndex,
      path: outputPath,
    };
    throw error;
  }

  // Parse JSON
  let partialIR: PartialIR;
  try {
    partialIR = JSON.parse(fileContent);
  } catch (parseError) {
    const error: GeneratorError = {
      stage: 'extract',
      type: 'invalid_ir_json',
      chunk_index: chunkIndex,
      path: outputPath,
      parse_error: parseError instanceof Error ? parseError.message : String(parseError),
    };
    throw error;
  }

  return partialIR;
}

/**
 * Invoke kiro-cli as a subprocess with timeout
 */
async function invokeKiroCli(
  prompt: string,
  chunkIndex: number,
  effort?: GeneratorConfig['effort'],
  timeoutSeconds?: number
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // Build arguments: Task 1.3 - add --effort flag (default to 'low')
    const effectiveEffort = effort ?? 'low';
    const args = [
      'chat',
      '--no-interactive',
      '--trust-tools=read,write',
      '--effort',
      effectiveEffort,
      prompt
    ];

    // The prompt must be passed as a positional argument. `--no-interactive`
    // requires one, and with no prompt argument kiro-cli waits rather than
    // reading a prompt from stdin, which manifests as a timeout on every chunk.
    const child = spawn('kiro-cli', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Task 4.3: Use configurable timeout (default to 600 seconds / 10 minutes)
    const effectiveTimeout = timeoutSeconds ?? 600;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
    }, effectiveTimeout * 1000);

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      
      if ((error as any).code === 'ENOENT') {
        const err: GeneratorError = {
          stage: 'extract',
          type: 'kiro_not_found',
        };
        reject(err);
      } else {
        reject(error);
      }
    });

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (timedOut) {
        const error: GeneratorError = {
          stage: 'extract',
          type: 'kiro_timeout',
          timeout_seconds: effectiveTimeout,
          chunk_index: chunkIndex, // Task 4.4: include chunk index
        };
        reject(error);
        return;
      }

      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      });
    });

    // Close stdin immediately. The prompt is an argument, and leaving stdin
    // open would keep the subprocess waiting for input that never arrives.
    child.stdin?.end();
  });
}

/**
 * Check if kiro-cli is authenticated (preflight check)
 * Runs "kiro-cli whoami" to verify user is signed in
 * 
 * @throws {GeneratorError} kiro_not_found if kiro-cli is not in PATH
 * @throws {GeneratorError} kiro_not_authenticated if user is not signed in
 */
async function checkKiroAuthentication(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('kiro-cli', ['whoami'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    // Set 30-second timeout
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
    }, 30 * 1000); // 30 seconds

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      
      if ((error as any).code === 'ENOENT') {
        const err: GeneratorError = {
          stage: 'extract',
          type: 'kiro_not_found',
        };
        reject(err);
      } else {
        reject(error);
      }
    });

    child.on('close', (code) => {
      clearTimeout(timeout);

      // Non-zero exit code or empty stdout means not authenticated
      if (code !== 0 || stdout.trim().length === 0) {
        const error: GeneratorError = {
          stage: 'extract',
          type: 'kiro_not_authenticated',
        };
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Build the extraction prompt for kiro-cli
 */
function buildExtractionPrompt(chunkContent: string, outputPath: string): string {
  // Get PartialIR type definition as a string
  const partialIRSchema = `
export interface PartialIR {
  /**
   * Vendor API base URL if found in this chunk
   */
  base_url?: string;

  /**
   * Authentication configuration if found in this chunk
   */
  auth?: AuthenticationScheme;

  /**
   * Resources found in this chunk (empty array if chunk contains no endpoints)
   */
  resources: Resource[];

  /**
   * Extension point for pagination (deferred)
   */
  pagination?: PaginationConfig;
}

export type AuthenticationScheme =
  | {
      type: 'api_key';
      location: 'header';
      header_name: string;
    }
  | {
      type: 'api_key';
      location: 'query';
      query_param_name: string;
    }
  | {
      type: 'api_key';
      location: 'body';
      body_field_name: string;
    }
  | {
      type: 'bearer_token';
      header_name: string; // Defaults to "Authorization"
    }
  | {
      type: 'basic';
    }
  | {
      type: 'oauth2';
      authorize_url: string;
      token_url: string;
      scopes?: string[];
    };

export interface Resource {
  name: string;
  display_name: string;
  description: string;
  operations: Operation[];
}

export interface Operation {
  name: string;
  display_name: string;
  description: string;
  http_method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  parameters: Parameter[];
  response_shape: ResponseShape;
  examples: Example[];
  pagination?: OperationPagination;
}

export interface Parameter {
  name: string;
  display_name: string;
  description: string;
  location: 'path' | 'query' | 'header' | 'body';
  type: ParameterType;
  required: boolean;
  default_value?: string | number | boolean;
  constraints?: ParameterConstraints;
}

export type ParameterType =
  | { kind: 'string' }
  | { kind: 'number' }
  | { kind: 'integer' }
  | { kind: 'boolean' }
  | { kind: 'array'; items_type: ParameterType }
  | { kind: 'object'; properties: Record<string, ParameterType> };

export interface ParameterConstraints {
  enum?: Array<string | number>;
  min_length?: number;
  max_length?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  min_items?: number;
  max_items?: number;
}

export interface ResponseShape {
  type: 'object' | 'array' | 'primitive';
  properties?: Record<string, PropertyShape>;
  items_type?: ResponseShape;
  primitive_type?: 'string' | 'number' | 'boolean' | 'null';
  undocumented: boolean;
}

export interface PropertyShape {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
  required: boolean;
  description?: string;
  properties?: Record<string, PropertyShape>;
  items_type?: PropertyShape;
}

export interface Example {
  name: string;
  request: Record<string, unknown>;
  response: unknown;
  status_code: number;
}

export interface PaginationConfig {
  default_style: 'cursor' | 'offset' | 'page' | 'none';
}

export interface OperationPagination {
  style: 'cursor' | 'offset' | 'page' | 'none';
  cursor?: {
    cursor_param: string;
    next_cursor_field: string;
  };
  offset?: {
    limit_param: string;
    offset_param: string;
  };
  page?: {
    page_param: string;
    page_size_param: string;
  };
}
`;

  return `You are an API documentation parser. Your task is to extract a structured contract from the following API documentation and write it as valid JSON to the file path I specify.

# Documentation Chunk

${chunkContent}

# Output Schema

Use this TypeScript interface as your output schema:

${partialIRSchema}

# Instructions

1. Extract the following from the documentation (if present in this chunk):
   - base_url: The API base URL (e.g., "https://api.vultr.com/v2")
   - auth: Authentication scheme (type, location, header/query/body field names)
   - resources: All resources mentioned (e.g., "instances", "ssh-keys")
   
   If this chunk does not contain base_url or auth information, omit those fields.

2. For each resource, extract:
   - name: kebab-case identifier
   - display_name: Human-readable name
   - description: Summary from documentation
   - operations: All operations available on this resource

3. For each operation, extract:
   - name: kebab-case identifier
   - display_name: Human-readable name
   - description: Summary from documentation
   - http_method: GET | POST | PUT | PATCH | DELETE
   - path: URL path with {parameter} placeholders
   - parameters: All documented parameters
   - response_shape: Structure of successful responses
   - examples: Any request/response examples shown in documentation

4. For parameters, extract:
   - name, display_name, description
   - location: path | query | header | body
   - type: The parameter type (string, number, boolean, array, object)
   - required: Whether the parameter is required
   - default_value: Default value if documented
   - constraints: Any validation rules (enum, min/max length, pattern)

5. For response shapes:
   - If the documentation clearly describes the response structure, extract it fully
   - If the response structure is ambiguous or undocumented, set \`undocumented: true\`
   - Include property types and whether they are required

6. Extract ONLY what is explicitly documented. Do NOT:
   - Infer or assume values
   - Add default values not in the documentation
   - Guess at parameter types
   - Invent response structures
   - Include source metadata (content_hash, extracted_at)
   - Include schema_version

7. Write the extracted PartialIR as valid JSON to this file path:
   ${outputPath}

Use the fs_write tool to write the file. The JSON must be valid and parseable. Do NOT include conversational text in the file—only the JSON object.

If this documentation chunk contains no endpoints, write {"resources": []} which is valid.`;
}

/**
 * Merge partial IRs into a complete IR
 */
function mergePartialIRs(
  partials: PartialIR[],
  config: GeneratorConfig
): Omit<IntermediateRepresentation, 'schema_version' | 'source'> {
  let base_url: string | undefined;
  let base_url_chunk_index: number | undefined;
  let auth: AuthenticationScheme | undefined;
  let auth_chunk_index: number | undefined;
  const resourcesMap = new Map<string, Resource>();
  let pagination: IntermediateRepresentation['pagination'];

  // Merge base_url with earliest-wins strategy
  for (let i = 0; i < partials.length; i++) {
    const partial = partials[i]!; // Array indexed within bounds
    
    if (partial.base_url !== undefined) {
      if (base_url !== undefined && base_url !== partial.base_url) {
        // Conflict: emit WARNING but keep earliest value
        process.stderr.write(
          `WARNING: Conflicting base_url values found:\n` +
          `  Chunk ${base_url_chunk_index}: ${base_url}\n` +
          `  Chunk ${i}: ${partial.base_url}\n` +
          `  Using value from chunk ${base_url_chunk_index}\n\n`
        );
      } else if (base_url === undefined) {
        // First occurrence: use this value
        base_url = partial.base_url;
        base_url_chunk_index = i;
      }
    }
  }

  // Merge auth with earliest-wins strategy
  for (let i = 0; i < partials.length; i++) {
    const partial = partials[i]!; // Array indexed within bounds
    
    if (partial.auth !== undefined) {
      if (auth !== undefined && JSON.stringify(auth) !== JSON.stringify(partial.auth)) {
        // Conflict: emit WARNING but keep earliest value
        process.stderr.write(
          `WARNING: Conflicting auth values found:\n` +
          `  Chunk ${auth_chunk_index}: ${JSON.stringify(auth, null, 2)}\n` +
          `  Chunk ${i}: ${JSON.stringify(partial.auth, null, 2)}\n` +
          `  Using value from chunk ${auth_chunk_index}\n\n`
        );
      } else if (auth === undefined) {
        // First occurrence: use this value
        auth = partial.auth;
        auth_chunk_index = i;
      }
    }
  }

  // Merge resources by name
  for (let i = 0; i < partials.length; i++) {
    const partial = partials[i]!; // Array indexed within bounds
    
    for (const resource of partial.resources) {
      if (resourcesMap.has(resource.name)) {
        // Merge operations for existing resource
        const existing = resourcesMap.get(resource.name)!;
        
        for (const operation of resource.operations) {
          // Check for operation conflicts
          const existingOp = existing.operations.find(op => op.name === operation.name);
          
          if (existingOp) {
            // Check for http_method conflict
            if (existingOp.http_method !== operation.http_method) {
              const error: GeneratorError = {
                stage: 'extract',
                type: 'merge_conflict',
                field: `resource.${resource.name}.operation.${operation.name}.http_method`,
                values: [existingOp.http_method, operation.http_method],
                chunk_indices: [0, i],
              };
              throw error;
            }
            
            // Check for path conflict
            if (existingOp.path !== operation.path) {
              const error: GeneratorError = {
                stage: 'extract',
                type: 'merge_conflict',
                field: `resource.${resource.name}.operation.${operation.name}.path`,
                values: [existingOp.path, operation.path],
                chunk_indices: [0, i],
              };
              throw error;
            }
          } else {
            // Add new operation
            existing.operations.push(operation);
          }
        }
      } else {
        // Add new resource
        resourcesMap.set(resource.name, resource);
      }
    }

    // Merge pagination (first wins)
    if (partial.pagination !== undefined && pagination === undefined) {
      pagination = partial.pagination;
    }
  }

  // Apply include filters if specified
  const resources = applyIncludeFilters(Array.from(resourcesMap.values()), config);

  // Validate that all required resources and operations were found
  if (config.include) {
    for (const includeItem of config.include) {
      const resource = resources.find(r => r.name === includeItem.resource);
      
      if (!resource) {
        const error: GeneratorError = {
          stage: 'extract',
          type: 'missing_resource',
          resource: includeItem.resource,
          config_source: 'include filter',
        };
        throw error;
      }

      if (includeItem.operations) {
        for (const opName of includeItem.operations) {
          const operation = resource.operations.find(op => op.name === opName);
          
          if (!operation) {
            const error: GeneratorError = {
              stage: 'extract',
              type: 'missing_operation',
              resource: includeItem.resource,
              operation: opName,
              config_source: 'include filter',
            };
            throw error;
          }
        }
      }
    }
  }

  if (!base_url) {
    throw new Error('base_url is required but was not found in any chunk');
  }

  if (!auth) {
    throw new Error('auth is required but was not found in any chunk');
  }

  return {
    base_url,
    auth,
    resources,
    ...(pagination ? { pagination } : {}),
  };
}

/**
 * Apply include filters from configuration
 */
function applyIncludeFilters(
  resources: Resource[],
  config: GeneratorConfig
): Resource[] {
  if (!config.include) {
    // No filters, include everything
    return resources;
  }

  const filtered: Resource[] = [];

  for (const includeItem of config.include) {
    const resource = resources.find(r => r.name === includeItem.resource);
    
    if (resource) {
      if (includeItem.operations) {
        // Filter operations
        const filteredOps = resource.operations.filter(op =>
          includeItem.operations!.includes(op.name)
        );
        
        filtered.push({
          ...resource,
          operations: filteredOps,
        });
      } else {
        // Include all operations
        filtered.push(resource);
      }
    }
  }

  return filtered;
}

/**
 * Compute SHA-256 hash of content
 */
function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

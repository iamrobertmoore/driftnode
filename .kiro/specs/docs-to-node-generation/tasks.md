# Implementation Plan: Documentation-to-Node Generation

## Overview

This implementation plan covers the driftnode generator that transforms prose API documentation into publishable n8n community node packages. The plan implements 23 v1 requirements across a five-stage pipeline: Ingest, Extract, Validate, Emit, Verify. Each stage operates on clear input/output contracts with early termination on error.

The critical architectural elements are:
- **TypeScript** implementation in `packages/driftnode/src/` with CommonJS output
- **File handoff protocol** between generator and kiro-cli (no stdout parsing)
- **Atomic generation** via temporary directory with final move after all verification passes
- **Zero runtime dependencies** from generator to generated package

## Tasks

- [x] 1. Verify existing scaffolding and create core type definitions
  - Verify `packages/driftnode/` directory structure exists
  - Verify `tsconfig.json` has `module: "commonjs"` and `target: "ES2022"` (already configured)
  - Verify `package.json` has workspace configuration, scripts, bin entry, and devDependencies (already configured)
  - Verify `vitest.config.ts` exists (already configured)
  - Note: `src/index.ts` currently exists as a smoke-test stub and is expected to be replaced during implementation
  - Create `src/types.ts` with complete IR type definitions (PartialIR, IntermediateRepresentation, AuthenticationScheme, Resource, Operation, Parameter, ResponseShape, etc.)
  - Create `src/errors.ts` with GeneratorError union type covering all stages (ingest, extract, validate, verify)
  - If needed, APPEND `.tmp-*/` pattern to existing `.gitignore` (DO NOT overwrite or recreate .gitignore)
  - _Requirements: Foundation for all subsequent tasks_
  - _Note: Root package.json, tsconfig files, .gitignore, and GitHub Actions workflows already exist and MUST NOT be overwritten_

- [x] 2. Implement configuration file parsing
  - [x] 2.1 Create `src/config.ts` with GeneratorConfig interface
    - Define DocumentSource type (`{ type: 'url', url: string } | { type: 'file', path: string }`)
    - Define GeneratorConfig interface with vendor, documentation, and optional include fields
    - Implement `loadConfig(path: string): Promise<GeneratorConfig>` function
    - Add validation for required fields (vendor, documentation)
    - Add validation for file path existence when configuration file is specified
    - _Requirements: 1.0 (configuration reading for all stages)_

  - [x]* 2.2 Write unit tests for configuration parsing
    - Test valid URL-based configuration
    - Test valid file-based configuration
    - Test missing required fields
    - Test invalid JSON
    - Test file not found scenarios
    - _Requirements: 1.0_

- [x] 3. Implement Stage 1: Ingest
  - [x] 3.1 Create `src/ingest.ts` with DocumentChunk type and ingest function
    - Define `DocumentChunk = { content: string, start: number, end: number }` type
    - Implement `ingest(source: DocumentSource): Promise<DocumentChunk[]>` function
    - Create `fetchRemote(url: string)` helper with layered error precedence
    - Create `readLocal(path: string)` helper with layered error precedence
    - Implement 30-second timeout for HTTP requests
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 3.2 Implement HTML normalization
    - Strip `<script>` and `<style>` tags completely
    - Convert HTML entities to text equivalents (including inside code blocks)
    - Preserve code blocks and pre-formatted text with exact whitespace
    - Normalize line endings to Unix-style (LF)
    - Remove leading and trailing whitespace
    - _Requirements: 1.3 (all criteria)_

  - [x] 3.3 Implement Markdown and JSON normalization
    - Preserve Markdown formatting as-is
    - Pretty-print JSON with 2-space indentation
    - Normalize line endings to LF
    - Remove leading and trailing whitespace
    - _Requirements: 1.3 (criteria 4-7)_

  - [x] 3.4 Implement documentation chunking
    - Split documentation exceeding 50,000 characters
    - Preserve complete sentences at chunk boundaries
    - Preserve complete code blocks (detect ``` fences and </code> tags)
    - Add 500 characters of overlap between consecutive chunks
    - Store chunk boundaries (start, end positions) for error reporting
    - Treat documents under 50k characters as single chunk
    - _Requirements: 1.4 (all criteria)_

  - [x]* 3.5 Write unit tests for ingest stage
    - Test remote fetch with success, network error, timeout, auth denied (401/403), not found (404), HTTP errors, unsupported content type, empty response
    - Test local file read with success, file not found, permission denied, empty file, unsupported extension
    - Test error precedence for remote fetch (transport > HTTP status > payload)
    - Test error precedence for local file (existence > permissions > empty > extension)
    - Test HTML normalization with entities, code blocks, script/style removal
    - Test Markdown preservation
    - Test JSON pretty-printing
    - Test chunking with sentence boundaries, code block preservation, overlap
    - Test single-chunk mode for small documents
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [~] 4. Checkpoint - Verify ingest stage works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Stage 2: Extract
  - [x] 5.1 Create `src/extract.ts` with kiro-cli invocation
    - Implement `extract(chunks: DocumentChunk[], config: Config, tempDir: string): Promise<IntermediateRepresentation>` function
    - Create temporary directory `.tmp-{vendor}/` in workspace
    - For each chunk, construct output path: `.tmp-{vendor}/ir-chunk-{n}.json`
    - Build extraction prompt with PartialIR schema, chunk content, and output file path
    - Invoke `kiro-cli chat --no-interactive --trust-tools=read,write` with prompt as argument
    - Set 5-minute timeout for kiro-cli subprocess
    - Capture exit code, stdout, and stderr
    - _Requirements: 2.1 (all criteria)_

  - [x] 5.2 Implement file handoff protocol
    - After kiro-cli exits, check exit code
    - If non-zero, throw error with `{ stage: 'extract', type: 'kiro_failed', exit_code, stderr }`
    - If exit code is zero, read file at output path
    - If file absent, throw `{ stage: 'extract', type: 'ir_file_missing', chunk_index, expected_path, stderr }`
    - If file empty, throw `{ stage: 'extract', type: 'ir_file_empty', chunk_index, path }`
    - If JSON.parse fails, throw `{ stage: 'extract', type: 'invalid_ir_json', chunk_index, path, parse_error }`
    - If parse succeeds, collect PartialIR for merging
    - Handle kiro-cli not found in PATH error
    - Handle kiro-cli timeout (kill subprocess after 5 minutes)
    - _Requirements: 2.1 (criteria 5-8)_

  - [x] 5.3 Implement base URL and authentication extraction
    - Parse `base_url` field from PartialIR (optional, may be absent in some chunks)
    - Parse `auth` field from PartialIR with type: 'api_key' | 'bearer_token' | 'basic' | 'oauth2'
    - For api_key auth, parse location ('header' | 'query' | 'body') and corresponding field name
    - For bearer_token auth, parse token_header_name (defaults to "Authorization")
    - For oauth2 auth, parse authorize_url, token_url, and optional scopes
    - When multiple auth schemes present, select most secure: oauth2 > bearer_token > api_key > basic
    - _Requirements: 2.2 (all criteria)_

  - [x] 5.4 Implement resource and operation extraction
    - Parse `resources` array from PartialIR (may be empty if chunk has no endpoints)
    - For each resource, extract name, display_name, description, and operations array
    - For each operation, extract name, display_name, description, http_method, path
    - Validate http_method is one of: GET, POST, PUT, PATCH, DELETE
    - Validate path contains URL path with {parameter} placeholders
    - Check Configuration_File include filters and exclude non-matching resources/operations
    - Track missing resources/operations specified in config for error reporting
    - _Requirements: 2.3 (all criteria)_

  - [x] 5.5 Implement parameter extraction
    - Parse `parameters` array from operation in PartialIR
    - For each parameter, extract name, display_name, description, location, type, required
    - Parse location: 'path' | 'query' | 'header' | 'body'
    - Parse type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
    - Parse optional default_value
    - Parse optional constraints object (enum, min_length, max_length, pattern, minimum, maximum, min_items, max_items)
    - Do NOT default or infer missing constraint values
    - _Requirements: 2.4 (all criteria)_

  - [x] 5.6 Implement response shape extraction
    - Parse `response_shape` from operation in PartialIR
    - Extract type: 'object' | 'array' | 'primitive'
    - For object type, extract properties map with field names to types
    - For array type, extract items_type
    - For each property, extract type, required flag, optional description, nested properties
    - Preserve examples array from PartialIR (at least one per operation)
    - When response structure ambiguous/undocumented, set `undocumented: true` flag
    - _Requirements: 2.5 (all criteria)_

  - [x] 5.7 Implement multi-chunk IR merging
    - Collect all PartialIR objects from chunks
    - Merge base_url: first non-undefined wins, different values = conflict error
    - Merge auth: first non-undefined wins, different auth types = conflict error
    - Union resources by name
    - For same resource across chunks, union operations by name
    - If same operation name has different http_method, throw merge_conflict error with chunk indices
    - If same operation name has different path, throw merge_conflict error with chunk indices
    - _Requirements: 2.6 (all criteria)_

  - [x] 5.8 Add generator-owned metadata to IR
    - Compute SHA-256 content_hash over full normalized documentation (not per-chunk)
    - Set extracted_at to ISO 8601 timestamp of generation run
    - Set schema_version to "1.0.0"
    - Set source.url if DocumentSource was URL
    - Set source.path (absolute) if DocumentSource was file
    - Return complete IntermediateRepresentation
    - _Requirements: 2.6 (criterion 7), 4.3_

  - [x]* 5.9 Write unit tests for extract stage
    - Mock kiro-cli subprocess calls
    - Test successful extraction with valid PartialIR
    - Test kiro_not_found error
    - Test kiro_timeout error (mock subprocess hanging)
    - Test kiro_failed with non-zero exit code
    - Test ir_file_missing error
    - Test ir_file_empty error
    - Test invalid_ir_json error
    - Test merge with consistent base_url and auth across chunks
    - Test merge_conflict for base_url
    - Test merge_conflict for auth scheme
    - Test merge_conflict for operation http_method
    - Test merge_conflict for operation path
    - Test resource union by name
    - Test content_hash computation
    - Test extracted_at timestamp format
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 6. Checkpoint - Verify extract stage works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement Stage 3: Validate
  - [x] 7.1 Create `src/validate.ts` with completeness validation
    - Define `ValidationResult = { valid: true } | { valid: false, errors: ValidationError[] }` type
    - Implement `validate(ir: IntermediateRepresentation): ValidationResult` function
    - Check base_url field present, throw missing_base_url error if absent
    - Check auth field present, throw missing_auth_scheme error if absent
    - Check resources array non-empty, throw empty_resources error if empty
    - For each resource, check operations array non-empty, throw empty_operations with resource name if empty
    - _Requirements: 3.1 (all criteria)_

  - [x] 7.2 Implement operation integrity validation
    - For each operation, check http_method present, throw missing_http_method with resource and operation if absent
    - For each operation, check path present, throw missing_path with resource and operation if absent
    - Extract path parameters from path (e.g., "{instance-id}") using regex
    - For each path parameter, verify corresponding parameter exists with location='path'
    - If path parameter not defined, throw path_param_not_defined with operation and param name
    - For POST/PUT operations, check at least one parameter has location='body'
    - If POST/PUT has no body parameters, log warning but continue (not fatal)
    - _Requirements: 3.2 (all criteria)_

  - [x] 7.3 Implement authentication configuration validation
    - When auth.type='api_key' and location='header', verify header_name present, throw missing_api_key_header_name if absent
    - When auth.type='api_key' and location='query', verify query_param_name present, throw missing_api_key_query_param_name if absent
    - When auth.type='api_key' and location='body', verify body_field_name present
    - When auth.type='bearer_token', verify token_header_name present or default to "Authorization"
    - When auth.type='oauth2', verify authorize_url and token_url present, throw missing_oauth2_urls with missing list if absent
    - _Requirements: 3.3 (all criteria)_

  - [x]* 7.4 Write unit tests for validate stage
    - Test valid complete IR passes all checks
    - Test missing_base_url error
    - Test missing_auth_scheme error
    - Test empty_resources error
    - Test empty_operations error
    - Test missing_http_method error
    - Test missing_path error
    - Test path_param_not_defined error
    - Test POST operation with no body params (warning logged)
    - Test missing_api_key_header_name error
    - Test missing_api_key_query_param_name error
    - Test bearer_token with default header name
    - Test missing_oauth2_urls error
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 8. Checkpoint - Verify validate stage works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement Stage 4: Emit (Credentials and Node)
  - [x] 9.1 Create `src/emit.ts` with directory structure setup
    - Implement `emit(ir: IntermediateRepresentation, config: GeneratorConfig, tempDir: string): Promise<void>` function
    - Create temporary directory structure in tempDir
    - Create directories: `credentials/`, `nodes/{VendorName}/`, `contract/`, `test/`, `test/fixtures/`
    - _Requirements: 4.1, 4.2 (directory structure)_

  - [x] 9.2 Implement credentials file emission
    - Create function `emitCredentials(ir: IntermediateRepresentation, vendor: string, tempDir: string): void`
    - Generate TypeScript file at `credentials/{VendorName}Api.credentials.ts`
    - Implement ICredentialType interface from n8n-workflow
    - Set displayName to vendor name
    - For api_key auth: generate string field with typeOptions.password=true, use header/query/body field name from IR
    - For bearer_token auth: generate token field with typeOptions.password=true
    - For basic auth: generate username and password fields
    - For oauth2 auth: generate OAuth2-specific fields (client_id, client_secret, authorize_url, token_url, scopes)
    - Add documentation links in properties description
    - _Requirements: 4.1 (all criteria)_

  - [x] 9.3 Implement node class emission (structure and description)
    - Create function `emitNode(ir: IntermediateRepresentation, vendor: string, tempDir: string): void`
    - Generate TypeScript file at `nodes/{VendorName}/{VendorName}.node.ts`
    - Implement INodeType interface from n8n-workflow
    - Set description with name, displayName, icon, subtitle, version
    - Set usableAsTool=true in description
    - Set credentials property referencing generated credentials file
    - Generate properties array with resource dropdown (values from IR.resources)
    - Generate operation dropdown (values per resource from IR.resources[].operations)
    - _Requirements: 4.2 (criteria 1-6)_

  - [x] 9.4 Implement node class emission (parameter fields)
    - For each operation in IR, generate parameter input fields
    - Map parameter location to n8n field types
    - Map parameter type to n8n displayOptions (string, number, boolean, collection, fixedCollection)
    - For enum constraints, generate options dropdown
    - For min/max constraints, set validation rules
    - Set required flag on n8n properties
    - Set default values when present in IR
    - Generate displayOptions to show fields only when relevant resource+operation selected
    - _Requirements: 4.2 (criterion 8)_

  - [x] 9.5 Implement node class emission (execute method)
    - Generate execute method with IExecuteFunctions parameter
    - Add switch statement routing on resource type
    - Add nested switch on operation type
    - For each operation, generate HTTP request construction code
    - Build URL from base_url + path, substituting path parameters
    - Build query string from query parameters
    - Build headers from header parameters and authentication
    - Build request body from body parameters
    - Add authentication header/query/body based on IR.auth configuration
    - Parse response and return as INodeExecutionData[]
    - _Requirements: 4.2 (criterion 9)_

  - [x] 9.6 Implement error mapping in execute method
    - Wrap HTTP requests in try-catch
    - Check response.status and throw appropriate n8n errors
    - Status 400: throw NodeOperationError with "Invalid input" message
    - Status 401: throw NodeOperationError with "Authentication failed" message
    - Status 403: throw NodeOperationError with "Access forbidden" message
    - Status 404: throw NodeOperationError with "Resource not found" message
    - Status 429: throw NodeOperationError with "Rate limit exceeded" message
    - Status 500+: throw NodeOperationError with "Server error" message
    - Include HTTP status code, response body excerpt (first 200 chars), and operation name in error message
    - _Requirements: 4.3 (all criteria)_

  - [x]* 9.7 Write unit tests for credentials and node emission
    - Test credentials file generation for each auth type (api_key header/query/body, bearer_token, basic, oauth2)
    - Test node file structure (INodeType interface, description, credentials, properties)
    - Test resource and operation dropdown generation
    - Test parameter field generation (types, constraints, displayOptions)
    - Test execute method routing (resource and operation switch statements)
    - Test HTTP request construction (URL, query, headers, body)
    - Test authentication injection (header, query, body)
    - Test error mapping for all status codes
    - Use snapshot testing for generated TypeScript code
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 10. Checkpoint - Verify credentials and node emission works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement Stage 4: Emit (Contract, Metadata, Tests)
  - [x] 11.1 Implement IR contract file emission
    - Create function `emitContract(ir: IntermediateRepresentation, tempDir: string): void`
    - Write IR to `contract/ir.json` as formatted JSON (2-space indentation)
    - Ensure schema_version, source, base_url, auth, resources all present
    - Ensure source.content_hash (SHA-256), source.extracted_at (ISO 8601), source.url or source.path present
    - _Requirements: 4.4 (all criteria)_

  - [x] 11.2 Implement package.json emission
    - Create function `emitPackageJson(ir: IntermediateRepresentation, vendor: string, tempDir: string): void`
    - Write `package.json` with name `n8n-nodes-{vendor}`
    - Set version to "0.1.0"
    - Set dependencies to {} or omit entirely (MUST be empty)
    - Set devDependencies: n8n-workflow, n8n-core, typescript, vitest, @types/node
    - Set n8n.nodes array pointing to compiled node file
    - Set n8n.credentials array pointing to compiled credentials file
    - Set n8n.usableAsTool to true
    - Add npm scripts: build (tsc), test (vitest run), typecheck (tsc --noEmit)
    - _Requirements: 4.6 (criteria 1-5)_

  - [x] 11.3 Implement tsconfig.json emission
    - Create function `emitTsConfig(tempDir: string): void`
    - Write `tsconfig.json` with module="commonjs" (required by n8n)
    - Set target="ES2020"
    - Set outDir="./dist"
    - Set rootDir="./src" or "." depending on file layout
    - Set strict=true, esModuleInterop=true
    - Set include patterns for source files
    - _Requirements: 4.6 (criteria 6-7)_

  - [x] 11.4 Implement README emission
    - Create function `emitReadme(ir: IntermediateRepresentation, vendor: string, tempDir: string): void`
    - Write `README.md` with vendor name as title
    - Add warning: "This package is generated. Do not edit by hand."
    - Add installation instructions: `npm install n8n-nodes-{vendor}`
    - Add link to vendor API documentation (from IR.source.url or mention source.path)
    - Add section explaining conformance test
    - Add instructions for running conformance test: `npm test`
    - Add instructions for running in offline mode (environment variable control)
    - _Requirements: 4.6 (criteria 8-10)_

  - [x] 11.5 Implement conformance test emission
    - Create function `emitConformanceTest(ir: IntermediateRepresentation, vendor: string, tempDir: string): void`
    - Write `test/conformance.test.ts` as vitest test suite
    - Import fs and path (Node built-ins, not driftnode package)
    - Read IR from `../contract/ir.json` using fs.readFileSync and JSON.parse
    - Check for vendor API key in environment variables
    - If API key absent, skip live tests and log warning
    - If API key present, execute HTTP requests for each operation in IR
    - Verify HTTP method and path match IR
    - Verify response shape matches IR.response_shape
    - For required response fields, fail test if missing in live response
    - For undocumented fields in live response (not in IR), log warning but pass
    - Set test timeout to 60 seconds
    - _Requirements: 4.7 (all criteria)_

  - [x] 11.6 Implement fixture generation and loader emission
    - Create function `emitFixtures(ir: IntermediateRepresentation, tempDir: string): void`
    - For each operation in IR with examples, create fixture file at `test/fixtures/{resource}-{operation}-{hash}.json`
    - Fixture file format: `{ request: { method, path, headers, query, body }, response: { status, headers, body } }`
    - Generate fixture filename hash from sorted parameter names (for uniqueness)
    - Create at least one fixture per operation using IR.examples
    - Generate `test/fixture-loader.ts` utility (inline code, not imported from driftnode)
    - Fixture loader reads from `test/fixtures/` and returns mock response matching request parameters
    - _Requirements: 4.8 (all criteria)_

  - [x] 11.7 Implement unit test emission for fixture-backed mode
    - Create function `emitUnitTests(ir: IntermediateRepresentation, vendor: string, tempDir: string): void`
    - Write `test/unit.test.ts` as vitest test suite
    - Import fixture loader (from `./fixture-loader.ts`)
    - For each operation, generate test that loads fixture and validates node behavior
    - Test parameter validation logic (required fields, constraints)
    - Test error mapping with fixture responses for different status codes
    - Run WITHOUT vendor credentials (offline mode)
    - _Requirements: 4.8 (criterion 4)_

  - [x]* 11.8 Write integration tests for emission stage
    - Test complete emission pipeline from IR to all files
    - Verify directory structure created correctly
    - Verify all expected files present (credentials, node, contract, package.json, tsconfig.json, README, tests, fixtures)
    - Use sample IR and verify emitted files against snapshots
    - Test emission with different auth types
    - Test emission with different parameter types
    - Test fixture generation from IR examples
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 4.7, 4.8_

- [x] 12. Checkpoint - Verify full emission stage works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement Stage 5: Verify
  - [x] 13.1 Create `src/verify.ts` with typecheck function
    - Implement `verify(tempDir: string, targetDir: string): Promise<void>` function
    - Create function `runTypecheck(tempDir: string): Promise<TypecheckResult>`
    - Invoke `tsc --noEmit --project {tempDir}/tsconfig.json` as subprocess
    - Capture stdout and stderr
    - Parse TypeScript errors from output
    - Return `{ success: true }` or `{ success: false, errors: string[] }`
    - If tsc not in PATH, throw error stating TypeScript must be installed
    - _Requirements: 5.1 (all criteria)_

  - [x] 13.2 Implement compilation and dynamic import
    - Create function `runCompile(tempDir: string): Promise<CompileResult>`
    - Invoke `tsc --project {tempDir}/tsconfig.json` to compile to JavaScript
    - If compilation fails, return errors
    - Create function `dynamicImport(tempDir: string): Promise<ImportResult>`
    - Construct path to compiled node file: `{tempDir}/dist/nodes/{VendorName}/{VendorName}.node.js`
    - Perform dynamic import: `await import(nodePath)`
    - If import fails, return error with import failure message
    - _Requirements: 5.2 (criteria 1-3)_

  - [x] 13.3 Implement node structure verification
    - Create function `verifyNodeStructure(nodeClass: unknown): StructureResult`
    - Check nodeClass has `description` property
    - Check nodeClass has `execute` method
    - Check description has required properties: name, displayName, version
    - If required properties missing, return error listing missing properties
    - Return `{ success: true }` if all checks pass
    - _Requirements: 5.2 (criteria 4-6)_

  - [x] 13.4 Implement test execution
    - Create function `runTests(tempDir: string): Promise<TestResult>`
    - Invoke `vitest run --config {tempDir}/vitest.config.ts` as subprocess (or use default config)
    - Set environment to NOT include vendor API credentials (test offline fixture mode)
    - Set timeout to 30 seconds
    - Capture test output (stdout and stderr)
    - Parse test results to count passed/failed
    - Return `{ success: true, count }` or `{ success: false, failures: string[] }`
    - If vitest not available, throw error stating vitest must be installed
    - _Requirements: 5.3 (all criteria)_

  - [x] 13.5 Implement atomic move to target directory
    - After all verification passes (typecheck, compile, import, structure, tests), move temp directory into place
    - Check if targetDir exists, remove it first with `fs.promises.rm(targetDir, { recursive: true })`
    - Perform atomic move: `fs.promises.rename(tempDir, targetDir)`
    - If rename fails with EXDEV (cross-filesystem), fallback to recursive copy then delete temp
    - Ensure temporary directory is cleaned up on ANY error (wrap all verification in try/finally)
    - _Requirements: 5.1 (criterion 6), Atomic generation design requirement_

  - [x]* 13.6 Write unit tests for verify stage
    - Mock tsc subprocess calls
    - Test successful typecheck
    - Test typecheck_failed with errors
    - Test tsc not found error
    - Test successful compilation
    - Test successful dynamic import
    - Test import_failed error
    - Test missing_node_property error (missing description, missing execute)
    - Mock vitest subprocess calls
    - Test successful test run
    - Test test_failed with failures
    - Test atomic move success
    - Test atomic move with existing target directory (idempotent regeneration)
    - Test temporary directory cleanup on error
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 14. Checkpoint - Verify verification stage works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Implement CLI orchestration
  - [x] 15.1 Create `src/cli.ts` entry point
    - Import all stage functions (ingest, extract, validate, emit, verify)
    - Parse command-line arguments for config file path
    - Load configuration using config.loadConfig
    - Create top-level try-catch for error handling
    - Call stages in sequence: ingest → extract → validate → emit → verify
    - _Requirements: Pipeline orchestration_

  - [x] 15.2 Implement error formatting and reporting
    - Create function `formatError(error: GeneratorError): string`
    - Switch on error.stage and error.type
    - Format ingest errors with URL/path, status codes, error details
    - Format extract errors with chunk numbers, file paths, stderr
    - Format validate errors with missing fields, operations, resources
    - Format verify errors with TypeScript errors, test failures
    - Write formatted error to stderr
    - Exit with code 1 on any error
    - _Requirements: Error reporting design requirement_

  - [x] 15.3 Implement success logging and exit
    - When verify completes successfully, log success message
    - Log generated package path
    - Exit with code 0
    - _Requirements: Pipeline orchestration_

  - [x] 15.4 Add CLI entry point in package.json
    - Add "bin" field in package.json pointing to compiled cli.js
    - Add shebang to cli.ts: `#!/usr/bin/env node`
    - Ensure TypeScript compilation preserves shebang
    - _Requirements: CLI usability_

  - [x]* 15.5 Write integration tests for CLI
    - Test end-to-end generation from sample configuration
    - Mock kiro-cli subprocess to return fixture PartialIRs
    - Verify complete package structure generated
    - Test error handling at each stage (ingest failure, extract failure, validate failure, verify failure)
    - Test error formatting for different error types
    - Test idempotent regeneration (re-running with same config)
    - _Requirements: All stages integration_

- [x] 16. Checkpoint - Verify complete pipeline works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Create extraction prompt template
  - [~] 17.1 Create `src/prompts/extraction.ts` with prompt template
    - Define prompt string template with placeholders: {documentation_chunk}, {PartialIR_type_definition}, {output_file_path}
    - Include complete PartialIR TypeScript interface in prompt
    - Add detailed extraction instructions (what to extract, what NOT to infer/assume)
    - Instruct to write valid JSON to specified file path using fs_write tool
    - Instruct to NOT include conversational text, ONLY JSON
    - Handle chunks with no endpoints: write `{"resources": []}` which is valid
    - Instruct to omit base_url and auth if not present in chunk
    - Instruct to NOT include source metadata (content_hash, extracted_at) or schema_version
    - _Requirements: 2.1, Extraction prompt design requirement_

  - [~] 17.2 Integrate prompt template into extract.ts
    - Import prompt template in extract.ts
    - Substitute placeholders with actual values (chunk content, output path)
    - Include PartialIR type definition as string in prompt
    - Pass complete prompt as argument to kiro-cli
    - _Requirements: 2.1 (criterion 2)_

- [ ] 18. Documentation and examples
  - [~] 18.1 Create main README for driftnode package
    - Explain what driftnode does (generates n8n nodes from prose documentation)
    - Explain the five-stage pipeline
    - Document configuration file format with examples
    - Document how to run the generator: `npx driftnode generate config.json`
    - Document prerequisites (Node.js 20.19+, kiro-cli in PATH, active Kiro session)
    - Document zero runtime dependencies guarantee
    - _Requirements: Usability and documentation_

  - [~] 18.2 Create example configuration files
    - Create `examples/vultr-config.json` with URL-based documentation source
    - Create `examples/local-config.json` with file-based documentation source
    - Create `examples/filtered-config.json` with include filters
    - Document each example in README
    - _Requirements: Usability and documentation_

  - [~] 18.3 Document generator architecture
    - Create `docs/architecture.md` explaining five stages
    - Document IR schema with examples
    - Document error taxonomy and precedence
    - Document file handoff protocol with kiro-cli
    - Document atomic generation strategy
    - Document zero import enforcement
    - _Requirements: Maintainability and documentation_

  - [~] 18.4 Document generated package structure
    - Create `docs/generated-package.md` explaining what is emitted
    - Document credentials file structure and variations by auth type
    - Document node class structure
    - Document conformance test and how it works
    - Document fixture-backed offline mode
    - Document how to run tests and publish package
    - _Requirements: Usability and documentation_

- [ ] 19. Final integration and cleanup
  - [~] 19.1 End-to-end test with real documentation
    - Find small public API documentation (or create fixture)
    - Create configuration file pointing to real documentation
    - Run complete generation pipeline
    - Manually inspect generated package structure
    - Run generated package tests (offline mode)
    - Verify TypeScript compilation works
    - _Requirements: End-to-end validation_

  - [~] 19.2 Clean up temporary files and directories
    - Ensure all `.tmp-{vendor}/` directories are removed after generation (success or failure)
    - Add cleanup to error paths in verify.ts
    - Verify no artifacts left behind after failed generation
    - _Requirements: Clean execution environment_

  - [~] 19.3 Final code review and polish
    - Review all error messages for clarity and actionability
    - Ensure consistent code style (consider adding prettier/eslint)
    - Ensure all TODOs and FIXMEs are resolved or converted to GitHub issues
    - Verify all imports use correct paths
    - Verify all generated code has proper TypeScript types
    - _Requirements: Code quality and maintainability_

  - [ ]* 19.4 Write end-to-end integration test
    - Create fixture documentation (small HTML file with 2-3 endpoints)
    - Mock kiro-cli to return predetermined PartialIR
    - Run complete generation pipeline
    - Verify all files generated correctly
    - Run typechecking on generated package
    - Run tests on generated package
    - Compare generated files against committed snapshots
    - _Requirements: Comprehensive testing_

- [~] 20. Final checkpoint - Complete implementation validated
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and provide natural pause points
- The implementation uses TypeScript with CommonJS output (required for n8n compatibility)
- File handoff protocol with kiro-cli eliminates stdout parsing ambiguity
- Atomic generation via temporary directory ensures no partial artifacts on failure
- Generated package has zero runtime dependencies on driftnode
- Property-based testing is not appropriate for this infrastructure-heavy feature

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1"]
    },
    {
      "id": 1,
      "tasks": ["2.1"]
    },
    {
      "id": 2,
      "tasks": ["2.2", "3.1"]
    },
    {
      "id": 3,
      "tasks": ["3.2", "3.3"]
    },
    {
      "id": 4,
      "tasks": ["3.4", "3.5"]
    },
    {
      "id": 5,
      "tasks": ["5.1"]
    },
    {
      "id": 6,
      "tasks": ["5.2", "5.3"]
    },
    {
      "id": 7,
      "tasks": ["5.4", "5.5", "5.6"]
    },
    {
      "id": 8,
      "tasks": ["5.7"]
    },
    {
      "id": 9,
      "tasks": ["5.8", "5.9"]
    },
    {
      "id": 10,
      "tasks": ["7.1", "7.2", "7.3"]
    },
    {
      "id": 11,
      "tasks": ["7.4"]
    },
    {
      "id": 12,
      "tasks": ["9.1"]
    },
    {
      "id": 13,
      "tasks": ["9.2", "9.3"]
    },
    {
      "id": 14,
      "tasks": ["9.4"]
    },
    {
      "id": 15,
      "tasks": ["9.5"]
    },
    {
      "id": 16,
      "tasks": ["9.6", "9.7"]
    },
    {
      "id": 17,
      "tasks": ["11.1", "11.2", "11.3", "11.4"]
    },
    {
      "id": 18,
      "tasks": ["11.5", "11.6"]
    },
    {
      "id": 19,
      "tasks": ["11.7", "11.8"]
    },
    {
      "id": 20,
      "tasks": ["13.1", "13.2"]
    },
    {
      "id": 21,
      "tasks": ["13.3", "13.4"]
    },
    {
      "id": 22,
      "tasks": ["13.5", "13.6"]
    },
    {
      "id": 23,
      "tasks": ["15.1"]
    },
    {
      "id": 24,
      "tasks": ["15.2", "15.3"]
    },
    {
      "id": 25,
      "tasks": ["15.4", "15.5", "17.1"]
    },
    {
      "id": 26,
      "tasks": ["17.2", "18.1", "18.2"]
    },
    {
      "id": 27,
      "tasks": ["18.3", "18.4"]
    },
    {
      "id": 28,
      "tasks": ["19.1"]
    },
    {
      "id": 29,
      "tasks": ["19.2", "19.3"]
    },
    {
      "id": 30,
      "tasks": ["19.4"]
    }
  ]
}
```

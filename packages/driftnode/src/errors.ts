/**
 * Error taxonomy for the driftnode generator
 * 
 * Errors are organized by stage with layered precedence where applicable.
 * When multiple error conditions exist, only the highest-priority error
 * from the appropriate layer is reported.
 */

/**
 * Generator error union type covering all pipeline stages
 */
export type GeneratorError =
  // Ingest stage: Remote fetch errors (Requirement 1)
  // Precedence: transport > HTTP status > payload
  | { stage: 'ingest'; type: 'network_error'; url: string; message: string }
  | { stage: 'ingest'; type: 'timeout'; url: string; timeout_seconds: number }
  | { stage: 'ingest'; type: 'auth_denied'; url: string; status_code: 401 }
  | { stage: 'ingest'; type: 'bot_protection'; url: string; status_code: 403 }
  | { stage: 'ingest'; type: 'not_found'; url: string }
  | { stage: 'ingest'; type: 'http_error'; url: string; status_code: number }
  | { stage: 'ingest'; type: 'unsupported_content_type'; url: string; content_type: string }
  | { stage: 'ingest'; type: 'empty_response'; url: string }
  
  // Ingest stage: Local file errors (Requirement 2)
  // Precedence: existence > permissions > empty > extension
  | { stage: 'ingest'; type: 'file_not_found'; path: string }
  | { stage: 'ingest'; type: 'permission_denied'; path: string }
  | { stage: 'ingest'; type: 'empty_file'; path: string }
  | { stage: 'ingest'; type: 'unsupported_extension'; path: string; extension: string }
  
  // Extract stage errors (Requirements 5, 10)
  | { stage: 'extract'; type: 'kiro_not_found' }
  | { stage: 'extract'; type: 'kiro_not_authenticated' }
  | { stage: 'extract'; type: 'kiro_timeout'; timeout_seconds: number; chunk_index?: number }
  | { stage: 'extract'; type: 'kiro_failed'; exit_code: number; stderr: string }
  | { stage: 'extract'; type: 'ir_file_missing'; chunk_index: number; expected_path: string; stderr: string }
  | { stage: 'extract'; type: 'ir_file_empty'; chunk_index: number; path: string }
  | { stage: 'extract'; type: 'invalid_ir_json'; chunk_index: number; path: string; parse_error: string }
  | { stage: 'extract'; type: 'merge_conflict'; field: string; values: unknown[]; chunk_indices: number[] }
  | { stage: 'extract'; type: 'missing_resource'; resource: string; config_source: string }
  | { stage: 'extract'; type: 'missing_operation'; resource: string; operation: string; config_source: string }
  
  // Validate stage errors (Requirements 12, 13, 14)
  | { stage: 'validate'; type: 'missing_base_url' }
  | { stage: 'validate'; type: 'missing_auth_scheme' }
  | { stage: 'validate'; type: 'empty_resources' }
  | { stage: 'validate'; type: 'empty_operations'; resource: string }
  | { stage: 'validate'; type: 'missing_http_method'; resource: string; operation: string }
  | { stage: 'validate'; type: 'missing_path'; resource: string; operation: string }
  | { stage: 'validate'; type: 'path_param_not_defined'; resource: string; operation: string; param: string }
  | { stage: 'validate'; type: 'no_body_params'; resource: string; operation: string; http_method: 'POST' | 'PUT' }
  | { stage: 'validate'; type: 'missing_api_key_header_name' }
  | { stage: 'validate'; type: 'missing_api_key_query_param_name' }
  | { stage: 'validate'; type: 'missing_api_key_body_field_name' }
  | { stage: 'validate'; type: 'missing_oauth2_urls'; missing: Array<'authorize_url' | 'token_url'> }
  | { stage: 'validate'; type: 'array_param_missing_items_type'; resource: string; operation: string; param: string }
  | { stage: 'validate'; type: 'incompatible_constraint'; resource: string; operation: string; param: string; constraint: string; param_type: string }
  | { stage: 'validate'; type: 'array_response_missing_items_type'; resource: string; operation: string }
  
  // Verify stage errors (Requirements 25, 26, 27)
  | { stage: 'verify'; type: 'tsc_not_found' }
  | { stage: 'verify'; type: 'typecheck_failed'; errors: string[] }
  | { stage: 'verify'; type: 'compile_failed'; errors: string[] }
  | { stage: 'verify'; type: 'import_failed'; error: string }
  | { stage: 'verify'; type: 'missing_node_property'; property: string }
  | { stage: 'verify'; type: 'vitest_not_found' }
  | { stage: 'verify'; type: 'test_failed'; failures: string[] };

/**
 * Type guard to check if a value is a GeneratorError
 */
export function isGeneratorError(value: unknown): value is GeneratorError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'stage' in value &&
    'type' in value &&
    typeof (value as { stage: unknown }).stage === 'string' &&
    typeof (value as { type: unknown }).type === 'string'
  );
}

/**
 * Format a GeneratorError for human-readable output
 */
export function formatError(error: GeneratorError): string {
  switch (error.stage) {
    case 'ingest':
      return formatIngestError(error);
    case 'extract':
      return formatExtractError(error);
    case 'validate':
      return formatValidateError(error);
    case 'verify':
      return formatVerifyError(error);
  }
}

function formatIngestError(error: Extract<GeneratorError, { stage: 'ingest' }>): string {
  switch (error.type) {
    case 'network_error':
      return `Error: Network failure fetching documentation

  URL: ${error.url}
  Error: ${error.message}

Check your network connection and verify the URL is accessible.`;

    case 'timeout':
      return `Error: Documentation fetch timed out

  URL: ${error.url}
  Timeout: ${error.timeout_seconds} seconds

The server did not respond within the timeout period. Try again later or check if the URL is correct.`;

    case 'auth_denied':
      return `Error: Authentication required

  URL: ${error.url}
  Status: 401 Unauthorized

The documentation URL requires credentials. Ensure the documentation is publicly accessible.`;

    case 'bot_protection':
      return `Error: Server refused the request

  URL: ${error.url}
  Status: 403 Forbidden

A 403 on a public documentation page is usually bot protection rather than a
genuine permissions problem, and the most common trigger is an unfamiliar or
missing User-Agent.

Two things to try:
  - Set "userAgent" in your generator config to identify your tool
  - Save the page from a browser and use a file source instead:
      "documentation": { "type": "file", "path": "./docs/vendor.html" }`;

    case 'not_found':
      return `Error: Documentation not found

  URL: ${error.url}
  Status: 404 Not Found

The documentation URL returned a 404 error. Verify the URL is correct and the documentation is publicly accessible.`;

    case 'http_error':
      return `Error: HTTP error fetching documentation

  URL: ${error.url}
  Status: ${error.status_code}

The server returned an error status. Check the URL and try again later.`;

    case 'unsupported_content_type':
      return `Error: Unsupported content type

  URL: ${error.url}
  Content-Type: ${error.content_type}

Expected text/html, text/plain, text/markdown, or application/json.`;

    case 'empty_response':
      return `Error: Empty response

  URL: ${error.url}

The server returned an empty response body. Verify the URL points to actual documentation.`;

    case 'file_not_found':
      return `Error: Documentation file not found

  Path: ${error.path}

The specified file does not exist. Check the path in your configuration file.`;

    case 'permission_denied':
      return `Error: Permission denied

  Path: ${error.path}

Cannot read the documentation file due to insufficient permissions.`;

    case 'empty_file':
      return `Error: Empty file

  Path: ${error.path}

The documentation file contains no content.`;

    case 'unsupported_extension':
      return `Error: Unsupported file extension

  Path: ${error.path}
  Extension: ${error.extension}

Supported extensions: .html, .md, .txt, .json`;
  }
}

function formatExtractError(error: Extract<GeneratorError, { stage: 'extract' }>): string {
  switch (error.type) {
    case 'kiro_not_found':
      return `Error: kiro-cli not found

The driftnode generator requires kiro-cli to be installed and available in PATH.

Install Kiro and ensure an active session is running.`;


    case 'kiro_not_authenticated':
      return `Error: kiro-cli not authenticated

You must be signed in to use kiro-cli for extraction.

Run: kiro-cli login

Then try again.`;
    case 'kiro_timeout':
      const chunkInfo = error.chunk_index !== undefined
        ? `\n  Chunk: ${error.chunk_index}`
        : '';
      return `Error: Extraction timed out
${chunkInfo}
  Timeout: ${error.timeout_seconds} seconds

The extraction process did not complete within the timeout period. This may indicate an issue with kiro-cli or the documentation is too large.`;

    case 'kiro_failed':
      return `Error: Extraction failed

  Exit code: ${error.exit_code}

kiro-cli stderr:
${error.stderr}

The extraction subprocess failed. Check the error output above for details.`;

    case 'ir_file_missing':
      return `Error: IR file not produced

  Chunk: ${error.chunk_index}
  Expected path: ${error.expected_path}

kiro-cli did not write the expected output file.

kiro-cli stderr:
${error.stderr}`;

    case 'ir_file_empty':
      return `Error: Empty IR file

  Chunk: ${error.chunk_index}
  Path: ${error.path}

kiro-cli produced an empty file instead of valid JSON.`;

    case 'invalid_ir_json':
      return `Error: Invalid IR JSON

  Chunk: ${error.chunk_index}
  Path: ${error.path}
  Parse error: ${error.parse_error}

The IR file produced by kiro-cli is not valid JSON.`;

    case 'merge_conflict':
      return `Error: Merge conflict

  Field: ${error.field}
  Conflicting values found in chunks: ${error.chunk_indices.join(', ')}

Values:
${error.values.map((v, i) => `  Chunk ${error.chunk_indices[i]}: ${JSON.stringify(v)}`).join('\n')}

The same field has different values in different documentation chunks. This indicates inconsistent documentation.`;

    case 'missing_resource':
      return `Error: Resource not found in documentation

  Resource: ${error.resource}
  Specified in: ${error.config_source}

The resource specified in the configuration was not found in the extracted documentation.`;

    case 'missing_operation':
      return `Error: Operation not found in documentation

  Resource: ${error.resource}
  Operation: ${error.operation}
  Specified in: ${error.config_source}

The operation specified in the configuration was not found in the extracted documentation.`;
  }
}

function formatValidateError(error: Extract<GeneratorError, { stage: 'validate' }>): string {
  switch (error.type) {
    case 'missing_base_url':
      return `Error: Missing base URL

No base URL was found in the documentation. The API base URL is required to generate functional nodes.`;

    case 'missing_auth_scheme':
      return `Error: Missing authentication scheme

No authentication scheme was found in the documentation. Authentication configuration is required.`;

    case 'empty_resources':
      return `Error: No resources extracted

The extraction found no resources in the documentation. Verify the documentation contains API endpoint definitions.`;

    case 'empty_operations':
      return `Error: Resource has no operations

  Resource: ${error.resource}

This resource has no operations defined. Each resource must have at least one operation.`;

    case 'missing_http_method':
      return `Error: Missing HTTP method

  Resource: ${error.resource}
  Operation: ${error.operation}

The operation is missing an HTTP method (GET, POST, PUT, PATCH, DELETE).`;

    case 'missing_path':
      return `Error: Missing path

  Resource: ${error.resource}
  Operation: ${error.operation}

The operation is missing a URL path.`;

    case 'path_param_not_defined':
      return `Error: Path parameter not defined

  Resource: ${error.resource}
  Operation: ${error.operation}
  Parameter: ${error.param}

The path references a parameter that is not defined in the parameters list.`;

    case 'no_body_params':
      return `Warning: POST/PUT operation with no body parameters

  Resource: ${error.resource}
  Operation: ${error.operation}
  Method: ${error.http_method}

This operation uses ${error.http_method} but has no body parameters. This may be intentional.`;

    case 'missing_api_key_header_name':
      return `Error: Missing API key header name

Authentication scheme is api_key with location=header, but header_name is not specified.`;

    case 'missing_api_key_query_param_name':
      return `Error: Missing API key query parameter name

Authentication scheme is api_key with location=query, but query_param_name is not specified.`;

    case 'missing_api_key_body_field_name':
      return `Error: Missing API key body field name

Authentication scheme is api_key with location=body, but body_field_name is not specified.`;

    case 'missing_oauth2_urls':
      return `Error: Missing OAuth2 URLs

  Missing: ${error.missing.join(', ')}

OAuth2 authentication requires both authorize_url and token_url.`;

    case 'array_param_missing_items_type':
      return `Error: Array parameter missing items_type

  Resource: ${error.resource}
  Operation: ${error.operation}
  Parameter: ${error.param}

Array parameters must specify an items_type.`;

    case 'incompatible_constraint':
      return `Error: Incompatible constraint

  Resource: ${error.resource}
  Operation: ${error.operation}
  Parameter: ${error.param}
  Constraint: ${error.constraint}
  Parameter type: ${error.param_type}

The constraint is not compatible with the parameter type.`;

    case 'array_response_missing_items_type':
      return `Error: Array response missing items_type

  Resource: ${error.resource}
  Operation: ${error.operation}

Array response shapes must specify an items_type.`;
  }
}

function formatVerifyError(error: Extract<GeneratorError, { stage: 'verify' }>): string {
  switch (error.type) {
    case 'tsc_not_found':
      return `Error: TypeScript compiler not found

The driftnode generator requires the TypeScript compiler (tsc) to verify generated code.

Install TypeScript as a devDependency.`;

    case 'typecheck_failed':
      return `Error: Typecheck failed

Generated code has TypeScript errors:

${error.errors.join('\n')}`;

    case 'compile_failed':
      return `Error: Compilation failed

${error.errors.join('\n')}`;

    case 'import_failed':
      return `Error: Failed to load generated node

${error.error}

The generated node could not be dynamically imported. This indicates a structural issue with the generated code.`;

    case 'missing_node_property':
      return `Error: Generated node missing required property

  Property: ${error.property}

The generated node class is missing a required property for n8n compatibility.`;

    case 'vitest_not_found':
      return `Error: vitest not found

The driftnode generator requires vitest to run generated tests.

Install vitest as a devDependency.`;

    case 'test_failed':
      return `Error: Generated tests failed

${error.failures.join('\n')}`;
  }
}

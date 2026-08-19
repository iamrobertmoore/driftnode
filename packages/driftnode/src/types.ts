/**
 * Type definitions for the driftnode generator
 * 
 * The Intermediate Representation (IR) is the central artifact that bridges
 * extraction (reading prose documentation) and emission (writing code).
 */

/**
 * Partial Intermediate Representation: what Kiro writes per documentation chunk.
 * base_url and auth are optional because they may not appear in every chunk.
 * source and schema_version are absent because they are generator-owned metadata.
 */
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

/**
 * Intermediate Representation: the structured contract extracted from
 * vendor API documentation. This is the boundary between extraction and emission.
 */
export interface IntermediateRepresentation {
  /**
   * Schema version for backward compatibility as IR evolves
   */
  schema_version: '1.0.0';

  /**
   * Source documentation metadata
   */
  source: {
    /**
     * URL if fetched remotely, undefined if read from local file
     */
    url?: string;
    
    /**
     * Absolute path if read from local file, undefined if fetched remotely
     */
    path?: string;
    
    /**
     * SHA-256 hash of normalized documentation content.
     * Used by conformance test to detect documentation changes.
     */
    content_hash: string;
    
    /**
     * Timestamp when the IR was extracted (ISO 8601)
     */
    extracted_at: string;
  };

  /**
   * Vendor API base URL (e.g., "https://api.vultr.com/v2")
   */
  base_url: string;

  /**
   * Authentication configuration
   */
  auth: AuthenticationScheme;

  /**
   * Resources exposed by the API (e.g., "instances", "ssh-keys")
   */
  resources: Resource[];

  /**
   * Extension point for pagination extraction (Requirement 11, deferred)
   */
  pagination?: PaginationConfig;
}

/**
 * Authentication scheme extracted from documentation
 */
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

/**
 * A resource in the vendor API (e.g., "instances", "ssh-keys")
 */
export interface Resource {
  /**
   * Resource identifier (kebab-case, e.g., "ssh-keys")
   */
  name: string;

  /**
   * Human-readable display name (e.g., "SSH Keys")
   */
  display_name: string;

  /**
   * Description extracted from documentation
   */
  description: string;

  /**
   * Operations available on this resource
   */
  operations: Operation[];
}

/**
 * An operation on a resource (e.g., "list", "create", "delete")
 */
export interface Operation {
  /**
   * Operation identifier (kebab-case, e.g., "list-instances")
   */
  name: string;

  /**
   * Human-readable display name (e.g., "List Instances")
   */
  display_name: string;

  /**
   * Description extracted from documentation
   */
  description: string;

  /**
   * HTTP method
   */
  http_method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  /**
   * URL path with parameter placeholders (e.g., "/instances/{instance-id}")
   */
  path: string;

  /**
   * Parameters accepted by this operation
   */
  parameters: Parameter[];

  /**
   * Response structure
   */
  response_shape: ResponseShape;

  /**
   * Example request/response pairs extracted from documentation
   */
  examples: Example[];

  /**
   * Extension point for pagination (Requirement 11, deferred)
   */
  pagination?: OperationPagination;
}

/**
 * A parameter for an operation
 */
export interface Parameter {
  /**
   * Parameter name (e.g., "instance_id", "label")
   */
  name: string;

  /**
   * Human-readable display name (e.g., "Instance ID")
   */
  display_name: string;

  /**
   * Description extracted from documentation
   */
  description: string;

  /**
   * Where the parameter appears in the request
   */
  location: 'path' | 'query' | 'header' | 'body';

  /**
   * Parameter type
   */
  type: ParameterType;

  /**
   * Whether this parameter is required
   */
  required: boolean;

  /**
   * Default value if documented, undefined otherwise
   */
  default_value?: string | number | boolean;

  /**
   * Validation constraints extracted from documentation
   */
  constraints?: ParameterConstraints;
}

/**
 * Parameter types supported by n8n
 */
export type ParameterType =
  | { kind: 'string' }
  | { kind: 'number' }
  | { kind: 'integer' }
  | { kind: 'boolean' }
  | { kind: 'array'; items_type: ParameterType }
  | { kind: 'object'; properties: Record<string, ParameterType> };

/**
 * Validation constraints for parameters
 */
export interface ParameterConstraints {
  /**
   * Enum values if parameter is an enum
   */
  enum?: Array<string | number>;

  /**
   * Minimum length for strings (only if documented)
   */
  min_length?: number;

  /**
   * Maximum length for strings (only if documented)
   */
  max_length?: number;

  /**
   * Regex pattern for strings (only if documented)
   */
  pattern?: string;

  /**
   * Minimum value for numbers (only if documented)
   */
  minimum?: number;

  /**
   * Maximum value for numbers (only if documented)
   */
  maximum?: number;

  /**
   * Minimum items for arrays (only if documented)
   */
  min_items?: number;

  /**
   * Maximum items for arrays (only if documented)
   */
  max_items?: number;
}

/**
 * Response structure for an operation
 */
export interface ResponseShape {
  /**
   * Top-level response type
   */
  type: 'object' | 'array' | 'primitive';

  /**
   * Properties if type is 'object'
   */
  properties?: Record<string, PropertyShape>;

  /**
   * Item type if type is 'array'
   */
  items_type?: ResponseShape;

  /**
   * Primitive type if type is 'primitive'
   */
  primitive_type?: 'string' | 'number' | 'boolean' | 'null';

  /**
   * Flag indicating the response shape is undocumented or ambiguous.
   * When true, the conformance test skips response shape verification
   * for this operation.
   */
  undocumented: boolean;
}

/**
 * A property in an object response
 */
export interface PropertyShape {
  /**
   * Property type
   */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';

  /**
   * Whether this property is required in the response
   */
  required: boolean;

  /**
   * Description extracted from documentation
   */
  description?: string;

  /**
   * Nested properties if type is 'object'
   */
  properties?: Record<string, PropertyShape>;

  /**
   * Item type if type is 'array'
   */
  items_type?: PropertyShape;
}

/**
 * Example request/response pair
 */
export interface Example {
  /**
   * Example name or description
   */
  name: string;

  /**
   * Request parameters
   */
  request: Record<string, unknown>;

  /**
   * Response body
   */
  response: unknown;

  /**
   * HTTP status code
   */
  status_code: number;
}

/**
 * Extension point for pagination support (Requirement 11, deferred)
 */
export interface PaginationConfig {
  /**
   * Default pagination style across all operations
   */
  default_style: 'cursor' | 'offset' | 'page' | 'none';
}

/**
 * Extension point for per-operation pagination (Requirement 11, deferred)
 */
export interface OperationPagination {
  /**
   * Pagination style for this operation (overrides default)
   */
  style: 'cursor' | 'offset' | 'page' | 'none';

  /**
   * Cursor-based pagination config
   */
  cursor?: {
    cursor_param: string;
    next_cursor_field: string;
  };

  /**
   * Offset-based pagination config
   */
  offset?: {
    limit_param: string;
    offset_param: string;
  };

  /**
   * Page-based pagination config
   */
  page?: {
    page_param: string;
    page_size_param: string;
  };
}

/**
 * Documentation source: either a URL or a local file path
 */
export type DocumentSource =
  | { type: 'url'; url: string }
  | { type: 'file'; path: string };

/**
 * A chunk of normalized documentation
 */
export interface DocumentChunk {
  /**
   * Normalized content
   */
  content: string;

  /**
   * Start position in original documentation
   */
  start: number;

  /**
   * End position in original documentation
   */
  end: number;
}

/**
 * Generator configuration from user-provided config file
 */
export interface GeneratorConfig {
  /**
   * Vendor name (kebab-case, e.g., "vultr")
   */
  vendor: string;

  /**
   * Documentation source
   */
  documentation: DocumentSource;

  /**
   * Resources and operations to include.
   * If omitted, all discovered resources are included.
   */
  include?: {
    /**
     * Resource name as it appears in documentation
     */
    resource: string;
    
    /**
     * Operations to include. If omitted, all operations for the resource are included.
     */
    operations?: string[];
  }[];


  /**
   * User-Agent header for remote fetches.
   * If omitted, defaults to "driftnode/0.1.0 (+https://github.com/iamrobertmoore/driftnode)".
   * Vendor documentation sites commonly reject requests with no User-Agent.
   */
  userAgent?: string;

  /**
   * Kiro reasoning effort level for extraction.
   * Controls how much computational effort Kiro spends on understanding and extracting API details.
   * Higher effort levels produce more accurate extractions but take longer.
   * If omitted, Kiro uses its default effort level.
   */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';

  /**
   * Number of characters per documentation chunk.
   * Large documentation is split into chunks for parallel extraction.
   * Larger chunks provide more context but may exceed model token limits.
   * If omitted, defaults to a sensible value based on the model's context window.
   */
  chunkSize?: number;

  /**
   * Number of overlapping characters between adjacent chunks.
   * Overlap ensures that information spanning chunk boundaries is not lost.
   * If omitted, defaults to 10% of chunkSize.
   */
  chunkOverlap?: number;

  /**
   * Maximum number of chunks to extract in parallel.
   * Higher values speed up extraction but may hit rate limits or exhaust system resources.
   * If omitted, defaults to a conservative value (e.g., 3).
   */
  concurrency?: number;

  /**
   * Timeout in seconds for each chunk extraction.
   * If a chunk extraction exceeds this duration, it fails and is retried.
   * If omitted, defaults to 300 seconds (5 minutes).
   */
  extractionTimeoutSeconds?: number;
}

/**
 * Validation result
 */
export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: ValidationError[] };

/**
 * A validation error
 */
export interface ValidationError {
  /**
   * Error type
   */
  type: string;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * Additional context
   */
  context?: Record<string, unknown>;
}

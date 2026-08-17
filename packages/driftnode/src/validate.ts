/**
 * Validation stage: validates IR completeness before code emission
 * 
 * This module implements Requirement 12 (Validate IR Completeness).
 * Validation ensures that the extracted IR contains all required fields
 * and has no structural issues before the emission stage begins.
 */

import type { IntermediateRepresentation } from './types.js';
import type { GeneratorError } from './errors.js';

/**
 * Validation result: either success or a list of validation errors
 */
export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: GeneratorError[] };

/**
 * Validate IR completeness before code emission
 * 
 * Checks:
 * - base_url field is present
 * - auth field is present
 * - resources array is non-empty
 * - each resource has non-empty operations array
 * - each operation has http_method and path
 * - path parameters are defined in parameters array
 * - POST/PUT operations have body parameters (warning if not)
 * 
 * Returns validation result with all errors found (does not stop at first error)
 */
export function validate(ir: IntermediateRepresentation): ValidationResult {
  const errors: GeneratorError[] = [];

  // Check base_url field present
  if (!ir.base_url || ir.base_url.trim().length === 0) {
    errors.push({
      stage: 'validate',
      type: 'missing_base_url',
    });
  }

  // Check auth field present
  if (!ir.auth) {
    errors.push({
      stage: 'validate',
      type: 'missing_auth_scheme',
    });
  } else {
    // Validate authentication configuration (Requirement 14)
    validateAuthenticationConfig(ir.auth, errors);
  }

  // Check resources array non-empty
  if (!ir.resources || ir.resources.length === 0) {
    errors.push({
      stage: 'validate',
      type: 'empty_resources',
    });
  } else {
    // For each resource, check operations array non-empty
    for (const resource of ir.resources) {
      if (!resource.operations || resource.operations.length === 0) {
        errors.push({
          stage: 'validate',
          type: 'empty_operations',
          resource: resource.name,
        });
      } else {
        // Validate each operation
        for (const operation of resource.operations) {
          // Check http_method present
          if (!operation.http_method) {
            errors.push({
              stage: 'validate',
              type: 'missing_http_method',
              resource: resource.name,
              operation: operation.name,
            });
          }

          // Check path present
          if (!operation.path) {
            errors.push({
              stage: 'validate',
              type: 'missing_path',
              resource: resource.name,
              operation: operation.name,
            });
          } else {
            // Extract path parameters and verify they're defined
            const pathParams = extractPathParameters(operation.path);
            for (const pathParam of pathParams) {
              const paramDefined = operation.parameters?.some(
                (p) => p.name === pathParam && p.location === 'path'
              );
              if (!paramDefined) {
                errors.push({
                  stage: 'validate',
                  type: 'path_param_not_defined',
                  resource: resource.name,
                  operation: operation.name,
                  param: pathParam,
                });
              }
            }
          }

          // Check POST/PUT operations have body parameters (warning only)
          if (
            operation.http_method === 'POST' ||
            operation.http_method === 'PUT'
          ) {
            const hasBodyParams = operation.parameters?.some(
              (p) => p.location === 'body'
            );
            if (!hasBodyParams) {
              // This is a warning, not a fatal error
              // Log to console but don't add to errors array
              console.warn(
                `Warning: ${operation.http_method} operation ${resource.name}.${operation.name} has no body parameters`
              );
            }
          }
        }
      }
    }
  }

  // Return result
  if (errors.length === 0) {
    return { valid: true };
  } else {
    return { valid: false, errors };
  }
}

/**
 * Validate authentication configuration completeness
 * 
 * Checks that auth scheme has all required fields based on type:
 * - api_key: header_name, query_param_name, or body_field_name depending on location
 * - bearer_token: token_header_name (defaults to "Authorization")
 * - oauth2: authorize_url and token_url
 * 
 * @param auth - Authentication scheme from IR
 * @param errors - Array to accumulate validation errors
 */
function validateAuthenticationConfig(
  auth: IntermediateRepresentation['auth'],
  errors: GeneratorError[]
): void {
  switch (auth.type) {
    case 'api_key':
      if (auth.location === 'header') {
        if (!auth.header_name || auth.header_name.trim().length === 0) {
          errors.push({
            stage: 'validate',
            type: 'missing_api_key_header_name',
          });
        }
      } else if (auth.location === 'query') {
        if (!auth.query_param_name || auth.query_param_name.trim().length === 0) {
          errors.push({
            stage: 'validate',
            type: 'missing_api_key_query_param_name',
          });
        }
      } else if (auth.location === 'body') {
        if (!auth.body_field_name || auth.body_field_name.trim().length === 0) {
          errors.push({
            stage: 'validate',
            type: 'missing_api_key_body_field_name',
          });
        }
      }
      break;

    case 'bearer_token':
      // bearer_token defaults to "Authorization" if not specified
      // No error needed here - this is handled during emission
      break;

    case 'oauth2':
      {
        const missing: Array<'authorize_url' | 'token_url'> = [];
        if (!auth.authorize_url || auth.authorize_url.trim().length === 0) {
          missing.push('authorize_url');
        }
        if (!auth.token_url || auth.token_url.trim().length === 0) {
          missing.push('token_url');
        }
        if (missing.length > 0) {
          errors.push({
            stage: 'validate',
            type: 'missing_oauth2_urls',
            missing,
          });
        }
      }
      break;

    case 'basic':
      // basic auth has no additional required fields
      break;
  }
}

/**
 * Extract path parameter names from a URL path
 * 
 * Matches parameter placeholders like {instance-id}, {id}, etc.
 * Returns array of parameter names without the braces.
 * 
 * @param path - URL path with parameter placeholders (e.g., "/instances/{instance-id}")
 * @returns Array of parameter names (e.g., ["instance-id"])
 */
function extractPathParameters(path: string): string[] {
  const paramRegex = /\{([^}]+)\}/g;
  const params: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = paramRegex.exec(path)) !== null) {
    if (match[1]) {
      params.push(match[1]);
    }
  }

  return params;
}

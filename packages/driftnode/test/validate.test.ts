/**
 * Tests for validate.ts
 * 
 * Tests validation of IR completeness, operation integrity, and authentication configuration
 */

import { describe, it, expect } from 'vitest';
import { validate } from '../src/validate.js';
import type { IntermediateRepresentation } from '../src/types.js';

// Helper to create a minimal valid IR
function createValidIR(): IntermediateRepresentation {
  return {
    schema_version: '1.0.0',
    source: {
      url: 'https://example.com/docs',
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
              items_type: {
                type: 'object',
                undocumented: false,
              },
            },
            examples: [],
          },
        ],
      },
    ],
  };
}

describe('validate', () => {
  describe('completeness validation', () => {
    it('should pass for valid complete IR', () => {
      const ir = createValidIR();
      const result = validate(ir);
      expect(result.valid).toBe(true);
    });

    it('should fail when base_url is missing', () => {
      const ir = createValidIR();
      ir.base_url = '';
      const result = validate(ir);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          stage: 'validate',
          type: 'missing_base_url',
        });
      }
    });

    it('should fail when auth is missing', () => {
      const ir = createValidIR();
      // @ts-expect-error - intentionally invalid for testing
      ir.auth = null;
      const result = validate(ir);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          stage: 'validate',
          type: 'missing_auth_scheme',
        });
      }
    });

    it('should fail when resources array is empty', () => {
      const ir = createValidIR();
      ir.resources = [];
      const result = validate(ir);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          stage: 'validate',
          type: 'empty_resources',
        });
      }
    });

    it('should fail when resource has no operations', () => {
      const ir = createValidIR();
      ir.resources[0].operations = [];
      const result = validate(ir);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          stage: 'validate',
          type: 'empty_operations',
          resource: 'users',
        });
      }
    });
  });

  describe('authentication configuration validation', () => {
    it('should pass for valid api_key with header location', () => {
      const ir = createValidIR();
      ir.auth = {
        type: 'api_key',
        location: 'header',
        header_name: 'X-API-Key',
      };
      const result = validate(ir);
      expect(result.valid).toBe(true);
    });

    it('should fail when api_key header location is missing header_name', () => {
      const ir = createValidIR();
      ir.auth = {
        type: 'api_key',
        location: 'header',
        header_name: '',
      };
      const result = validate(ir);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          stage: 'validate',
          type: 'missing_api_key_header_name',
        });
      }
    });

    it('should pass for valid api_key with query location', () => {
      const ir = createValidIR();
      ir.auth = {
        type: 'api_key',
        location: 'query',
        query_param_name: 'apikey',
      };
      const result = validate(ir);
      expect(result.valid).toBe(true);
    });

    it('should fail when api_key query location is missing query_param_name', () => {
      const ir = createValidIR();
      ir.auth = {
        type: 'api_key',
        location: 'query',
        query_param_name: '',
      };
      const result = validate(ir);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          stage: 'validate',
          type: 'missing_api_key_query_param_name',
        });
      }
    });

    it('should pass for valid api_key with body location', () => {
      const ir = createValidIR();
      ir.auth = {
        type: 'api_key',
        location: 'body',
        body_field_name: 'api_key',
      };
      const result = validate(ir);
      expect(result.valid).toBe(true);
    });

    it('should fail when api_key body location is missing body_field_name', () => {
      const ir = createValidIR();
      ir.auth = {
        type: 'api_key',
        location: 'body',
        body_field_name: '',
      };
      const result = validate(ir);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          stage: 'validate',
          type: 'missing_api_key_body_field_name',
        });
      }
    });

    it('should pass for valid bearer_token', () => {
      const ir = createValidIR();
      ir.auth = {
        type: 'bearer_token',
        header_name: 'Authorization',
      };
      const result = validate(ir);
      expect(result.valid).toBe(true);
    });

    it('should pass for bearer_token without explicit header_name (defaults to Authorization)', () => {
      const ir = createValidIR();
      ir.auth = {
        type: 'bearer_token',
        header_name: 'Authorization',
      };
      const result = validate(ir);
      expect(result.valid).toBe(true);
    });

    it('should pass for valid basic auth', () => {
      const ir = createValidIR();
      ir.auth = {
        type: 'basic',
      };
      const result = validate(ir);
      expect(result.valid).toBe(true);
    });

    it('should pass for valid oauth2 with all required fields', () => {
      const ir = createValidIR();
      ir.auth = {
        type: 'oauth2',
        authorize_url: 'https://example.com/oauth/authorize',
        token_url: 'https://example.com/oauth/token',
        scopes: ['read', 'write'],
      };
      const result = validate(ir);
      expect(result.valid).toBe(true);
    });

    it('should fail when oauth2 is missing authorize_url', () => {
      const ir = createValidIR();
      ir.auth = {
        type: 'oauth2',
        authorize_url: '',
        token_url: 'https://example.com/oauth/token',
      };
      const result = validate(ir);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          stage: 'validate',
          type: 'missing_oauth2_urls',
          missing: ['authorize_url'],
        });
      }
    });

    it('should fail when oauth2 is missing token_url', () => {
      const ir = createValidIR();
      ir.auth = {
        type: 'oauth2',
        authorize_url: 'https://example.com/oauth/authorize',
        token_url: '',
      };
      const result = validate(ir);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          stage: 'validate',
          type: 'missing_oauth2_urls',
          missing: ['token_url'],
        });
      }
    });

    it('should fail when oauth2 is missing both URLs', () => {
      const ir = createValidIR();
      ir.auth = {
        type: 'oauth2',
        authorize_url: '',
        token_url: '',
      };
      const result = validate(ir);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          stage: 'validate',
          type: 'missing_oauth2_urls',
          missing: ['authorize_url', 'token_url'],
        });
      }
    });
  });

  describe('operation integrity validation', () => {
    it('should fail when operation is missing http_method', () => {
      const ir = createValidIR();
      // @ts-expect-error - intentionally invalid for testing
      ir.resources[0].operations[0].http_method = undefined;
      const result = validate(ir);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          stage: 'validate',
          type: 'missing_http_method',
          resource: 'users',
          operation: 'list-users',
        });
      }
    });

    it('should fail when operation is missing path', () => {
      const ir = createValidIR();
      // @ts-expect-error - intentionally invalid for testing
      ir.resources[0].operations[0].path = undefined;
      const result = validate(ir);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          stage: 'validate',
          type: 'missing_path',
          resource: 'users',
          operation: 'list-users',
        });
      }
    });

    it('should fail when path parameter is not defined in parameters array', () => {
      const ir = createValidIR();
      ir.resources[0].operations[0].path = '/users/{user-id}';
      ir.resources[0].operations[0].parameters = [];
      const result = validate(ir);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual({
          stage: 'validate',
          type: 'path_param_not_defined',
          resource: 'users',
          operation: 'list-users',
          param: 'user-id',
        });
      }
    });

    it('should pass when path parameter is properly defined', () => {
      const ir = createValidIR();
      ir.resources[0].operations[0].path = '/users/{user-id}';
      ir.resources[0].operations[0].parameters = [
        {
          name: 'user-id',
          display_name: 'User ID',
          description: 'The user identifier',
          location: 'path',
          type: { kind: 'string' },
          required: true,
        },
      ];
      const result = validate(ir);
      expect(result.valid).toBe(true);
    });
  });
});

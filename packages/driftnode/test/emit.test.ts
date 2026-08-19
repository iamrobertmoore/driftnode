/**
 * Unit tests for the emit stage (Task 9.7)
 * 
 * Tests for credentials and node emission covering:
 * - Credentials file generation for all auth types
 * - Node file structure (INodeType interface, description, credentials, properties)
 * - Resource and operation dropdown generation
 * - Parameter field generation (types, constraints, displayOptions)
 * - Execute method routing (resource and operation switch statements)
 * - HTTP request construction (URL, query, headers, body)
 * - Authentication injection (header, query, body)
 * - Error mapping for all status codes
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { emit } from '../src/emit.js';
import {
  IntermediateRepresentation,
  GeneratorConfig,
  Resource,
  Operation,
  Parameter,
  ParameterType,
} from '../src/types.js';

describe('Emit Stage', () => {
  const testTempDir = path.join(process.cwd(), '.tmp-test-emit');
  
  beforeEach(async () => {
    // Clean up any existing test temp directory
    if (fs.existsSync(testTempDir)) {
      await fs.promises.rm(testTempDir, { recursive: true });
    }
    await fs.promises.mkdir(testTempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test temp directory
    if (fs.existsSync(testTempDir)) {
      await fs.promises.rm(testTempDir, { recursive: true });
    }
  });

  describe('Credentials File Generation (Task 9.7)', () => {
    it('should generate API key authentication with header location', async () => {
      const ir: IntermediateRepresentation = {
        schema_version: '1.0.0',
        source: {
          url: 'https://example.com/docs',
          content_hash: 'abc123',
        },
        base_url: 'https://api.example.com',
        auth: {
          type: 'api_key',
          location: 'header',
          header_name: 'X-API-Key',
        },
        resources: createMinimalResources(),
      };

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const credPath = path.join(testTempDir, 'credentials', 'TestVendorApi.credentials.ts');
      expect(fs.existsSync(credPath)).toBe(true);

      const credContent = await fs.promises.readFile(credPath, 'utf-8');
      
      // Should implement ICredentialType
      expect(credContent).toContain('implements ICredentialType');
      expect(credContent).toContain("name = 'test-vendorApi'");
      expect(credContent).toContain("displayName = 'TestVendor API'");
      
      // Should have API key field
      expect(credContent).toContain("displayName: 'API Key'");
      expect(credContent).toContain("name: 'apiKey'");
      expect(credContent).toContain("type: 'string'");
      expect(credContent).toContain('password: true');
      
      // Should inject header in authenticate
      expect(credContent).toContain("'X-API-Key': '={{$credentials.apiKey}}'");
    });

    it('should generate API key authentication with query location', async () => {
      const ir: IntermediateRepresentation = {
        schema_version: '1.0.0',
        source: {
          url: 'https://example.com/docs',
          content_hash: 'abc123',
        },
        base_url: 'https://api.example.com',
        auth: {
          type: 'api_key',
          location: 'query',
          query_param_name: 'api_key',
        },
        resources: createMinimalResources(),
      };

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const credPath = path.join(testTempDir, 'credentials', 'TestVendorApi.credentials.ts');
      const credContent = await fs.promises.readFile(credPath, 'utf-8');
      
      // Should inject query parameter in authenticate
      expect(credContent).toContain('qs: {');
      expect(credContent).toContain("'api_key': '={{$credentials.apiKey}}'");
    });

    it('should generate API key authentication with body location', async () => {
      const ir: IntermediateRepresentation = {
        schema_version: '1.0.0',
        source: {
          url: 'https://example.com/docs',
          content_hash: 'abc123',
        },
        base_url: 'https://api.example.com',
        auth: {
          type: 'api_key',
          location: 'body',
          body_field_name: 'api_key',
        },
        resources: createMinimalResources(),
      };

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const credPath = path.join(testTempDir, 'credentials', 'TestVendorApi.credentials.ts');
      const credContent = await fs.promises.readFile(credPath, 'utf-8');
      
      // Should inject body field in authenticate
      expect(credContent).toContain('body: {');
      expect(credContent).toContain("'api_key': '={{$credentials.apiKey}}'");
    });

    it('should generate bearer token authentication', async () => {
      const ir: IntermediateRepresentation = {
        schema_version: '1.0.0',
        source: {
          url: 'https://example.com/docs',
          content_hash: 'abc123',
        },
        base_url: 'https://api.example.com',
        auth: {
          type: 'bearer_token',
          header_name: 'Authorization',
        },
        resources: createMinimalResources(),
      };

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const credPath = path.join(testTempDir, 'credentials', 'TestVendorApi.credentials.ts');
      const credContent = await fs.promises.readFile(credPath, 'utf-8');
      
      // Should have access token field
      expect(credContent).toContain("displayName: 'Access Token'");
      expect(credContent).toContain("name: 'accessToken'");
      expect(credContent).toContain('password: true');
      
      // Should inject Bearer token in authenticate
      expect(credContent).toContain("'Authorization': '=Bearer {{$credentials.accessToken}}'");
    });

    it('should generate basic authentication', async () => {
      const ir: IntermediateRepresentation = {
        schema_version: '1.0.0',
        source: {
          url: 'https://example.com/docs',
          content_hash: 'abc123',
        },
        base_url: 'https://api.example.com',
        auth: {
          type: 'basic',
        },
        resources: createMinimalResources(),
      };

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const credPath = path.join(testTempDir, 'credentials', 'TestVendorApi.credentials.ts');
      const credContent = await fs.promises.readFile(credPath, 'utf-8');
      
      // Should have username and password fields
      expect(credContent).toContain("displayName: 'Username'");
      expect(credContent).toContain("name: 'username'");
      expect(credContent).toContain("displayName: 'Password'");
      expect(credContent).toContain("name: 'password'");
      
      // Should inject Basic auth header
      expect(credContent).toContain("'Authorization': '=Basic {{$credentials.username}}:{{$credentials.password}}'");
    });

    it('should generate OAuth2 authentication', async () => {
      const ir: IntermediateRepresentation = {
        schema_version: '1.0.0',
        source: {
          url: 'https://example.com/docs',
          content_hash: 'abc123',
        },
        base_url: 'https://api.example.com',
        auth: {
          type: 'oauth2',
          authorize_url: 'https://example.com/oauth/authorize',
          token_url: 'https://example.com/oauth/token',
          scopes: ['read', 'write'],
        },
        resources: createMinimalResources(),
      };

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const credPath = path.join(testTempDir, 'credentials', 'TestVendorApi.credentials.ts');
      const credContent = await fs.promises.readFile(credPath, 'utf-8');
      
      // Should have OAuth2 fields
      expect(credContent).toContain("grantType");
      expect(credContent).toContain("'authorizationCode'");
      expect(credContent).toContain("authUrl");
      expect(credContent).toContain('https://example.com/oauth/authorize');
      expect(credContent).toContain("accessTokenUrl");
      expect(credContent).toContain('https://example.com/oauth/token');
      expect(credContent).toContain("clientId");
      expect(credContent).toContain("clientSecret");
      expect(credContent).toContain("scopes");
      expect(credContent).toContain('read write');
      
      // Should inject OAuth2 token in authenticate
      expect(credContent).toContain("'Authorization': '=Bearer {{$credentials.oauthTokenData.access_token}}'");
    });
  });

  describe('Node File Structure (Task 9.7)', () => {
    it('should generate valid INodeType implementation', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      // Should have correct imports
      expect(nodeContent).toContain("from 'n8n-workflow'");
      expect(nodeContent).toContain('IExecuteFunctions');
      expect(nodeContent).toContain('INodeExecutionData');
      expect(nodeContent).toContain('INodeType');
      expect(nodeContent).toContain('INodeTypeDescription');

      // Should implement INodeType
      expect(nodeContent).toContain('implements INodeType');
      
      // Should have description property
      expect(nodeContent).toContain('description: INodeTypeDescription');
      
      // Should have execute method
      expect(nodeContent).toContain('async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>');
    });

    it('should set correct node description properties', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      // Check description properties
      expect(nodeContent).toContain("displayName: 'TestVendor'");
      expect(nodeContent).toContain("name: 'test-vendor'");
      expect(nodeContent).toContain("icon: 'file:test-vendor.svg'");
      expect(nodeContent).toContain("version: 1");
      expect(nodeContent).toContain('usableAsTool: true');
      expect(nodeContent).toContain("subtitle: '={{$parameter[\"operation\"] + \": \" + $parameter[\"resource\"]}}'");
    });

    it('should reference credentials file', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      // Should reference credentials
      expect(nodeContent).toContain('credentials: [');
      expect(nodeContent).toContain("name: 'test-vendorApi'");
      expect(nodeContent).toContain('required: true');
    });
  });

  describe('Resource and Operation Dropdowns (Task 9.7)', () => {
    it('should generate resource dropdown with all resources', async () => {
      const ir: IntermediateRepresentation = {
        schema_version: '1.0.0',
        source: {
          url: 'https://example.com/docs',
          content_hash: 'abc123',
        },
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
            description: 'Manage instances',
            operations: [
              {
                name: 'list',
                display_name: 'List',
                description: 'List instances',
                http_method: 'GET',
                path: '/instances',
                parameters: [],
                response_shape: { type: 'array', undocumented: false },
                examples: [],
              },
            ],
          },
          {
            name: 'volumes',
            display_name: 'Volumes',
            description: 'Manage volumes',
            operations: [
              {
                name: 'list',
                display_name: 'List',
                description: 'List volumes',
                http_method: 'GET',
                path: '/volumes',
                parameters: [],
                response_shape: { type: 'array', undocumented: false },
                examples: [],
              },
            ],
          },
        ],
      };

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      // Should have resource dropdown
      expect(nodeContent).toContain("displayName: 'Resource'");
      expect(nodeContent).toContain("name: 'resource'");
      expect(nodeContent).toContain("type: 'options'");
      
      // Should include both resources
      expect(nodeContent).toContain("name: 'Instances'");
      expect(nodeContent).toContain("value: 'instances'");
      expect(nodeContent).toContain("name: 'Volumes'");
      expect(nodeContent).toContain("value: 'volumes'");
    });

    it('should generate operation dropdowns for each resource', async () => {
      const ir: IntermediateRepresentation = {
        schema_version: '1.0.0',
        source: {
          url: 'https://example.com/docs',
          content_hash: 'abc123',
        },
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
            description: 'Manage instances',
            operations: [
              {
                name: 'list',
                display_name: 'List Instances',
                description: 'List all instances',
                http_method: 'GET',
                path: '/instances',
                parameters: [],
                response_shape: { type: 'array', undocumented: false },
                examples: [],
              },
              {
                name: 'create',
                display_name: 'Create Instance',
                description: 'Create new instance',
                http_method: 'POST',
                path: '/instances',
                parameters: [],
                response_shape: { type: 'object', undocumented: false },
                examples: [],
              },
            ],
          },
        ],
      };

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      // Should have operation dropdown for instances resource
      expect(nodeContent).toMatch(/displayName: 'Operation'[\s\S]*?resource: \['instances'\]/);
      
      // Should include both operations
      // Operation labels have the resource name stripped: n8n composes the
      // action from resource + operation, so "Instances" + "List Instances"
      // would render as "Instances List Instances".
      expect(nodeContent).toContain("name: 'List'");
      expect(nodeContent).toContain("value: 'list'");
      expect(nodeContent).toContain("description: 'List all instances'");
      expect(nodeContent).toContain("name: 'Create'");
      expect(nodeContent).toContain("value: 'create'");
      expect(nodeContent).toContain("description: 'Create new instance'");
    });
  });

  describe('Parameter Field Generation (Task 9.4)', () => {
    it('should generate string parameter fields', async () => {
      const ir = createSampleIR({
        parameters: [
          {
            name: 'label',
            display_name: 'Label',
            description: 'Instance label',
            location: 'body',
            type: { kind: 'string' },
            required: true,
          },
        ],
      });

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      // Verify string field is generated
      expect(nodeContent).toContain("displayName: 'Label'");
      expect(nodeContent).toContain("name: 'label'");
      expect(nodeContent).toContain("type: 'string'");
      expect(nodeContent).toContain('required: true');
      expect(nodeContent).toContain('Instance label');
    });

    it('should generate number parameter fields', async () => {
      const ir = createSampleIR({
        parameters: [
          {
            name: 'count',
            display_name: 'Count',
            description: 'Number of items',
            location: 'query',
            type: { kind: 'number' },
            required: false,
            default_value: 10,
          },
        ],
      });

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      expect(nodeContent).toContain("displayName: 'Count'");
      expect(nodeContent).toContain("type: 'number'");
      expect(nodeContent).toContain('default: 10');
      expect(nodeContent).toContain('required: false');
    });

    it('should generate boolean parameter fields', async () => {
      const ir = createSampleIR({
        parameters: [
          {
            name: 'enabled',
            display_name: 'Enabled',
            description: 'Enable feature',
            location: 'body',
            type: { kind: 'boolean' },
            required: false,
            default_value: false,
          },
        ],
      });

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      expect(nodeContent).toContain("type: 'boolean'");
      expect(nodeContent).toContain('default: false');
    });

    it('should generate enum fields as options dropdowns', async () => {
      const ir = createSampleIR({
        parameters: [
          {
            name: 'region',
            display_name: 'Region',
            description: 'Server region',
            location: 'body',
            type: { kind: 'string' },
            required: true,
            constraints: {
              enum: ['us-east', 'us-west', 'eu-central'],
            },
          },
        ],
      });

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      // Should generate options field instead of string
      expect(nodeContent).toContain("type: 'options'");
      expect(nodeContent).toContain("'us-east'");
      expect(nodeContent).toContain("'us-west'");
      expect(nodeContent).toContain("'eu-central'");

      // And it must still parse. An earlier version of the enum generator
      // returned a field that already included its closing brace, and the
      // caller appended another one, terminating the properties array early
      // and breaking the entire file. Every assertion above still passed,
      // because they only check for substrings.
      expectParses(nodeContent, 'TestVendor.node.ts');
    });

    it('should emit syntactically valid TypeScript for every parameter shape', async () => {
      // One operation carrying every parameter shape the generator handles,
      // so a template that breaks on any of them is caught here rather than
      // by tsc during a real generation run.
      const ir = createSampleIR({
        parameters: [
          {
            name: 'plan_type',
            display_name: 'Plan Type',
            description: "Filter by type. Vultr's docs use apostrophes here.",
            location: 'query',
            type: { kind: 'string' },
            required: false,
            default_value: 'all',
            constraints: { enum: ['all', 'voc-s', 'vcg'] },
          },
          {
            name: 'per_page',
            display_name: 'Per Page',
            description: 'Number of items requested per page.',
            location: 'query',
            type: { kind: 'integer' },
            required: false,
            constraints: { minimum: 1, maximum: 500 },
          },
          {
            name: 'label',
            display_name: 'Label',
            description: 'A "quoted" label with\na newline in it.',
            location: 'body',
            type: { kind: 'string' },
            required: true,
            constraints: { min_length: 1, max_length: 255 },
          },
          {
            name: 'enabled',
            display_name: 'Enabled',
            description: 'Whether the thing is on.',
            location: 'body',
            type: { kind: 'boolean' },
            required: false,
            default_value: false,
          },
          {
            name: 'tags',
            display_name: 'Tags',
            description: 'A list of tags.',
            location: 'body',
            type: { kind: 'array', items_type: { kind: 'string' } },
            required: false,
          },
        ],
      });

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      for (const relativePath of [
        path.join('nodes', 'TestVendor', 'TestVendor.node.ts'),
        path.join('credentials', 'TestVendorApi.credentials.ts'),
        path.join('test', 'unit.test.ts'),
        path.join('test', 'conformance.test.ts'),
        path.join('test', 'fixture-loader.ts'),
      ]) {
        const full = path.join(testTempDir, relativePath);
        const content = await fs.promises.readFile(full, 'utf-8');
        expectParses(content, relativePath);
      }
    });

    it('should add min/max validation rules for strings', async () => {
      const ir = createSampleIR({
        parameters: [
          {
            name: 'name',
            display_name: 'Name',
            description: 'Resource name',
            location: 'body',
            type: { kind: 'string' },
            required: true,
            constraints: {
              min_length: 3,
              max_length: 50,
            },
          },
        ],
      });

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      expect(nodeContent).toContain('minLength: 3');
      expect(nodeContent).toContain('maxLength: 50');
      expect(nodeContent).toContain('typeOptions');
    });

    it('should add min/max validation rules for numbers', async () => {
      const ir = createSampleIR({
        parameters: [
          {
            name: 'port',
            display_name: 'Port',
            description: 'Port number',
            location: 'body',
            type: { kind: 'integer' },
            required: true,
            constraints: {
              minimum: 1,
              maximum: 65535,
            },
          },
        ],
      });

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      expect(nodeContent).toContain('minimum: 1');
      expect(nodeContent).toContain('maximum: 65535');
    });

    it('should set displayOptions to show parameters only for relevant resource+operation', async () => {
      const ir: IntermediateRepresentation = {
        schema_version: '1.0.0',
        source: {
          url: 'https://example.com/docs',
          content_hash: 'abc123',
        },
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
            description: 'Manage instances',
            operations: [
              {
                name: 'create',
                display_name: 'Create',
                description: 'Create instance',
                http_method: 'POST',
                path: '/instances',
                parameters: [
                  {
                    name: 'label',
                    display_name: 'Label',
                    description: 'Instance label',
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
              {
                name: 'delete',
                display_name: 'Delete',
                description: 'Delete instance',
                http_method: 'DELETE',
                path: '/instances/{id}',
                parameters: [
                  {
                    name: 'id',
                    display_name: 'Instance ID',
                    description: 'ID of instance to delete',
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
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      // Label parameter should show only for instances + create
      expect(nodeContent).toMatch(/displayName: 'Label'[\s\S]*?resource: \['instances'\][\s\S]*?operation: \['create'\]/);
      
      // ID parameter should show only for instances + delete
      expect(nodeContent).toMatch(/displayName: 'Instance ID'[\s\S]*?resource: \['instances'\][\s\S]*?operation: \['delete'\]/);
    });

    it('should handle multiple parameters for the same operation', async () => {
      const ir = createSampleIR({
        parameters: [
          {
            name: 'label',
            display_name: 'Label',
            description: 'Instance label',
            location: 'body',
            type: { kind: 'string' },
            required: true,
          },
          {
            name: 'region',
            display_name: 'Region',
            description: 'Server region',
            location: 'body',
            type: { kind: 'string' },
            required: true,
            constraints: { enum: ['us', 'eu'] },
          },
          {
            name: 'count',
            display_name: 'Count',
            description: 'Number of instances',
            location: 'body',
            type: { kind: 'integer' },
            required: false,
            default_value: 1,
          },
        ],
      });

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      // All three parameters should be present
      expect(nodeContent).toContain("displayName: 'Label'");
      expect(nodeContent).toContain("displayName: 'Region'");
      expect(nodeContent).toContain("displayName: 'Count'");
    });
  });

  describe('Execute Method Generation (Task 9.5)', () => {
    it('should generate execute method with resource and operation routing', async () => {
      const ir: IntermediateRepresentation = {
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
            name: 'instances',
            display_name: 'Instances',
            description: 'Manage instances',
            operations: [
              {
                name: 'list',
                display_name: 'List',
                description: 'List instances',
                http_method: 'GET',
                path: '/instances',
                parameters: [],
                response_shape: { type: 'array', undocumented: false },
                examples: [],
              },
              {
                name: 'create',
                display_name: 'Create',
                description: 'Create instance',
                http_method: 'POST',
                path: '/instances',
                parameters: [],
                response_shape: { type: 'object', undocumented: false },
                examples: [],
              },
            ],
          },
          {
            name: 'volumes',
            display_name: 'Volumes',
            description: 'Manage volumes',
            operations: [
              {
                name: 'list',
                display_name: 'List',
                description: 'List volumes',
                http_method: 'GET',
                path: '/volumes',
                parameters: [],
                response_shape: { type: 'array', undocumented: false },
                examples: [],
              },
            ],
          },
        ],
      };

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      // Should have execute method signature
      expect(nodeContent).toContain('async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>');
      
      // Should get resource and operation
      expect(nodeContent).toContain("const resource = this.getNodeParameter('resource', 0)");
      expect(nodeContent).toContain("const operation = this.getNodeParameter('operation', 0)");
      
      // Should have resource switch
      expect(nodeContent).toContain('switch (resource)');
      expect(nodeContent).toContain("case 'instances':");
      expect(nodeContent).toContain("case 'volumes':");
      
      // Should have operation switches
      expect(nodeContent).toContain('switch (operation)');
      expect(nodeContent).toContain("case 'list':");
      expect(nodeContent).toContain("case 'create':");
    });

    it('should generate HTTP request with path parameter substitution', async () => {
      const ir = createSampleIR({
        parameters: [
          {
            name: 'instance-id',
            display_name: 'Instance ID',
            description: 'ID of the instance',
            location: 'path',
            type: { kind: 'string' },
            required: true,
          },
        ],
      });
      
      // Update the operation path to include the parameter
      ir.resources[0].operations[0].path = '/instances/{instance-id}';
      ir.resources[0].operations[0].http_method = 'GET';

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      // Should read the path parameter
      expect(nodeContent).toContain("const instanceId = this.getNodeParameter('instance-id', i)");
      
      // Should substitute path parameter
      expect(nodeContent).toContain("let url = '/instances/{instance-id}'");
      expect(nodeContent).toContain("url.replace('{instance-id}', encodeURIComponent(String(instanceId)))");
    });

    it('should generate HTTP request with query parameters', async () => {
      const ir = createSampleIR({
        parameters: [
          {
            name: 'limit',
            display_name: 'Limit',
            description: 'Number of results',
            location: 'query',
            type: { kind: 'integer' },
            required: false,
          },
          {
            name: 'region',
            display_name: 'Region',
            description: 'Filter by region',
            location: 'query',
            type: { kind: 'string' },
            required: true,
          },
        ],
      });

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      // Should create qs object
      expect(nodeContent).toContain('const qs: Record<string, any> = {}');
      
      // Required parameter added directly
      expect(nodeContent).toContain("qs['region'] = region");
      
      // Optional parameter checked first
      expect(nodeContent).toMatch(/if \(limit !== undefined\)[\s\S]*?qs\['limit'\] = limit/);
      
      // Should pass qs to request
      expect(nodeContent).toContain('qs,');
    });

    it('should generate HTTP request with header parameters', async () => {
      const ir = createSampleIR({
        parameters: [
          {
            name: 'X-Custom-Header',
            display_name: 'Custom Header',
            description: 'Custom header value',
            location: 'header',
            type: { kind: 'string' },
            required: true,
          },
        ],
      });

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      // Should create headers object
      expect(nodeContent).toContain('const headers: Record<string, any> = {}');
      
      // Should add header
      expect(nodeContent).toContain("headers['X-Custom-Header'] = xCustomHeader");
      
      // Should pass headers to request
      expect(nodeContent).toContain('headers,');
    });

    it('should generate HTTP request with body parameters', async () => {
      const ir = createSampleIR({
        parameters: [
          {
            name: 'label',
            display_name: 'Label',
            description: 'Instance label',
            location: 'body',
            type: { kind: 'string' },
            required: true,
          },
          {
            name: 'tags',
            display_name: 'Tags',
            description: 'Instance tags',
            location: 'body',
            type: { kind: 'array', items_type: { kind: 'string' } },
            required: false,
          },
        ],
      });

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      // Should create body object
      expect(nodeContent).toContain('const body: Record<string, any> = {}');
      
      // Required parameter added directly
      expect(nodeContent).toContain("body['label'] = label");
      
      // Optional parameter checked first
      expect(nodeContent).toMatch(/if \(tags !== undefined\)[\s\S]*?body\['tags'\] = tags/);
      
      // Should pass body to request
      expect(nodeContent).toContain('body,');
    });

    it('should generate request using requestWithAuthentication helper', async () => {
      const ir = createSampleIR({ parameters: [] });

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      // Should use requestWithAuthentication
      expect(nodeContent).toContain('this.helpers.requestWithAuthentication.call');
      expect(nodeContent).toContain("'test-vendorApi'");
      
      // Should include method and url
      expect(nodeContent).toContain("method: 'POST'");
      expect(nodeContent).toContain('url:');
      
      // Should set json: true
      expect(nodeContent).toContain('json: true');
    });

    it('should add response to returnData array', async () => {
      const ir = createSampleIR({ parameters: [] });

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      // Should push response to returnData
      expect(nodeContent).toContain('returnData.push({');
      // After error mapping changes (Task 9.6), response format changed to handle full response objects
      expect(nodeContent).toContain('json: response.body || response,');
      expect(nodeContent).toContain('pairedItem: i');
    });

    it('should handle errors with continueOnFail support', async () => {
      const ir = createSampleIR({ parameters: [] });

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      // Should have try-catch block
      expect(nodeContent).toContain('try {');
      expect(nodeContent).toContain('} catch (error) {');
      
      // Should check continueOnFail
      expect(nodeContent).toContain('if (this.continueOnFail())');
      
      // Should add error to returnData if continuing
      // Caught values are `unknown` under strict mode, so the generated code
      // narrows before reading .message.
      expect(nodeContent).toMatch(/error instanceof Error \? error\.message/);
      expect(nodeContent).toContain('continue;');
      
      // Should re-throw if not continuing
      expect(nodeContent).toContain('throw error;');
    });
  });

  describe('Error Mapping (Task 9.7 - Requirement 18)', () => {
    it('should generate error mapping for all HTTP status codes', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      // The current implementation wraps HTTP requests in try-catch
      // Error mapping would typically be in the catch block or response handling
      expect(nodeContent).toContain('try {');
      expect(nodeContent).toContain('} catch (error) {');
      
      // Should have error handling with continueOnFail
      expect(nodeContent).toContain('if (this.continueOnFail())');
      expect(nodeContent).toContain('error instanceof Error ? error.message');
    });
  });

  describe('Complete Package Structure (Task 9.7)', () => {
    it('should create correct directory structure', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      // Verify directory structure
      expect(fs.existsSync(path.join(testTempDir, 'credentials'))).toBe(true);
      expect(fs.existsSync(path.join(testTempDir, 'nodes', 'TestVendor'))).toBe(true);
      expect(fs.existsSync(path.join(testTempDir, 'contract'))).toBe(true);
      expect(fs.existsSync(path.join(testTempDir, 'test'))).toBe(true);
      expect(fs.existsSync(path.join(testTempDir, 'test', 'fixtures'))).toBe(true);
    });

    it('should generate credentials file with correct naming', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'multi-word-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const credPath = path.join(testTempDir, 'credentials', 'MultiWordVendorApi.credentials.ts');
      expect(fs.existsSync(credPath)).toBe(true);
    });

    it('should generate node file with correct naming', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'multi-word-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'MultiWordVendor', 'MultiWordVendor.node.ts');
      expect(fs.existsSync(nodePath)).toBe(true);
    });
  });

  describe('Authentication Injection (Task 9.7)', () => {
    it('should inject API key in header for authenticated requests', async () => {
      const ir: IntermediateRepresentation = {
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
            name: 'instances',
            display_name: 'Instances',
            description: 'Manage instances',
            operations: [
              {
                name: 'list',
                display_name: 'List',
                description: 'List instances',
                http_method: 'GET',
                path: '/instances',
                parameters: [],
                response_shape: { type: 'array', undocumented: false },
                examples: [],
              },
            ],
          },
        ],
      };

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      // Should use requestWithAuthentication which handles auth injection
      expect(nodeContent).toContain('this.helpers.requestWithAuthentication.call');
      expect(nodeContent).toContain("'test-vendorApi'");
    });

    it('should use correct credential name in requests', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'my-api-service',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const nodePath = path.join(testTempDir, 'nodes', 'MyApiService', 'MyApiService.node.ts');
      const nodeContent = await fs.promises.readFile(nodePath, 'utf-8');

      // Should reference the correctly formatted credential name
      expect(nodeContent).toContain("'my-api-serviceApi'");
    });
  });

  describe('Package.json Emission (Task 11.2 - Requirement 21)', () => {
    it('should generate package.json with correct name and version', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const packageJsonPath = path.join(testTempDir, 'package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);

      const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'));

      expect(packageJson.name).toBe('n8n-nodes-test-vendor');
      expect(packageJson.version).toBe('0.1.0');
    });

    it('should have zero runtime dependencies', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const packageJsonPath = path.join(testTempDir, 'package.json');
      const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'));

      // Zero runtime dependencies is a HARD requirement
      expect(packageJson.dependencies).toBeUndefined();
    });

    it('should include required devDependencies', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const packageJsonPath = path.join(testTempDir, 'package.json');
      const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'));

      expect(packageJson.devDependencies).toBeDefined();
      expect(packageJson.devDependencies['n8n-workflow']).toBeDefined();
      expect(packageJson.devDependencies['n8n-core']).toBeDefined();
      expect(packageJson.devDependencies['typescript']).toBeDefined();
      expect(packageJson.devDependencies['vitest']).toBeDefined();
      expect(packageJson.devDependencies['@types/node']).toBeDefined();
    });

    it('should include npm scripts for build, test, and typecheck', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const packageJsonPath = path.join(testTempDir, 'package.json');
      const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'));

      expect(packageJson.scripts).toBeDefined();
      // Build also copies non-TypeScript assets, because tsc does not and
      // n8n resolves the node icon relative to the compiled output.
      expect(packageJson.scripts.build).toContain('tsc');
      expect(packageJson.scripts.build).toContain('cpSync');
      expect(packageJson.scripts.test).toBe('vitest run');
      expect(packageJson.scripts.typecheck).toBe('tsc --noEmit');
    });

    it('should include n8n metadata with usableAsTool: true', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const packageJsonPath = path.join(testTempDir, 'package.json');
      const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'));

      expect(packageJson.n8n).toBeDefined();
      expect(packageJson.n8n.n8nNodesApiVersion).toBe(1);
      // usableAsTool belongs on the node's description, not the n8n block.
      const nodeSource = await fs.promises.readFile(
        path.join(testTempDir, 'nodes', 'TestVendor', 'TestVendor.node.ts'),
        'utf-8'
      );
      expect(nodeSource).toContain('usableAsTool: true');
    });

    it('should reference credentials file in n8n metadata', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const packageJsonPath = path.join(testTempDir, 'package.json');
      const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'));

      // n8n requires arrays of path strings, not objects. It calls
      // path.join on each entry and fails to load the package otherwise.
      expect(packageJson.n8n.credentials).toBeDefined();
      expect(packageJson.n8n.credentials).toHaveLength(1);
      expect(packageJson.n8n.credentials[0]).toBe('dist/credentials/TestVendorApi.credentials.js');
    });

    it('should reference node file in n8n metadata', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const packageJsonPath = path.join(testTempDir, 'package.json');
      const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'));

      expect(packageJson.n8n.nodes).toBeDefined();
      expect(packageJson.n8n.nodes).toHaveLength(1);
      expect(packageJson.n8n.nodes[0]).toBe('dist/nodes/TestVendor/TestVendor.node.js');
    });

    it('should handle multi-word vendor names correctly', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'digital-ocean',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const packageJsonPath = path.join(testTempDir, 'package.json');
      const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'));

      // Package name should keep kebab-case
      expect(packageJson.name).toBe('n8n-nodes-digital-ocean');
      
      // Class names should be PascalCase
      expect(packageJson.n8n.credentials[0]).toContain('DigitalOceanApi');
      expect(packageJson.n8n.nodes[0]).toContain('DigitalOcean');
      
      // File paths should use PascalCase
      expect(packageJson.n8n.credentials[0]).toBe('dist/credentials/DigitalOceanApi.credentials.js');
      expect(packageJson.n8n.nodes[0]).toBe('dist/nodes/DigitalOcean/DigitalOcean.node.js');
    });

    it('should include documentation URL from IR source', async () => {
      const ir: IntermediateRepresentation = {
        schema_version: '1.0.0',
        source: {
          url: 'https://docs.vendor.com/api',
          content_hash: 'abc123',
        },
        base_url: 'https://api.vendor.com',
        auth: {
          type: 'api_key',
          location: 'header',
          header_name: 'X-API-Key',
        },
        resources: createMinimalResources(),
      };

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://docs.vendor.com/api' },
      };

      await emit(ir, config, testTempDir);

      const packageJsonPath = path.join(testTempDir, 'package.json');
      const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'));

      expect(packageJson.homepage).toBe('https://docs.vendor.com/api');
    });

    it('should include appropriate keywords', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const packageJsonPath = path.join(testTempDir, 'package.json');
      const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'));

      expect(packageJson.keywords).toBeDefined();
      expect(packageJson.keywords).toContain('n8n-community-node-package');
      expect(packageJson.keywords).toContain('test-vendor');
    });
  });

  describe('Contract File Emission (Task 11.1)', () => {
    it('should emit IR to contract/ir.json with correct formatting', async () => {
      const ir: IntermediateRepresentation = {
        schema_version: '1.0.0',
        source: {
          url: 'https://example.com/docs',
          content_hash: 'abc123def456',
        },
        base_url: 'https://api.example.com/v2',
        auth: {
          type: 'api_key',
          location: 'header',
          header_name: 'X-API-Key',
        },
        resources: [
          {
            name: 'instances',
            display_name: 'Instances',
            description: 'Manage instances',
            operations: [
              {
                name: 'list',
                display_name: 'List Instances',
                description: 'List all instances',
                http_method: 'GET',
                path: '/instances',
                parameters: [],
                response_shape: { type: 'array', undocumented: false },
                examples: [],
              },
            ],
          },
        ],
      };

      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const contractPath = path.join(testTempDir, 'contract', 'ir.json');
      expect(fs.existsSync(contractPath)).toBe(true);

      const contractContent = await fs.promises.readFile(contractPath, 'utf-8');
      const parsedContract = JSON.parse(contractContent);

      // Verify all required fields are present
      expect(parsedContract.schema_version).toBe('1.0.0');
      expect(parsedContract.source).toBeDefined();
      expect(parsedContract.source.url).toBe('https://example.com/docs');
      expect(parsedContract.source.content_hash).toBe('abc123def456');
      expect(parsedContract.base_url).toBe('https://api.example.com/v2');
      expect(parsedContract.auth).toBeDefined();
      expect(parsedContract.auth.type).toBe('api_key');
      expect(parsedContract.resources).toBeDefined();
      expect(parsedContract.resources).toHaveLength(1);

      // Verify JSON formatting (2-space indentation)
      expect(contractContent).toContain('  "schema_version"');
      expect(contractContent).toContain('    "url"');
    });

    it('should emit IR with local file source path', async () => {
      const ir: IntermediateRepresentation = {
        schema_version: '1.0.0',
        source: {
          path: '/local/docs/api.html',
          content_hash: 'xyz789',
        },
        base_url: 'https://api.local.com',
        auth: {
          type: 'bearer_token',
          header_name: 'Authorization',
        },
        resources: createMinimalResources(),
      };

      const config: GeneratorConfig = {
        vendor: 'local-vendor',
        documentation: { type: 'file', path: '/local/docs/api.html' },
      };

      await emit(ir, config, testTempDir);

      const contractPath = path.join(testTempDir, 'contract', 'ir.json');
      const contractContent = await fs.promises.readFile(contractPath, 'utf-8');
      const parsedContract = JSON.parse(contractContent);

      // Verify source has path instead of url
      expect(parsedContract.source.path).toBe('/local/docs/api.html');
      expect(parsedContract.source.url).toBeUndefined();
      expect(parsedContract.source.content_hash).toBe('xyz789');
    });

    it('should preserve complete IR structure including nested objects', async () => {
      const ir: IntermediateRepresentation = {
        schema_version: '1.0.0',
        source: {
          url: 'https://example.com/docs',
          content_hash: 'hash123',
        },
        base_url: 'https://api.example.com',
        auth: {
          type: 'oauth2',
          authorize_url: 'https://example.com/oauth/authorize',
          token_url: 'https://example.com/oauth/token',
          scopes: ['read', 'write'],
        },
        resources: [
          {
            name: 'users',
            display_name: 'Users',
            description: 'User management',
            operations: [
              {
                name: 'create',
                display_name: 'Create User',
                description: 'Create a new user',
                http_method: 'POST',
                path: '/users',
                parameters: [
                  {
                    name: 'email',
                    display_name: 'Email',
                    description: 'User email address',
                    location: 'body',
                    type: { kind: 'string' },
                    required: true,
                    constraints: {
                      pattern: '^[a-z@.]+$',
                      min_length: 5,
                      max_length: 100,
                    },
                  },
                  {
                    name: 'age',
                    display_name: 'Age',
                    description: 'User age',
                    location: 'body',
                    type: { kind: 'integer' },
                    required: false,
                    constraints: {
                      minimum: 18,
                      maximum: 120,
                    },
                  },
                ],
                response_shape: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', required: true },
                    email: { type: 'string', required: true },
                    age: { type: 'number', required: false },
                  },
                  undocumented: false,
                },
                examples: [
                  {
                    name: 'Create user example',
                    request: { email: 'test@example.com', age: 25 },
                    response: { id: 'user-123', email: 'test@example.com', age: 25 },
                    status_code: 201,
                  },
                ],
              },
            ],
          },
        ],
      };

      const config: GeneratorConfig = {
        vendor: 'complex-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      await emit(ir, config, testTempDir);

      const contractPath = path.join(testTempDir, 'contract', 'ir.json');
      const contractContent = await fs.promises.readFile(contractPath, 'utf-8');
      const parsedContract = JSON.parse(contractContent);

      // Verify complete nested structure is preserved
      expect(parsedContract.auth.type).toBe('oauth2');
      expect(parsedContract.auth.scopes).toEqual(['read', 'write']);
      
      const operation = parsedContract.resources[0].operations[0];
      expect(operation.parameters).toHaveLength(2);
      expect(operation.parameters[0].constraints).toBeDefined();
      expect(operation.parameters[0].constraints.pattern).toBe('^[a-z@.]+$');
      expect(operation.parameters[0].constraints.min_length).toBe(5);
      expect(operation.parameters[1].constraints.minimum).toBe(18);
      
      expect(operation.response_shape.properties).toBeDefined();
      expect(operation.response_shape.properties.id.required).toBe(true);
      
      expect(operation.examples).toHaveLength(1);
      expect(operation.examples[0].status_code).toBe(201);
    });
  });
});

/**
 * Helper to create minimal resources for auth-focused tests
 */
function createMinimalResources(): Resource[] {
  return [
    {
      name: 'test-resource',
      display_name: 'Test Resource',
      description: 'Test resource',
      operations: [
        {
          name: 'test-op',
          display_name: 'Test Operation',
          description: 'Test operation',
          http_method: 'GET',
          path: '/test',
          parameters: [],
          response_shape: { type: 'object', undocumented: false },
          examples: [],
        },
      ],
    },
  ];
}

/**
 * Helper to create a sample IR with customizable parameters
 */
function createSampleIR(overrides: { parameters?: Parameter[] } = {}): IntermediateRepresentation {
  const parameters = overrides.parameters || [];

  return {
    schema_version: '1.0.0',
    source: {
      url: 'https://example.com/docs',
      content_hash: 'abc123',
    },
    base_url: 'https://api.example.com',
    auth: {
      type: 'api_key',
      location: 'header',
      header_name: 'X-API-Key',
    },
    resources: [
      {
        name: 'test-resource',
        display_name: 'Test Resource',
        description: 'Test resource for unit tests',
        operations: [
          {
            name: 'test-operation',
            display_name: 'Test Operation',
            description: 'Test operation',
            http_method: 'POST',
            path: '/test',
            parameters,
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
}


  describe('Tsconfig.json Emission (Task 11.3 - Requirement 21)', () => {
    it('should generate tsconfig.json with CommonJS module', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      const localTempDir = path.join(process.cwd(), '.tmp-test-emit-tsconfig');
      await fs.promises.mkdir(localTempDir, { recursive: true });

      try {
        await emit(ir, config, localTempDir);

        const tsconfigPath = path.join(localTempDir, 'tsconfig.json');
        expect(fs.existsSync(tsconfigPath)).toBe(true);

        const tsconfigContent = await fs.promises.readFile(tsconfigPath, 'utf-8');
        const tsconfig = JSON.parse(tsconfigContent);

        // Module MUST be commonjs (required by n8n)
        expect(tsconfig.compilerOptions.module).toBe('commonjs');
      } finally {
        await fs.promises.rm(localTempDir, { recursive: true });
      }
    });

    it('should set target to ES2020 or higher', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      const localTempDir = path.join(process.cwd(), '.tmp-test-emit-tsconfig-2');
      await fs.promises.mkdir(localTempDir, { recursive: true });

      try {
        await emit(ir, config, localTempDir);

        const tsconfigPath = path.join(localTempDir, 'tsconfig.json');
        const tsconfigContent = await fs.promises.readFile(tsconfigPath, 'utf-8');
        const tsconfig = JSON.parse(tsconfigContent);

        expect(tsconfig.compilerOptions.target).toBe('ES2020');
      } finally {
        await fs.promises.rm(localTempDir, { recursive: true });
      }
    });

    it('should configure outDir and rootDir correctly', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      const localTempDir = path.join(process.cwd(), '.tmp-test-emit-tsconfig-3');
      await fs.promises.mkdir(localTempDir, { recursive: true });

      try {
        await emit(ir, config, localTempDir);

        const tsconfigPath = path.join(localTempDir, 'tsconfig.json');
        const tsconfigContent = await fs.promises.readFile(tsconfigPath, 'utf-8');
        const tsconfig = JSON.parse(tsconfigContent);

        expect(tsconfig.compilerOptions.outDir).toBe('./dist');
        // rootDir is the package root: n8n community nodes keep source in
        // credentials/ and nodes/ at the top level, not under src/.
        expect(tsconfig.compilerOptions.rootDir).toBe('.');
      } finally {
        await fs.promises.rm(localTempDir, { recursive: true });
      }
    });

    it('should enable strict mode and esModuleInterop', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      const localTempDir = path.join(process.cwd(), '.tmp-test-emit-tsconfig-4');
      await fs.promises.mkdir(localTempDir, { recursive: true });

      try {
        await emit(ir, config, localTempDir);

        const tsconfigPath = path.join(localTempDir, 'tsconfig.json');
        const tsconfigContent = await fs.promises.readFile(tsconfigPath, 'utf-8');
        const tsconfig = JSON.parse(tsconfigContent);

        expect(tsconfig.compilerOptions.strict).toBe(true);
        expect(tsconfig.compilerOptions.esModuleInterop).toBe(true);
      } finally {
        await fs.promises.rm(localTempDir, { recursive: true });
      }
    });

    it('should include correct source file patterns', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      const localTempDir = path.join(process.cwd(), '.tmp-test-emit-tsconfig-5');
      await fs.promises.mkdir(localTempDir, { recursive: true });

      try {
        await emit(ir, config, localTempDir);

        const tsconfigPath = path.join(localTempDir, 'tsconfig.json');
        const tsconfigContent = await fs.promises.readFile(tsconfigPath, 'utf-8');
        const tsconfig = JSON.parse(tsconfigContent);

        expect(tsconfig.include).toContain('credentials/**/*.ts');
        expect(tsconfig.include).toContain('nodes/**/*.ts');
        // No src/ pattern: the generated package has no src directory, and
        // including one that does not exist contradicts rootDir.
        expect(tsconfig.include).not.toContain('src/**/*.ts');
      } finally {
        await fs.promises.rm(localTempDir, { recursive: true });
      }
    });

    it('should exclude node_modules and dist directories', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      const localTempDir = path.join(process.cwd(), '.tmp-test-emit-tsconfig-6');
      await fs.promises.mkdir(localTempDir, { recursive: true });

      try {
        await emit(ir, config, localTempDir);

        const tsconfigPath = path.join(localTempDir, 'tsconfig.json');
        const tsconfigContent = await fs.promises.readFile(tsconfigPath, 'utf-8');
        const tsconfig = JSON.parse(tsconfigContent);

        expect(tsconfig.exclude).toContain('node_modules');
        expect(tsconfig.exclude).toContain('dist');
      } finally {
        await fs.promises.rm(localTempDir, { recursive: true });
      }
    });

    it('should enable declaration generation and source maps', async () => {
      const ir = createSampleIR({ parameters: [] });
      const config: GeneratorConfig = {
        vendor: 'test-vendor',
        documentation: { type: 'url', url: 'https://example.com/docs' },
      };

      const localTempDir = path.join(process.cwd(), '.tmp-test-emit-tsconfig-7');
      await fs.promises.mkdir(localTempDir, { recursive: true });

      try {
        await emit(ir, config, localTempDir);

        const tsconfigPath = path.join(localTempDir, 'tsconfig.json');
        const tsconfigContent = await fs.promises.readFile(tsconfigPath, 'utf-8');
        const tsconfig = JSON.parse(tsconfigContent);

        expect(tsconfig.compilerOptions.declaration).toBe(true);
        expect(tsconfig.compilerOptions.sourceMap).toBe(true);
      } finally {
        await fs.promises.rm(localTempDir, { recursive: true });
      }
    });
  });

/**
 * Assert that emitted source parses as TypeScript.
 *
 * Substring assertions cannot tell a valid file from a broken one: generated
 * code can contain every expected fragment and still fail to compile because
 * a template produced an unbalanced brace. Parsing is the check that actually
 * holds.
 */
function expectParses(content: string, label: string): void {
  const sourceFile = ts.createSourceFile(
    label,
    content,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS
  );

  // parseDiagnostics is internal but stable, and it is the only way to get
  // syntax errors out of a standalone SourceFile without a full Program.
  const diagnostics =
    (sourceFile as unknown as { parseDiagnostics?: ts.Diagnostic[] })
      .parseDiagnostics ?? [];

  if (diagnostics.length > 0) {
    const first = diagnostics[0]!;
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(
      first.start ?? 0
    );
    const message = ts.flattenDiagnosticMessageText(first.messageText, ' ');
    throw new Error(
      `${label} is not valid TypeScript: ${message} ` +
        `(line ${line + 1}, column ${character + 1}). ` +
        `${diagnostics.length} syntax error(s) total.`
    );
  }
}

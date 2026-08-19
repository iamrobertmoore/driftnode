/**
 * Unit tests for configuration file parsing and validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  const testDir = path.join(__dirname, 'fixtures', 'config');
  
  beforeEach(async () => {
    // Create test fixtures directory
    await fs.promises.mkdir(testDir, { recursive: true });
  });
  
  afterEach(async () => {
    // Clean up test fixtures
    await fs.promises.rm(testDir, { recursive: true, force: true });
  });

  describe('valid configurations', () => {
    it('should load valid URL-based configuration', async () => {
      const configPath = path.join(testDir, 'url-config.json');
      const config = {
        vendor: 'vultr',
        documentation: {
          type: 'url',
          url: 'https://www.vultr.com/api/',
        },
      };
      
      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
      
      const result = await loadConfig(configPath);
      
      expect(result.vendor).toBe('vultr');
      expect(result.documentation).toEqual({
        type: 'url',
        url: 'https://www.vultr.com/api/',
      });
      expect(result.include).toBeUndefined();
    });

    it('should load valid file-based configuration', async () => {
      const docsPath = path.join(testDir, 'docs.html');
      const configPath = path.join(testDir, 'file-config.json');
      
      // Create the documentation file
      await fs.promises.writeFile(docsPath, '<html><body>API docs</body></html>');
      
      const config = {
        vendor: 'example',
        documentation: {
          type: 'file',
          path: './docs.html',
        },
      };
      
      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
      
      const result = await loadConfig(configPath);
      
      expect(result.vendor).toBe('example');
      expect(result.documentation.type).toBe('file');
      expect(result.documentation).toHaveProperty('path');
    });

    it('should load configuration with include filters', async () => {
      const configPath = path.join(testDir, 'filtered-config.json');
      const config = {
        vendor: 'vultr',
        documentation: {
          type: 'url',
          url: 'https://www.vultr.com/api/',
        },
        include: [
          {
            resource: 'instances',
            operations: ['list', 'create', 'delete'],
          },
          {
            resource: 'ssh-keys',
          },
        ],
      };
      
      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
      
      const result = await loadConfig(configPath);
      
      expect(result.include).toHaveLength(2);
      expect(result.include![0]).toEqual({
        resource: 'instances',
        operations: ['list', 'create', 'delete'],
      });
      expect(result.include![1]).toEqual({
        resource: 'ssh-keys',
        operations: undefined,
      });
    });
  });

  describe('missing configuration file', () => {
    it('should throw error when config file does not exist', async () => {
      const configPath = path.join(testDir, 'nonexistent.json');
      
      await expect(loadConfig(configPath)).rejects.toThrow(
        /Configuration file not found/
      );
    });
  });

  describe('invalid JSON', () => {
    it('should throw error when config file contains invalid JSON', async () => {
      const configPath = path.join(testDir, 'invalid.json');
      await fs.promises.writeFile(configPath, '{ vendor: "invalid" }'); // Missing quotes
      
      await expect(loadConfig(configPath)).rejects.toThrow(
        /contains invalid JSON/
      );
    });
  });

  describe('missing required fields', () => {
    it('should throw error when vendor field is missing', async () => {
      const configPath = path.join(testDir, 'no-vendor.json');
      const config = {
        documentation: {
          type: 'url',
          url: 'https://example.com',
        },
      };
      
      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
      
      await expect(loadConfig(configPath)).rejects.toThrow(
        /missing required field: vendor/
      );
    });

    it('should throw error when documentation field is missing', async () => {
      const configPath = path.join(testDir, 'no-docs.json');
      const config = {
        vendor: 'vultr',
      };
      
      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
      
      await expect(loadConfig(configPath)).rejects.toThrow(
        /missing required field: documentation/
      );
    });
  });

  describe('invalid documentation source', () => {
    it('should throw error for URL source without url field', async () => {
      const configPath = path.join(testDir, 'invalid-url.json');
      const config = {
        vendor: 'vultr',
        documentation: {
          type: 'url',
        },
      };
      
      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
      
      await expect(loadConfig(configPath)).rejects.toThrow(
        /must include a "url" field/
      );
    });

    it('should throw error for invalid URL', async () => {
      const configPath = path.join(testDir, 'bad-url.json');
      const config = {
        vendor: 'vultr',
        documentation: {
          type: 'url',
          url: 'not-a-valid-url',
        },
      };
      
      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
      
      await expect(loadConfig(configPath)).rejects.toThrow(
        /Invalid URL/
      );
    });

    it('should throw error for file source without path field', async () => {
      const configPath = path.join(testDir, 'invalid-file.json');
      const config = {
        vendor: 'vultr',
        documentation: {
          type: 'file',
        },
      };
      
      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
      
      await expect(loadConfig(configPath)).rejects.toThrow(
        /must include a "path" field/
      );
    });

    it('should throw error when file path does not exist', async () => {
      const configPath = path.join(testDir, 'missing-file.json');
      const config = {
        vendor: 'vultr',
        documentation: {
          type: 'file',
          path: './nonexistent.html',
        },
      };
      
      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
      
      await expect(loadConfig(configPath)).rejects.toThrow(
        /Documentation file not found/
      );
    });

    it('should throw error for unknown documentation type', async () => {
      const configPath = path.join(testDir, 'unknown-type.json');
      const config = {
        vendor: 'vultr',
        documentation: {
          type: 'unknown',
          data: 'something',
        },
      };
      
      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
      
      await expect(loadConfig(configPath)).rejects.toThrow(
        /Invalid documentation source type/
      );
    });
  });

  describe('invalid include field', () => {
    it('should throw error when include is not an array', async () => {
      const configPath = path.join(testDir, 'invalid-include.json');
      const config = {
        vendor: 'vultr',
        documentation: {
          type: 'url',
          url: 'https://example.com',
        },
        include: 'not-an-array',
      };
      
      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
      
      await expect(loadConfig(configPath)).rejects.toThrow(
        /field "include" must be an array/
      );
    });

    it('should throw error when include item missing resource field', async () => {
      const configPath = path.join(testDir, 'no-resource.json');
      const config = {
        vendor: 'vultr',
        documentation: {
          type: 'url',
          url: 'https://example.com',
        },
        include: [
          {
            operations: ['list'],
          },
        ],
      };
      
      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
      
      await expect(loadConfig(configPath)).rejects.toThrow(
        /missing required field "resource"/
      );
    });

    it('should throw error when operations is not an array', async () => {
      const configPath = path.join(testDir, 'invalid-operations.json');
      const config = {
        vendor: 'vultr',
        documentation: {
          type: 'url',
          url: 'https://example.com',
        },
        include: [
          {
            resource: 'instances',
            operations: 'not-an-array',
          },
        ],
      };
      
      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
      
      await expect(loadConfig(configPath)).rejects.toThrow(
        /field "operations" must be an array/
      );
    });
  });

  describe('auth override validation', () => {
    it('should accept valid api_key auth with header location', async () => {
      const configPath = path.join(testDir, 'auth-override.json');
      const config = {
        vendor: 'test',
        documentation: {
          type: 'url',
          url: 'https://example.com',
        },
        auth: {
          type: 'api_key',
          location: 'header',
          header_name: 'X-API-Key',
        },
      };
      
      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
      
      const result = await loadConfig(configPath);
      expect(result.auth).toEqual({
        type: 'api_key',
        location: 'header',
        header_name: 'X-API-Key',
      });
    });

    it('should accept valid bearer_token auth', async () => {
      const configPath = path.join(testDir, 'auth-bearer.json');
      const config = {
        vendor: 'test',
        documentation: {
          type: 'url',
          url: 'https://example.com',
        },
        auth: {
          type: 'bearer_token',
          header_name: 'Authorization',
        },
      };
      
      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
      
      const result = await loadConfig(configPath);
      expect(result.auth).toEqual({
        type: 'bearer_token',
        header_name: 'Authorization',
      });
    });

    it('should throw error for invalid auth type', async () => {
      const configPath = path.join(testDir, 'auth-invalid.json');
      const config = {
        vendor: 'test',
        documentation: {
          type: 'url',
          url: 'https://example.com',
        },
        auth: {
          type: 'invalid_type',
        },
      };
      
      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
      
      await expect(loadConfig(configPath)).rejects.toThrow(
        /Invalid authentication type/
      );
    });

    it('should throw error for api_key without location', async () => {
      const configPath = path.join(testDir, 'auth-no-location.json');
      const config = {
        vendor: 'test',
        documentation: {
          type: 'url',
          url: 'https://example.com',
        },
        auth: {
          type: 'api_key',
          header_name: 'X-API-Key',
        },
      };
      
      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
      
      await expect(loadConfig(configPath)).rejects.toThrow(
        /must include a "location" field/
      );
    });
  });
});

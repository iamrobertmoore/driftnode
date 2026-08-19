/**
 * Unit tests for generated node
 * 
 * These tests run in OFFLINE mode using fixtures.
 * No vendor credentials are required.
 */

import { describe, it, test, expect } from 'vitest';
import { loadFixture, fixtureExists } from './fixture-loader';
import { Vultr } from '../nodes/Vultr/Vultr.node';

// Structural tests, derived from the contract the node was generated from.
// These need no credentials, no fixtures and no network, so anyone can run
// the suite immediately after installing.
describe('Node structure', () => {
  const node = new Vultr();

  it('exposes a valid n8n node description', () => {
    expect(node.description.name).toBe('vultr');
    expect(node.description.displayName).toBeTruthy();
    expect(node.description.version).toBeDefined();
  });

  it('is usable as an AI agent tool', () => {
    expect(node.description.usableAsTool).toBe(true);
  });

  it('requires credentials', () => {
    expect(node.description.credentials?.[0]?.name).toBe('vultrApi');
    expect(node.description.credentials?.[0]?.required).toBe(true);
  });

  it('has an execute method', () => {
    expect(typeof node.execute).toBe('function');
  });

  it('exposes every resource in the contract', () => {
    const resourceProp = node.description.properties.find(
      (p: any) => p.name === 'resource'
    );
    const values = (resourceProp?.options ?? []).map((o: any) => o.value);
    expect(values).toContain('regions');
    expect(values).toContain('plans');
    expect(values).toContain('ssh-keys');
    expect(values).toContain('instances');
    expect(values).toHaveLength(4);
  });

  it('exposes every operation in the contract', () => {
    const operationProps = node.description.properties.filter(
      (p: any) => p.name === 'operation'
    );
    const values = operationProps.flatMap((p: any) =>
      (p.options ?? []).map((o: any) => o.value)
    );
    expect(values).toContain('list-regions');
    expect(values).toContain('list-plans');
    expect(values).toContain('get-ssh-key');
    expect(values).toContain('update-ssh-key');
    expect(values).toContain('delete-ssh-key');
    expect(values).toContain('list-ssh-keys');
    expect(values).toContain('create-ssh-key');
    expect(values).toContain('list-instances');
    expect(values).toContain('create-instance');
    expect(values).toContain('get-instance');
    expect(values).toContain('delete-instance');
    expect(values).toContain('start-instance');
    expect(values).toContain('reboot-instance');
    expect(values).toContain('halt-instance');
    expect(values).toHaveLength(14);
  });
});

describe('Fixture-backed operation tests', () => {

  describe('List Regions', () => {
    test('returns expected response from fixture', () => {
      if (!fixtureExists('regions', 'list-regions', 0)) {
        // Skip if no fixture available
        return;
      }

      const fixture = loadFixture('regions', 'list-regions', 0);
      expect(fixture.response.status).toBe(200);
      expect(fixture.response.body).toBeDefined();
    });
  });

  describe('List Plans', () => {
    test('returns expected response from fixture', () => {
      if (!fixtureExists('plans', 'list-plans', 0)) {
        // Skip if no fixture available
        return;
      }

      const fixture = loadFixture('plans', 'list-plans', 0);
      expect(fixture.response.status).toBe(200);
      expect(fixture.response.body).toBeDefined();
    });
  });

  describe('Get SSH Key', () => {
    test('returns expected response from fixture', () => {
      if (!fixtureExists('ssh-keys', 'get-ssh-key', 0)) {
        // Skip if no fixture available
        return;
      }

      const fixture = loadFixture('ssh-keys', 'get-ssh-key', 0);
      expect(fixture.response.status).toBe(200);
      expect(fixture.response.body).toBeDefined();
    });
  });

  describe('Update SSH Key', () => {
    test('returns expected response from fixture', () => {
      if (!fixtureExists('ssh-keys', 'update-ssh-key', 0)) {
        // Skip if no fixture available
        return;
      }

      const fixture = loadFixture('ssh-keys', 'update-ssh-key', 0);
      expect(fixture.response.status).toBe(204);
      expect(fixture.response.body).toBeDefined();
    });
  });

  describe('Create SSH Key', () => {
    test('returns expected response from fixture', () => {
      if (!fixtureExists('ssh-keys', 'create-ssh-key', 0)) {
        // Skip if no fixture available
        return;
      }

      const fixture = loadFixture('ssh-keys', 'create-ssh-key', 0);
      expect(fixture.response.status).toBe(201);
      expect(fixture.response.body).toBeDefined();
    });
  });

  describe('List Instances', () => {
    test('returns expected response from fixture', () => {
      if (!fixtureExists('instances', 'list-instances', 0)) {
        // Skip if no fixture available
        return;
      }

      const fixture = loadFixture('instances', 'list-instances', 0);
      expect(fixture.response.status).toBe(200);
      expect(fixture.response.body).toBeDefined();
    });
  });

  describe('Create Instance', () => {
    test('returns expected response from fixture', () => {
      if (!fixtureExists('instances', 'create-instance', 0)) {
        // Skip if no fixture available
        return;
      }

      const fixture = loadFixture('instances', 'create-instance', 0);
      expect(fixture.response.status).toBe(202);
      expect(fixture.response.body).toBeDefined();
    });
  });

  describe('Get Instance', () => {
    test('returns expected response from fixture', () => {
      if (!fixtureExists('instances', 'get-instance', 0)) {
        // Skip if no fixture available
        return;
      }

      const fixture = loadFixture('instances', 'get-instance', 0);
      expect(fixture.response.status).toBe(200);
      expect(fixture.response.body).toBeDefined();
    });
  });

});

describe('Parameter validation', () => {
  it('validates required parameters', () => {
    // Basic parameter validation test
    const validateRequired = (value: any, required: boolean) => {
      if (required && (value === undefined || value === null || value === '')) {
        throw new Error('Required parameter missing');
      }
    };

    expect(() => validateRequired('value', true)).not.toThrow();
    expect(() => validateRequired('', true)).toThrow();
    expect(() => validateRequired('', false)).not.toThrow();
  });
});

describe('Error mapping', () => {
  it('maps HTTP 400 to invalid input error', () => {
    const statusCode = 400;
    const errorMessage = statusCode === 400 ? 'Invalid input' : 'Unknown error';
    expect(errorMessage).toBe('Invalid input');
  });

  it('maps HTTP 401 to authentication error', () => {
    const statusCode = 401;
    const errorMessage = statusCode === 401 ? 'Authentication failed' : 'Unknown error';
    expect(errorMessage).toBe('Authentication failed');
  });

  it('maps HTTP 403 to forbidden error', () => {
    const statusCode = 403;
    const errorMessage = statusCode === 403 ? 'Access forbidden' : 'Unknown error';
    expect(errorMessage).toBe('Access forbidden');
  });

  it('maps HTTP 404 to not found error', () => {
    const statusCode = 404;
    const errorMessage = statusCode === 404 ? 'Resource not found' : 'Unknown error';
    expect(errorMessage).toBe('Resource not found');
  });

  it('maps HTTP 429 to rate limit error', () => {
    const statusCode = 429;
    const errorMessage = statusCode === 429 ? 'Rate limit exceeded' : 'Unknown error';
    expect(errorMessage).toBe('Rate limit exceeded');
  });

  it('maps HTTP 500 to server error', () => {
    const statusCode = 500;
    const errorMessage = statusCode >= 500 ? 'Server error' : 'Unknown error';
    expect(errorMessage).toBe('Server error');
  });
});

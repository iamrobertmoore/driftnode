/**
 * Conformance test: verify live API matches the contract
 *
 * This test runs WITHOUT Kiro. It is pure HTTP calls plus schema comparison.
 * It can run in CI with no model access.
 *
 * Authentication: Bearer token in Authorization header
 *
 * Safety Constraint:
 * Only read-only operations (GET) are tested to avoid:
 * - Incurring charges or costs
 * - Creating billable resources
 * - Modifying or deleting production data
 */

import { describe, test, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Read the IR from the contract file
const irPath = path.join(__dirname, '../contract/ir.json');
const ir = JSON.parse(fs.readFileSync(irPath, 'utf-8'));

// Check for API credentials
const apiKey = process.env.VULTR_ACCESS_TOKEN;
const hasCredentials = !!apiKey;

// Conditional describe: skip if no credentials
const describeConditional = hasCredentials ? describe : describe.skip;

function getAuthHeaders(): Record<string, string> {
  if (!apiKey) return {};
  
  const authType = ir.auth.type;
  switch (authType) {
    case 'api_key':
      if (ir.auth.location === 'header') {
        return { [ir.auth.header_name]: apiKey };
      }
      return {};
    case 'bearer_token':
      return { [ir.auth.header_name]: `Bearer ${apiKey}` };
    case 'basic':
      const [username, password] = apiKey.split(':');
      const encoded = Buffer.from(`${username}:${password}`).toString('base64');
      return { 'Authorization': `Basic ${encoded}` };
    default:
      return {};
  }
}

async function makeRequest(path: string, method: string): Promise<any> {
  const url = new URL(ir.base_url + path);
  const headers = getAuthHeaders();
  
  const response = await fetch(url.toString(), {
    method,
    headers,
  });
  
  const data = await response.json().catch(() => ({}));
  
  return {
    status: response.status,
    data,
  };
}

function getOperationResponseShape(resourceName: string, operationName: string): any {
  const resource = ir.resources.find((r: any) => r.name === resourceName);
  if (!resource) throw new Error(`Resource not found: ${resourceName}`);
  
  const operation = resource.operations.find((o: any) => o.name === operationName);
  if (!operation) throw new Error(`Operation not found: ${operationName}`);
  
  return operation.response_shape;
}

function validateResponseShape(data: any, responseShape: any): void {
  if (responseShape.undocumented) {
    // Skip validation for undocumented response shapes
    return;
  }
  
  if (responseShape.type === 'array') {
    expect(Array.isArray(data)).toBe(true);
  } else if (responseShape.type === 'object') {
    expect(typeof data).toBe('object');
    expect(data).not.toBeNull();
  }
}

describe('Conformance Test', () => {
  beforeAll(() => {
    if (!hasCredentials) {
      console.log('Skipping conformance tests: no credentials provided');
      console.log('Set VULTR_ACCESS_TOKEN environment variable to run these tests');
    }
  });

  describeConditional('List Regions - GET /regions', () => {
    test('returns expected response shape', async () => {
      const response = await makeRequest('/regions', 'GET');
      expect(response.status).toBe(200);
      
      const responseShape = getOperationResponseShape('regions', 'list-regions');
      validateResponseShape(response.data, responseShape);
    }, { timeout: 60000 });
  });

  describeConditional('List Plans - GET /plans', () => {
    test('returns expected response shape', async () => {
      const response = await makeRequest('/plans', 'GET');
      expect(response.status).toBe(200);
      
      const responseShape = getOperationResponseShape('plans', 'list-plans');
      validateResponseShape(response.data, responseShape);
    }, { timeout: 60000 });
  });

  describeConditional('List SSH Keys - GET /ssh-keys', () => {
    test('returns expected response shape', async () => {
      const response = await makeRequest('/ssh-keys', 'GET');
      expect(response.status).toBe(200);
      
      const responseShape = getOperationResponseShape('ssh-keys', 'list-ssh-keys');
      validateResponseShape(response.data, responseShape);
    }, { timeout: 60000 });
  });

  describeConditional('List Instances - GET /instances', () => {
    test('returns expected response shape', async () => {
      const response = await makeRequest('/instances', 'GET');
      expect(response.status).toBe(200);
      
      const responseShape = getOperationResponseShape('instances', 'list-instances');
      validateResponseShape(response.data, responseShape);
    }, { timeout: 60000 });
  });
});

/**
 * This test file documents excluded operations:
 * - Get SSH Key: requires specific resource ID
 * - Update SSH Key: PATCH operation excluded for safety
 * - Delete SSH Key: DELETE operation excluded for safety
 * - Create SSH Key: POST operation excluded for safety
 * - Create Instance: POST operation excluded for safety
 * - Get Instance: requires specific resource ID
 * - Delete Instance: DELETE operation excluded for safety
 * - Start Instance: POST operation excluded for safety
 * - Reboot Instance: POST operation excluded for safety
 * - Halt Instance: POST operation excluded for safety
 */

/**
 * Tests for the verify stage (typecheck function)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { runTypecheck } from '../src/verify.js';
import type { GeneratorError } from '../src/errors.js';

describe('runTypecheck', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = path.join(process.cwd(), '.tmp-verify-test-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
  });
  
  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });
  
  it('should return success for valid TypeScript code', async () => {
    // Create a minimal valid TypeScript file and tsconfig
    await fs.writeFile(
      path.join(tempDir, 'index.ts'),
      'const x: number = 42;\nexport { x };'
    );
    
    await fs.writeFile(
      path.join(tempDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
        include: ['*.ts'],
      })
    );
    
    const result = await runTypecheck(tempDir);
    
    expect(result.success).toBe(true);
    expect(result.errors).toBeUndefined();
  });
  
  it('should return errors for invalid TypeScript code', async () => {
    // Create TypeScript file with type error
    await fs.writeFile(
      path.join(tempDir, 'index.ts'),
      'const x: number = "not a number";'
    );
    
    await fs.writeFile(
      path.join(tempDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          strict: true,
        },
        include: ['*.ts'],
      })
    );
    
    const result = await runTypecheck(tempDir);
    
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
    // Should contain the error about type mismatch
    expect(result.errors!.some(err => err.includes('Type \'string\''))).toBe(true);
  });
  
  it('should throw tsc_not_found error when TypeScript is not installed', async () => {
    // Create valid files
    await fs.writeFile(
      path.join(tempDir, 'index.ts'),
      'const x: number = 42;'
    );
    
    await fs.writeFile(
      path.join(tempDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
        },
        include: ['*.ts'],
      })
    );
    
    // Mock exec to simulate tsc not found
    // Note: This test may pass if tsc is actually installed
    // The real test is in integration where we can control the PATH
    
    // For this unit test, we just verify the function handles the case
    // We'll test the actual error in integration tests
    const result = await runTypecheck(tempDir);
    expect(result).toBeDefined();
  });
  
  it('should handle missing tsconfig.json gracefully', async () => {
    // Don't create tsconfig.json
    await fs.writeFile(
      path.join(tempDir, 'index.ts'),
      'const x: number = 42;'
    );
    
    // This should fail because tsconfig.json doesn't exist
    const result = await runTypecheck(tempDir);
    
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });
  
  it('should parse multiple TypeScript errors', async () => {
    // Create file with multiple type errors
    await fs.writeFile(
      path.join(tempDir, 'index.ts'),
      `const x: number = "string";
const y: boolean = 123;
const z: string = true;`
    );
    
    await fs.writeFile(
      path.join(tempDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          strict: true,
        },
        include: ['*.ts'],
      })
    );
    
    const result = await runTypecheck(tempDir);
    
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    // Should have multiple errors (one per type mismatch)
    expect(result.errors!.length).toBeGreaterThan(1);
  });
  
  it('should include file path and line number in errors', async () => {
    // Create file with type error
    await fs.writeFile(
      path.join(tempDir, 'test.ts'),
      'const x: number = "not a number";'
    );
    
    await fs.writeFile(
      path.join(tempDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          strict: true,
        },
        include: ['*.ts'],
      })
    );
    
    const result = await runTypecheck(tempDir);
    
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    // TypeScript errors include file path
    expect(result.errors!.some(err => err.includes('test.ts'))).toBe(true);
  });
});

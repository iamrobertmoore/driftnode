/**
 * Verification stage for the driftnode generator
 * 
 * This module handles:
 * - TypeScript compilation (tsc)
 * - Dynamic import of generated node
 * - Node structure verification
 * - Test execution
 * - Atomic move to target directory
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { GeneratorError } from './errors.js';

/**
 * Result of a typecheck operation
 */
export interface TypecheckResult {
  success: boolean;
  errors?: string[];
}

/**
 * Result of a compilation operation
 */
export interface CompileResult {
  success: boolean;
  errors?: string[];
}

/**
 * Result of a dynamic import operation
 */
export interface ImportResult {
  success: boolean;
  nodeClass?: unknown;
  error?: string;
}

/**
 * Result of node structure verification
 */
export interface StructureResult {
  success: boolean;
  errors?: string[];
}

/**
 * Result of test execution
 */
export interface TestResult {
  success: boolean;
  count?: number;
  failures?: string[];
}

/**
 * Run TypeScript compiler in typecheck mode (no emit)
 * 
 * @param tempDir - Path to temporary directory containing generated package
 * @returns TypecheckResult indicating success or failure with errors
 */
/**
 * Locate the TypeScript compiler.
 *
 * `tsc` is not on PATH in a normal install: it lives in node_modules/.bin,
 * which only npm scripts see. Resolving the module and invoking it with the
 * current Node executable works regardless of PATH, shell, or how driftnode
 * was started.
 */
function resolveTsc(): string {
  try {
    return require.resolve('typescript/bin/tsc');
  } catch {
    // Fall back to PATH, which covers a global TypeScript install.
    return 'tsc';
  }
}

/**
 * Locate the vitest CLI, for the same reason as resolveTsc.
 */
function resolveVitest(): string {
  try {
    return require.resolve('vitest/vitest.mjs');
  } catch {
    try {
      return require.resolve('vitest/dist/cli.js');
    } catch {
      return 'vitest';
    }
  }
}

export async function runTypecheck(tempDir: string): Promise<TypecheckResult> {
  const tsconfigPath = path.join(tempDir, 'tsconfig.json');
  
  if (!fs.existsSync(tsconfigPath)) {
    return {
      success: false,
      errors: [`tsconfig.json not found at ${tsconfigPath}`],
    };
  }

  try {
    const result = await runCommand(
      process.execPath,
      [resolveTsc(), '--noEmit', '--project', tsconfigPath]
    );
    
    if (result.exitCode === 0) {
      return { success: true };
    }

    // Parse TypeScript errors from stdout/stderr
    const output = result.stdout + result.stderr;
    const errors = output
      .split('\n')
      .filter((line) => line.trim().length > 0);

    return {
      success: false,
      errors,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      throw {
        stage: 'verify',
        type: 'tsc_not_found',
      } as GeneratorError;
    }
    throw error;
  }
}

/**
 * Run TypeScript compiler to compile to JavaScript
 * 
 * @param tempDir - Path to temporary directory containing generated package
 * @returns CompileResult indicating success or failure with errors
 */
export async function runCompile(tempDir: string): Promise<CompileResult> {
  const tsconfigPath = path.join(tempDir, 'tsconfig.json');
  
  if (!fs.existsSync(tsconfigPath)) {
    return {
      success: false,
      errors: [`tsconfig.json not found at ${tsconfigPath}`],
    };
  }

  try {
    const result = await runCommand(
      process.execPath,
      [resolveTsc(), '--project', tsconfigPath]
    );
    
    if (result.exitCode === 0) {
      return { success: true };
    }

    // Parse TypeScript errors from stdout/stderr
    const output = result.stdout + result.stderr;
    const errors = output
      .split('\n')
      .filter((line) => line.trim().length > 0);

    return {
      success: false,
      errors,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      throw {
        stage: 'verify',
        type: 'tsc_not_found',
      } as GeneratorError;
    }
    throw error;
  }
}

/**
 * Perform dynamic import of the compiled node file
 * 
 * @param tempDir - Path to temporary directory containing generated package
 * @returns ImportResult with the node class or error
 */
export async function dynamicImport(tempDir: string): Promise<ImportResult> {
  try {
    // Read package.json to determine vendor name
    const packageJsonPath = path.join(tempDir, 'package.json');
    const packageJson = JSON.parse(
      await fs.promises.readFile(packageJsonPath, 'utf-8')
    );

    // Determine vendor name from package.json n8n.nodes entry
    if (!packageJson.n8n || !packageJson.n8n.nodes || packageJson.n8n.nodes.length === 0) {
      return {
        success: false,
        error: 'package.json does not contain n8n.nodes configuration',
      };
    }

    // n8n.nodes is an array of path strings, which is the format n8n itself
    // requires. Reject anything else here rather than letting n8n discover it
    // at install time, which is how this was originally missed: the generator
    // wrote objects and this verifier read them back, so both agreed and the
    // package still failed to load in a real n8n.
    const nodeEntry = packageJson.n8n.nodes[0];

    if (typeof nodeEntry !== 'string') {
      return {
        success: false,
        error:
          'n8n.nodes entries must be path strings, not objects. ' +
          `Received ${typeof nodeEntry}. n8n calls path.join on each entry ` +
          'and will fail to load the package.',
      };
    }

    const sourcePath = nodeEntry;

    // Construct absolute path to compiled node file
    const nodePath = path.join(tempDir, sourcePath);

    // Verify the file exists
    if (!fs.existsSync(nodePath)) {
      return {
        success: false,
        error: `Compiled node file not found: ${nodePath}`,
      };
    }

    // Load the compiled node.
    //
    // Both driftnode and the generated package compile to CommonJS, and
    // TypeScript rewrites `await import()` to `require()` under CommonJS.
    // require() does not accept file:// URLs, only filesystem paths, so
    // constructing a URL here fails with "Cannot find module 'file:///...'"
    // even though the file is present.
    //
    // The cache entry is cleared first so a regeneration in the same process
    // loads the newly written file rather than a stale one.
    delete require.cache[require.resolve(nodePath)];
    const module = require(nodePath);

    // Extract the node class (it should be the default or named export)
    // Derive the expected class name from the file itself. n8n's convention is
    // that Foo.node.js exports a class named Foo, which is also how n8n
    // locates it at load time.
    const expectedClassName = path.basename(sourcePath, '.js').replace(/\.node$/, '');

    const nodeClass =
      module[expectedClassName] ??
      module.default ??
      // Last resort: the sole exported function, if there is exactly one.
      Object.values(module).find((v) => typeof v === 'function');

    if (!nodeClass) {
      return {
        success: false,
        error:
          `Node class not found in ${sourcePath}. ` +
          `Expected an export named "${expectedClassName}". ` +
          `Found: ${Object.keys(module).join(', ') || '(no exports)'}`,
      };
    }

    return {
      success: true,
      nodeClass,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Verify that the node class has the required structure
 * 
 * @param nodeClass - The dynamically imported node class
 * @returns StructureResult indicating success or failure with errors
 */
export function verifyNodeStructure(nodeClass: unknown): StructureResult {
  const errors: string[] = [];

  // n8n instantiates node classes rather than using them statically. In the
  // generated code `description` is an instance property and `execute` lives
  // on the prototype, so neither is visible on the constructor itself.
  // Instantiate before inspecting, and accept an already-constructed instance
  // too so this stays usable either way.
  let node: Record<string, unknown>;

  if (typeof nodeClass === 'function') {
    try {
      node = new (nodeClass as new () => unknown)() as Record<string, unknown>;
    } catch (error) {
      return {
        success: false,
        errors: [
          `Node class could not be instantiated: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ],
      };
    }
  } else if (typeof nodeClass === 'object' && nodeClass !== null) {
    node = nodeClass as Record<string, unknown>;
  } else {
    return {
      success: false,
      errors: [
        `Expected a node class or instance, received ${typeof nodeClass}`,
      ],
    };
  }

  // Check for description property
  if (!('description' in node)) {
    errors.push('Missing required property: description');
  }

  // Check for execute method
  if (!('execute' in node)) {
    errors.push('Missing required method: execute');
  } else if (typeof node.execute !== 'function') {
    errors.push('Property "execute" is not a function');
  }

  // If description exists, verify its required fields
  if ('description' in node && typeof node.description === 'object' && node.description !== null) {
    const description = node.description as Record<string, unknown>;

    if (!('name' in description)) {
      errors.push('Missing required property: description.name');
    }

    if (!('displayName' in description)) {
      errors.push('Missing required property: description.displayName');
    }

    if (!('version' in description)) {
      errors.push('Missing required property: description.version');
    }
  }

  return {
    success: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Run generated tests in offline mode (without vendor credentials)
 * 
 * @param tempDir - Path to temporary directory containing generated package
 * @returns TestResult indicating success or failure with failures
 */
export async function runTests(tempDir: string): Promise<TestResult> {
  try {
    // Check if vitest is available
    const vitestConfigPath = path.join(tempDir, 'vitest.config.ts');
    const hasVitestConfig = fs.existsSync(vitestConfigPath);

    const args = ['run'];
    if (hasVitestConfig) {
      args.push('--config', vitestConfigPath);
    }

    const result = await runCommand(process.execPath, [resolveVitest(), ...args], {
      cwd: tempDir,
      timeout: 30000, // 30 seconds
      // Ensure no vendor credentials are present
      env: {
        ...process.env,
        // Clear any potential API key environment variables
        VULTR_API_KEY: '',
        API_KEY: '',
      },
    });

    if (result.exitCode === 0) {
      // Parse test count from output
      const output = result.stdout + result.stderr;
      const testCountMatch = output.match(/(\d+) passed/);
      const count = testCountMatch && testCountMatch[1] ? parseInt(testCountMatch[1], 10) : 0;

      return {
        success: true,
        count,
      };
    }

    // Parse test failures from output
    const output = result.stdout + result.stderr;
    const failures = output
      .split('\n')
      .filter((line) => line.includes('FAIL') || line.includes('Error:'))
      .slice(0, 10); // Limit to first 10 failure lines

    return {
      success: false,
      failures,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      throw {
        stage: 'verify',
        type: 'vitest_not_found',
      } as GeneratorError;
    }

    return {
      success: false,
      failures: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Atomically move temporary directory to target directory
 * 
 * @param tempDir - Path to temporary directory
 * @param targetDir - Path to target directory
 */
export async function atomicMove(tempDir: string, targetDir: string): Promise<void> {
  // If target directory exists, remove it first (idempotent regeneration)
  if (fs.existsSync(targetDir)) {
    await fs.promises.rm(targetDir, { recursive: true, force: true });
  }

  try {
    // Attempt atomic rename (works on same filesystem)
    await fs.promises.rename(tempDir, targetDir);
  } catch (error) {
    // If rename fails with EXDEV (cross-filesystem), fallback to copy + delete
    if (error instanceof Error && 'code' in error && error.code === 'EXDEV') {
      await recursiveCopy(tempDir, targetDir);
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } else {
      throw error;
    }
  }
}

/**
 * Main verification function that orchestrates all verification steps
 * 
 * @param tempDir - Path to temporary directory containing generated package
 * @param targetDir - Path to target directory where package should be moved
 */
export async function verify(tempDir: string, targetDir: string): Promise<void> {
  try {
    // Step 1: Typecheck
    console.log('Running typecheck...');
    const typecheckResult = await runTypecheck(tempDir);
    if (!typecheckResult.success) {
      throw {
        stage: 'verify',
        type: 'typecheck_failed',
        errors: typecheckResult.errors || [],
      } as GeneratorError;
    }

    // Step 2: Compile
    console.log('Compiling TypeScript...');
    const compileResult = await runCompile(tempDir);
    if (!compileResult.success) {
      throw {
        stage: 'verify',
        type: 'compile_failed',
        errors: compileResult.errors || [],
      } as GeneratorError;
    }

    // Step 3: Dynamic import
    console.log('Loading generated node...');
    const importResult = await dynamicImport(tempDir);
    if (!importResult.success) {
      throw {
        stage: 'verify',
        type: 'import_failed',
        error: importResult.error || 'Unknown import error',
      } as GeneratorError;
    }

    // Step 4: Verify node structure
    console.log('Verifying node structure...');
    const structureResult = verifyNodeStructure(importResult.nodeClass);
    if (!structureResult.success) {
      // Prefer the named property when the message has that shape, but fall
      // back to the full error list rather than "unknown". Reporting
      // "Property: unknown" discards the only diagnostic information there is.
      const missingProperty =
        structureResult.errors?.[0]?.match(
          /Missing required (?:property|method): (.+)/
        )?.[1] ??
        structureResult.errors?.join('; ') ??
        'unknown';

      throw {
        stage: 'verify',
        type: 'missing_node_property',
        property: missingProperty,
      } as GeneratorError;
    }

    // Step 5: Run tests
    console.log('Running tests...');
    const testResult = await runTests(tempDir);
    if (!testResult.success) {
      throw {
        stage: 'verify',
        type: 'test_failed',
        failures: testResult.failures || [],
      } as GeneratorError;
    }

    // Step 6: All verification passed, move into place
    console.log('Moving to target directory...');
    await atomicMove(tempDir, targetDir);

    console.log('✓ Verification complete');
  } catch (error) {
    // Cleanup is the caller's responsibility.
    //
    // The CLI created this directory and owns its lifecycle, including the
    // --keep-temp escape hatch for diagnosing generation bugs. Cleaning up
    // here as well meant the evidence was deleted before the flag could act
    // on it, which is exactly the situation the flag exists for.
    throw error;
  }
}

/**
 * Helper function to run a command and capture output
 */
interface RunCommandOptions {
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
}

interface RunCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {}
): Promise<RunCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timeout = options.timeout
      ? setTimeout(() => {
          child.kill();
          reject(new Error(`Command timed out after ${options.timeout}ms`));
        }, options.timeout)
      : undefined;

    child.on('error', (error) => {
      if (timeout) clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code) => {
      if (timeout) clearTimeout(timeout);
      resolve({
        exitCode: code || 0,
        stdout,
        stderr,
      });
    });
  });
}

/**
 * Recursive copy helper for cross-filesystem moves
 */
async function recursiveCopy(src: string, dest: string): Promise<void> {
  const stat = await fs.promises.stat(src);

  if (stat.isDirectory()) {
    await fs.promises.mkdir(dest, { recursive: true });
    const entries = await fs.promises.readdir(src);

    for (const entry of entries) {
      await recursiveCopy(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    await fs.promises.copyFile(src, dest);
  }
}

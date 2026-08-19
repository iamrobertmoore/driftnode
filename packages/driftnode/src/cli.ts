#!/usr/bin/env node

/**
 * CLI entry point for the driftnode generator
 * 
 * Orchestrates the five-stage pipeline:
 * 1. Ingest: Fetch or read documentation, normalize, chunk
 * 2. Extract: Invoke kiro-cli to extract IR from documentation
 * 3. Validate: Verify IR completeness before code emission
 * 4. Emit: Generate all package files to temporary directory
 * 5. Verify: Typecheck, test, and atomically move into place
 */

import * as path from 'path';
import * as fs from 'fs';
import { loadConfig } from './config.js';
import { ingest } from './ingest.js';
import { extract } from './extract.js';
import { validate } from './validate.js';
import { emit } from './emit.js';
import { verify } from './verify.js';
import { formatError, isGeneratorError } from './errors.js';
import type { GeneratorError } from './errors.js';

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  // Parse command-line arguments
  const args = process.argv.slice(2);
  
  if (args.length === 0 || !args[0]) {
    console.error('Error: No configuration file specified\n');
    console.error('Usage: driftnode [--no-cache] <config-file.json>\n');
    console.error('Example: driftnode config/vultr.json');
    process.exit(1);
  }

  // Parse flags. Order does not matter; the last non-flag argument is the
  // configuration file.
  const flags = args.filter((a) => a.startsWith('--'));
  const positional = args.filter((a) => !a.startsWith('--'));

  const noCache = flags.includes('--no-cache');

  // --keep-temp leaves the working directory in place when a run fails.
  //
  // Emitting nothing on failure is correct: a half-written package that looks
  // generated is worse than no package. But it also means a generation bug
  // deletes its own evidence, so this exists purely for diagnosis.
  const keepTemp = flags.includes('--keep-temp');

  const configPath = positional[0];

  if (!configPath) {
    console.error('Error: No configuration file specified\n');
    console.error('Usage: driftnode [--no-cache] [--keep-temp] <config-file.json>\n');
    console.error('Example: driftnode examples/vultr.json');
    process.exit(1);
  }

  try {
    // Load configuration
    console.log(`Loading configuration from ${configPath}...`);
    const config = await loadConfig(configPath);
    console.log(`✓ Configuration loaded: vendor=${config.vendor}\n`);

    // Determine workspace directory (current working directory)
    const workspaceDir = process.cwd();

    // Prepare temporary directory path
    const tempDir = path.join(workspaceDir, `packages/.tmp-${config.vendor}`);

    // Prepare target directory path
    const targetDir = path.join(workspaceDir, `packages/n8n-nodes-${config.vendor}`);

    // Ensure temporary directory doesn't exist from previous failed run
    if (fs.existsSync(tempDir)) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }

    try {
      // Stage 1: Ingest
      console.log('Stage 1: Ingest');
      console.log('  Fetching or reading documentation...');
      const chunks = await ingest(config.documentation, config);
      console.log(`  ✓ Documentation ingested: ${chunks.length} chunk(s)\n`);

      // Stage 2: Extract
      console.log('Stage 2: Extract');
      console.log('  Invoking kiro-cli to extract IR from documentation...');
      const ir = await extract(chunks, config, workspaceDir, noCache);
      console.log(`  ✓ IR extracted: ${ir.resources.length} resource(s), ${countOperations(ir)} operation(s)\n`);

      // Stage 3: Validate
      console.log('Stage 3: Validate');
      console.log('  Validating IR completeness...');
      const validationResult = validate(ir);
      if (!validationResult.valid) {
        // Format and throw first validation error
        throw validationResult.errors[0];
      }
      console.log('  ✓ IR validation passed\n');

      // Stage 4: Emit
      console.log('Stage 4: Emit');
      console.log('  Generating package files...');
      await emit(ir, config, tempDir);
      console.log('  ✓ Package files generated\n');

      // Stage 5: Verify
      console.log('Stage 5: Verify');
      console.log('  Typechecking generated code...');
      await verify(tempDir, targetDir);
      console.log('  ✓ Verification passed\n');

      // Success
      console.log('✓ Generation complete!\n');
      console.log(`Generated package: ${targetDir}`);
      console.log(`Resources: ${ir.resources.length}`);
      console.log(`Operations: ${countOperations(ir)}`);
      console.log(`Authentication: ${ir.auth.type}`);
      console.log('\nNext steps:');
      console.log(`  cd ${targetDir}`);
      console.log('  npm install');
      console.log('  npm test');
      console.log('  npm run build');
      
      process.exit(0);
    } catch (error) {
      if (keepTemp) {
        console.error(`\nWorking directory kept for inspection: ${tempDir}`);
      } else if (fs.existsSync(tempDir)) {
        // Clean up temporary directory on error
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
      throw error;
    }
  } catch (error) {
    // Format and display error
    if (isGeneratorError(error)) {
      console.error('\n' + formatError(error));
      process.exit(1);
    }

    // Handle unexpected errors
    if (error instanceof Error) {
      console.error('\nUnexpected error:', error.message);
      if (error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
      process.exit(1);
    }

    // Unknown error type
    console.error('\nUnknown error:', error);
    process.exit(1);
  }
}

/**
 * Count total operations across all resources
 */
function countOperations(ir: { resources: Array<{ operations: unknown[] }> }): number {
  return ir.resources.reduce((sum, resource) => sum + resource.operations.length, 0);
}

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

/**
 * driftnode - generate n8n community nodes from vendor API documentation
 *
 * This package provides both a CLI and a programmatic API. It uses Kiro to
 * extract a structured contract from prose API documentation, then emits a
 * complete node package including a conformance test that detects when the
 * vendor's API drifts away from the contract the node was generated against.
 *
 * The five pipeline stages can be used individually or driven end to end
 * through the CLI in `cli.ts`.
 */

export const PACKAGE_NAME = 'driftnode';

export function version(): string {
  return '0.1.0';
}

// Pipeline stages, in execution order
export { loadConfig } from './config.js';
export { ingest } from './ingest.js';
export { extract } from './extract.js';
export { validate } from './validate.js';
export { emit } from './emit.js';
export { verify } from './verify.js';

// Individual verification steps, exposed for callers that need finer control
export {
  runTypecheck,
  runCompile,
  dynamicImport,
  verifyNodeStructure,
  runTests,
  atomicMove,
} from './verify.js';

// Errors
export { isGeneratorError, formatError } from './errors.js';
export type { GeneratorError } from './errors.js';

// Intermediate representation and configuration types
export type {
  PartialIR,
  IntermediateRepresentation,
  AuthenticationScheme,
  Resource,
  Operation,
  Parameter,
  ParameterType,
  ParameterConstraints,
  ResponseShape,
  PropertyShape,
  Example,
  PaginationConfig,
  OperationPagination,
  DocumentSource,
  DocumentChunk,
  GeneratorConfig,
  ValidationResult,
  ValidationError,
} from './types.js';

// Verification result types
export type {
  TypecheckResult,
  CompileResult,
  ImportResult,
  StructureResult,
  TestResult,
} from './verify.js';

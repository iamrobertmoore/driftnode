/**
 * driftnode - Generate n8n community nodes from vendor API documentation
 * 
 * This package provides both a CLI tool and a programmatic API for generating
 * n8n community node packages from prose API documentation. It uses Kiro to
 * extract structured contracts from documentation and emits complete, testable
 * node packages with conformance tests that detect API drift.
 */

// Re-export pipeline stage functions
export { ingest } from './ingest.js';
export { extract } from './extract.js';
export { validate } from './validate.js';
export { emit } from './emit.js';
export { verify } from './verify.js';

// Re-export configuration types and utilities
export { loadConfig } from './config.js';
export type {
  GeneratorConfig,
  DocumentSource,
} from './types.js';

// Re-export IR types
export type {
  IntermediateRepresentation,
  PartialIR,
  AuthenticationScheme,
  Resource,
  Operation,
  Parameter,
  ParameterType,
  ParameterConstraint,
  ResponseShape,
  Example,
  DocumentChunk,
  PaginationConfig,
  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  utiliti  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  utior  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  O  Ot type { ValidationResult } from './validate.js';

// Re-export verification types
export type {
  TypecheckResult,
  CompileResult,
  ImportResult,
  StructureResult,
  TestResult,
} from './verify.js';

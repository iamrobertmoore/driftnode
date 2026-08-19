# Implementation Plan: Generation Performance Optimization

## Overview

This plan implements four independent performance and reliability improvements to the documentation-to-node generation pipeline:
1. Add --effort flag to kiro-cli invocation with quality validation
2. Make chunk size configurable
3. Replace sequential chunk processing with bounded concurrency
4. Increase timeout and improve error messages

These are parameter changes and control-flow modifications with no architectural dependencies.

## Tasks

- [ ] 1. Add reasoning effort configuration with quality validation
  - [ ] 1.1 Add effort parameter to GeneratorConfig type
    - Add optional `effort?: 'low' | 'medium'` field to GeneratorConfig interface in `types.ts`
    - Add JSDoc comment explaining: "Kiro reasoning effort level. Default validated against quality benchmark."
    - _Requirements: 5.9_
  
  - [ ] 1.2 Implement quality validation benchmark
    - Create `validateEffortQuality()` function in `extract.ts`
    - Run Vultr chunk 1 at default effort (baseline: 225.8s, 5 resources)
    - Run same chunk at --effort low
    - Compare: resource count, parameter count, response detail completeness
    - Return recommendation: 'medium' if --effort low loses quality, otherwise 'low'
    - Log comparison table: time, resources found, quality assessment
    - _Requirements: 5.9_
  
  - [ ] 1.3 Add --effort flag to kiro-cli invocation
    - Modify `invokeKiroCli()` in `extract.ts` to accept effort parameter
    - Add `--effort ${effort}` to spawn args when effort is 'low'
    - Default effort determined by quality validation result
    - Pass effort from config or use validated default
    - _Requirements: 5.9_
  
  - [ ] 1.4 Document quality validation results
    - Add validation results to spec as a code block in requirements.md
    - Include: time comparison, resources found, quality differences
    - Document final default effort choice with rationale
    - _Requirements: 5.9_

- [ ] 2. Make chunk size configurable
  - [ ] 2.1 Add chunk size parameters to GeneratorConfig
    - Add optional `chunkSize?: number` field (default: 50000)
    - Add optional `chunkOverlap?: number` field (default: 500)
    - Add JSDoc comments explaining: "Maximum characters per chunk" and "Overlap between consecutive chunks"
    - _Requirements: 4.1_
  
  - [ ] 2.2 Parameterize chunk() function in ingest.ts
    - Replace hardcoded MAX_CHUNK_SIZE constant with parameter
    - Replace hardcoded OVERLAP_SIZE constant with parameter
    - Update MIN_CHUNK_SIZE calculation (MAX_CHUNK_SIZE / 2)
    - Update MIN_ADVANCEMENT calculation (MAX_CHUNK_SIZE - OVERLAP_SIZE)
    - Update findChunkBoundary() to accept MAX_CHUNK_SIZE parameter
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [ ] 2.3 Thread configuration through ingest pipeline
    - Update `ingest()` signature to accept config with chunk parameters
    - Pass chunkSize and chunkOverlap from config to chunk()
    - Default to 50000 and 500 if not provided
    - _Requirements: 4.1_

- [ ] 3. Implement bounded concurrency for chunk extraction
  - [ ] 3.1 Add concurrency parameter to GeneratorConfig
    - Add optional `concurrency?: number` field (default: 3)
    - Add JSDoc comment: "Maximum parallel chunk extractions. Set to 1 for sequential."
    - _Requirements: 5.1_
  
  - [ ] 3.2 Create concurrent extraction pool
    - Create `extractChunksConcurrently()` function in `extract.ts`
    - Accept chunks array, concurrency limit, and other extraction parameters
    - Use Promise-based worker pool (no external dependencies)
    - Process chunks with at most N concurrent kiro-cli subprocesses
    - Collect all PartialIRs maintaining chunk index order
    - _Requirements: 5.1_
  
  - [ ] 3.3 Replace sequential loop with concurrent pool
    - Modify `extract()` function in `extract.ts`
    - Replace `for (let i = 0; i < chunks.length; i++)` loop
    - Call `extractChunksConcurrently()` instead
    - Maintain progress reporting for each chunk completion
    - Preserve chunk index association for error reporting
    - _Requirements: 5.1_
  
  - [ ] 3.4 Update progress reporting for concurrent execution
    - Modify progress messages to show "completed X/Y chunks"
    - Log chunk completion in completion order (not submission order)
    - Include chunk index in each progress line
    - Example: "  chunk 2/5 complete: 187.3s, 3 resources"
    - _Requirements: 5.1_

- [ ] 4. Increase timeout and improve error context
  - [ ] 4.1 Increase kiro-cli timeout from 5 to 10 minutes
    - Modify timeout in `invokeKiroCli()` from `5 * 60 * 1000` to `10 * 60 * 1000`
    - Update timeout_seconds in error from 300 to 600
    - Update JSDoc comment to reflect 10-minute timeout
    - _Requirements: 5.8_
  
  - [ ] 4.2 Add chunk content excerpt to timeout errors
    - When timeout occurs, include first 500 chars of chunk content in error
    - Add `chunk_preview` field to GeneratorError type for kiro_timeout
    - Include preview in error message formatting
    - Helps diagnose which content patterns cause timeouts
    - _Requirements: 5.8_
  
  - [ ] 4.3 Add stderr context to IR file missing errors
    - Capture stderr from kiro-cli even on exit code 0
    - Include stderr in ir_file_missing error for debugging
    - Already present in type signature, ensure it's populated
    - _Requirements: 5.6_

- [ ] 5. Checkpoint - Verify all changes integrate correctly
  - Run typecheck: `npm run build` in packages/driftnode
  - Run unit tests if present: `npm test`
  - Test generation with Vultr documentation to verify:
    - Quality validation runs and logs comparison
    - Chunk size configuration is respected
    - Concurrent extraction completes successfully
    - Timeout increase allows larger chunks to complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are independent and can be implemented separately
- No architectural changes required - only parameter additions and control-flow modifications
- Quality validation (1.2) should be implemented before setting default effort (1.3)
- Concurrent extraction (3.2-3.4) maintains chunk index order for error reporting
- Error improvements (4.2-4.3) provide better debugging context without changing error handling logic

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1", "4.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "4.2"] },
    { "id": 2, "tasks": ["1.3", "2.3", "3.2", "4.3"] },
    { "id": 3, "tasks": ["1.4", "3.3"] },
    { "id": 4, "tasks": ["3.4"] },
    { "id": 5, "tasks": ["5"] }
  ]
}
```

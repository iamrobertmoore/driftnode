# Implementation Plan: Extraction Robustness Improvements

## Overview

This plan implements three extraction robustness improvements in priority order: persistent chunk IR caching to eliminate wasted extraction time, document-level merge rules for base_url and auth to handle chunking artifacts correctly, and configuration auth override as an escape hatch for ambiguous documentation.

## Tasks

- [ ] 1. Implement persistent chunk IR cache infrastructure
  - [ ] 1.1 Add cache directory setup and path resolution
    - Create cache directory in a persistent location (e.g., `~/.cache/driftnode` or `<workspace>/.driftnode-cache`)
    - Add utility function to compute cache directory path
    - Ensure cache directory is created if it doesn't exist
    - _Requirements: 1.6_
  
  - [ ] 1.2 Implement cache key computation
    - Create function to compute SHA-256 hash of chunk content
    - Create function to compute hash of extraction prompt (to invalidate cache when prompt changes)
    - Combine content hash and prompt hash into cache key
    - _Requirements: 1.1_
  
  - [ ] 1.3 Implement cache read and write operations
    - Add function to write partial IR to cache file keyed by cache key
    - Add function to check if cache entry exists for a given key
    - Add function to read partial IR from cache
    - Handle JSON parsing errors gracefully (treat as cache miss)
    - _Requirements: 1.2, 1.4_
  
  - [ ] 1.4 Integrate cache into extraction flow
    - Before invoking kiro-cli for a chunk, check cache
    - If cache hit, load and use cached partial IR
    - If cache miss, invoke kiro-cli and write result to cache
    - Track reused vs extracted counts during extraction
    - _Requirements: 1.3, 1.4_
  
  - [ ] 1.5 Add `--no-cache` flag support
    - Add `--no-cache` CLI flag to generator command
    - When flag is present, skip all cache lookups
    - Force re-extraction of all chunks when flag is set
    - _Requirements: 1.7_
  
  - [ ] 1.6 Update progress summary to report cache usage
    - Modify extraction summary to show count of reused chunks
    - Modify extraction summary to show count of extracted chunks
    - Format: "Extraction complete: X.Xs total, N chunks processed (M reused, P extracted)"
    - _Requirements: 1.5_

- [ ] 2. Checkpoint - Verify cache functionality
  - Ensure all tests pass, verify cache correctly avoids re-extraction

- [ ] 3. Implement document-level merge rules for base_url and auth
  - [ ] 3.1 Refactor merge logic to track chunk indices
    - Modify mergePartialIRs to track which chunk provided each base_url and auth value
    - Store first occurrence chunk index when base_url is first seen
    - Store first occurrence chunk index when auth is first seen
    - _Requirements: 2.1, 2.3_
  
  - [ ] 3.2 Implement earliest-wins merge strategy for base_url
    - When base_url is encountered in a chunk, use it only if no prior value exists
    - On conflict, emit WARNING instead of throwing error
    - Include both chunk indices and both values in warning
    - _Requirements: 2.1, 2.2_
  
  - [ ] 3.3 Implement earliest-wins merge strategy for auth
    - When auth is encountered in a chunk, use it only if no prior value exists
    - On conflict, emit WARNING instead of throwing error
    - Include both chunk indices and both values in warning
    - _Requirements: 2.3, 2.4_
  
  - [ ] 3.4 Preserve hard errors for operation-level conflicts
    - Keep existing error behavior for operation http_method conflicts
    - Keep existing error behavior for operation path conflicts
    - Verify these remain HARD ERRORS as they are today
    - _Requirements: 2.5, 2.6_

- [ ] 4. Checkpoint - Verify merge rules
  - Ensure document-level fields produce warnings, operation conflicts remain errors

- [ ] 5. Implement configuration auth override
  - [ ] 5.1 Add auth field to GeneratorConfig type
    - Add optional `auth?: AuthenticationScheme` field to GeneratorConfig interface in types.ts
    - Update TypeScript types
    - _Requirements: 3.1_
  
  - [ ] 5.2 Add config validation for auth field
    - Add validation logic in config.ts to check auth field structure
    - Validate that if present, auth field conforms to AuthenticationScheme
    - Reuse existing auth validation rules from validation stage
    - _Requirements: 3.4_
  
  - [ ] 5.3 Integrate auth override into extraction flow
    - After merging partial IRs, check if config.auth is present
    - If present, override merged auth with config.auth
    - Update extraction summary to report "auth taken from configuration" when override is used
    - _Requirements: 3.2, 3.3_

- [ ] 6. Final checkpoint - Verify all three improvements work together
  - Test cache with auth override
  - Test merge warnings with cache hits
  - Ensure all tests pass

## Notes

- These are three independent improvements that can be implemented in sequence
- Priority 1 (cache) eliminates wasted extraction time during development iteration
- Priority 2 (merge rules) fixes spurious conflicts from chunking artifacts
- Priority 3 (auth override) provides escape hatch for genuinely ambiguous documentation
- Each checkpoint ensures the feature works before moving to the next
- No property-based tests needed - these are infrastructure improvements
- Integration tests would be valuable but are not required for MVP

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3"] },
    { "id": 2, "tasks": ["1.4", "1.5"] },
    { "id": 3, "tasks": ["1.6"] },
    { "id": 4, "tasks": ["3.1"] },
    { "id": 5, "tasks": ["3.2", "3.3", "3.4"] },
    { "id": 6, "tasks": ["5.1"] },
    { "id": 7, "tasks": ["5.2"] },
    { "id": 8, "tasks": ["5.3"] }
  ]
}
```

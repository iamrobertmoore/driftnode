# Requirements Document: Extraction Robustness Improvements

## Introduction

This specification addresses three extraction robustness improvements to make the driftnode generator more practical for development and handle common documentation patterns correctly. These improvements are prioritized by impact: caching eliminates wasted extraction time on iteration, merge rules fix spurious conflicts from chunking artifacts, and auth override provides an escape hatch for genuinely ambiguous documentation.

## Glossary

- **Extraction**: The process of invoking kiro-cli to transform prose documentation chunks into structured IntermediateRepresentation (IR)
- **Chunk**: A segment of documentation processed independently during parallel extraction
- **IR**: Intermediate Representation - the structured contract extracted from vendor documentation
- **Cache**: Persistent storage of extracted chunk IRs keyed by content hash
- **Merge**: The process of combining partial IRs from multiple chunks into a complete IR
- **Generator**: The driftnode tool that produces n8n community nodes from documentation
- **GeneratorConfig**: User-provided configuration specifying vendor, documentation source, and generation options

## Requirements

### Requirement 1: Persistent Chunk IR Cache

**User Story:** As a generator developer, I want chunk IR extraction results cached persistently, so that merge or emit iteration does not require re-extracting all chunks.

#### Acceptance Criteria

1. WHEN a chunk is extracted, THE Generator SHALL compute a cache key from SHA-256 of chunk content plus prompt hash
2. WHEN a chunk is extracted, THE Generator SHALL write the partial IR to a persistent cache file keyed by the cache key
3. WHEN extraction begins, THE Generator SHALL check the cache for each chunk before invoking kiro-cli
4. WHEN a cached chunk IR is found, THE Generator SHALL reuse it without re-extraction
5. WHEN extraction completes, THE Generator SHALL report the count of reused chunks and extracted chunks in the progress summary
6. THE Generator SHALL store the cache outside temporary directories that get cleaned up
7. WHEN the `--no-cache` flag is provided, THE Generator SHALL skip cache lookups and force re-extraction of all chunks

### Requirement 2: Document-Level Field Merge Rules

**User Story:** As a generator user, I want base_url and auth conflicts from chunking artifacts treated as warnings, so that documentation stating these values once in an introduction does not cause spurious merge failures.

#### Acceptance Criteria

1. WHEN multiple chunks provide base_url, THE Generator SHALL use the earliest chunk's value
2. WHEN multiple chunks provide conflicting base_url values, THE Generator SHALL emit a WARNING with both chunk indices and both values
3. WHEN multiple chunks provide auth, THE Generator SHALL use the earliest chunk's value
4. WHEN multiple chunks provide conflicting auth values, THE Generator SHALL emit a WARNING with both chunk indices and both values
5. WHEN the same operation appears with different http_method values, THE Generator SHALL throw a merge conflict ERROR
6. WHEN the same operation appears with different path values, THE Generator SHALL throw a merge conflict ERROR

### Requirement 3: Configuration Auth Override

**User Story:** As a generator user, I want to override extracted auth in configuration, so that genuinely ambiguous documentation can be explicitly resolved without modifying the documentation source.

#### Acceptance Criteria

1. THE GeneratorConfig interface SHALL include an optional `auth` field of type AuthenticationScheme
2. WHEN the configuration provides an auth override, THE Generator SHALL use it instead of any extracted auth
3. WHEN the configuration provides an auth override, THE Generator SHALL report "auth taken from configuration" in the extraction summary
4. WHEN the configuration provides an auth override, THE Generator SHALL validate the auth structure using existing validation rules

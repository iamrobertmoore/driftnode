# Requirements Document

## Introduction

The extraction stage is currently impractical for real-world documentation. Chunk 1 of Vultr documentation took 225.8 seconds at 50,000 characters, and chunk 2 exceeded the 300 second timeout. This feature introduces four performance optimizations: explicit reasoning effort configuration, reduced chunk size, concurrent chunk processing, and configurable timeout with improved error messages. Together these changes aim to reduce extraction time from multiple minutes per chunk to tens of seconds, making the generator viable for production use.

## Glossary

- **Generator**: The driftnode tool that reads vendor API documentation and produces n8n community node packages
- **Extraction_Stage**: Stage 2 of the generator pipeline where kiro-cli is invoked to extract structured IR from documentation chunks
- **Kiro_CLI**: The command-line interface to Kiro that the generator shells out to for LLM-powered extraction
- **Document_Chunk**: A segment of normalized vendor documentation, currently up to 50,000 characters with 500 character overlap
- **Partial_IR**: The intermediate representation extracted from a single document chunk
- **Generator_Config**: The configuration object passed to the generator containing vendor name, documentation source, and optional settings
- **Reasoning_Effort**: The computational intensity level passed to kiro-cli via the --effort flag (low, medium, high, xhigh, max)
- **Chunk_Size**: The maximum number of characters in a single document chunk before splitting
- **Chunk_Overlap**: The number of characters of context preserved between adjacent chunks
- **Concurrency**: The number of document chunks processed in parallel during extraction
- **Extraction_Timeout**: The maximum time in seconds allowed for a single chunk extraction before killing the kiro-cli subprocess
- **Bounded_Concurrency_Pool**: A concurrency control mechanism that limits the number of simultaneous kiro-cli subprocesses to prevent resource exhaustion

## Requirements

### Requirement 1: Reasoning Effort Configuration

**User Story:** As a developer using driftnode, I want extraction to run with low reasoning effort by default, so that contract extraction completes in practical timeframes without sacrificing accuracy on the mechanical transcription task.

#### Acceptance Criteria

1. WHEN invoking kiro-cli for extraction, THE Extraction_Stage SHALL pass the --effort flag with the configured reasoning effort level
2. WHEN no reasoning effort is specified in Generator_Config, THE Extraction_Stage SHALL default to 'low' reasoning effort
3. WHERE Generator_Config includes an 'effort' field, THE Extraction_Stage SHALL use the specified effort level
4. THE Generator_Config 'effort' field SHALL accept the values: 'low', 'medium', 'high', 'xhigh', 'max'
5. WHEN an invalid effort value is provided in Generator_Config, THE Extraction_Stage SHALL reject it with a descriptive error before starting extraction

### Requirement 2: Reduced Chunk Size

**User Story:** As a developer using driftnode, I want smaller document chunks, so that each kiro-cli invocation produces less output and completes faster.

#### Acceptance Criteria

1. WHEN chunking normalized documentation, THE System SHALL use 15,000 characters as the maximum chunk size by default
2. WHEN chunking normalized documentation, THE System SHALL use 150 characters as the overlap size by default
3. WHERE Generator_Config includes a 'chunkSize' field, THE System SHALL use the specified chunk size
4. WHERE Generator_Config includes a 'chunkOverlap' field, THE System SHALL use the specified overlap size
5. WHEN chunkSize is less than 1000 characters, THE System SHALL reject it with a descriptive error
6. WHEN chunkOverlap is greater than or equal to chunkSize, THE System SHALL reject it with a descriptive error

### Requirement 3: Concurrent Chunk Extraction

**User Story:** As a developer using driftnode, I want chunks to be extracted concurrently, so that extraction time scales with the number of available CPU cores rather than the number of chunks.

#### Acceptance Criteria

1. WHEN extracting multiple document chunks, THE Extraction_Stage SHALL process them using a bounded concurrency pool
2. WHEN no concurrency level is specified in Generator_Config, THE Extraction_Stage SHALL default to 4 concurrent extractions
3. WHERE Generator_Config includes a 'concurrency' field, THE Extraction_Stage SHALL limit concurrent extractions to that value
4. WHEN merging partial IRs, THE Extraction_Stage SHALL preserve chunk ordering by index regardless of completion order
5. WHEN a chunk extraction fails, THE Extraction_Stage SHALL cancel remaining in-flight extractions and report the failure
6. WHEN concurrency is less than 1, THE Extraction_Stage SHALL reject it with a descriptive error
7. WHEN displaying per-chunk progress, THE Extraction_Stage SHALL output each completion line in the order chunks complete, not in chunk index order

### Requirement 4: Configurable Timeout with Improved Errors

**User Story:** As a developer using driftnode, I want a longer default timeout and the ability to configure it, so that larger chunks have time to complete and I can adjust for different documentation complexity levels.

#### Acceptance Criteria

1. WHEN invoking kiro-cli for a chunk extraction, THE Extraction_Stage SHALL enforce a timeout in seconds
2. WHEN no timeout is specified in Generator_Config, THE Extraction_Stage SHALL use 600 seconds as the default timeout
3. WHERE Generator_Config includes an 'extractionTimeoutSeconds' field, THE Extraction_Stage SHALL use the specified timeout
4. WHEN a chunk extraction exceeds the timeout, THE Extraction_Stage SHALL terminate the kiro-cli subprocess
5. WHEN a timeout error is reported, THE error message SHALL include the chunk index that timed out
6. WHEN extractionTimeoutSeconds is less than 30, THE Extraction_Stage SHALL reject it with a descriptive error

### Requirement 5: Extraction Progress and Summary

**User Story:** As a developer using driftnode, I want clear visibility into extraction progress and resource usage, so that I can understand what the generator is doing and estimate costs.

#### Acceptance Criteria

1. WHEN a chunk extraction completes, THE Extraction_Stage SHALL output a progress line showing chunk number, total chunks, elapsed time, and resource count
2. WHEN all chunk extractions complete, THE Extraction_Stage SHALL output the total elapsed time for the extraction stage
3. WHEN all chunk extractions complete, THE Extraction_Stage SHALL output the total number of kiro-cli invocations made
4. THE progress output format SHALL match the existing format: "chunk n/total... X.Xs, Y resource(s)"
5. THE total elapsed time SHALL be displayed in seconds with one decimal place
6. THE kiro-cli invocation count SHALL be labeled as the number of chunks processed to clarify its relevance to API costs

# Implementation Plan: Extraction Performance Optimizations

## Overview

This plan implements four independent performance optimizations to the extraction stage. Each optimization is a parameter change with validation: (1) add effort parameter with quality validation, (2) make chunk size configurable, (3) implement bounded concurrency, and (4) increase timeout and improve error messages. These changes will reduce extraction time from multiple minutes per chunk to tens of seconds.

## Tasks

- [ ] 1. Add effort parameter with quality validation
  - [x] 1.1 Add effort field to GeneratorConfig type
    - Add `effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'` to GeneratorConfig interface
    - _Requirements: 1.4_
  
  - [~] 1.2 Add effort validation to config validation
    - Validate effort value is one of the allowed values
    - Reject invalid effort values with descriptive error before extraction starts
    - _Requirements: 1.5_
  
  - [~] 1.3 Pass effort flag to kiro-cli
    - Modify invokeKiroCli to accept effort parameter
    - Add `--effort ${effort}` flag to kiro-cli spawn arguments
    - Default to 'low' when effort is undefined
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [ ]* 1.4 Write unit tests for effort parameter
    - Test default effort value is 'low'
    - Test custom effort value is passed correctly
    - Test invalid effort value is rejected
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [ ] 2. Make chunk size configurable
  - [x] 2.1 Add chunk size fields to GeneratorConfig
    - Add `chunkSize?: number` to GeneratorConfig interface
    - Add `chunkOverlap?: number` to GeneratorConfig interface
    - _Requirements: 2.3, 2.4_
  
  - [~] 2.2 Update chunk function to accept configurable parameters
    - Modify chunk() to accept chunkSize and chunkOverlap parameters
    - Default chunkSize to 15,000 characters (down from 50,000)
    - Default chunkOverlap to 150 characters (down from 500)
    - Update MIN_CHUNK_SIZE to be chunkSize / 2
    - Update MIN_ADVANCEMENT to be chunkSize - chunkOverlap
    - _Requirements: 2.1, 2.2_
  
  - [~] 2.3 Add chunk size validation
    - Validate chunkSize is at least 1000 characters
    - Validate chunkOverlap is less than chunkSize
    - Reject invalid values with descriptive errors
    - _Requirements: 2.5, 2.6_
  
  - [~] 2.4 Wire chunk configuration from ingest to chunk function
    - Pass config.chunkSize and config.chunkOverlap from ingest() to chunk()
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [ ]* 2.5 Write unit tests for chunk size configuration
    - Test default chunk size is 15,000
    - Test default overlap is 150
    - Test custom chunk size is used
    - Test custom overlap is used
    - Test rejection of chunkSize < 1000
    - Test rejection of chunkOverlap >= chunkSize
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [ ] 3. Implement bounded concurrency
  - [x] 3.1 Add concurrency field to GeneratorConfig
    - Add `concurrency?: number` to GeneratorConfig interface
    - _Requirements: 3.3_
  
  - [~] 3.2 Add concurrency validation
    - Validate concurrency is at least 1
    - Reject invalid concurrency with descriptive error
    - _Requirements: 3.6_
  
  - [~] 3.3 Implement bounded concurrency pool in extract function
    - Replace sequential for loop with concurrent processing
    - Use Promise.all with chunked batches to limit concurrency
    - Default concurrency to 4 concurrent extractions
    - Track chunk completion order for progress output
    - Preserve chunk ordering by index when merging results
    - _Requirements: 3.1, 3.2, 3.4_
  
  - [~] 3.4 Implement cancellation on chunk failure
    - When a chunk extraction fails, cancel remaining in-flight extractions
    - Report the failure immediately without waiting for other chunks
    - _Requirements: 3.5_
  
  - [~] 3.5 Update progress output to show completion order
    - Output each chunk completion line as chunks complete (not in index order)
    - Include chunk index in progress line to distinguish chunks
    - _Requirements: 3.7_
  
  - [ ]* 3.6 Write unit tests for bounded concurrency
    - Test default concurrency is 4
    - Test custom concurrency value is used
    - Test chunk ordering is preserved in merge
    - Test cancellation on failure
    - Test rejection of concurrency < 1
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 4. Increase timeout and improve error messages
  - [x] 4.1 Add timeout field to GeneratorConfig
    - Add `extractionTimeoutSeconds?: number` to GeneratorConfig interface
    - _Requirements: 4.3_
  
  - [~] 4.2 Add timeout validation
    - Validate extractionTimeoutSeconds is at least 30
    - Reject invalid timeout with descriptive error
    - _Requirements: 4.6_
  
  - [~] 4.3 Update invokeKiroCli timeout
    - Change default timeout from 300 seconds (5 minutes) to 600 seconds (10 minutes)
    - Use config.extractionTimeoutSeconds when provided
    - Pass timeout parameter to invokeKiroCli
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [~] 4.4 Improve timeout error message
    - Include chunk index in timeout error
    - Update kiro_timeout error type to include chunk_index field
    - _Requirements: 4.5_
  
  - [ ]* 4.5 Write unit tests for timeout configuration
    - Test default timeout is 600 seconds
    - Test custom timeout value is used
    - Test timeout error includes chunk index
    - Test rejection of extractionTimeoutSeconds < 30
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ] 5. Add extraction progress summary
  - [~] 5.1 Track total extraction time
    - Record start time before chunk extraction loop
    - Record end time after all chunks complete
    - Calculate total elapsed time in seconds
    - _Requirements: 5.2_
  
  - [~] 5.2 Output extraction summary
    - After all chunks complete, output total elapsed time with one decimal place
    - Output total number of kiro-cli invocations (chunk count)
    - Label invocation count as "chunks processed" for cost clarity
    - _Requirements: 5.2, 5.3, 5.6_
  
  - [ ]* 5.3 Write unit tests for extraction summary
    - Test total elapsed time is displayed
    - Test chunk count is displayed as "chunks processed"
    - _Requirements: 5.2, 5.3, 5.6_

- [~] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- All four optimizations are independent and can be implemented in parallel
- The concurrency implementation is the most complex change as it restructures the extraction loop
- Progress output format must maintain compatibility with existing format: "chunk n/total... X.Xs, Y resource(s)"

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1", "4.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "3.2", "4.2"] },
    { "id": 2, "tasks": ["1.3", "2.3", "4.3"] },
    { "id": 3, "tasks": ["2.4", "3.3", "4.4", "5.1"] },
    { "id": 4, "tasks": ["3.4"] },
    { "id": 5, "tasks": ["3.5", "5.2"] },
    { "id": 6, "tasks": ["1.4", "2.5", "3.6", "4.5", "5.3"] }
  ]
}
```

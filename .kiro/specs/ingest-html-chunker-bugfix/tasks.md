# Implementation Plan

- [ ] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition 1** - HTML Stripping with Whitespace Preservation
  - **Property 2: Bug Condition 2** - Minimum Forward Progress
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior - they will validate the fixes when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate both bugs exist
  - **KEY TESTS THAT EXISTING SUITE MISSED**:
    1. **Pathological Chunker Test**: Input 628 KB text with no sentence boundaries and unbalanced code tags, assert chunk count proportional to length (~13, not 610), assert no chunk < 25,000 chars except last, assert median chunk size close to 50,000 chars
    2. **Pre Whitespace Preservation Test**: Realistic HTML with nested `<div>`, `<span>`, `<p>` tags AND `<pre>` block with specific line structure, assert all tags stripped, assert `<pre>` content retains exact whitespace/newlines, assert output size ~1/8 of input
  - Test HTML tag stripping: `<div>Hello <span>world</span></div>` → `Hello world`
  - Test code block whitespace: `<code>  line1\n  line2</code>` → preserves exact whitespace
  - Test chunk count proportionality: 5.4 MB text → 10-15 chunks (not 610)
  - Test minimum chunk size: all chunks except last ≥ 25,000 chars
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found:
    - Bug 1: HTML tags remain, size inflated 8x
    - Bug 2: Chunk count 47x higher, median size 1/163 of expected
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [ ] 2. Write preservation property tests (BEFORE implementing fixes)
  - **Property 3: Preservation** - Existing Normalization Behavior
  - **Property 4: Preservation** - Existing Chunking Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - Markdown normalization produces expected output
    - JSON normalization produces expected output
    - Text normalization produces expected output
    - Script/style tags are removed
    - HTML entities are decoded correctly
    - Well-formed text (with sentence boundaries) chunks appropriately
    - Content ≤ 50,000 chars returns single chunk
    - Chunks have 500-char overlap
    - Code blocks are not split mid-block
  - Write property-based tests capturing observed behavior patterns
  - Property-based testing generates many test cases for stronger guarantees
  - Test preservation for all normalization functions (Markdown, JSON, text)
  - Test preservation for chunking with adequate boundaries
  - Test preservation of script/style removal, entity decoding, overlap, etc.
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12, 3.13, 3.14_

- [ ] 3. Fix HTML normalization and chunker bugs

  - [ ] 3.1 Implement HTML normalization fix
    - Extract `<pre>` and `<code>` blocks first with placeholders (preserve exact whitespace)
    - Strip all remaining HTML tags from content
    - Restore code blocks with preserved whitespace
    - Collapse multiple spaces/newlines to single spaces in non-code content
    - Preserve existing script/style removal, entity decoding, line ending normalization, trimming
    - _Bug_Condition: isBugCondition1(input) where input contains HTML tags not stripped_
    - _Expected_Behavior: All tags stripped, code block whitespace preserved, output size proportional to text_
    - _Preservation: Script/style removal, entity decoding, line ending normalization, trimming_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 3.2 Implement chunker forward progress fix
    - Add minimum boundary constraint in `findChunkBoundary()`: never return position < start + MAX_CHUNK_SIZE / 2
    - Add fallback in `findChunkBoundary()`: if no acceptable boundary, return idealEnd
    - Enforce minimum forward progress in `chunk()`: ensure nextStart >= currentPos + (MAX_CHUNK_SIZE - OVERLAP_SIZE)
    - Guard against stall in `chunk()`: if nextStart <= currentPos, force advancement by MAX_CHUNK_SIZE - OVERLAP_SIZE
    - _Bug_Condition: isBugCondition2(input) where findChunkBoundary returns position too close to start_
    - _Expected_Behavior: Minimum chunk size 25,000 chars, minimum advancement 49,500 chars, chunk count proportional to length_
    - _Preservation: Single-chunk fast path, 500-char overlap, code block preservation, sentence boundary preference, DocumentChunk structure_
    - _Requirements: 2.6, 2.7, 2.8, 2.9, 2.10, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [ ] 3.3 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - HTML Stripping and Minimum Forward Progress
    - **IMPORTANT**: Re-run the SAME tests from task 1 - do NOT write new tests
    - The tests from task 1 encode the expected behavior
    - When these tests pass, it confirms the expected behavior is satisfied
    - Run bug condition exploration tests from step 1
    - Verify pathological chunker test passes (chunk count ~13, no tiny chunks)
    - Verify pre whitespace preservation test passes (tags stripped, whitespace preserved, size reduced)
    - Verify HTML tag stripping test passes
    - Verify code block whitespace test passes
    - Verify chunk count proportionality test passes
    - **EXPECTED OUTCOME**: Tests PASS (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [ ] 3.4 Verify preservation tests still pass
    - **Property 3: Preservation** - Existing Normalization Behavior
    - **Property 4: Preservation** - Existing Chunking Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - Verify Markdown normalization unchanged
    - Verify JSON normalization unchanged
    - Verify text normalization unchanged
    - Verify script/style removal unchanged
    - Verify entity decoding unchanged
    - Verify well-formed chunking unchanged
    - Verify single-chunk fast path unchanged
    - Verify 500-char overlap preserved
    - Verify code block boundaries preserved
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fixes (no regressions)

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

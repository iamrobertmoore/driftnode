# Ingest HTML Normalization and Chunker Bugfix Design

## Overview

This fix addresses two critical bugs in `packages/driftnode/src/ingest.ts`:
- **Bug 1**: `normalizeHtml()` leaves HTML tags, producing 8x more content than needed
- **Bug 2**: `chunk()` fails to make forward progress, producing 47x more chunks than expected

Root causes are already diagnosed and measured. This design specifies the implementation plan and test strategy.

## Glossary

- **Bug_Condition_1 (C1)**: Input HTML containing markup tags that should be stripped
- **Bug_Condition_2 (C2)**: Input text where `findChunkBoundary()` returns positions too close to current position
- **Property_1 (P1)**: HTML stripped, text extracted, whitespace preserved in code blocks
- **Property_2 (P2)**: Minimum forward progress guaranteed, chunk count proportional to length
- **Preservation**: All existing normalization, decoding, chunking preferences, and error handling behaviors
- **normalizeHtml**: Function in `ingest.ts` that converts HTML to plain text
- **chunk**: Function in `ingest.ts` that splits text into overlapping chunks
- **findChunkBoundary**: Helper in `ingest.ts` that locates optimal split points
- **MAX_CHUNK_SIZE**: Target chunk size of 50,000 characters
- **OVERLAP_SIZE**: Overlap between chunks of 500 characters

## Bug Details

### Bug Condition 1: HTML Normalization

The bug manifests when HTML content with markup tags is processed. The current implementation removes only script/style tags and normalizes whitespace, but does not strip HTML tags.

**Formal Specification:**
```
FUNCTION isBugCondition1(input)
  INPUT: input of type string (HTML content)
  OUTPUT: boolean
  
  RETURN input contains HTML tags (e.g., <div>, <span>, <p>, <pre>, <code>)
         AND tags are not stripped from output
END FUNCTION
```

**Measured Impact:**
- 10 MB HTML input → 5.4 MB output (actual text: 628 KB)
- 8.6x content inflation causes downstream token waste

### Bug Condition 2: Chunker Forward Progress

The bug manifests when `findChunkBoundary()` returns positions within `OVERLAP_SIZE` (500 chars) of the current position. The loop advances by only 1 character per iteration.

**Formal Specification:**
```
FUNCTION isBugCondition2(input)
  INPUT: input of type string (text content)
  OUTPUT: boolean
  
  RETURN findChunkBoundary(input, pos, pos + MAX_CHUNK_SIZE) < pos + OVERLAP_SIZE
         AND chunk loop advances by 1 character
         AND output chunk count >> expected count
END FUNCTION
```

**Measured Impact:**
- 5.4 MB input → 610 chunks (median 306 chars)
- Expected: ~13 chunks (median ~50,000 chars)
- 47x chunk inflation causes processing failure

### Examples

**Bug 1 Examples:**
- Input: `<div>Hello <span>world</span></div>` → Current: `<div>Hello <span>world</span></div>` → Expected: `Hello world`
- Input: `<pre>  line1\n  line2</pre>` → Current: `<pre>  line1\n  line2</pre>` → Expected: `  line1\n  line2`
- Input: 10 MB HTML with 628 KB text → Current: 5.4 MB → Expected: ~628 KB

**Bug 2 Examples:**
- Input: 628 KB text with few sentence boundaries → Current: 610 chunks → Expected: ~13 chunks
- `findChunkBoundary()` returns position 50 when start=0, idealEnd=50000 → Advances by 50 chars instead of ~49,500

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Script/style tag removal must continue to work
- HTML entity decoding must continue to work
- Line ending normalization must continue to work
- Whitespace trimming must continue to work
- Single-chunk fast path for content ≤ MAX_CHUNK_SIZE
- 500-character overlap between chunks
- Code block boundary preservation
- Sentence boundary preference
- DocumentChunk object structure with start/end positions
- All non-HTML normalization functions (Markdown, JSON, text)
- Error handling in `fetchRemote()` and `readLocal()`

**Scope:**
All inputs that do NOT involve HTML content (Bug 1) or pathological chunking scenarios (Bug 2) should be completely unaffected by this fix.

## Hypothesized Root Cause

**Bug 1: HTML Normalization**
Root cause confirmed through measurement:
- `normalizeHtml()` removes script/style tags but does not strip other HTML markup
- No text extraction from elements
- No special handling for `<pre>` or `<code>` blocks to preserve whitespace

**Bug 2: Chunker Forward Progress**
Root cause confirmed through measurement:
- `findChunkBoundary()` can return positions < `start + MAX_CHUNK_SIZE / 2`
- No minimum forward progress constraint in `chunk()` loop
- Loop advances by `Math.max(1, nextStart - currentPos)` when nextStart ≤ currentPos + OVERLAP_SIZE

## Correctness Properties

Property 1: Bug Condition 1 - HTML Stripping with Whitespace Preservation

_For any_ HTML input containing markup tags, the fixed `normalizeHtml()` function SHALL strip all HTML tags (except script/style which are already removed), preserve exact whitespace and line breaks within `<pre>` and `<code>` blocks, and collapse multiple spaces/newlines to single spaces in regular text, producing output size proportional to actual text content.

**Validates: Requirements 2.1, 2.2, 2.3, 2.5**

Property 2: Bug Condition 2 - Minimum Forward Progress

_For any_ text input, the fixed `chunk()` function SHALL guarantee that each chunk (except the last) is at least 25,000 characters (MAX_CHUNK_SIZE / 2), and the loop advances by at least MAX_CHUNK_SIZE - OVERLAP_SIZE (49,500 characters) per iteration, producing chunk count proportional to content length.

**Validates: Requirements 2.6, 2.7, 2.8, 2.9, 2.10**

Property 3: Preservation - Existing Normalization Behavior

_For any_ input that does NOT contain HTML markup tags requiring stripping (e.g., Markdown, JSON, plain text), the fixed normalization functions SHALL produce exactly the same output as the original functions, preserving all existing behavior including script/style removal, entity decoding, line ending normalization, and whitespace trimming.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.11, 3.12, 3.13, 3.14**

Property 4: Preservation - Existing Chunking Behavior

_For any_ input that does NOT trigger pathological chunking (e.g., content with adequate sentence boundaries), the fixed `chunk()` function SHALL produce the same chunks as the original function, preserving single-chunk fast path, 500-char overlap, code block preservation, sentence boundary preference, and DocumentChunk structure.

**Validates: Requirements 3.6, 3.7, 3.8, 3.9, 3.10**

## Fix Implementation

### Changes Required

**File**: `packages/driftnode/src/ingest.ts`

**Function 1**: `normalizeHtml()`

**Specific Changes**:
1. **Extract code blocks first**: Before stripping tags, identify and extract `<pre>` and `<code>` blocks with placeholders, preserving their exact whitespace structure
2. **Strip HTML tags**: Remove all remaining HTML markup using a tag-stripping function or regex
3. **Restore code blocks**: Replace placeholders with original code block content
4. **Collapse whitespace**: Collapse multiple spaces/newlines to single spaces in non-code content
5. **Preserve existing logic**: Keep script/style removal, entity decoding, line ending normalization, trimming

**Function 2**: `findChunkBoundary()`

**Specific Changes**:
1. **Add minimum boundary constraint**: Never return a position < `start + MAX_CHUNK_SIZE / 2`
2. **Enforce fallback**: If no acceptable boundary found, return `idealEnd` to guarantee forward progress

**Function 3**: `chunk()`

**Specific Changes**:
1. **Enforce minimum forward progress**: After finding boundary, ensure `nextStart >= currentPos + (MAX_CHUNK_SIZE - OVERLAP_SIZE)`
2. **Guard against stall**: If `nextStart <= currentPos`, force advancement by `MAX_CHUNK_SIZE - OVERLAP_SIZE`

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate both bugs BEFORE implementing fixes. Confirm root causes through measurement.

**Test Plan**: Write tests that expose the pathological cases missed by existing test suite. Run on UNFIXED code to observe failures.

**Critical Test Cases**:

1. **Pathological Chunker Test** (Bug 2 - the key missed case)
   - Input: 628 KB text with no sentence boundaries and unbalanced code tags
   - Assert: Chunk count proportional to length (~13 chunks, not 610)
   - Assert: No chunk < 25,000 chars except last
   - Assert: Median chunk size close to 50,000 chars
   - Will fail on unfixed code: produces 610 tiny chunks

2. **Pre Whitespace Preservation Test** (Bug 1 - the key missed case)
   - Input: Realistic HTML with nested `<div>`, `<span>`, `<p>` tags
   - Input includes `<pre>` block with specific line structure (e.g., 3 lines, specific indentation)
   - Assert: All HTML tags stripped from output
   - Assert: `<pre>` content retains exact whitespace and newlines
   - Assert: Output size ~1/8 of input size
   - Will fail on unfixed code: tags remain, size inflated 8x

3. **HTML Tag Stripping Test** (Bug 1)
   - Input: `<div>Hello <span>world</span></div>`
   - Assert: Output equals `Hello world`
   - Will fail on unfixed code: tags remain

4. **Code Block Whitespace Test** (Bug 1)
   - Input: `<code>  line1\n  line2</code>`
   - Assert: Output preserves exact whitespace: `  line1\n  line2`
   - Will fail on unfixed code: tags remain

5. **Chunk Count Proportionality Test** (Bug 2)
   - Input: 5.4 MB text (after normalization)
   - Assert: Chunk count between 10-15
   - Will fail on unfixed code: produces hundreds of chunks

**Expected Counterexamples**:
- Bug 1: HTML tags remain in output, inflating size by 8x
- Bug 2: Chunk count exceeds expected by 47x, median size 1/163 of expected

### Fix Checking

**Goal**: Verify that for all inputs where bug conditions hold, fixed functions produce expected behavior.

**Pseudocode:**
```
// Bug 1 Fix Checking
FOR ALL input WHERE isBugCondition1(input) DO
  result := normalizeHtml_fixed(input)
  ASSERT all HTML tags stripped (except content)
  ASSERT <pre>/<code> whitespace preserved
  ASSERT output size proportional to text content
END FOR

// Bug 2 Fix Checking
FOR ALL input WHERE isBugCondition2(input) DO
  result := chunk_fixed(input)
  ASSERT all chunks except last >= MAX_CHUNK_SIZE / 2
  ASSERT chunk count proportional to length
  ASSERT median chunk size close to MAX_CHUNK_SIZE
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where bug conditions do NOT hold, fixed functions produce same results as original functions.

**Pseudocode:**
```
// Normalization Preservation
FOR ALL input WHERE NOT isBugCondition1(input) DO
  ASSERT normalizeHtml_original(input) = normalizeHtml_fixed(input)
  ASSERT normalizeMarkdown_original(input) = normalizeMarkdown_fixed(input)
  ASSERT normalizeJson_original(input) = normalizeJson_fixed(input)
  ASSERT normalizeText_original(input) = normalizeText_fixed(input)
END FOR

// Chunking Preservation
FOR ALL input WHERE NOT isBugCondition2(input) DO
  ASSERT chunk_original(input) = chunk_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because it generates many test cases automatically and catches edge cases.

**Test Plan**: 
1. Observe behavior on UNFIXED code for non-buggy inputs (e.g., Markdown, JSON, well-formed text with sentence boundaries)
2. Write property-based tests capturing that behavior
3. Verify tests pass on UNFIXED code
4. After fix, verify tests still pass

**Test Cases**:
1. **Markdown Preservation**: Verify `normalizeMarkdown()` output unchanged
2. **JSON Preservation**: Verify `normalizeJson()` output unchanged
3. **Text Preservation**: Verify `normalizeText()` output unchanged
4. **Script/Style Removal Preservation**: Verify script and style tags still removed
5. **Entity Decoding Preservation**: Verify HTML entities still decoded correctly
6. **Well-Formed Chunking Preservation**: Verify text with adequate sentence boundaries produces same chunks
7. **Single-Chunk Fast Path Preservation**: Verify content ≤ 50,000 chars returns single chunk
8. **Overlap Preservation**: Verify 500-char overlap between chunks maintained
9. **Code Block Boundary Preservation**: Verify code blocks not split mid-block

### Unit Tests

- Test HTML tag stripping with various nested structures
- Test `<pre>` and `<code>` whitespace preservation
- Test whitespace collapse in regular text
- Test `findChunkBoundary()` minimum constraint
- Test `chunk()` minimum forward progress
- Test edge cases: empty input, single char, no boundaries

### Property-Based Tests

- **Pathological Chunker Property**: Generate text with varying boundary densities, assert chunk count/size proportional to length and no tiny chunks
- **HTML Stripping Property**: Generate HTML with nested tags, assert all tags removed and output size reduced appropriately
- **Preservation Property**: Generate non-HTML inputs (Markdown, JSON, text), assert output identical to original functions
- **Chunk Overlap Property**: Generate text of varying lengths, assert all chunks have 500-char overlap

### Integration Tests

- Test full ingestion pipeline with real Vultr HTML docs
- Test chunking of large normalized output
- Verify token count reduction downstream
- Verify generation succeeds with reduced chunk count

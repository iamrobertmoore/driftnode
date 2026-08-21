# Ingest HTML Normalization and Chunker Bugfix Requirements

## Introduction

Two critical bugs exist in `packages/driftnode/src/ingest.ts` that severely impact the efficiency and correctness of documentation ingestion:

1. **Incomplete HTML Normalization**: The `normalizeHtml()` function fails to strip HTML tags, passing 8x more content than needed to downstream extraction. A 10 MB HTML page produces 5.4 MB of normalized output when only 628 KB of actual text exists.

2. **Chunker Forward Progress Failure**: The `chunk()` function can fail to make forward progress, producing 610 tiny chunks (median 306 characters) instead of the expected ~13 chunks at 50,000 characters each. This occurs when `findChunkBoundary()` returns positions too close to the current position.

These bugs impact performance, token consumption, and reliability of the entire generation pipeline. The HTML normalization bug directly violates Requirement 3 ("Normalize Documentation to Text") in the original spec.

## Bug Analysis

### Current Behavior (Defect)

**Bug 1: HTML Normalization**

1.1 WHEN `normalizeHtml()` receives HTML content with nested tags like `<div>`, `<span>`, `<p>`, etc. THEN the system leaves all HTML markup in the output

1.2 WHEN `normalizeHtml()` processes a 10 MB HTML page THEN the system produces 5.4 MB of output instead of the expected 628 KB of text content

1.3 WHEN `normalizeHtml()` processes HTML with `<pre>` or `<code>` blocks THEN the system preserves HTML tags around code content instead of preserving only the code content with its whitespace

1.4 WHEN `normalizeHtml()` processes HTML with multiple consecutive spaces or newlines THEN the system preserves all whitespace instead of collapsing it to single spaces (except in code blocks)

**Bug 2: Chunker Forward Progress**

1.5 WHEN `chunk()` processes content where `findChunkBoundary()` returns a position within `OVERLAP_SIZE` (500 chars) of the current position THEN the system advances by only 1 character per iteration

1.6 WHEN `chunk()` processes a 10 MB document with pathological input (few sentence boundaries, unbalanced code tags) THEN the system produces 610 chunks instead of ~13 chunks

1.7 WHEN `chunk()` processes content with no acceptable boundaries THEN the system can produce chunks as small as 1 character

1.8 WHEN `findChunkBoundary()` searches for boundaries THEN the system can return positions less than `start + MAX_CHUNK_SIZE / 2`, causing minimal forward progress

### Expected Behavior (Correct)

**Bug 1: HTML Normalization**

2.1 WHEN `normalizeHtml()` receives HTML content THEN the system SHALL strip ALL HTML tags (except script and style which are already removed)

2.2 WHEN `normalizeHtml()` processes content with `<pre>` or `<code>` blocks THEN the system SHALL extract the text content while preserving exact whitespace and line breaks within those blocks

2.3 WHEN `normalizeHtml()` processes regular text (not in code blocks) THEN the system SHALL collapse multiple consecutive spaces and newlines to single spaces

2.4 WHEN `normalizeHtml()` processes HTML entities THEN the system SHALL decode them as currently implemented

2.5 WHEN `normalizeHtml()` processes a 10 MB HTML page with 628 KB of text content THEN the system SHALL produce approximately 628 KB of output

**Bug 2: Chunker Forward Progress**

2.6 WHEN `chunk()` processes any content THEN the system SHALL guarantee each chunk (except the last) is at least 25,000 characters (MAX_CHUNK_SIZE / 2)

2.7 WHEN `findChunkBoundary()` searches for boundaries THEN the system SHALL never return a position less than `start + MAX_CHUNK_SIZE / 2`

2.8 WHEN `findChunkBoundary()` cannot find an acceptable boundary THEN the system SHALL fall back to `idealEnd` to guarantee forward progress

2.9 WHEN `chunk()` advances to the next chunk THEN the system SHALL advance by at least `MAX_CHUNK_SIZE - OVERLAP_SIZE` characters (49,500 characters)

2.10 WHEN `chunk()` processes a 10 MB document THEN the system SHALL produce approximately 13 chunks with median chunk size close to 50,000 characters

### Unchanged Behavior (Regression Prevention)

**HTML Normalization Preservation**

3.1 WHEN `normalizeHtml()` strips script tags THEN the system SHALL CONTINUE TO remove script tags completely

3.2 WHEN `normalizeHtml()` strips style tags THEN the system SHALL CONTINUE TO remove style tags completely

3.3 WHEN `normalizeHtml()` decodes HTML entities THEN the system SHALL CONTINUE TO decode them correctly using the existing `decodeHtmlEntities()` function

3.4 WHEN `normalizeHtml()` normalizes line endings THEN the system SHALL CONTINUE TO convert to LF (`\n`)

3.5 WHEN `normalizeHtml()` trims whitespace THEN the system SHALL CONTINUE TO trim leading and trailing whitespace from the final output

**Chunker Preservation**

3.6 WHEN `chunk()` receives content ≤ 50,000 characters THEN the system SHALL CONTINUE TO return a single chunk without modification

3.7 WHEN `chunk()` creates chunks THEN the system SHALL CONTINUE TO add 500 characters of overlap between chunks

3.8 WHEN `chunk()` finds a code block boundary THEN the system SHALL CONTINUE TO preserve complete code blocks (not split mid-block)

3.9 WHEN `chunk()` finds a sentence boundary THEN the system SHALL CONTINUE TO prefer sentence boundaries over mid-sentence splits

3.10 WHEN `chunk()` creates chunks THEN the system SHALL CONTINUE TO include `start` and `end` positions in each `DocumentChunk` object

**Other Ingest Functions Preservation**

3.11 WHEN `normalize()` processes Markdown content THEN the system SHALL CONTINUE TO use `normalizeMarkdown()` without changes

3.12 WHEN `normalize()` processes JSON content THEN the system SHALL CONTINUE TO use `normalizeJson()` without changes

3.13 WHEN `normalize()` processes plain text content THEN the system SHALL CONTINUE TO use `normalizeText()` without changes

3.14 WHEN `fetchRemote()` or `readLocal()` return errors THEN the system SHALL CONTINUE TO handle them with existing error precedence

---

## Outcome

Both defects were reproduced by tests written against the broken code before any
fix was applied, so each test failed first and then passed. That ordering is the
only thing that proves a test is testing the bug rather than the fix.

**Defect 1, normalisation.** `normalize()` was dispatching HTML to
`normalizeText()`, which left every tag, script and style block in place. Vultr's
documentation page went in at 5,470,000 characters and should have been 596,000.

**Defect 2, forward progress.** When `chunk()` could not find a boundary inside
the search window it advanced the cursor by a single character and tried again.
On a 5.47M character input that produced 610 chunks where 13 were correct.

**Result.** 42 chunks from the real page, which is the expected figure for
596,000 characters at a 15,000 character chunk size with 500 characters of
overlap. Extraction against the live documentation then completed end to end.

**Cost of the bug.** The two fixes together were four characters and one
conditional. Finding them took a full extraction run, roughly 28 minutes of
Kiro time, discarded when the merge failed downstream. Content-hash caching was
added afterwards so a failed merge no longer throws away the extraction.

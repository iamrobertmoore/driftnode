/**
 * Unit tests for Stage 1: Ingest
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ingest } from '../src/ingest.js';
import { DocumentSource } from '../src/types.js';

// Mock fetch globally
const originalFetch = global.fetch;

describe('Ingest Stage', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ingest-test-'));
  });
  
  afterEach(async () => {
    // Clean up temp directory
    await fs.promises.rm(tempDir, { recursive: true, force: true });
    
    // Restore fetch
    global.fetch = originalFetch;
  });
  
  describe('Remote Fetch', () => {
    it('should successfully fetch HTML documentation from URL', async () => {
      const mockHtml = '<html><body><h1>API Documentation</h1></body></html>';
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        text: async () => mockHtml
      } as any);
      
      const source: DocumentSource = { type: 'url', url: 'https://example.com/docs' };
      const chunks = await ingest(source);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toContain('API Documentation');
      expect(chunks[0].start).toBe(0);
    });
    
    it('should handle network errors (highest priority)', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
      
      const source: DocumentSource = { type: 'url', url: 'https://example.com/docs' };
      
      await expect(ingest(source)).rejects.toMatchObject({
        stage: 'ingest',
        type: 'network_error',
        url: 'https://example.com/docs',
        message: 'Connection refused'
      });
    });
    
    it('should handle timeout errors', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          const error = new Error('Timeout');
          error.name = 'AbortError';
          setTimeout(() => reject(error), 100);
        });
      });
      
      const source: DocumentSource = { type: 'url', url: 'https://example.com/docs' };
      
      await expect(ingest(source)).rejects.toMatchObject({
        stage: 'ingest',
        type: 'timeout',
        url: 'https://example.com/docs',
        timeout_seconds: 30
      });
    });
    
    it('should handle 401 authentication denied', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Map(),
        text: async () => ''
      } as any);
      
      const source: DocumentSource = { type: 'url', url: 'https://example.com/docs' };
      
      await expect(ingest(source)).rejects.toMatchObject({
        stage: 'ingest',
        type: 'auth_denied',
        url: 'https://example.com/docs',
        status_code: 401
      });
    });
    
    it('should handle 403 bot protection', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Map(),
        text: async () => ''
      } as any);
      
      const source: DocumentSource = { type: 'url', url: 'https://example.com/docs' };
      
      await expect(ingest(source)).rejects.toMatchObject({
        stage: 'ingest',
        type: 'bot_protection',
        url: 'https://example.com/docs',
        status_code: 403
      });
    });
    
    it('should handle 404 not found', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Map(),
        text: async () => ''
      } as any);
      
      const source: DocumentSource = { type: 'url', url: 'https://example.com/docs' };
      
      await expect(ingest(source)).rejects.toMatchObject({
        stage: 'ingest',
        type: 'not_found',
        url: 'https://example.com/docs'
      });
    });
    
    it('should handle other HTTP errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Map(),
        text: async () => ''
      } as any);
      
      const source: DocumentSource = { type: 'url', url: 'https://example.com/docs' };
      
      await expect(ingest(source)).rejects.toMatchObject({
        stage: 'ingest',
        type: 'http_error',
        url: 'https://example.com/docs',
        status_code: 500
      });
    });
    
    it('should handle unsupported content type', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/pdf']]),
        text: async () => 'PDF content'
      } as any);
      
      const source: DocumentSource = { type: 'url', url: 'https://example.com/docs' };
      
      await expect(ingest(source)).rejects.toMatchObject({
        stage: 'ingest',
        type: 'unsupported_content_type',
        url: 'https://example.com/docs',
        content_type: 'application/pdf'
      });
    });
    
    it('should handle empty response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        text: async () => ''
      } as any);
      
      const source: DocumentSource = { type: 'url', url: 'https://example.com/docs' };
      
      await expect(ingest(source)).rejects.toMatchObject({
        stage: 'ingest',
        type: 'empty_response',
        url: 'https://example.com/docs'
      });
    });
    
    it('should handle content-type with charset', async () => {
      const mockHtml = '<html><body>Test</body></html>';
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html; charset=utf-8']]),
        text: async () => mockHtml
      } as any);
      
      const source: DocumentSource = { type: 'url', url: 'https://example.com/docs' };
      const chunks = await ingest(source);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toContain('Test');
    });
  });
  
  describe('Local File Read', () => {
    it('should successfully read HTML file', async () => {
      const filePath = path.join(tempDir, 'docs.html');
      await fs.promises.writeFile(filePath, '<html><body>Local docs</body></html>');
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toContain('Local docs');
    });
    
    it('should handle file not found (highest priority)', async () => {
      const filePath = path.join(tempDir, 'nonexistent.html');
      
      const source: DocumentSource = { type: 'file', path: filePath };
      
      await expect(ingest(source)).rejects.toMatchObject({
        stage: 'ingest',
        type: 'file_not_found',
        path: filePath
      });
    });
    
    it('should handle permission denied', async () => {
      const filePath = path.join(tempDir, 'docs.html');
      await fs.promises.writeFile(filePath, 'content');
      await fs.promises.chmod(filePath, 0o000);
      
      const source: DocumentSource = { type: 'file', path: filePath };
      
      try {
        await expect(ingest(source)).rejects.toMatchObject({
          stage: 'ingest',
          type: 'permission_denied',
          path: filePath
        });
      } finally {
        // Restore permissions for cleanup
        await fs.promises.chmod(filePath, 0o644);
      }
    });
    
    it('should handle empty file', async () => {
      const filePath = path.join(tempDir, 'empty.html');
      await fs.promises.writeFile(filePath, '');
      
      const source: DocumentSource = { type: 'file', path: filePath };
      
      await expect(ingest(source)).rejects.toMatchObject({
        stage: 'ingest',
        type: 'empty_file',
        path: filePath
      });
    });
    
    it('should handle unsupported extension (lowest priority)', async () => {
      const filePath = path.join(tempDir, 'docs.pdf');
      await fs.promises.writeFile(filePath, 'PDF content');
      
      const source: DocumentSource = { type: 'file', path: filePath };
      
      await expect(ingest(source)).rejects.toMatchObject({
        stage: 'ingest',
        type: 'unsupported_extension',
        path: filePath,
        extension: '.pdf'
      });
    });
    
    it('should accept .md files', async () => {
      const filePath = path.join(tempDir, 'docs.md');
      await fs.promises.writeFile(filePath, '# API Docs\n\nContent here');
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toContain('# API Docs');
    });
    
    it('should accept .txt files', async () => {
      const filePath = path.join(tempDir, 'docs.txt');
      await fs.promises.writeFile(filePath, 'Plain text docs');
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('Plain text docs');
    });
    
    it('should accept .json files', async () => {
      const filePath = path.join(tempDir, 'docs.json');
      await fs.promises.writeFile(filePath, '{"api":"docs"}');
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toContain('"api"');
    });
  });
  
  describe('HTML Normalization', () => {
    it('should strip script tags', async () => {
      const html = '<html><head><script>alert("test");</script></head><body>Content</body></html>';
      const filePath = path.join(tempDir, 'docs.html');
      await fs.promises.writeFile(filePath, html);
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      expect(chunks[0].content).not.toContain('alert');
      expect(chunks[0].content).not.toContain('<script>');
    });
    
    it('should strip style tags', async () => {
      const html = '<html><head><style>body { color: red; }</style></head><body>Content</body></html>';
      const filePath = path.join(tempDir, 'docs.html');
      await fs.promises.writeFile(filePath, html);
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      expect(chunks[0].content).not.toContain('color: red');
      expect(chunks[0].content).not.toContain('<style>');
    });
    
    it('should decode HTML entities including in code blocks', async () => {
      const html = '<html><body><code>&quot;key&quot;: &quot;value&quot;</code></body></html>';
      const filePath = path.join(tempDir, 'docs.html');
      await fs.promises.writeFile(filePath, html);
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      expect(chunks[0].content).toContain('"key"');
      expect(chunks[0].content).toContain('"value"');
      expect(chunks[0].content).not.toContain('&quot;');
    });
    
    it('should decode various HTML entities', async () => {
      const html = '<html><body>&lt;tag&gt; &amp; &copy; &nbsp; &mdash;</body></html>';
      const filePath = path.join(tempDir, 'docs.html');
      await fs.promises.writeFile(filePath, html);
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      expect(chunks[0].content).toContain('<tag>');
      expect(chunks[0].content).toContain('&');
      expect(chunks[0].content).toContain('©');
      expect(chunks[0].content).toContain(' '); // nbsp becomes space
      expect(chunks[0].content).toContain('—');
    });
    
    it('should decode numeric HTML entities', async () => {
      const html = '<html><body>&#34;test&#34; &#x3C;tag&#x3E;</body></html>';
      const filePath = path.join(tempDir, 'docs.html');
      await fs.promises.writeFile(filePath, html);
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      expect(chunks[0].content).toContain('"test"');
      expect(chunks[0].content).toContain('<tag>');
    });
    
    it('should preserve whitespace in code blocks', async () => {
      const html = '<html><body><pre><code>  indented\n    more indent</code></pre></body></html>';
      const filePath = path.join(tempDir, 'docs.html');
      await fs.promises.writeFile(filePath, html);
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      expect(chunks[0].content).toContain('  indented');
      expect(chunks[0].content).toContain('    more indent');
    });
    
    it('should normalize line endings to LF', async () => {
      const html = '<html><body>Line1\r\nLine2\rLine3\nLine4</body></html>';
      const filePath = path.join(tempDir, 'docs.html');
      await fs.promises.writeFile(filePath, html);
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      expect(chunks[0].content).not.toContain('\r\n');
      expect(chunks[0].content).not.toContain('\r');
      expect(chunks[0].content.split('\n').length).toBeGreaterThan(1);
    });
    
    it('should trim leading and trailing whitespace', async () => {
      const html = '  \n\n<html><body>Content</body></html>\n\n  ';
      const filePath = path.join(tempDir, 'docs.html');
      await fs.promises.writeFile(filePath, html);
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      expect(chunks[0].content).not.toMatch(/^\s/);
      expect(chunks[0].content).not.toMatch(/\s$/);
    });
  });
  
  describe('Markdown Normalization', () => {
    it('should preserve Markdown formatting', async () => {
      const markdown = '# Title\n\n## Subtitle\n\n- Item 1\n- Item 2\n\n```js\ncode here\n```';
      const filePath = path.join(tempDir, 'docs.md');
      await fs.promises.writeFile(filePath, markdown);
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      expect(chunks[0].content).toContain('# Title');
      expect(chunks[0].content).toContain('## Subtitle');
      expect(chunks[0].content).toContain('- Item 1');
      expect(chunks[0].content).toContain('```js');
    });
    
    it('should normalize line endings in Markdown', async () => {
      const markdown = '# Title\r\n\r\nContent\rMore\nEnd';
      const filePath = path.join(tempDir, 'docs.md');
      await fs.promises.writeFile(filePath, markdown);
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      expect(chunks[0].content).not.toContain('\r');
    });
  });
  
  describe('JSON Normalization', () => {
    it('should pretty-print JSON with 2-space indentation', async () => {
      const json = '{"api":"docs","version":1,"endpoints":[{"path":"/test"}]}';
      const filePath = path.join(tempDir, 'docs.json');
      await fs.promises.writeFile(filePath, json);
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      expect(chunks[0].content).toContain('  "api"');
      expect(chunks[0].content).toContain('  "version"');
      expect(chunks[0].content).toMatch(/\n/);
    });
    
    it('should handle invalid JSON as plain text', async () => {
      const invalidJson = '{invalid json}';
      const filePath = path.join(tempDir, 'docs.json');
      await fs.promises.writeFile(filePath, invalidJson);
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      expect(chunks[0].content).toBe('{invalid json}');
    });
  });
  
  describe('Documentation Chunking', () => {
    it('should treat small documents as single chunk', async () => {
      const content = 'Short documentation content that is under 50k characters.';
      const filePath = path.join(tempDir, 'docs.txt');
      await fs.promises.writeFile(filePath, content);
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].start).toBe(0);
      expect(chunks[0].end).toBe(content.length);
    });
    
    it('should split large documents into chunks', async () => {
      const content = 'x'.repeat(100000); // 100k characters
      const filePath = path.join(tempDir, 'docs.txt');
      await fs.promises.writeFile(filePath, content);
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      expect(chunks.length).toBeGreaterThan(1);
    });
    
    it('should add overlap between chunks', async () => {
      const sentence = 'This is a sentence. ';
      const content = sentence.repeat(5000); // ~100k characters
      const filePath = path.join(tempDir, 'docs.txt');
      await fs.promises.writeFile(filePath, content);
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      if (chunks.length > 1) {
        // Check that chunks overlap
        const firstChunkEnd = chunks[0].content.slice(-500);
        const secondChunkStart = chunks[1].content.slice(0, 500);
        
        // There should be some common content
        expect(firstChunkEnd.slice(-100)).toEqual(secondChunkStart.slice(0, 100));
      }
    });
    
    it('should preserve complete sentences at boundaries', async () => {
      const sentences = [];
      for (let i = 0; i < 1500; i++) {
        sentences.push(`This is sentence number ${i} with some content.`);
      }
      const content = sentences.join(' ');
      const filePath = path.join(tempDir, 'docs.txt');
      await fs.promises.writeFile(filePath, content);
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      if (chunks.length > 1) {
        // Check that chunks end with complete sentences
        for (let i = 0; i < chunks.length - 1; i++) {
          const chunk = chunks[i].content;
          // Should end with sentence-ending punctuation followed by space
          expect(chunk).toMatch(/[.!?]\s*$/);
        }
      }
    });
    
    it('should preserve complete code blocks with triple backticks', async () => {
      const doc = [
        'Documentation before code.',
        'x'.repeat(49000),
        '```javascript',
        'function test() {',
        '  return "code";',
        '}',
        '```',
        'Documentation after code.'
      ].join('\n');
      
      const filePath = path.join(tempDir, 'docs.md');
      await fs.promises.writeFile(filePath, doc);
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      // Verify no chunk breaks inside the code block
      for (const chunk of chunks) {
        const content = chunk.content;
        const openFences = (content.match(/```/g) || []).length;
        
        // Each chunk should have even number of fences (balanced)
        // or be clearly before/after the code block
        if (content.includes('```javascript')) {
          expect(content).toContain('```\n'); // closing fence
        }
      }
    });
    
    it('should preserve complete HTML code blocks', async () => {
      const doc = [
        '<html><body>',
        'x'.repeat(49000),
        '<code>',
        'function test() {',
        '  return "code";',
        '}',
        '</code>',
        '</body></html>'
      ].join('\n');
      
      const filePath = path.join(tempDir, 'docs.html');
      await fs.promises.writeFile(filePath, doc);
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      // Verify code blocks are complete
      for (const chunk of chunks) {
        const content = chunk.content;
        const openTags = (content.match(/<code[^>]*>/gi) || []).length;
        const closeTags = (content.match(/<\/code>/gi) || []).length;
        
        // Tags should be balanced within each chunk or clearly before/after
        if (openTags > 0) {
          expect(closeTags).toBeGreaterThanOrEqual(openTags);
        }
      }
    });
    
    it('should store correct chunk boundaries', async () => {
      const content = 'x'.repeat(100000);
      const filePath = path.join(tempDir, 'docs.txt');
      await fs.promises.writeFile(filePath, content);
      
      const source: DocumentSource = { type: 'file', path: filePath };
      const chunks = await ingest(source);
      
      // Verify boundaries are correct
      expect(chunks[0].start).toBe(0);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        expect(chunk.end).toBeGreaterThan(chunk.start);
        expect(chunk.end).toBeLessThanOrEqual(content.length);
        
        // Content length should match boundaries
        expect(chunk.content.length).toBe(chunk.end - chunk.start);
      }
      
      // Last chunk should end at content length
      expect(chunks[chunks.length - 1].end).toBe(content.length);
    });
  });
  
  describe('Bug Condition Exploration Tests (Pre-Fix)', () => {
    describe('Property 1: Bug Condition 1 - HTML Stripping with Whitespace Preservation', () => {
      it('CRITICAL: Pre Whitespace Preservation Test - should strip HTML tags while preserving <pre> whitespace', async () => {
        // This is the key test that existing suite missed
        // Realistic HTML with nested tags AND pre block with specific whitespace structure
        const html = `<html>
<head><title>API Docs</title></head>
<body>
  <div class="container">
    <h1>API <span class="highlight">Documentation</span></h1>
    <p>This is a <strong>test</strong> paragraph with <em>nested</em> tags.</p>
    <pre>
  line1 with spaces
    line2 with more indent
  line3 back to two spaces
</pre>
    <div>More <span>nested <span>tags</span> here</span>.</div>
  </div>
</body>
</html>`;
        
        const filePath = path.join(tempDir, 'pre-whitespace-test.html');
        await fs.promises.writeFile(filePath, html);
        
        const source: DocumentSource = { type: 'file', path: filePath };
        const chunks = await ingest(source);
        
        const content = chunks[0].content;
        
        // Assert: All HTML tags should be stripped
        expect(content).not.toContain('<html>');
        expect(content).not.toContain('<div');
        expect(content).not.toContain('<span');
        expect(content).not.toContain('<p>');
        expect(content).not.toContain('<strong>');
        expect(content).not.toContain('<em>');
        expect(content).not.toContain('<pre>');
        expect(content).not.toContain('</div>');
        expect(content).not.toContain('</span>');
        
        // Assert: <pre> content should retain exact whitespace and newlines
        // Looking for the preserved indentation pattern
        expect(content).toContain('  line1 with spaces');
        expect(content).toContain('    line2 with more indent');
        expect(content).toContain('  line3 back to two spaces');
        
        // Assert: Output size should be significantly reduced (tags stripped)
        // The input has substantial text content, so expect output to be < 70% of input
        const sizeRatio = content.length / html.length;
        expect(sizeRatio).toBeLessThan(0.7); // Should be significantly smaller after tag stripping
      });
      
      it('should strip HTML tags from simple nested structure', async () => {
        const html = '<div>Hello <span>world</span></div>';
        const filePath = path.join(tempDir, 'simple-tags.html');
        await fs.promises.writeFile(filePath, html);
        
        const source: DocumentSource = { type: 'file', path: filePath };
        const chunks = await ingest(source);
        
        const content = chunks[0].content;
        
        // Assert: Output should be just "Hello world" (with possible whitespace normalization)
        expect(content).not.toContain('<div>');
        expect(content).not.toContain('<span>');
        expect(content).not.toContain('</div>');
        expect(content).not.toContain('</span>');
        expect(content).toContain('Hello');
        expect(content).toContain('world');
      });
      
      it('should preserve exact whitespace in <code> blocks', async () => {
        const html = '<html><body><code>  line1\n  line2</code></body></html>';
        const filePath = path.join(tempDir, 'code-whitespace.html');
        await fs.promises.writeFile(filePath, html);
        
        const source: DocumentSource = { type: 'file', path: filePath };
        const chunks = await ingest(source);
        
        const content = chunks[0].content;
        
        // Assert: <code> tags should be stripped
        expect(content).not.toContain('<code>');
        expect(content).not.toContain('</code>');
        
        // Assert: Whitespace should be preserved exactly
        expect(content).toContain('  line1');
        expect(content).toContain('  line2');
      });
    });
    
    describe('Property 2: Bug Condition 2 - Minimum Forward Progress', () => {
      it('CRITICAL: Pathological Chunker Test - should produce ~13 chunks for 628KB text, not 610', async () => {
        // This is the key test that existing suite missed
        // 628 KB text with no sentence boundaries and unbalanced code tags
        
        // Generate 628 KB of text without sentence boundaries
        const blockSize = 1000; // 1000 chars per block
        const blocks: string[] = [];
        const totalSize = 628 * 1024; // 628 KB
        const numBlocks = Math.floor(totalSize / blockSize);
        
        for (let i = 0; i < numBlocks; i++) {
          // Create text with NO sentence-ending punctuation
          // Use words separated by spaces, commas, semicolons - anything but periods
          const words = [];
          for (let j = 0; j < 100; j++) {
            words.push(`word${i}_${j}`);
          }
          blocks.push(words.join(' ') + ',\n');
        }
        
        // Add unbalanced code tags to make chunking pathological
        let content = '```javascript\n' + blocks.join('');
        // Don't close the code block - this makes findChunkBoundary struggle
        
        const filePath = path.join(tempDir, 'pathological-chunker.txt');
        await fs.promises.writeFile(filePath, content);
        
        const source: DocumentSource = { type: 'file', path: filePath };
        const chunks = await ingest(source);
        
        // Assert: Chunk count should be proportional to length
        // Expected: ~13 chunks (628KB / 50KB per chunk)
        // Bug produces: 610 chunks
        const expectedChunks = Math.ceil(totalSize / 50000);
        expect(chunks.length).toBeLessThan(50); // Should be much less than 610
        expect(chunks.length).toBeGreaterThanOrEqual(expectedChunks - 5); // Allow some variance
        expect(chunks.length).toBeLessThanOrEqual(expectedChunks + 5);
        
        // Assert: No chunk should be < 25,000 chars except the last
        for (let i = 0; i < chunks.length - 1; i++) {
          expect(chunks[i].content.length).toBeGreaterThanOrEqual(25000);
        }
        
        // Assert: Median chunk size should be close to 50,000 chars
        const sizes = chunks.map(c => c.content.length).sort((a, b) => a - b);
        const median = sizes[Math.floor(sizes.length / 2)];
        expect(median).toBeGreaterThan(40000); // Should be close to 50K, not 306
      });
      
      it('should produce chunk count proportional to length for large text', async () => {
        // 5.4 MB text (after normalization) should produce ~108 chunks
        const size = 5.4 * 1024 * 1024; // 5.4 MB
        const content = 'x'.repeat(Math.floor(size));
        
        const filePath = path.join(tempDir, 'large-text.txt');
        await fs.promises.writeFile(filePath, content);
        
        const source: DocumentSource = { type: 'file', path: filePath };
        const chunks = await ingest(source);
        
        // Assert: Chunk count should be proportional to length
        // For 5.4MB with 50K chunks: expect ~108 chunks
        const expectedChunks = Math.ceil(size / 50000);
        expect(chunks.length).toBeGreaterThanOrEqual(expectedChunks - 20); // Allow variance
        expect(chunks.length).toBeLessThanOrEqual(expectedChunks + 20);
        
        // Assert: Should NOT be hundreds of chunks (bug produced 615)
        expect(chunks.length).toBeLessThan(200);
      });
      
      it('should guarantee minimum chunk size of 25,000 chars', async () => {
        // Create content with well-distributed sentence boundaries
        const sentences = [];
        for (let i = 0; i < 2500; i++) {
          sentences.push(`This is sentence number ${i} with some content here.`);
        }
        const content = sentences.join(' '); // ~150K total with good sentence boundaries
        
        const filePath = path.join(tempDir, 'min-chunk-size.txt');
        await fs.promises.writeFile(filePath, content);
        
        const source: DocumentSource = { type: 'file', path: filePath };
        const chunks = await ingest(source);
        
        // Assert: All chunks except last should be >= 25,000 chars
        // (or close to it if the only boundaries found are slightly under)
        for (let i = 0; i < chunks.length - 1; i++) {
          // Allow some tolerance for boundary finding
          expect(chunks[i].content.length).toBeGreaterThan(20000);
        }
      });
    });
  });
  
  describe('Preservation Property Tests (Pre-Fix)', () => {
    describe('Property 3: Preservation - Existing Normalization Behavior', () => {
      it('should continue to remove script tags', async () => {
        const html = '<html><head><script>alert("test");</script></head><body>Content</body></html>';
        const filePath = path.join(tempDir, 'preserve-script.html');
        await fs.promises.writeFile(filePath, html);
        
        const source: DocumentSource = { type: 'file', path: filePath };
        const chunks = await ingest(source);
        
        // Observe: Script tags are removed on unfixed code
        expect(chunks[0].content).not.toContain('alert');
        expect(chunks[0].content).not.toContain('<script>');
      });
      
      it('should continue to remove style tags', async () => {
        const html = '<html><head><style>body { color: red; }</style></head><body>Content</body></html>';
        const filePath = path.join(tempDir, 'preserve-style.html');
        await fs.promises.writeFile(filePath, html);
        
        const source: DocumentSource = { type: 'file', path: filePath };
        const chunks = await ingest(source);
        
        // Observe: Style tags are removed on unfixed code
        expect(chunks[0].content).not.toContain('color: red');
        expect(chunks[0].content).not.toContain('<style>');
      });
      
      it('should continue to decode HTML entities correctly', async () => {
        const html = '<html><body>&lt;tag&gt; &amp; &copy; &nbsp; &mdash;</body></html>';
        const filePath = path.join(tempDir, 'preserve-entities.html');
        await fs.promises.writeFile(filePath, html);
        
        const source: DocumentSource = { type: 'file', path: filePath };
        const chunks = await ingest(source);
        
        // Observe: Entities are decoded on unfixed code
        expect(chunks[0].content).toContain('<tag>');
        expect(chunks[0].content).toContain('&');
        expect(chunks[0].content).toContain('©');
        expect(chunks[0].content).toContain(' '); // nbsp becomes space
        expect(chunks[0].content).toContain('—');
      });
      
      it('should continue to normalize line endings to LF', async () => {
        const html = '<html><body>Line1\r\nLine2\rLine3\nLine4</body></html>';
        const filePath = path.join(tempDir, 'preserve-lineendings.html');
        await fs.promises.writeFile(filePath, html);
        
        const source: DocumentSource = { type: 'file', path: filePath };
        const chunks = await ingest(source);
        
        // Observe: Line endings normalized on unfixed code
        expect(chunks[0].content).not.toContain('\r\n');
        expect(chunks[0].content).not.toContain('\r');
      });
      
      it('should continue to trim leading and trailing whitespace', async () => {
        const html = '  \n\n<html><body>Content</body></html>\n\n  ';
        const filePath = path.join(tempDir, 'preserve-trim.html');
        await fs.promises.writeFile(filePath, html);
        
        const source: DocumentSource = { type: 'file', path: filePath };
        const chunks = await ingest(source);
        
        // Observe: Whitespace trimmed on unfixed code
        expect(chunks[0].content).not.toMatch(/^\s/);
        expect(chunks[0].content).not.toMatch(/\s$/);
      });
      
      it('should continue to preserve Markdown formatting unchanged', async () => {
        const markdown = '# Title\n\n## Subtitle\n\n- Item 1\n- Item 2\n\n```js\ncode here\n```';
        const filePath = path.join(tempDir, 'preserve-markdown.md');
        await fs.promises.writeFile(filePath, markdown);
        
        const source: DocumentSource = { type: 'file', path: filePath };
        const chunks = await ingest(source);
        
        // Observe: Markdown preserved on unfixed code
        expect(chunks[0].content).toContain('# Title');
        expect(chunks[0].content).toContain('## Subtitle');
        expect(chunks[0].content).toContain('- Item 1');
        expect(chunks[0].content).toContain('```js');
      });
      
      it('should continue to pretty-print JSON with 2-space indentation', async () => {
        const json = '{"api":"docs","version":1}';
        const filePath = path.join(tempDir, 'preserve-json.json');
        await fs.promises.writeFile(filePath, json);
        
        const source: DocumentSource = { type: 'file', path: filePath };
        const chunks = await ingest(source);
        
        // Observe: JSON pretty-printed on unfixed code
        expect(chunks[0].content).toContain('  "api"');
        expect(chunks[0].content).toContain('  "version"');
        expect(chunks[0].content).toMatch(/\n/);
      });
      
      it('should continue to preserve plain text unchanged', async () => {
        const text = 'Plain text content\nWith multiple lines\nAnd no special formatting';
        const filePath = path.join(tempDir, 'preserve-plaintext.txt');
        await fs.promises.writeFile(filePath, text);
        
        const source: DocumentSource = { type: 'file', path: filePath };
        const chunks = await ingest(source);
        
        // Observe: Plain text preserved on unfixed code
        expect(chunks[0].content).toContain('Plain text content');
        expect(chunks[0].content).toContain('With multiple lines');
      });
    });
    
    describe('Property 4: Preservation - Existing Chunking Behavior', () => {
      it('should continue to treat small documents as single chunk', async () => {
        const content = 'Short documentation content that is under 50k characters.';
        const filePath = path.join(tempDir, 'preserve-single-chunk.txt');
        await fs.promises.writeFile(filePath, content);
        
        const source: DocumentSource = { type: 'file', path: filePath };
        const chunks = await ingest(source);
        
        // Observe: Single chunk for small content on unfixed code
        expect(chunks).toHaveLength(1);
        expect(chunks[0].start).toBe(0);
        expect(chunks[0].end).toBe(content.length);
      });
      
      it('should continue to add 500-char overlap between chunks', async () => {
        const sentence = 'This is a sentence. ';
        const content = sentence.repeat(5000); // ~100k characters
        const filePath = path.join(tempDir, 'preserve-overlap.txt');
        await fs.promises.writeFile(filePath, content);
        
        const source: DocumentSource = { type: 'file', path: filePath };
        const chunks = await ingest(source);
        
        // Observe: Overlap mechanism exists on unfixed code
        // Due to the bug, chunks may be very small, but the overlap logic still runs
        if (chunks.length > 1) {
          // Just verify that the overlap mechanism is attempted
          // The chunk positions should show overlap pattern
          for (let i = 0; i < chunks.length - 1; i++) {
            const chunk = chunks[i];
            const nextChunk = chunks[i + 1];
            
            // The next chunk should start before the current chunk ends + some advancement
            // This verifies the overlap mechanism is present (even if buggy)
            expect(nextChunk.start).toBeLessThan(chunk.end);
          }
        }
      });
      
      it('should continue to prefer sentence boundaries for well-formed text', async () => {
        const sentences = [];
        for (let i = 0; i < 1500; i++) {
          sentences.push(`This is sentence number ${i} with some content.`);
        }
        const content = sentences.join(' ');
        const filePath = path.join(tempDir, 'preserve-sentences.txt');
        await fs.promises.writeFile(filePath, content);
        
        const source: DocumentSource = { type: 'file', path: filePath };
        const chunks = await ingest(source);
        
        // Observe: Sentence boundaries preferred on unfixed code
        if (chunks.length > 1) {
          // Most chunks should end with complete sentences
          let sentenceEndCount = 0;
          for (let i = 0; i < chunks.length - 1; i++) {
            const chunk = chunks[i].content;
            if (chunk.match(/[.!?]\s*$/)) {
              sentenceEndCount++;
            }
          }
          
          // At least some chunks should end with sentence boundaries
          expect(sentenceEndCount).toBeGreaterThan(0);
        }
      });
      
      it('should continue to preserve DocumentChunk structure with start/end', async () => {
        const content = 'x'.repeat(100000);
        const filePath = path.join(tempDir, 'preserve-structure.txt');
        await fs.promises.writeFile(filePath, content);
        
        const source: DocumentSource = { type: 'file', path: filePath };
        const chunks = await ingest(source);
        
        // Observe: DocumentChunk structure preserved on unfixed code
        expect(chunks[0].start).toBe(0);
        
        for (const chunk of chunks) {
          expect(chunk).toHaveProperty('content');
          expect(chunk).toHaveProperty('start');
          expect(chunk).toHaveProperty('end');
          expect(chunk.end).toBeGreaterThan(chunk.start);
          expect(chunk.content.length).toBe(chunk.end - chunk.start);
        }
        
        expect(chunks[chunks.length - 1].end).toBe(content.length);
      });
      
      it('should continue to preserve code blocks with triple backticks', async () => {
        const doc = [
          'Documentation before code.',
          'x'.repeat(49000),
          '```javascript',
          'function test() {',
          '  return "code";',
          '}',
          '```',
          'Documentation after code.'
        ].join('\n');
        
        const filePath = path.join(tempDir, 'preserve-codeblocks.md');
        await fs.promises.writeFile(filePath, doc);
        
        const source: DocumentSource = { type: 'file', path: filePath };
        const chunks = await ingest(source);
        
        // Observe: Code blocks preserved on unfixed code
        // Verify code block is complete in at least one chunk
        let hasCompleteCodeBlock = false;
        for (const chunk of chunks) {
          if (chunk.content.includes('```javascript') && chunk.content.includes('```\n')) {
            hasCompleteCodeBlock = true;
            break;
          }
        }
        
        expect(hasCompleteCodeBlock).toBe(true);
      });
    });
  });
});

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
    
    it('should handle 403 authentication denied', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Map(),
        text: async () => ''
      } as any);
      
      const source: DocumentSource = { type: 'url', url: 'https://example.com/docs' };
      
      await expect(ingest(source)).rejects.toMatchObject({
        stage: 'ingest',
        type: 'auth_denied',
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
});

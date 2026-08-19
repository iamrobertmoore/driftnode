/**
 * Stage 1: Ingest
 * 
 * Fetches or reads documentation, normalizes to text, and splits into chunks.
 * Implements layered error precedence as specified in Requirements 1 and 2.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DocumentSource, DocumentChunk, GeneratorConfig } from './types.js';
import { GeneratorError } from './errors.js';

/**
 * Identify the tool honestly rather than impersonating a browser.
 *
 * Node's fetch sends no User-Agent at all, which many documentation sites
 * reject at the edge with a 403. A vendor who wants to block automated
 * documentation readers should be able to, so this says what it is and where
 * to find it rather than pretending to be Chrome.
 */
const DEFAULT_USER_AGENT =
  'driftnode/0.1.0 (+https://github.com/iamrobertmoore/driftnode)';

/**
 * Ingest documentation from a URL or local file
 * 
 * @param source - Documentation source (URL or file path)
 * @param config - Optional generator config, used here for the User-Agent override
 * @returns Array of document chunks
 */
export async function ingest(
  source: DocumentSource,
  config?: Partial<GeneratorConfig>
): Promise<DocumentChunk[]> {
  let content: string;
  
  if (source.type === 'url') {
    const result = await fetchRemote(source.url, config?.userAgent);
    if (isError(result)) {
      throw result;
    }
    content = result;
  } else {
    const result = await readLocal(source.path);
    if (isError(result)) {
      throw result;
    }
    content = result;
  }
  
  // Normalize based on content type
  const normalized = await normalize(content, source);
  
  // Chunk if necessary (Task 2.4: pass chunk configuration)
  return chunk(
    normalized,
    config?.chunkSize,
    config?.chunkOverlap
  );
}

/**
 * Fetch documentation from a remote URL
 * Implements layered error precedence: transport > HTTP status > payload
 */
async function fetchRemote(
  url: string,
  userAgent?: string
): Promise<string | GeneratorError> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': userAgent ?? DEFAULT_USER_AGENT,
          Accept: 'text/html, text/markdown, text/plain, application/json'
        }
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // HTTP status layer (after transport succeeds)
    // 401 and 403 are separated deliberately. A 401 means the documentation
    // genuinely requires credentials. A 403 on a public documentation page is
    // far more often bot protection reacting to a missing or unfamiliar
    // User-Agent, and telling the user it is an authentication problem sends
    // them looking in the wrong place.
    if (response.status === 401) {
      return {
        stage: 'ingest',
        type: 'auth_denied',
        url,
        status_code: 401
      };
    }

    if (response.status === 403) {
      return {
        stage: 'ingest',
        type: 'bot_protection',
        url,
        status_code: 403
      };
    }
    
    if (response.status === 404) {
      return {
        stage: 'ingest',
        type: 'not_found',
        url
      };
    }
    
    if (!response.ok) {
      return {
        stage: 'ingest',
        type: 'http_error',
        url,
        status_code: response.status
      };
    }
    
    // Payload layer (after HTTP succeeds)
    const contentType = response.headers.get('content-type') || '';
    if (!isSupportedContentType(contentType)) {
      return {
        stage: 'ingest',
        type: 'unsupported_content_type',
        url,
        content_type: contentType
      };
    }
    
    const body = await response.text();
    if (body.length === 0) {
      return {
        stage: 'ingest',
        type: 'empty_response',
        url
      };
    }
    
    return body;
    
  } catch (error: any) {
    // Transport layer (highest priority)
    if (error.name === 'AbortError') {
      return {
        stage: 'ingest',
        type: 'timeout',
        url,
        timeout_seconds: 30
      };
    }
    
    return {
      stage: 'ingest',
      type: 'network_error',
      url,
      message: error.message || 'Unknown network error'
    };
  }
}

/**
 * Read documentation from a local file
 * Implements layered error precedence: existence > permissions > empty > extension
 */
async function readLocal(filePath: string): Promise<string | GeneratorError> {
  // File existence layer (highest priority)
  if (!fs.existsSync(filePath)) {
    return {
      stage: 'ingest',
      type: 'file_not_found',
      path: filePath
    };
  }
  
  // Permissions layer
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
  } catch {
    return {
      stage: 'ingest',
      type: 'permission_denied',
      path: filePath
    };
  }
  
  const content = await fs.promises.readFile(filePath, 'utf-8');
  
  // Empty file layer
  if (content.length === 0) {
    return {
      stage: 'ingest',
      type: 'empty_file',
      path: filePath
    };
  }
  
  // Extension layer (lowest priority)
  const ext = path.extname(filePath).toLowerCase();
  if (!['.html', '.md', '.txt', '.json'].includes(ext)) {
    return {
      stage: 'ingest',
      type: 'unsupported_extension',
      path: filePath,
      extension: ext
    };
  }
  
  return content;
}

/**
 * Check if a content type is supported
 */
function isSupportedContentType(contentType: string): boolean {
  const supportedTypes = [
    'text/html',
    'text/plain',
    'text/markdown',
    'application/json'
  ];
  
  // Content-Type may include charset, e.g., "text/html; charset=utf-8"
  const parts = contentType.split(';');
  const baseType = parts[0]?.trim().toLowerCase() || '';
  return supportedTypes.includes(baseType);
}

/**
 * Normalize content based on type
 */
async function normalize(content: string, source: DocumentSource): Promise<string> {
  let ext: string;
  
  if (source.type === 'url') {
    // Detect type from content for URLs
    if (content.trimStart().startsWith('{') || content.trimStart().startsWith('[')) {
      ext = '.json';
    } else if (content.includes('<html') || content.includes('<!DOCTYPE')) {
      ext = '.html';
    } else if (content.includes('```') || content.includes('#')) {
      ext = '.md';
    } else {
      ext = '.txt';
    }
  } else {
    ext = path.extname(source.path).toLowerCase();
  }
  
  let normalized: string;
  
  if (ext === '.html') {
    normalized = normalizeHtml(content);
  } else if (ext === '.json') {
    normalized = normalizeJson(content);
  } else if (ext === '.md') {
    normalized = normalizeMarkdown(content);
  } else {
    normalized = normalizeText(content);
  }
  
  return normalized;
}

/**
 * Normalize HTML content
 * - Strip script and style tags
 * - Strip all other HTML tags while preserving text content
 * - Preserve exact whitespace in <pre> and <code> blocks
 * - Convert HTML entities (including inside code blocks)
 * - Collapse multiple spaces/newlines in regular text
 * - Normalize line endings
 * - Trim whitespace
 */
function normalizeHtml(html: string): string {
  let text = html;
  
  // Strip script and style tags completely
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Step 1: Extract and preserve <pre> and <code> blocks with placeholders
  const codeBlocks: string[] = [];
  let codeBlockIndex = 0;
  
  // Extract <pre> blocks (with any attributes) - preserve inner HTML for nested tags
  text = text.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (match, content) => {
    // Strip any nested tags from the content but preserve exact whitespace
    let cleanContent = content.replace(/<[^>]+>/g, '');
    codeBlocks[codeBlockIndex] = cleanContent;
    // Use a placeholder WITHOUT adding newlines
    const placeholder = `__CODEBLOCK${codeBlockIndex}__`;
    codeBlockIndex++;
    return placeholder;
  });
  
  // Extract <code> blocks (with any attributes)
  text = text.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (match, content) => {
    // Strip any nested tags from the content but preserve exact whitespace
    let cleanContent = content.replace(/<[^>]+>/g, '');
    codeBlocks[codeBlockIndex] = cleanContent;
    const placeholder = `__CODEBLOCK${codeBlockIndex}__`;
    codeBlockIndex++;
    return placeholder;
  });
  
  // Step 2: Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Step 3: Collapse whitespace in non-code content
  // Replace multiple spaces with single space (but not around our placeholders)
  text = text.replace(/ {2,}/g, ' ');
  // Replace multiple newlines with single newline
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // Step 4: Decode HTML entities AFTER whitespace collapse
  text = decodeHtmlEntities(text);
  
  // Step 5: Normalize line endings to LF
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Step 6: Trim leading and trailing whitespace (before restoring code blocks)
  text = text.trim();
  
  // Step 7: Restore code blocks with preserved whitespace
  for (let i = 0; i < codeBlocks.length; i++) {
    const placeholder = `__CODEBLOCK${i}__`;
    // Decode entities in code block content but preserve exact whitespace
    const codeBlock = codeBlocks[i];
    if (codeBlock !== undefined) {
      const decodedCodeBlock = decodeHtmlEntities(codeBlock);
      text = text.replace(placeholder, decodedCodeBlock);
    }
  }
  
  return text;
}

/**
 * Normalize Markdown content
 * - Preserve formatting as-is
 * - Normalize line endings
 * - Trim whitespace
 */
function normalizeMarkdown(markdown: string): string {
  let text = markdown;
  
  // Normalize line endings to LF
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Trim leading and trailing whitespace
  text = text.trim();
  
  return text;
}

/**
 * Normalize JSON content
 * - Pretty-print with 2-space indentation
 * - Normalize line endings
 * - Trim whitespace
 */
function normalizeJson(json: string): string {
  try {
    const parsed = JSON.parse(json);
    let text = JSON.stringify(parsed, null, 2);
    
    // Normalize line endings to LF
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Trim leading and trailing whitespace
    text = text.trim();
    
    return text;
  } catch {
    // If JSON parsing fails, treat as plain text
    return normalizeText(json);
  }
}

/**
 * Normalize plain text content
 * - Normalize line endings
 * - Trim whitespace
 */
function normalizeText(text: string): string {
  // Normalize line endings to LF
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Trim leading and trailing whitespace
  text = text.trim();
  
  return text;
}

/**
 * Decode HTML entities to text equivalents
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&quot;': '"',
    '&#34;': '"',
    '&apos;': "'",
    '&#39;': "'",
    '&lt;': '<',
    '&#60;': '<',
    '&gt;': '>',
    '&#62;': '>',
    '&amp;': '&',
    '&#38;': '&',
    '&nbsp;': ' ',
    '&#160;': ' ',
    '&copy;': '©',
    '&#169;': '©',
    '&reg;': '®',
    '&#174;': '®',
    '&trade;': '™',
    '&#8482;': '™',
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&lsquo;': '\u2018',
    '&rsquo;': '\u2019',
    '&mdash;': '\u2014',
    '&ndash;': '\u2013'
  };
  
  let decoded = text;
  
  // Replace named entities
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.split(entity).join(char);
  }
  
  // Replace numeric entities (&#123; or &#xABC;)
  decoded = decoded.replace(/&#(\d+);/g, (_, dec) => {
    return String.fromCharCode(parseInt(dec, 10));
  });
  
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  
  return decoded;
}

/**
 * Split documentation into chunks if it exceeds the maximum chunk size
 * - Guarantee minimum chunk size of chunkSize / 2
 * - Guarantee minimum forward progress of chunkSize - chunkOverlap per iteration
 * - Preserve complete sentences
 * - Preserve complete code blocks
 * - Add overlap for context
 * 
 * @param content - Normalized documentation content
 * @param chunkSize - Maximum characters per chunk (default: 15,000)
 * @param chunkOverlap - Characters of overlap between chunks (default: 150)
 */
function chunk(
  content: string,
  chunkSize: number = 15000,
  chunkOverlap: number = 150
): DocumentChunk[] {
  const MAX_CHUNK_SIZE = chunkSize;
  const OVERLAP_SIZE = chunkOverlap;
  const MIN_CHUNK_SIZE = MAX_CHUNK_SIZE / 2;
  const MIN_ADVANCEMENT = MAX_CHUNK_SIZE - OVERLAP_SIZE;
  
  if (content.length <= MAX_CHUNK_SIZE) {
    return [{
      content,
      start: 0,
      end: content.length
    }];
  }
  
  const chunks: DocumentChunk[] = [];
  let position = 0;
  
  while (position < content.length) {
    let chunkEnd = Math.min(position + MAX_CHUNK_SIZE, content.length);
    
    // If not at the end, find a good break point
    if (chunkEnd < content.length) {
      chunkEnd = findChunkBoundary(content, position, chunkEnd, MAX_CHUNK_SIZE);
      
      // Enforce minimum chunk size: if chunkEnd is too close to position,
      // force it to at least MIN_CHUNK_SIZE
      if (chunkEnd - position < MIN_CHUNK_SIZE) {
        chunkEnd = Math.min(position + MAX_CHUNK_SIZE, content.length);
      }
    }
    
    chunks.push({
      content: content.slice(position, chunkEnd),
      start: position,
      end: chunkEnd
    });
    
    // Move to next chunk with overlap
    // Enforce minimum advancement to guarantee forward progress
    const nextPosition = chunkEnd - OVERLAP_SIZE;
    if (nextPosition <= position) {
      // Guard against stall: force advancement
      position = position + MIN_ADVANCEMENT;
    } else {
      position = nextPosition;
    }
  }
  
  return chunks;
}

/**
 * Find a good chunk boundary that preserves sentences and code blocks
 * Never returns a position less than start + maxChunkSize / 2
 * to guarantee minimum forward progress
 * 
 * @param content - Full document content
 * @param start - Start position of current chunk
 * @param idealEnd - Ideal end position (start + maxChunkSize)
 * @param maxChunkSize - Maximum chunk size in characters
 */
function findChunkBoundary(
  content: string,
  start: number,
  idealEnd: number,
  maxChunkSize: number
): number {
  const MIN_BOUNDARY = start + (maxChunkSize / 2);
  
  // Check if we're inside a code block
  const beforeIdealEnd = content.slice(start, idealEnd);
  
  // Count code block fences (```) before ideal end
  const tripleBackticksBefore = (beforeIdealEnd.match(/```/g) || []).length;
  
  // Count HTML code tags before ideal end
  const codeTagsOpenBefore = (beforeIdealEnd.match(/<code[^>]*>/gi) || []).length;
  const codeTagsCloseBefore = (beforeIdealEnd.match(/<\/code>/gi) || []).length;
  
  // If odd number of fences or unclosed code tags, we're inside a code block
  const insideTripleBacktickBlock = tripleBackticksBefore % 2 === 1;
  const insideCodeTag = codeTagsOpenBefore > codeTagsCloseBefore;
  
  if (insideTripleBacktickBlock) {
    // Find the closing ``` after idealEnd
    const afterIdealEnd = content.slice(idealEnd);
    const closingFence = afterIdealEnd.indexOf('```');
    if (closingFence !== -1) {
      const boundary = idealEnd + closingFence + 3; // Include the closing ```
      // Only use this boundary if it meets minimum requirement
      if (boundary >= MIN_BOUNDARY) {
        return boundary;
      }
    }
  }
  
  if (insideCodeTag) {
    // Find the closing </code> after idealEnd
    const afterIdealEnd = content.slice(idealEnd);
    const closingTag = afterIdealEnd.search(/<\/code>/i);
    if (closingTag !== -1) {
      const boundary = idealEnd + closingTag + 7; // Include </code>
      // Only use this boundary if it meets minimum requirement
      if (boundary >= MIN_BOUNDARY) {
        return boundary;
      }
    }
  }
  
  // Not inside a code block, find a sentence boundary
  // Look backwards from idealEnd for sentence-ending punctuation
  const searchStart = Math.max(start, idealEnd - 500);
  const searchText = content.slice(searchStart, idealEnd);
  
  // Find last sentence boundary (. ! ? followed by space or newline)
  const sentenceEndings = [
    searchText.lastIndexOf('. '),
    searchText.lastIndexOf('.\n'),
    searchText.lastIndexOf('! '),
    searchText.lastIndexOf('!\n'),
    searchText.lastIndexOf('? '),
    searchText.lastIndexOf('?\n')
  ];
  
  const lastSentenceEnd = Math.max(...sentenceEndings);
  
  if (lastSentenceEnd !== -1) {
    const boundary = searchStart + lastSentenceEnd + 2; // Move past punctuation and space/newline
    // Only use this boundary if it meets minimum requirement
    if (boundary >= MIN_BOUNDARY) {
      return boundary;
    }
  }
  
  // No sentence boundary found, look for paragraph break
  const lastParagraph = searchText.lastIndexOf('\n\n');
  if (lastParagraph !== -1) {
    const boundary = searchStart + lastParagraph + 2;
    // Only use this boundary if it meets minimum requirement
    if (boundary >= MIN_BOUNDARY) {
      return boundary;
    }
  }
  
  // No good boundary found that meets minimum, return idealEnd to guarantee progress
  return idealEnd;
}

/**
 * Type guard to check if a value is a GeneratorError
 */
function isError(value: string | GeneratorError): value is GeneratorError {
  return typeof value === 'object' && 'stage' in value && 'type' in value;
}

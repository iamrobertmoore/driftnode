/**
 * Persistent chunk IR cache for extraction results
 * 
 * This module provides persistent caching of extracted chunk IRs to avoid
 * re-extracting unchanged documentation chunks during iteration.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { PartialIR } from './types.js';

/**
 * Get the cache directory path for the platform
 * 
 * Uses OS-appropriate cache directory:
 * - macOS/Linux: ~/.cache/driftnode
 * - Windows: %LOCALAPPDATA%/driftnode
 * 
 * @returns Absolute path to cache directory
 */
export function getCacheDirectory(): string {
  const platform = os.platform();
  
  if (platform === 'win32') {
    // Windows: use LOCALAPPDATA
    const localAppData = process.env.LOCALAPPDATA;
    if (!localAppData) {
      throw new Error('LOCALAPPDATA environment variable not set');
    }
    return path.join(localAppData, 'driftnode');
  } else {
    // macOS/Linux: use ~/.cache/driftnode
    const homeDir = os.homedir();
    return path.join(homeDir, '.cache', 'driftnode');
  }
}

/**
 * Ensure the cache directory exists
 * 
 * @param cacheDir - Cache directory path
 */
export async function ensureCacheDirectory(cacheDir: string): Promise<void> {
  await fs.promises.mkdir(cacheDir, { recursive: true });
}

/**
 * Compute cache key from chunk content and extraction prompt
 * 
 * The cache key is a combination of:
 * 1. SHA-256 hash of chunk content
 * 2. SHA-256 hash of extraction prompt
 * 
 * This ensures cache invalidation when either the content or the
 * extraction logic (prompt) changes.
 * 
 * @param chunkContent - Content of the documentation chunk
 * @param extractionPrompt - Prompt used for extraction
 * @returns Cache key string
 */
export function computeCacheKey(chunkContent: string, extractionPrompt: string): string {
  const contentHash = crypto.createHash('sha256').update(chunkContent, 'utf-8').digest('hex');
  const promptHash = crypto.createHash('sha256').update(extractionPrompt, 'utf-8').digest('hex');
  
  // Combine hashes with a separator
  return `${contentHash}-${promptHash}`;
}

/**
 * Check if a cache entry exists for the given key
 * 
 * @param cacheDir - Cache directory path
 * @param cacheKey - Cache key
 * @returns True if cache entry exists and is readable
 */
export async function cacheEntryExists(cacheDir: string, cacheKey: string): Promise<boolean> {
  const cachePath = path.join(cacheDir, `${cacheKey}.json`);
  
  try {
    await fs.promises.access(cachePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a partial IR from cache
 * 
 * @param cacheDir - Cache directory path
 * @param cacheKey - Cache key
 * @returns Cached partial IR, or null if cache miss or parse error
 */
export async function readFromCache(cacheDir: string, cacheKey: string): Promise<PartialIR | null> {
  const cachePath = path.join(cacheDir, `${cacheKey}.json`);
  
  try {
    const fileContent = await fs.promises.readFile(cachePath, 'utf-8');
    const partialIR = JSON.parse(fileContent) as PartialIR;
    return partialIR;
  } catch {
    // Treat any error (missing file, parse error) as cache miss
    return null;
  }
}

/**
 * Write a partial IR to cache
 * 
 * @param cacheDir - Cache directory path
 * @param cacheKey - Cache key
 * @param partialIR - Partial IR to cache
 */
export async function writeToCache(
  cacheDir: string,
  cacheKey: string,
  partialIR: PartialIR
): Promise<void> {
  const cachePath = path.join(cacheDir, `${cacheKey}.json`);
  const jsonContent = JSON.stringify(partialIR, null, 2);
  
  await fs.promises.writeFile(cachePath, jsonContent, 'utf-8');
}

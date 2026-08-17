/**
 * Configuration file parsing and validation for the driftnode generator
 */

import * as fs from 'fs';
import * as path from 'path';
import { GeneratorConfig, DocumentSource } from './types.js';

/**
 * Load and validate a generator configuration file
 * 
 * @param configPath - Path to the JSON configuration file
 * @returns Parsed and validated GeneratorConfig
 * @throws Error if the configuration file is invalid
 */
export async function loadConfig(configPath: string): Promise<GeneratorConfig> {
  // Validate that the config file exists
  const absolutePath = path.resolve(configPath);
  
  if (!fs.existsSync(absolutePath)) {
    throw new Error(
      `Configuration file not found: ${absolutePath}\n\n` +
      `Provide a valid path to a configuration file.`
    );
  }

  // Read the configuration file
  let fileContent: string;
  try {
    fileContent = await fs.promises.readFile(absolutePath, 'utf-8');
  } catch (error) {
    throw new Error(
      `Failed to read configuration file: ${absolutePath}\n` +
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileContent);
  } catch (error) {
    throw new Error(
      `Configuration file contains invalid JSON: ${absolutePath}\n` +
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Validate structure
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(
      `Configuration file must contain a JSON object.\n` +
      `Found: ${typeof parsed}`
    );
  }

  const config = parsed as Record<string, unknown>;

  // Validate required field: vendor
  if (!config.vendor || typeof config.vendor !== 'string') {
    throw new Error(
      `Configuration missing required field: vendor\n\n` +
      `The vendor field must be a string (e.g., "vultr").`
    );
  }

  // Validate required field: documentation
  if (!config.documentation) {
    throw new Error(
      `Configuration missing required field: documentation\n\n` +
      `The documentation field must specify a source:\n` +
      `  { "type": "url", "url": "https://..." }\n` +
      `or\n` +
      `  { "type": "file", "path": "/path/to/docs.html" }`
    );
  }

  // Validate documentation source structure
  const documentation = validateDocumentSource(config.documentation, absolutePath);

  // Validate optional include field
  let include: GeneratorConfig['include'] | undefined;
  if (config.include !== undefined) {
    include = validateInclude(config.include);
  }

  return {
    vendor: config.vendor as string,
    documentation,
    include,
  };
}

/**
 * Validate DocumentSource structure
 */
function validateDocumentSource(
  value: unknown,
  configPath: string
): DocumentSource {
  if (typeof value !== 'object' || value === null) {
    throw new Error(
      `Configuration field "documentation" must be an object.\n` +
      `Expected: { "type": "url", "url": "..." } or { "type": "file", "path": "..." }\n` +
      `Found: ${typeof value}`
    );
  }

  const doc = value as Record<string, unknown>;

  if (!doc.type || typeof doc.type !== 'string') {
    throw new Error(
      `Documentation source missing "type" field.\n` +
      `Expected: "url" or "file"`
    );
  }

  if (doc.type === 'url') {
    if (!doc.url || typeof doc.url !== 'string') {
      throw new Error(
        `Documentation source with type "url" must include a "url" field.\n` +
        `Example: { "type": "url", "url": "https://api.example.com/docs" }`
      );
    }

    // Basic URL validation
    try {
      new URL(doc.url);
    } catch {
      throw new Error(
        `Invalid URL in documentation source: ${doc.url}\n` +
        `Provide a valid HTTP or HTTPS URL.`
      );
    }

    return { type: 'url', url: doc.url };
  }

  if (doc.type === 'file') {
    if (!doc.path || typeof doc.path !== 'string') {
      throw new Error(
        `Documentation source with type "file" must include a "path" field.\n` +
        `Example: { "type": "file", "path": "/path/to/docs.html" }`
      );
    }

    // Validate that the file exists
    const configDir = path.dirname(configPath);
    const filePath = path.resolve(configDir, doc.path);

    if (!fs.existsSync(filePath)) {
      throw new Error(
        `Documentation file not found: ${filePath}\n\n` +
        `Specified in configuration as: ${doc.path}\n` +
        `Provide a valid path to an existing documentation file.`
      );
    }

    return { type: 'file', path: doc.path };
  }

  throw new Error(
    `Invalid documentation source type: ${doc.type}\n` +
    `Expected: "url" or "file"`
  );
}

/**
 * Validate include field structure
 */
function validateInclude(value: unknown): GeneratorConfig['include'] {
  if (!Array.isArray(value)) {
    throw new Error(
      `Configuration field "include" must be an array.\n` +
      `Example: [{ "resource": "instances", "operations": ["list", "create"] }]`
    );
  }

  return value.map((item, index) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(
        `Include array item at index ${index} must be an object.\n` +
        `Expected: { "resource": "...", "operations": [...] }`
      );
    }

    const includeItem = item as Record<string, unknown>;

    if (!includeItem.resource || typeof includeItem.resource !== 'string') {
      throw new Error(
        `Include array item at index ${index} missing required field "resource".\n` +
        `Each item must specify which resource to include.`
      );
    }

    let operations: string[] | undefined;
    if (includeItem.operations !== undefined) {
      if (!Array.isArray(includeItem.operations)) {
        throw new Error(
          `Include array item at index ${index} field "operations" must be an array.\n` +
          `Example: ["list", "create", "delete"]`
        );
      }

      operations = includeItem.operations.map((op, opIndex) => {
        if (typeof op !== 'string') {
          throw new Error(
            `Include array item at index ${index}, operation at index ${opIndex} must be a string.`
          );
        }
        return op;
      });
    }

    return {
      resource: includeItem.resource as string,
      operations,
    };
  });
}

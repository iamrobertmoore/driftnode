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

  if (config.userAgent !== undefined && typeof config.userAgent !== 'string') {
    throw new Error(
      `Configuration field "userAgent" must be a string.\n` +
      `Example: "mytool/1.0 (+https://example.com/mytool)"`
    );
  }

  // Validate effort field (Task 1.2)
  if (config.effort !== undefined) {
    const validEfforts = ['low', 'medium', 'high', 'xhigh', 'max'];
    if (typeof config.effort !== 'string' || !validEfforts.includes(config.effort)) {
      throw new Error(
        `Configuration field "effort" must be one of: ${validEfforts.join(', ')}\n` +
        `Found: ${config.effort}`
      );
    }
  }

  // Validate chunkSize (Task 2.3)
  if (config.chunkSize !== undefined) {
    if (typeof config.chunkSize !== 'number' || config.chunkSize < 1000) {
      throw new Error(
        `Configuration field "chunkSize" must be a number of at least 1000 characters.\n` +
        `Found: ${config.chunkSize}`
      );
    }
  }

  // Validate chunkOverlap (Task 2.3)
  if (config.chunkOverlap !== undefined) {
    if (typeof config.chunkOverlap !== 'number') {
      throw new Error(
        `Configuration field "chunkOverlap" must be a number.\n` +
        `Found: ${config.chunkOverlap}`
      );
    }
    
    // If chunkSize is also provided, validate chunkOverlap < chunkSize
    const effectiveChunkSize = config.chunkSize ?? 15000; // Use default if not provided
    if (config.chunkOverlap >= effectiveChunkSize) {
      throw new Error(
        `Configuration field "chunkOverlap" must be less than chunkSize.\n` +
        `chunkOverlap: ${config.chunkOverlap}, chunkSize: ${effectiveChunkSize}`
      );
    }
  }

  // Validate concurrency (Task 3.2)
  if (config.concurrency !== undefined) {
    if (typeof config.concurrency !== 'number' || config.concurrency < 1) {
      throw new Error(
        `Configuration field "concurrency" must be a number of at least 1.\n` +
        `Found: ${config.concurrency}`
      );
    }
  }

  // Validate extractionTimeoutSeconds (Task 4.2)
  if (config.extractionTimeoutSeconds !== undefined) {
    if (typeof config.extractionTimeoutSeconds !== 'number' || config.extractionTimeoutSeconds < 30) {
      throw new Error(
        `Configuration field "extractionTimeoutSeconds" must be a number of at least 30 seconds.\n` +
        `Found: ${config.extractionTimeoutSeconds}`
      );
    }
  }

  // Validate auth override field
  let authOverride: GeneratorConfig['auth'] | undefined;
  if (config.auth !== undefined) {
    authOverride = validateAuthScheme(config.auth);
  }

  return {
    vendor: config.vendor as string,
    documentation,
    include,
    ...(config.userAgent !== undefined
      ? { userAgent: config.userAgent as string }
      : {}),
    ...(config.effort !== undefined
      ? { effort: config.effort as GeneratorConfig['effort'] }
      : {}),
    ...(config.chunkSize !== undefined
      ? { chunkSize: config.chunkSize as number }
      : {}),
    ...(config.chunkOverlap !== undefined
      ? { chunkOverlap: config.chunkOverlap as number }
      : {}),
    ...(config.concurrency !== undefined
      ? { concurrency: config.concurrency as number }
      : {}),
    ...(config.extractionTimeoutSeconds !== undefined
      ? { extractionTimeoutSeconds: config.extractionTimeoutSeconds as number }
      : {}),
    ...(authOverride !== undefined
      ? { auth: authOverride }
      : {}),
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

    // Return the resolved absolute path, not the original relative string.
    //
    // Relative paths in a config file are resolved against the config file's
    // own directory, so the config is portable and can be run from anywhere.
    // Returning the unresolved string here would leave every downstream stage
    // to resolve it again against the working directory, which is a different
    // base and silently produces "file not found" after validation passed.
    return { type: 'file', path: filePath };
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

/**
 * Validate AuthenticationScheme structure
 */
function validateAuthScheme(value: unknown): GeneratorConfig['auth'] {
  if (typeof value !== 'object' || value === null) {
    throw new Error(
      `Configuration field "auth" must be an object.\n` +
      `Expected authentication scheme with a "type" field.`
    );
  }

  const auth = value as Record<string, unknown>;

  if (!auth.type || typeof auth.type !== 'string') {
    throw new Error(
      `Authentication scheme missing "type" field.\n` +
      `Expected one of: api_key, bearer_token, basic, oauth2`
    );
  }

  // Validate based on type
  switch (auth.type) {
    case 'api_key':
      if (!auth.location || typeof auth.location !== 'string') {
        throw new Error(
          `Authentication scheme with type "api_key" must include a "location" field.\n` +
          `Expected: "header", "query", or "body"`
        );
      }

      if (auth.location === 'header') {
        if (!auth.header_name || typeof auth.header_name !== 'string') {
          throw new Error(
            `Authentication scheme with type "api_key" and location "header" must include "header_name" field.`
          );
        }
        return {
          type: 'api_key',
          location: 'header',
          header_name: auth.header_name as string,
        };
      } else if (auth.location === 'query') {
        if (!auth.query_param_name || typeof auth.query_param_name !== 'string') {
          throw new Error(
            `Authentication scheme with type "api_key" and location "query" must include "query_param_name" field.`
          );
        }
        return {
          type: 'api_key',
          location: 'query',
          query_param_name: auth.query_param_name as string,
        };
      } else if (auth.location === 'body') {
        if (!auth.body_field_name || typeof auth.body_field_name !== 'string') {
          throw new Error(
            `Authentication scheme with type "api_key" and location "body" must include "body_field_name" field.`
          );
        }
        return {
          type: 'api_key',
          location: 'body',
          body_field_name: auth.body_field_name as string,
        };
      } else {
        throw new Error(
          `Invalid location for api_key authentication: ${auth.location}\n` +
          `Expected: "header", "query", or "body"`
        );
      }

    case 'bearer_token':
      if (!auth.header_name || typeof auth.header_name !== 'string') {
        throw new Error(
          `Authentication scheme with type "bearer_token" must include "header_name" field.`
        );
      }
      return {
        type: 'bearer_token',
        header_name: auth.header_name as string,
      };

    case 'basic':
      return { type: 'basic' };

    case 'oauth2':
      if (!auth.authorize_url || typeof auth.authorize_url !== 'string') {
        throw new Error(
          `Authentication scheme with type "oauth2" must include "authorize_url" field.`
        );
      }
      if (!auth.token_url || typeof auth.token_url !== 'string') {
        throw new Error(
          `Authentication scheme with type "oauth2" must include "token_url" field.`
        );
      }

      const oauth2Scheme: any = {
        type: 'oauth2',
        authorize_url: auth.authorize_url as string,
        token_url: auth.token_url as string,
      };

      if (auth.scopes !== undefined) {
        if (!Array.isArray(auth.scopes)) {
          throw new Error(
            `Authentication scheme field "scopes" must be an array of strings.`
          );
        }
        oauth2Scheme.scopes = auth.scopes as string[];
      }

      return oauth2Scheme;

    default:
      throw new Error(
        `Invalid authentication type: ${auth.type}\n` +
        `Expected one of: api_key, bearer_token, basic, oauth2`
      );
  }
}

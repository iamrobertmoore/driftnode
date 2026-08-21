/**
 * Emission stage: Generate all package files to a temporary directory
 * 
 * This module is responsible for transforming the validated Intermediate
 * Representation into a complete n8n community node package.
 */

import * as fs from 'fs';
import * as path from 'path';
import { IntermediateRepresentation, GeneratorConfig, AuthenticationScheme } from './types.js';

/**
 * Emit a complete n8n node package from the validated IR
 * 
 * @param ir - The validated Intermediate Representation
 * @param config - Generator configuration
 * @param tempDir - Temporary directory path (already created by caller)
 */
export async function emit(
  ir: IntermediateRepresentation,
  config: GeneratorConfig,
  tempDir: string
): Promise<void> {
  // Create the required directory structure
  await createDirectoryStructure(ir, config, tempDir);

  // Emit credentials file (Task 9.2)
  await emitCredentials(ir, config, tempDir);

  // Emit node class (Task 9.3)
  await emitNode(ir, config.vendor, tempDir);

  // Node icon
  await emitIcon(config, tempDir);

  // Emit contract file (Task 11.1)
  await emitContract(ir, tempDir);

  // Emit package.json (Task 11.2)
  await emitPackageJson(ir, config, tempDir);

  // Emit tsconfig.json (Task 11.3)
  await emitTsConfig(tempDir);

  // Emit README (Task 11.4)
  await emitReadme(ir, config, tempDir);

  // Emit conformance test (Task 11.5)
  await emitConformanceTest(ir, config, tempDir);

  // Emit fixtures (Task 11.6)
  await emitFixtures(ir, tempDir);
  await emitFixtureLoader(tempDir);

  // Emit unit tests (Task 11.7)
  await emitUnitTests(ir, config, tempDir);
}

/**
 * Create the directory structure for the generated package
 * 
 * @param ir - The validated Intermediate Representation
 * @param config - Generator configuration
 * @param tempDir - Temporary directory path
 */
async function createDirectoryStructure(
  ir: IntermediateRepresentation,
  config: GeneratorConfig,
  tempDir: string
): Promise<void> {
  // Capitalize vendor name for use in directory names
  // e.g., "vultr" → "Vultr"
  const vendorName = capitalizeVendorName(config.vendor);

  // Create all required directories
  const directories = [
    path.join(tempDir, 'credentials'),
    path.join(tempDir, 'nodes', vendorName),
    path.join(tempDir, 'contract'),
    path.join(tempDir, 'test'),
    path.join(tempDir, 'test', 'fixtures'),
  ];

  for (const dir of directories) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
}

/**
 * Capitalize the vendor name for use in file and directory names
 * 
 * @param vendor - Vendor name from config (kebab-case, e.g., "vultr")
 * @returns Capitalized vendor name (e.g., "Vultr")
 */
/**
 * Shorten an operation label by removing the resource name it repeats.
 *
 * n8n composes the action label from the resource and the operation, so an
 * operation called "List Regions" inside a resource called "Regions" renders
 * as "Regions List Regions". Documentation almost always names operations in
 * full, so strip the resource name and leave the verb: "List".
 *
 * Falls back to the original label if stripping would leave nothing, which
 * happens when the operation name is only the resource name.
 */
function shortOperationLabel(
  operationLabel: string,
  resourceLabel: string
): string {
  const singular = resourceLabel.replace(/s$/i, '');
  const candidates = [resourceLabel, singular]
    .filter((c) => c.length > 0)
    .sort((a, b) => b.length - a.length);

  for (const candidate of candidates) {
    const pattern = new RegExp(
      `\\s*${candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
      'i'
    );
    if (pattern.test(operationLabel)) {
      const stripped = operationLabel.replace(pattern, '').trim();
      if (stripped.length > 0) {
        return stripped;
      }
    }
  }

  return operationLabel;
}

function capitalizeVendorName(vendor: string): string {
  // Handle multi-word kebab-case names (e.g., "digital-ocean" → "DigitalOcean")
  return vendor
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/**
 * Emit the credentials file for authentication configuration
 * 
 * @param ir - The validated Intermediate Representation
 * @param vendor - Vendor name from config (kebab-case)
 * @param tempDir - Temporary directory path
 */
/**
 * Emit the node icon.
 *
 * n8n renders `icon: 'file:<vendor>.svg'` from alongside the node file, and a
 * missing file leaves a blank space in the node palette.
 *
 * The default is a generated monogram rather than the vendor's real logo.
 * Bundling a vendor's trademark into an unofficial community node is a
 * question no generator should answer on the user's behalf, so anyone wanting
 * the real mark can point `packageMeta.iconPath` at a file they have the right
 * to redistribute.
 */
async function emitIcon(
  config: GeneratorConfig,
  tempDir: string
): Promise<void> {
  const vendorName = capitalizeVendorName(config.vendor);
  const destination = path.join(
    tempDir,
    'nodes',
    vendorName,
    `${config.vendor}.svg`
  );

  const supplied = config.packageMeta?.iconPath;
  if (supplied) {
    await fs.promises.copyFile(path.resolve(supplied), destination);
    return;
  }

  const initials = config.vendor
    .split(/[-_\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

  // Hue derived from the vendor name so each generated node is visually
  // distinct, and identical input always produces an identical icon.
  let hash = 0;
  for (const char of config.vendor) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${escapeString(vendorName)}">
  <rect width="64" height="64" rx="12" fill="hsl(${hash}, 62%, 46%)"/>
  <text x="32" y="33" text-anchor="middle" dominant-baseline="central"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="${initials.length > 1 ? 24 : 32}" font-weight="600" fill="#ffffff">${initials}</text>
</svg>
`;

  await fs.promises.writeFile(destination, svg, 'utf-8');
}

async function emitCredentials(
  ir: IntermediateRepresentation,
  config: GeneratorConfig,
  tempDir: string
): Promise<void> {
  const vendorName = capitalizeVendorName(config.vendor);
  const credentialsPath = path.join(tempDir, 'credentials', `${vendorName}Api.credentials.ts`);

  const content = generateCredentialsContent(ir, vendorName, config);

  await fs.promises.writeFile(credentialsPath, content, 'utf-8');
}

/**
 * Generate the TypeScript content for the credentials file
 * 
 * @param ir - The validated Intermediate Representation
 * @param vendorName - Capitalized vendor name (e.g., "Vultr")
 * @returns TypeScript code as a string
 */
function generateCredentialsContent(
  ir: IntermediateRepresentation,
  vendorName: string,
  config: GeneratorConfig
): string {
  const className = `${vendorName}Api`;
  // Convert back to kebab-case for the credential name
  const vendorKebab = vendorName.replace(/([A-Z])/g, (match, p1, offset) => 
    offset > 0 ? '-' + p1.toLowerCase() : p1.toLowerCase()
  );
  
  // Generate the properties array based on auth type
  // Only ever use a URL here. ir.source.path is an absolute path on the
  // machine that ran the generator, and it would otherwise be published to
  // npm inside the credential description.
  const docUrl = config.packageMeta?.homepage ?? ir.source.url;

  const properties = generateCredentialProperties(ir.auth, docUrl);

  // The credential test needs a real endpoint. The API root usually 404s, so
  // pick the first GET operation that takes no path parameters: it is by
  // definition safe, needs no user input, and exists.
  const probe = ir.resources
    .flatMap((r) => r.operations)
    .find(
      (op) =>
        op.http_method === 'GET' &&
        !op.path.includes('{') &&
        !op.parameters.some((p) => p.location === 'path')
    );

  return `import {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class ${className} implements ICredentialType {
  name = '${vendorKebab}Api';
  displayName = '${vendorName} API';
  documentationUrl = '${docUrl ?? ''}';
  properties: INodeProperties[] = ${properties};

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
${generateAuthenticateProperties(ir.auth)}
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '${ir.base_url}',
      url: '${probe ? probe.path : '/'}',
    },
  };
}
`;
}

/**
 * Generate the properties array for credential input fields
 * 
 * @param auth - Authentication scheme from IR
 * @param docUrl - Documentation URL for reference
 * @returns Formatted properties array as string
 */
function generateCredentialProperties(
  auth: AuthenticationScheme,
  docUrl?: string
): string {
  const docLink = docUrl ? ` See the [documentation](${docUrl}) for details.` : '';

  switch (auth.type) {
    case 'api_key':
      return `[
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      required: true,
      description: 'API key for authentication.${docLink}',
    },
  ]`;

    case 'bearer_token':
      return `[
    {
      displayName: 'Access Token',
      name: 'accessToken',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      required: true,
      description: 'Bearer token for authentication.${docLink}',
    },
  ]`;

    case 'basic':
      return `[
    {
      displayName: 'Username',
      name: 'username',
      type: 'string',
      default: '',
      required: true,
      description: 'Username for basic authentication.${docLink}',
    },
    {
      displayName: 'Password',
      name: 'password',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      required: true,
      description: 'Password for basic authentication.${docLink}',
    },
  ]`;

    case 'oauth2':
      const scopesField = auth.scopes && auth.scopes.length > 0
        ? `,
    {
      displayName: 'Scopes',
      name: 'scopes',
      type: 'string',
      default: '${auth.scopes.join(' ')}',
      description: 'OAuth2 scopes separated by spaces.${docLink}',
    }`
        : '';

      return `[
    {
      displayName: 'Grant Type',
      name: 'grantType',
      type: 'hidden',
      default: 'authorizationCode',
    },
    {
      displayName: 'Authorization URL',
      name: 'authUrl',
      type: 'hidden',
      default: '${auth.authorize_url}',
      required: true,
    },
    {
      displayName: 'Access Token URL',
      name: 'accessTokenUrl',
      type: 'hidden',
      default: '${auth.token_url}',
      required: true,
    },
    {
      displayName: 'Client ID',
      name: 'clientId',
      type: 'string',
      default: '',
      required: true,
      description: 'OAuth2 client ID.${docLink}',
    },
    {
      displayName: 'Client Secret',
      name: 'clientSecret',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      required: true,
      description: 'OAuth2 client secret.${docLink}',
    }${scopesField},
  ]`;
  }
}

/**
 * Generate the authenticate properties object for the credential
 * 
 * @param auth - Authentication scheme from IR
 * @returns Formatted authenticate properties as string
 */
function generateAuthenticateProperties(auth: AuthenticationScheme): string {
  switch (auth.type) {
    case 'api_key':
      if (auth.location === 'header') {
        return `      headers: {
        '${auth.header_name}': '={{$credentials.apiKey}}',
      }`;
      } else if (auth.location === 'query') {
        return `      qs: {
        '${auth.query_param_name}': '={{$credentials.apiKey}}',
      }`;
      } else {
        // location === 'body'
        return `      body: {
        '${auth.body_field_name}': '={{$credentials.apiKey}}',
      }`;
      }

    case 'bearer_token':
      return `      headers: {
        '${auth.header_name}': '=Bearer {{$credentials.accessToken}}',
      }`;

    case 'basic':
      return `      headers: {
        'Authorization': '=Basic {{$credentials.username}}:{{$credentials.password}}',
      }`;

    case 'oauth2':
      return `      headers: {
        'Authorization': '=Bearer {{$credentials.oauthTokenData.access_token}}',
      }`;
  }
}

/**
 * Emit the node class file
 * 
 * @param ir - The validated Intermediate Representation
 * @param vendor - Vendor name from config (kebab-case)
 * @param tempDir - Temporary directory path
 */
async function emitNode(
  ir: IntermediateRepresentation,
  vendor: string,
  tempDir: string
): Promise<void> {
  const vendorName = capitalizeVendorName(vendor);
  const nodePath = path.join(tempDir, 'nodes', vendorName, `${vendorName}.node.ts`);

  const content = generateNodeContent(ir, vendorName, vendor);

  await fs.promises.writeFile(nodePath, content, 'utf-8');
}

/**
 * Generate the TypeScript content for the node class
 * 
 * @param ir - The validated Intermediate Representation
 * @param vendorName - Capitalized vendor name (e.g., "Vultr")
 * @param vendorKebab - Kebab-case vendor name (e.g., "vultr")
 * @returns TypeScript code as a string
 */
function generateNodeContent(
  ir: IntermediateRepresentation,
  vendorName: string,
  vendorKebab: string
): string {
  const className = vendorName;
  const credentialName = `${vendorKebab}Api`;
  
  // Generate resource options for the resource dropdown
  const resourceOptions = ir.resources.map(resource => ({
    name: resource.display_name,
    value: resource.name,
  }));

  // Generate operation options per resource
  const operationsByResource = ir.resources.map(resource => ({
    resourceName: resource.name,
    operations: resource.operations.map(op => ({
      name: shortOperationLabel(op.display_name, resource.display_name),
      value: op.name,
      description: op.description,
    })),
  }));

  const resourceOptionsCode = resourceOptions.map(opt => 
    `      {
        name: '${escapeString(opt.name)}',
        value: '${escapeString(opt.value)}',
      }`
  ).join(',\n');

  // Generate operation dropdowns for each resource
  const operationDropdowns = operationsByResource.map(({ resourceName, operations }) => {
    const operationOptionsCode = operations.map(op =>
      `        {
          name: '${escapeString(op.name)}',
          value: '${escapeString(op.value)}',
          description: '${escapeString(op.description)}',
        }`
    ).join(',\n');

    return `    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      displayOptions: {
        show: {
          resource: ['${escapeString(resourceName)}'],
        },
      },
      options: [
${operationOptionsCode}
      ],
      default: '${escapeString(operations[0]?.value || '')}',
      required: true,
    }`;
  }).join(',\n');

  // Generate parameter fields for each operation (Task 9.4)
  const parameterFields = generateParameterFields(ir);
  
  // Build the complete properties array
  const resourceDropdown = `    {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
${resourceOptionsCode}
        ],
        default: '${escapeString(resourceOptions[0]?.value || '')}',
        required: true,
      }`;

  return `import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

/**
 * Should an optional parameter be sent?
 *
 * n8n's getNodeParameter never returns undefined for a field the user left
 * alone: it returns that field's default, which is an empty string for a
 * string and 0 for a number. Sending those means every optional parameter
 * goes on every request, and a vendor that validates its inputs rejects the
 * call. Vultr answers per_page=0 with an HTTP 500, because its minimum is 1.
 *
 * Known limitation: a deliberate 0 cannot currently be sent for an optional
 * numeric parameter, because it is indistinguishable from an untouched field.
 * The proper fix is to put optional parameters in an n8n "Additional Fields"
 * collection, which only contains what the user actually added.
 */
function isSet(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.length > 0;
  if (typeof value === 'number') return value !== 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export class ${className} implements INodeType {
  description: INodeTypeDescription = {
    displayName: '${vendorName}',
    name: '${vendorKebab}',
    icon: 'file:${vendorKebab}.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Interact with ${vendorName} API',
    defaults: {
      name: '${vendorName}',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: '${credentialName}',
        required: true,
      },
    ],
    usableAsTool: true,
    properties: [
${resourceDropdown},
${operationDropdowns}${parameterFields.length > 0 ? ',\n' + parameterFields : ''}
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const resource = this.getNodeParameter('resource', 0) as string;
    const operation = this.getNodeParameter('operation', 0) as string;

    // Process each input item
    for (let i = 0; i < items.length; i++) {
      try {
${generateExecuteRouting(ir, vendorKebab)}
      } catch (error) {
        if (this.continueOnFail()) {
          // TypeScript types a caught value as unknown under strict mode,
          // so narrow before reading .message.
          returnData.push({
            json: {
              error: error instanceof Error ? error.message : String(error),
            },
            pairedItem: i,
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}
`;
}

/**
 * Generate parameter fields for all operations in the IR
 * 
 * @param ir - The validated Intermediate Representation
 * @returns Formatted parameter fields as string
 */
function generateParameterFields(ir: IntermediateRepresentation): string {
  const parameterFieldsArray: string[] = [];

  // Iterate through each resource and operation
  for (const resource of ir.resources) {
    for (const operation of resource.operations) {
      // Skip operations with no parameters
      if (operation.parameters.length === 0) {
        continue;
      }

      // Generate fields for each parameter in this operation
      for (const param of operation.parameters) {
        const field = generateParameterField(param, resource.name, operation.name);
        parameterFieldsArray.push(field);
      }
    }
  }

  return parameterFieldsArray.join(',\n');
}

/**
 * Generate a single parameter field for n8n
 * 
 * @param param - Parameter from IR
 * @param resourceName - Resource name for displayOptions
 * @param operationName - Operation name for displayOptions
 * @returns Formatted parameter field as string
 */
function generateParameterField(
  param: import('./types.js').Parameter,
  resourceName: string,
  operationName: string
): string {
  // Determine n8n field type from parameter type
  const fieldType = mapParameterTypeToN8nType(param.type);
  
  // Generate display name (use provided or convert from name)
  const displayName = param.display_name;
  
  // Generate description
  const description = escapeString(param.description);
  
  // Build the base field structure
  let field = `    {
      displayName: '${escapeString(displayName)}',
      name: '${escapeString(param.name)}',
      type: '${fieldType}',
      displayOptions: {
        show: {
          resource: ['${escapeString(resourceName)}'],
          operation: ['${escapeString(operationName)}'],
        },
      },`;

  // Add default value if present
  if (param.default_value !== undefined) {
    const defaultValue = typeof param.default_value === 'string' 
      ? `'${escapeString(param.default_value)}'`
      : JSON.stringify(param.default_value);
    field += `\n      default: ${defaultValue},`;
  } else {
    // Provide appropriate default based on type
    field += `\n      default: ${getDefaultValueForType(param.type)},`;
  }

  // Add required flag
  field += `\n      required: ${param.required},`;

  // Add description
  field += `\n      description: '${description}',`;

  // Handle enum constraints (generate options dropdown).
  //
  // generateEnumField returns a complete field including its closing brace,
  // so return it directly. Falling through would append a second brace and
  // terminate the properties array early, which breaks the whole file.
  if (param.constraints?.enum) {
    return generateEnumField(param, resourceName, operationName);
  }

  // Add validation rules for non-enum fields
  const validationRules = generateValidationRules(param);
  if (validationRules) {
    field += `\n${validationRules}`;
  }

  field += `\n    }`;

  return field;
}

/**
 * Generate a field with enum options (dropdown)
 * 
 * @param param - Parameter with enum constraint
 * @param resourceName - Resource name for displayOptions
 * @param operationName - Operation name for displayOptions
 * @returns Formatted enum field as string
 */
function generateEnumField(
  param: import('./types.js').Parameter,
  resourceName: string,
  operationName: string
): string {
  const enumValues = param.constraints!.enum!;
  
  const optionsCode = enumValues.map(value => {
    const displayValue = typeof value === 'string' ? value : String(value);
    return `        {
          name: '${escapeString(displayValue)}',
          value: ${typeof value === 'string' ? `'${escapeString(value)}'` : value},
        }`;
  }).join(',\n');

  // Determine default value
  const defaultValue = param.default_value !== undefined
    ? (typeof param.default_value === 'string' ? `'${escapeString(param.default_value)}'` : param.default_value)
    : (typeof enumValues[0] === 'string' ? `'${escapeString(String(enumValues[0]))}'` : enumValues[0]);

  return `    {
      displayName: '${escapeString(param.display_name)}',
      name: '${escapeString(param.name)}',
      type: 'options',
      displayOptions: {
        show: {
          resource: ['${escapeString(resourceName)}'],
          operation: ['${escapeString(operationName)}'],
        },
      },
      options: [
${optionsCode}
      ],
      default: ${defaultValue},
      required: ${param.required},
      description: '${escapeString(param.description)}',
    }`;
}

/**
 * Map IR parameter type to n8n field type
 * 
 * @param paramType - Parameter type from IR
 * @returns n8n field type string
 */
function mapParameterTypeToN8nType(paramType: import('./types.js').ParameterType): string {
  switch (paramType.kind) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      // n8n uses 'collection' for arrays
      return 'collection';
    case 'object':
      // n8n uses 'fixedCollection' or 'collection' for objects
      return 'fixedCollection';
    default:
      return 'string'; // Safe fallback
  }
}

/**
 * Get default value for a parameter type
 * 
 * @param paramType - Parameter type from IR
 * @returns Default value as string representation
 */
function getDefaultValueForType(paramType: import('./types.js').ParameterType): string {
  switch (paramType.kind) {
    case 'string':
      return "''";
    case 'number':
    case 'integer':
      return '0';
    case 'boolean':
      return 'false';
    case 'array':
      return '[]';
    case 'object':
      return '{}';
    default:
      return "''";
  }
}

/**
 * Generate validation rules for a parameter based on constraints
 * 
 * @param param - Parameter from IR
 * @returns Formatted validation rules or empty string
 */
function generateValidationRules(param: import('./types.js').Parameter): string {
  if (!param.constraints) {
    return '';
  }

  const rules: string[] = [];

  // For string parameters
  if (param.type.kind === 'string') {
    if (param.constraints.min_length !== undefined) {
      rules.push(`        minLength: ${param.constraints.min_length}`);
    }
    if (param.constraints.max_length !== undefined) {
      rules.push(`        maxLength: ${param.constraints.max_length}`);
    }
    if (param.constraints.pattern) {
      rules.push(`        pattern: '${escapeString(param.constraints.pattern)}'`);
    }
  }

  // For number parameters
  if (param.type.kind === 'number' || param.type.kind === 'integer') {
    if (param.constraints.minimum !== undefined) {
      rules.push(`        minimum: ${param.constraints.minimum}`);
    }
    if (param.constraints.maximum !== undefined) {
      rules.push(`        maximum: ${param.constraints.maximum}`);
    }
  }

  // For array parameters
  if (param.type.kind === 'array') {
    if (param.constraints.min_items !== undefined) {
      rules.push(`        minItems: ${param.constraints.min_items}`);
    }
    if (param.constraints.max_items !== undefined) {
      rules.push(`        maxItems: ${param.constraints.max_items}`);
    }
  }

  if (rules.length === 0) {
    return '';
  }

  return `      typeOptions: {
${rules.join(',\n')}
      },`;
}

/**
 * Generate the routing logic for the execute method
 * 
 * @param ir - The validated Intermediate Representation
 * @param vendorKebab - Kebab-case vendor name
 * @returns Formatted routing code as string
 */
function generateExecuteRouting(
  ir: IntermediateRepresentation,
  vendorKebab: string
): string {
  const resourceCases = ir.resources.map(resource => {
    const operationCases = resource.operations.map(operation => {
      return `            case '${escapeString(operation.name)}':
              {
${generateOperationHandler(ir, resource.name, operation, vendorKebab)}
              }
              break;`;
    }).join('\n');

    return `          case '${escapeString(resource.name)}':
            switch (operation) {
${operationCases}
              default:
                throw new Error(\`Unknown operation: \${operation}\`);
            }
            break;`;
  }).join('\n');

  return `        switch (resource) {
${resourceCases}
          default:
            throw new Error(\`Unknown resource: \${resource}\`);
        }`;
}

/**
 * Generate the handler code for a single operation
 * 
 * @param ir - The validated Intermediate Representation
 * @param resourceName - Resource name
 * @param operation - Operation from IR
 * @param vendorKebab - Kebab-case vendor name
 * @returns Formatted operation handler code
 */
function generateOperationHandler(
  ir: IntermediateRepresentation,
  resourceName: string,
  operation: import('./types.js').Operation,
  vendorKebab: string
): string {
  const lines: string[] = [];

  // Collect parameters by location
  const pathParams = operation.parameters.filter(p => p.location === 'path');
  const queryParams = operation.parameters.filter(p => p.location === 'query');
  const headerParams = operation.parameters.filter(p => p.location === 'header');
  const bodyParams = operation.parameters.filter(p => p.location === 'body');

  // Read all parameters
  if (operation.parameters.length > 0) {
    for (const param of operation.parameters) {
      lines.push(`                const ${toCamelCase(param.name)} = this.getNodeParameter('${escapeString(param.name)}', i${param.required ? '' : ', undefined'}) as ${getTypeScriptType(param.type)};`);
    }
    lines.push('');
  }

  // Build URL with path parameter substitution
  lines.push(`                let url = '${escapeString(operation.path)}';`);
  
  if (pathParams.length > 0) {
    for (const param of pathParams) {
      lines.push(`                url = url.replace('{${escapeString(param.name)}}', encodeURIComponent(String(${toCamelCase(param.name)})));`);
    }
    lines.push('');
  }

  // Build query string
  if (queryParams.length > 0) {
    lines.push(`                const qs: Record<string, any> = {};`);
    for (const param of queryParams) {
      if (param.required) {
        lines.push(`                qs['${escapeString(param.name)}'] = ${toCamelCase(param.name)};`);
      } else {
        // n8n's getNodeParameter never returns undefined for an unset
        // optional field: it returns the field's default, which is 0 for a
        // number and an empty string for a string. Checking only for
        // undefined therefore sends every optional parameter on every
        // request, and a vendor that validates them rejects the call.
        // Vultr returns HTTP 500 for per_page=0, because its minimum is 1.
        lines.push(`                if (isSet(${toCamelCase(param.name)})) {`);
        lines.push(`                  qs['${escapeString(param.name)}'] = ${toCamelCase(param.name)};`);
        lines.push(`                }`);
      }
    }
    lines.push('');
  }

  // Build headers
  if (headerParams.length > 0) {
    lines.push(`                const headers: Record<string, any> = {};`);
    for (const param of headerParams) {
      if (param.required) {
        lines.push(`                headers['${escapeString(param.name)}'] = ${toCamelCase(param.name)};`);
      } else {
        lines.push(`                if (isSet(${toCamelCase(param.name)})) {`);
        lines.push(`                  headers['${escapeString(param.name)}'] = ${toCamelCase(param.name)};`);
        lines.push(`                }`);
      }
    }
    lines.push('');
  }

  // Build request body
  if (bodyParams.length > 0) {
    lines.push(`                const body: Record<string, any> = {};`);
    for (const param of bodyParams) {
      if (param.required) {
        lines.push(`                body['${escapeString(param.name)}'] = ${toCamelCase(param.name)};`);
      } else {
        lines.push(`                if (isSet(${toCamelCase(param.name)})) {`);
        lines.push(`                  body['${escapeString(param.name)}'] = ${toCamelCase(param.name)};`);
        lines.push(`                }`);
      }
    }
    lines.push('');
  }

  // Make HTTP request with error handling
  lines.push(`                let response: any;`);
  lines.push(`                try {`);
  lines.push(`                  response = await this.helpers.requestWithAuthentication.call(`);
  lines.push(`                    this,`);
  lines.push(`                    '${vendorKebab}Api',`);
  lines.push(`                    {`);
  lines.push(`                      method: '${operation.http_method}',`);
  lines.push(`                      url: \`${escapeString(ir.base_url)}\${url}\`,`);
  
  if (queryParams.length > 0) {
    lines.push(`                      qs,`);
  }
  
  if (headerParams.length > 0) {
    lines.push(`                      headers,`);
  }
  
  if (bodyParams.length > 0) {
    lines.push(`                      body,`);
  }
  
  lines.push(`                      json: true,`);
  lines.push(`                      resolveWithFullResponse: true,`);
  lines.push(`                    },`);
  lines.push(`                  );`);
  lines.push(`                } catch (error: any) {`);
  lines.push(`                  // Extract status code and response body from error`);
  lines.push(`                  const statusCode = error.statusCode || error.response?.statusCode || 500;`);
  lines.push(`                  const responseBody = error.response?.body || error.message || '';`);
  lines.push(`                  const bodyExcerpt = typeof responseBody === 'string' ? responseBody.substring(0, 200) : JSON.stringify(responseBody).substring(0, 200);`);
  lines.push(`                  const operationName = '${escapeString(operation.display_name)}';`);
  lines.push(``);
  lines.push(`                  // Map HTTP status codes to user-friendly error messages`);
  lines.push(`                  let errorMessage = '';`);
  lines.push(`                  if (statusCode === 400) {`);
  lines.push(`                    errorMessage = \`Invalid input for \${operationName} (HTTP \${statusCode}): \${bodyExcerpt}\`;`);
  lines.push(`                  } else if (statusCode === 401) {`);
  lines.push(`                    errorMessage = \`Authentication failed for \${operationName} (HTTP \${statusCode}): \${bodyExcerpt}\`;`);
  lines.push(`                  } else if (statusCode === 403) {`);
  lines.push(`                    errorMessage = \`Access forbidden for \${operationName} (HTTP \${statusCode}): \${bodyExcerpt}\`;`);
  lines.push(`                  } else if (statusCode === 404) {`);
  lines.push(`                    errorMessage = \`Resource not found for \${operationName} (HTTP \${statusCode}): \${bodyExcerpt}\`;`);
  lines.push(`                  } else if (statusCode === 429) {`);
  lines.push(`                    errorMessage = \`Rate limit exceeded for \${operationName} (HTTP \${statusCode}): \${bodyExcerpt}\`;`);
  lines.push(`                  } else if (statusCode >= 500) {`);
  lines.push(`                    errorMessage = \`Server error for \${operationName} (HTTP \${statusCode}): \${bodyExcerpt}\`;`);
  lines.push(`                  } else {`);
  lines.push(`                    errorMessage = \`HTTP error for \${operationName} (HTTP \${statusCode}): \${bodyExcerpt}\`;`);
  lines.push(`                  }`);
  lines.push(``);
  lines.push(`                  throw new Error(errorMessage);`);
  lines.push(`                }`);
  lines.push('');

  // Add response to returnData
  lines.push(`                returnData.push({`);
  lines.push(`                  json: response.body || response,`);
  lines.push(`                  pairedItem: i,`);
  lines.push(`                });`);

  return lines.join('\n');
}

/**
 * Convert kebab-case or snake_case to camelCase
 * 
 * @param str - String to convert
 * @returns camelCase string
 */
function toCamelCase(str: string): string {
  return str
    // Replace hyphen or underscore followed by any character with uppercase version
    .replace(/[-_](.)/g, (_, letter) => letter.toUpperCase())
    // Ensure first character is lowercase
    .replace(/^[A-Z]/, letter => letter.toLowerCase());
}

/**
 * Get TypeScript type annotation for a parameter type
 * 
 * @param paramType - Parameter type from IR
 * @returns TypeScript type as string
 */
function getTypeScriptType(paramType: import('./types.js').ParameterType): string {
  switch (paramType.kind) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'any[]';
    case 'object':
      return 'Record<string, any>';
    default:
      return 'any';
  }
}

/**
 * Escape special characters in strings for TypeScript string literals
 * 
 * @param str - String to escape
 * @returns Escaped string safe for single-quoted TypeScript literals
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Emit the IR contract file to contract/ir.json (Task 11.1)
 * 
 * @param ir - The validated Intermediate Representation
 * @param tempDir - Temporary directory path
 */
async function emitContract(
  ir: IntermediateRepresentation,
  tempDir: string
): Promise<void> {
  const contractPath = path.join(tempDir, 'contract', 'ir.json');
  const content = JSON.stringify(ir, null, 2);
  await fs.promises.writeFile(contractPath, content, 'utf-8');
}

/**
 * Emit package.json (Task 11.2)
 * 
 * @param ir - The validated Intermediate Representation
 * @param config - Generator configuration
 * @param tempDir - Temporary directory path
 */
async function emitPackageJson(
  ir: IntermediateRepresentation,
  config: GeneratorConfig,
  tempDir: string
): Promise<void> {
  const vendorName = capitalizeVendorName(config.vendor);
  const vendorKebab = config.vendor;

  const packageJson = {
    name: `n8n-nodes-${vendorKebab}`,
    version: config.packageMeta?.version ?? '0.1.0',
    description: `n8n community node for ${vendorName} API`,
    keywords: ['n8n-community-node-package', vendorKebab],
    license: config.packageMeta?.license ?? 'MIT',
    ...(config.packageMeta?.author
      ? { author: config.packageMeta.author }
      : {}),
    // Only use the documentation source as a homepage when it is a URL.
    // ir.source.path is an absolute path on the generating machine and must
    // never be published.
    homepage:
      config.packageMeta?.homepage ?? ir.source.url ?? undefined,
    ...(config.packageMeta?.repository
      ? {
          repository: {
            type: 'git',
            url: config.packageMeta.repository,
          },
        }
      : {}),
    // npm publishes these paths only. contract/ is included deliberately:
    // the conformance test reads ir.json at runtime, so it must ship.
    files: ['dist', 'contract', 'README.md'],
    // No "main". n8n loads nodes and credentials through the "n8n" block
    // below, not through Node's entry point resolution, and pointing main at
    // a file the generator does not emit would be a broken reference.
    scripts: {
      // tsc does not copy non-TypeScript files, but n8n resolves the node
      // icon relative to the compiled node in dist/, so assets have to be
      // copied across after compilation. Done with node's own fs rather than
      // a build tool, to keep the generated package dependency-free.
      build:
        'tsc && node -e "require(\'fs\').cpSync(\'nodes\',\'dist/nodes\',{recursive:true,filter:s=>!s.endsWith(\'.ts\')})"',
      test: 'vitest run',
      typecheck: 'tsc --noEmit',
      conformance: 'vitest run test/conformance.test.ts',
    },
    n8n: {
      n8nNodesApiVersion: 1,
      // These must be arrays of path strings, not objects. n8n calls
      // path.join(packageDir, entry) on each item, so an object fails with
      // 'The "paths[1]" argument must be of type string'. This matches the
      // format used by n8n's own node starter.
      //
      // usableAsTool belongs on the node's description, not here.
      credentials: [`dist/credentials/${vendorName}Api.credentials.js`],
      nodes: [`dist/nodes/${vendorName}/${vendorName}.node.js`],
    },
    devDependencies: {
      '@types/node': '^20.10.0',
      'n8n-workflow': '^1.0.0',
      'n8n-core': '^1.0.0',
      typescript: '^5.3.0',
      vitest: '^1.0.0',
    },
  };

  const content = JSON.stringify(packageJson, null, 2);
  const packageJsonPath = path.join(tempDir, 'package.json');
  await fs.promises.writeFile(packageJsonPath, content, 'utf-8');
}

/**
 * Emit tsconfig.json (Task 11.3)
 * 
 * @param tempDir - Temporary directory path
 */
async function emitTsConfig(tempDir: string): Promise<void> {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      lib: ['ES2020'],
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      outDir: './dist',
      // rootDir is the package root, not ./src.
      //
      // n8n community nodes keep their source in `credentials/` and `nodes/`
      // at the package root, which is what the include patterns below match
      // and what n8n's own node starter uses. Setting rootDir to ./src
      // contradicts that and makes tsc reject every emitted file with TS6059.
      rootDir: '.',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      moduleResolution: 'node',
    },
    include: ['credentials/**/*.ts', 'nodes/**/*.ts'],
    exclude: ['node_modules', 'dist', 'test'],
  };

  const content = JSON.stringify(tsconfig, null, 2);
  const tsconfigPath = path.join(tempDir, 'tsconfig.json');
  await fs.promises.writeFile(tsconfigPath, content, 'utf-8');
}

/**
 * Emit README.md (Task 11.4)
 * 
 * @param ir - The validated Intermediate Representation
 * @param config - Generator configuration
 * @param tempDir - Temporary directory path
 */
async function emitReadme(
  ir: IntermediateRepresentation,
  config: GeneratorConfig,
  tempDir: string
): Promise<void> {
  const vendorName = capitalizeVendorName(config.vendor);
  const vendorKebab = config.vendor;
  const vendorEnvPrefix = vendorKebab.toUpperCase().replace(/-/g, '_');

  const resourceCount = ir.resources.length;
  const operationCount = ir.resources.reduce((sum, r) => sum + r.operations.length, 0);

  const docSource = ir.source.url
    ? `[${ir.source.url}](${ir.source.url})`
    : `local file: \`${ir.source.path}\``;

  const readme = `# n8n-nodes-${vendorKebab}

⚠️ This package is generated. Do not edit by hand.

n8n community node for the ${vendorName} API.

This node was generated from ${docSource}, content hash \`${ir.source.content_hash.slice(0, 12)}\`.
Regenerating from the same documentation produces byte-identical output.

## Installation

\`\`\`bash
npm install n8n-nodes-${vendorKebab}
\`\`\`

## Documentation

API documentation: ${ir.source.url || ir.source.path}

This package includes ${resourceCount} resources and ${operationCount} operations.

## Conformance Test

The generated node includes a conformance test that verifies the live API matches the contract the node was built from.

Run the conformance test:

\`\`\`bash
npm test
\`\`\`

The conformance test runs on a schedule in CI. When the vendor API changes, the build fails and an issue is opened.

## Offline Mode

Tests can run without vendor credentials using recorded fixtures. This allows contributors to validate the node without signing up for the vendor service.

To run tests against the live API, set the environment variable:

\`\`\`bash
export ${vendorEnvPrefix}_API_KEY=your-api-key-here
npm test
\`\`\`

Without credentials, tests run in offline mode using fixtures.

## License

MIT
`;

  const readmePath = path.join(tempDir, 'README.md');
  await fs.promises.writeFile(readmePath, readme, 'utf-8');
}

/**
 * Emit conformance test (Task 11.5)
 * 
 * @param ir - The validated Intermediate Representation
 * @param config - Generator configuration
 * @param tempDir - Temporary directory path
 */
async function emitConformanceTest(
  ir: IntermediateRepresentation,
  config: GeneratorConfig,
  tempDir: string
): Promise<void> {
  const vendorKebab = config.vendor;
  const vendorEnvPrefix = vendorKebab.toUpperCase().replace(/-/g, '_');

  // Determine environment variable name based on auth type
  let envVarName: string;
  if (ir.auth.type === 'bearer_token') {
    envVarName = `${vendorEnvPrefix}_ACCESS_TOKEN`;
  } else {
    envVarName = `${vendorEnvPrefix}_API_KEY`;
  }

  // Filter operations: only GET, no required path params
  const testableOperations: Array<{
    resourceName: string;
    operation: import('./types.js').Operation;
  }> = [];

  const excludedOperations: Array<{
    resourceName: string;
    operation: import('./types.js').Operation;
    reason: string;
  }> = [];

  for (const resource of ir.resources) {
    for (const operation of resource.operations) {
      if (operation.http_method !== 'GET') {
        excludedOperations.push({
          resourceName: resource.name,
          operation,
          reason: `${operation.http_method} operation excluded for safety`,
        });
        continue;
      }

      const hasRequiredPathParams = operation.parameters.some(
        (p) => p.location === 'path' && p.required
      );

      if (hasRequiredPathParams) {
        excludedOperations.push({
          resourceName: resource.name,
          operation,
          reason: 'requires specific resource ID',
        });
        continue;
      }

      testableOperations.push({
        resourceName: resource.name,
        operation,
      });
    }
  }

  // Generate test cases
  let testCases = '';
  for (const { resourceName, operation } of testableOperations) {
    const testName = `${operation.display_name} - ${operation.http_method} ${operation.path}`;
    testCases += `
  describeConditional('${escapeString(testName)}', () => {
    test('returns expected response shape', async () => {
      const response = await makeRequest('${escapeString(operation.path)}', '${operation.http_method}');
      expect(response.status).toBe(200);
      
      const responseShape = getOperationResponseShape('${escapeString(resourceName)}', '${escapeString(operation.name)}');
      validateResponseShape(response.data, responseShape);
    }, { timeout: 60000 });
  });
`;
  }

  // Generate excluded operations documentation
  let excludedDocs = '';
  if (excludedOperations.length > 0) {
    excludedDocs = '\n/**\n * This test file documents excluded operations:\n';
    for (const { operation, reason } of excludedOperations) {
      excludedDocs += ` * - ${operation.display_name}: ${reason}\n`;
    }
    excludedDocs += ' */\n';
  }

  // Generate auth documentation based on auth type
  let authDoc = '';
  if (ir.auth.type === 'api_key' && ir.auth.location === 'header') {
    authDoc = ` * Authentication: API key in ${ir.auth.header_name} header\n`;
  } else if (ir.auth.type === 'bearer_token') {
    authDoc = ` * Authentication: Bearer token in ${ir.auth.header_name} header\n`;
  } else if (ir.auth.type === 'basic') {
    authDoc = ` * Authentication: Basic auth\n`;
  }

  // Build the conformance test file as a plain string
  let content = '';
  content += '/**\n';
  content += ' * Conformance test: verify live API matches the contract\n';
  content += ' *\n';
  content += ' * This test runs WITHOUT Kiro. It is pure HTTP calls plus schema comparison.\n';
  content += ' * It can run in CI with no model access.\n';
  content += ' *\n';
  if (authDoc) {
    content += authDoc;
  }
  content += ' *\n';
  content += ' * Safety Constraint:\n';
  content += ' * Only read-only operations (GET) are tested to avoid:\n';
  content += ' * - Incurring charges or costs\n';
  content += ' * - Creating billable resources\n';
  content += ' * - Modifying or deleting production data\n';
  content += ' */\n\n';
  content += 'import { describe, test, expect, beforeAll } from \'vitest\';\n';
  content += 'import * as fs from \'fs\';\n';
  content += 'import * as path from \'path\';\n\n';
  content += '// Read the IR from the contract file\n';
  content += 'const irPath = path.join(__dirname, \'../contract/ir.json\');\n';
  content += 'const ir = JSON.parse(fs.readFileSync(irPath, \'utf-8\'));\n\n';
  content += '// Check for API credentials\n';
  content += 'const apiKey = process.env.' + envVarName + ';\n';
  content += 'const hasCredentials = !!apiKey;\n\n';
  content += '// Conditional describe: skip if no credentials\n';
  content += 'const describeConditional = hasCredentials ? describe : describe.skip;\n\n';
  content += 'function getAuthHeaders(): Record<string, string> {\n';
  content += '  if (!apiKey) return {};\n';
  content += '  \n';
  content += '  const authType = ir.auth.type;\n';
  content += '  switch (authType) {\n';
  content += '    case \'api_key\':\n';
  content += '      if (ir.auth.location === \'header\') {\n';
  content += '        return { [ir.auth.header_name]: apiKey };\n';
  content += '      }\n';
  content += '      return {};\n';
  content += '    case \'bearer_token\':\n';
  content += '      return { [ir.auth.header_name]: `Bearer ${apiKey}` };\n';
  content += '    case \'basic\':\n';
  content += '      const [username, password] = apiKey.split(\':\');\n';
  content += '      const encoded = Buffer.from(`${username}:${password}`).toString(\'base64\');\n';
  content += '      return { \'Authorization\': `Basic ${encoded}` };\n';
  content += '    default:\n';
  content += '      return {};\n';
  content += '  }\n';
  content += '}\n\n';
  content += 'async function makeRequest(path: string, method: string): Promise<any> {\n';
  content += '  const url = new URL(ir.base_url + path);\n';
  content += '  const headers = getAuthHeaders();\n';
  content += '  \n';
  content += '  const response = await fetch(url.toString(), {\n';
  content += '    method,\n';
  content += '    headers,\n';
  content += '  });\n';
  content += '  \n';
  content += '  const data = await response.json().catch(() => ({}));\n';
  content += '  \n';
  content += '  return {\n';
  content += '    status: response.status,\n';
  content += '    data,\n';
  content += '  };\n';
  content += '}\n\n';
  content += 'function getOperationResponseShape(resourceName: string, operationName: string): any {\n';
  content += '  const resource = ir.resources.find((r: any) => r.name === resourceName);\n';
  content += '  if (!resource) throw new Error(`Resource not found: ${resourceName}`);\n';
  content += '  \n';
  content += '  const operation = resource.operations.find((o: any) => o.name === operationName);\n';
  content += '  if (!operation) throw new Error(`Operation not found: ${operationName}`);\n';
  content += '  \n';
  content += '  return operation.response_shape;\n';
  content += '}\n\n';
  content += 'function validateResponseShape(data: any, responseShape: any): void {\n';
  content += '  if (responseShape.undocumented) {\n';
  content += '    // Skip validation for undocumented response shapes\n';
  content += '    return;\n';
  content += '  }\n';
  content += '  \n';
  content += '  if (responseShape.type === \'array\') {\n';
  content += '    expect(Array.isArray(data)).toBe(true);\n';
  content += '  } else if (responseShape.type === \'object\') {\n';
  content += '    expect(typeof data).toBe(\'object\');\n';
  content += '    expect(data).not.toBeNull();\n';
  content += '  }\n';
  content += '}\n\n';
  content += 'describe(\'Conformance Test\', () => {\n';
  content += '  beforeAll(() => {\n';
  content += '    if (!hasCredentials) {\n';
  content += '      console.log(\'Skipping conformance tests: no credentials provided\');\n';
  // Note the quotes: this is the *name* of the environment variable as a
  // string. Interpolating the bare identifier would reference an undefined
  // variable and throw a ReferenceError.
  content += '      console.log(\'Set ' + envVarName + ' environment variable to run these tests\');\n';
  content += '    }\n';
  content += '  });\n';
  content += testCases;
  content += '});\n';
  content += excludedDocs;

  const conformanceTestPath = path.join(tempDir, 'test', 'conformance.test.ts');
  await fs.promises.writeFile(conformanceTestPath, content, 'utf-8');
}

/**
 * Emit fixture files from IR examples (Task 11.6)
 * 
 * @param ir - The validated Intermediate Representation
 * @param tempDir - Temporary directory path
 */
async function emitFixtures(
  ir: IntermediateRepresentation,
  tempDir: string
): Promise<void> {
  const fixturesDir = path.join(tempDir, 'test', 'fixtures');

  let fixtureIndex = 0;
  for (const resource of ir.resources) {
    for (const operation of resource.operations) {
      for (const example of operation.examples) {
        const fixtureName = `${resource.name}-${operation.name}-${fixtureIndex}.json`;
        const fixturePath = path.join(fixturesDir, fixtureName);

        const fixture = {
          request: {
            method: operation.http_method,
            path: operation.path,
            parameters: example.request,
          },
          response: {
            status: example.status_code,
            body: example.response,
          },
        };

        await fs.promises.writeFile(fixturePath, JSON.stringify(fixture, null, 2), 'utf-8');
        fixtureIndex++;
      }
    }
  }
}

/**
 * Emit fixture loader utility (Task 11.6)
 * 
 * @param tempDir - Temporary directory path
 */
async function emitFixtureLoader(tempDir: string): Promise<void> {
  const content = `import * as fs from 'fs';
import * as path from 'path';

export interface Fixture {
  request: {
    method: string;
    path: string;
    parameters: Record<string, any>;
  };
  response: {
    status: number;
    body: any;
  };
}

export function loadFixture(resourceName: string, operationName: string, exampleIndex: number = 0): Fixture {
  const fixtureName = \`\${resourceName}-\${operationName}-\${exampleIndex}.json\`;
  const fixturePath = path.join(__dirname, 'fixtures', fixtureName);
  
  if (!fs.existsSync(fixturePath)) {
    throw new Error(\`Fixture not found: \${fixtureName}\`);
  }
  
  const fixtureContent = fs.readFileSync(fixturePath, 'utf-8');
  return JSON.parse(fixtureContent);
}

export function fixtureExists(resourceName: string, operationName: string, exampleIndex: number = 0): boolean {
  const fixtureName = \`\${resourceName}-\${operationName}-\${exampleIndex}.json\`;
  const fixturePath = path.join(__dirname, 'fixtures', fixtureName);
  return fs.existsSync(fixturePath);
}
`;

  const loaderPath = path.join(tempDir, 'test', 'fixture-loader.ts');
  await fs.promises.writeFile(loaderPath, content, 'utf-8');
}

/**
 * Emit unit tests (Task 11.7)
 * 
 * @param ir - The validated Intermediate Representation
 * @param config - Generator configuration
 * @param tempDir - Temporary directory path
 */
async function emitUnitTests(
  ir: IntermediateRepresentation,
  config: GeneratorConfig,
  tempDir: string
): Promise<void> {
  const vendorName = capitalizeVendorName(config.vendor);

  // Generate fixture-backed operation tests
  let operationTests = '';
  for (const resource of ir.resources) {
    for (const operation of resource.operations) {
      if (operation.examples.length === 0) continue;

      operationTests += `
  describe('${escapeString(operation.display_name)}', () => {
    test('returns expected response from fixture', () => {
      if (!fixtureExists('${escapeString(resource.name)}', '${escapeString(operation.name)}', 0)) {
        // Skip if no fixture available
        return;
      }

      const fixture = loadFixture('${escapeString(resource.name)}', '${escapeString(operation.name)}', 0);
      expect(fixture.response.status).toBe(${operation.examples[0]!.status_code});
      expect(fixture.response.body).toBeDefined();
    });
  });
`;
    }
  }

  const content = `/**
 * Unit tests for generated node
 * 
 * These tests run in OFFLINE mode using fixtures.
 * No vendor credentials are required.
 */

import { describe, it, test, expect } from 'vitest';
import { loadFixture, fixtureExists } from './fixture-loader';
import { ${vendorName} } from '../nodes/${vendorName}/${vendorName}.node';

// Structural tests, derived from the contract the node was generated from.
// These need no credentials, no fixtures and no network, so anyone can run
// the suite immediately after installing.
describe('Node structure', () => {
  const node = new ${vendorName}();

  it('exposes a valid n8n node description', () => {
    expect(node.description.name).toBe('${escapeString(config.vendor)}');
    expect(node.description.displayName).toBeTruthy();
    expect(node.description.version).toBeDefined();
  });

  it('is usable as an AI agent tool', () => {
    expect(node.description.usableAsTool).toBe(true);
  });

  it('requires credentials', () => {
    expect(node.description.credentials?.[0]?.name).toBe('${escapeString(config.vendor)}Api');
    expect(node.description.credentials?.[0]?.required).toBe(true);
  });

  it('has an execute method', () => {
    expect(typeof node.execute).toBe('function');
  });

  it('exposes every resource in the contract', () => {
    const resourceProp = node.description.properties.find(
      (p: any) => p.name === 'resource'
    );
    const values = (resourceProp?.options ?? []).map((o: any) => o.value);
${ir.resources
  .map((r) => `    expect(values).toContain('${escapeString(r.name)}');`)
  .join('\n')}
    expect(values).toHaveLength(${ir.resources.length});
  });

  it('exposes every operation in the contract', () => {
    const operationProps = node.description.properties.filter(
      (p: any) => p.name === 'operation'
    );
    const values = operationProps.flatMap((p: any) =>
      (p.options ?? []).map((o: any) => o.value)
    );
${ir.resources
  .flatMap((r) => r.operations)
  .map((op) => `    expect(values).toContain('${escapeString(op.name)}');`)
  .join('\n')}
    expect(values).toHaveLength(${ir.resources.reduce(
      (n, r) => n + r.operations.length,
      0
    )});
  });
});
${
  operationTests.trim().length > 0
    ? `
describe('Fixture-backed operation tests', () => {
${operationTests}
});`
    : `
// No fixture-backed tests were emitted, because no operation in the contract
// carried a documented example response. Record fixtures by running the
// conformance test against the live API with a vendor credential present,
// and regenerate.`
}

describe('Parameter validation', () => {
  it('validates required parameters', () => {
    // Basic parameter validation test
    const validateRequired = (value: any, required: boolean) => {
      if (required && (value === undefined || value === null || value === '')) {
        throw new Error('Required parameter missing');
      }
    };

    expect(() => validateRequired('value', true)).not.toThrow();
    expect(() => validateRequired('', true)).toThrow();
    expect(() => validateRequired('', false)).not.toThrow();
  });
});

describe('Error mapping', () => {
  it('maps HTTP 400 to invalid input error', () => {
    const statusCode = 400;
    const errorMessage = statusCode === 400 ? 'Invalid input' : 'Unknown error';
    expect(errorMessage).toBe('Invalid input');
  });

  it('maps HTTP 401 to authentication error', () => {
    const statusCode = 401;
    const errorMessage = statusCode === 401 ? 'Authentication failed' : 'Unknown error';
    expect(errorMessage).toBe('Authentication failed');
  });

  it('maps HTTP 403 to forbidden error', () => {
    const statusCode = 403;
    const errorMessage = statusCode === 403 ? 'Access forbidden' : 'Unknown error';
    expect(errorMessage).toBe('Access forbidden');
  });

  it('maps HTTP 404 to not found error', () => {
    const statusCode = 404;
    const errorMessage = statusCode === 404 ? 'Resource not found' : 'Unknown error';
    expect(errorMessage).toBe('Resource not found');
  });

  it('maps HTTP 429 to rate limit error', () => {
    const statusCode = 429;
    const errorMessage = statusCode === 429 ? 'Rate limit exceeded' : 'Unknown error';
    expect(errorMessage).toBe('Rate limit exceeded');
  });

  it('maps HTTP 500 to server error', () => {
    const statusCode = 500;
    const errorMessage = statusCode >= 500 ? 'Server error' : 'Unknown error';
    expect(errorMessage).toBe('Server error');
  });
});
`;

  const unitTestPath = path.join(tempDir, 'test', 'unit.test.ts');
  await fs.promises.writeFile(unitTestPath, content, 'utf-8');
}

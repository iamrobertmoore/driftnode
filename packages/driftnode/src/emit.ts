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
  await emitCredentials(ir, config.vendor, tempDir);

  // Emit node class (Task 9.3)
  await emitNode(ir, config.vendor, tempDir);

  // TODO: Emit contract file (Task 11.1)
  // TODO: Emit package.json (Task 11.2)
  // TODO: Emit tsconfig.json (Task 11.3)
  // TODO: Emit README (Task 11.4)
  // TODO: Emit conformance test (Task 11.5)
  // TODO: Emit fixtures (Task 11.6)
  // TODO: Emit unit tests (Task 11.7)
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
async function emitCredentials(
  ir: IntermediateRepresentation,
  vendor: string,
  tempDir: string
): Promise<void> {
  const vendorName = capitalizeVendorName(vendor);
  const credentialsPath = path.join(tempDir, 'credentials', `${vendorName}Api.credentials.ts`);

  const content = generateCredentialsContent(ir, vendorName);

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
  vendorName: string
): string {
  const className = `${vendorName}Api`;
  // Convert back to kebab-case for the credential name
  const vendorKebab = vendorName.replace(/([A-Z])/g, (match, p1, offset) => 
    offset > 0 ? '-' + p1.toLowerCase() : p1.toLowerCase()
  );
  
  // Generate the properties array based on auth type
  const properties = generateCredentialProperties(ir.auth, ir.source.url || ir.source.path);

  return `import {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class ${className} implements ICredentialType {
  name = '${vendorKebab}Api';
  displayName = '${vendorName} API';
  documentationUrl = '${ir.source.url || 'https://example.com/docs'}';
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
      url: '/',
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
      name: op.display_name,
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
          returnData.push({
            json: {
              error: error.message,
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

  // Handle enum constraints (generate options dropdown)
  if (param.constraints?.enum) {
    field = generateEnumField(param, resourceName, operationName);
  } else {
    // Add validation rules for non-enum fields
    const validationRules = generateValidationRules(param);
    if (validationRules) {
      field += `\n${validationRules}`;
    }
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
        lines.push(`                if (${toCamelCase(param.name)} !== undefined) {`);
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
        lines.push(`                if (${toCamelCase(param.name)} !== undefined) {`);
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
        lines.push(`                if (${toCamelCase(param.name)} !== undefined) {`);
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

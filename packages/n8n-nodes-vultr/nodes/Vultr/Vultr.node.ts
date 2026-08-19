import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

export class Vultr implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Vultr',
    name: 'vultr',
    icon: 'file:vultr.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Interact with Vultr API',
    defaults: {
      name: 'Vultr',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'vultrApi',
        required: true,
      },
    ],
    usableAsTool: true,
    properties: [
    {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
      {
        name: 'Regions',
        value: 'regions',
      },
      {
        name: 'Plans',
        value: 'plans',
      },
      {
        name: 'SSH Keys',
        value: 'ssh-keys',
      },
      {
        name: 'Instances',
        value: 'instances',
      }
        ],
        default: 'regions',
        required: true,
      },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      displayOptions: {
        show: {
          resource: ['regions'],
        },
      },
      options: [
        {
          name: 'List',
          value: 'list-regions',
          description: 'List Regions',
        }
      ],
      default: 'list-regions',
      required: true,
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      displayOptions: {
        show: {
          resource: ['plans'],
        },
      },
      options: [
        {
          name: 'List',
          value: 'list-plans',
          description: 'List Plans',
        }
      ],
      default: 'list-plans',
      required: true,
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      displayOptions: {
        show: {
          resource: ['ssh-keys'],
        },
      },
      options: [
        {
          name: 'List',
          value: 'list-ssh-keys',
          description: 'List SSH Keys',
        },
        {
          name: 'Create',
          value: 'create-ssh-key',
          description: 'Create SSH key',
        },
        {
          name: 'Get',
          value: 'get-ssh-key',
          description: 'Get SSH Key',
        },
        {
          name: 'Update',
          value: 'update-ssh-key',
          description: 'Update SSH Key',
        },
        {
          name: 'Delete',
          value: 'delete-ssh-key',
          description: 'Delete SSH Key',
        }
      ],
      default: 'list-ssh-keys',
      required: true,
    },
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      noDataExpression: true,
      displayOptions: {
        show: {
          resource: ['instances'],
        },
      },
      options: [
        {
          name: 'List',
          value: 'list-instances',
          description: 'List Instances',
        },
        {
          name: 'Create',
          value: 'create-instance',
          description: 'Create Instance',
        },
        {
          name: 'Get',
          value: 'get-instance',
          description: 'Get Instance',
        },
        {
          name: 'Delete',
          value: 'delete-instance',
          description: 'Delete Instance',
        },
        {
          name: 'Start',
          value: 'start-instance',
          description: 'Start instance',
        },
        {
          name: 'Reboot',
          value: 'reboot-instance',
          description: 'Reboot Instance',
        },
        {
          name: 'Halt',
          value: 'halt-instance',
          description: 'Halt Instance',
        }
      ],
      default: 'list-instances',
      required: true,
    },
    {
      displayName: 'SSH Key ID',
      name: 'ssh-key-id',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['ssh-keys'],
          operation: ['get-ssh-key'],
        },
      },
      default: '',
      required: true,
      description: 'The SSH key ID',
    },
    {
      displayName: 'SSH Key ID',
      name: 'ssh-key-id',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['ssh-keys'],
          operation: ['update-ssh-key'],
        },
      },
      default: '',
      required: true,
      description: 'The SSH key ID',
    },
    {
      displayName: 'SSH Key ID',
      name: 'ssh-key-id',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['ssh-keys'],
          operation: ['delete-ssh-key'],
        },
      },
      default: '',
      required: true,
      description: 'The SSH key ID',
    },
    {
      displayName: 'Instance ID',
      name: 'instance-id',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['get-instance'],
        },
      },
      default: '',
      required: true,
      description: 'The instance ID',
    },
    {
      displayName: 'Instance ID',
      name: 'instance-id',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['delete-instance'],
        },
      },
      default: '',
      required: true,
      description: 'The instance ID',
    },
    {
      displayName: 'Instance ID',
      name: 'instance-id',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['start-instance'],
        },
      },
      default: '',
      required: true,
      description: 'The instance ID',
    },
    {
      displayName: 'Instance ID',
      name: 'instance-id',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['reboot-instance'],
        },
      },
      default: '',
      required: true,
      description: 'The instance ID',
    },
    {
      displayName: 'Instance ID',
      name: 'instance-id',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['halt-instance'],
        },
      },
      default: '',
      required: true,
      description: 'The instance ID',
    }
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
        switch (resource) {
          case 'regions':
            switch (operation) {
            case 'list-regions':
              {
                let url = '/regions';
                let response: any;
                try {
                  response = await this.helpers.requestWithAuthentication.call(
                    this,
                    'vultrApi',
                    {
                      method: 'GET',
                      url: `https://api.vultr.com/v2${url}`,
                      json: true,
                      resolveWithFullResponse: true,
                    },
                  );
                } catch (error: any) {
                  // Extract status code and response body from error
                  const statusCode = error.statusCode || error.response?.statusCode || 500;
                  const responseBody = error.response?.body || error.message || '';
                  const bodyExcerpt = typeof responseBody === 'string' ? responseBody.substring(0, 200) : JSON.stringify(responseBody).substring(0, 200);
                  const operationName = 'List Regions';

                  // Map HTTP status codes to user-friendly error messages
                  let errorMessage = '';
                  if (statusCode === 400) {
                    errorMessage = `Invalid input for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 401) {
                    errorMessage = `Authentication failed for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 403) {
                    errorMessage = `Access forbidden for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 404) {
                    errorMessage = `Resource not found for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 429) {
                    errorMessage = `Rate limit exceeded for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode >= 500) {
                    errorMessage = `Server error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else {
                    errorMessage = `HTTP error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  }

                  throw new Error(errorMessage);
                }

                returnData.push({
                  json: response.body || response,
                  pairedItem: i,
                });
              }
              break;
              default:
                throw new Error(`Unknown operation: ${operation}`);
            }
            break;
          case 'plans':
            switch (operation) {
            case 'list-plans':
              {
                let url = '/plans';
                let response: any;
                try {
                  response = await this.helpers.requestWithAuthentication.call(
                    this,
                    'vultrApi',
                    {
                      method: 'GET',
                      url: `https://api.vultr.com/v2${url}`,
                      json: true,
                      resolveWithFullResponse: true,
                    },
                  );
                } catch (error: any) {
                  // Extract status code and response body from error
                  const statusCode = error.statusCode || error.response?.statusCode || 500;
                  const responseBody = error.response?.body || error.message || '';
                  const bodyExcerpt = typeof responseBody === 'string' ? responseBody.substring(0, 200) : JSON.stringify(responseBody).substring(0, 200);
                  const operationName = 'List Plans';

                  // Map HTTP status codes to user-friendly error messages
                  let errorMessage = '';
                  if (statusCode === 400) {
                    errorMessage = `Invalid input for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 401) {
                    errorMessage = `Authentication failed for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 403) {
                    errorMessage = `Access forbidden for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 404) {
                    errorMessage = `Resource not found for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 429) {
                    errorMessage = `Rate limit exceeded for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode >= 500) {
                    errorMessage = `Server error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else {
                    errorMessage = `HTTP error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  }

                  throw new Error(errorMessage);
                }

                returnData.push({
                  json: response.body || response,
                  pairedItem: i,
                });
              }
              break;
              default:
                throw new Error(`Unknown operation: ${operation}`);
            }
            break;
          case 'ssh-keys':
            switch (operation) {
            case 'list-ssh-keys':
              {
                let url = '/ssh-keys';
                let response: any;
                try {
                  response = await this.helpers.requestWithAuthentication.call(
                    this,
                    'vultrApi',
                    {
                      method: 'GET',
                      url: `https://api.vultr.com/v2${url}`,
                      json: true,
                      resolveWithFullResponse: true,
                    },
                  );
                } catch (error: any) {
                  // Extract status code and response body from error
                  const statusCode = error.statusCode || error.response?.statusCode || 500;
                  const responseBody = error.response?.body || error.message || '';
                  const bodyExcerpt = typeof responseBody === 'string' ? responseBody.substring(0, 200) : JSON.stringify(responseBody).substring(0, 200);
                  const operationName = 'List SSH Keys';

                  // Map HTTP status codes to user-friendly error messages
                  let errorMessage = '';
                  if (statusCode === 400) {
                    errorMessage = `Invalid input for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 401) {
                    errorMessage = `Authentication failed for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 403) {
                    errorMessage = `Access forbidden for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 404) {
                    errorMessage = `Resource not found for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 429) {
                    errorMessage = `Rate limit exceeded for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode >= 500) {
                    errorMessage = `Server error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else {
                    errorMessage = `HTTP error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  }

                  throw new Error(errorMessage);
                }

                returnData.push({
                  json: response.body || response,
                  pairedItem: i,
                });
              }
              break;
            case 'create-ssh-key':
              {
                let url = '/ssh-keys';
                let response: any;
                try {
                  response = await this.helpers.requestWithAuthentication.call(
                    this,
                    'vultrApi',
                    {
                      method: 'POST',
                      url: `https://api.vultr.com/v2${url}`,
                      json: true,
                      resolveWithFullResponse: true,
                    },
                  );
                } catch (error: any) {
                  // Extract status code and response body from error
                  const statusCode = error.statusCode || error.response?.statusCode || 500;
                  const responseBody = error.response?.body || error.message || '';
                  const bodyExcerpt = typeof responseBody === 'string' ? responseBody.substring(0, 200) : JSON.stringify(responseBody).substring(0, 200);
                  const operationName = 'Create SSH key';

                  // Map HTTP status codes to user-friendly error messages
                  let errorMessage = '';
                  if (statusCode === 400) {
                    errorMessage = `Invalid input for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 401) {
                    errorMessage = `Authentication failed for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 403) {
                    errorMessage = `Access forbidden for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 404) {
                    errorMessage = `Resource not found for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 429) {
                    errorMessage = `Rate limit exceeded for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode >= 500) {
                    errorMessage = `Server error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else {
                    errorMessage = `HTTP error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  }

                  throw new Error(errorMessage);
                }

                returnData.push({
                  json: response.body || response,
                  pairedItem: i,
                });
              }
              break;
            case 'get-ssh-key':
              {
                const sshKeyId = this.getNodeParameter('ssh-key-id', i) as string;

                let url = '/ssh-keys/{ssh-key-id}';
                url = url.replace('{ssh-key-id}', encodeURIComponent(String(sshKeyId)));

                let response: any;
                try {
                  response = await this.helpers.requestWithAuthentication.call(
                    this,
                    'vultrApi',
                    {
                      method: 'GET',
                      url: `https://api.vultr.com/v2${url}`,
                      json: true,
                      resolveWithFullResponse: true,
                    },
                  );
                } catch (error: any) {
                  // Extract status code and response body from error
                  const statusCode = error.statusCode || error.response?.statusCode || 500;
                  const responseBody = error.response?.body || error.message || '';
                  const bodyExcerpt = typeof responseBody === 'string' ? responseBody.substring(0, 200) : JSON.stringify(responseBody).substring(0, 200);
                  const operationName = 'Get SSH Key';

                  // Map HTTP status codes to user-friendly error messages
                  let errorMessage = '';
                  if (statusCode === 400) {
                    errorMessage = `Invalid input for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 401) {
                    errorMessage = `Authentication failed for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 403) {
                    errorMessage = `Access forbidden for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 404) {
                    errorMessage = `Resource not found for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 429) {
                    errorMessage = `Rate limit exceeded for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode >= 500) {
                    errorMessage = `Server error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else {
                    errorMessage = `HTTP error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  }

                  throw new Error(errorMessage);
                }

                returnData.push({
                  json: response.body || response,
                  pairedItem: i,
                });
              }
              break;
            case 'update-ssh-key':
              {
                const sshKeyId = this.getNodeParameter('ssh-key-id', i) as string;

                let url = '/ssh-keys/{ssh-key-id}';
                url = url.replace('{ssh-key-id}', encodeURIComponent(String(sshKeyId)));

                let response: any;
                try {
                  response = await this.helpers.requestWithAuthentication.call(
                    this,
                    'vultrApi',
                    {
                      method: 'PATCH',
                      url: `https://api.vultr.com/v2${url}`,
                      json: true,
                      resolveWithFullResponse: true,
                    },
                  );
                } catch (error: any) {
                  // Extract status code and response body from error
                  const statusCode = error.statusCode || error.response?.statusCode || 500;
                  const responseBody = error.response?.body || error.message || '';
                  const bodyExcerpt = typeof responseBody === 'string' ? responseBody.substring(0, 200) : JSON.stringify(responseBody).substring(0, 200);
                  const operationName = 'Update SSH Key';

                  // Map HTTP status codes to user-friendly error messages
                  let errorMessage = '';
                  if (statusCode === 400) {
                    errorMessage = `Invalid input for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 401) {
                    errorMessage = `Authentication failed for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 403) {
                    errorMessage = `Access forbidden for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 404) {
                    errorMessage = `Resource not found for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 429) {
                    errorMessage = `Rate limit exceeded for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode >= 500) {
                    errorMessage = `Server error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else {
                    errorMessage = `HTTP error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  }

                  throw new Error(errorMessage);
                }

                returnData.push({
                  json: response.body || response,
                  pairedItem: i,
                });
              }
              break;
            case 'delete-ssh-key':
              {
                const sshKeyId = this.getNodeParameter('ssh-key-id', i) as string;

                let url = '/ssh-keys/{ssh-key-id}';
                url = url.replace('{ssh-key-id}', encodeURIComponent(String(sshKeyId)));

                let response: any;
                try {
                  response = await this.helpers.requestWithAuthentication.call(
                    this,
                    'vultrApi',
                    {
                      method: 'DELETE',
                      url: `https://api.vultr.com/v2${url}`,
                      json: true,
                      resolveWithFullResponse: true,
                    },
                  );
                } catch (error: any) {
                  // Extract status code and response body from error
                  const statusCode = error.statusCode || error.response?.statusCode || 500;
                  const responseBody = error.response?.body || error.message || '';
                  const bodyExcerpt = typeof responseBody === 'string' ? responseBody.substring(0, 200) : JSON.stringify(responseBody).substring(0, 200);
                  const operationName = 'Delete SSH Key';

                  // Map HTTP status codes to user-friendly error messages
                  let errorMessage = '';
                  if (statusCode === 400) {
                    errorMessage = `Invalid input for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 401) {
                    errorMessage = `Authentication failed for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 403) {
                    errorMessage = `Access forbidden for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 404) {
                    errorMessage = `Resource not found for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 429) {
                    errorMessage = `Rate limit exceeded for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode >= 500) {
                    errorMessage = `Server error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else {
                    errorMessage = `HTTP error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  }

                  throw new Error(errorMessage);
                }

                returnData.push({
                  json: response.body || response,
                  pairedItem: i,
                });
              }
              break;
              default:
                throw new Error(`Unknown operation: ${operation}`);
            }
            break;
          case 'instances':
            switch (operation) {
            case 'list-instances':
              {
                let url = '/instances';
                let response: any;
                try {
                  response = await this.helpers.requestWithAuthentication.call(
                    this,
                    'vultrApi',
                    {
                      method: 'GET',
                      url: `https://api.vultr.com/v2${url}`,
                      json: true,
                      resolveWithFullResponse: true,
                    },
                  );
                } catch (error: any) {
                  // Extract status code and response body from error
                  const statusCode = error.statusCode || error.response?.statusCode || 500;
                  const responseBody = error.response?.body || error.message || '';
                  const bodyExcerpt = typeof responseBody === 'string' ? responseBody.substring(0, 200) : JSON.stringify(responseBody).substring(0, 200);
                  const operationName = 'List Instances';

                  // Map HTTP status codes to user-friendly error messages
                  let errorMessage = '';
                  if (statusCode === 400) {
                    errorMessage = `Invalid input for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 401) {
                    errorMessage = `Authentication failed for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 403) {
                    errorMessage = `Access forbidden for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 404) {
                    errorMessage = `Resource not found for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 429) {
                    errorMessage = `Rate limit exceeded for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode >= 500) {
                    errorMessage = `Server error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else {
                    errorMessage = `HTTP error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  }

                  throw new Error(errorMessage);
                }

                returnData.push({
                  json: response.body || response,
                  pairedItem: i,
                });
              }
              break;
            case 'create-instance':
              {
                let url = '/instances';
                let response: any;
                try {
                  response = await this.helpers.requestWithAuthentication.call(
                    this,
                    'vultrApi',
                    {
                      method: 'POST',
                      url: `https://api.vultr.com/v2${url}`,
                      json: true,
                      resolveWithFullResponse: true,
                    },
                  );
                } catch (error: any) {
                  // Extract status code and response body from error
                  const statusCode = error.statusCode || error.response?.statusCode || 500;
                  const responseBody = error.response?.body || error.message || '';
                  const bodyExcerpt = typeof responseBody === 'string' ? responseBody.substring(0, 200) : JSON.stringify(responseBody).substring(0, 200);
                  const operationName = 'Create Instance';

                  // Map HTTP status codes to user-friendly error messages
                  let errorMessage = '';
                  if (statusCode === 400) {
                    errorMessage = `Invalid input for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 401) {
                    errorMessage = `Authentication failed for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 403) {
                    errorMessage = `Access forbidden for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 404) {
                    errorMessage = `Resource not found for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 429) {
                    errorMessage = `Rate limit exceeded for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode >= 500) {
                    errorMessage = `Server error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else {
                    errorMessage = `HTTP error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  }

                  throw new Error(errorMessage);
                }

                returnData.push({
                  json: response.body || response,
                  pairedItem: i,
                });
              }
              break;
            case 'get-instance':
              {
                const instanceId = this.getNodeParameter('instance-id', i) as string;

                let url = '/instances/{instance-id}';
                url = url.replace('{instance-id}', encodeURIComponent(String(instanceId)));

                let response: any;
                try {
                  response = await this.helpers.requestWithAuthentication.call(
                    this,
                    'vultrApi',
                    {
                      method: 'GET',
                      url: `https://api.vultr.com/v2${url}`,
                      json: true,
                      resolveWithFullResponse: true,
                    },
                  );
                } catch (error: any) {
                  // Extract status code and response body from error
                  const statusCode = error.statusCode || error.response?.statusCode || 500;
                  const responseBody = error.response?.body || error.message || '';
                  const bodyExcerpt = typeof responseBody === 'string' ? responseBody.substring(0, 200) : JSON.stringify(responseBody).substring(0, 200);
                  const operationName = 'Get Instance';

                  // Map HTTP status codes to user-friendly error messages
                  let errorMessage = '';
                  if (statusCode === 400) {
                    errorMessage = `Invalid input for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 401) {
                    errorMessage = `Authentication failed for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 403) {
                    errorMessage = `Access forbidden for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 404) {
                    errorMessage = `Resource not found for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 429) {
                    errorMessage = `Rate limit exceeded for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode >= 500) {
                    errorMessage = `Server error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else {
                    errorMessage = `HTTP error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  }

                  throw new Error(errorMessage);
                }

                returnData.push({
                  json: response.body || response,
                  pairedItem: i,
                });
              }
              break;
            case 'delete-instance':
              {
                const instanceId = this.getNodeParameter('instance-id', i) as string;

                let url = '/instances/{instance-id}';
                url = url.replace('{instance-id}', encodeURIComponent(String(instanceId)));

                let response: any;
                try {
                  response = await this.helpers.requestWithAuthentication.call(
                    this,
                    'vultrApi',
                    {
                      method: 'DELETE',
                      url: `https://api.vultr.com/v2${url}`,
                      json: true,
                      resolveWithFullResponse: true,
                    },
                  );
                } catch (error: any) {
                  // Extract status code and response body from error
                  const statusCode = error.statusCode || error.response?.statusCode || 500;
                  const responseBody = error.response?.body || error.message || '';
                  const bodyExcerpt = typeof responseBody === 'string' ? responseBody.substring(0, 200) : JSON.stringify(responseBody).substring(0, 200);
                  const operationName = 'Delete Instance';

                  // Map HTTP status codes to user-friendly error messages
                  let errorMessage = '';
                  if (statusCode === 400) {
                    errorMessage = `Invalid input for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 401) {
                    errorMessage = `Authentication failed for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 403) {
                    errorMessage = `Access forbidden for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 404) {
                    errorMessage = `Resource not found for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 429) {
                    errorMessage = `Rate limit exceeded for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode >= 500) {
                    errorMessage = `Server error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else {
                    errorMessage = `HTTP error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  }

                  throw new Error(errorMessage);
                }

                returnData.push({
                  json: response.body || response,
                  pairedItem: i,
                });
              }
              break;
            case 'start-instance':
              {
                const instanceId = this.getNodeParameter('instance-id', i) as string;

                let url = '/instances/{instance-id}/start';
                url = url.replace('{instance-id}', encodeURIComponent(String(instanceId)));

                let response: any;
                try {
                  response = await this.helpers.requestWithAuthentication.call(
                    this,
                    'vultrApi',
                    {
                      method: 'POST',
                      url: `https://api.vultr.com/v2${url}`,
                      json: true,
                      resolveWithFullResponse: true,
                    },
                  );
                } catch (error: any) {
                  // Extract status code and response body from error
                  const statusCode = error.statusCode || error.response?.statusCode || 500;
                  const responseBody = error.response?.body || error.message || '';
                  const bodyExcerpt = typeof responseBody === 'string' ? responseBody.substring(0, 200) : JSON.stringify(responseBody).substring(0, 200);
                  const operationName = 'Start instance';

                  // Map HTTP status codes to user-friendly error messages
                  let errorMessage = '';
                  if (statusCode === 400) {
                    errorMessage = `Invalid input for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 401) {
                    errorMessage = `Authentication failed for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 403) {
                    errorMessage = `Access forbidden for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 404) {
                    errorMessage = `Resource not found for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 429) {
                    errorMessage = `Rate limit exceeded for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode >= 500) {
                    errorMessage = `Server error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else {
                    errorMessage = `HTTP error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  }

                  throw new Error(errorMessage);
                }

                returnData.push({
                  json: response.body || response,
                  pairedItem: i,
                });
              }
              break;
            case 'reboot-instance':
              {
                const instanceId = this.getNodeParameter('instance-id', i) as string;

                let url = '/instances/{instance-id}/reboot';
                url = url.replace('{instance-id}', encodeURIComponent(String(instanceId)));

                let response: any;
                try {
                  response = await this.helpers.requestWithAuthentication.call(
                    this,
                    'vultrApi',
                    {
                      method: 'POST',
                      url: `https://api.vultr.com/v2${url}`,
                      json: true,
                      resolveWithFullResponse: true,
                    },
                  );
                } catch (error: any) {
                  // Extract status code and response body from error
                  const statusCode = error.statusCode || error.response?.statusCode || 500;
                  const responseBody = error.response?.body || error.message || '';
                  const bodyExcerpt = typeof responseBody === 'string' ? responseBody.substring(0, 200) : JSON.stringify(responseBody).substring(0, 200);
                  const operationName = 'Reboot Instance';

                  // Map HTTP status codes to user-friendly error messages
                  let errorMessage = '';
                  if (statusCode === 400) {
                    errorMessage = `Invalid input for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 401) {
                    errorMessage = `Authentication failed for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 403) {
                    errorMessage = `Access forbidden for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 404) {
                    errorMessage = `Resource not found for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 429) {
                    errorMessage = `Rate limit exceeded for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode >= 500) {
                    errorMessage = `Server error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else {
                    errorMessage = `HTTP error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  }

                  throw new Error(errorMessage);
                }

                returnData.push({
                  json: response.body || response,
                  pairedItem: i,
                });
              }
              break;
            case 'halt-instance':
              {
                const instanceId = this.getNodeParameter('instance-id', i) as string;

                let url = '/instances/{instance-id}/halt';
                url = url.replace('{instance-id}', encodeURIComponent(String(instanceId)));

                let response: any;
                try {
                  response = await this.helpers.requestWithAuthentication.call(
                    this,
                    'vultrApi',
                    {
                      method: 'POST',
                      url: `https://api.vultr.com/v2${url}`,
                      json: true,
                      resolveWithFullResponse: true,
                    },
                  );
                } catch (error: any) {
                  // Extract status code and response body from error
                  const statusCode = error.statusCode || error.response?.statusCode || 500;
                  const responseBody = error.response?.body || error.message || '';
                  const bodyExcerpt = typeof responseBody === 'string' ? responseBody.substring(0, 200) : JSON.stringify(responseBody).substring(0, 200);
                  const operationName = 'Halt Instance';

                  // Map HTTP status codes to user-friendly error messages
                  let errorMessage = '';
                  if (statusCode === 400) {
                    errorMessage = `Invalid input for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 401) {
                    errorMessage = `Authentication failed for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 403) {
                    errorMessage = `Access forbidden for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 404) {
                    errorMessage = `Resource not found for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode === 429) {
                    errorMessage = `Rate limit exceeded for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else if (statusCode >= 500) {
                    errorMessage = `Server error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  } else {
                    errorMessage = `HTTP error for ${operationName} (HTTP ${statusCode}): ${bodyExcerpt}`;
                  }

                  throw new Error(errorMessage);
                }

                returnData.push({
                  json: response.body || response,
                  pairedItem: i,
                });
              }
              break;
              default:
                throw new Error(`Unknown operation: ${operation}`);
            }
            break;
          default:
            throw new Error(`Unknown resource: ${resource}`);
        }
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

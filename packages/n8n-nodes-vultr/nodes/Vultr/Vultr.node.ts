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
          description: 'List all Regions at Vultr.',
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
          description: 'Get a list of all VPS plans at Vultr.',
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
          name: 'Get',
          value: 'get-ssh-key',
          description: 'Get information about an SSH Key.',
        },
        {
          name: 'Update',
          value: 'update-ssh-key',
          description: 'Update an SSH Key. The attributes name and ssh_key are optional. If not set, the attributes will retain their original values. New deployments will use the updated key, but this action does not update previously deployed instances.',
        },
        {
          name: 'Delete',
          value: 'delete-ssh-key',
          description: 'Delete an SSH Key.',
        },
        {
          name: 'List',
          value: 'list-ssh-keys',
          description: 'List all SSH Keys in your account.',
        },
        {
          name: 'Create',
          value: 'create-ssh-key',
          description: 'Create a new SSH Key for use with future instances. This does not update any running instances.',
        }
      ],
      default: 'get-ssh-key',
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
          description: 'List all VPS instances in your account.',
        },
        {
          name: 'Create',
          value: 'create-instance',
          description: 'Create a new VPS Instance in a region with the desired plan. Choose one of the following to deploy the instance: os_id, iso_id, snapshot_id, app_id, image_id.',
        },
        {
          name: 'Get',
          value: 'get-instance',
          description: 'Get information about an Instance.',
        },
        {
          name: 'Delete',
          value: 'delete-instance',
          description: 'Delete an Instance.',
        },
        {
          name: 'Start',
          value: 'start-instance',
          description: 'Start an Instance.',
        },
        {
          name: 'Reboot',
          value: 'reboot-instance',
          description: 'Reboot an Instance.',
        },
        {
          name: 'Halt',
          value: 'halt-instance',
          description: 'Halt an Instance.',
        }
      ],
      default: 'list-instances',
      required: true,
    },
    {
      displayName: 'Per Page',
      name: 'per_page',
      type: 'number',
      displayOptions: {
        show: {
          resource: ['regions'],
          operation: ['list-regions'],
        },
      },
      default: 0,
      required: false,
      description: 'Number of items requested per page. Default is 100 and Max is 500.',
    },
    {
      displayName: 'Cursor',
      name: 'cursor',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['regions'],
          operation: ['list-regions'],
        },
      },
      default: '',
      required: false,
      description: 'Cursor for paging. See Meta and Pagination.',
    },
    {
      displayName: 'Type',
      name: 'type',
      type: 'options',
      displayOptions: {
        show: {
          resource: ['plans'],
          operation: ['list-plans'],
        },
      },
      options: [
        {
          name: 'all',
          value: 'all',
        },
        {
          name: 'vc2',
          value: 'vc2',
        },
        {
          name: 'vdc',
          value: 'vdc',
        },
        {
          name: 'vhf',
          value: 'vhf',
        },
        {
          name: 'vhp',
          value: 'vhp',
        },
        {
          name: 'voc',
          value: 'voc',
        },
        {
          name: 'voc-g',
          value: 'voc-g',
        },
        {
          name: 'voc-c',
          value: 'voc-c',
        },
        {
          name: 'voc-m',
          value: 'voc-m',
        },
        {
          name: 'voc-s',
          value: 'voc-s',
        },
        {
          name: 'vcg',
          value: 'vcg',
        }
      ],
      default: 'all',
      required: false,
      description: 'Filter the results by type.',
    },
    {
      displayName: 'Per Page',
      name: 'per_page',
      type: 'number',
      displayOptions: {
        show: {
          resource: ['plans'],
          operation: ['list-plans'],
        },
      },
      default: 0,
      required: false,
      description: 'Number of items requested per page. Default is 100 and Max is 500.',
    },
    {
      displayName: 'Cursor',
      name: 'cursor',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['plans'],
          operation: ['list-plans'],
        },
      },
      default: '',
      required: false,
      description: 'Cursor for paging. See Meta and Pagination.',
    },
    {
      displayName: 'OS',
      name: 'os',
      type: 'options',
      displayOptions: {
        show: {
          resource: ['plans'],
          operation: ['list-plans'],
        },
      },
      options: [
        {
          name: 'windows',
          value: 'windows',
        }
      ],
      default: 'windows',
      required: false,
      description: 'Filter the results by operating system.',
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
      description: 'The SSH Key id.',
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
      description: 'The SSH Key id.',
    },
    {
      displayName: 'Name',
      name: 'name',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['ssh-keys'],
          operation: ['update-ssh-key'],
        },
      },
      default: '',
      required: false,
      description: 'The user-supplied name for this SSH Key.',
    },
    {
      displayName: 'SSH Key',
      name: 'ssh_key',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['ssh-keys'],
          operation: ['update-ssh-key'],
        },
      },
      default: '',
      required: false,
      description: 'The SSH Key.',
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
      description: 'The SSH Key id.',
    },
    {
      displayName: 'Per Page',
      name: 'per_page',
      type: 'number',
      displayOptions: {
        show: {
          resource: ['ssh-keys'],
          operation: ['list-ssh-keys'],
        },
      },
      default: 0,
      required: false,
      description: 'Number of items requested per page. Default is 100 and Max is 500.',
    },
    {
      displayName: 'Cursor',
      name: 'cursor',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['ssh-keys'],
          operation: ['list-ssh-keys'],
        },
      },
      default: '',
      required: false,
      description: 'Cursor for paging. See Meta and Pagination.',
    },
    {
      displayName: 'Name',
      name: 'name',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['ssh-keys'],
          operation: ['create-ssh-key'],
        },
      },
      default: '',
      required: true,
      description: 'The user-supplied name for this SSH Key.',
    },
    {
      displayName: 'SSH Key',
      name: 'ssh_key',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['ssh-keys'],
          operation: ['create-ssh-key'],
        },
      },
      default: '',
      required: true,
      description: 'The SSH Key.',
    },
    {
      displayName: 'Per Page',
      name: 'per_page',
      type: 'number',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['list-instances'],
        },
      },
      default: 100,
      required: false,
      description: 'Number of items requested per page. Default is 100 and Max is 500.',
      typeOptions: {
        maximum: 500
      },
    },
    {
      displayName: 'Cursor',
      name: 'cursor',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['list-instances'],
        },
      },
      default: '',
      required: false,
      description: 'Cursor for paging. See Meta and Pagination.',
    },
    {
      displayName: 'Tag',
      name: 'tag',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['list-instances'],
        },
      },
      default: '',
      required: false,
      description: 'Deprecated. Filter by specific tag.',
    },
    {
      displayName: 'Label',
      name: 'label',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['list-instances'],
        },
      },
      default: '',
      required: false,
      description: 'Filter by label.',
    },
    {
      displayName: 'Main IP',
      name: 'main_ip',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['list-instances'],
        },
      },
      default: '',
      required: false,
      description: 'Filter by main ip address.',
    },
    {
      displayName: 'Region',
      name: 'region',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['list-instances'],
        },
      },
      default: '',
      required: false,
      description: 'Filter by Region id.',
    },
    {
      displayName: 'Firewall Group ID',
      name: 'firewall_group_id',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['list-instances'],
        },
      },
      default: '',
      required: false,
      description: 'Filter by Firewall group id.',
    },
    {
      displayName: 'Hostname',
      name: 'hostname',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['list-instances'],
        },
      },
      default: '',
      required: false,
      description: 'Filter by hostname.',
    },
    {
      displayName: 'Show Pending Charges',
      name: 'show_pending_charges',
      type: 'boolean',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['list-instances'],
        },
      },
      default: false,
      required: false,
      description: 'Set to true to show pending charges.',
    },
    {
      displayName: 'Region',
      name: 'region',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: '',
      required: true,
      description: 'The Region id where the Instance is located.',
    },
    {
      displayName: 'Plan',
      name: 'plan',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: '',
      required: true,
      description: 'The Plan id to use when deploying this instance.',
    },
    {
      displayName: 'OS ID',
      name: 'os_id',
      type: 'number',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: 0,
      required: false,
      description: 'The Operating System id to use when deploying this instance.',
    },
    {
      displayName: 'iPXE Chain URL',
      name: 'ipxe_chain_url',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: '',
      required: false,
      description: 'The URL location of the iPXE chainloader.',
    },
    {
      displayName: 'ISO ID',
      name: 'iso_id',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: '',
      required: false,
      description: 'The ISO id to use when deploying this instance.',
    },
    {
      displayName: 'Script ID',
      name: 'script_id',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: '',
      required: false,
      description: 'The Startup Script id to use when deploying this instance.',
    },
    {
      displayName: 'Snapshot ID',
      name: 'snapshot_id',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: '',
      required: false,
      description: 'The Snapshot id to use when deploying the instance.',
    },
    {
      displayName: 'Enable IPv6',
      name: 'enable_ipv6',
      type: 'boolean',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: false,
      required: false,
      description: 'Enable IPv6.',
    },
    {
      displayName: 'Disable Public IPv4',
      name: 'disable_public_ipv4',
      type: 'boolean',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: false,
      required: false,
      description: 'Don\'t set up a public IPv4 address when IPv6 is enabled. Will not do anything unless enable_ipv6 is also true.',
    },
    {
      displayName: 'Attach VPC',
      name: 'attach_vpc',
      type: 'collection',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: [],
      required: false,
      description: 'An array of VPC IDs to attach to this Instance. This parameter takes precedence over enable_vpc. Please choose one parameter.',
    },
    {
      displayName: 'Label',
      name: 'label',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: '',
      required: false,
      description: 'A user-supplied label for this instance.',
    },
    {
      displayName: 'SSH Key ID',
      name: 'sshkey_id',
      type: 'collection',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: [],
      required: false,
      description: 'The SSH Key id to install on this instance.',
    },
    {
      displayName: 'Backups',
      name: 'backups',
      type: 'options',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      options: [
        {
          name: 'enabled',
          value: 'enabled',
        },
        {
          name: 'disabled',
          value: 'disabled',
        }
      ],
      default: 'enabled',
      required: false,
      description: 'Enable automatic backups for the instance (does not work for VX1 block storage).',
    },
    {
      displayName: 'App ID',
      name: 'app_id',
      type: 'number',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: 0,
      required: false,
      description: 'The Application id to use when deploying this instance.',
    },
    {
      displayName: 'Image ID',
      name: 'image_id',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: '',
      required: false,
      description: 'The Application image_id to use when deploying this instance.',
    },
    {
      displayName: 'User Data',
      name: 'user_data',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: '',
      required: false,
      description: 'The user-supplied, base64 encoded user data to attach to this instance.',
    },
    {
      displayName: 'DDoS Protection',
      name: 'ddos_protection',
      type: 'boolean',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: false,
      required: false,
      description: 'Enable DDoS protection (there is an additional charge for this).',
    },
    {
      displayName: 'Activation Email',
      name: 'activation_email',
      type: 'boolean',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: false,
      required: false,
      description: 'Notify by email after deployment.',
    },
    {
      displayName: 'Hostname',
      name: 'hostname',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: '',
      required: false,
      description: 'The hostname to use when deploying this instance.',
    },
    {
      displayName: 'Firewall Group ID',
      name: 'firewall_group_id',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: '',
      required: false,
      description: 'The Firewall Group id to attach to this Instance.',
    },
    {
      displayName: 'Reserved IPv4',
      name: 'reserved_ipv4',
      type: 'string',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: '',
      required: false,
      description: 'ID of the floating IP to use as the main IP of this server.',
    },
    {
      displayName: 'Enable VPC',
      name: 'enable_vpc',
      type: 'boolean',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: false,
      required: false,
      description: 'If true, VPC support will be added to the new server. This parameter attaches a single VPC. When no VPC exists in the region, it will be automatically created. If there are multiple VPCs in the instance\'s region, use attach_vpc instead to specify a network.',
    },
    {
      displayName: 'VPC Only',
      name: 'vpc_only',
      type: 'boolean',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: false,
      required: false,
      description: 'If true, this VPS will not receive a public IP or public NIC. A vpc_id will be required in the attach_vpc array. The first vpc_id provided must have a NAT Gateway attached. This VPS will gain access to the internet via the NAT Gateway attached to the VPC.',
    },
    {
      displayName: 'Tags',
      name: 'tags',
      type: 'collection',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: [],
      required: false,
      description: 'Tags to apply to the instance.',
    },
    {
      displayName: 'User Scheme',
      name: 'user_scheme',
      type: 'options',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      options: [
        {
          name: 'root',
          value: 'root',
        },
        {
          name: 'limited',
          value: 'limited',
        }
      ],
      default: 'root',
      required: false,
      description: 'Linux-only: The user scheme used for logging into this instance. By default, the "root" user is configured. Alternatively, a limited user with sudo permissions can be selected.',
    },
    {
      displayName: 'App Variables',
      name: 'app_variables',
      type: 'fixedCollection',
      displayOptions: {
        show: {
          resource: ['instances'],
          operation: ['create-instance'],
        },
      },
      default: {},
      required: false,
      description: 'The app variable inputs for configuring the marketplace app (name/value pairs).',
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
      description: 'The Instance ID.',
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
      description: 'The Instance ID.',
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
      description: 'The Instance ID.',
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
      description: 'The Instance ID.',
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
      description: 'The Instance ID.',
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
                const perPage = this.getNodeParameter('per_page', i, undefined) as number;
                const cursor = this.getNodeParameter('cursor', i, undefined) as string;

                let url = '/regions';
                const qs: Record<string, any> = {};
                if (perPage !== undefined) {
                  qs['per_page'] = perPage;
                }
                if (cursor !== undefined) {
                  qs['cursor'] = cursor;
                }

                let response: any;
                try {
                  response = await this.helpers.requestWithAuthentication.call(
                    this,
                    'vultrApi',
                    {
                      method: 'GET',
                      url: `https://api.vultr.com/v2${url}`,
                      qs,
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
                const type = this.getNodeParameter('type', i, undefined) as string;
                const perPage = this.getNodeParameter('per_page', i, undefined) as number;
                const cursor = this.getNodeParameter('cursor', i, undefined) as string;
                const os = this.getNodeParameter('os', i, undefined) as string;

                let url = '/plans';
                const qs: Record<string, any> = {};
                if (type !== undefined) {
                  qs['type'] = type;
                }
                if (perPage !== undefined) {
                  qs['per_page'] = perPage;
                }
                if (cursor !== undefined) {
                  qs['cursor'] = cursor;
                }
                if (os !== undefined) {
                  qs['os'] = os;
                }

                let response: any;
                try {
                  response = await this.helpers.requestWithAuthentication.call(
                    this,
                    'vultrApi',
                    {
                      method: 'GET',
                      url: `https://api.vultr.com/v2${url}`,
                      qs,
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
                const name = this.getNodeParameter('name', i, undefined) as string;
                const sshKey = this.getNodeParameter('ssh_key', i, undefined) as string;

                let url = '/ssh-keys/{ssh-key-id}';
                url = url.replace('{ssh-key-id}', encodeURIComponent(String(sshKeyId)));

                const body: Record<string, any> = {};
                if (name !== undefined) {
                  body['name'] = name;
                }
                if (sshKey !== undefined) {
                  body['ssh_key'] = sshKey;
                }

                let response: any;
                try {
                  response = await this.helpers.requestWithAuthentication.call(
                    this,
                    'vultrApi',
                    {
                      method: 'PATCH',
                      url: `https://api.vultr.com/v2${url}`,
                      body,
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
            case 'list-ssh-keys':
              {
                const perPage = this.getNodeParameter('per_page', i, undefined) as number;
                const cursor = this.getNodeParameter('cursor', i, undefined) as string;

                let url = '/ssh-keys';
                const qs: Record<string, any> = {};
                if (perPage !== undefined) {
                  qs['per_page'] = perPage;
                }
                if (cursor !== undefined) {
                  qs['cursor'] = cursor;
                }

                let response: any;
                try {
                  response = await this.helpers.requestWithAuthentication.call(
                    this,
                    'vultrApi',
                    {
                      method: 'GET',
                      url: `https://api.vultr.com/v2${url}`,
                      qs,
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
                const name = this.getNodeParameter('name', i) as string;
                const sshKey = this.getNodeParameter('ssh_key', i) as string;

                let url = '/ssh-keys';
                const body: Record<string, any> = {};
                body['name'] = name;
                body['ssh_key'] = sshKey;

                let response: any;
                try {
                  response = await this.helpers.requestWithAuthentication.call(
                    this,
                    'vultrApi',
                    {
                      method: 'POST',
                      url: `https://api.vultr.com/v2${url}`,
                      body,
                      json: true,
                      resolveWithFullResponse: true,
                    },
                  );
                } catch (error: any) {
                  // Extract status code and response body from error
                  const statusCode = error.statusCode || error.response?.statusCode || 500;
                  const responseBody = error.response?.body || error.message || '';
                  const bodyExcerpt = typeof responseBody === 'string' ? responseBody.substring(0, 200) : JSON.stringify(responseBody).substring(0, 200);
                  const operationName = 'Create SSH Key';

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
                const perPage = this.getNodeParameter('per_page', i, undefined) as number;
                const cursor = this.getNodeParameter('cursor', i, undefined) as string;
                const tag = this.getNodeParameter('tag', i, undefined) as string;
                const label = this.getNodeParameter('label', i, undefined) as string;
                const mainIp = this.getNodeParameter('main_ip', i, undefined) as string;
                const region = this.getNodeParameter('region', i, undefined) as string;
                const firewallGroupId = this.getNodeParameter('firewall_group_id', i, undefined) as string;
                const hostname = this.getNodeParameter('hostname', i, undefined) as string;
                const showPendingCharges = this.getNodeParameter('show_pending_charges', i, undefined) as boolean;

                let url = '/instances';
                const qs: Record<string, any> = {};
                if (perPage !== undefined) {
                  qs['per_page'] = perPage;
                }
                if (cursor !== undefined) {
                  qs['cursor'] = cursor;
                }
                if (tag !== undefined) {
                  qs['tag'] = tag;
                }
                if (label !== undefined) {
                  qs['label'] = label;
                }
                if (mainIp !== undefined) {
                  qs['main_ip'] = mainIp;
                }
                if (region !== undefined) {
                  qs['region'] = region;
                }
                if (firewallGroupId !== undefined) {
                  qs['firewall_group_id'] = firewallGroupId;
                }
                if (hostname !== undefined) {
                  qs['hostname'] = hostname;
                }
                if (showPendingCharges !== undefined) {
                  qs['show_pending_charges'] = showPendingCharges;
                }

                let response: any;
                try {
                  response = await this.helpers.requestWithAuthentication.call(
                    this,
                    'vultrApi',
                    {
                      method: 'GET',
                      url: `https://api.vultr.com/v2${url}`,
                      qs,
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
                const region = this.getNodeParameter('region', i) as string;
                const plan = this.getNodeParameter('plan', i) as string;
                const osId = this.getNodeParameter('os_id', i, undefined) as number;
                const ipxeChainUrl = this.getNodeParameter('ipxe_chain_url', i, undefined) as string;
                const isoId = this.getNodeParameter('iso_id', i, undefined) as string;
                const scriptId = this.getNodeParameter('script_id', i, undefined) as string;
                const snapshotId = this.getNodeParameter('snapshot_id', i, undefined) as string;
                const enableIpv6 = this.getNodeParameter('enable_ipv6', i, undefined) as boolean;
                const disablePublicIpv4 = this.getNodeParameter('disable_public_ipv4', i, undefined) as boolean;
                const attachVpc = this.getNodeParameter('attach_vpc', i, undefined) as any[];
                const label = this.getNodeParameter('label', i, undefined) as string;
                const sshkeyId = this.getNodeParameter('sshkey_id', i, undefined) as any[];
                const backups = this.getNodeParameter('backups', i, undefined) as string;
                const appId = this.getNodeParameter('app_id', i, undefined) as number;
                const imageId = this.getNodeParameter('image_id', i, undefined) as string;
                const userData = this.getNodeParameter('user_data', i, undefined) as string;
                const ddosProtection = this.getNodeParameter('ddos_protection', i, undefined) as boolean;
                const activationEmail = this.getNodeParameter('activation_email', i, undefined) as boolean;
                const hostname = this.getNodeParameter('hostname', i, undefined) as string;
                const firewallGroupId = this.getNodeParameter('firewall_group_id', i, undefined) as string;
                const reservedIpv4 = this.getNodeParameter('reserved_ipv4', i, undefined) as string;
                const enableVpc = this.getNodeParameter('enable_vpc', i, undefined) as boolean;
                const vpcOnly = this.getNodeParameter('vpc_only', i, undefined) as boolean;
                const tags = this.getNodeParameter('tags', i, undefined) as any[];
                const userScheme = this.getNodeParameter('user_scheme', i, undefined) as string;
                const appVariables = this.getNodeParameter('app_variables', i, undefined) as Record<string, any>;

                let url = '/instances';
                const body: Record<string, any> = {};
                body['region'] = region;
                body['plan'] = plan;
                if (osId !== undefined) {
                  body['os_id'] = osId;
                }
                if (ipxeChainUrl !== undefined) {
                  body['ipxe_chain_url'] = ipxeChainUrl;
                }
                if (isoId !== undefined) {
                  body['iso_id'] = isoId;
                }
                if (scriptId !== undefined) {
                  body['script_id'] = scriptId;
                }
                if (snapshotId !== undefined) {
                  body['snapshot_id'] = snapshotId;
                }
                if (enableIpv6 !== undefined) {
                  body['enable_ipv6'] = enableIpv6;
                }
                if (disablePublicIpv4 !== undefined) {
                  body['disable_public_ipv4'] = disablePublicIpv4;
                }
                if (attachVpc !== undefined) {
                  body['attach_vpc'] = attachVpc;
                }
                if (label !== undefined) {
                  body['label'] = label;
                }
                if (sshkeyId !== undefined) {
                  body['sshkey_id'] = sshkeyId;
                }
                if (backups !== undefined) {
                  body['backups'] = backups;
                }
                if (appId !== undefined) {
                  body['app_id'] = appId;
                }
                if (imageId !== undefined) {
                  body['image_id'] = imageId;
                }
                if (userData !== undefined) {
                  body['user_data'] = userData;
                }
                if (ddosProtection !== undefined) {
                  body['ddos_protection'] = ddosProtection;
                }
                if (activationEmail !== undefined) {
                  body['activation_email'] = activationEmail;
                }
                if (hostname !== undefined) {
                  body['hostname'] = hostname;
                }
                if (firewallGroupId !== undefined) {
                  body['firewall_group_id'] = firewallGroupId;
                }
                if (reservedIpv4 !== undefined) {
                  body['reserved_ipv4'] = reservedIpv4;
                }
                if (enableVpc !== undefined) {
                  body['enable_vpc'] = enableVpc;
                }
                if (vpcOnly !== undefined) {
                  body['vpc_only'] = vpcOnly;
                }
                if (tags !== undefined) {
                  body['tags'] = tags;
                }
                if (userScheme !== undefined) {
                  body['user_scheme'] = userScheme;
                }
                if (appVariables !== undefined) {
                  body['app_variables'] = appVariables;
                }

                let response: any;
                try {
                  response = await this.helpers.requestWithAuthentication.call(
                    this,
                    'vultrApi',
                    {
                      method: 'POST',
                      url: `https://api.vultr.com/v2${url}`,
                      body,
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
                  const operationName = 'Start Instance';

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

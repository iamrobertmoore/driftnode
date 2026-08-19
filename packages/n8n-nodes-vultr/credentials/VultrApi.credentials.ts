import {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class VultrApi implements ICredentialType {
  name = 'vultrApi';
  displayName = 'Vultr API';
  documentationUrl = 'https://www.vultr.com/api/';
  properties: INodeProperties[] = [
    {
      displayName: 'Access Token',
      name: 'accessToken',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      required: true,
      description: 'Bearer token for authentication. See the [documentation](https://www.vultr.com/api/) for details.',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        'Authorization': '=Bearer {{$credentials.accessToken}}',
      }
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: 'https://api.vultr.com/v2',
      url: '/regions',
    },
  };
}

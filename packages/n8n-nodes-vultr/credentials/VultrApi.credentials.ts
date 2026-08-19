import {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class VultrApi implements ICredentialType {
  name = 'vultrApi';
  displayName = 'Vultr API';
  documentationUrl = 'https://example.com/docs';
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
      description: 'Bearer token for authentication. See the [documentation](/Users/robertmoore/projects/Hackathons/ready-spec-ship/repo/examples/vultr-api-docs.html) for details.',
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
      url: '/',
    },
  };
}

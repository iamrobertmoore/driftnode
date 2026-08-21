/**
 * Minimal ambient declarations for n8n-workflow, used only when verifying
 * emitted code.
 *
 * Why this exists rather than depending on the real package: n8n-workflow
 * pulls in isolated-vm, a native module that must be compiled, along with the
 * AWS SDK, OpenTelemetry, Sentry and LangChain. That is roughly 300 packages
 * and a C++ toolchain, in a repository whose entire output ships with zero
 * runtime dependencies, so that eight type names resolve during a typecheck.
 *
 * The trade-off is stated plainly: verification checks that generated code is
 * structurally valid TypeScript and uses these interfaces coherently. It does
 * not check the emitted code against n8n's real type definitions. The stronger
 * check is that the generated package is published and installed into a real
 * n8n, which is where an actual API mismatch would surface.
 *
 * This file is never emitted into a generated package. Consumers of a
 * generated node depend on the real n8n-workflow.
 */
declare module 'n8n-workflow' {
  export interface INodePropertyOptions {
    name: string;
    value: string | number | boolean;
    description?: string;
  }

  export interface INodeProperties {
    displayName: string;
    name: string;
    type: string;
    default?: unknown;
    required?: boolean;
    description?: string;
    noDataExpression?: boolean;
    options?: INodePropertyOptions[];
    displayOptions?: {
      show?: Record<string, Array<string | number | boolean>>;
      hide?: Record<string, Array<string | number | boolean>>;
    };
    typeOptions?: Record<string, unknown>;
    placeholder?: string;
  }

  export interface INodeCredentialDescription {
    name: string;
    required?: boolean;
  }

  export interface INodeTypeDescription {
    displayName: string;
    name: string;
    icon?: string;
    group: string[];
    version: number | number[];
    subtitle?: string;
    description: string;
    defaults: { name: string; [key: string]: unknown };
    inputs: string[];
    outputs: string[];
    credentials?: INodeCredentialDescription[];
    usableAsTool?: boolean;
    properties: INodeProperties[];
  }

  export interface INodeExecutionData {
    json: Record<string, unknown> | unknown;
    pairedItem?: number | { item: number };
    binary?: Record<string, unknown>;
  }

  export interface IExecuteFunctions {
    getInputData(): INodeExecutionData[];
    getNodeParameter(name: string, itemIndex: number, fallback?: unknown): unknown;
    getCredentials(type: string): Promise<Record<string, unknown>>;
    continueOnFail(): boolean;
    helpers: {
      requestWithAuthentication: {
        call(context: unknown, credentialType: string, options: Record<string, unknown>): Promise<any>;
      };
      request?: (options: Record<string, unknown>) => Promise<any>;
    };
  }

  export interface INodeType {
    description: INodeTypeDescription;
    execute?(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
  }

  export interface IAuthenticateGeneric {
    type: 'generic';
    properties: {
      headers?: Record<string, string>;
      qs?: Record<string, string>;
      body?: Record<string, string>;
      auth?: Record<string, string>;
    };
  }

  export interface ICredentialTestRequest {
    request: {
      baseURL?: string;
      url: string;
      method?: string;
    };
  }

  export interface ICredentialType {
    name: string;
    displayName: string;
    documentationUrl?: string;
    properties: INodeProperties[];
    authenticate?: IAuthenticateGeneric;
    test?: ICredentialTestRequest;
  }
}

# Requirements Document

## Introduction

This document specifies the requirements for generating n8n community node packages from prose API documentation. The generator transforms vendor documentation (URL or local file) into a complete, publishable node package with conformance tests and offline fixture support.

The generation process consists of five distinct stages: ingestion of documentation, extraction of structured contracts, validation of completeness, emission of code artifacts, and verification of correctness.

## Scope

### v1 Requirements (In Scope)

The following requirements are implemented in version 1:

- Requirements 1-10: Documentation ingestion, extraction of base URL, authentication, resources, operations, parameters, response shapes, multi-chunk IR merging
- Requirements 12-14: IR validation for completeness, operation integrity, and authentication configuration
- Requirements 16-19: Emission of credentials file, node class, error mapping, and IR contract file
- Requirements 21-23: Emission of package metadata, conformance test, and fixture-backed offline mode
- Requirements 25-27: Typechecking, package loading verification, and unit test execution

### Deferred Requirements (Specified but Beyond v1)

The following requirements are documented for completeness but not implemented in version 1. Nothing claims to work that does not.

- **Requirement 11** (Pagination extraction): Pagination patterns vary significantly across vendors and require additional research
- **Requirement 15** (Type consistency validation): Type system validation requires schema inference engine not yet implemented
- **Requirement 20** (Polling trigger): Watermark state management requires n8n workflow state API integration
- **Requirement 24** (CI workflow template): GitHub Actions integration requires repository structure assumptions
- **Requirement 28** (Summary report): User-facing reporting is lower priority than core generation

## Glossary

- **Generator**: The driftnode package that orchestrates the documentation-to-node transformation
- **Vendor_Documentation**: Prose API documentation provided as a URL or local file path
- **Configuration_File**: A user-provided file specifying which resources and operations to expose
- **IR**: Intermediate Representation, a structured contract extracted from Vendor_Documentation
- **Node_Package**: The complete n8n community node package emitted by the Generator
- **Kiro_CLI**: The command-line interface to Kiro's extraction engine
- **Conformance_Test**: A test that validates the generated node against the live vendor API
- **Fixture**: A recorded API response used for offline testing
- **Watermark**: State tracking mechanism that prevents re-emission of already-processed items in polling triggers

---

## Requirements

### Stage 1: Ingest

### Requirement 1: Fetch Remote Documentation

**User Story:** As a node maintainer, I want to provide a documentation URL, so that the Generator can fetch the latest vendor documentation.

#### Acceptance Criteria

1. WHEN a URL is provided in the Configuration_File, THE Generator SHALL fetch the content via HTTP
2. WHEN the HTTP request succeeds, THE Generator SHALL store the raw content for processing
3. IF multiple error conditions exist, THE Generator SHALL report only the highest-priority error according to this layered precedence:
   - Transport failures: network error (highest priority), then timeout after 30 seconds
   - HTTP status: 401 or 403 authentication denied, then 404 not found, then any other non-2xx status
   - Payload problems: unsupported Content-Type (must be text/html, text/plain, text/markdown, or application/json), then empty response body (lowest priority)
4. THE error message SHALL include the URL and relevant error details for the reported error

**Note:** This precedence is layered rather than arbitrary. Transport failures mean no response exists, so HTTP status cannot be checked. Content type and payload can only be inspected after a successful HTTP response.

### Requirement 2: Read Local Documentation

**User Story:** As a node maintainer, I want to provide a local file path, so that I can generate nodes from documentation I have already downloaded.

#### Acceptance Criteria

1. WHEN a local file path is provided in the Configuration_File, THE Generator SHALL read the file from disk
2. WHEN the file read succeeds, THE Generator SHALL store the content for processing
3. IF multiple error conditions exist, THE Generator SHALL report only the highest-priority error according to this layered precedence:
   - File does not exist at the provided path (highest priority)
   - File exists but cannot be read due to permissions
   - File is empty (contains no content)
   - File extension is not .html, .md, .txt, or .json (lowest priority)
4. THE error message SHALL include the absolute path and relevant error details for the reported error

### Requirement 3: Normalize Documentation to Text

**User Story:** As a node maintainer, I want HTML documentation converted to clean text, so that the extraction engine receives consistent input.

#### Acceptance Criteria

1. WHEN the Vendor_Documentation is HTML, THE Generator SHALL strip all script and style tags
2. WHEN the Vendor_Documentation is HTML, THE Generator SHALL convert HTML entities to their text equivalents
3. WHEN the Vendor_Documentation is HTML, THE Generator SHALL preserve code blocks and pre-formatted text exactly, maintaining whitespace, line breaks, and indentation, while still applying HTML entity decoding (e.g., &quot; → ", &lt; → <) to reproduce what a reader sees in a browser
4. WHEN the Vendor_Documentation is Markdown, THE Generator SHALL preserve the Markdown formatting
5. WHEN the Vendor_Documentation is JSON, THE Generator SHALL pretty-print the JSON with consistent indentation
6. THE Generator SHALL normalize all line endings to Unix-style (LF)
7. THE Generator SHALL remove leading and trailing whitespace from the normalized content

**Note:** HTML entity decoding applies inside code blocks because the goal is to reproduce what a reader sees in a browser, not the HTML source. Without entity decoding, JSON examples reach the extractor full of &quot; and response shape extraction breaks.

### Requirement 4: Chunk Documentation

**User Story:** As a node maintainer, I want large documentation split into manageable chunks, so that the extraction engine can process it within context limits.

#### Acceptance Criteria

1. WHEN normalized Vendor_Documentation exceeds 50,000 characters, THE Generator SHALL split it into chunks
2. WHEN splitting into chunks, THE Generator SHALL preserve complete sentences
3. WHEN splitting into chunks, THE Generator SHALL preserve complete code blocks
4. WHEN splitting into chunks, THE Generator SHALL add 500 characters of overlap between consecutive chunks
5. THE Generator SHALL store chunk boundaries for later reference in error messages
6. WHEN the Vendor_Documentation is under 50,000 characters, THE Generator SHALL treat it as a single chunk

---

### Stage 2: Extract

### Requirement 5: Invoke Kiro CLI for Extraction

**User Story:** As a node maintainer, I want the Generator to use Kiro's extraction capabilities, so that prose documentation is transformed into a structured contract.

#### Acceptance Criteria

1. WHEN extracting the IR, THE Generator SHALL invoke `kiro-cli chat --no-interactive` as a subprocess
2. WHEN invoking Kiro_CLI, THE Generator SHALL pass the IR schema instruction as the prompt command-line argument
3. WHEN invoking Kiro_CLI, THE Generator SHALL pipe the normalized documentation chunk to stdin
4. THE prompt argument SHALL specify the IR JSON schema and instruct Kiro_CLI to extract structured fields from the piped documentation
5. WHEN Kiro_CLI exits with code 0, THE Generator SHALL parse the stdout as the IR
6. IF Kiro_CLI exits with a non-zero code, THEN THE Generator SHALL terminate with an error message including the stderr output
7. IF Kiro_CLI is not found in PATH, THEN THE Generator SHALL terminate with an error message stating Kiro_CLI must be installed
8. IF Kiro_CLI does not respond within 5 minutes, THEN THE Generator SHALL terminate the subprocess and report a timeout error

### Requirement 6: Extract Base URL and Authentication

**User Story:** As a node maintainer, I want the base URL and auth scheme extracted from documentation, so that the generated node can connect to the vendor API.

#### Acceptance Criteria

1. THE IR SHALL include a base_url field containing the API root URL
2. THE IR SHALL include an auth_scheme field with value "api_key", "bearer_token", "basic", or "oauth2"
3. WHEN auth_scheme is "api_key", THE IR SHALL include an api_key_location field with value "header", "query", or "body"
4. WHEN auth_scheme is "api_key" and api_key_location is "header", THE IR SHALL include an api_key_header_name field
5. WHEN auth_scheme is "api_key" and api_key_location is "query", THE IR SHALL include an api_key_query_param_name field
6. WHEN auth_scheme is "bearer_token", THE IR SHALL include a token_header_name field defaulting to "Authorization"
7. WHEN multiple authentication schemes are documented, THE Generator SHALL select the most secure scheme in order: oauth2, bearer_token, api_key, basic

### Requirement 7: Extract Resources and Operations

**User Story:** As a node maintainer, I want resources and operations extracted from documentation, so that the generated node exposes the vendor's API structure.

#### Acceptance Criteria

1. THE IR SHALL include a resources array where each resource has a name, description, and operations array
2. WHEN a resource is mentioned in the Configuration_File, THE IR SHALL include that resource
3. IF a resource mentioned in the Configuration_File is not found in the Vendor_Documentation, THEN THE Generator SHALL terminate with an error listing the missing resource
4. WHEN an operation is listed in the Configuration_File, THE IR SHALL include that operation
5. THE IR operation SHALL include an http_method field with value "GET", "POST", "PUT", "PATCH", or "DELETE"
6. THE IR operation SHALL include a path field containing the URL path with parameter placeholders
7. THE IR operation SHALL include a description field containing a human-readable summary
8. IF an operation mentioned in the Configuration_File is not found in the Vendor_Documentation, THEN THE Generator SHALL terminate with an error listing the resource and missing operation

### Requirement 8: Extract Parameters

**User Story:** As a node maintainer, I want operation parameters extracted with their types and constraints, so that the generated node validates inputs correctly.

#### Acceptance Criteria

1. WHEN an operation accepts parameters, THE IR SHALL include a parameters array for that operation
2. THE IR parameter SHALL include a name field containing the parameter identifier
3. THE IR parameter SHALL include a location field with value "path", "query", "header", or "body"
4. THE IR parameter SHALL include a type field with value "string", "number", "integer", "boolean", "array", or "object"
5. THE IR parameter SHALL include a required field with value true or false
6. WHEN a parameter has validation constraints, THE IR SHALL include a constraints object
7. WHEN a parameter is an enum, THE IR constraints SHALL include an enum array listing valid values
8. WHEN a string parameter has a documented minimum length, THE IR constraints SHALL include a min_length field
9. WHEN a string parameter has a documented maximum length, THE IR constraints SHALL include a max_length field
10. Absent limits SHALL be omitted from the IR, never defaulted or inferred
11. WHEN a parameter is a number with bounds, THE IR constraints SHALL include minimum and maximum fields

**Note:** Most APIs document only a maximum length, not a minimum.

### Requirement 9: Extract Response Shapes

**User Story:** As a node maintainer, I want response structures extracted from documentation, so that the generated node can parse and validate responses.

#### Acceptance Criteria

1. WHEN an operation returns data, THE IR SHALL include a response_shape object for that operation
2. THE IR response_shape SHALL include a type field with value "object", "array", or "primitive"
3. WHEN the response is an object, THE IR response_shape SHALL include a properties object mapping field names to types
4. WHEN the response is an array, THE IR response_shape SHALL include an items_type field
5. WHEN a response field is required, THE IR response_shape SHALL mark it as required
6. WHEN the Vendor_Documentation includes example responses, THE IR SHALL preserve at least one example per operation
7. IF an operation's response structure is ambiguous or not documented, THEN THE Generator SHALL include a generic response_shape with type "object", an empty properties map, and an undocumented field set to true

**Note:** The undocumented flag signals the conformance test to skip response shape verification for that operation, since no contract was actually extracted.

### Requirement 10: Merge Multi-Chunk IRs

**User Story:** As a node maintainer, I want partial IRs from multiple documentation chunks merged into one complete IR, so that the generator produces a unified contract.

#### Acceptance Criteria

1. WHEN documentation is split into multiple chunks, THE Generator SHALL invoke Kiro_CLI once per chunk to produce partial IRs
2. WHEN merging partial IRs, THE Generator SHALL union resources with the same name by combining their operations arrays
3. IF an operation appears in two chunks with the same name but conflicting http_method values, THEN THE Generator SHALL terminate with an error naming both chunks and the conflict
4. IF an operation appears in two chunks with the same name but conflicting path values, THEN THE Generator SHALL terminate with an error naming both chunks and the conflict
5. WHEN base_url is extracted from more than one chunk with different values, THE Generator SHALL terminate with an error listing all conflicting values and their chunks
6. WHEN auth_scheme is extracted from more than one chunk with different values, THE Generator SHALL terminate with an error listing all conflicting values and their chunks
7. THE Generator SHALL validate the merged IR as a whole, not per-chunk partial IR

### Requirement 11: Extract Pagination Style

**User Story:** As a node maintainer, I want pagination mechanisms extracted from documentation, so that the generated node can fetch all available data.

#### Acceptance Criteria

1. WHEN an operation supports pagination, THE IR SHALL include a pagination object for that operation
2. THE IR pagination SHALL include a style field with value "cursor", "offset", "page", or "none"
3. WHEN pagination style is "cursor", THE IR pagination SHALL include a cursor_param field and a next_cursor_field field
4. WHEN pagination style is "offset", THE IR pagination SHALL include a limit_param field and an offset_param field
5. WHEN pagination style is "page", THE IR pagination SHALL include a page_param field and a page_size_param field
6. WHEN the Vendor_Documentation does not describe pagination, THE IR pagination style SHALL default to "none"
7. WHEN multiple pagination styles are documented, THE Generator SHALL select "cursor" over "offset" over "page"

---

### Stage 3: Validate

### Requirement 12: Validate IR Completeness

**User Story:** As a node maintainer, I want the IR validated before code generation, so that incomplete extraction is caught early.

#### Acceptance Criteria

1. WHEN the IR is missing the base_url field, THE Generator SHALL terminate with an error stating the base URL was not found
2. WHEN the IR is missing the auth_scheme field, THE Generator SHALL terminate with an error stating the authentication scheme was not found
3. WHEN the IR resources array is empty, THE Generator SHALL terminate with an error stating no resources were extracted
4. WHEN an IR resource has an empty operations array, THE Generator SHALL terminate with an error listing the resource name
5. WHEN validation fails, THE Generator SHALL report which documentation chunk the validation error corresponds to
6. THE Generator SHALL perform validation before any file emission begins

### Requirement 13: Validate Operation Integrity

**User Story:** As a node maintainer, I want operations validated for required fields, so that generated nodes do not contain incomplete operation definitions.

#### Acceptance Criteria

1. WHEN an IR operation is missing the http_method field, THE Generator SHALL terminate with an error listing the resource and operation
2. WHEN an IR operation is missing the path field, THE Generator SHALL terminate with an error listing the resource and operation
3. WHEN an IR operation path contains a path parameter, THE Generator SHALL verify a corresponding parameter exists in the parameters array with location "path"
4. IF a path parameter is referenced but not defined, THEN THE Generator SHALL terminate with an error listing the operation and missing parameter name
5. WHEN an IR operation http_method is "POST" or "PUT", THE Generator SHALL verify at least one parameter has location "body"
6. IF a POST or PUT operation has no body parameters, THEN THE Generator SHALL log a warning but continue generation

### Requirement 14: Validate Authentication Configuration

**User Story:** As a node maintainer, I want authentication configuration validated, so that generated credentials files are complete.

#### Acceptance Criteria

1. WHEN auth_scheme is "api_key" and api_key_location is "header", THE Generator SHALL verify api_key_header_name is present
2. IF api_key_header_name is missing, THEN THE Generator SHALL terminate with an error stating the header name is required
3. WHEN auth_scheme is "api_key" and api_key_location is "query", THE Generator SHALL verify api_key_query_param_name is present
4. IF api_key_query_param_name is missing, THEN THE Generator SHALL terminate with an error stating the query parameter name is required
5. WHEN auth_scheme is "bearer_token", THE Generator SHALL verify token_header_name is present or default it to "Authorization"
6. WHEN auth_scheme is "oauth2", THE Generator SHALL verify the IR includes oauth2_authorize_url and oauth2_token_url fields
7. IF required OAuth2 URLs are missing, THEN THE Generator SHALL terminate with an error listing the missing URLs

### Requirement 15: Validate Type Consistency

**User Story:** As a node maintainer, I want parameter and response types validated for consistency, so that type errors are caught before generation.

#### Acceptance Criteria

1. WHEN a parameter type is "array", THE Generator SHALL verify an items_type field is present
2. IF items_type is missing for an array parameter, THEN THE Generator SHALL terminate with an error listing the parameter
3. WHEN a parameter has constraints, THE Generator SHALL verify the constraints are compatible with the parameter type
4. IF a string parameter has numeric constraints, THEN THE Generator SHALL terminate with an error listing the parameter and incompatible constraint
5. WHEN a response_shape type is "array", THE Generator SHALL verify items_type is present
6. IF items_type is missing for an array response, THEN THE Generator SHALL terminate with an error listing the operation

---

### Stage 4: Emit

### Requirement 16: Emit Credentials File

**User Story:** As a node maintainer, I want a credentials file generated from the auth scheme, so that users can configure authentication in n8n.

#### Acceptance Criteria

1. THE Generator SHALL create a file at `packages/n8n-nodes-{vendor}/credentials/{VendorName}Api.credentials.ts`
2. THE credentials file SHALL implement the ICredentialType interface from n8n-workflow
3. WHEN auth_scheme is "api_key", THE credentials file SHALL include a field for the API key with type "string" and typeOptions password set to true
4. WHEN auth_scheme is "bearer_token", THE credentials file SHALL include a field for the token with type "string" and typeOptions password set to true
5. WHEN auth_scheme is "basic", THE credentials file SHALL include fields for username and password
6. WHEN auth_scheme is "oauth2", THE credentials file SHALL include OAuth2-specific configuration fields
7. THE credentials file SHALL include a displayName property matching the vendor name
8. THE credentials file SHALL include documentation links in the properties array

### Requirement 17: Emit Node Class

**User Story:** As a node maintainer, I want a node class generated with per-resource operations, so that users can interact with the vendor API in n8n.

#### Acceptance Criteria

1. THE Generator SHALL create a file at `packages/n8n-nodes-{vendor}/nodes/{VendorName}/{VendorName}.node.ts`
2. THE node class SHALL implement the INodeType interface from n8n-workflow
3. THE node class SHALL include a description property with name, displayName, icon, subtitle, and version fields
4. THE node class SHALL set usableAsTool to true in the description
5. THE node class SHALL include a credentials property referencing the generated credentials file
6. THE node class SHALL include a properties array with resource and operation dropdowns
7. WHEN an IR resource has multiple operations, THE node class SHALL generate a switch statement routing to operation-specific handlers
8. WHEN an operation has parameters, THE node class SHALL generate parameter input fields with appropriate types and validation
9. THE node class execute method SHALL construct HTTP requests from the IR operations and user inputs
10. THE node class execute method SHALL handle pagination when the IR pagination style is not "none"

### Requirement 18: Emit Error Mapping

**User Story:** As a node maintainer, I want HTTP errors mapped to n8n error types, so that workflow authors receive meaningful error messages.

#### Acceptance Criteria

1. THE Generator SHALL include error handling in the node execute method
2. WHEN an HTTP response status is 400, THE node SHALL throw an n8n error with type "NodeOperationError" and message indicating invalid input
3. WHEN an HTTP response status is 401, THE node SHALL throw an n8n error indicating authentication failed
4. WHEN an HTTP response status is 403, THE node SHALL throw an n8n error indicating access forbidden
5. WHEN an HTTP response status is 404, THE node SHALL throw an n8n error indicating the resource was not found
6. WHEN an HTTP response status is 429, THE node SHALL throw an n8n error indicating rate limit exceeded
7. WHEN an HTTP response status is 500 or above, THE node SHALL throw an n8n error indicating a server error occurred
8. THE error message SHALL include the HTTP status code, response body excerpt, and operation name

### Requirement 19: Emit IR Contract File

**User Story:** As a node maintainer, I want the IR written to a committed JSON file, so that the conformance test can validate against the original contract.

#### Acceptance Criteria

1. THE Generator SHALL create `packages/n8n-nodes-{vendor}/contract/ir.json` containing the complete IR
2. THE IR JSON file SHALL include a schema_version field set to "1.0.0"
3. THE IR JSON file SHALL include a source_documentation_url field when the Configuration_File provided a URL
4. THE IR JSON file SHALL include a source_documentation_path field when the Configuration_File provided a local file path
5. THE IR JSON file SHALL include a content_hash field containing the SHA-256 hash of the normalized documentation
6. THE IR JSON file SHALL be formatted with 2-space indentation for readability
7. Requirement 22 (Emit Conformance Test) SHALL read the IR from this committed file

### Requirement 20: Emit Polling Trigger with Watermarking

**User Story:** As a node maintainer, I want a polling trigger generated with watermark state, so that items are never re-emitted across polling cycles.

#### Acceptance Criteria

1. WHERE a resource supports listing operations, THE Generator SHALL create a trigger file at `packages/n8n-nodes-{vendor}/nodes/{VendorName}/{VendorName}Trigger.node.ts`
2. THE trigger class SHALL implement the INodeType interface with polling mode enabled
3. THE trigger class SHALL store a watermark value in workflow state after each successful poll
4. WHEN polling for new items, THE trigger SHALL use the stored watermark to fetch only items created or modified after the watermark
5. WHEN no watermark exists, THE trigger SHALL fetch items from the last 24 hours
6. THE trigger SHALL update the watermark to the most recent item timestamp after each poll
7. THE trigger SHALL deduplicate items by ID to prevent re-emission if the watermark is unreliable
8. IF the vendor API does not support timestamp filtering, THEN THE Generator SHALL omit trigger generation and log a warning

### Requirement 21: Emit Package Metadata

**User Story:** As a node maintainer, I want package.json, tsconfig.json, and README generated, so that the node package is complete and publishable.

#### Acceptance Criteria

1. THE Generator SHALL create `packages/n8n-nodes-{vendor}/package.json` with n8n-specific metadata
2. THE package.json SHALL include an empty dependencies object or omit it entirely
3. THE package.json SHALL include devDependencies for n8n-workflow, n8n-core, and TypeScript
4. THE package.json n8n field SHALL specify the nodes and credentials files
5. THE package.json n8n field SHALL set usableAsTool to true
6. THE Generator SHALL create `packages/n8n-nodes-{vendor}/tsconfig.json` with module set to "commonjs"
7. THE tsconfig.json SHALL set target to "ES2020" or higher
8. THE Generator SHALL create `packages/n8n-nodes-{vendor}/README.md` with installation instructions and a warning that the package is generated
9. THE README SHALL include a link to the vendor's API documentation
10. THE README SHALL include instructions for running the conformance test

### Requirement 22: Emit Conformance Test

**User Story:** As a node maintainer, I want a conformance test generated that validates the node against the live API, so that vendor drift is detected automatically.

#### Acceptance Criteria

1. THE Generator SHALL create `packages/n8n-nodes-{vendor}/test/conformance.test.ts`
2. THE conformance test SHALL NOT depend on Kiro or any LLM credentials
3. THE conformance test SHALL read the IR from a committed JSON file
4. WHEN a vendor API key is present in environment variables, THE conformance test SHALL execute requests against the live API
5. WHEN no vendor API key is present, THE conformance test SHALL skip live API calls and log a warning
6. THE conformance test SHALL verify each operation's HTTP method and path match the IR
7. THE conformance test SHALL verify response shapes match the IR schema
8. IF a response field in the IR is required but missing in the live response, THEN THE conformance test SHALL fail with a detailed error
9. IF the live API returns a field not in the IR, THEN THE conformance test SHALL log a warning but pass
10. THE conformance test SHALL complete within 60 seconds

### Requirement 23: Emit Fixture-Backed Offline Mode

**User Story:** As a node maintainer, I want fixtures generated for offline testing, so that the node can be tested without a vendor account.

#### Acceptance Criteria

1. THE Generator SHALL create `packages/n8n-nodes-{vendor}/test/fixtures/` directory
2. WHEN the conformance test runs with live API access, THE Generator SHALL record responses as fixture files
3. THE fixture files SHALL be JSON containing the HTTP status, headers, and body
4. THE Generator SHALL create a fixture loader utility that reads fixtures from disk
5. WHEN the test suite runs without vendor credentials, THE node test SHALL load responses from fixtures instead of making HTTP calls
6. THE fixture filenames SHALL include the resource, operation, and parameter hash for uniqueness
7. THE Generator SHALL include at least one fixture per operation in the IR
8. THE generated README SHALL document how to run tests in offline mode

### Requirement 24: Emit CI Workflow Template

**User Story:** As a node maintainer, I want a GitHub Actions workflow template emitted, so that conformance tests run automatically on a schedule.

#### Acceptance Criteria

1. THE Generator SHALL create `packages/n8n-nodes-{vendor}/.github/workflows/conformance.yml`
2. THE workflow file SHALL define a schedule trigger running daily at 00:00 UTC
3. THE workflow file SHALL define a workflow_dispatch trigger for manual runs
4. THE workflow file SHALL check out the repository, install dependencies, and run the conformance test
5. THE workflow file SHALL read the vendor API key from GitHub Secrets
6. WHEN the conformance test fails, THE workflow SHALL open a GitHub issue with the failure details
7. THE workflow file SHALL include a comment stating it is generated and should not be edited by hand
8. THE Generator SHALL log a warning that the workflow must be copied to the repository root to be executable

---

### Stage 5: Verify

### Requirement 25: Typecheck Emitted Package

**User Story:** As a node maintainer, I want the generated package typechecked immediately, so that type errors are caught during generation.

#### Acceptance Criteria

1. WHEN all files are emitted, THE Generator SHALL invoke `tsc --noEmit` in the generated package directory
2. WHEN typechecking succeeds, THE Generator SHALL log a success message
3. IF typechecking fails, THEN THE Generator SHALL terminate with an error displaying the TypeScript errors
4. THE Generator SHALL include the file path and line number for each type error
5. IF tsc is not available, THEN THE Generator SHALL terminate with an error stating TypeScript must be installed
6. THE Generator SHALL run typechecking before running tests

### Requirement 26: Verify Package Loads in n8n

**User Story:** As a node maintainer, I want the generated node verified to load in n8n, so that basic structural errors are caught before publication.

#### Acceptance Criteria

1. WHEN typechecking succeeds, THE Generator SHALL compile the TypeScript to JavaScript using `tsc`
2. WHEN compilation succeeds, THE Generator SHALL attempt to dynamically import the compiled node class
3. IF the import fails, THEN THE Generator SHALL terminate with an error including the import error message
4. WHEN the import succeeds, THE Generator SHALL verify the node class has a description property
5. WHEN the import succeeds, THE Generator SHALL verify the node class has an execute method
6. IF required properties are missing, THEN THE Generator SHALL terminate with an error listing the missing properties
7. THE Generator SHALL clean up any temporary build artifacts after verification

### Requirement 27: Run Unit Tests

**User Story:** As a node maintainer, I want generated unit tests run automatically, so that fixture-backed operation tests pass before generation completes.

#### Acceptance Criteria

1. WHEN package loading verification succeeds, THE Generator SHALL run `vitest run` in the generated package directory
2. WHEN all tests pass, THE Generator SHALL log a success message with the test count
3. IF any test fails, THEN THE Generator SHALL terminate with an error displaying the failing test output
4. THE Generator SHALL run tests with no vendor credentials to verify offline fixture mode works
5. THE Generator SHALL set a timeout of 30 seconds for the test suite
6. IF vitest is not available, THEN THE Generator SHALL terminate with an error stating vitest must be installed

### Requirement 28: Report Generation Summary

**User Story:** As a node maintainer, I want a summary report after generation, so that I know what was created and what to do next.

#### Acceptance Criteria

1. WHEN all verification passes, THE Generator SHALL output a summary report to stdout
2. THE summary report SHALL list the generated package path
3. THE summary report SHALL list the number of resources and operations generated
4. THE summary report SHALL list the authentication scheme used
5. THE summary report SHALL include the command to run the conformance test manually
6. THE summary report SHALL include the command to publish the package to npm
7. THE summary report SHALL state that the CI workflow template must be copied to the repository root
8. WHEN the vendor API has operations that were not included, THE summary report SHALL list the excluded operations

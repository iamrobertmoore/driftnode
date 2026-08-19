# n8n-nodes-vultr

⚠️ This package is generated. Do not edit by hand.

n8n community node for the Vultr API.

This node was generated from local file: `/Users/robertmoore/projects/Hackathons/ready-spec-ship/repo/examples/vultr-api-docs.html` on 2026-08-19.

## Installation

```bash
npm install n8n-nodes-vultr
```

## Documentation

API documentation: /Users/robertmoore/projects/Hackathons/ready-spec-ship/repo/examples/vultr-api-docs.html

This package includes 4 resources and 14 operations.

## Conformance Test

The generated node includes a conformance test that verifies the live API matches the contract the node was built from.

Run the conformance test:

```bash
npm test
```

The conformance test runs on a schedule in CI. When the vendor API changes, the build fails and an issue is opened.

## Offline Mode

Tests can run without vendor credentials using recorded fixtures. This allows contributors to validate the node without signing up for the vendor service.

To run tests against the live API, set the environment variable:

```bash
export VULTR_API_KEY=your-api-key-here
npm test
```

Without credentials, tests run in offline mode using fixtures.

## License

MIT

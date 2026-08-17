---
inclusion: always
---

# Repository structure

This is an npm workspace with two packages:

1. `packages/driftnode` — the generator
2. `packages/n8n-nodes-vultr` — generated output

## packages/driftnode

The generator. This is the tool that reads vendor API docs and emits a complete n8n community node package.

**Entry point:** `src/index.ts`

**What it does:**

- Shells out to `kiro-cli chat --no-interactive` to extract the vendor contract from prose documentation
- Transforms the extracted contract into an intermediate representation (IR)
- Emits the complete n8n node package structure:
  - Node class with per-resource operations
  - Credentials file
  - Polling trigger with watermark (so items are never re-emitted)
  - Error mapping
  - Pagination support
  - `usableAsTool: true` so n8n AI agents can call it
  - Conformance test that runs in CI
  - Fixtures for offline testing

**Build output:** CommonJS in `dist/`

This package is hand-maintained. Write code here when adding or changing generator behavior.

## packages/n8n-nodes-vultr

The generated n8n community node for Vultr's API. This package is **generated output**.

**Do not hand-edit files in this package.** Every file here is emitted by the generator. Hand edits will be overwritten on the next regeneration.

The package is committed to the repository so that:

- Judges can inspect exactly what the generator produces
- Diffs show what changes when the generator or source documentation changes
- The conformance CI workflow has something to test before the first publish

To change this package:

1. Modify the generator in `packages/driftnode`
2. Modify the input documentation or IR
3. Regenerate

The only exception is `README.md`, which includes a warning that the package is generated. That file is safe to edit for metadata or usage instructions.

## What the generated node must include

Every generated node package must contain:

- **Node class:** implements the n8n `INodeType` interface with per-resource operations
- **Credentials file:** implements `ICredentialType` for API authentication
- **Polling trigger:** implements `INodeType` with trigger mode, includes watermark state so items are not re-emitted
- **Error mapping:** HTTP error codes mapped to n8n error types
- **Pagination:** cursor or offset-based, depending on vendor API
- **Conformance test:** runs in CI, compares live API to contract, no Kiro required
- **Fixtures:** recorded API responses for offline testing
- **CI workflow template:** `.github/workflows/conformance.yml` emitted as a template for downstream users who publish the node in its own repository. GitHub only executes workflows at the repository root, so the copy inside `packages/n8n-nodes-vultr/` is inert in this monorepo. It must never conflict with or duplicate the authoritative workflow at the repo root (`/.github/workflows/conformance.yml`). The generator emits the template; users copy it to their repo root when they fork or publish the node standalone.
- **package.json:** with `n8n` metadata, zero runtime dependencies, and `usableAsTool: true`

## Why the generated package is committed

Generated output is normally gitignored. Here it is committed because:

1. The conformance test is part of the generator's value proposition — judges must see that it exists and works
2. Diffs between regenerations show exactly what changed and why
3. The published npm package must be traceable to a specific commit
4. The conformance CI workflow runs against the committed output

The trade-off: every regeneration produces a large diff. That is acceptable because regenerations are infrequent (only when the generator changes or the vendor docs are updated).

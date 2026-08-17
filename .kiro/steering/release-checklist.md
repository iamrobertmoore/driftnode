---
inclusion: manual
---

# Release checklist

Run through this checklist before publishing a release.

## Build health

- [ ] `npm run build` succeeds in all workspaces
- [ ] `npm test` passes in all workspaces
- [ ] `npm run typecheck` passes without errors
- [ ] `npm run lint` passes (if linting is configured)

## Conformance

- [ ] `npm run conformance` succeeds against the live vendor API
- [ ] Conformance test runs without Kiro credentials (uses only vendor API key)
- [ ] Fixture-backed offline mode works (tests pass with no vendor credentials)

## Security

- [ ] No secrets, API keys, tokens, or credentials committed
- [ ] `.env.example` exists with placeholder values, not real credentials
- [ ] `git grep` for common secret patterns returns clean

## Required deliverables

- [ ] `.kiro` directory exists at repo root
- [ ] `.kiro` is not in `.gitignore` or `.kiroignore`
- [ ] `.kiro/specs`, `.kiro/steering`, `.kiro/hooks` are present and populated

## Version and metadata

- [ ] Version bumped in `packages/n8n-nodes-vultr/package.json`
- [ ] `CHANGELOG.md` or release notes updated (if maintained)
- [ ] Package metadata correct: `name`, `description`, `keywords`, `author`, `license`

## Generated node requirements

- [ ] Generated node has zero runtime dependencies (`dependencies` field empty or absent)
- [ ] `usableAsTool: true` set in node metadata so n8n AI agents can call it
- [ ] Polling trigger includes watermark state (items never re-emitted)
- [ ] Error mapping present for HTTP status codes
- [ ] Pagination implemented (cursor or offset-based)

## Publish configuration

- [ ] `npm publish` will use `--provenance` flag for attestation
- [ ] `--access public` set (package is public, not scoped private)
- [ ] Trusted publishing configured on npmjs.com (if using OIDC, no `NPM_TOKEN` required)
- [ ] Target registry is `https://registry.npmjs.org`

## Post-publish

- [ ] Published package visible on npmjs.com
- [ ] Provenance attestation links back to workflow run
- [ ] Installation works: `npm install n8n-nodes-vultr` succeeds
- [ ] Tag the release in git: `git tag v<version> && git push --tags`

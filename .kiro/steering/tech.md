---
inclusion: always
---

# Technical stack and constraints

## Stack

- **Language:** TypeScript
- **Runtime:** Node.js 20.19+
- **Build tool:** `tsc` (TypeScript compiler)
- **Test framework:** vitest
- **Package manager:** npm with workspaces
- **Output format:** CommonJS (`module: "commonjs"` in tsconfig)

CommonJS is required because that is what n8n loads. ESM output will not work.

## The Kiro extraction engine

driftnode does **not** call an LLM API directly. It does not hold model credentials.

Instead, it shells out to `kiro-cli chat --no-interactive` to read vendor documentation and produce the intermediate representation (IR). The extraction engine is Kiro itself, running as a subprocess.

This means:

- The generator requires a Kiro installation and active session
- Kiro holds the model credentials, not driftnode
- Generation depends on Kiro; drift detection does not

## Zero runtime dependencies

The generated n8n node must have **zero runtime dependencies**. The `dependencies` field in its `package.json` must be empty or absent.

This is a hard constraint. n8n community nodes are loaded into the n8n runtime. Bringing in dependencies increases install size, creates version conflicts, and raises the audit surface.

If the generated node needs functionality, inline it or generate it. Do not depend on external packages at runtime.

`devDependencies` are fine. The constraint applies only to what ships.

## Conformance tests run without Kiro

The conformance test that re-checks the vendor API must run in CI with **no Kiro credentials** and **no model access**. It is pure HTTP calls plus schema comparison.

This separation is strict:

- **Generation path:** requires Kiro, may call models, runs on developer machines
- **Conformance path:** no Kiro, no models, runs in GitHub Actions on a schedule

The conformance test must be runnable by anyone with a vendor API key. It cannot depend on the generator or any part of the generation pipeline.

## Fixture-backed offline mode

The generated node must include a fixture-backed offline mode so that someone with no vendor account can run the full test suite.

Tests should run against recorded fixtures by default and only hit the live API when a credential is present in the environment. This lets judges, contributors, and CI validate the node without signing up for the vendor service.

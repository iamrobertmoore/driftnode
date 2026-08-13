# driftnode

Turn a vendor's prose API documentation into a publishable n8n community node, with a
conformance test that fails CI when the vendor changes their API.

> **Status: work in progress.** Sections marked TODO are filled in as the build lands.

---

## The problem

n8n has thousands of community nodes. A large share of them are quietly broken, because
the vendor changed an endpoint, renamed a field, or altered a response shape, and nothing
told anyone. The node keeps looking fine until a workflow fails at 3am.

Building a node is also more work than it looks. A correct one needs a credentials file,
per-resource operations, pagination, error mapping, a polling trigger that remembers where
it got to, and a package layout n8n will actually load.

## What this does

`driftnode` takes API documentation written for humans and produces a complete node
package. It also produces the thing that keeps the node honest: a conformance test that
re-checks the vendor's live API against the contract the node was generated from, on a
schedule, and fails the build when they diverge.

Generation is the convenience. **The conformance test is the point.**

## What is different about it

Generating n8n nodes from a machine-readable OpenAPI document is a solved problem, and I
am not claiming otherwise. Prior art, all of it good:

| Project | What it does |
|---|---|
| [`@devlikeapro/n8n-openapi-node`](https://github.com/devlikeapro/n8n-openapi-node) | Converts an OpenAPI document into n8n node properties at runtime. The de facto standard, ~366k downloads/month. |
| [`@n8n/node-cli`](https://www.npmjs.com/package/@n8n/node-cli) | n8n's official scaffolder. Creates the package structure and dev loop. Does not read API docs. |
| [`ivov/nodewriter`](https://github.com/ivov/nodewriter) | Experimental, by an n8n core maintainer. Explores future node direction; output is not a runnable node. |

Every one of those requires an OpenAPI or Swagger document as input. Two things here are
not covered by any of them:

1. **Prose documentation as the input.** Most vendors publish HTML docs pages, not a spec
   file. Reading those is what an agent is actually good at.
2. **Drift detection as a shipped artefact.** The generated package carries its own
   conformance test and CI workflow, so the node reports its own staleness.

## Generated output

TODO — link to the published `n8n-nodes-vultr` package, install instructions, and the live
n8n instance judges can try it on.

---

## Setup

TODO

## Usage

TODO

## Configuration

TODO

## Testing

TODO — including the zero-key fixture mode, so this can be run and evaluated without a
Vultr account.

### Test credentials

TODO

## API and service costs

TODO — what the generator costs to run, what a Vultr account costs, and what can be
exercised for free.

## Rate limits and usage restrictions

TODO

---

## How I used Kiro

TODO. Covers the specs in `.kiro/specs`, the steering files in `.kiro/steering`, the hooks
in `.kiro/hooks`, and — the part worth reading — where I overruled the agent and why.

The `.kiro` directory is committed in full and is not gitignored.

## Prior art and disclosure

I have published an n8n community node before, by hand. That node is not part of this
project and no code from it has been forked, copied, or vendored here. What carried over
is design knowledge: the n8n verification checklist, the trusted-publishing chain, the
conformance-test idea, and the polling-trigger watermark approach.

This project is the tool that makes doing it a second time reproducible. Everything in
this repository was written during the competition period.

## Third-party attribution

TODO

## Licence

MIT. See [LICENSE](./LICENSE).

# driftnode

Turn a vendor's prose API documentation into a publishable [n8n](https://n8n.io) community node, with a conformance test that fails CI when the vendor's API drifts away from the contract the node was built against.

Generation is the convenience. The conformance test is the point.

**[npm: n8n-nodes-vultr](https://www.npmjs.com/package/n8n-nodes-vultr)** · **[Demo video (3 min)](TODO)**

Built with [Kiro](https://kiro.dev) for the Ready, Spec, Ship hackathon. Solo entry.

---

## Evidence: the package on npm is this tool's output

The published package is not driftnode itself. It is what driftnode produced, unedited, from a documentation page written for people to read. You can install it into your own n8n and watch it work.

| What | Result |
|---|---|
| Input | Vultr's API documentation, saved from a browser. 10.2 MB of HTML, 596,631 characters of text after normalisation |
| Output | [`n8n-nodes-vultr@0.1.5`](https://www.npmjs.com/package/n8n-nodes-vultr), 4 resources, 14 operations, zero runtime dependencies |
| Verified | Installed via n8n's Community Nodes screen, executed **List Regions**, returned all 36 Vultr regions |
| Cost | About 3 Kiro credits and 31 minutes for a full extraction. Re-runs are instant from cache |

Not one line of that package was hand-written. It is committed in [`packages/n8n-nodes-vultr`](./packages/n8n-nodes-vultr) so you can read exactly what came out.

**A claim you can falsify in one command.** Generation is deterministic. The documentation snapshot is committed, source metadata is computed by the generator rather than supplied by the model, and extraction is cached by content hash. Regenerate and the output is byte-identical:

```bash
node packages/driftnode/dist/cli.js examples/vultr.json && git diff --exit-code packages/n8n-nodes-vultr
```

## The problem

n8n has thousands of community nodes. A large share of them are quietly broken, because a vendor renamed a field or changed a response shape and nothing reported it. The node still looks fine in the editor. The workflow fails at 3am.

Building one correctly is also more work than it looks. You need a credentials file, per-resource operations, path and query handling, error mapping, and a package layout n8n will actually load.

## What is different about this

Generating n8n nodes from a machine-readable OpenAPI document is a solved problem, and I am not claiming otherwise. The prior art is good:

| Project | What it does |
|---|---|
| [`@devlikeapro/n8n-openapi-node`](https://github.com/devlikeapro/n8n-openapi-node) | Converts an OpenAPI document into node properties at runtime. The de facto standard, around 366k downloads a month |
| [`@n8n/node-cli`](https://www.npmjs.com/package/@n8n/node-cli) | n8n's official scaffolder. Creates the package structure. Does not read API docs |
| [`ivov/nodewriter`](https://github.com/ivov/nodewriter) | Experimental, by an n8n maintainer. Explores future node structure; output is not a runnable node |

Every one of those needs an OpenAPI or Swagger file as input. Two things here are not covered by any of them:

**Prose documentation as the input.** Most vendors publish HTML docs pages, not a spec file. Reading prose is the part an agent is actually good at, and it is the part that has been missing.

**Drift detection as a shipped artefact.** The generated package carries its own conformance test and CI workflow, so the node reports its own staleness rather than waiting for a user to discover it.

### Which kind of drift

Worth being precise, because "drift" is doing a lot of work in this field at the moment.

Most drift tooling compares code against a specification you wrote. Both sides are yours, so a disagreement means someone on your team changed something, and you can go and ask them.

This compares a generated node against **a third party's live API**. Vultr can change their contract on a Tuesday without telling anyone, and no amount of discipline on your side prevents it. That is a harder problem and a more durable one, because it never stops being true: the thing you are checking against is outside your control and will keep moving after you stop paying attention.

It is also why the check has to be cheap enough to run unattended, forever. See below.

## Try it

The published package is the test build. It installs into any n8n, needs no account, and does not depend on a server of mine staying up for the duration of judging.

**Install the generated node** (n8n 1.94+):

Settings → Community Nodes → Install → `n8n-nodes-vultr`

If you do not have an n8n to hand, one command gives you one:

```bash
docker run -it --rm -p 5678:5678 -e N8N_COMMUNITY_PACKAGES_ALLOW_TOOL_USAGE=true docker.n8n.io/n8nio/n8n
```

Then open `http://localhost:5678` and install the node from the Community Nodes screen.

Create a credential and enter **any non-empty string** as the access token. Vultr's `/regions` and `/plans` endpoints are unauthenticated in practice, so those two work immediately with no account. The other twelve operations need a real Vultr API key.

Then: add the Vultr node, Resource **Regions**, Operation **List**, Execute. You should get 36 regions back.

**Run the generator yourself:**

```bash
git clone https://github.com/iamrobertmoore/driftnode
cd driftnode
npm install
npm run build
node packages/driftnode/dist/cli.js examples/vultr.json
```

This needs Kiro installed and signed in, because the extraction step shells out to `kiro-cli`. The documentation snapshot is committed, so it regenerates from a fixed input and produces byte-identical output.

## How it works

Five stages, each of which can stop the run.

| Stage | What happens |
|---|---|
| **Ingest** | Fetch or read the docs, strip scripts, styles and markup, decode entities, preserve code blocks, split into 15,000 character chunks |
| **Extract** | Invoke `kiro-cli chat --no-interactive` per chunk. Kiro writes a partial contract to a file. Partials are merged into one intermediate representation |
| **Validate** | Check completeness before anything is written. Missing auth or a method-less operation is an error, not a warning |
| **Emit** | Render credentials, node class, contract file, package metadata, conformance test, fixtures, unit tests and icon |
| **Verify** | Typecheck, compile, load the node, check its structure, run its tests. Only then move it into place |

Two design decisions worth naming.

**Kiro writes to a file, not to stdout.** The original design parsed Kiro's stdout as JSON, stripping conversational text first. That is a regular expression against a language model's prose, and it is not deterministic. The first real run printed this:

```
Done. Written {"resources": []} to /tmp/dn-smoke/test.json.
```

Prose containing both a JSON object and a file path. A fence-stripper would have had to tell that sentence apart from real output. The file handoff never sees it.

**Generation writes to a temporary directory and moves into place only after verification passes.** A failed run leaves nothing behind, so there is no half-written package that looks generated.

## The conformance test

This is the part that matters, and it is worth being precise about what it does and does not do today.

The generated package ships a test that reads the contract from `contract/ir.json`, calls the live API, and compares. It runs on a daily schedule in GitHub Actions and opens an issue when it fails. It needs no Kiro, no model access and no generator: pure HTTP plus comparison.

**It runs without any credentials of mine, which is the only reason it runs at all.** Vultr serves Regions and Plans unauthenticated, so the scheduled job checks those two against the live API every night for free. The two operations that do need a token, List Instances and List SSH Keys, are attempted and skipped on a 401 or 403, visibly, as skipped tests rather than silent passes.

This was wrong until late in the build. The first version skipped the entire suite unless `VULTR_ACCESS_TOKEN` was set, and I do not have a Vultr account, so for several days the nightly job passed every night without checking anything. A green tick that means nothing is worse than a red one, because you stop looking. The fix was to stop assuming every endpoint needs a credential and let the API say so.

**It only exercises operations that are free and safe.** A drift check that creates virtual machines would bill the user on every scheduled run and leave orphaned resources behind, and a tool nobody can afford to run does not get run. So conformance covers Regions and Plans, which are read-only, plus List Instances and List SSH Keys. It never calls a POST or DELETE. The generated test file documents every excluded operation and why.

**What it verifies:** that each endpoint still exists at the path and method the contract records, still returns 200, and, for the operations where a response shape was extracted, that the documented fields are still present.

**Coverage, precisely.** Of the 14 operations:

| | Count | Which |
|---|---|---|
| Response shape extracted | **7** | `list-regions`, `list-plans`, `list-instances`, `get-instance`, `get-ssh-key`, `create-instance`, `create-ssh-key` |
| No response body exists | **6** | Both deletes, the three instance actions, and `update-ssh-key`. Vultr documents all six as `204 No Content`, so recording no shape is correct rather than a miss |
| Shape genuinely missed | **1** | `list-ssh-keys`, which does have a response sample in the documentation |

So the test does field-level comparison on **7 of the 8 operations that return a body**. For the one it missed, and the six that return nothing, it verifies the endpoint still exists and responds as documented.

That distinction is deliberate rather than hidden. A conformance test that guessed at a shape it never extracted would fail against a correct API and teach its user to ignore it.

## How I used Kiro

The `.kiro` directory is committed in full and is not gitignored.

**Four specs, across two workflow types:**

| Spec | Type | Why |
|---|---|---|
| `docs-to-node-generation` | Feature, requirements-first | The generator itself. 28 requirements, 23 in v1 scope, 5 documented and explicitly deferred |
| `ingest-html-chunker-bugfix` | **Bugfix** | Two defects found by the first real run against a 10 MB page |
| `extraction-performance-optimizations` | Feature | 226 seconds per chunk made the tool unusable |
| `extraction-robustness` | Feature | A failed merge discarded 28 minutes of extraction, so results are now cached |

The bugfix spec is the one I would point at. Spec-driven development is easy to demonstrate on a greenfield feature. Using the same process on a defect found in integration, with tests written to fail against the unfixed code first, is the part that says whether the process is real.

**Six steering files, three inclusion modes:**

| File | Mode | Purpose |
|---|---|---|
| `product.md`, `tech.md`, `structure.md` | `always` | What this is, the stack, the two-package layout |
| `conventions.md` | `always` | First person singular, no em dashes, no secrets in files, `.kiro` never ignored, deterministic output |
| `generated-code-rules.md` | `fileMatch` | Scoped to `packages/n8n-nodes-vultr/**`: generated output, never hand-edit |
| `release-checklist.md` | `manual` | Invoked as `/release-checklist` before publishing |

`conventions.md` earned its place. Kiro writes "we" by default, which would have misrepresented a solo entry across every generated README.

### Where I overruled it

The full record is in the specs and commit history. Four that changed the outcome:

**Stdout parsing.** Kiro's design mitigated unreliable output with fence-stripping heuristics. Replaced with the file handoff above.

**The model computing a SHA-256.** The extraction prompt asked Kiro to produce `content_hash` and `extracted_at`. A language model cannot compute SHA-256 and will emit a plausible wrong digest, and a model-supplied timestamp makes the contract file differ on every run, which breaks the determinism the whole project claims. Both are now computed in Node.

**One type doing two jobs.** Kiro used a single contract type for both per-chunk output and the merged result, while also telling chunks with no endpoints to write "a minimal valid" one. Those contradict: base URL and auth are required and an introduction chunk has neither. Split into `PartialIR` and `IntermediateRepresentation`, with merge as the boundary where partial becomes complete.

**Scope.** The first requirements draft ran to 26 requirements and roughly 180 acceptance criteria. Rather than delete them, they are split into v1 and explicitly deferred, with a reason each. Documenting what is deliberately out is safer than an ambitious spec with half of it unbuilt.

## What the first real run broke

196 unit tests passed. Then I pointed it at a real vendor's documentation and it broke seven times, in seven ways no test had covered:

| Failure | Cause |
|---|---|
| 403 from Vultr | Node's `fetch` sends no User-Agent, and their edge rejects that. Reported as "authentication required", which sent me looking in the wrong place |
| File not found after validation passed | `loadConfig` resolved paths relative to the config file, `ingest` resolved them relative to the working directory |
| 610 chunks instead of 13 | The chunker advanced one character at a time when no acceptable boundary existed, and normalisation was not stripping HTML at all |
| Every extraction timed out | The prompt was written to stdin, but `--no-interactive` requires it as an argument, so `kiro-cli` sat waiting |
| Merge conflict on a resource I did not want | Include filters were applied after the merge, so conflicts in discarded resources still failed the run |
| Typecheck failed on every emitted file | Generated `tsconfig.json` set `rootDir: "./src"` while including `credentials/` and `nodes/`. **Two unit tests asserted those exact broken values** |
| n8n refused to load the package | The `n8n` block used objects where n8n requires arrays of path strings |

The pattern is the same in every case: each failure lived in a seam between two components that were individually well tested and mocked apart from each other. The tsconfig one is the sharpest, because the code and its tests came from the same misunderstanding, so the tests locked the defect in rather than catching it.

That is the honest answer to "you had 196 passing tests, why did the first real run break". Agent-generated tests verify that the code does what the agent intended. Only contact with a real vendor, and a real n8n, tells you whether what it intended was right.

## Configuration

`examples/vultr.json` is the configuration that produced the published package.

| Field | Purpose |
|---|---|
| `vendor` | Package name and class names |
| `documentation` | `{ "type": "url", "url": … }` or `{ "type": "file", "path": … }`. Relative paths resolve against the config file |
| `include` | Which resources and operations to expose. Everything else is discarded before merge |
| `auth` | Optional override when documentation is genuinely ambiguous |
| `packageMeta` | Version, author, repository, homepage, licence, icon path |
| `chunkSize`, `chunkOverlap`, `concurrency`, `effort`, `extractionTimeoutSeconds` | Extraction tuning |

Extraction across 42 chunks disagreed about Vultr's authentication: some chunks said bearer token, others said API key. Both readings are defensible, because Vultr's docs show `Authorization: Bearer ${VULTR_API_KEY}`. The credential is called an API key and transmitted as a bearer token. Rather than have the generator pick a side, `auth` is pinned in the config.

## Testing

```bash
npm install
npm run build
npm test          # 197 tests, no credentials or network required
```

For the generated package:

```bash
cd packages/n8n-nodes-vultr
npm test          # structural tests, offline
npm run conformance   # checks Regions and Plans live; skips the two that need a token
```

The generated package ships six structural tests that assert the emitted node matches the contract it claims to implement: that all four resources and all fourteen operations appear in the node's dropdowns, that `usableAsTool` is set, that credentials are required. No network, no credentials, no fixtures.

### Test credentials

**None needed.** Enter any non-empty string as the Vultr access token. `GET /v2/regions` and `GET /v2/plans` respond without authentication, so both work immediately. The node sends the header regardless, because that is what Vultr's documentation specifies, and building against observed behaviour rather than the documented contract is exactly the mistake this project exists to catch.

For the twelve operations that do need a real key: Vultr account → Account → API. Note that Vultr requires you to allowlist your IP address there before a key will work.

## Costs and rate limits

**Kiro credits.** Extraction costs about 0.07 credits and 110 seconds per 15,000 character chunk at `--effort low`. Vultr's documentation is 42 chunks, so a full extraction is roughly **3 credits and 31 minutes** with a concurrency of 4. Results are cached by content hash in `~/.cache/driftnode`, so re-running after a merge or emit change costs nothing. Use `--no-cache` to force re-extraction.

Only generation uses credits. The conformance test uses none, by design.

**Vultr API.** Free for the operations used here. Regions and Plans are unauthenticated. Creating instances costs money, which is why conformance never calls them.

**Rate limits.** Vultr's documented limit is 30 requests per second per account, well above anything here. Kiro's limits are per-plan; the concurrency default of 4 has not hit one.

## What is not done

Being specific, because "incomplete features presented as working" is a disqualification and because it is more useful than a feature list.

**One response shape is missed.** `list-ssh-keys` has a response sample in Vultr's documentation that extraction does not pick up, so the conformance test checks it responds but not what it returns. Improving the extraction prompt took this from 0 of 8 to 7 of 8. Two independent extraction runs missed the same operation, so it is systematic rather than sampling noise, and I have not worked out why: `list-regions` and `list-plans` have the same response structure and both succeed.

**Validation warns on three bodiless POSTs.** `start-instance`, `reboot-instance` and `halt-instance` take no request body, which is correct for those endpoints, but validation still emits a warning because it cannot tell a genuinely bodiless POST from a failed extraction. The warning is noise and the check should be smarter.

**The polling trigger is specified but not built.** It is documented in the spec as Requirement 20 and deliberately deferred. There is no trigger node in the published package and the README does not claim one.

**Pagination is specified but not built.** Requirement 11, same treatment.

**Only one vendor has been through it end to end.** Vultr. The design generalises and the safety constraint is written as a general rule, but a second vendor would surely find more of what the first one found.

## Prior work

I published an n8n community node before this hackathon, by hand: [`n8n-nodes-keeperhub`](https://www.npmjs.com/package/n8n-nodes-keeperhub). No code from it has been forked, copied or vendored here, and it is not part of this submission.

What carried over is design knowledge: the n8n verification checklist, the zero runtime dependency constraint, the trusted publishing chain, and the idea of a conformance test in the first place. Doing it by hand once is what made it obvious that the second one should be reproducible. Everything in this repository was written during the competition period.

## Attribution

- [n8n](https://n8n.io) and `n8n-workflow`, used as a development dependency only. No runtime dependencies ship in the generated package
- [Kiro](https://kiro.dev), invoked as a subprocess for extraction
- [Vultr](https://www.vultr.com/api/) API documentation, used as the input. The generated node is unofficial and not affiliated with or endorsed by Vultr
- The node icon is a generated monogram, not Vultr's logo. Bundling a vendor's trademark into an unofficial community node is not a decision a generator should make on your behalf, so `packageMeta.iconPath` lets you supply one you have the right to redistribute
- TypeScript, vitest

## Licence

MIT. See [LICENSE](./LICENSE).

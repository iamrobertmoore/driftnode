# Example configurations

## `vultr.json`

The configuration used to generate the published
[`n8n-nodes-vultr`](https://www.npmjs.com/package/n8n-nodes-vultr) package.

```bash
driftnode generate examples/vultr.json
```

### Why a local snapshot rather than a live URL

driftnode can fetch documentation over HTTP, and does so for vendors that allow it. This
example deliberately uses a committed snapshot, `vultr-api-docs.html`, for three reasons.

**Reproducibility.** Regenerating from a fixed input produces byte-identical output, so a
diff between regenerations shows only what actually changed in the generator. A live URL
makes every regeneration a moving target.

**Independence.** Anyone can clone this repository and regenerate the node with no network
access and no dependency on a third party's uptime or edge configuration.

**Vultr blocks automated readers.** `https://www.vultr.com/api/` returns 403 to requests
carrying driftnode's User-Agent. driftnode identifies itself honestly rather than
impersonating a browser, so a vendor that wants to refuse automated documentation readers
succeeds in doing so. Working around that would mean shipping a tool that lies about what
it is.

The snapshot is unmodified page source, saved from a browser.

**Relative paths in a config file resolve against the config file's own directory**, not
the working directory, so this config can be run from anywhere in the repository.

### Why `auth` is pinned in the config

Extraction across 42 chunks disagreed about Vultr's authentication: some chunks reported
`bearer_token`, others `api_key`. Both readings are defensible, because Vultr's
documentation says:

```
-H "Authorization: Bearer ${VULTR_API_KEY}"
```

The credential is *called* an API key. It is *transmitted* as a bearer token. The IR
describes how requests are constructed, so `bearer_token` with `header_name: Authorization`
is the correct representation, and pinning it here removes the ambiguity rather than
leaving the generator to pick a side.

This is what the `auth` override is for: documentation that is genuinely ambiguous rather
than wrong.

### Why these four resources

The resource selection is deliberate, and the reasoning generalises to any vendor.

**The conformance test runs against the live API on a daily schedule**, in the node
user's own CI. A drift check that creates virtual machines would bill real money on every
run and leave orphaned resources behind. A tool nobody can afford to run does not get run,
and a drift detector that does not run detects nothing.

So the four resources split by cost and reversibility:

| Resource | Operations in the node | Exercised by conformance | Why |
|---|---|---|---|
| `regions` | list | Yes, fully | Read-only, free, no account state |
| `plans` | list | Yes, fully | Read-only, free, no account state |
| `ssh-keys` | full CRUD | Yes, fully | Free to create and destroy, so the write path is genuinely tested |
| `instances` | list, get, create, delete, reboot | List and get only | Creation is billable, so conformance never touches it |

The node exposes more than the conformance test exercises. That is intentional: the node
is for humans building workflows, the conformance test is for CI, and only one of those
should be able to spend money unattended.

### Adapting this for another vendor

Change `vendor` and the documentation URL, then choose resources on the same principle:
include at least one read-only resource so conformance has something free to check, and
restrict any billable resource to its read operations.

# Example configurations

## `vultr.json`

The configuration used to generate the published
[`n8n-nodes-vultr`](https://www.npmjs.com/package/n8n-nodes-vultr) package.

```bash
driftnode generate examples/vultr.json
```

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

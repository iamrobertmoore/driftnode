---
inclusion: fileMatch
fileMatchPattern: "packages/n8n-nodes-vultr/**"
---

# Generated code: do not hand-edit

Everything under `packages/n8n-nodes-vultr/` is generated output.

**Do not hand-edit files in this directory.** Every file here is emitted by the generator. Hand edits will be overwritten on the next regeneration.

## To change generated code

Changes must go through the generator or the spec, then regenerate:

1. Modify the generator in `packages/driftnode/src/`
2. Or modify the spec in `.kiro/specs/`
3. Or update the input documentation
4. Run the generator to emit updated output

## Why this rule exists

The generated package is committed to demonstrate what the generator produces. Diffs between regenerations show exactly what changed when the generator or input docs change.

Hand edits break this contract. They create drift between what the generator claims to produce and what is actually in the repository.

## Exception

`packages/n8n-nodes-vultr/README.md` may be edited for metadata or usage instructions, but no other files.

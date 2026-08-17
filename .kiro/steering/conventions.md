---
inclusion: always
---

# Project conventions

## Voice

This is a solo project. All prose uses first person singular "I", never "we".

This applies to:

- Code comments
- READMEs and documentation
- Commit messages
- Generated documentation
- User-facing copy

## Punctuation

User-facing copy must not use em dashes. Use commas, colons, or full stops instead.

## Secrets and credentials

Never write secrets, API keys, tokens, or credentials into any file.

For environment variables and configuration examples, use `.env.example` with placeholder values like `your-api-key-here` or `xxxxxxxxxxxxxxxx`.

## Required deliverables

The `.kiro` directory must never be added to `.gitignore` or `.kiroignore`. It is a required deliverable for the competition and must remain visible in the repository.

## Deterministic generation

Generated code must be deterministic. The same input documentation and the same generator configuration must produce byte-identical output.

This ensures that diffs between regenerations are meaningful and show only what actually changed in the input or generator logic, not random variation or timestamps.

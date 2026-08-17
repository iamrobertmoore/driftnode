---
inclusion: always
---

# Product context: why driftnode exists

## The drift problem

n8n has thousands of community nodes. A significant portion are quietly broken. A vendor changes an endpoint, renames a field, or alters a response shape, and nothing reports it. The node continues to appear functional in the n8n interface, but workflows fail in production — often at inconvenient hours.

Users discover breakage only when their automation stops working. There is no early warning, no CI failure, no notification. The node simply stops doing what it claimed to do.

## Who this is for

This tool is for:

- **n8n node maintainers** who want their nodes to stay correct after publication
- **Workflow authors** who need confidence that a node will work tomorrow if it works today
- **Platform operators** who run n8n at scale and need to know when a vendor API changes before workflows start failing

The primary output is not just a working node. It is a node that **reports its own staleness**.

## What makes it different

Generating nodes from OpenAPI specs is solved. Several good tools already do it.

driftnode does two things those tools do not:

1. **Takes prose documentation as input.** Most vendors publish HTML docs pages, markdown guides, or PDFs — not OpenAPI files. Reading prose is what an LLM agent is good at. driftnode shells out to Kiro to extract the vendor contract from human-readable docs.

2. **Ships a conformance test with the node.** The generated package includes a test that re-checks the vendor's live API against the contract the node was built from. This test runs on a schedule in CI. When the vendor changes something, the build fails and an issue is opened. The drift is caught before users encounter it.

## Generation vs conformance

Generation is the convenience. **The conformance test is the point.**

A node that breaks silently is worse than no node at all, because it creates the illusion of reliability. driftnode ensures that when a vendor drifts, the maintainer knows immediately.

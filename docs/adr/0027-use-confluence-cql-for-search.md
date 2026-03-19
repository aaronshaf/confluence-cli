# ADR-0027: Use Confluence CQL for Search

## Status

Accepted

## Context

The README previously documented a `cn search` command that required Meilisearch running locally via Docker. This search was never implemented. Meilisearch is not referenced anywhere in the codebase.

`cn` has evolved from a sync-focused tool into a general Confluence CLI. The search command should expose CQL directly rather than wrapping it in a limited abstraction.

## Decision

Use the Confluence REST API search endpoint (`GET /wiki/rest/api/search`) with CQL (Confluence Query Language) for the `cn search` command. The query argument is passed directly as a CQL expression — no construction or wrapping by the CLI. No local index or external infrastructure is required.

The `--space` flag is removed; users include space constraints directly in their CQL (e.g. `AND space=ENG`).

## Consequences

- Search always reflects the current state of Confluence (no stale index)
- No infrastructure required (no Docker, no Meilisearch)
- Search requires network access
- Search speed depends on Confluence API response times
- Users have full CQL expressiveness: space, label, type, date, author filters and more
- Users need to know basic CQL syntax; the Confluence CQL docs are the reference

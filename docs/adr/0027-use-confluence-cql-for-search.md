# ADR-0027: Use Confluence CQL for Search

## Status

Accepted

## Context

The README previously documented a `cn search` command that required Meilisearch running locally via Docker. This search was never implemented. Meilisearch is not referenced anywhere in the codebase.

## Decision

Use the Confluence REST API search endpoint (`GET /wiki/rest/api/search`) with CQL (Confluence Query Language) for the `cn search` command. No local index or external infrastructure is required.

The `--space` flag narrows the CQL query to a specific space key.

## Consequences

- Search always reflects the current state of Confluence (no stale index)
- No infrastructure required (no Docker, no Meilisearch)
- Search requires network access
- Search speed depends on Confluence API response times
- CQL is a well-documented, powerful query language that supports filtering by space, label, type, and more

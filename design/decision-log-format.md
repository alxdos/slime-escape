# Decision Log Format

- Status: accepted
- Created: 2026-04-19
- Updated: 2026-04-19

## Context

Architecture discussions should be recorded in the repository as working engineering decisions, not left as long chat notes. The main rules for the `design` layer are defined in [README.md](README.md); this document is a short companion summary of the format.

## Decision

- Store all engineering decisions in `design/`.
- One file describes one decision.
- File names must be stable and semantic: `session-definition.md`, `thread-model.md`.
- Do not include dates in file names.
- Every decision file must use the same minimal structure: `Status`, `Created`, `Updated`, `Context`, `Decision`, `Consequences`, `Related`.
- Keep the main decision index and layer rules in `design/README.md`.
- When an active decision changes, update the existing file and its `Updated` field.
- If a decision is no longer valid, set `Status` to `superseded` and link to the replacement in `Related`.

## Consequences

- Decisions are easier to read and find by topic rather than by creation date.
- The repository keeps the current engineering position, not only a historical log.
- `design/README.md` becomes the required entry point for project architecture.

## Related

- [README.md](../README.md)
- [_template.md](_template.md)

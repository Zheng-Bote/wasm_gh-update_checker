<!-- DOCTOC SKIP -->

# CHANGELOG

All notable changes to this project will be documented in this file.

## [v0.1.0] - 2026-03-17

### Added

- Initial public release of GitHub Update Checker WASM Worker.
- Browser UI with CSV upload and incremental table rendering.
- Dedicated Web Worker that performs GitHub API requests using `fetch()`.
- WebAssembly SemVer comparator compiled from C++ exposing `compare_versions`.
- Concurrency control with a default cap of **60** simultaneous requests.
- Human friendly error formatting for HTTP and API responses.
- Color coded table rows for update status: up to date, minor update, major update, error.
- Example CSV format and usage instructions.
- Build instructions for Emscripten to produce `ghupdate.js` and `ghupdate.wasm`.

### Known Limitations

- Unauthenticated GitHub API rate limits may block large batches; a server proxy with authentication is recommended for heavy use.
- SemVer comparator returns a simple -1/0/1 result; detailed patch/minor/major diff reporting is implemented heuristically in the worker.
- No built-in retry/backoff for transient network errors in this initial release.

### Notes

- This release focuses on a compact, easy to deploy client solution that keeps secrets off the client. For production scale, add a server component to manage authentication and rate limiting.

<!-- DOCTOC SKIP -->

# CHANGELOG

All notable changes to this project will be documented in this file.

## [v0.2.0] - 2026-03-18

### Added

- Accept both **CSV** and **JSON** input formats; JSON must be an array of objects with `url` and `version` (optional `name`).
- Example `example.json` included alongside `example.csv`.
- **Patch** update classification added (now: `major`, `minor`, `patch`, `ok`, `error`).
- Improved UI: per-row immediate updates, tooltips for detailed error text, and distinct color for `patch` updates.
- Worker now formats HTTP/API error bodies into concise, user-friendly messages (extracts `message`, `documentation_url`, `status`).
- File type auto-detection in the main thread (detects `.csv`, `.json`, or content-based detection).
- Normalization layer in main thread to convert CSV/JSON entries into a single job shape `{ id, name, url, localVersion }`.

### Changed

- Default concurrency cap remains **60**, but worker queue and progress reporting were improved for clearer feedback.
- SemVer comparison: WASM comparator remains the authoritative comparator; worker uses a robust JS fallback if WASM is not available.
- Worker now determines update level (major/minor/patch) by comparing parsed SemVer components rather than a coarse heuristic.
- README updated to document JSON support, patch classification, and improved UX details.

### Fixed

- Better handling of malformed GitHub URLs and clearer error messages for invalid inputs.
- Avoid false-positive updates when comparator parsing fails by using safe fallbacks.
- Ensure `running` counter cannot become negative on job completion.

### Known Limitations

- GitHub unauthenticated API rate limits still apply; large batches may require an authenticated server proxy.
- No automatic retry/backoff for transient network errors in this release.
- The WASM comparator returns a simple integer (-1/0/1); detailed structured diffs (e.g., semantic change metadata) can be added in a future release.

### Notes

- This release focuses on improving accuracy of update classification and input flexibility while keeping secrets off the client. For production scale, add a server component to manage authentication, retries, and rate limiting.

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

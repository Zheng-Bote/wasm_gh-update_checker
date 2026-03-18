<div id="top" align="center">
  <h1>GitHub Update Checker (Web WASM)</h1>

  <p>browser‑based tool that checks GitHub repositories for the latest release and compares it with local versions supplied by the user.</p>
  
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![C++23](https://img.shields.io/badge/C%2B%2B-23-blue.svg)]()

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/Zheng-Bote/wasm_gh-update_checker?logo=GitHub)](https://github.com/Zheng-Bote/wasm_gh-update_checker/releases)

[Report Issue](https://github.com/Zheng-Bote/wasm_gh-update_checker/issues) · [Request Feature](https://github.com/Zheng-Bote/wasm_gh-update_checker/pulls)

</div>

---

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

**Table of Contents**

- [Description](#description)
- [Features](#features)
- [Screenshots](#screenshots)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Files](#files)
  - [Build WASM with Emscripten](#build-wasm-with-emscripten)
- [Usage](#usage)
  - [Accepted input formats](#accepted-input-formats)
  - [Workflow](#workflow)
- [Concurrency and throughput](#concurrency-and-throughput)
- [Error Handling, Security and Rate Limits](#error-handling-security-and-rate-limits)
- [📝 License](#-license)
- [Author](#author)
  - [Code Contributors](#code-contributors)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

---

## Description

GitHub Update Checker Web WASM is a browser tool that checks GitHub repositories for their latest release and compares those releases with local versions supplied by the user. The app runs network requests in a Dedicated Web Worker and performs robust semantic version comparisons in a compact WebAssembly module compiled from C++.

---

## Features

- **Input formats**: accepts CSV or JSON files.
- **Worker based network**: all GitHub requests run inside a Dedicated Web Worker using fetch().
- **WASM SemVer comparator**: C++ semantic version parsing and comparison compiled to WebAssembly and exposed as compare_versions.
- **Concurrency control**: configurable concurrency cap (default 60 simultaneous fetches).
- **Incremental UI updates**: each table row updates immediately when its result arrives.
- **Three‑level update classification**: major, minor, patch updates plus ok and error states.
- **Human friendly errors**: HTTP and API error bodies are parsed and formatted for readability.
- **CSV and JSON normalization**: main thread normalizes both formats into a single job shape for the worker.

## Screenshots

![Screenshot](docs/screenshot.png)

---

## Quick Start

### Prerequisites

- A static web server to serve files over HTTP(S) (WASM must be served, not opened from file://).
- Emscripten SDK to build the WASM module if you want to recompile the C++ comparator.

### Files

- **index.html** — UI and table rendering.
- **main.js** — file parsing, UI glue, worker orchestration.
- **worker.js** — Dedicated Web Worker that performs fetch() and calls WASM comparator.
- **check_gh_update.cpp** — C++ SemVer comparator source (optional).
- **ghupdate.js** and **ghupdate.wasm** — Emscripten output exposing compare_versions.
- **example.csv** and **example.json** — sample inputs.

### Build WASM with Emscripten

Example command to compile the C++ comparator into ghupdate.js and ghupdate.wasm:

```bash
emcc check_gh_update.cpp \
  -std=c++23 -O3 \
  -sEXPORTED_FUNCTIONS='["_compare_versions"]' \
  -sEXPORTED_RUNTIME_METHODS='["cwrap"]' \
  -sALLOW_MEMORY_GROWTH=1 \
  -sFETCH=1 \
  -o ghupdate.js
```

Place ghupdate.js and ghupdate.wasm next to worker.js on your web server.

## Usage

### Accepted input formats

- **CSV**: each line must be Name,URL,Version or URL,Version. Example:

```csv
nlohmann/json,https://github.com/nlohmann/json,v2.11.2
https://github.com/fmtlib/fmt,v10.0.0
```

- **JSON**: an array of objects. Each object must include url and version. name is optional. Example:

```json
[
  {
    "name": "nlohmann/json",
    "url": "https://github.com/nlohmann/json",
    "version": "v2.11.2"
  },
  { "url": "https://github.com/gabime/spdlog", "version": "v1.13.0" }
]
```

### Workflow

1. Open index.html from your web server.
2. Upload a CSV or JSON file.
3. Click Start Checks. The main thread normalizes entries and enqueues jobs to the worker.
4. The worker converts repository URLs to GitHub API endpoints, performs fetch() calls, parses responses, calls the WASM comparator, and posts results back immediately.
5. The UI updates each row as results arrive. Rows are color coded:
   - green = up to date
   - blue = patch update
   - yellow = minor update
   - red = major update
   - light red = error

## Concurrency and throughput

- The worker enforces a concurrency cap (MAX_CONC) to limit simultaneous fetch() calls. Default is 60.
- The concurrency cap controls parallel requests but does not change GitHub API rate limits. For bulk checks or frequent runs, use an authenticated server proxy.

## Error Handling, Security and Rate Limits

- **Formatted errors**: when GitHub returns an error body (JSON or text), the worker extracts message, documentation_url, and status and builds a concise, readable message for the UI.

Example:

```code
HTTP 404 Not Found — Not Found | Details: https://docs.github.com/...
```

- **Rate limits**: unauthenticated GitHub API access is limited. If you see 403 with rate limit messages, the UI will include a hint recommending an authenticated proxy. Do not embed personal access tokens in client code.
- **CORS**: GitHub API supports CORS; ensure your page is served from a proper origin and that network policies allow requests.
- **Privacy**: no secrets are stored in the client. For production, run a small server proxy that holds tokens and enforces rate limiting.

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

Copyright (c) 2026 ZHENG Robert.

## Author

[![Zheng Robert - Core Development](https://img.shields.io/badge/Github-Zheng_Robert-black?logo=github)](https://www.github.com/Zheng-Bote)

### Code Contributors

![Contributors](https://img.shields.io/github/contributors/Zheng-Bote/wasm_gh-update_checker?color=dark-green)

---

<p align="right">(<a href="#top">back to top</a>)</p>
**Happy coding! 🚀** :vulcan_salute:

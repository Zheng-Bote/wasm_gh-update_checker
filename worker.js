// worker.js
// Dedicated Web Worker: uses fetch() for GitHub API calls and calls into the WASM compare function.
// Concurrency limited to MAX_CONC (60). Results are posted immediately to the main thread.

const MAX_CONC = 60;
let running = 0;
const queue = [];
let totalJobs = 0;
let completed = 0;

// Load WASM glue (ghupdate.js) produced by Emscripten.
// Ensure ghupdate.js and ghupdate.wasm are served from same origin.
importScripts("ghupdate.js");

let compare_versions = null;

// Wait for Emscripten runtime to initialize and expose compare_versions
Module.onRuntimeInitialized = () => {
  // cwrap: name, returnType, argTypes
  compare_versions = Module.cwrap("compare_versions", "number", [
    "string",
    "string",
  ]);
  postMessage({ type: "ready" });
};

// Convert common GitHub repo URLs to the releases/latest API endpoint
function to_github_api_url(url) {
  if (url.includes("api.github.com")) return url;
  try {
    const m = url.match(/https?:\/\/github\.com\/([^\/]+)\/([^\/]+)/i);
    if (!m) throw new Error("Invalid GitHub URL");
    let owner = m[1],
      repo = m[2];
    if (repo.endsWith(".git")) repo = repo.slice(0, -4);
    return `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
  } catch (e) {
    throw new Error("Invalid GitHub URL");
  }
}

// Helper: parse semver string "v1.2.3" or "1.2.3" into {major,minor,patch}
function parseSemVer(s) {
  if (!s || typeof s !== "string") return { major: 0, minor: 0, patch: 0 };
  const clean = s.replace(/^v/i, "").trim();
  const parts = clean.split(".");
  return {
    major: parseInt(parts[0] || "0", 10) || 0,
    minor: parseInt(parts[1] || "0", 10) || 0,
    patch: parseInt(parts[2] || "0", 10) || 0,
  };
}

// Format HTTP/API error responses into a concise, user-friendly message
async function formatHttpError(resp) {
  let bodyText = "";
  try {
    bodyText = await resp.text();
  } catch (e) {
    bodyText = "";
  }

  let pretty = `HTTP ${resp.status} ${resp.statusText || ""}`.trim();

  if (bodyText) {
    try {
      const j = JSON.parse(bodyText);
      const msg = j.message || j.error || null;
      const doc = j.documentation_url || j.documentation || null;
      const code = j.status || j.code || null;

      const parts = [];
      if (msg) parts.push(`${msg}`);
      if (code && String(code) !== String(resp.status))
        parts.push(`Code: ${code}`);
      if (doc) parts.push(`Details: ${doc}`);

      if (parts.length) pretty += " — " + parts.join(" | ");
      else pretty += " — " + String(bodyText).slice(0, 300);
    } catch (e) {
      // Not JSON
      pretty += " — " + String(bodyText).slice(0, 300);
    }
  }

  // Special hint for rate limiting
  if (resp.status === 403 && /rate limit/i.test(pretty)) {
    pretty +=
      " — Rate limit reached. Consider using an authenticated proxy (do not embed tokens in the client).";
  }

  return pretty;
}

// Core job execution
async function doJob(job) {
  try {
    const apiUrl = to_github_api_url(job.url);

    // Perform fetch
    const resp = await fetch(apiUrl, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });

    if (!resp.ok) {
      const pretty = await formatHttpError(resp);
      throw new Error(pretty);
    }

    // Parse JSON
    let json;
    try {
      json = await resp.json();
    } catch (e) {
      throw new Error("Failed to parse JSON response from GitHub API");
    }

    if (!json.tag_name || typeof json.tag_name !== "string") {
      throw new Error("GitHub API returned no tag_name in release response");
    }

    const latestTag = json.tag_name;
    // Use WASM comparator if available; fallback to JS parse if not
    let cmp = 0;
    try {
      if (typeof compare_versions === "function") {
        cmp = compare_versions(job.localVersion || "", latestTag || "");
      } else {
        // Fallback: simple JS compare by components
        const l = parseSemVer(job.localVersion);
        const r = parseSemVer(latestTag);
        if (l.major < r.major) cmp = -1;
        else if (l.major > r.major) cmp = 1;
        else if (l.minor < r.minor) cmp = -1;
        else if (l.minor > r.minor) cmp = 1;
        else if (l.patch < r.patch) cmp = -1;
        else if (l.patch > r.patch) cmp = 1;
        else cmp = 0;
      }
    } catch (e) {
      // If comparator fails, treat as equal to avoid false positives
      cmp = 0;
    }

    // Determine update level: major / minor / patch / ok
    let status = "ok";
    let note = "";

    if (cmp < 0) {
      // local < remote -> update available
      const l = parseSemVer(job.localVersion);
      const r = parseSemVer(latestTag);

      if (r.major > l.major) {
        status = "major";
        note = `Major update available (${job.localVersion} → ${latestTag})`;
      } else if (r.minor > l.minor) {
        status = "minor";
        note = `Minor update available (${job.localVersion} → ${latestTag})`;
      } else if (r.patch > l.patch) {
        status = "patch";
        note = `Patch update available (${job.localVersion} → ${latestTag})`;
      } else {
        // Unexpected: comparator said remote > local but components equal; fallback
        status = "minor";
        note = `Update available (${job.localVersion} → ${latestTag})`;
      }
    } else if (cmp === 0) {
      status = "ok";
      note = "Up-to-date";
    } else {
      status = "ok";
      note = "Local version is newer than remote";
    }

    postMessage({
      type: "result",
      id: job.id,
      latestTag,
      status,
      message: note,
      progress: progressText(),
    });
  } catch (err) {
    const userMsg = String(
      err && err.message ? err.message : err || "Unknown error",
    );
    postMessage({
      type: "result",
      id: job.id,
      latestTag: null,
      status: "error",
      message: userMsg,
      progress: progressText(),
    });
  } finally {
    completed++;
    running = Math.max(0, running - 1);
    processQueue();
  }
}

function progressText() {
  return `Completed ${completed} / ${totalJobs} (running ${running})`;
}

function processQueue() {
  while (running < MAX_CONC && queue.length > 0) {
    const job = queue.shift();
    running++;
    // Fire-and-forget; doJob will decrement running when finished
    doJob(job);
  }
}

onmessage = (ev) => {
  const msg = ev.data;
  if (msg && msg.type === "enqueue") {
    queue.push({
      id: msg.id,
      name: msg.name,
      url: msg.url,
      localVersion: msg.localVersion,
    });
    totalJobs++;
    processQueue();
  }
};

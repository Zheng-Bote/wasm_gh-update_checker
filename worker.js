// worker.js
// This worker uses fetch() for GitHub API calls and calls into the WASM compare function.
// It limits concurrent fetches to MAX_CONC (60) and posts results immediately.

const MAX_CONC = 60;
let running = 0;
const queue = [];
let totalJobs = 0;
let completed = 0;

// Load WASM glue (ghupdate.js) produced by Emscripten.
// Ensure ghupdate.js and ghupdate.wasm are served from same origin.
importScripts("ghupdate.js");

let compare_versions = null;

Module.onRuntimeInitialized = () => {
  // cwrap: name, returnType, argTypes
  compare_versions = Module.cwrap("compare_versions", "number", [
    "string",
    "string",
  ]);
  postMessage({ type: "ready" });
};

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

// worker.js - verbesserte Fehlerformatierung (Ausschnitt)
async function doJob(job) {
  try {
    const apiUrl = to_github_api_url(job.url);
    const resp = await fetch(apiUrl, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });

    if (!resp.ok) {
      // Versuche, JSON-Fehlerkörper zu lesen und hübsch aufzubereiten
      let bodyText = await resp.text();
      let pretty = `HTTP ${resp.status} ${resp.statusText}`;

      try {
        const j = JSON.parse(bodyText);
        const msg = j.message || j.error || null;
        const doc = j.documentation_url || j.documentation || null;
        const code = j.status || j.code || null;

        // Baue eine kompakte, lesbare Meldung
        const parts = [];
        if (msg) parts.push(`${msg}`);
        if (code && String(code) !== String(resp.status))
          parts.push(`Code: ${code}`);
        if (doc) parts.push(`Details: ${doc}`);

        if (parts.length) pretty += " — " + parts.join(" | ");
        else pretty += " — " + bodyText.slice(0, 200);
      } catch (e) {
        // Kein JSON, benutze Rohtext (gekürzt)
        pretty += " — " + bodyText.slice(0, 200);
      }

      throw new Error(pretty);
    }

    const json = await resp.json();
    if (!json.tag_name || typeof json.tag_name !== "string") {
      throw new Error("GitHub API returned no tag_name in release response");
    }

    const latestTag = json.tag_name;
    const cmp = compare_versions(job.localVersion, latestTag);
    let status = "ok",
      note = "";

    if (cmp < 0) {
      const localMajor = parseInt(
        job.localVersion.replace(/^v/, "").split(".")[0] || "0",
        10,
      );
      const remoteMajor = parseInt(
        latestTag.replace(/^v/, "").split(".")[0] || "0",
        10,
      );
      status = remoteMajor > localMajor ? "major" : "minor";
      note = "Update available";
    } else if (cmp === 0) {
      status = "ok";
      note = "Up-to-date";
    } else {
      status = "ok";
      note = "Local newer than remote";
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
    // err.message ist bereits die hübsche Meldung aus oben
    const userMsg = String(err.message || "Unknown error");
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
    running--;
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
    doJob(job);
  }
}

onmessage = (ev) => {
  const msg = ev.data;
  if (msg.type === "enqueue") {
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

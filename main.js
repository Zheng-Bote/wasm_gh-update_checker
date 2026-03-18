// main.js - supports CSV or JSON upload
const fileInput = document.getElementById("file");
const startBtn = document.getElementById("start");
const tbody = document.querySelector("#results tbody");
const progress = document.getElementById("progress");

let worker = null;
let rows = new Map();

function parseCSV(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const items = [];
  let id = 1;
  for (const line of lines) {
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length >= 3) {
      items.push({
        id: id++,
        name: parts[0],
        url: parts[1],
        version: parts[2],
      });
    } else if (parts.length === 2) {
      items.push({
        id: id++,
        name: parts[0],
        url: parts[0],
        version: parts[1],
      });
    }
  }
  return items;
}

function parseJSON(text) {
  try {
    const arr = JSON.parse(text);
    if (!Array.isArray(arr))
      throw new Error("JSON must be an array of objects");
    const items = [];
    let id = 1;
    for (const obj of arr) {
      if (!obj) continue;
      const url = obj.url || obj.repo || obj.repository || obj.repoUrl;
      const version = obj.version || obj.localVersion || obj.current;
      const name = obj.name || url || `item-${id}`;
      if (!url || !version) continue;
      items.push({ id: id++, name, url, version });
    }
    return items;
  } catch (e) {
    throw new Error("Invalid JSON file: " + e.message);
  }
}

function addRow(item) {
  const tr = document.createElement("tr");
  tr.dataset.id = item.id;
  tr.innerHTML = `
    <td>${item.id}</td>
    <td>${escapeHtml(item.name)}</td>
    <td><a href="${escapeAttr(item.url)}" target="_blank">${escapeHtml(item.url)}</a></td>
    <td>${escapeHtml(item.version)}</td>
    <td class="latest">—</td>
    <td class="status">pending</td>
    <td class="note small"></td>
  `;
  tbody.appendChild(tr);
  rows.set(item.id, tr);
}

function updateRowResult(id, latest, status, note) {
  const tr = rows.get(id);
  if (!tr) return;
  tr.querySelector(".latest").textContent = latest || "—";
  tr.querySelector(".status").textContent = status;
  const noteCell = tr.querySelector(".note");
  noteCell.textContent = note || "";
  if (note) noteCell.title = note;
  tr.classList.remove("ok", "minor", "major", "patch", "error");
  if (status === "ok") tr.classList.add("ok");
  else if (status === "minor") tr.classList.add("minor");
  else if (status === "major") tr.classList.add("major");
  else if (status === "patch") tr.classList.add("patch");
  else if (status === "error") tr.classList.add("error");
}

function escapeHtml(s) {
  return (s + "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

startBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];
  if (!file) {
    alert("Please select a CSV or JSON file");
    return;
  }
  const text = await file.text();
  let items;
  try {
    const name = (file.name || "").toLowerCase();
    if (name.endsWith(".json")) items = parseJSON(text);
    else if (name.endsWith(".csv")) items = parseCSV(text);
    else {
      // Try to detect by content
      const trimmed = text.trim();
      if (trimmed.startsWith("[") || trimmed.startsWith("{"))
        items = parseJSON(text);
      else items = parseCSV(text);
    }
  } catch (e) {
    alert("Failed to parse file: " + e.message);
    return;
  }

  if (!items || items.length === 0) {
    alert("No valid entries found");
    return;
  }

  // reset UI
  tbody.innerHTML = "";
  rows.clear();
  progress.textContent = `Enqueued ${items.length} checks. Initializing worker...`;

  for (const it of items) addRow(it);

  if (worker) worker.terminate();
  worker = new Worker("worker.js");

  worker.onmessage = (ev) => {
    const msg = ev.data;
    if (msg.type === "ready") {
      progress.textContent = `Worker ready. Starting checks...`;
      for (const it of items) {
        worker.postMessage({
          type: "enqueue",
          id: it.id,
          name: it.name,
          url: it.url,
          localVersion: it.version,
        });
      }
    } else if (msg.type === "result") {
      updateRowResult(
        msg.id,
        msg.latestTag || "—",
        msg.status,
        msg.message || "",
      );
      progress.textContent = msg.progress || progress.textContent;
    } else if (msg.type === "log") {
      console.log("worker:", msg.msg);
    }
  };

  worker.onerror = (e) => {
    console.error("Worker error", e);
    progress.textContent = "Worker error: " + e.message;
  };
});

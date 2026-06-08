const { defaultApiBaseUrl, refreshIntervalMs, storageKeys } = window.FailTraceData;

const state = {
  activeScreen: "main-screen",
  activePanel: "requests",
  apiBaseUrl: localStorage.getItem(storageKeys.apiBaseUrl) ?? defaultApiBaseUrl,
  adminToken: localStorage.getItem(storageKeys.adminToken) ?? "",
  autoScroll: {
    main: true,
    live: true,
  },
  data: null,
  selected: {
    main: null,
    live: null,
  },
  visualFocus: {
    main: false,
    live: false,
  },
};

const elements = {
  sessionTime: document.getElementById("session-time"),
  screens: Array.from(document.querySelectorAll(".screen")),
  tabs: Array.from(document.querySelectorAll(".tab[data-target]")),
  navLinks: Array.from(document.querySelectorAll(".nav a[data-target]")),
  actionControls: Array.from(document.querySelectorAll("[data-action]")),
  main: {
    stream: document.getElementById("main-stream"),
    output: document.getElementById("main-output"),
    route: document.getElementById("main-route"),
    traceId: document.getElementById("main-trace-id"),
    traceTitle: document.getElementById("main-trace-title"),
    seed: document.getElementById("main-seed"),
    progress: document.getElementById("main-progress"),
    nodeHop: document.getElementById("main-node-hop"),
    signal: document.getElementById("main-signal"),
    queue: document.getElementById("main-queue"),
    workers: document.getElementById("main-workers"),
    failure: document.getElementById("main-failure"),
    uptime: document.getElementById("main-uptime"),
  },
  live: {
    stream: document.getElementById("live-stream"),
    output: document.getElementById("live-output"),
    route: document.getElementById("live-route"),
    traceId: document.getElementById("live-trace-id"),
    traceTitle: document.getElementById("live-trace-title"),
    seed: document.getElementById("live-seed"),
    progress: document.getElementById("live-progress"),
    nodeHop: null,
    signal: null,
    queue: document.getElementById("live-queue"),
    workers: document.getElementById("live-workers"),
    failure: document.getElementById("live-failure"),
    uptime: document.getElementById("live-uptime"),
  },
};

const bootLines = {
  main: document.getElementById("boot-main"),
  live: document.getElementById("boot-live"),
};

const bootProgress = {
  main: document.getElementById("progress-main"),
  live: document.getElementById("progress-live"),
};

const bootOverlay = {
  main: document.querySelector('[data-boot="main"]'),
  live: document.querySelector('[data-boot="live"]'),
};

function activeStreamKey() {
  return state.activeScreen === "live-screen" ? "live" : "main";
}

function apiUrl(path) {
  return `${state.apiBaseUrl.replace(/\/$/, "")}${path}`;
}

function formatTime(value) {
  if (!value) return "--:--:--";
  return new Date(value).toLocaleTimeString("en-GB", { hour12: false });
}

function formatAge(value) {
  if (!value) return "unknown";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

function writeBoot(streamKey, line, progress) {
  const row = document.createElement("div");
  row.textContent = `> ${line}`;
  bootLines[streamKey].appendChild(row);
  bootProgress[streamKey].style.width = `${progress}%`;
}

function finishBoot() {
  Object.values(bootOverlay).forEach((overlay) => {
    setTimeout(() => overlay.classList.add("hidden"), 350);
  });
}

function writeOutput(streamKey, message, tone = "normal") {
  const output = elements[streamKey].output;
  output.textContent = message;
  output.classList.remove("success", "warning", "danger");
  if (tone !== "normal") output.classList.add(tone);
}

function requestKey(request) {
  return request.id;
}

function getRequests(streamKey) {
  const requests = state.data?.requests ?? [];
  if (streamKey === "live") {
    return requests.filter((request) => request.type === "failure" || request.status >= 400);
  }
  return requests;
}

function getSelectedRequest(streamKey) {
  const selectedId = state.selected[streamKey];
  return getRequests(streamKey).find((request) => requestKey(request) === selectedId) ?? null;
}

function statusTone(status) {
  if (status >= 500) return "danger";
  if (status >= 400) return "warning";
  return "success";
}

function renderRequestRow(request, streamKey) {
  const row = document.createElement("button");
  const selected = requestKey(request) === state.selected[streamKey];
  row.type = "button";
  row.className = `entry request-row${request.status >= 400 ? " error" : ""}${selected ? " selected" : ""}`;
  row.dataset.requestId = requestKey(request);
  row.setAttribute("aria-pressed", String(selected));
  row.innerHTML = `
    <span class="time">[${formatTime(request.createdAt)}]</span>
    <span class="method">${request.method}</span>
    <span class="code">${request.status}</span>
    <span class="path">${request.endpoint}</span>
    <span class="message">${request.service} / ${request.source}${request.failureId ? " / replayable" : ""}</span>
    <span class="latency">${request.durationMs}ms</span>
  `;
  row.addEventListener("click", () => selectRequest(streamKey, requestKey(request)));
  return row;
}

function renderStream(streamKey) {
  const stream = elements[streamKey].stream;
  const previousScrollTop = stream.scrollTop;
  const requests = getRequests(streamKey);

  stream.replaceChildren(...requests.map((request) => renderRequestRow(request, streamKey)));

  if (!state.selected[streamKey] && requests[0]) {
    state.selected[streamKey] = requestKey(requests[0]);
  }

  if (state.autoScroll[streamKey]) {
    stream.scrollTop = 0;
  } else {
    stream.scrollTop = previousScrollTop;
  }
}

function updateSelectionPanel(streamKey) {
  const request = getSelectedRequest(streamKey);
  const panel = elements[streamKey];

  if (!request) {
    panel.traceId.textContent = "NO_DB_ROWS";
    panel.traceTitle.textContent = streamKey === "main" ? "TRACE_EMPTY" : "VISUALIZER_EMPTY";
    panel.seed.textContent = "NO TRACE";
    panel.route.textContent = "NO REQUESTS IN DATABASE";
    panel.progress.style.width = "0%";
    if (panel.nodeHop) panel.nodeHop.textContent = "-- / --";
    if (panel.signal) panel.signal.textContent = "NO DATA";
    writeOutput(streamKey, "No matching database rows were returned by the API.", "warning");
    return;
  }

  const replayCount = request.replayResults?.length ?? 0;
  const progress = Math.min(100, Math.max(8, request.durationMs / 3));

  panel.traceId.textContent = request.traceId ?? request.id;
  panel.traceTitle.textContent = request.failureId ? "DB_FAILURE_TRACE" : "DB_API_TRACE";
  panel.seed.textContent = request.failureId ?? request.id;
  panel.route.textContent = request.endpoint;
  panel.progress.style.width = `${progress}%`;
  if (panel.nodeHop) panel.nodeHop.textContent = `${replayCount} replays`;
  if (panel.signal) {
    panel.signal.textContent = request.status >= 400 ? "UNSTABLE" : "STABLE";
    panel.signal.classList.toggle("text-red", request.status >= 400);
    panel.signal.classList.toggle("text-green", request.status < 400);
  }

  writeOutput(
    streamKey,
    `Selected real ${request.source} row from ${formatAge(request.createdAt)}: ${request.method} ${request.endpoint}.`,
    statusTone(request.status),
  );
}

function selectRequest(streamKey, requestId) {
  state.activePanel = "requests";
  state.selected[streamKey] = requestId;
  renderStream(streamKey);
  updateSelectionPanel(streamKey);
}

function renderMetrics() {
  const summary = state.data?.summary;
  const database = state.data?.database;

  if (!summary || !database) return;

  const failureRate = `${(summary.failureRate * 100).toFixed(2)}%`;
  elements.main.uptime.textContent = `${summary.averageLatencyMs}ms AVG`;
  elements.main.queue.textContent = `${database.tables.apiLogs} LOGS`;
  elements.main.workers.textContent = `${summary.nodeCount} NODES`;
  elements.main.failure.textContent = `${failureRate} CRIT`;

  elements.live.uptime.textContent = `${summary.p95LatencyMs}ms P95`;
  elements.live.queue.textContent = `${database.tables.failureLogs} FAILURES`;
  elements.live.workers.textContent = `${database.tables.replayResults} REPLAYS`;
  elements.live.failure.textContent = failureRate;
}

function renderAll() {
  const mainRequests = getRequests("main");
  const liveRequests = getRequests("live");

  if (!mainRequests.some((request) => requestKey(request) === state.selected.main)) {
    state.selected.main = mainRequests[0] ? requestKey(mainRequests[0]) : null;
  }
  if (!liveRequests.some((request) => requestKey(request) === state.selected.live)) {
    state.selected.live = liveRequests[0] ? requestKey(liveRequests[0]) : null;
  }

  renderMetrics();
  renderStream("main");
  renderStream("live");
  updateSelectionPanel("main");
  updateSelectionPanel("live");
}

async function fetchJson(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(state.adminToken ? { authorization: `Bearer ${state.adminToken}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error ?? `HTTP ${response.status}`);
  }

  return payload;
}

async function loadControlCenterData() {
  try {
    const payload = await fetchJson("/api/control-center");
    state.data = payload;
    renderAll();
    writeBoot("main", `Loaded ${payload.requests.length} database-backed request rows`, 100);
    writeBoot("live", `Loaded ${payload.nodes.length} database-derived nodes`, 100);
    finishBoot();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown API error";
    writeBoot("main", `API load failed: ${message}`, 100);
    writeBoot("live", `API load failed: ${message}`, 100);
    finishBoot();
    writeOutput("main", `Unable to load real database data from ${state.apiBaseUrl}: ${message}`, "danger");
    writeOutput("live", `Unable to load real database data from ${state.apiBaseUrl}: ${message}`, "danger");
  }
}

async function refreshData() {
  if (document.hidden) return;
  await loadControlCenterData();
}

async function replayRequest(streamKey) {
  const request = getSelectedRequest(streamKey);
  if (!request) {
    writeOutput(streamKey, "Select a database request row first.", "warning");
    return;
  }

  if (!request.failureId) {
    writeOutput(streamKey, "This row is an ApiLog without a matching FailureLog, so there is no real failure to replay.", "warning");
    return;
  }

  if (!state.adminToken) {
    const token = window.prompt("Enter an admin JWT for the protected replay endpoint:");
    if (!token) {
      writeOutput(streamKey, "Replay cancelled. Admin JWT is required for the real replay endpoint.", "warning");
      return;
    }
    state.adminToken = token.trim();
    localStorage.setItem(storageKeys.adminToken, state.adminToken);
  }

  try {
    writeOutput(streamKey, `Calling real replay endpoint for FailureLog ${request.failureId}...`);
    const payload = await fetchJson(`/api/replays/${request.failureId}`, {
      body: JSON.stringify({}),
      method: "POST",
    });
    writeOutput(
      streamKey,
      `Replay saved to database. Replay status: ${payload.result?.replayStatus ?? "n/a"}, duration ${payload.result?.durationMs ?? "n/a"}ms.`,
      "success",
    );
    await loadControlCenterData();
  } catch (error) {
    writeOutput(streamKey, `Replay failed: ${error instanceof Error ? error.message : "unknown error"}`, "danger");
  }
}

function viewTrace(streamKey) {
  const request = getSelectedRequest(streamKey);
  if (!request) {
    writeOutput(streamKey, "Select a database request row first.", "warning");
    return;
  }

  const replaySummary = request.replayResults?.length
    ? `${request.replayResults.length} replay result(s), latest status ${request.replayResults[0].replayStatus ?? "n/a"}`
    : "no replay results";

  writeOutput(
    streamKey,
    `Trace ${request.traceId ?? request.id}: ${request.method} ${request.originalUrl}, status ${request.status}, ${request.durationMs}ms, ${replaySummary}.`,
    statusTone(request.status),
  );
}

async function analyzeRequest(streamKey) {
  const request = getSelectedRequest(streamKey);
  if (!request) {
    writeOutput(streamKey, "Select a database request row first.", "warning");
    return;
  }

  try {
    const query = request.traceId ? `?traceId=${encodeURIComponent(request.traceId)}` : "";
    const analytics = await fetchJson(`/api/analytics${query}`);
    const failureTotal = analytics.failureFrequency?.totalFailures ?? 0;
    const endpoint = analytics.mostFailingEndpoints?.[0];
    const message = endpoint
      ? `DB analytics: ${failureTotal} failure(s) for trace scope. Top endpoint ${endpoint.endpoint}, p95 ${endpoint.p95LatencyMs}ms.`
      : `DB analytics: ${failureTotal} failure(s) for this trace scope. Selected row status ${request.status}.`;
    writeOutput(streamKey, message, failureTotal > 0 ? "danger" : "success");
  } catch (error) {
    writeOutput(streamKey, `Analytics failed: ${error instanceof Error ? error.message : "unknown error"}`, "danger");
  }
}

function toggleScroll(streamKey, button) {
  state.autoScroll[streamKey] = !state.autoScroll[streamKey];
  button.textContent = streamKey === "main"
    ? `AUTO_SCROLL: ${state.autoScroll[streamKey] ? "ON" : "OFF"}`
    : `SCROLL: ${state.autoScroll[streamKey] ? "ON" : "OFF"}`;
  button.classList.toggle("is-off", !state.autoScroll[streamKey]);
}

function toggleVisualizer(streamKey, button) {
  state.visualFocus[streamKey] = !state.visualFocus[streamKey];
  button.classList.toggle("focused", state.visualFocus[streamKey]);
  const request = getSelectedRequest(streamKey);
  writeOutput(
    streamKey,
    `Visualizer ${state.visualFocus[streamKey] ? "focused" : "released"} for DB trace ${request?.traceId ?? "none"}.`,
    "success",
  );
}

async function runScan() {
  const streamKey = activeStreamKey();
  writeOutput(streamKey, "Refreshing real database-backed control-center data...");
  await loadControlCenterData();
}

function showLogs() {
  const streamKey = activeStreamKey();
  const count = state.data?.requests?.length ?? 0;
  writeOutput(streamKey, `Showing ${count} real database-backed request rows from ApiLog and FailureLog.`, "success");
}

function showNodes() {
  const streamKey = activeStreamKey();
  const nodes = state.data?.nodes ?? [];
  const message = nodes.length
    ? nodes
        .slice(0, 5)
        .map((node) => `${node.service} ${node.endpoint}: ${node.requestCount} req, ${node.failureCount} fail, ${node.status}`)
        .join(" | ")
    : "No node data exists yet because the database has no request logs.";
  writeOutput(streamKey, `DB-derived nodes: ${message}`, nodes.some((node) => node.status === "critical") ? "danger" : "success");
}

function showConfig() {
  const streamKey = activeStreamKey();
  const config = state.data?.config;
  const database = state.data?.database;
  const nextBaseUrl = window.prompt("API base URL for this static frontend:", state.apiBaseUrl);
  if (nextBaseUrl) {
    state.apiBaseUrl = nextBaseUrl.trim().replace(/\/$/, "");
    localStorage.setItem(storageKeys.apiBaseUrl, state.apiBaseUrl);
  }
  const nextToken = window.prompt("Admin JWT for protected replay calls (leave blank to keep current):", state.adminToken ? "[stored]" : "");
  if (nextToken && nextToken !== "[stored]") {
    state.adminToken = nextToken.trim();
    localStorage.setItem(storageKeys.adminToken, state.adminToken);
  }

  const configText = config && database
    ? `DB connected via ${database.provider}. env=${config.nodeEnv}, replayQueue=${config.replayQueueEnabled}, syncConcurrency=${config.replaySyncConcurrency}, apiBase=${state.apiBaseUrl}.`
    : `API base set to ${state.apiBaseUrl}. Refreshing database config...`;
  writeOutput(streamKey, configText, "success");
  void loadControlCenterData();
}

function terminateSession() {
  const streamKey = activeStreamKey();
  state.autoScroll[streamKey] = false;
  writeOutput(streamKey, "Local auto-refresh display paused. Database data remains unchanged.", "warning");
}

function switchScreen(targetId) {
  state.activeScreen = targetId;
  elements.screens.forEach((screen) => screen.classList.toggle("active", screen.id === targetId));
  elements.tabs.forEach((tab) => {
    const active = tab.dataset.target === targetId;
    tab.setAttribute("aria-pressed", String(active));
    tab.setAttribute("aria-selected", String(active));
  });
  elements.navLinks.forEach((link) => link.classList.toggle("active", link.dataset.target === targetId));
  location.hash = targetId === "live-screen" ? "#live" : "#main";
}

function bindEvents() {
  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchScreen(tab.dataset.target));
  });

  elements.navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      switchScreen(link.dataset.target);
    });
  });

  elements.actionControls.forEach((control) => {
    control.addEventListener("click", (event) => {
      const action = control.dataset.action;
      const streamKey = control.dataset.stream || activeStreamKey();
      if (control.tagName === "A") event.preventDefault();

      if (action === "replay") void replayRequest(streamKey);
      if (action === "view") viewTrace(streamKey);
      if (action === "analyze") void analyzeRequest(streamKey);
      if (action === "toggle-scroll") toggleScroll(streamKey, control);
      if (action === "visualize") toggleVisualizer(streamKey, control);
      if (action === "scan") void runScan();
      if (action === "logs") showLogs();
      if (action === "terminate") terminateSession();
      if (action === "nav-note" && control.dataset.panel === "NODES") showNodes();
      if (action === "nav-note" && control.dataset.panel === "CONFIG") showConfig();
    });
  });

  window.addEventListener("hashchange", () => {
    switchScreen(location.hash === "#live" ? "live-screen" : "main-screen");
  });
}

function startSessionClock() {
  const startedAt = Date.now();
  setInterval(() => {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const hours = String(Math.floor(elapsed / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
    const seconds = String(elapsed % 60).padStart(2, "0");
    elements.sessionTime.textContent = `${hours}:${minutes}:${seconds}`;
  }, 1000);
}

function initBoot() {
  writeBoot("main", `Connecting to ${state.apiBaseUrl}/api/control-center`, 35);
  writeBoot("live", "Waiting for database-backed telemetry", 35);
}

bindEvents();
startSessionClock();
initBoot();
switchScreen(location.hash === "#live" ? "live-screen" : "main-screen");
void loadControlCenterData();
setInterval(refreshData, refreshIntervalMs);

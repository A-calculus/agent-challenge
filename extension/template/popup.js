const api = typeof browser !== "undefined" ? browser : chrome;

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: ${id}`);
  return el;
}

function setText(id, text) {
  $(id).textContent = text;
}

function setHidden(id, hidden) {
  $(id).classList.toggle("hidden", hidden);
}

async function loadState() {
  const data = await api.storage.local.get([
    "privora_backend_base_url",
    "privora_wallet",
    "privora_model_config",
    "privora_deployment_endpoint",
  ]);
  return {
    backendBaseUrl: data.privora_backend_base_url || "{{PRIVORA_BACKEND_BASE_URL}}",
    wallet: data.privora_wallet || null,
    modelConfig: data.privora_model_config || null,
    deploymentEndpoint: data.privora_deployment_endpoint || null,
  };
}

async function saveBackendBaseUrl(url) {
  await api.storage.local.set({ privora_backend_base_url: url });
}

async function connectWallet() {
  // MVP: connect to a Phantom-like provider if present
  const provider = window.solana;
  if (!provider || !provider.isPhantom) {
    throw new Error("No wallet provider detected (install Phantom).");
  }
  const resp = await provider.connect();
  const pubkey = resp?.publicKey?.toString?.() || provider.publicKey?.toString?.();
  if (!pubkey) throw new Error("Wallet connection failed.");
  await api.storage.local.set({ privora_wallet: pubkey });
  return pubkey;
}

async function validateConfig(cfg) {
  const state = await loadState();
  await saveBackendBaseUrl(state.backendBaseUrl);

  const res = await fetch(`${state.backendBaseUrl}/api/model/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cfg),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  if (!json?.ok) throw new Error(json?.error || "Validation failed");
  return json;
}

async function deployOnNosana() {
  const state = await loadState();
  if (!state.wallet) throw new Error("Connect wallet first.");
  if (!state.modelConfig) throw new Error("Configure and save your model first.");

  const res = await fetch(`${state.backendBaseUrl}/api/nosana/deploy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet: state.wallet }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  if (!json?.ok) throw new Error(json?.error || "Deploy failed");

  await api.storage.local.set({ privora_deployment_endpoint: json.endpoint });
  return json;
}

async function fetchMetrics() {
  const state = await loadState();
  if (!state.wallet) throw new Error("Connect wallet first.");
  const res = await fetch(`${state.backendBaseUrl}/api/nosana/metrics?wallet=${encodeURIComponent(state.wallet)}`);
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

function readForm() {
  const provider = $("provider").value;
  const baseUrl = $("baseUrl").value.trim();
  const apiKey = $("apiKey").value.trim();
  const smallModel = $("smallModel").value.trim();
  const largeModel = $("largeModel").value.trim();
  const embeddingModel = $("embeddingModel").value.trim();
  const embeddingDimensions = parseInt($("embeddingDimensions").value.trim() || "0", 10);

  return {
    provider,
    baseUrl,
    apiKey,
    smallModel,
    largeModel,
    embeddingModel,
    embeddingDimensions,
  };
}

function fillForm(state) {
  $("baseUrl").value = state.modelConfig?.baseUrl || "http://localhost:11434/v1";
  $("apiKey").value = state.modelConfig?.apiKey || "ollama";
  $("provider").value = state.modelConfig?.provider || "ollama";
  $("smallModel").value = state.modelConfig?.smallModel || "";
  $("largeModel").value = state.modelConfig?.largeModel || "";
  $("embeddingModel").value = state.modelConfig?.embeddingModel || "";
  $("embeddingDimensions").value = String(state.modelConfig?.embeddingDimensions || "");
}

async function refreshUI() {
  const state = await loadState();

  const isReady = !!state.wallet && !!state.modelConfig;
  setHidden("view-onboarding", isReady && !!state.deploymentEndpoint);
  setHidden("view-dashboard", !isReady || !state.deploymentEndpoint);

  setText("wallet-status", state.wallet ? `Connected: ${state.wallet}` : "Not connected");
  fillForm(state);

  setText("dash-wallet", state.wallet || "—");
  setText("dash-backend", state.backendBaseUrl);
  setText("dash-endpoint", state.deploymentEndpoint || "—");
}

async function main() {
  const state = await loadState();
  await api.storage.local.set({ privora_backend_base_url: state.backendBaseUrl });

  $("btn-connect").addEventListener("click", async () => {
    try {
      setText("wallet-status", "Connecting...");
      const pubkey = await connectWallet();
      setText("wallet-status", `Connected: ${pubkey}`);
      await refreshUI();
    } catch (e) {
      setText("wallet-status", (e && e.message) || String(e));
    }
  });

  $("btn-validate").addEventListener("click", async () => {
    $("btn-save").disabled = true;
    try {
      setText("validate-status", "Validating...");
      const cfg = readForm();
      const out = await validateConfig(cfg);
      setText("validate-status", `OK: ${out.summary}`);
      $("btn-save").disabled = false;
    } catch (e) {
      setText("validate-status", (e && e.message) || String(e));
    }
  });

  $("btn-save").addEventListener("click", async () => {
    try {
      const cfg = readForm();
      await api.storage.local.set({ privora_model_config: cfg });
      setText("validate-status", "Saved.");
      await refreshUI();
    } catch (e) {
      setText("validate-status", (e && e.message) || String(e));
    }
  });

  $("btn-deploy").addEventListener("click", async () => {
    try {
      setText("dash-status", "Deploying...");
      const out = await deployOnNosana();
      setText("dash-status", `Deployed: ${out.endpoint}`);
      await refreshUI();
    } catch (e) {
      setText("dash-status", (e && e.message) || String(e));
    }
  });

  $("btn-refresh").addEventListener("click", async () => {
    try {
      const m = await fetchMetrics();
      setText("dash-status", `Uptime: ${m.totalSecondsActive}s • Est. cost: $${m.estimatedCostUsd} • Paused: ${m.paused}`);
    } catch (e) {
      setText("dash-status", (e && e.message) || String(e));
    }
    await refreshUI();
  });

  await refreshUI();
}

main().catch((e) => {
  console.error(e);
});


// MV3 service worker (module)
const api = typeof browser !== "undefined" ? browser : chrome;

async function getSettings() {
  const data = await api.storage.local.get([
    "privora_backend_base_url",
    "privora_wallet",
    "privora_model_config",
    "privora_deployment_endpoint",
  ]);
  return data;
}

api.runtime.onInstalled.addListener(() => {
  // Seed backend base URL from build-time placeholder (server replaces this)
  api.storage.local.get(["privora_backend_base_url"]).then((d) => {
    if (!d.privora_backend_base_url) {
      api.storage.local.set({
        privora_backend_base_url: "{{PRIVORA_BACKEND_BASE_URL}}",
      });
    }
  });
});

api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (!message || !message.type) {
      sendResponse({ ok: false, error: "invalid message" });
      return;
    }

    if (message.type === "GET_SETTINGS") {
      sendResponse({ ok: true, data: await getSettings() });
      return;
    }

    sendResponse({ ok: false, error: "unknown message type" });
  })();

  return true;
});


import http from "http";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import JSZip from "jszip";
import { fileURLToPath } from "url";
import { logger } from "@elizaos/core";

type BrowserFamily = "chromium" | "firefox";

type ModelProvider = "ollama" | "openai_compat";

type ModelConfig = {
  provider: ModelProvider;
  baseUrl: string;
  apiKey?: string;
  smallModel: string;
  largeModel: string;
  embeddingModel: string;
  embeddingDimensions: number;
  embeddingBaseUrl?: string;
  embeddingApiKey?: string;
};

type BuildRecord = {
  id: string;
  browser: BrowserFamily;
  filename: string;
  mime: string;
  bytes: Buffer;
  createdAtMs: number;
};

type DeploymentRecord = {
  wallet: string;
  deploymentId: string;
  endpoint: string;
  createdAtMs: number;
  paused: boolean;
  totalSecondsActive: number;
  lastTickMs: number;
};

type StartExtensionServerOptions = {
  port: number;
  baseUrl?: string;
  maxArtifactAgeMs?: number;
};

const DEFAULT_MAX_ARTIFACT_AGE_MS = 10 * 60 * 1000; // 10 minutes

function json(res: http.ServerResponse, status: number, body: unknown) {
  const text = JSON.stringify(body, null, 2);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(text);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) {
        reject(new Error("request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function safeParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function getExtensionTemplateDir(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(__dirname, "../extension/template");
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

async function postJson(url: string, body: unknown, headers?: Record<string, string>): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(headers || {}) },
    body: JSON.stringify(body),
  });
  const text = await res.text().catch(() => "");
  const parsed = safeParseJson<any>(text);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  return parsed ?? { raw: text };
}

/**
 * Separately validate chat completion and embeddings endpoints for OpenAI-compatible APIs.
 * - If both succeed, returns { ok: true, summary: "..." }
 * - If only one is available, returns ok: false, but indicates which passed.
 * - Either can be skipped by passing empty/undefined model(s).
 */
async function validateOpenAICompat(cfg: ModelConfig): Promise<{ ok: boolean; summary: string }> {
  const base = normalizeBaseUrl(cfg.baseUrl);
  const apiKey = cfg.apiKey || "ollama";
  let chatOk = false;
  let embedOk = false;
  let chatError: string | null = null;
  let embedError: string | null = null;

  // 1) chat completion smoke test (optional)
  if (cfg.smallModel || cfg.largeModel) {
    try {
      await postJson(
        `${base}/chat/completions`,
        {
          model: cfg.smallModel || cfg.largeModel,
          messages: [{ role: "user", content: "Respond with the single word OK." }],
          stream: false,
          max_tokens: 8,
        },
        { Authorization: `Bearer ${apiKey}` }
      );
      chatOk = true;
    } catch (e: any) {
      chatError = e?.message || String(e);
    }
  } else {
    chatError = "No chat model configured.";
  }

  // 2) embeddings smoke test (optional)
  if (cfg.embeddingModel) {
    try {
      const embedBase = normalizeBaseUrl(cfg.embeddingBaseUrl || cfg.baseUrl);
      const embedKey = cfg.embeddingApiKey || cfg.apiKey || "ollama";
      await postJson(
        `${embedBase}/embeddings`,
        { model: cfg.embeddingModel, input: "hello" },
        { Authorization: `Bearer ${embedKey}` }
      );
      embedOk = true;
    } catch (e: any) {
      embedError = e?.message || String(e);
    }
  } else {
    embedError = "No embedding model configured.";
  }

  // Summarize
  if (chatOk && embedOk) {
    return { ok: true, summary: "Chat completion and embeddings endpoints validated." };
  }

  let problems: string[] = [];
  if (!chatOk) problems.push(`Chat completion: ${chatError}`);
  if (!embedOk) problems.push(`Embeddings: ${embedError}`);

  return {
    ok: false,
    summary: problems.join(" | ")
  };
}

async function validateOllama(cfg: ModelConfig): Promise<{ ok: boolean; summary: string }> {
  // For Ollama, we use the native /api endpoints directly.
  // This assumes Ollama is running in the container and the requested model is available.
  try {
    // Validate the chat/completions endpoint
    const chatBase = normalizeBaseUrl(cfg.baseUrl);
    const chatRes = await postJson(
      `${chatBase}/api/chat`, // Native Ollama endpoint
      {
        model: cfg.smallModel || cfg.largeModel,
        messages: [{ role: "user", content: "Respond with the single word OK." }],
        stream: false,
        options: { num_predict: 8 }
      }
    );
    if (!chatRes || typeof chatRes !== "object" || !chatRes.message) {
      return { ok: false, summary: "Native /api/chat returned invalid response." };
    }

    // Validate the embeddings endpoint
    if (cfg.embeddingModel) {
      const embedBase = normalizeBaseUrl(cfg.embeddingBaseUrl || cfg.baseUrl);
      const embedRes = await postJson(
        `${embedBase}/api/embeddings`, // Native Ollama endpoint
        { model: cfg.embeddingModel, prompt: "hello" }
      );
      if (!embedRes || typeof embedRes !== "object" || !Array.isArray(embedRes.embeddings)) {
        return { ok: false, summary: "Native /api/embeddings returned invalid response." };
      }
    }

    return { ok: true, summary: "Ollama /api/chat and /api/embeddings endpoints validated." };
  } catch (e: any) {
    return { ok: false, summary: String(e?.message || e) };
  }
}

function browserFromInput(input: unknown): BrowserFamily | null {
  if (input === "chromium" || input === "firefox") return input;
  return null;
}

function contentTypeFor(browser: BrowserFamily): { filename: string; mime: string } {
  // For MVP: both are zip containers; Firefox accepts .xpi (zip) for self-host install.
  if (browser === "firefox") return { filename: "privora-extension.xpi", mime: "application/x-xpinstall" };
  return { filename: "privora-extension.zip", mime: "application/zip" };
}

async function buildExtensionZip(browser: BrowserFamily, baseUrl: string): Promise<Buffer> {
  const templateDir = getExtensionTemplateDir();
  if (!fs.existsSync(templateDir)) {
    throw new Error(`Extension template directory missing: ${templateDir}`);
  }

  const zip = new JSZip();

  const filesToInclude = [
    "manifest.base.json",
    "manifest.chromium.json",
    "manifest.firefox.json",
    "background.js",
    "content.js",
    "popup.html",
    "popup.js",
    "styles.css",
  ];

  const raw: Record<string, string> = {};
  for (const filename of filesToInclude) {
    const p = path.join(templateDir, filename);
    if (!fs.existsSync(p)) continue;
    raw[filename] = fs.readFileSync(p, "utf-8");
  }

  const baseManifest = safeParseJson<Record<string, any>>(raw["manifest.base.json"] || "{}") || {};
  const browserManifest = safeParseJson<Record<string, any>>(
    raw[browser === "firefox" ? "manifest.firefox.json" : "manifest.chromium.json"] || "{}"
  ) || {};

  const mergedManifest = { ...baseManifest, ...browserManifest };

  // Inject the backend base URL so the extension can reach the app backend and/or deployed endpoint later.
  mergedManifest.__privora = {
    backendBaseUrl: baseUrl,
    builtAt: new Date().toISOString(),
    browser,
  };

  zip.file("manifest.json", JSON.stringify(mergedManifest, null, 2));

  const replacements: Array<[RegExp, string]> = [
    [/\{\{PRIVORA_BACKEND_BASE_URL\}\}/g, baseUrl],
  ];

  for (const [filename, text] of Object.entries(raw)) {
    if (filename.startsWith("manifest.")) continue;
    const outName = filename;
    let out = text;
    for (const [re, val] of replacements) out = out.replace(re, val);
    zip.file(outName, out);
  }

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export function startExtensionServer(opts: StartExtensionServerOptions): { close: () => Promise<void> } {
  const records = new Map<string, BuildRecord>();
  const deployments = new Map<string, DeploymentRecord>(); // key: wallet
  const baseUrl = (opts.baseUrl || `http://localhost:${opts.port}`).replace(/\/+$/, "");
  const maxAge = opts.maxArtifactAgeMs ?? DEFAULT_MAX_ARTIFACT_AGE_MS;

  const server = http.createServer(async (req, res) => {
    try {
      // Basic CORS for local dev + extension contexts
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }

      const url = new URL(req.url || "/", baseUrl);

      // Cleanup old artifacts opportunistically
      const now = Date.now();
      for (const [id, rec] of records.entries()) {
        if (now - rec.createdAtMs > maxAge) records.delete(id);
      }

      if (req.method === "POST" && url.pathname === "/api/extension/build") {
        const bodyText = await readBody(req);
        const body = safeParseJson<{ browser?: BrowserFamily }>(bodyText) || {};
        const browser = browserFromInput(body.browser);
        if (!browser) {
          json(res, 400, { ok: false, error: "Missing or invalid 'browser'. Use 'chromium' or 'firefox'." });
          return;
        }

        const bytes = await buildExtensionZip(browser, baseUrl);
        const id = crypto.randomUUID();
        const { filename, mime } = contentTypeFor(browser);
        records.set(id, { id, browser, filename, mime, bytes, createdAtMs: Date.now() });

        json(res, 200, {
          ok: true,
          buildId: id,
          browser,
          downloadUrl: `${baseUrl}/api/extension/download/${id}`,
          filename,
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/model/validate") {
        const bodyText = await readBody(req);
        const cfg = safeParseJson<ModelConfig>(bodyText);
        if (!cfg) {
          json(res, 400, { ok: false, error: "Invalid JSON body." });
          return;
        }
        if (!cfg.baseUrl || !cfg.smallModel || !cfg.largeModel || !cfg.embeddingModel) {
          json(res, 400, { ok: false, error: "Missing required fields (baseUrl, smallModel, largeModel, embeddingModel)." });
          return;
        }
        try {
          const result =
            cfg.provider === "ollama"
              ? await validateOllama(cfg)
              : await validateOpenAICompat(cfg);
          json(res, 200, { ok: true, summary: result.summary });
        } catch (e) {
          json(res, 400, { ok: false, error: (e as Error).message || String(e) });
        }
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/nosana/deploy") {
        // MVP: return a placeholder endpoint. Real Nosana orchestration will be implemented
        // in the next workstream once SDK wiring is added.
        const bodyText = await readBody(req);
        const body = safeParseJson<{ wallet?: string }>(bodyText) || {};
        if (!body.wallet) {
          json(res, 400, { ok: false, error: "Missing wallet." });
          return;
        }
        const existing = deployments.get(body.wallet);
        if (existing) {
          json(res, 200, { ok: true, deploymentId: existing.deploymentId, endpoint: existing.endpoint, reused: true });
          return;
        }
        const deploymentId = crypto.randomUUID();
        const endpoint = `${baseUrl.replace(/\/+$/, "")}`;
        deployments.set(body.wallet, {
          wallet: body.wallet,
          deploymentId,
          endpoint,
          createdAtMs: Date.now(),
          paused: false,
          totalSecondsActive: 0,
          lastTickMs: Date.now(),
        });
        json(res, 200, { ok: true, deploymentId, endpoint });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/nosana/status") {
        const wallet = url.searchParams.get("wallet") || "";
        const rec = deployments.get(wallet);
        if (!rec) {
          json(res, 404, { ok: false, error: "No deployment for wallet." });
          return;
        }
        json(res, 200, {
          ok: true,
          deploymentId: rec.deploymentId,
          endpoint: rec.endpoint,
          paused: rec.paused,
          createdAtMs: rec.createdAtMs,
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/nosana/pause") {
        const bodyText = await readBody(req);
        const body = safeParseJson<{ wallet?: string }>(bodyText) || {};
        if (!body.wallet) {
          json(res, 400, { ok: false, error: "Missing wallet." });
          return;
        }
        const rec = deployments.get(body.wallet);
        if (!rec) {
          json(res, 404, { ok: false, error: "No deployment for wallet." });
          return;
        }
        rec.paused = true;
        deployments.set(body.wallet, rec);
        json(res, 200, { ok: true, paused: true });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/nosana/resume") {
        const bodyText = await readBody(req);
        const body = safeParseJson<{ wallet?: string }>(bodyText) || {};
        if (!body.wallet) {
          json(res, 400, { ok: false, error: "Missing wallet." });
          return;
        }
        const rec = deployments.get(body.wallet);
        if (!rec) {
          json(res, 404, { ok: false, error: "No deployment for wallet." });
          return;
        }
        rec.paused = false;
        rec.lastTickMs = Date.now();
        deployments.set(body.wallet, rec);
        json(res, 200, { ok: true, paused: false });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/nosana/metrics") {
        const wallet = url.searchParams.get("wallet") || "";
        const rec = deployments.get(wallet);
        if (!rec) {
          json(res, 404, { ok: false, error: "No deployment for wallet." });
          return;
        }
        // tick active time
        const nowMs = Date.now();
        if (!rec.paused) {
          const delta = Math.max(0, Math.floor((nowMs - rec.lastTickMs) / 1000));
          rec.totalSecondsActive += delta;
        }
        rec.lastTickMs = nowMs;
        deployments.set(wallet, rec);

        // Placeholder cost model (devnet): $0.048/hr equivalent
        const hourlyUsd = 0.048;
        const costUsd = (rec.totalSecondsActive / 3600) * hourlyUsd;

        json(res, 200, {
          ok: true,
          deploymentId: rec.deploymentId,
          paused: rec.paused,
          totalSecondsActive: rec.totalSecondsActive,
          estimatedCostUsd: Number(costUsd.toFixed(4)),
          hourlyUsd,
        });
        return;
      }

      if (req.method === "GET" && url.pathname.startsWith("/api/extension/download/")) {
        const id = url.pathname.split("/").pop() || "";
        const rec = records.get(id);
        if (!rec) {
          json(res, 404, { ok: false, error: "Unknown buildId (expired or not found)." });
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", rec.mime);
        res.setHeader("Content-Disposition", `attachment; filename="${rec.filename}"`);
        res.end(rec.bytes);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/extension/health") {
        json(res, 200, { ok: true, service: "privora-extension-builder", baseUrl });
        return;
      }

      json(res, 404, { ok: false, error: "Not found" });
    } catch (e) {
      json(res, 500, { ok: false, error: (e as Error).message || String(e) });
    }
  });

  server.listen(opts.port, () => {
    logger.info(`[Privora Extension] Builder server listening on ${baseUrl}`);
  });

  return {
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}


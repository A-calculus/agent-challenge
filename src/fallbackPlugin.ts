/**
 * Privora — Resilient Model Fallback Plugin
 *
 * This plugin registers model handlers at priority 200 (above the OpenAI plugin's
 * priority of ~100). Each handler:
 *  1. First attempts the OpenAI-compatible API (works for text generation via Ollama's /v1 shim)
 *  2. On ANY error (501, timeout, network failure, token limit, etc.), catches it silently
 *     and falls back to the native Ollama API at /api/* with a full 10-minute timeout.
 *
 * All calls use a 10-minute abort controller (600,000ms) to handle large 30B model
 * inference times without the default 5-minute crash.
 *
 * Registered model types:
 *  - ModelType.TEXT_LARGE
 *  - ModelType.TEXT_SMALL
 *  - ModelType.TEXT_EMBEDDING
 *  - ModelType.OBJECT_LARGE
 *  - ModelType.OBJECT_SMALL
 */

import {
  type Plugin,
  type IAgentRuntime,
  ModelType,
  logger,
} from "@elizaos/core";

// ─── Config ──────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const FALLBACK_PRIORITY = 200;      // Higher than plugin-openai (~100)

function getOllamaBase(): string {
  const endpoint = process.env.OLLAMA_API_ENDPOINT || "http://localhost:11434/api";
  // Strip trailing /api so we can build paths cleanly
  return endpoint.endsWith("/api") ? endpoint.slice(0, -4) : endpoint;
}

function getOllamaModel(): string {
  return process.env.OLLAMA_LARGE_MODEL || "";
}

function getOllamaSmallModel(): string {
  return process.env.OLLAMA_SMALL_MODEL || "";
}

function getOllamaEmbeddingModel(): string {
  return process.env.OLLAMA_EMBEDDING_MODEL || "";
}

function getOpenAIBase(): string {
  return process.env.OPENAI_BASE_URL || "";
}

function getOpenAIModel(): string {
  return process.env.OPENAI_LARGE_MODEL || "";
}

function getOpenAISmallModel(): string {
  return process.env.OPENAI_SMALL_MODEL || "";
}

// ─── Timed fetch helper ───────────────────────────────────────────────────────

async function timedFetch(url: string, init: RequestInit, timeoutMs = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ─── Native Ollama API helpers ────────────────────────────────────────────────

async function ollamaNativeChat(model: string, prompt: string, systemPrompt?: string): Promise<string> {
  const base = getOllamaBase();
  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const res = await timedFetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama native chat failed: HTTP ${res.status} — ${body}`);
  }

  const data = await res.json() as any;
  return data?.message?.content ?? data?.response ?? "";
}

async function ollamaNativeEmbedding(model: string, input: string | string[]): Promise<number[] | number[][]> {
  const base = getOllamaBase();
  const inputs = Array.isArray(input) ? input : [input];

  console.log(`[Privora Fallback] TEXT_EMBEDDING: Batch Embedding for ${inputs.length} inputs...`);

  // Ollama >= 0.1.32 supports batch embed via /api/embed
  try {
    const res = await timedFetch(`${base}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: inputs }),
    });

    if (res.ok) {
      const data = await res.json() as any;
      const vecs: number[][] = data.embeddings;
      if (vecs && vecs.length === inputs.length) {
        return Array.isArray(input) ? vecs : vecs[0];
      }
      console.warn(`[Privora Fallback] /api/embed returned ${vecs?.length} embeddings for ${inputs.length} inputs. Falling back to legacy.`);
    }
  } catch (e) {
    console.warn(`[Privora Fallback] /api/embed failed: ${String(e)}. Falling back to legacy.`);
  }

  // Fallback to legacy /api/embeddings (single item only, so we must map and call N times)
  console.log(`[Privora Fallback] Processing ${inputs.length} inputs via legacy /api/embeddings...`);
  const promises = inputs.map(async (text) => {
    const legacyRes = await timedFetch(`${base}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: text }),
    });
    if (!legacyRes.ok) throw new Error(`Ollama legacy embedding failed: HTTP ${legacyRes.status}`);
    const legacyData = await legacyRes.json() as any;
    return legacyData.embedding as number[];
  });

  const vecs = await Promise.all(promises);
  return Array.isArray(input) ? vecs : vecs[0];
}

// ─── OpenAI-compat helpers (primary attempt) ─────────────────────────────────

async function openAICompatChat(model: string, prompt: string, systemPrompt?: string): Promise<string> {
  const base = getOpenAIBase();
  const apiKey = process.env.OPENAI_API_KEY || "ollama";
  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const res = await timedFetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI-compat chat failed: HTTP ${res.status} — ${body}`);
  }

  const data = await res.json() as any;
  return data?.choices?.[0]?.message?.content ?? "";
}

// ─── Model Handlers ───────────────────────────────────────────────────────────

async function textLargeHandler(runtime: IAgentRuntime, params: any): Promise<any> {
  const prompt = (params.prompt as string) ?? "";
  const systemPrompt = params.systemPrompt as string | undefined;

  if (systemPrompt) {
    logger.debug(`[Privora Fallback] TEXT_LARGE systemPrompt check (len=${systemPrompt.length}): "${systemPrompt.substring(0, 100)}..."`);
  }

  // 1. Try OpenAI-compat first
  try {
    const openaiModel = getOpenAIModel();
    const result = await openAICompatChat(openaiModel, prompt, systemPrompt);
    if (result) return result;
    throw new Error("Empty response from OpenAI-compat layer");
  } catch (primaryErr) {
    logger.warn(`[Privora Fallback] TEXT_LARGE: OpenAI-compat failed — ${(primaryErr as Error).message}. Falling back to native Ollama.`);
  }

  // 2. Native Ollama fallback
  const ollamaModel = getOllamaModel();
  return ollamaNativeChat(ollamaModel, prompt, systemPrompt);
}

async function textSmallHandler(runtime: IAgentRuntime, params: any): Promise<any> {
  const prompt = (params.prompt as string) ?? "";
  const systemPrompt = params.systemPrompt as string | undefined;

  if (systemPrompt) {
    logger.debug(`[Privora Fallback] TEXT_SMALL systemPrompt check (len=${systemPrompt.length}): "${systemPrompt.substring(0, 100)}..."`);
  }

  try {
    const openaiModel = getOpenAISmallModel();
    const result = await openAICompatChat(openaiModel, prompt, systemPrompt);
    if (result) return result;
    throw new Error("Empty response");
  } catch (primaryErr) {
    logger.warn(`[Privora Fallback] TEXT_SMALL: OpenAI-compat failed — ${(primaryErr as Error).message}. Falling back to native Ollama.`);
  }

  const ollamaModel = getOllamaSmallModel();
  return ollamaNativeChat(ollamaModel, prompt, systemPrompt);
}

async function embeddingHandler(runtime: IAgentRuntime, params: any): Promise<any> {
  const model = process.env.OLLAMA_EMBEDDING_MODEL || process.env.OPENAI_EMBEDDING_MODEL;
  const input = params.input as string | string[];

  if (!model) {
    throw new Error("No embedding model configured.");
  }

  // Skip OpenAI-compat entirely for embeddings — it always returns 501
  // Go straight to native Ollama
  logger.debug(`[Privora Fallback] TEXT_EMBEDDING: routing directly to native Ollama (${model})`);

  // // Guard: If input is empty, return a zero-vector of the expected dimension 
  // const inputText = typeof input === "string" ? input : (Array.isArray(input) && input.length > 0 ? input[0] : "");
  // if (!inputText || inputText.trim().length === 0) {
  //   const zeroVec = new Array(dim).fill(0);
  //   return Array.isArray(input) ? new Array(input.length || 1).fill(zeroVec) : zeroVec;
  // }

  return ollamaNativeEmbedding(model, input);
}

async function objectLargeHandler(runtime: IAgentRuntime, params: any): Promise<any> {
  const prompt = (params.prompt as string) ?? "";
  const schema = params.schema;

  const schemaInstructions = schema
    ? `\n\nRespond ONLY with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}`
    : "\n\nRespond ONLY with valid JSON.";

  let rawText: string;

  try {
    const openaiModel = getOpenAIModel();
    rawText = await openAICompatChat(openaiModel, prompt + schemaInstructions);
    if (!rawText) throw new Error("Empty response");
  } catch (primaryErr) {
    logger.warn(`[Privora Fallback] OBJECT_LARGE: OpenAI-compat failed — ${(primaryErr as Error).message}. Falling back to native Ollama.`);
    const ollamaModel = getOllamaModel();
    rawText = await ollamaNativeChat(ollamaModel, prompt + schemaInstructions);
  }

  // Strip markdown fences if any
  const cleaned = rawText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  return JSON.parse(cleaned);
}

async function objectSmallHandler(runtime: IAgentRuntime, params: any): Promise<any> {
  const prompt = (params.prompt as string) ?? "";
  const schema = params.schema;

  const schemaInstructions = schema
    ? `\n\nRespond ONLY with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}`
    : "\n\nRespond ONLY with valid JSON.";

  let rawText: string;
  try {
    const openaiModel = getOpenAISmallModel();
    rawText = await openAICompatChat(openaiModel, prompt + schemaInstructions);
    if (!rawText) throw new Error("Empty response");
  } catch (primaryErr) {
    logger.warn(`[Privora Fallback] OBJECT_SMALL: OpenAI-compat failed — ${(primaryErr as Error).message}. Falling back.`);
    const ollamaModel = getOllamaSmallModel();
    rawText = await ollamaNativeChat(ollamaModel, prompt + schemaInstructions);
  }

  const cleaned = rawText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  return JSON.parse(cleaned);
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export const privoraFallbackPlugin: Plugin = {
  name: "privora-model-fallback",
  description: "Resilient model router: OpenAI-compat primary → Native Ollama fallback with 10-min timeout.",

  init: async (_config, runtime: IAgentRuntime) => {
    logger.info("[Privora Fallback] Registering resilient model handlers at priority 200...");

    // Register all model types with the fallback handler
    // Register all model types with the fallback handler
    const types = [
      ModelType.TEXT_LARGE,
      ModelType.TEXT_SMALL,
      ModelType.OBJECT_LARGE,
      ModelType.OBJECT_SMALL,
    ];

    for (const type of types) {
      const handler = type === ModelType.TEXT_LARGE ? textLargeHandler :
        (type === ModelType.TEXT_SMALL ? textSmallHandler :
          (type === ModelType.OBJECT_LARGE ? objectLargeHandler : objectSmallHandler));

      runtime.registerModel(
        type,
        handler as any,
        "privora-fallback",
        FALLBACK_PRIORITY
      );
    }

    // CONDITIONAL registration for TEXT_EMBEDDING
    const embedModel = process.env.OLLAMA_EMBEDDING_MODEL || process.env.OPENAI_EMBEDDING_MODEL;
    const embedDim = process.env.OLLAMA_EMBEDDING_DIMENSIONS || process.env.OPENAI_EMBEDDING_DIMENSIONS;

    if (embedModel && embedDim) {
      logger.info(`[Privora Fallback] Registering TEXT_EMBEDDING handler for model: ${embedModel} (dim: ${embedDim}) at priority ${FALLBACK_PRIORITY}`);
      runtime.registerModel(
        ModelType.TEXT_EMBEDDING,
        embeddingHandler as any,
        "privora-fallback",
        FALLBACK_PRIORITY
      );
    } else {
      logger.warn("[Privora Fallback] Skipping TEXT_EMBEDDING registration: *_EMBEDDING_MODEL or *_EMBEDDING_DIMENSIONS missing. System will operate in Basic Mode.");
    }

    logger.info(`[Privora Fallback] Registered model handlers at priority ${FALLBACK_PRIORITY}.`);
  },

  actions: [],
  providers: [],
  evaluators: [],
  services: [],
};

export default privoraFallbackPlugin;

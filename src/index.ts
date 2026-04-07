/**
 * Privora Rubric — Custom Plugin Entry Point
 *
 * Registers the multi-step CRAWL_POLICY_PAGE action which:
 *   1. Fetches + parses sitemap.xml to understand site structure.
 *   2. Checks robots.txt for allowed/disallowed paths.
 *   3. Scans homepage + common keyword paths for policy pages.
 *   4. Extracts and chunks policy text (≤500 tokens per chunk).
 *   5. Stores chunks as memories in the shared Privora knowledge room.
 *
 * All crawl logic is TypeScript-native — no external Python or raw Node
 * servers. Uses the ElizaOS runtime memory + model layer throughout.
 *
 * Branding: Deep Ocean Teal #0A3C42 · Electric Cyan #00E5D8 · Soft Emerald #00D4A5
 */

import {
  type Plugin,
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  type UUID,
  logger,
} from "@elizaos/core";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CrawlResult {
  url: string;
  type: PolicyType;
  rawText: string;
  chunks: string[];
  crawledAt: string;
  blocked: boolean;
  blockReason?: string;
}

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  priority?: number;
}

type PolicyType =
  | "terms"
  | "privacy"
  | "cookies"
  | "acceptable-use"
  | "conditions"
  | "unknown";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Keywords that identify a policy-related URL path or title */
const POLICY_KEYWORDS: Record<PolicyType, string[]> = {
  terms: ["terms", "tos", "terms-of-service", "terms-of-use", "termsofservice"],
  privacy: ["privacy", "privacy-policy", "datenschutz", "gdpr"],
  cookies: ["cookies", "cookie-policy", "cookiepolicy"],
  "acceptable-use": ["acceptable-use", "aup", "acceptable-usage"],
  conditions: ["conditions", "legal", "agreements"],
  unknown: [],
};

/** Common paths to probe when no sitemap is available */
const COMMON_POLICY_PATHS = [
  "/terms",
  "/terms-of-service",
  "/tos",
  "/terms-of-use",
  "/privacy",
  "/privacy-policy",
  "/cookies",
  "/cookie-policy",
  "/legal",
  "/acceptable-use",
  "/conditions",
];

/** Shared room ID where all Privora agents exchange knowledge */
const PRIVORA_KNOWLEDGE_ROOM = "privora-policy-knowledge" as UUID;

/** Maximum tokens per chunk (approx 4 chars per token) */
const MAX_CHUNK_CHARS = 2000; // ~500 tokens

// ─────────────────────────────────────────────────────────────────────────────
// Helper utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely fetch a URL with a timeout and proper User-Agent.
 * Returns null instead of throwing on network errors.
 */
async function safeFetch(
  url: string,
  timeoutMs = 8000
): Promise<{ ok: boolean; text: string; status: number }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Privora-PolicyBot/1.0 (+https://privora.ai/bot)",
        Accept: "text/html,application/xml,text/xml,*/*",
      },
    });

    clearTimeout(timer);
    const text = await res.text();
    return { ok: res.ok, text, status: res.status };
  } catch {
    return { ok: false, text: "", status: 0 };
  }
}

/**
 * Normalise a potentially relative URL against a base origin.
 */
function normaliseUrl(href: string, baseOrigin: string): string {
  try {
    if (href.startsWith("http://") || href.startsWith("https://")) {
      return href;
    }
    return new URL(href, baseOrigin).toString();
  } catch {
    return href;
  }
}

/**
 * Extract the origin (scheme + host) from a URL string.
 */
function getOrigin(url: string): string {
  try {
    const u = new URL(url);
    return u.origin; // e.g. "https://example.com"
  } catch {
    return url;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Sitemap parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse an XML sitemap (standard or index) and return all <loc> entries.
 * Handles both <sitemap> index entries and <url> leaf entries.
 */
function parseSitemapXml(xml: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];

  // Extract all <loc> values (works for both sitemap index and urlset)
  const locMatches = xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi);
  for (const match of locMatches) {
    const loc = match[1].trim();
    if (loc) entries.push({ loc });
  }

  return entries;
}

/**
 * Attempt to fetch the sitemap from standard locations.
 * Also parses sitemap URL declared in robots.txt.
 */
async function fetchSitemap(
  origin: string,
  robotsTxt: string
): Promise<SitemapEntry[]> {
  // Check if robots.txt declares a Sitemap: directive
  const robotsSitemapMatch = robotsTxt.match(/^Sitemap:\s*(.+)$/im);
  const robotsSitemapUrl = robotsSitemapMatch?.[1]?.trim();

  const candidates = [
    robotsSitemapUrl,
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`,
  ].filter(Boolean) as string[];

  for (const url of candidates) {
    const res = await safeFetch(url);
    if (res.ok && res.text.includes("<loc>")) {
      logger.info(`[Privora Crawler] ✅ Sitemap found: ${url}`);
      const entries = parseSitemapXml(res.text);

      // If this is a sitemap index, fetch one level of child sitemaps
      if (res.text.includes("<sitemapindex")) {
        const childEntries: SitemapEntry[] = [];
        // Limit to first 5 child sitemaps to avoid overloading
        for (const entry of entries.slice(0, 5)) {
          const childRes = await safeFetch(entry.loc);
          if (childRes.ok && childRes.text.includes("<loc>")) {
            childEntries.push(...parseSitemapXml(childRes.text));
          }
        }
        return childEntries;
      }

      return entries;
    }
  }

  logger.info(`[Privora Crawler] ℹ️ No sitemap found for ${origin}`);
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — robots.txt parsing
// ─────────────────────────────────────────────────────────────────────────────

interface RobotsResult {
  rawText: string;
  disallowed: string[];
  sitemapUrl?: string;
}

async function fetchRobotsTxt(origin: string): Promise<RobotsResult> {
  const url = `${origin}/robots.txt`;
  const res = await safeFetch(url);

  if (!res.ok || !res.text) {
    return { rawText: "", disallowed: [] };
  }

  const disallowed: string[] = [];
  let inOurAgent = false;
  let sitemapUrl: string | undefined;

  for (const line of res.text.split("\n")) {
    const trimmed = line.trim();

    if (/^User-agent:\s*(\*|Privora-PolicyBot)/i.test(trimmed)) {
      inOurAgent = true;
      continue;
    }
    if (/^User-agent:/i.test(trimmed)) {
      inOurAgent = false;
      continue;
    }
    if (inOurAgent && /^Disallow:/i.test(trimmed)) {
      const path = trimmed.replace(/^Disallow:\s*/i, "").trim();
      if (path) disallowed.push(path);
    }
    if (/^Sitemap:/i.test(trimmed)) {
      sitemapUrl = trimmed.replace(/^Sitemap:\s*/i, "").trim();
    }
  }

  return { rawText: res.text, disallowed, sitemapUrl };
}

/**
 * Returns true if the given path is blocked by robots.txt rules.
 */
function isBlocked(path: string, disallowed: string[]): boolean {
  for (const rule of disallowed) {
    if (rule === "/" || path.startsWith(rule)) {
      return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Policy page detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify a URL as a particular policy type by matching keyword patterns.
 */
function classifyPolicyUrl(url: string): PolicyType | null {
  const lowerUrl = url.toLowerCase();

  for (const [type, keywords] of Object.entries(POLICY_KEYWORDS) as [
    PolicyType,
    string[],
  ][]) {
    if (type === "unknown") continue;
    if (keywords.some((kw) => lowerUrl.includes(kw))) {
      return type;
    }
  }
  return null;
}

/**
 * Find policy-relevant URLs from a mix of sitemap entries and common paths.
 */
function findPolicyUrls(
  origin: string,
  sitemapEntries: SitemapEntry[],
  disallowed: string[]
): Array<{ url: string; type: PolicyType }> {
  const found: Array<{ url: string; type: PolicyType }> = [];
  const seen = new Set<string>();

  // First: scan sitemap for policy-looking URLs
  for (const entry of sitemapEntries) {
    const type = classifyPolicyUrl(entry.loc);
    if (!type) continue;

    try {
      const u = new URL(entry.loc);
      if (isBlocked(u.pathname, disallowed)) continue;
    } catch {
      continue;
    }

    if (!seen.has(entry.loc)) {
      seen.add(entry.loc);
      found.push({ url: entry.loc, type });
    }
  }

  // Second: probe common paths if we found nothing via sitemap
  if (found.length === 0) {
    for (const path of COMMON_POLICY_PATHS) {
      if (isBlocked(path, disallowed)) continue;
      const type = classifyPolicyUrl(path);
      if (!type) continue;
      const url = `${origin}${path}`;
      if (!seen.has(url)) {
        seen.add(url);
        found.push({ url, type });
      }
    }
  }

  return found;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — HTML text extraction + chunking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip HTML tags and clean whitespace from a page's HTML source.
 * Preserves newlines around block-level elements.
 */
function extractTextFromHtml(html: string): string {
  // Remove <script> and <style> blocks entirely
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "");

  // Insert newlines around block elements
  text = text.replace(
    /<\/?(p|div|h[1-6]|li|br|tr|section|article|header|footer)[^>]*>/gi,
    "\n"
  );

  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Collapse excessive whitespace / newlines
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

/**
 * Split text into chunks of at most MAX_CHUNK_CHARS characters,
 * breaking on paragraph boundaries where possible.
 */
function chunkText(text: string): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > MAX_CHUNK_CHARS) {
      if (current.trim()) chunks.push(current.trim());
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5 — Store chunks in ElizaOS memory
// ─────────────────────────────────────────────────────────────────────────────

async function storeChunksAsMemories(
  runtime: IAgentRuntime,
  result: CrawlResult,
  message: Memory
): Promise<void> {
  for (let i = 0; i < result.chunks.length; i++) {
    const chunk = result.chunks[i];
    await runtime.createMemory(
      {
        id: crypto.randomUUID() as UUID,
        agentId: runtime.agentId,
        entityId: message.entityId,
        roomId: PRIVORA_KNOWLEDGE_ROOM,
        content: {
          text: chunk,
          source: result.url,
          metadata: {
            policyType: result.type,
            chunkIndex: i,
            totalChunks: result.chunks.length,
            crawledAt: result.crawledAt,
            domain: getOrigin(result.url),
          },
        },
      },
      PRIVORA_KNOWLEDGE_ROOM
    );
  }

  logger.info(
    `[Privora Crawler] 💾 Stored ${result.chunks.length} chunks from ${result.url} in knowledge room.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CRAWL_POLICY_PAGE Action
// ─────────────────────────────────────────────────────────────────────────────

const crawlPolicyPageAction: Action = {
  name: "CRAWL_POLICY_PAGE",
  description:
    "Discover and extract policy documents (ToS, Privacy, Cookies, etc.) from any website URL. Follows sitemap → robots.txt → keyword-scan pipeline.",
  similes: [
    "FETCH_POLICY",
    "SCRAPE_POLICY",
    "FIND_TERMS",
    "GET_PRIVACY_POLICY",
    "DISCOVER_POLICIES",
    "SCAN_POLICIES",
  ],

  validate: async (
    _runtime: IAgentRuntime,
    message: Memory
  ): Promise<boolean> => {
    const text = message.content?.text ?? "";
    // Accept if message contains a URL or crawl-related intent
    return (
      /https?:\/\//i.test(text) ||
      /crawl|fetch|scrape|policy|terms|privacy|cookies/i.test(text)
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state: State | undefined,
    _options: Record<string, unknown> | undefined,
    callback?: HandlerCallback
  ): Promise<void> => {
    const text = message.content?.text ?? "";

    // ── Extract target URL ────────────────────────────────────────────────
    const urlMatch = text.match(/https?:\/\/[^\s]+/i);
    if (!urlMatch) {
      await callback?.({
        text: "❌ No URL found in request. Please provide a full URL (e.g. https://example.com).",
        actions: ["CRAWL_POLICY_PAGE"],
        source: "privora-crawler",
      });
      return;
    }

    const targetUrl = urlMatch[0].replace(/[.,;!?]$/, ""); // strip trailing punctuation
    const origin = getOrigin(targetUrl);

    logger.info(`[Privora Crawler] 🕷️ Starting crawl for: ${origin}`);

    await callback?.({
      text: `🔍 **Privora PolicyCrawler** initiated for \`${origin}\`\n\nStep 1: Fetching \`robots.txt\`…`,
      actions: ["CRAWL_POLICY_PAGE"],
      source: "privora-crawler",
    });

    // ── Step 1: robots.txt ────────────────────────────────────────────────
    const robots = await fetchRobotsTxt(origin);
    logger.info(
      `[Privora Crawler] robots.txt: ${robots.disallowed.length} disallow rules found.`
    );

    await callback?.({
      text: `✅ Step 1 complete — robots.txt parsed.\n- Disallow rules: **${robots.disallowed.length}**\n${robots.sitemapUrl ? `- Sitemap declared: \`${robots.sitemapUrl}\`` : "- No sitemap declared in robots.txt"}\n\nStep 2: Fetching sitemap…`,
      actions: ["CRAWL_POLICY_PAGE"],
      source: "privora-crawler",
    });

    // ── Step 2: Sitemap ───────────────────────────────────────────────────
    const sitemapEntries = await fetchSitemap(origin, robots.rawText);
    logger.info(
      `[Privora Crawler] Sitemap: ${sitemapEntries.length} entries found.`
    );

    await callback?.({
      text: `✅ Step 2 complete — sitemap parsed.\n- Sitemap entries: **${sitemapEntries.length}**\n\nStep 3: Scanning for policy URLs…`,
      actions: ["CRAWL_POLICY_PAGE"],
      source: "privora-crawler",
    });

    // ── Step 3: Detect policy URLs ────────────────────────────────────────
    const policyTargets = findPolicyUrls(
      origin,
      sitemapEntries,
      robots.disallowed
    );
    logger.info(
      `[Privora Crawler] Policy targets found: ${policyTargets.length}`
    );

    if (policyTargets.length === 0) {
      await callback?.({
        text: `ℹ️ Step 3 complete — no policy pages detected for \`${origin}\`.\n\nThis site may be blocking crawlers or uses non-standard policy paths.`,
        actions: ["CRAWL_POLICY_PAGE"],
        source: "privora-crawler",
      });
      return;
    }

    const policyList = policyTargets
      .map((p) => `- \`${p.url}\` (${p.type})`)
      .join("\n");

    await callback?.({
      text: `✅ Step 3 complete — **${policyTargets.length}** policy page(s) identified:\n${policyList}\n\nStep 4: Extracting and chunking policy text…`,
      actions: ["CRAWL_POLICY_PAGE"],
      source: "privora-crawler",
    });

    // ── Step 4: Fetch, extract, and chunk each policy page ────────────────
    const results: CrawlResult[] = [];

    for (const target of policyTargets) {
      // Re-check robots.txt block for this specific path
      let pathname = "";
      try {
        pathname = new URL(target.url).pathname;
      } catch {
        pathname = target.url;
      }

      if (isBlocked(pathname, robots.disallowed)) {
        results.push({
          url: target.url,
          type: target.type,
          rawText: "",
          chunks: [],
          crawledAt: new Date().toISOString(),
          blocked: true,
          blockReason: "robots.txt Disallow",
        });
        logger.info(
          `[Privora Crawler] 🚫 Blocked by robots.txt: ${target.url}`
        );
        continue;
      }

      const res = await safeFetch(target.url);
      if (!res.ok) {
        results.push({
          url: target.url,
          type: target.type,
          rawText: "",
          chunks: [],
          crawledAt: new Date().toISOString(),
          blocked: true,
          blockReason: `HTTP ${res.status}`,
        });
        continue;
      }

      const rawText = extractTextFromHtml(res.text);
      const chunks = chunkText(rawText);

      const result: CrawlResult = {
        url: target.url,
        type: target.type,
        rawText: rawText.slice(0, 500), // store only preview in result
        chunks,
        crawledAt: new Date().toISOString(),
        blocked: false,
      };

      results.push(result);

      // ── Step 5: Store chunks in ElizaOS memory ─────────────────────────
      await storeChunksAsMemories(runtime, result, message);
    }

    // ── Build summary response ────────────────────────────────────────────
    const summary = results
      .map((r) => {
        if (r.blocked) {
          return `- ❌ \`${r.url}\` — **blocked** (${r.blockReason ?? "unknown"})`;
        }
        return `- ✅ \`${r.url}\` — **${r.type}** · ${r.chunks.length} chunks stored`;
      })
      .join("\n");

    const totalChunks = results.reduce((n, r) => n + r.chunks.length, 0);

    const finalResponse = `🏁 **Crawl complete** for \`${origin}\`\n\n${summary}\n\n**Total chunks stored:** ${totalChunks}\n\nAll policy text is now available in the Privora knowledge room for analysis by \`PolicyAnalyzerAgent\`.`;

    await callback?.({
      text: finalResponse,
      actions: ["CRAWL_POLICY_PAGE"],
      source: "privora-crawler",
    });

    logger.info(
      `[Privora Crawler] 🏁 Crawl complete for ${origin}: ${totalChunks} chunks stored.`
    );
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: {
          text: "Crawl https://openai.com for their privacy policy and terms of service.",
        },
      },
      {
        name: "PolicyCrawlerAgent",
        content: {
          text: '🔍 **Privora PolicyCrawler** initiated for `https://openai.com`\n\nStep 1: Fetching `robots.txt`…',
          actions: ["CRAWL_POLICY_PAGE"],
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: { text: "Find all policy documents at https://github.com" },
      },
      {
        name: "PolicyCrawlerAgent",
        content: {
          text: "🔍 **Privora PolicyCrawler** initiated for `https://github.com`\n\nStep 1: Fetching `robots.txt`…",
          actions: ["CRAWL_POLICY_PAGE"],
        },
      },
    ],
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Privora Plugin Export
// ─────────────────────────────────────────────────────────────────────────────

export const privoraPlugin: Plugin = {
  name: "privora-policy-guardian",
  description:
    "Privora Rubric: autonomous policy discovery, extraction, and chunking for PolicyCrawlerAgent. Implements the CRAWL_POLICY_PAGE action with sitemap → robots.txt → keyword-scan pipeline.",
  actions: [crawlPolicyPageAction],
  providers: [],
  evaluators: [],
};

export default privoraPlugin;

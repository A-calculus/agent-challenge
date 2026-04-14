/**
 * Privora Rubric — Deep Policy Analysis Plugin
 * 
 * Provides CRAWL_PAGE_POLICY and SEARCH_POLICY_KNOWLEDGE actions.
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
  stringToUuid,
  ModelType,
  composePromptFromState,
} from "@elizaos/core";
import * as cheerio from "cheerio";
import * as https from "https";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CrawlResult {
  url: string;
  type: PolicyType;
  rawText: string;
  chunks: string[];
  crawledAt: string;
  blocked: boolean;
  blockReason?: string;
  success: boolean;
}

export interface SitemapEntry {
  loc: string;
  lastmod?: string;
  priority?: number;
}

export type PolicyType =
  | "terms"
  | "privacy"
  | "cookies"
  | "compliance"
  | "agreement"
  | "service"
  | "community-guidelines"
  | "data-protection"
  | "gdpr"
  | "ccpa"
  | "unknown";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const POLICY_KEYWORDS = [
  "terms", "tos", "policy", "compliance", "agreement", "service",
  "privacy", "cookie", "gdpr", "ccpa", "legal", "conditions",
  "acceptable-use", "community-guidelines", "data-protection", "disclaimer",
  "safety", "rules", "standards", "notice", "guidelines"
];

const MAX_CHUNK_CHARS = 2000;

// ─────────────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────────────

const SUMMARY_TEMPLATE = `
# Task: Summarize Policy Documents
Extracted policy clauses from {{domain}}:
{{context}}

# Instruction:
Analyze the extracted text and summarize it into exactly 5 key points that a regular user should know about this domain's policies.
Focus on:
1. Data collection/privacy
2. User responsibilities/limits
3. Third-party sharing
4. Account termination/rules
5. Governing law or unique industry-specific clauses

Format each point clearly with a bullet and a meaningful header.
Use Cyan (#00E5D8) headers for informational points and Amber (#FF9F1C) for warnings if any.
Example:
- <span style="color:#00E5D8">**Data Collection**</span>: We collect email and IP addresses for service improvement.
- <span style="color:#FF9F1C">**Warning: Third-Party Sharing**</span>: Data may be shared with partners for marketing.

Respond only with the 5 points.
`;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Utilities
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Tavily Direct Search (bypasses SDK TLS issues using Node's https module)
// ─────────────────────────────────────────────────────────────────────────────

interface TavilySearchResult {
  url: string;
  title: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  answer?: string;
  results: TavilySearchResult[];
}

async function tavilySearchDirect(query: string, domain: string, maxResults = 10): Promise<TavilyResponse> {
  const apiKey = process.env.TAVILY_API_KEY || "";
  if (!apiKey) throw new Error("TAVILY_API_KEY not set in environment");

  const body = JSON.stringify({
    query,
    max_results: maxResults,
    search_depth: "basic",
    include_answer: false,
    // Restrict results strictly to the target domain
    include_domains: [domain],
  });

  return new Promise<TavilyResponse>((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.tavily.com",
        path: "/search",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "Content-Length": Buffer.byteLength(body),
        },
        // Bypass TLS cert validation (ERR_TLS_CERT_ALTNAME_INVALID in some environments)
        rejectUnauthorized: false,
      } as any,
      (res) => {
        let data = "";
        res.on("data", (chunk: string) => { data += chunk; });
        res.on("end", () => {
          try {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`Tavily API error: HTTP ${res.statusCode} — ${data}`));
              return;
            }
            resolve(JSON.parse(data) as TavilyResponse);
          } catch (e) {
            reject(new Error(`Failed to parse Tavily response: ${String(e)}`));
          }
        });
      }
    );
    req.on("error", (err: Error) => reject(err));
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("Tavily request timed out after 15s"));
    });
    req.write(body);
    req.end();
  });
}


async function safeFetch(url: string, timeoutMs = 15000, maxRetries = 3): Promise<{ ok: boolean, text: string, status: number }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === "https:";
      const module = isHttps ? https : await import("http");

      const result = await new Promise<{ ok: boolean, text: string, status: number }>((resolve, reject) => {
        const req = (module as typeof https).request(
          {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: "GET",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
              "Cache-Control": "no-cache",
            },
            rejectUnauthorized: false,
          } as any,
          (res) => {
            let data = "";
            res.on("data", (chunk: string) => { data += chunk; });
            res.on("end", () => {
              const status = res.statusCode ?? 0;
              resolve({ ok: status >= 200 && status < 300, text: data, status });
            });
          }
        );
        req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error("timeout")); });
        req.on("error", (err: Error) => reject(err));
        req.end();
      });

      if (result.ok) return result;
      // Non-2xx: don't retry, just return the raw status
      return result;
    } catch (e) {
      // ignore, retry
    }
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 5000)));
    }
  }
  return { ok: false, text: "", status: 0 };
}

function getOrigin(urlStr: string): string {
  try { return new URL(urlStr).origin; } catch { return urlStr; }
}

function classifyPolicyUrl(url: string): PolicyType {
  const lowerUrl = url.toLowerCase();

  // Strictly ignore common non-HTML/non-page extensions
  const ignoredExtensions = [".xml", ".gz", ".json", ".zip", ".rss", ".atom", ".ashx", ".asmx"];
  if (ignoredExtensions.some(ext => lowerUrl.endsWith(ext) || lowerUrl.includes(ext + "?"))) {
    return "unknown";
  }

  for (const kw of POLICY_KEYWORDS) {
    if (lowerUrl.includes(kw)) {
      if (kw.includes("term")) return "terms";
      if (kw.includes("tos")) return "terms";
      if (kw.includes("priv")) return "privacy";
      if (kw.includes("cook")) return "cookies";
      if (kw.includes("gdpr")) return "gdpr";
      if (kw.includes("ccpa")) return "ccpa";
      if (kw.includes("compl")) return "compliance";
      if (kw.includes("agree")) return "agreement";
      if (kw.includes("serv")) return "service";
      if (kw.includes("commun")) return "community-guidelines";
      if (kw.includes("data")) return "data-protection";
      return kw as PolicyType; // fallback to the keyword itself
    }
  }
  return "unknown";
}

function parseSitemapXml(xml: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  const locMatches = xml.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi);
  for (const match of locMatches) {
    const loc = match[1].trim();
    if (loc) entries.push({ loc });
  }
  return entries;
}

async function fetchSitemapFallback(origin: string): Promise<SitemapEntry[]> {
  console.log(`[SitemapFetcher] Attempting primary sitemap at ${origin}/sitemap.xml`);
  // Primary
  let res = await safeFetch(`${origin}/sitemap.xml`);
  if (res.ok && res.text.includes("<loc>")) {
    const entries = parseSitemapXml(res.text);
    console.log(`[SitemapFetcher] Found ${entries.length} entries in primary sitemap.xml`);
    return entries;
  }

  // Fallback 1
  console.log(`[SitemapFetcher] Primary sitemap failed or empty. Trying sitemap_index.xml...`);
  res = await safeFetch(`${origin}/sitemap_index.xml`);
  if (res.ok && res.text.includes("<loc>")) {
    const entries = parseSitemapXml(res.text);
    console.log(`[SitemapFetcher] Found ${entries.length} entries in sitemap_index.xml`);
    return entries;
  }

  // Fallback 2
  console.log(`[SitemapFetcher] Trying robots.txt for sitemap directive...`);
  const robots = await safeFetch(`${origin}/robots.txt`);
  if (robots.ok) {
    const robotsSitemapMatch = robots.text.match(/^Sitemap:\s*(.+)$/im);
    if (robotsSitemapMatch && robotsSitemapMatch[1]) {
      const sitemapUrl = robotsSitemapMatch[1].trim();
      console.log(`[SitemapFetcher] Found sitemap URL in robots.txt: ${sitemapUrl}`);
      const fetchedViaRobot = await safeFetch(sitemapUrl);
      if (fetchedViaRobot.ok && fetchedViaRobot.text.includes("<loc>")) {
        const entries = parseSitemapXml(fetchedViaRobot.text);
        console.log(`[SitemapFetcher] Found ${entries.length} entries via robots.txt sitemap`);
        return entries;
      }
    }
  }

  // Fallback 3 => We handle this organically in the action
  return [];
}

async function trySitemapDiscovery(origin: string): Promise<string[]> {
  console.log(`[PolicyDiscovery] Level 1: Trying sitemap discovery for ${origin}...`);
  const entries = await fetchSitemapFallback(origin);
  const urls = entries.map(e => e.loc);

  // Filter for policy keywords using existing classifier
  const policyUrls = urls.filter(url => classifyPolicyUrl(url) !== "unknown");
  console.log(`[PolicyDiscovery] Level 1: Found ${policyUrls.length} policy URLs in sitemap`);
  return policyUrls;
}

async function tryCommonPatterns(origin: string): Promise<string[]> {
  console.log(`[PolicyDiscovery] Level 2: Trying common URL patterns for ${origin}...`);

  // Common policy page patterns
  const patterns = [
    // Terms of Service
    '/terms', '/tos', '/terms-of-service', '/terms-and-conditions',
    '/terms-of-use', '/legal/terms', '/en/terms', '/about/terms',

    // Privacy Policy
    '/privacy', '/privacy-policy', '/privacy-notice', '/legal/privacy',
    '/en/privacy', '/about/privacy', '/privacy-center',

    // Cookie Policy
    '/cookies', '/cookie-policy', '/cookie-notice', '/legal/cookies',

    // GDPR/CCPA
    '/gdpr', '/ccpa', '/privacy-rights', '/data-protection',
    '/your-privacy-choices', '/do-not-sell',

    // General Legal
    '/legal', '/legal/terms', '/compliance', '/acceptable-use',
    '/community-guidelines', '/user-agreement',

    // Localized versions
    '/en/legal', '/us/legal', '/en-us/privacy', '/en-gb/terms'
  ];

  const foundUrls: string[] = [];
  const CONCURRENCY = 20;

  for (let i = 0; i < patterns.length; i += CONCURRENCY) {
    const batch = patterns.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (pattern) => {
        const url = `${origin}${pattern}`;
        // HEAD request is faster for probing
        const res = await safeFetch(url, 3000, 2); // lower timeout/retries for probing
        if (res.ok) {
          console.log(`[PolicyDiscovery] ✓ Found: ${url}`);
          return url;
        }
        return null;
      })
    );

    results.forEach((r) => {
      if (r.status === 'fulfilled' && r.value) foundUrls.push(r.value);
    });
  }

  console.log(`[PolicyDiscovery] Level 2: Found ${foundUrls.length} URLs via common patterns`);
  return foundUrls;
}

async function tryFooterDiscovery(origin: string): Promise<string[]> {
  console.log(`[PolicyDiscovery] Level 3: Crawling homepage footer for ${origin}...`);

  const res = await safeFetch(origin);
  if (!res.ok) return [];

  const $ = cheerio.load(res.text);
  const foundUrls: string[] = [];

  // Target footer links
  const footerSelectors = [
    'footer a',
    '.footer a',
    '#footer a',
    '[role="contentinfo"] a',
    'nav[aria-label*="footer" i] a',
    'nav[aria-label*="legal" i] a'
  ];

  footerSelectors.forEach((selector) => {
    $(selector).each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().toLowerCase();

      // Use our existing classifier logic keywords
      const matchesKeyword = classifyPolicyUrl(href || "") !== "unknown" ||
        ["terms", "privacy", "cookie", "legal", "gdpr", "ccpa", "compliance", "policy", "agreement", "conditions"]
          .some(kw => text.includes(kw));

      if (matchesKeyword && href) {
        try {
          // Resolve relative URLs
          const absoluteUrl = href.startsWith('http')
            ? href
            : new URL(href, origin).toString();

          // Only same domain
          if (absoluteUrl.startsWith(origin)) {
            foundUrls.push(absoluteUrl);
          }
        } catch (e) {
          // ignore invalid URLs
        }
      }
    });
  });

  const uniqueUrls = [...new Set(foundUrls)];
  console.log(`[PolicyDiscovery] Level 3: Found ${uniqueUrls.length} URLs in footer`);
  return uniqueUrls;
}

/**
 * Extracts a URL or domain from the current text or recent conversation history.
 * Prioritizes the current message, then looks back through state.recentMessages.
 */
function extractTargetFromContext(text: string, state?: State): { url?: string, domain?: string } {
  console.log(`[ContextDiscovery] Analyzing text: "${text.substring(0, 50)}..."`);

  const urlRegex = /https?:\/\/[^\s]+/i;
  const domainRegex = /\b([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b/g;

  // 1. Try current text
  const urlMatch = text.match(urlRegex);
  if (urlMatch) {
    const found = urlMatch[0].replace(/[.,;!?]$/, "");
    // Ignore if it's the bot's own URL from lore/agent info
    if (!found.includes("privora.ai/bot")) {
      console.log(`[ContextDiscovery] Found URL in current text: ${found}`);
      return { url: found };
    }
  }

  const domainMatches = [...text.matchAll(domainRegex)];
  if (domainMatches.length > 0) {
    // Prefer the first one that isn't a known bot domain
    for (const match of domainMatches) {
      const d = match[0];
      if (d !== "privora.ai" || text.includes("crawl " + d)) {
        console.log(`[ContextDiscovery] Found domain in current text: ${d}`);
        return { domain: d };
      }
    }
  }

  // 2. Try history in state
  if (state?.recentMessages) {
    const history = state.recentMessages as string;
    console.log(`[ContextDiscovery] Searching history (${history.length} chars)...`);
    // Walk backwards through lines/messages in history
    const lines = history.split('\n').reverse();
    for (const line of lines) {
      if (line.trim().length === 0) continue;

      // SKIP lines that look like agent summaries or completions for PREVIOUS domains
      if (line.includes("Crawl complete") || line.includes("successfully fetched") || line.includes("Results:")) {
        continue;
      }

      const hUrlMatch = line.match(urlRegex);
      if (hUrlMatch) {
        const found = hUrlMatch[0].replace(/[.,;!?]$/, "");
        if (!found.includes("privora.ai/bot")) {
          console.log(`[ContextDiscovery] Found URL in history: ${found}`);
          return { url: found };
        }
      }

      const hDomainMatch = line.match(domainRegex);
      if (hDomainMatch) {
        const d = hDomainMatch[0];
        if (d !== "privora.ai") {
          console.log(`[ContextDiscovery] Found domain in history: ${d}`);
          return { domain: d };
        }
      }
    }
  }

  console.log(`[ContextDiscovery] ⚠️ No target found in text or history.`);
  return {};
}

function extractTextFromHtml(html: string): string {
  let mainContent = html;

  // Try to extract <main> or <article> if present
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) || html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (mainMatch) {
    mainContent = mainMatch[1];
  }

  // Remove elements we don't want
  let text = mainContent.replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "");

  // Convert tags to structure markers
  text = text.replace(/<\/?(p|div|br|tr|section|article|header|footer|li)[^>]*>/gi, "\n");
  text = text.replace(/<h([1-6])[^>]*>/gi, "\n# ");
  text = text.replace(/<\/h[1-6]>/gi, "\n");

  // Clean up all other html tags
  text = text.replace(/<[^>]+>/g, " ");

  // Unescape HTML entities
  text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");

  // Trim and collapse spaces
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

// Delegated chunking and saving to @elizaos/plugin-knowledge

async function performCrawlAndStore(
  runtime: IAgentRuntime,
  message: Memory,
  origin: string,
  policyTargets: { url: string, type: PolicyType }[]
): Promise<{ successful_fetches: number, failed_fetches: number, total_chunks: number }> {
  console.log(`[CrawlHelper] Fetching content from ${policyTargets.length} URLs in parallel...`);

  const results: CrawlResult[] = [];
  const CONCURRENCY_LIMIT = 10;

  for (let i = 0; i < policyTargets.length; i += CONCURRENCY_LIMIT) {
    const batch = policyTargets.slice(i, i + CONCURRENCY_LIMIT);
    console.log(`[CrawlHelper] Processing batch ${Math.floor(i / CONCURRENCY_LIMIT) + 1} of ${Math.ceil(policyTargets.length / CONCURRENCY_LIMIT)} (${batch.length} URLs)`);

    const promises = batch.map(async (target) => {
      console.log(`[CrawlHelper] Fetching content: ${target.url} [Type: ${target.type}]`);
      const res = await safeFetch(target.url);
      if (!res.ok) {
        console.error(`[CrawlHelper] ❌ Failed to fetch ${target.url} (Status: ${res.status})`);
        return { url: target.url, type: target.type, rawText: "", chunks: [], crawledAt: new Date().toISOString(), blocked: false, success: false };
      }

      const rawText = extractTextFromHtml(res.text);
      const MIN_TEXT_CHARS = 20; // Filter out JS-rendered SPAs (e.g. React/Next pages that return empty HTML shells)
      if (rawText.length < MIN_TEXT_CHARS) {
        console.warn(`[CrawlHelper] ⚠️ Skipping ${target.url} — only ${rawText.length} chars extracted (likely JS-rendered SPA, needs browser rendering)`);
        return { url: target.url, type: target.type, rawText: "", chunks: [], crawledAt: new Date().toISOString(), blocked: true, success: false };
      }
      console.log(`[CrawlHelper] ✅ Successfully fetched ${target.url} (${rawText.length} chars of text extracted)`);
      return {
        url: target.url,
        type: target.type,
        rawText: rawText,
        chunks: [],
        crawledAt: new Date().toISOString(),
        blocked: false,
        success: true
      };
    });

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
  }

  const successfulResults = results.filter(r => r.success);
  const failedCount = results.length - successfulResults.length;

  console.log(`[CrawlHelper] Step 5: Successfully fetched ${successfulResults.length}/${policyTargets.length} pages (${failedCount} failed)`);

  const knowledgeService = runtime.getService("knowledge" as string) as any;
  let totalChunks = 0;

  for (const result of successfulResults) {
    if (!knowledgeService || !knowledgeService.addKnowledge) {
      console.warn("KnowledgeService missing, skipping store for", result.url);
      continue;
    }
    try {
      // Use a per-URL unique ID to allow deduplication per document (not per domain)
      const docId = stringToUuid(result.url + "-" + runtime.agentId) as UUID;

      const kResult = await knowledgeService.addKnowledge({
        agentId: runtime.agentId,
        clientDocumentId: docId,
        content: result.rawText,
        contentType: 'text/plain',
        originalFilename: result.url,
        worldId: message.worldId || message.roomId,
        roomId: message.roomId,
        entityId: message.entityId || runtime.agentId,
        metadata: {
          domain: origin || "unknown",
          source: result.url || "unknown",
          policyType: result.type || "unknown",
          last_updated: result.crawledAt || Date.now()
        }
      });
      totalChunks += kResult?.fragmentCount || 1;
    } catch (e) {
      console.error("Failed to add knowledge:", e);
    }
  }

  return {
    successful_fetches: successfulResults.length,
    failed_fetches: failedCount,
    total_chunks: totalChunks
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// Action Chaining Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Imperatively invokes the next action in the pipeline.
 * Does NOT emit a callback message — this prevents SQL insert failures from rapid
 * multi-callback chains and avoids surfacing intermediate progress as chat messages.
 * Progress is written to the console only; the next action's own callback emits the
 * final user-visible result.
 */
async function chainNextAction(
  runtime: IAgentRuntime,
  message: Memory,
  state: State | undefined,
  nextActionName: string,
  progressText: string,
  callback: HandlerCallback | undefined
): Promise<void> {
  // Log to console for debugging — no callback() call here to avoid SQL insert failures
  console.log(`[ActionChain] ➡ Chaining to ${nextActionName}: ${progressText.substring(0, 80)}`);

  const nextAction = (runtime as any).actions?.find((a: Action) => a.name === nextActionName);
  if (!nextAction) {
    console.warn(`[ActionChain] ⚠️ Could not find registered action: ${nextActionName}`);
    // Only emit a callback when we actually need to surface an error to the user
    await callback?.({
      text: `⚠️ Auto-chain failed: action "${nextActionName}" is not registered.`,
    });
    return;
  }

  console.log(`[ActionChain] ➡ Chaining to ${nextActionName}...`);
  try {
    await nextAction.handler(runtime, message, state, {}, callback);
  } catch (e) {
    console.error(`[ActionChain] ❌ Error in chained action ${nextActionName}:`, e);
    await callback?.({
      text: `❌ Error during auto-chained action ${nextActionName}: ${String(e)}`,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CRAWL_PAGE_POLICY Action
// ─────────────────────────────────────────────────────────────────────────────

export const crawlPagePolicyAction: Action = {
  name: "CRAWL_PAGE_POLICY",
  description: "Fetch site map and deep crawl policy documents in parallel.",
  similes: ["FETCH_PAGE_POLICY", "DEEP_CRAWL_POLICIES"],
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = message.content?.text ?? "";
    const hasUrl = /https?:\/\//i.test(text) || /([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/.test(text);
    const hasKeywords = /crawl|fetch|scrape|policy|terms|privacy/i.test(text);
    return hasUrl || hasKeywords;
  },
  handler: async (runtime, message, state, _options, callback) => {
    console.log(`[CRAWL_PAGE_POLICY] Handler triggered by message: "${message.content?.text?.substring(0, 60)}..."`);
    const text = message.content?.text ?? "";
    const { url, domain } = extractTargetFromContext(text, state);
    console.log(`[CRAWL_PAGE_POLICY] Context extraction: url=${url}, domain=${domain}`);

    if (!url && !domain) {
      await callback?.({ text: "❌ No URL or domain found in the current message or history. Please provide a domain (e.g., example.com).", actions: ["CRAWL_PAGE_POLICY"] });
      return;
    }

    const rawTarget = url || domain!;
    const targetUrl = rawTarget.startsWith("http") ? rawTarget : `https://${rawTarget}`;
    const origin = getOrigin(targetUrl);

    console.log(`[CRAWL_PAGE_POLICY] Step 1: Fetching sitemap for ${origin}`);

    console.log(`[CRAWL_PAGE_POLICY] Step 1: Parallel Discovery for ${origin}`);

    const results = await Promise.allSettled([
      trySitemapDiscovery(origin),
      tryCommonPatterns(origin),
      tryFooterDiscovery(origin)
    ]);

    const discoveryUrls: string[] = [];
    results.forEach((result, index) => {
      const levels = ["Sitemap", "Patterns", "Footer"];
      if (result.status === "fulfilled") {
        console.log(`[CRAWL_PAGE_POLICY] Level ${index + 1} (${levels[index]}) succeeded with ${result.value.length} URLs`);
        discoveryUrls.push(...result.value);
      } else {
        console.warn(`[CRAWL_PAGE_POLICY] Level ${index + 1} (${levels[index]}) failed:`, result.reason);
      }
    });

    const uniqueUrls = [...new Set(discoveryUrls)];

    if (uniqueUrls.length === 0) {
      console.log(`[CRAWL_PAGE_POLICY] ❌ All 3 Discovery Levels returned 0 URLs or failed for ${origin}`);
      await chainNextAction(
        runtime, message, state,
        "SEARCH_POLICY_DISCOVERY",
        `⚠️ No policy pages found via sitemap/patterns for \`${origin}\`. ⚙️ Auto-chaining to deep web search...`,
        callback
      );
      return;
    }

    console.log(`[CRAWL_PAGE_POLICY] Step 2: Found ${uniqueUrls.length} unique candidate URLs from all successful levels`);

    // Deduplicate and filter to policy URLs
    const policyTargets: { url: string, type: PolicyType }[] = [];
    const seen = new Set<string>();

    for (const url of discoveryUrls) {
      const type = classifyPolicyUrl(url);
      if (type !== "unknown" && !seen.has(url)) {
        console.log(`[CRAWL_PAGE_POLICY] ✅ Accepted: ${url} (Calculated Type: ${type})`);
        seen.add(url);
        policyTargets.push({ url, type });
      }
    }

    console.log(`[CRAWL_PAGE_POLICY] Step 3: Filtered to ${policyTargets.length} valid policy-related URLs`);

    if (policyTargets.length === 0) {
      await chainNextAction(
        runtime, message, state,
        "SEARCH_POLICY_DISCOVERY",
        `⚠️ Links found but none classified as policy pages for \`${origin}\`. ⚙️ Auto-chaining to deep web search...`,
        callback
      );
      return;
    }

    console.log(`[CRAWL_PAGE_POLICY] Step 4: Delegating to crawl helper...`);

    const result = await performCrawlAndStore(runtime, message, origin, policyTargets);

    if (result.successful_fetches === 0) {
      await chainNextAction(
        runtime, message, state,
        "SEARCH_POLICY_DISCOVERY",
        `❌ Failed to fetch any content for \`${origin}\`. ⚙️ Auto-chaining to deep web search...`,
        callback
      );
      return;
    }

    const summaryData = {
      total_filtered: policyTargets.length,
      successful_fetches: result.successful_fetches,
      failed_fetches: result.failed_fetches,
      chunks_stored: result.total_chunks
    };

    // Notify the UI that crawl is done, then immediately chain to analysis
    await chainNextAction(
      runtime, message, state,
      "SEARCH_POLICY_KNOWLEDGE",
      `🏁 **Crawl complete** for \`${origin}\`\n\nResults: ${JSON.stringify(summaryData)}\n\n⚙️ Auto-chaining to policy analysis...`,
      callback
    );
  },
  examples: []
};

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH_POLICY_DISCOVERY Action
// ─────────────────────────────────────────────────────────────────────────────

export const searchPolicyDiscoveryAction: Action = {
  name: "SEARCH_POLICY_DISCOVERY",
  description: "Use web search to discover policy links when sitemaps are missing.",
  similes: ["DISCOVER_POLICIES", "WEB_SEARCH_POLICIES", "FIND_HIDDEN_POLICIES"],
  validate: async (_runtime, message) => {
    const text = message.content?.text ?? "";
    // Also accept when chained imperatively (original message is the user's domain/crawl request)
    return /discover|search|find|web|tavily|policy|crawl|terms|privacy/i.test(text)
      || /([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/.test(text);
  },
  handler: async (runtime, message, state, _options, callback) => {
    console.log(`[SEARCH_POLICY_DISCOVERY] Handler triggered by message: "${message.content?.text?.substring(0, 60)}..."`);
    const text = message.content?.text ?? "";
    const { url, domain } = extractTargetFromContext(text, state);
    console.log(`[SEARCH_POLICY_DISCOVERY] Context extraction: url=${url}, domain=${domain}`);

    if (!url && !domain) {
      await callback?.({
        text: "❌ No URL or domain found in the current message or history. [RECOMMENDATION]: Please provide a domain (e.g., example.com) and try <actions>SEARCH_POLICY_DISCOVERY</actions> again.",
        actions: ["SEARCH_POLICY_DISCOVERY"]
      });
      return;
    }

    const target = url || domain!;
    const origin = target.startsWith("http") ? target : `https://${target}`;
    const domainName = target.replace(/^https?:\/\//, "");

    console.log(`[SEARCH_POLICY_DISCOVERY] Step 1: Searching for ${domainName} policies via Tavily direct API...`);

    try {
      const searchQuery = `${domainName} privacy policy terms of service compliance agreement legal`;
      const searchResult = await tavilySearchDirect(searchQuery, domainName, 10);

      console.log(`[SEARCH_POLICY_DISCOVERY] raw search result URLs: ${JSON.stringify(searchResult.results?.map((r: any) => r.url), null, 2)}`);

      // Filter: Strict domain check + Keyword Filter
      const policyTargets: { url: string, type: PolicyType }[] = [];
      const seen = new Set<string>();

      if (searchResult.results) {
        for (const item of searchResult.results) {
          const url = item.url;
          if (!url.toLowerCase().includes(domainName.toLowerCase())) {
            console.log(`[SEARCH_POLICY_DISCOVERY] ⏭️ Domain mismatch skip: ${url}`);
            continue;
          }

          const type = classifyPolicyUrl(url);
          if (type !== "unknown" && !seen.has(url)) {
            console.log(`[SEARCH_POLICY_DISCOVERY] ✅ Policy Found: ${url} (Type: ${type})`);
            seen.add(url);
            policyTargets.push({ url, type });
          } else {
            console.log(`[SEARCH_POLICY_DISCOVERY] ⏭️ Keyword mismatch skip: ${url} (Detected type: ${type})`);
          }
        }
      }

      console.log(`[SEARCH_POLICY_DISCOVERY] Step 3: Validated ${policyTargets.length} local policy links`);

      if (policyTargets.length === 0) {
        await callback?.({
          text: `ℹ️ No policy links found for \`${domainName}\` via web search.`,
          actions: ["SEARCH_POLICY_DISCOVERY"]
        });
        return;
      }

      console.log(`[SEARCH_POLICY_DISCOVERY] Step 4: Chaining to crawl logic...`);
      const crawlRes = await performCrawlAndStore(runtime, message, origin, policyTargets);

      const summary = {
        tavily_summary: searchResult.answer || "Search successful.",
        validated_links: policyTargets.map(p => p.url),
        crawl_stats: {
          successful: crawlRes.successful_fetches,
          failed: crawlRes.failed_fetches,
          fragments: crawlRes.total_chunks
        }
      };

      // Notify the UI, then immediately chain to analysis
      await chainNextAction(
        runtime, message, state,
        "SEARCH_POLICY_KNOWLEDGE",
        `🏁 **Web Discovery complete** for \`${domainName}\`\n\nSummary: ${JSON.stringify(summary, null, 2)}\n\n⚙️ Auto-chaining to policy analysis...`,
        callback
      );

    } catch (e) {
      console.error("SEARCH_POLICY_DISCOVERY error:", e);
      await callback?.({ text: `❌ Web discovery failed: ${String(e)}`, actions: ["SEARCH_POLICY_DISCOVERY"] });
    }
  },
  examples: []
};

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH_POLICY_KNOWLEDGE Action (RAG)
// ─────────────────────────────────────────────────────────────────────────────

export const searchPolicyKnowledgeAction: Action = {
  name: "SEARCH_POLICY_KNOWLEDGE",
  description: "Search the Privora policy knowledge base for specific information.",
  similes: ["QUERY_POLICY", "FIND_POLICY_DETAILS", "CHECK_KNOWLEDGE"],
  validate: async (_runtime, message) => {
    const text = message.content?.text ?? "";
    // Accept: explicit policy questions, domain-only inputs (chained from crawl),
    // crawl/analyze keywords, or any message containing a domain pattern.
    return /what|how|why|does|sharing|data|legal|policy|privacy|crawl|terms|analyze|summary|discovery/i.test(text)
      || /([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/.test(text);
  },
  handler: async (runtime, message, state, _options, callback) => {
    const query = message.content?.text ?? "";
    const domainMatch = query.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
    const domainFilter = domainMatch ? domainMatch[1] : null;

    // Build a richer semantic query so vector similarity is meaningful
    const semanticQuery = domainFilter
      ? `policy terms privacy cookie legal compliance agreement ${domainFilter}`
      : query;

    console.log(`[SEARCH_POLICY_KNOWLEDGE] Querying knowledge for: "${query.substring(0, 50)}..." (Filter: ${domainFilter || "None"})`);
    console.log(`[SEARCH_POLICY_KNOWLEDGE] Semantic query: "${semanticQuery}"`);

    // Use the KnowledgeService's semantic vector search (searches 'knowledge' table)
    const knowledgeService = runtime.getService("knowledge" as string) as any;
    let fragments: any[] = [];

    if (knowledgeService?.getKnowledge) {
      try {
        // Build a synthetic message with our enriched query for embedding
        const queryMessage = {
          ...message,
          content: { ...message.content, text: semanticQuery }
        };
        const results = await knowledgeService.getKnowledge(queryMessage, {
          roomId: message.roomId,
          worldId: message.worldId || message.roomId,
        });
        fragments = results || [];
        console.log(`[SEARCH_POLICY_KNOWLEDGE] KnowledgeService returned ${fragments.length} fragments`);
      } catch (e) {
        console.error(`[SEARCH_POLICY_KNOWLEDGE] knowledgeService.getKnowledge failed:`, e);
      }
    }

    // Fallback: try searchMemories directly if service call failed or returned nothing
    if (fragments.length === 0) {
      console.log(`[SEARCH_POLICY_KNOWLEDGE] Falling back to runtime.searchMemories...`);
      try {
        const embedding = await runtime.useModel("TEXT_EMBEDDING" as any, { text: semanticQuery });
        const rawFragments = await (runtime as any).searchMemories?.({
          tableName: "knowledge",
          embedding,
          query: semanticQuery,
          count: 30,
          match_threshold: 0.1,
        });
        fragments = rawFragments || [];
        console.log(`[SEARCH_POLICY_KNOWLEDGE] searchMemories returned ${fragments.length} fragments`);
      } catch (e) {
        console.error(`[SEARCH_POLICY_KNOWLEDGE] runtime.searchMemories fallback failed:`, e);
      }
    }

    if (!fragments || fragments.length === 0) {
      await callback?.({
        text: "ℹ️ No policy documents found in the Privora knowledge base for this session. Please use `CRAWL_PAGE_POLICY` to ingest content first.",
        actions: ["CRAWL_PAGE_POLICY"]
      });
      return;
    }

    // Score fragments by domain relevance + keyword relevance
    const queryKeywords = query.toLowerCase().split(/\W+/).filter(kw => kw.length > 3);

    const scored = fragments.map((m: any) => {
      let score = (m.similarity || 0) * 10; // weight semantic similarity
      const text = (m.content?.text || "").toLowerCase();
      const metadata = m.metadata || {};

      // Domain match bonus
      if (domainFilter && (
        metadata.domain === domainFilter ||
        (metadata.source || "").toLowerCase().includes(domainFilter.toLowerCase()) ||
        text.includes(domainFilter.toLowerCase())
      )) {
        score += 10;
      }

      // Keyword match bonus
      queryKeywords.forEach((kw: string) => {
        if (text.includes(kw)) score += 1;
      });

      return { memory: m, score };
    })
      .filter((item: { memory: any; score: number }) => item.score > 0 || queryKeywords.length === 0)
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

    if (scored.length === 0) {
      await callback?.({
        text: "ℹ️ No highly relevant policy fragments found for your specific query. Try a broader search or confirm the domain has been crawled.",
        actions: ["SEARCH_POLICY_DISCOVERY"]
      });
      return;
    }

    // Aggregate and Format with Token Consideration
    // ─────────────────────────────────────────────────────────────────────────────
    // INTEGRATION AUDIT: Per-Action Context Slicing (Comment out to disable)
    // ─────────────────────────────────────────────────────────────────────────────
    const MAX_CONTEXT_CHARS = 6000; // ~1500 tokens buffer
    let context = "";
    const seenSources = new Set<string>();
    const sources: string[] = [];

    for (const item of scored) {
      const m = item.memory;
      const source = m.metadata?.source || m.metadata?.originalFilename || m.content?.source || "unknown";

      const entry = `\n[Document: ${source}]\n${m.content?.text || ""}\n`;

      if ((context.length + entry.length) > MAX_CONTEXT_CHARS) {
        context += "\n... [Remaining results truncated for token efficiency] ...";
        break;
      }

      context += entry;
      if (!seenSources.has(source)) {
        seenSources.add(source);
        sources.push(source);
      }
    }

    // Summarize using LLM
    const summaryPrompt = composePromptFromState({
      state: { ...state, domain: domainFilter, context } as any,
      template: SUMMARY_TEMPLATE
    });

    console.log(`[SEARCH_POLICY_KNOWLEDGE] Summarizing ${context.length} chars of context...`);
    const summary = await runtime.useModel(ModelType.TEXT_LARGE, {
      prompt: summaryPrompt,
    });

    const responseText = `🏁 📖 Privora Knowledge Retrieval\n\nI have extracted and summarized the policies for ${domainFilter || "the target domain"}:\n\n${summary.trim()}\n\n[RECOMMENDATION]: You may now proceed with safety analysis or ask specific questions about these clauses.`;

    await callback?.({
      text: responseText,
      actions: ["SEARCH_POLICY_KNOWLEDGE"]
    });
  },
  examples: []
};

// ─────────────────────────────────────────────────────────────────────────────
// Privora Plugin Export
// ─────────────────────────────────────────────────────────────────────────────

export const privoraPlugin: Plugin = {
  name: "privora-policy-guardian",
  description: "Advanced policy crawling and knowledge retrieval for privacy safety.",
  actions: [crawlPagePolicyAction, searchPolicyDiscoveryAction, searchPolicyKnowledgeAction],
  providers: [],
  evaluators: [],
  services: [],
};

export default privoraPlugin;

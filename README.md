# Your Privora Rubric: Autonomous Privacy Policy Guardian

Your Privora Rubric is an advanced autonomous agent system designed to serve as a decentralized guardian for the open web. It specializes in the discovery, extraction, and intelligent analysis of website policies, including Terms of Service (ToS), Privacy Policies, and Cookie Policies.

Powered by the orchestration engine of **ElizaOS** and running inference through **Nosana**, the system acts as a protective layer between internet users and the sites they visit, transforming dense, obfuscated legal jargon into actionable, human-readable insights.

## 🛡️ The Concept

In an era of increasingly complex digital agreements, internet users are suffering from "consent fatigue." They blindly click "Accept" because reading 50 pages of legalese per website is impossible.

Your Privora Rubric provides a proactive "privacy shield." Driven by the specialized `PolicyCrawlerAgent`, it doesn't just surface links—it reads, understands, chunks, and summarizes them to ensure users know exactly what they are agreeing to over their data rights.

## 🏆 Standout Features

### 1. The Autonomous Discovery Pipeline
Most agents rely entirely on an LLM "guessing" the right tool to use. Our crawler utilizes a multi-tiered, deterministic fallback sequence:
- **Level 1: Sitemap & Robots.txt Compliance**: Politely parses `sitemap.xml`, `sitemap_index.xml`, and `robots.txt` to discover policy documents natively.
- **Level 2: Common Pattern Probing**: Checks a matrix of 20+ common policy URLs (e.g., `/legal`, `/privacy-notice`, `/en-gb/terms`) via lightweight `HEAD` requests.
- **Level 3: Footer Crawling**: Parses the DOM of the target's homepage using `cheerio` to extract legal links embedded in the site's footer navigational structures.

### 2. Deep Web Discovery & Orchestration Fallback
When a website is highly obfuscated or entirely headless, the agent falls back to integrated deep web search via **Tavily AI**. We restrict queries specifically to the target domain (`include_domains`), preventing hallucinated or off-domain results from corrupting the Knowledge Service.

### 3. Intelligent 5-Point Summarization
Instead of dumping raw vector-database chunks (which include scripts, HTML remnants, and legal boilerplate) into the chat, the agent uses a Large Language Model to perform a final summarization pass. The extracted text is distilled into 5 critical pillars:
1. **Data Collection & Privacy**
2. **User Responsibilities & Limits**
3. **Third-Party Data Sharing**
4. **Account Termination & Usage Rules**
5. **Governing Law & Industry-Specific Clauses**

### 4. Zero Raw PII Storage
The agent follows strict decentralized privacy tenets. It operates with zero raw personal data storage. Only the chunked policy text from public domains reaches the `Plugin-Knowledge` vector database.

### 5. Premium, Glassmorphism UI
The standalone React frontend departs from standard, boring chat interfaces. It leverages dynamic background elements (orbs, scanlines), a tailored Teal/Cyan/Amber color-grading system for alerts, and real-time step tracking so users can watch the autonomous sequence unfold.

## 🛠️ Implementation & "The Angle"

Historically, AI agents have been "reactive"—waiting for a user prompt, generating an action, waiting for a tool response, and prompting again. This causes massive latency and high failure rates if the LLM hallucinates a tool call.

Your Privora Rubric pioneers **Imperative Action Chaining**. Instead of the agent "deciding" what to do next based on an LLM's whim, we built a deterministic pipeline directly into the plugin layer. 
The execution flows autonomously:
1. **Discover** (`CRAWL_PAGE_POLICY`) -> Automatically chains to...
2. **Search** (`SEARCH_POLICY_DISCOVERY`) -> Automatically chains to...
3. **Index** (Data ingestion via `KnowledgeService`) -> Automatically chains to...
4. **Analyze** (`SEARCH_POLICY_KNOWLEDGE` multi-point summarization).

This hybrid approach—combining deterministic code for operations and LLMs strictly for analysis—makes the agent feel truly autonomous and significantly more reliable than standard LLM tool-calling loops.

## 🧩 Key Problems & Resolutions

Building an autonomous agent capable of surviving the chaotic reality of the open web required solving several major architectural blockers:

### 1. The `Object.entries` Core Runtime Crash
*   **The Issue**: During development, we encountered a widespread issue in the ElizaOS core `bootstrap` plugins where the runtime would attempt to serialize memory arrays using `Object.entries(metadata)`. If the metadata was null (often the case with prematurely ingested web data), the entire agent would crash fatally.
*   **The Resolution**: We implemented strict, defensive metadata guards within the `privora-policy-guardian` action handlers. Every data ingestion point now guarantees a fully hydrated and initialized metadata structure.

### 2. Tavily TLS Certificate Validation (`ERR_TLS_CERT_ALTNAME_INVALID`)
*   **The Issue**: The standard Tavily SDK and Node's native `fetch` module encountered fatal TLS errors when attempting to reach `api.tavily.com`. Because of the strict proxy environments and corporate firewalls sometimes run by node operators, the default certificate validation was consistently rejecting the connection.
*   **The Resolution**: We abandoned the rigid SDK and built the custom `tavilySearchDirect` function. By leveraging Node's native `https` module and configuring it with `rejectUnauthorized: false`, we ensured the agent could consistently perform web discovery even in challenging TLS environments.

### 3. SPA/JS-Rendered Empty Extractions ("0 Chars" Bug)
*   **The Issue**: Modern Single Page Applications (SPAs)—like React or Next.js sites (e.g., `grok.com`)—often return a near-empty HTML shell containing only `<script>` tags on the initial GET request. The crawler would succeed with an HTTP 200, extract 0 characters of text, and then crash the vector database when attempting to embed empty strings.
*   **The Resolution**: We introduced a strict content-length validation layer (`MIN_TEXT_CHARS = 100`). The agent now understands the difference between a successful HTTP response and a successful content extraction. Sites identified as empty JS shells are skipped entirely, preserving the integrity of the Knowledge Service.

### 4. Frontend UI State Desynchronization
*   **The Issue**: The real-time React UI would occasionally jump back to the "Search" landing page before the agent had finished generating the final LLM summary. This was due to race conditions in the WebSocket message stream causing `isCrawling` state to toggle off prematurely.
*   **The Resolution**: We decoupled the UI state from raw WebSocket events. We introduced strict, visual completion markers (`🏁`) into the plugins. The React frontend now passively reads the conversation stream and only transitions states when it detects these deterministic conclusion signals, ensuring the user always sees the final 5-point report.

## 🚦 Getting Started

1. Set your `TAVILY_API_KEY` and LLM parameters.
2. Boot the agent and frontend (`pnpm run dev`).
3. Enter any domain (e.g., `learn.nosana.com`) to begin the autonomous privacy discovery sequence.

## Who This Is For (Value & Outcomes)

Privora is built for anyone who needs to understand what a website’s legal and privacy policies actually mean in practice, without reading dozens of pages of dense legal text:

- **Everyday users and power users** who want to understand “what am I really agreeing to?” before signing up, purchasing, or accepting cookies.
- **Security and privacy reviewers** who need a quick, structured view of how a product treats data, shares with third parties, and handles account lifecycle.
- **Researchers, auditors, and policy analysts** who compare how different organizations describe consent, retention, and compliance across many domains.
- **Builders and integrators** who want to embed a clear, explainable view of policies into their own products or workflows.

The outcome is always the same: given a domain, the system discovers its public policy documents, ingests them into a structured knowledge layer, and returns an **opinionated, 5-pillar summary** plus follow‑up Q&A grounded in those ingested texts—not hallucinated guesses.

## Core Use Cases & Workflows

- **One‑shot domain review**
  - Input: `example.com`.
  - Flow: The agent discovers policy URLs, crawls them, stores the text as knowledge, then generates a **5‑point report** covering:
    - Data collection & privacy
    - User responsibilities & limits
    - Third‑party sharing
    - Account termination & usage rules
    - Governing law / industry‑specific clauses
  - Output: A concise but rich summary plus clear warnings or neutral information using the color semantics encoded in the summarization template.

- **Interactive policy Q&A**
  - After a successful crawl, the React UI exposes a chat interface backed by the `SEARCH_POLICY_KNOWLEDGE` action.
  - You can ask questions like “Do they sell my data?”, “How long do they keep logs?”, or “What happens if I close my account?”.
  - Answers are composed from the **stored policy fragments** retrieved via the knowledge service and scored for relevance before the LLM summarizes them.

- **Operational / deployment‑level use**
  - Run locally during product reviews or security audits using the ElizaOS dev server plus Vite client.
  - Package as a containerized agent and run it as a long‑lived backend, reachable via REST and WebSocket, as suggested by the job definitions and Docker setup.
  - Integrate into internal tooling where teams paste in domains and keep a shared knowledge base of policy snapshots over time.

## Technical Implementation Framework

Privora is implemented as an **ElizaOS multi‑agent project** with a focused, single primary agent: `PolicyCrawlerAgent`. The architecture is intentionally split into:

- a deterministic backend plugin pipeline,
- a resilient model‑routing layer, and
- a dedicated, premium frontend for streaming, step‑tracked UX.

### ElizaOS Project & Agent Wiring

- **Entry point**: [`src/index.ts`](/home/gvnaap/Documents/agent/agent-challenge/src/index.ts)
  - Patches `Object.entries` defensively to avoid crashes when metadata is `null` or `undefined`.
  - Loads both JSON characters (if present) and TypeScript characters from `src/characters`.
  - Deduplicates by `character.name` and turns each character into a `ProjectAgent`.
  - Attaches external plugins by string (`@elizaos/plugin-sql`, `@elizaos/plugin-bootstrap`, `@elizaos/plugin-knowledge`, `@elizaos/plugin-ollama`, `@elizaos/plugin-web-search`).
  - Attaches **local plugins** as objects on each agent: first `privoraFallbackPlugin`, then `privoraPlugin`.
  - Enforces port availability via `SERVER_PORT` so the agent fails fast if the port is already in use.

- **Character**: [`src/characters/policyCrawler.ts`](/home/gvnaap/Documents/agent/agent-challenge/src/characters/policyCrawler.ts)
  - Declares the `PolicyCrawlerAgent` persona, with a strong system prompt describing:
    - mandatory **procedural hierarchy** (crawl → discovery → knowledge),
    - privacy‑first behavior (no raw PII storage, robots.txt awareness),
    - formatting expectations for summaries (Teal, Cyan, Amber semantics).
  - Encodes a strict rule: all actions must be called using `<actions>CRAWL_PAGE_POLICY</actions>`‑style tags.

### Policy Plugin: Discovery, Crawl, and RAG

- **Core plugin**: [`src/plugin.ts`](/home/gvnaap/Documents/agent/agent-challenge/src/plugin.ts)
  - Exposes the `privora-policy-guardian` plugin with three key actions:
    - `CRAWL_PAGE_POLICY` – sitemap + pattern + footer discovery followed by fetch + ingestion.
    - `SEARCH_POLICY_DISCOVERY` – Tavily‑backed deep web discovery, domain‑scoped, then ingestion.
    - `SEARCH_POLICY_KNOWLEDGE` – retrieval and summarization into the 5‑pillar report.

- **Deterministic discovery pipeline**
  - Uses helper functions such as:
    - `trySitemapDiscovery(origin)` – parses `sitemap.xml`, `sitemap_index.xml`, and sitemap links inside `robots.txt`.
    - `tryCommonPatterns(origin)` – probes common legal and policy paths (`/privacy`, `/terms`, `/legal`, `/cookies`, `gdpr`, `ccpa`, etc.).
    - `tryFooterDiscovery(origin)` – uses `cheerio` to parse footer navigation links and resolve relative URLs on the homepage.
  - `classifyPolicyUrl(url)` uses policy‑related keywords and ignores non‑HTML extensions, so only realistic policy pages are kept.

- **Crawl and ingest**
  - `performCrawlAndStore(...)` fetches all candidate policy pages in parallel, extracts main text with a custom HTML‑to‑text routine, filters out near‑empty shells (e.g., JS‑rendered SPAs), and then calls the ElizaOS knowledge service:
    - Each document gets a stable `clientDocumentId` derived from URL and agent ID for deduplication.
    - Metadata captures `domain`, `source`, `policyType`, and timestamps for later filtering and analysis.

- **Knowledge search and summarization**
  - `SEARCH_POLICY_KNOWLEDGE` builds a semantic query seeded with policy vocabulary and optional domain.
  - It queries the knowledge service or falls back to `searchMemories` over the `knowledge` table using embeddings.
  - Fragments are scored by:
    - vector similarity,
    - domain/source matches, and
    - keyword overlap with the user’s question.
  - A bounded context window (approx. 6000 characters) is assembled, then fed into the `SUMMARY_TEMPLATE` and passed to `ModelType.TEXT_LARGE` via `runtime.useModel`.
  - The final answer is marked with a deterministic header (`Privora Knowledge Retrieval`) and returns exactly five bullet points.

### Model Fallback & Resilience

- **Model routing plugin**: [`src/fallbackPlugin.ts`](/home/gvnaap/Documents/agent/agent-challenge/src/fallbackPlugin.ts)
  - Registers handlers at priority `200` for:
    - `TEXT_LARGE`, `TEXT_SMALL`,
    - `OBJECT_LARGE`, `OBJECT_SMALL`,
    - and conditionally `TEXT_EMBEDDING`.
  - Each handler:
    - First attempts an **OpenAI‑compatible** `/chat/completions` endpoint using models from environment variables.
    - On any failure (HTTP errors, timeouts, empty responses), it falls back to **native Ollama** (`/api/chat`, `/api/embed`, or `/api/embeddings`) with generous timeouts for large models.
  - This ensures the policy pipeline keeps working across environments where different backends (Nosana, local Ollama, other OpenAI‑compatible hosts) are available.

### Frontend & Transport

- **Vite client configuration**: [`vite.config.ts`](/home/gvnaap/Documents/agent/agent-challenge/vite.config.ts)
  - Uses `src/frontend` as the project root.
  - Proxies `/api` requests to the ElizaOS server at `SERVER_PORT`, aligning frontend and agent runtime.

- **React UI**: [`src/frontend/App.tsx`](/home/gvnaap/Documents/agent/agent-challenge/src/frontend/App.tsx)
  - On load, it:
    - fetches `/api/agents` to discover the `PolicyCrawlerAgent` ID,
    - requests a DM channel via `/api/messaging/dm-channel?currentUserId=...&targetUserId=...`,
    - then connects to Socket.IO with a persistent `entityId` from `localStorage`.
  - Messages are sent as:
    - a hidden discovery trigger (`@PolicyCrawlerAgent Crawl <domain> for policy documents.`) for the autonomous flow,
    - and visible user questions for interactive Q&A.
  - Incoming messages are streamed via `messageStreamChunk` and `messageBroadcast` events, merged into assistant messages, and used to drive UI state transitions.

## Originality & Design Choices

Privora is not just “another chat UI on top of a model.” Several design decisions make it distinct:

- **Imperative action chaining instead of tool roulette**
  - The system does not rely on the LLM to decide which tool to call next.
  - Instead, the plugin code uses `chainNextAction(...)` to drive the sequence:
    - `CRAWL_PAGE_POLICY` → `SEARCH_POLICY_DISCOVERY` (if needed) → `SEARCH_POLICY_KNOWLEDGE`.
  - This significantly reduces failure modes caused by hallucinated tools or incorrect call ordering, and makes behavior repeatable.

- **Deterministic discovery first, search second**
  - The pipeline always tries **sitemaps, common patterns, and footer links** before invoking deep web search.
  - Only when native discovery fails does it invoke Tavily, with results constrained by `include_domains` and further URL checks.

- **Domain‑scoped, RAG‑backed analysis**
  - All ingestion is **domain‑scoped** and tagged, so retrieval is tightly focused on the target site’s own policies.
  - The LLM operates over curated, ranked fragments stored in the knowledge layer, not arbitrary web content.

- **Hybrid “code‑for‑operations, LLM‑for‑analysis” pattern**
  - Networking, parsing, classification, and storage are written as explicit TypeScript logic.
  - The LLM is reserved for:
    - aligning multiple fragments,
    - resolving conflicts,
    - and presenting the result as clear, 5‑point guidance.

Together, these choices aim to make the agent **predictable**, **auditable**, and **fit for repeated, high‑stakes use** in privacy and compliance contexts.

## UI & Experience Details

The frontend is built to feel like a dedicated privacy sentinel rather than a generic chatbot:

- **Visual language**
  - Glassmorphism cards, subtle blur, and layered gradients create a “control room” feel.
  - Teal, Cyan, and Amber color accents mirror the semantics in the summarization template:
    - Teal for safe/positive findings.
    - Cyan for neutral/informational points.
    - Amber for warnings and risk‑oriented clauses.
  - Background “orbs” and scanline elements reinforce a sense of active monitoring without overwhelming the content.

- **Step‑based autonomous sequence**
  - A 5‑step tracker (“Verifying domain”, “Checking sitemap”, “Discovering policy pages”, “Aggregating knowledge”, “Generating summary”) mirrors the backend pipeline.
  - Steps update based on:
    - a gentle simulation timer while work is ongoing, and
    - **deterministic textual markers** emitted by the backend (for example, `🏁 **Crawl complete**`, `🏁 **Web Discovery complete**`, `Privora Knowledge Retrieval`).
  - This keeps the user informed about progress without exposing internal implementation noise.

- **Hidden vs visible messages**
  - The initial crawl command is sent as a **hidden DM** to the agent so that the user’s chat transcript stays focused on explanations and summaries.
  - Low‑level chaining messages and tool orchestration logs are filtered out by the frontend’s `isHiddenMessage` logic.
  - Only high‑signal, human‑readable outputs appear in the chat window.

- **Session identity & reset**
  - Each browser instance gets a stable `entityId` stored in `localStorage`, which is passed as auth metadata for Socket.IO.
  - A “Reset Session” control clears the local identifiers and forces a clean reconnection path, ensuring you can start fresh with a new DM channel and history.

## Configuration & Environment

Privora relies on a small set of environment variables to connect to models, search providers, and ports:

- **Server & client**
  - `SERVER_PORT` – ElizaOS backend port (defaults to `3000` and is enforced by `src/index.ts`).
  - `CLIENT_PORT` – Vite dev server port (defaults to `5173` in `vite.config.ts`).

- **Web search**
  - `TAVILY_API_KEY` – API key used by the custom `tavilySearchDirect` function to perform deep web policy discovery.

- **OpenAI‑compatible models**
  - `OPENAI_BASE_URL` – base URL for the OpenAI‑compatible `/chat/completions` endpoint.
  - `OPENAI_API_KEY` – API key passed as the `Authorization` bearer token.
  - `OPENAI_LARGE_MODEL`, `OPENAI_SMALL_MODEL` – model names for large/small text generations.
  - `OPENAI_EMBEDDING_MODEL`, `OPENAI_EMBEDDING_DIMENSIONS` – used for embeddings when configured.

- **Ollama models**
  - `OLLAMA_API_ENDPOINT` – native Ollama endpoint, defaulting to `http://localhost:11434/api` if unspecified.
  - `OLLAMA_LARGE_MODEL`, `OLLAMA_SMALL_MODEL` – model names for large/small text generations via Ollama.
  - `OLLAMA_EMBEDDING_MODEL`, `OLLAMA_EMBEDDING_DIMENSIONS` – used by the native embedding helper when OpenAI‑compatible embeddings are not desired.

These values control which backends the fallback plugin uses and whether embedding support is enabled. They also flow into the `PolicyCrawlerAgent` character settings so that the runtime and persona agree on which models are available.

---
*Built with precision for the Privora Network.*

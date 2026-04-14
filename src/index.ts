/**
 * Privora Rubric — Project Entry Point
 * 
 * This file serves as the main loader for all custom agents.
 * 
 * The ElizaOS CLI (via `elizaos start` or `elizaos dev`) uses this file
 * to identify the project and register each agent.
 */

import {
  type Character,
  type ProjectAgent,
  logger,
} from "@elizaos/core";

// ── Runtime Patch ────────────────────────────────────────────────────────────
// Fixes 'Object.entries requires that input parameter not be null or undefined'
// widespread in ElizaOS v1.7.2 when dealing with null metadata/settings.
const originalEntries = Object.entries;
(Object as any).entries = function (obj: any) {
  if (obj === null || obj === undefined) return [];
  return originalEntries(obj);
};
// ─────────────────────────────────────────────────────────────────────────────

import net from "net";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// ── Imports ──────────────────────────────────────────────────────────────────

import { privoraPlugin } from "./plugin.js";
import { privoraFallbackPlugin } from "./fallbackPlugin.js";
import { startExtensionServer } from "./extensionServer.js";

// TS character definitions
import { allTsCharacters } from "./characters/index.js";

// ── Multi-Agent Registration Logic ───────────────────────────────────────────

/**
 * Searches the 'characters/' directory for .character.json files.
 * Pulls model and secrets from environment variables.
 */
function loadJsonCharacters(): Character[] {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const charactersDir = path.resolve(__dirname, "../characters");

  if (!fs.existsSync(charactersDir)) {
    logger.warn("[Privora Loader] characters/ directory not found — skipping JSON characters.");
    return [];
  }

  const files = fs.readdirSync(charactersDir);
  const jsonCharacters: Character[] = [];

  for (const file of files) {
    if (file.endsWith(".character.json")) {
      try {
        const filePath = path.join(charactersDir, file);
        const content = fs.readFileSync(filePath, "utf-8");

        // Dynamic variable resolution (for secrets/model in JSON)
        const resolvedContent = content.replace(/\$\{([^}]+)\}/g, (_, key) => process.env[key] || "");
        const character = JSON.parse(resolvedContent) as Character;

        logger.info(`[Privora Loader] ✅ Loaded JSON character: ${character.name} (${file})`);
        jsonCharacters.push(character);
      } catch (err) {
        logger.error(`[Privora Loader] ❌ Failed to load JSON character ${file}: ${String(err)}`);
      }
    }
  }

  return jsonCharacters;
}

/**
 * Consolidates all JSON and TypeScript characters into ProjectAgents.
 */
function getProjectAgents(): ProjectAgent[] {
  const jsonChars = loadJsonCharacters();
  const tsChars = allTsCharacters;

  // Combine and deduplicate by name
  const allCharacters = [...jsonChars, ...tsChars];
  const uniqueCharacters: Character[] = [];
  const seenNames = new Set<string>();

  for (const char of allCharacters) {
    if (!seenNames.has(char.name)) {
      seenNames.add(char.name);
      uniqueCharacters.push(char);
    } else {
      logger.warn(`[Privora Loader] ⚠️ Skipping duplicate agent name: ${char.name}`);
    }
  }

  return uniqueCharacters.map((character) => {
    // 1. External plugins (resolved via CLI/Registry) go into Character.plugins as strings
    character.plugins = [
      "@elizaos/plugin-sql",
      "@elizaos/plugin-bootstrap",
      "@elizaos/plugin-knowledge",
      "@elizaos/plugin-ollama",
      "@elizaos/plugin-web-search",
    ];

    return {
      name: character.name,
      character: character,
      // 2. Local plugin objects go here — fallback plugin must be FIRST
      //    so it is registered at priority 200 before plugin-openai claims
      //    the model slots at priority 100.
      plugins: [privoraFallbackPlugin, privoraPlugin],
      // 3. Enable the Direct Client for REST/WebSocket messaging
      clients: ["direct"],
    };
  });
}

// ── Port Enforcement ────────────────────────────────────────────────────────
const SERVER_PORT = parseInt(process.env.SERVER_PORT || "3000", 10);
const EXTENSION_BUILDER_PORT = parseInt(process.env.EXTENSION_BUILDER_PORT || "3010", 10);

/**
 * Ensures the configured SERVER_PORT is available.
 * Fails fast to prevent silent port shifting by the CLI.
 */
function verifyPort(port: number): Promise<void> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        logger.error(`[Privora Sentinel] ❌ CRITICAL: Port ${port} is already in use.`);
        logger.error(`[Privora Sentinel] ➜ Please free up the port or check your .env (SERVER_PORT).`);
        process.exit(1);
      }
    });
    server.once("listening", () => {
      server.close();
      resolve();
    });
    server.listen(port);
  });
}

// Pre-verify port availability before exporting the project
await verifyPort(SERVER_PORT);
// Start extension builder/download server (separate port)
startExtensionServer({
  port: EXTENSION_BUILDER_PORT,
  baseUrl: `http://localhost:${EXTENSION_BUILDER_PORT}`,
});

// ── Project Instance ────────────────────────────────────────────────────────

const privoraProject = {
  agents: getProjectAgents()
};

/**
 * DEFAULT EXPORT: The Project object defines the multi-agent system.
 * This is the ONLY default export to ensure CLI correctly identifies as a 'project'.
 */
export default privoraProject;

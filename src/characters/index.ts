/**
 * Privora Rubric — Character Registry (TypeScript)
 *
 * Auto-barrel for all TypeScript character definitions.
 * Add a new character file to src/characters/ and re-export it here.
 * The project loader (src/index.ts) imports `allTsCharacters` to register
 * every agent automatically — no manual wiring needed.
 *
 * Convention:
 *   - File name: <featureName>.ts  (e.g. policyAnalyzer.ts)
 *   - Export:    default export of the Character object
 *   - Re-export: listed below + appended to allTsCharacters
 */

import type { Character } from "@elizaos/core";

// ── Individual character imports ──────────────────────────────────────────────
import policyCrawlerCharacter from "./policyCrawler.js";

// ── Add future characters here ────────────────────────────────────────────────
// import policyAnalyzerCharacter from "./policyAnalyzer.js";
// import extensionManagerCharacter from "./extensionManager.js";
// import zkProofCharacter from "./zkProof.js";
// import modelManagerCharacter from "./modelManager.js";

// ── Named re-exports (for direct imports) ─────────────────────────────────────
export { policyCrawlerCharacter };

// ── Aggregate array used by the project loader ────────────────────────────────
/**
 * All TypeScript-defined Privora characters.
 * The project loader iterates this to register each as a ProjectAgent.
 */
export const allTsCharacters: Character[] = [
  policyCrawlerCharacter,
  // policyAnalyzerCharacter,
  // extensionManagerCharacter,
  // zkProofCharacter,
  // modelManagerCharacter,
];

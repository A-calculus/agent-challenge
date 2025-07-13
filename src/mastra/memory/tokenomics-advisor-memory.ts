import { Memory } from "@mastra/memory";
import { TokenLimiter } from "@mastra/memory/processors";
import { LibSQLStore } from "@mastra/libsql";
import { mkdirSync } from "fs";
import { join } from "path";

// Create hidden directory for memory storage relative to project root
const memoryDir = join(process.cwd(), "src", "mastra", "memory", ".memory");
const dbPath = join(memoryDir, "tokenomics-advisor.db");

// Ensure the hidden directory exists
try {
  mkdirSync(memoryDir, { recursive: true });
} catch (error) {
  // Directory might already exist, ignore error
}

// Configure memory for the tokenomics advisor agent
export const tokenomicsAdvisorMemory = new Memory({
  // Storage configuration for persistence in hidden directory
  storage: new LibSQLStore({
    url: `file:${dbPath}`,
  }),
  // Memory configuration options
  options: {
    // Conversation history - include last 10 messages for context
    lastMessages: 10,
    // Disable semantic recall (no vector search)
    semanticRecall: false,
  },
  // Memory processors for token optimization
  processors: [
    // Use TokenLimiter optimized for Mistral models
    // Mistral-small-latest has ~32k context window, so we limit memory to ~20k tokens
    // leaving room for the current message and response
    new TokenLimiter(20000),
  ],
}); 
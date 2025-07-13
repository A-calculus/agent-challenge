import { mistral } from "@ai-sdk/mistral";
import { google } from "@ai-sdk/google";
import dotenv from "dotenv";

// Load environment variables once at the beginning
dotenv.config();

// Export all your environment variables

export const mistralApiKey = process.env.MISTRAL ?? "1234567890";
export const geminiApiKey = process.env.GEMINI ?? "1234567890";

export const mistralModel = process.env.MM ?? "mistral-large-latest";
export const geminiModel = process.env.GM ?? "gemini-1.5-pro";

// Set environment variables for the AI SDK providers

process.env.MISTRAL_API_KEY = mistralApiKey;
process.env.GOOGLE_GENERATIVE_AI_API_KEY = geminiApiKey;

export const mistralModelInstance = mistral(mistralModel);
export const geminiModelInstance = google(geminiModel);

// Set Mistral as the default model for backward compatibility
export const model = mistralModelInstance;

console.log(`Mistral Model: ${mistralModel}`);
console.log(`Gemini Model: ${geminiModel}`);

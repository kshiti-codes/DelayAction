/**
 * gemini.ts — Gemini API Service Layer
 * ─────────────────────────────────────────────────────────────
 * Wraps Google Gemini 1.5 Flash API for the Lufthansa
 * Disruption AI Dashboard.
 *
 * Usage:
 *   import { callGemini, callGeminiJSON } from "./gemini";
 *
 *   // Plain text response
 *   const text = await callGemini(systemPrompt, userPrompt);
 *
 *   // Parsed JSON response (auto-strips markdown fences)
 *   const data = await callGeminiJSON<MyType>(systemPrompt, userPrompt);
 *
 * Set your API key in .env:
 *   VITE_GEMINI_API_KEY=your_key_here
 */

// ─── Config ──────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
const GEMINI_MODEL   = "gemini-3-flash-preview";
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GeminiMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

export interface GeminiRequest {
  system_instruction?: { parts: { text: string }[] };
  contents: GeminiMessage[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
  };
}

export interface GeminiResponse {
  candidates: {
    content: { parts: { text: string }[]; role: string };
    finishReason: string;
  }[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

// ─── Core Fetch ──────────────────────────────────────────────────────────────

/**
 * Raw call to Gemini API. Returns the full response object.
 */
export async function geminiRaw(request: GeminiRequest): Promise<GeminiResponse> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "Missing VITE_GEMINI_API_KEY — add it to your .env file:\n" +
      "VITE_GEMINI_API_KEY=your_key_here"
    );
  }

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  return response.json() as Promise<GeminiResponse>;
}

// ─── Text Helper ─────────────────────────────────────────────────────────────

/**
 * Calls Gemini with a system prompt + user prompt.
 * Returns the plain text response string.
 *
 * @param systemPrompt  - Instruction/persona for the model
 * @param userPrompt    - The actual user message / data payload
 * @param temperature   - 0.0 (deterministic) → 1.0 (creative). Default 0.3
 */
export async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.3,
): Promise<string> {
  const data = await geminiRaw({
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      { role: "user", parts: [{ text: userPrompt }] },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens: 1500,
    },
  });

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

// ─── JSON Helper ─────────────────────────────────────────────────────────────

/**
 * Calls Gemini and parses the response as JSON.
 * Automatically strips ```json ... ``` markdown fences if present.
 *
 * Tip: tell Gemini in your system prompt to "respond only with valid JSON,
 * no markdown, no preamble" for reliable parsing.
 *
 * @param systemPrompt - Instruction/persona for the model
 * @param userPrompt   - The actual user message / data payload
 * @param temperature  - Lower = more deterministic JSON. Default 0.2
 */
export async function callGeminiJSON<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.2,
): Promise<T> {
  const raw = await callGemini(systemPrompt, userPrompt, temperature);

  // Strip markdown code fences if Gemini wraps the output
  const clean = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(clean) as T;
  } catch {
    console.error("Gemini JSON parse failed. Raw output:\n", raw);
    throw new Error("Gemini returned invalid JSON — see console for raw output");
  }
}

// ─── Multi-turn Helper ───────────────────────────────────────────────────────

/**
 * Multi-turn conversation with Gemini.
 * Pass the full history array each time (Gemini is stateless).
 *
 * @param systemPrompt - Instruction/persona
 * @param history      - Array of prior { role, parts } messages
 * @param newMessage   - Latest user message
 */
export async function callGeminiChat(
  systemPrompt: string,
  history: GeminiMessage[],
  newMessage: string,
): Promise<string> {
  const data = await geminiRaw({
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      ...history,
      { role: "user", parts: [{ text: newMessage }] },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1500,
    },
  });

  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
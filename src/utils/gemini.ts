/**
 * gemini.ts — Gemini API Service Layer
 * ─────────────────────────────────────────────────────────────
 * Wraps Google Gemini API for the Lufthansa Disruption AI Dashboard.
 *
 * Usage:
 *   import { callGemini, callGeminiJSON } from "./gemini";
 *
 *   const text = await callGemini(systemPrompt, userPrompt);
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
    finishReason: string; // "STOP" = complete, "MAX_TOKENS" = truncated
  }[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

// ─── Core Fetch ──────────────────────────────────────────────────────────────

export async function geminiRaw(request: GeminiRequest): Promise<GeminiResponse> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "Missing VITE_GEMINI_API_KEY — add it to your .env file:\n" +
      "VITE_GEMINI_API_KEY=your_key_here"
    );
  }

  const response = await fetch(GEMINI_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(request),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  return response.json() as Promise<GeminiResponse>;
}

// ─── Text Helper ─────────────────────────────────────────────────────────────

export async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.3,
): Promise<string> {
  const data = await geminiRaw({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: 8192, // was 1500 — large JSON responses need room
    },
  });

  const candidate   = data.candidates?.[0];
  const finishReason = candidate?.finishReason;

  // Catch truncation before it silently corrupts downstream JSON parsing
  if (finishReason === "MAX_TOKENS") {
    throw new Error(
      "Gemini response was truncated (hit MAX_TOKENS). " +
      `Used ${data.usageMetadata?.totalTokenCount ?? "?"} tokens total.`
    );
  }

  const text = candidate?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

// ─── JSON Helper ─────────────────────────────────────────────────────────────

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

export async function callGeminiChat(
  systemPrompt: string,
  history: GeminiMessage[],
  newMessage: string,
): Promise<string> {
  const data = await geminiRaw({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [
      ...history,
      { role: "user", parts: [{ text: newMessage }] },
    ],
    generationConfig: {
      temperature:     0.4,
      maxOutputTokens: 8192,
    },
  });

  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
import { useState } from "react";

// ─── Config (same as fetch_lh_flights.ts) ─────────────────────────────────────
const LH_CLIENT_ID     = import.meta.env.VITE_LH_CLIENT_ID as string;
const LH_CLIENT_SECRET = import.meta.env.VITE_LH_CLIENT_SECRET as string;
const LH_BASE_URL      = "https://api.lufthansa.com/v1";
const GEMINI_API_KEY   = import.meta.env.VITE_GEMINI_API_KEY as string;
const GEMINI_URL       = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;

function toSSIMDate(date: Date): string {
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return `${String(date.getDate()).padStart(2,"0")}${months[date.getMonth()]}${String(date.getFullYear()).slice(-2)}`;
}

type TestResult = {
  status: "idle" | "loading" | "ok" | "error";
  data: unknown;
  error?: string;
  ms?: number;
};

const INIT: TestResult = { status: "idle", data: null };

export default function APITest() {
  const [lhToken,   setLhToken]   = useState<TestResult>(INIT);
  const [lhFlights, setLhFlights] = useState<TestResult>(INIT);
  const [gemini,    setGemini]    = useState<TestResult>(INIT);

  // ── LH Token ────────────────────────────────────────────────────────────────
  async function testLHToken() {
    setLhToken({ status: "loading", data: null });
    const t0 = Date.now();
    try {
      const res  = await fetch(`${LH_BASE_URL}/oauth/token`, {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body:    new URLSearchParams({ client_id: LH_CLIENT_ID, client_secret: LH_CLIENT_SECRET, grant_type: "client_credentials" }),
      });
      const data = await res.json();
      setLhToken({ status: res.ok ? "ok" : "error", data, ms: Date.now() - t0, error: res.ok ? undefined : `HTTP ${res.status}` });
    } catch (e: any) {
      setLhToken({ status: "error", data: null, error: e.message, ms: Date.now() - t0 });
    }
  }

  // ── LH Flights (requires token first) ───────────────────────────────────────
  async function testLHFlights() {
    setLhFlights({ status: "loading", data: null });
    const t0 = Date.now();
    try {
      // Get token first
      const tokenRes  = await fetch(`${LH_BASE_URL}/oauth/token`, {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body:    new URLSearchParams({ client_id: LH_CLIENT_ID, client_secret: LH_CLIENT_SECRET, grant_type: "client_credentials" }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) throw new Error("No token: " + JSON.stringify(tokenData));

      const ssim   = toSSIMDate(new Date());
      const params = new URLSearchParams({ airlines: "LH", startDate: ssim, endDate: ssim, daysOfOperation: "1234567", timeMode: "LT", origin: "FRA" });
      const res    = await fetch(`${LH_BASE_URL}/flight-schedules/flightschedules/passenger?${params}`, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const data = await res.json();
      setLhFlights({ status: res.ok ? "ok" : "error", data, ms: Date.now() - t0, error: res.ok ? undefined : `HTTP ${res.status}` });
    } catch (e: any) {
      setLhFlights({ status: "error", data: null, error: e.message, ms: Date.now() - t0 });
    }
  }

  // ── Gemini ───────────────────────────────────────────────────────────────────
  async function testGemini() {
    setGemini({ status: "loading", data: null });
    const t0 = Date.now();
    try {
      if (!GEMINI_API_KEY) throw new Error("VITE_GEMINI_API_KEY not set in .env");
      const res  = await fetch(GEMINI_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Reply with exactly: {\"ping\":\"pong\"} and nothing else." }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 20 },
        }),
      });
      const data = await res.json();
      setGemini({ status: res.ok ? "ok" : "error", data, ms: Date.now() - t0, error: res.ok ? undefined : `HTTP ${res.status}` });
    } catch (e: any) {
      setGemini({ status: "error", data: null, error: e.message, ms: Date.now() - t0 });
    }
  }

  async function testAll() {
    await Promise.all([testLHToken(), testGemini()]);
    // Flights tested separately since they need a token
  }

  return (
    <div style={{ fontFamily: "monospace", padding: 32, background: "#0f172a", minHeight: "100vh", color: "#e2e8f0" }}>
      <h2 style={{ color: "#f0c000", marginBottom: 4, fontSize: 18 }}>API TEST CONSOLE</h2>
      <p style={{ color: "#64748b", fontSize: 12, marginBottom: 28 }}>Raw JSON responses — no processing, no formatting</p>

      <div style={{ display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap" }}>
        <Btn onClick={testAll}        label="▶ Test All (Token + Gemini)" />
        <Btn onClick={testLHToken}    label="LH OAuth Token" />
        <Btn onClick={testLHFlights}  label="LH Flights (FRA today)" />
        <Btn onClick={testGemini}     label="Gemini Ping" />
      </div>

      <Panel label="LH — OAuth Token"              result={lhToken}   />
      <Panel label="LH — Flight Schedules (FRA)"   result={lhFlights} />
      <Panel label="Gemini — Ping"                 result={gemini}    />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Btn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{ background: "#1e293b", border: "1px solid #334155", color: "#f0c000", padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontFamily: "monospace", fontSize: 12 }}
    >
      {label}
    </button>
  );
}

function Panel({ label, result }: { label: string; result: TestResult }) {
  const borderColor = { idle: "#334155", loading: "#d97706", ok: "#16a34a", error: "#dc2626" }[result.status];
  const badge       = { idle: "—", loading: "⟳ LOADING", ok: "✓ OK", error: "✗ ERROR" }[result.status];
  const badgeColor  = { idle: "#64748b", loading: "#d97706", ok: "#16a34a", error: "#dc2626" }[result.status];

  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: 8, marginBottom: 24, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: "#1e293b", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#cbd5e1" }}>{label}</span>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {result.ms !== undefined && (
            <span style={{ fontSize: 11, color: "#64748b" }}>{result.ms}ms</span>
          )}
          <span style={{ fontSize: 11, fontWeight: 700, color: badgeColor }}>{badge}</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 16, background: "#0f172a" }}>
        {result.status === "idle" && (
          <span style={{ color: "#475569", fontSize: 12 }}>Not tested yet — click a button above</span>
        )}
        {result.status === "loading" && (
          <span style={{ color: "#d97706", fontSize: 12 }}>Fetching...</span>
        )}
        {result.status === "error" && (
          <div>
            <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}>Error: {result.error}</div>
            {result.data && (
              <pre style={{ color: "#fca5a5", fontSize: 11, overflowX: "auto", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {JSON.stringify(result.data, null, 2)}
              </pre>
            )}
          </div>
        )}
        {result.status === "ok" && (
          <pre style={{ color: "#86efac", fontSize: 11, overflowX: "auto", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 400, overflowY: "auto" }}>
            {JSON.stringify(result.data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

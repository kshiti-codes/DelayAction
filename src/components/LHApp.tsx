import { useState } from "react";
import { callGeminiJSON } from "../utils/gemini";
import { fetchLHToken, fetchLHFlights, FALLBACK_FLIGHTS } from "../utils/lhApi";
import WeatherPicker, { WEATHER_TYPES } from "./WeatherPicker";
import DisruptionSetup from "./DisruptionSetup";
import FlightList from "./FlightList";
import ActionPlanCard from "./ActionPlanCard";
import StatusLog from "./StatusLog";
import type { WeatherType, DisruptionConfig, ActionPlan, AppStep, LogEntry, Flight } from "../types/lh";

// ─── Gemini prompt helpers ────────────────────────────────────────────────────
function buildPrompt(
  airport: string,
  weather: WeatherType,
  config: DisruptionConfig,
  flights: Flight[],
) {
  const totalPax     = flights.reduce((s, f) => s + f.passengers, 0);
  const connectingPax = flights.reduce((s, f) => s + f.connectingPax, 0);
  const vipPax       = flights.reduce((s, f) => s + f.vipPax, 0);
  const totalRevenue = flights.reduce((s, f) => s + f.revenue, 0);

  const system = `You are Lufthansa's AI Operations Director. Generate precise, structured JSON action plans for weather disruptions. Be specific with numbers, timelines, and savings. Respond with valid JSON only — no markdown, no preamble.`;

  const user = `Weather disruption at ${airport}: ${weather.label} (${weather.severity}).
Duration: ${config.duration}h starting ${config.startTime}.
Affected: ${flights.length} flights, ${totalPax} passengers (${connectingPax} connecting, ${vipPax} VIP), €${totalRevenue.toLocaleString()} revenue at risk.
Flights: ${flights.map(f => `${f.flightNo} to ${f.destination} at ${f.departure} (${f.passengers}pax)`).join(", ")}

Return JSON:
{
  "summary": "2-3 sentence executive summary",
  "riskLevel": "CRITICAL|HIGH|MEDIUM",
  "totalSavings": 150000,
  "savingsBreakdown": [
    {"category": "Proactive Rebooking",   "amount": 60000, "description": "..."},
    {"category": "Hotel Pre-arrangement", "amount": 35000, "description": "..."},
    {"category": "Crew Redeployment",     "amount": 28000, "description": "..."},
    {"category": "Slot Negotiation",      "amount": 27000, "description": "..."}
  ],
  "immediateActions": [
    {"priority": 1, "action": "...", "detail": "...", "timeframe": "Next 15 min", "owner": "..."},
    {"priority": 2, "action": "...", "detail": "...", "timeframe": "Next 30 min", "owner": "..."},
    {"priority": 3, "action": "...", "detail": "...", "timeframe": "Next 45 min", "owner": "..."},
    {"priority": 4, "action": "...", "detail": "...", "timeframe": "Next 60 min", "owner": "..."}
  ],
  "passengerCare": [
    {"segment": "VIP / Senator",         "count": ${vipPax},                              "action": "..."},
    {"segment": "Connecting Passengers", "count": ${connectingPax},                       "action": "..."},
    {"segment": "Standard Passengers",   "count": ${totalPax - connectingPax - vipPax},   "action": "..."}
  ],
  "reactiveCost": 280000,
  "proactiveCost": 130000,
  "kpis": {"flightsReroutable": 2, "estimatedDelay": "2.5h avg", "rebookingCapacity": "87%"}
}`;

  return { system, user, totalPax, connectingPax, vipPax, totalRevenue };
}

function buildFallbackPlan(
  weather: WeatherType,
  airport: string,
  flights: Flight[],
): ActionPlan {
  const totalPax      = flights.reduce((s, f) => s + f.passengers, 0);
  const connectingPax = flights.reduce((s, f) => s + f.connectingPax, 0);
  const vipPax        = flights.reduce((s, f) => s + f.vipPax, 0);
  const rev           = flights.reduce((s, f) => s + f.revenue, 0);
  return {
    summary:     `${weather.label} at ${airport} will impact ${flights.length} flights and ${totalPax} passengers. Proactive measures are strongly recommended.`,
    riskLevel:   weather.severity as ActionPlan["riskLevel"],
    totalSavings: Math.round(rev * 0.42),
    savingsBreakdown: [
      { category: "Proactive Rebooking",   amount: Math.round(rev * 0.18), description: "Rebook connecting passengers before delays cascade" },
      { category: "Hotel Pre-arrangement", amount: Math.round(rev * 0.10), description: "Negotiate bulk hotel rates before demand spike" },
      { category: "Crew Redeployment",     amount: Math.round(rev * 0.08), description: "Reallocate standby crews to minimise overtime" },
      { category: "Slot Negotiation",      amount: Math.round(rev * 0.06), description: "Secure recovery slots at alternate airports" },
    ],
    immediateActions: [
      { priority: 1, action: "Activate Weather Protocol",    detail: "Notify all gate agents and ops staff",                         timeframe: "Next 15 min", owner: "Operations Control" },
      { priority: 2, action: "Proactive Rebooking",          detail: `Rebook ${connectingPax} connecting passengers now`,            timeframe: "Next 30 min", owner: "Revenue Management" },
      { priority: 3, action: "VIP Concierge Alert",          detail: `Assign handlers to all ${vipPax} Senator/HON Circle members`, timeframe: "Next 30 min", owner: "Premium Services" },
      { priority: 4, action: "Aircraft Repositioning",       detail: "Move aircraft to alternate stands away from disruption zone",  timeframe: "Next 60 min", owner: "Ramp Operations" },
    ],
    passengerCare: [
      { segment: "VIP / Senator",         count: vipPax,                          action: "Personal concierge, lounge priority, direct rebooking" },
      { segment: "Connecting Passengers", count: connectingPax,                   action: "Auto-rebook via app + SMS, meal vouchers pre-issued" },
      { segment: "Standard Passengers",   count: totalPax - connectingPax - vipPax, action: "Push notifications, kiosk rebooking, €200 travel voucher" },
    ],
    reactiveCost:  Math.round(rev * 0.65),
    proactiveCost: Math.round(rev * 0.23),
    kpis: { flightsReroutable: 2, estimatedDelay: "2.8h avg", rebookingCapacity: "91%" },
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LHApp() {
  const [step,    setStep]    = useState<AppStep>("idle");
  const [weather, setWeather] = useState<WeatherType | null>(null);
  const [config,  setConfig]  = useState<DisruptionConfig>({ airport: "FRA", startTime: "14:00", duration: "3", radius: "50" });
  const [flights, setFlights] = useState<Flight[]>([]);
  const [plan,    setPlan]    = useState<ActionPlan | null>(null);
  const [log,     setLog]     = useState<LogEntry[]>([]);

  const addLog = (msg: string, type: LogEntry["type"] = "info") =>
    setLog(p => [...p, { msg, type }]);

  const reset = () => {
    setStep("idle"); setWeather(null); setFlights([]); setPlan(null); setLog([]);
  };

  const run = async () => {
    if (!weather) return;
    setStep("fetching");
    setFlights([]); setPlan(null); setLog([]);

    addLog(`Disruption reported at ${config.airport} — ${weather.label}`);

    // ── 1. Fetch live flights ─────────────────────────────────────────────────
    let liveFlights: Flight[] = [];
    try {
      addLog("Connecting to Lufthansa API…");
      const token = await fetchLHToken();
      addLog("Token acquired", "success");
      const raw = await fetchLHFlights(token, config.airport);
      addLog(`${raw.length} flights retrieved from live schedule`, "success");
      liveFlights = raw;
    } catch (err: any) {
      addLog(`LH API unavailable — using cached schedule (${err.message})`, "warn");
      liveFlights = FALLBACK_FLIGHTS;
    }

    const affected = liveFlights.filter(f => f.origin === config.airport || f.destination === config.airport);
    setFlights(affected);
    addLog(`${affected.length} flights affected, ${affected.reduce((s, f) => s + f.passengers, 0).toLocaleString()} passengers at risk`, "success");

    // ── 2. Ask Gemini ─────────────────────────────────────────────────────────
    setStep("analyzing");
    addLog("Sending to Gemini for action plan…");

    try {
      const { system, user } = buildPrompt(config.airport, weather, config, affected);
      const result = await callGeminiJSON<ActionPlan>(system, user);
      setPlan(result);
      addLog("Action plan ready", "success");
    } catch (err: any) {
      addLog(`Gemini unavailable — using computed plan (${err.message})`, "warn");
      setPlan(buildFallbackPlan(weather, config.airport, affected));
    }

    setStep("done");
  };

  const canRun  = !!weather && step === "idle";
  const loading = step === "fetching" || step === "analyzing";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F3F4F6; }
        select, input { font-family: inherit; }
        button:focus-visible { outline: 2px solid #FCD34D; outline-offset: 2px; }
      `}</style>

      <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", background: "#F3F4F6" }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, background: "#FCD34D", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#78350F" }}>
              LH
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Disruption Response</div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>Lufthansa Operations · Frankfurt Hub</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Dot active={true}  label="LH API" />
            <Dot active={true}  label="Gemini AI" />
            <Dot active={step === "done"} label="Plan Ready" />
          </div>
        </header>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: step === "done" ? "400px 1fr" : "400px 1fr", maxWidth: 1280, margin: "0 auto", gap: 0, minHeight: "calc(100vh - 60px)" }}>

          {/* ── Left sidebar ──────────────────────────────────────────────── */}
          <aside style={{ background: "#fff", borderRight: "1px solid #E5E7EB", padding: 28, display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Step 1 */}
            <Section title="1  Weather Event" icon="🌩">
              <WeatherPicker selected={weather} onSelect={setWeather} />
            </Section>

            {/* Step 2 */}
            <Section title="2  Disruption Scope" icon="📍">
              <DisruptionSetup config={config} onChange={setConfig} />
            </Section>

            {/* CTA */}
            {step === "idle" && (
              <button
                onClick={run}
                disabled={!canRun}
                style={{
                  width:         "100%",
                  padding:       "14px",
                  background:    canRun ? "#FCD34D" : "#F3F4F6",
                  color:         canRun ? "#78350F" : "#9CA3AF",
                  border:        "none",
                  borderRadius:  10,
                  fontSize:      14,
                  fontWeight:    700,
                  cursor:        canRun ? "pointer" : "not-allowed",
                  transition:    "all 0.15s ease",
                  fontFamily:    "inherit",
                }}
              >
                {canRun ? "Generate Response Plan →" : "Select a weather event first"}
              </button>
            )}

            {/* Loading bar */}
            {loading && (
              <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 13, color: "#92400E", fontWeight: 600, marginBottom: 10 }}>
                  {step === "fetching" ? "⟳  Fetching live flights…" : "⟳  Generating action plan…"}
                </div>
                <div style={{ height: 4, background: "#FEF3C7", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "#FCD34D", borderRadius: 4, animation: "lhprogress 1.4s ease-in-out infinite" }} />
                </div>
              </div>
            )}

            {step === "done" && (
              <button
                onClick={reset}
                style={{ width: "100%", padding: "14px", background: "transparent", color: "#9CA3AF", border: "1.5px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                ↺  Start Over
              </button>
            )}

            {/* Log */}
            <StatusLog entries={log} />
          </aside>

          {/* ── Right main ────────────────────────────────────────────────── */}
          <main style={{ padding: 28, overflowY: "auto" }}>
            {step === "idle" && (
              <EmptyState />
            )}
            {(step === "fetching" || step === "analyzing" || step === "done") && (
              <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                {flights.length > 0 && (
                  <Section title="Affected Flights" icon="✈️">
                    <FlightList flights={flights} />
                  </Section>
                )}
                {plan && weather && (
                  <Section title="AI Action Plan" icon="🤖">
                    <ActionPlanCard
                      plan={plan}
                      weatherLabel={weather.label}
                      weatherIcon={weather.icon}
                      airport={config.airport}
                    />
                  </Section>
                )}
              </div>
            )}
          </main>

        </div>
      </div>

      <style>{`
        @keyframes lhprogress {
          0%   { width: 0%;   margin-left: 0;    }
          50%  { width: 60%;  margin-left: 20%;  }
          100% { width: 0%;   margin-left: 100%; }
        }
      `}</style>
    </>
  );
}

// ─── Small layout helpers ─────────────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Dot({ active, label }: { active: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6B7280" }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: active ? "#10B981" : "#D1D5DB", boxShadow: active ? "0 0 6px #10B98180" : "none" }} />
      {label}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 400, color: "#9CA3AF", gap: 12, textAlign: "center" }}>
      <div style={{ fontSize: 48 }}>🛫</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#6B7280" }}>Ready to assist</div>
      <div style={{ fontSize: 13, maxWidth: 280, lineHeight: 1.6 }}>
        Select a weather event on the left and configure the disruption scope, then generate a response plan.
      </div>
    </div>
  );
}
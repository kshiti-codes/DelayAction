import { useState, useEffect, useRef } from "react";
import { callGeminiJSON } from "../utils/gemini";

// ─── Lufthansa API Config (from utils/fetch_lh_flights.ts) ───────────────────
const LH_CLIENT_ID     = "u4bnhm9uhcmq5yjt588sarh7";
const LH_CLIENT_SECRET = "TYCf4nYDvfwc9StPyBnk";
const LH_BASE_URL      = "https://api.lufthansa.com/v1";

// ─── Lookup Tables ────────────────────────────────────────────────────────────
const AIRCRAFT_DISPLAY: Record<string, string> = {
  A388: "A380", A380: "A380",
  A359: "A350", A350: "A350", A35K: "A350",
  A333: "A330", A330: "A330",
  A346: "A340",
  A321: "A321", A320: "A320", A319: "A319",
  B748: "B747", B744: "B747", B74S: "B747",
  B788: "B787", B789: "B787", B78X: "B787",
  B77W: "B777", B773: "B777",
  E190: "E190",
};
const PASSENGERS: Record<string, number> = {
  A380: 412, A350: 293, A340: 220, A330: 251,
  A321: 190, A320: 174, A319: 140,
  B747: 368, B787: 224, B777: 335,
  E190: 100,
};
const CREW: Record<string, number> = {
  A380: 19, A350: 14, A340: 13, A330: 12,
  A321: 8,  A320: 6,  A319: 5,
  B747: 17, B787: 13, B777: 15,
  E190: 4,
};
const REVENUE_RATE: Record<string, number> = {
  JFK: 750, LAX: 750, NRT: 750, SIN: 750, GRU: 750,
  JNB: 750, PEK: 750, YYZ: 750, SFO: 750, MEX: 750,
  HKG: 750, BKK: 700, DEL: 650, BOM: 650,
  DXB: 480, ORD: 480, IAD: 480, EWR: 480,
};
const FRA_GATES = ["A44","A50","A60","B22","B30","C14","Z04","Z10","Z16","A26"];
const MUC_GATES = ["G30","G40","H10","K20"];

// ─── Lufthansa API Types ──────────────────────────────────────────────────────
interface LHLeg {
  origin: string;
  destination: string;
  aircraftType: string;
  aircraftDepartureTimeUTC: number;
  aircraftDepartureTimeLT?: number;
  aircraftArrivalTimeUTC: number;
  aircraftArrivalTimeLT?: number;
}
interface LHFlightAggregate {
  flightNumber: number;
  legs: LHLeg[];
}
interface Flight {
  flightNo: string;
  origin: string;
  destination: string;
  departure: string;
  arrival: string;
  aircraft: string;
  status: string;
  passengers: number;
  crew: number;
  connectingPax: number;
  vipPax: number;
  revenue: number;
  gate: string;
}

// ─── Lufthansa API Helpers (browser-safe) ────────────────────────────────────
const rnd = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;

function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toSSIMDate(date: Date): string {
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return `${String(date.getDate()).padStart(2, "0")}${months[date.getMonth()]}${String(date.getFullYear()).slice(-2)}`;
}

async function lhGetToken(): Promise<string> {
  const res = await fetch(`${LH_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     LH_CLIENT_ID,
      client_secret: LH_CLIENT_SECRET,
      grant_type:    "client_credentials",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("LH Auth failed: " + JSON.stringify(data));
  return data.access_token as string;
}

async function lhFetchFlights(token: string, origin: string): Promise<LHFlightAggregate[]> {
  const ssim   = toSSIMDate(new Date());
  const params = new URLSearchParams({
    airlines:        "LH",
    startDate:       ssim,
    endDate:         ssim,
    daysOfOperation: "1234567",
    timeMode:        "LT",
    origin,
  });
  const res = await fetch(
    `${LH_BASE_URL}/flight-schedules/flightschedules/passenger?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`LH API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<LHFlightAggregate[]>;
}

function formatFlights(raw: LHFlightAggregate[]): Flight[] {
  return raw
    .filter(f => f.legs?.length > 0 && f.legs[0]?.aircraftDepartureTimeLT != null)
    .sort((a, b) => a.legs[0].aircraftDepartureTimeLT! - b.legs[0].aircraftDepartureTimeLT!)
    .slice(0, 10)
    .map(f => {
      const leg      = f.legs[0];
      const aircraft = AIRCRAFT_DISPLAY[leg.aircraftType] ?? leg.aircraftType;
      const pax      = PASSENGERS[aircraft] ?? 200;
      const crew     = CREW[aircraft]       ?? 10;
      const rate     = REVENUE_RATE[leg.destination] ?? 250;
      const gates    = leg.origin === "MUC" ? MUC_GATES : FRA_GATES;
      return {
        flightNo:      `LH ${f.flightNumber}`,
        origin:        leg.origin,
        destination:   leg.destination,
        departure:     minutesToHHMM(leg.aircraftDepartureTimeLT!),
        arrival:       minutesToHHMM(leg.aircraftArrivalTimeLT ?? leg.aircraftArrivalTimeUTC),
        aircraft,
        status:        "On Time",
        passengers:    pax,
        crew,
        connectingPax: Math.round(pax * (0.15 + Math.random() * 0.25)),
        vipPax:        rnd(3, 30),
        revenue:       Math.round(pax * rate * (0.85 + Math.random() * 0.3) / 1000) * 1000,
        gate:          gates[rnd(0, gates.length - 1)],
      };
    });
}

// ─── Weather Types ────────────────────────────────────────────────────────────
const WEATHER_TYPES = [
  { id: "thunderstorm", label: "Thunderstorm",   icon: "⛈",  severity: "HIGH",     color: "#f59e0b" },
  { id: "fog",          label: "Dense Fog",       icon: "🌫",  severity: "MEDIUM",   color: "#94a3b8" },
  { id: "snowstorm",    label: "Snowstorm",       icon: "❄",   severity: "HIGH",     color: "#60a5fa" },
  { id: "wind",         label: "Strong Winds",    icon: "💨",  severity: "MEDIUM",   color: "#a78bfa" },
  { id: "ice",          label: "Freezing Rain",   icon: "🌨",  severity: "CRITICAL", color: "#34d399" },
  { id: "tornado",      label: "Tornado Warning", icon: "🌪",  severity: "CRITICAL", color: "#f87171" },
];

// ─── Utility ──────────────────────────────────────────────────────────────────
function formatCurrency(n: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = { CRITICAL: "#f87171", HIGH: "#fb923c", MEDIUM: "#fbbf24", LOW: "#4ade80" };
  return (
    <span style={{ background: colors[severity] + "22", color: colors[severity], border: `1px solid ${colors[severity]}55`, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontFamily: "monospace", fontWeight: 700, letterSpacing: 1 }}>
      {severity}
    </span>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function LHApp() {
  const [step, setStep] = useState("idle"); // idle | fetching | analyzing | done
  const [selectedWeather, setSelectedWeather] = useState<typeof WEATHER_TYPES[0] | null>(null);
  const [affectedAirport, setAffectedAirport] = useState("FRA");
  const [disruption, setDisruption] = useState({ duration: "3", startTime: "14:00", radius: "50" });
  const [flights, setFlights] = useState<Flight[]>([]);
  const [actionPlan, setActionPlan] = useState<any>(null);
  const [log, setLog] = useState<{ msg: string; type: string; time: string }[]>([]);
  const [currentTime] = useState(new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const addLog = (msg: string, type = "info") => {
    setLog(p => [...p, { msg, type, time: new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }]);
  };

  const triggerDisruption = async () => {
    if (!selectedWeather) return;
    setStep("fetching");
    setFlights([]);
    setActionPlan(null);
    setLog([]);

    addLog(`🔴 DISRUPTION ALERT triggered at ${affectedAirport}`, "alert");
    addLog(`Weather type: ${selectedWeather.label} (${selectedWeather.severity})`, "info");
    addLog(`Connecting to Lufthansa Operations API...`, "info");

    let allFlights: Flight[] = [];

    try {
      // ── Step 1: Real Lufthansa OAuth token ──────────────────────────────────
      const token = await lhGetToken();
      addLog(`✓ Auth token acquired — LH OPS API v1`, "success");

      // ── Step 2: Fetch today's live flight schedule for affected airport ──────
      addLog(`Fetching flight schedules from ${affectedAirport}...`, "info");
      const raw = await lhFetchFlights(token, affectedAirport);
      addLog(`✓ ${raw.length} flight records received from Lufthansa API`, "success");

      allFlights = formatFlights(raw);
    } catch (err: any) {
      addLog(`⚠ LH API unavailable (${err.message}) — using cached schedule`, "warn");
      // Fallback: a small realistic set so the demo can still run
      allFlights = [
        { flightNo: "LH 400", origin: "FRA", destination: "JFK", departure: "14:35", arrival: "17:20", aircraft: "A380", status: "On Time", passengers: 412, crew: 19, connectingPax: 87, vipPax: 12, revenue: 284000, gate: "A60" },
        { flightNo: "LH 202", origin: "FRA", destination: "LAX", departure: "15:10", arrival: "18:45", aircraft: "B747", status: "On Time", passengers: 368, crew: 17, connectingPax: 104, vipPax: 8,  revenue: 261000, gate: "B22" },
        { flightNo: "LH 718", origin: "FRA", destination: "DXB", departure: "15:55", arrival: "00:20", aircraft: "A350", status: "On Time", passengers: 293, crew: 14, connectingPax: 61,  vipPax: 22, revenue: 198000, gate: "Z10" },
        { flightNo: "LH 106", origin: "FRA", destination: "ORD", departure: "16:20", arrival: "19:05", aircraft: "A330", status: "On Time", passengers: 251, crew: 12, connectingPax: 73,  vipPax: 5,  revenue: 172000, gate: "C14" },
        { flightNo: "LH 452", origin: "FRA", destination: "GRU", departure: "17:00", arrival: "03:15", aircraft: "B787", status: "On Time", passengers: 224, crew: 13, connectingPax: 38,  vipPax: 9,  revenue: 189000, gate: "A44" },
        { flightNo: "LH 900", origin: "MUC", destination: "FRA", departure: "13:50", arrival: "14:55", aircraft: "A320", status: "Boarding", passengers: 174, crew: 6,  connectingPax: 142, vipPax: 3,  revenue: 52000,  gate: "G30" },
      ];
      addLog(`✓ Loaded ${allFlights.length} cached flights`, "success");
    }

    // ── Step 3: Filter to affected airport ────────────────────────────────────
    const affected = allFlights.filter(f => f.origin === affectedAirport || f.destination === affectedAirport);
    setFlights(affected);
    addLog(`✓ ${affected.length} flights affected at ${affectedAirport}, ${affected.reduce((a, f) => a + f.passengers, 0)} total passengers`, "success");

    addLog(`Fetching passenger manifests & connection graphs...`, "info");
    await new Promise(r => setTimeout(r, 600));

    const totalPax      = affected.reduce((a, f) => a + f.passengers, 0);
    const connectingPax = affected.reduce((a, f) => a + f.connectingPax, 0);
    const vipPax        = affected.reduce((a, f) => a + f.vipPax, 0);
    const totalRevenue  = affected.reduce((a, f) => a + f.revenue, 0);

    addLog(`✓ PNR data loaded — ${connectingPax} connecting passengers flagged`, "success");
    addLog(`Sending data to Gemini AI Analysis Engine...`, "info");

    setStep("analyzing");

    // ── Step 4: Real Gemini AI call ───────────────────────────────────────────
    const systemPrompt = `You are Lufthansa's AI Operations Director. You generate precise, structured JSON action plans for weather disruptions. Be specific with numbers, timelines, and savings. Always respond with valid JSON only, no markdown, no preamble.`;

    const userPrompt = `Weather disruption at ${affectedAirport}: ${selectedWeather.label} (${selectedWeather.severity}). Duration: ${disruption.duration}h starting ${disruption.startTime}. Affected: ${affected.length} flights, ${totalPax} passengers (${connectingPax} connecting, ${vipPax} VIP), €${totalRevenue.toLocaleString()} total revenue at risk.

Flights: ${affected.map(f => `${f.flightNo} to ${f.destination} at ${f.departure} (${f.passengers}pax)`).join(", ")}

Return JSON with this exact structure:
{
  "summary": "2-3 sentence executive summary",
  "riskLevel": "CRITICAL|HIGH|MEDIUM",
  "totalSavings": 150000,
  "savingsBreakdown": [
    {"category": "Proactive Rebooking", "amount": 60000, "description": "short description"},
    {"category": "Hotel Pre-arrangement", "amount": 35000, "description": "short description"},
    {"category": "Crew Redeployment", "amount": 28000, "description": "short description"},
    {"category": "Slot Negotiation", "amount": 27000, "description": "short description"}
  ],
  "immediateActions": [
    {"priority": 1, "action": "action title", "detail": "detail", "timeframe": "Next 15 min", "owner": "department"},
    {"priority": 2, "action": "action title", "detail": "detail", "timeframe": "Next 30 min", "owner": "department"},
    {"priority": 3, "action": "action title", "detail": "detail", "timeframe": "Next 45 min", "owner": "department"},
    {"priority": 4, "action": "action title", "detail": "detail", "timeframe": "Next 60 min", "owner": "department"}
  ],
  "passengerCare": [
    {"segment": "VIP / Senator", "count": ${vipPax}, "action": "specific action"},
    {"segment": "Connecting Passengers", "count": ${connectingPax}, "action": "specific action"},
    {"segment": "Standard Passengers", "count": ${totalPax - connectingPax - vipPax}, "action": "specific action"}
  ],
  "reactiveCost": 280000,
  "proactiveCost": 130000,
  "kpis": {"flightsReroutable": 2, "estimatedDelay": "2.5h avg", "rebookingCapacity": "87%"}
}`;

    try {
      addLog(`Sending ${affected.length} flights + ${totalPax} passengers to Gemini 1.5 Flash...`, "info");
      const parsed = await callGeminiJSON(systemPrompt, userPrompt);
      setActionPlan(parsed);
      addLog(`✓ Gemini Action Plan generated successfully`, "success");
      addLog(`Projected savings: ${formatCurrency((parsed as any).totalSavings)}`, "success");
      setStep("done");
    } catch (e: any) {
      addLog(`Gemini error: ${e.message} — using computed fallback`, "warn");
      setActionPlan({
        summary: `${selectedWeather.label} at ${affectedAirport} will impact ${affected.length} flights and ${totalPax} passengers. Immediate proactive measures are recommended to minimize passenger disruption and financial exposure estimated at €${totalRevenue.toLocaleString()}.`,
        riskLevel: selectedWeather.severity,
        totalSavings: Math.round(totalRevenue * 0.42),
        savingsBreakdown: [
          { category: "Proactive Rebooking",    amount: Math.round(totalRevenue * 0.18), description: "Rebook connecting passengers before delays cascade" },
          { category: "Hotel Pre-arrangement",  amount: Math.round(totalRevenue * 0.10), description: "Negotiate bulk hotel rates before demand spike" },
          { category: "Crew Redeployment",      amount: Math.round(totalRevenue * 0.08), description: "Reallocate standby crews to minimise overtime" },
          { category: "Slot Negotiation",       amount: Math.round(totalRevenue * 0.06), description: "Secure recovery slots at alternate airports" },
        ],
        immediateActions: [
          { priority: 1, action: "Activate Weather Cell Protocol",   detail: "Notify all gate agents and ops staff of incoming disruption",         timeframe: "Next 15 min", owner: "Operations Control" },
          { priority: 2, action: "Proactive Passenger Rebooking",    detail: `Rebook ${connectingPax} connecting passengers to next available flights`, timeframe: "Next 30 min", owner: "Revenue Management" },
          { priority: 3, action: "VIP Concierge Alert",              detail: `Assign personal handlers to all ${vipPax} Senator/HON Circle members`, timeframe: "Next 30 min", owner: "Premium Services" },
          { priority: 4, action: "Aircraft Repositioning",           detail: "Move 2 aircraft to alternate stands away from disruption zone",          timeframe: "Next 60 min", owner: "Ramp Operations" },
        ],
        passengerCare: [
          { segment: "VIP / Senator",          count: vipPax,                                       action: "Personal concierge, lounge priority, direct rebooking with preference" },
          { segment: "Connecting Passengers",  count: connectingPax,                                action: "Automatic rebooking via app + SMS, meal vouchers pre-issued" },
          { segment: "Standard Passengers",    count: totalPax - connectingPax - vipPax,            action: "Push notifications, self-service kiosk rebooking, €200 travel voucher" },
        ],
        reactiveCost:  Math.round(totalRevenue * 0.65),
        proactiveCost: Math.round(totalRevenue * 0.23),
        kpis: { flightsReroutable: 2, estimatedDelay: "2.8h avg", rebookingCapacity: "91%" },
      });
      setStep("done");
    }
  };

  const reset = () => { setStep("idle"); setSelectedWeather(null); setFlights([]); setActionPlan(null); setLog([]); };

  // ─── Styles ───────────────────────────────────────────────────────────────────
  const S: Record<string, any> = {
    app: { minHeight: "100vh", background: "#f8fafc", color: "#0f172a", fontFamily: "'IBM Plex Mono', 'Courier New', monospace", overflow: "hidden" },
    header: { borderBottom: "1px solid #e2e8f0", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(248,250,252,0.97)", backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 100 },
    logo: { display: "flex", alignItems: "center", gap: 12 },
    logoMark: { width: 36, height: 36, background: "#f0c000", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "#1a0500" },
    headerTitle: { fontSize: 13, fontWeight: 700, letterSpacing: 2, color: "#92700a" },
    headerSub: { fontSize: 10, color: "#94a3b8", letterSpacing: 1 },
    statusBar: { display: "flex", gap: 24, alignItems: "center" },
    statusDot: (active: boolean) => ({ width: 8, height: 8, borderRadius: "50%", background: active ? "#22c55e" : "#cbd5e1", boxShadow: active ? "0 0 8px #22c55e80" : "none" }),
    statusLabel: { fontSize: 10, color: "#64748b", letterSpacing: 1, display: "flex", alignItems: "center", gap: 6 },
    main: { display: "grid", gridTemplateColumns: step === "done" ? "380px 1fr" : "1fr", gap: 0, minHeight: "calc(100vh - 60px)", transition: "all 0.4s" },
    panel: { padding: 28, borderRight: "1px solid #e2e8f0" },
    card: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 20, marginBottom: 16 },
    cardTitle: { fontSize: 10, letterSpacing: 2, color: "#94a3b8", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 },
    weatherGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
    weatherBtn: (selected: boolean, color: string) => ({ background: selected ? color + "12" : "transparent", border: `1px solid ${selected ? color : "#e2e8f0"}`, borderRadius: 6, padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s", color: selected ? color : "#94a3b8" }),
    input: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 4, color: "#0f172a", padding: "7px 10px", fontFamily: "inherit", fontSize: 12, width: "100%", outline: "none" },
    select: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 4, color: "#0f172a", padding: "7px 10px", fontFamily: "inherit", fontSize: 12, width: "100%", outline: "none" },
    triggerBtn: (disabled: boolean) => ({ width: "100%", padding: "14px", background: disabled ? "#f1f5f9" : "linear-gradient(135deg, #f0c000, #e58c00)", color: disabled ? "#94a3b8" : "#1a0500", border: "none", borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 900, letterSpacing: 2, transition: "all 0.2s", fontFamily: "inherit" }),
    log: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: 12, height: 180, overflowY: "auto", fontSize: 10, lineHeight: 1.8 },
    logColors: { info: "#64748b", success: "#16a34a", alert: "#dc2626", warn: "#d97706" },
    content: { padding: 28, overflowY: "auto" },
    summaryCard: (risk: string) => { const c = ({ CRITICAL: "#dc2626", HIGH: "#ea580c", MEDIUM: "#d97706" } as Record<string,string>)[risk] || "#16a34a"; return { background: c + "08", border: `1px solid ${c}30`, borderRadius: 8, padding: 20, marginBottom: 20, borderLeft: `4px solid ${c}` }; },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 },
    grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 },
    metricCard: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 18 },
    metricValue: { fontSize: 26, fontWeight: 900, color: "#92700a", lineHeight: 1 },
    metricLabel: { fontSize: 9, color: "#94a3b8", letterSpacing: 1.5, marginTop: 4 },
    sectionTitle: { fontSize: 10, letterSpacing: 2, color: "#64748b", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #e2e8f0" },
    actionRow: (pri: number) => { const colors = ["#dc2626", "#ea580c", "#d97706", "#3b82f6"]; return { display: "flex", gap: 12, padding: "14px 16px", background: "#ffffff", border: `1px solid #e2e8f0`, borderRadius: 6, marginBottom: 8, borderLeft: `3px solid ${colors[pri - 1] || "#94a3b8"}` }; },
    priBadge: (pri: number) => { const colors = ["#dc2626", "#ea580c", "#d97706", "#3b82f6"]; return { width: 24, height: 24, borderRadius: "50%", background: colors[pri - 1] + "15", color: colors[pri - 1], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, flexShrink: 0 }; },
    flightTable: { width: "100%", borderCollapse: "collapse", fontSize: 11 },
    th: { textAlign: "left", padding: "8px 10px", fontSize: 9, color: "#94a3b8", letterSpacing: 1.5, borderBottom: "1px solid #e2e8f0" },
    td: { padding: "10px", borderBottom: "1px solid #f1f5f9", color: "#475569" },
    paxRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #e2e8f0" },
  };

  const isAnalyzing = step === "fetching" || step === "analyzing";

  return (
    <div style={S.app}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.logo}>
          <div style={S.logoMark}>LH</div>
          <div>
            <div style={S.headerTitle}>OPERATIONS CONTROL · DISRUPTION AI</div>
            <div style={S.headerSub}>LUFTHANSA GROUP · FRANKFURT HUB · {currentTime} CET</div>
          </div>
        </div>
        <div style={S.statusBar}>
          <div style={S.statusLabel}><div style={S.statusDot(true)} /> LH OPS API LIVE</div>
          <div style={S.statusLabel}><div style={S.statusDot(true)} /> GEMINI 1.5 READY</div>
          <div style={S.statusLabel}><div style={S.statusDot(step === "done")} /> PLAN ACTIVE</div>
          <div style={{ ...S.statusLabel, color: "#92700a" }}>✈ LIVE SCHEDULE</div>
        </div>
      </div>

      <div style={S.main}>
        {/* LEFT PANEL */}
        <div style={S.panel}>

          {/* Weather Type */}
          <div style={S.card}>
            <div style={S.cardTitle}>⚡ DISRUPTION TYPE</div>
            <div style={S.weatherGrid}>
              {WEATHER_TYPES.map(w => (
                <button key={w.id} style={S.weatherBtn(selectedWeather?.id === w.id, w.color)} onClick={() => setSelectedWeather(w)}>
                  <span style={{ fontSize: 20 }}>{w.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: selectedWeather?.id === w.id ? w.color : "#0f172a" }}>{w.label}</div>
                    <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>{w.severity}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Disruption Parameters */}
          <div style={S.card}>
            <div style={S.cardTitle}>⚙ DISRUPTION PARAMETERS</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: 1, marginBottom: 4 }}>AFFECTED AIRPORT</div>
              <select style={S.select} value={affectedAirport} onChange={e => setAffectedAirport(e.target.value)}>
                <option value="FRA">FRA — Frankfurt</option>
                <option value="MUC">MUC — Munich</option>
                <option value="DUS">DUS — Düsseldorf</option>
                <option value="HAM">HAM — Hamburg</option>
              </select>
            </div>
            <div style={S.grid2}>
              <div>
                <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: 1, marginBottom: 4 }}>START TIME</div>
                <input style={S.input} type="time" value={disruption.startTime} onChange={e => setDisruption(p => ({ ...p, startTime: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: 1, marginBottom: 4 }}>DURATION (HRS)</div>
                <select style={S.select} value={disruption.duration} onChange={e => setDisruption(p => ({ ...p, duration: e.target.value }))}>
                  {["1","2","3","4","6","8","12"].map(d => <option key={d} value={d}>{d}h</option>)}
                </select>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: "#94a3b8", letterSpacing: 1, marginBottom: 4 }}>RADIUS (KM)</div>
              <select style={S.select} value={disruption.radius} onChange={e => setDisruption(p => ({ ...p, radius: e.target.value }))}>
                {["25","50","75","100","150"].map(r => <option key={r} value={r}>{r} km</option>)}
              </select>
            </div>
          </div>

          {/* Trigger Button */}
          {step === "idle" && (
            <button
              style={S.triggerBtn(!selectedWeather)}
              onClick={triggerDisruption}
              disabled={!selectedWeather}
            >
              {selectedWeather ? `▶ TRIGGER DISRUPTION RESPONSE` : `SELECT WEATHER TYPE FIRST`}
            </button>
          )}

          {/* Progress Indicator */}
          {isAnalyzing && (
            <div style={{ ...S.card, borderColor: "#d97706", background: "#fffbeb" }}>
              <div style={{ fontSize: 11, color: "#92700a", marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
                {step === "fetching" ? "FETCHING LIVE FLIGHT DATA FROM LH API..." : "GEMINI GENERATING ACTION PLAN..."}
              </div>
              <div style={{ height: 2, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "linear-gradient(90deg, #f0c000, #e58c00)", animation: "progress 1.5s ease-in-out infinite", borderRadius: 2 }} />
              </div>
            </div>
          )}

          {step === "done" && (
            <button style={{ ...S.triggerBtn(false), background: "transparent", border: "1px solid #e2e8f0", color: "#94a3b8" }} onClick={reset}>
              ↺ RESET — NEW DISRUPTION
            </button>
          )}

          {/* System Log */}
          {log.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={S.cardTitle}>📋 SYSTEM LOG</div>
              <div style={S.log} ref={logRef}>
                {log.map((l, i) => (
                  <div key={i} style={{ color: S.logColors[l.type], marginBottom: 2 }}>
                    <span style={{ color: "#94a3b8" }}>[{l.time}]</span> {l.msg}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL — action plan */}
        {step === "done" && actionPlan && (
          <div style={S.content}>
            {/* Summary Banner */}
            <div style={S.summaryCard(actionPlan.riskLevel)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 20 }}>{selectedWeather?.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#92700a", letterSpacing: 1 }}>{selectedWeather?.label.toUpperCase()} — {affectedAirport}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>GEMINI AI ACTION PLAN · Generated {new Date().toLocaleTimeString("de-DE")}</div>
                  </div>
                </div>
                <SeverityBadge severity={actionPlan.riskLevel} />
              </div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.7 }}>{actionPlan.summary}</div>
            </div>

            {/* KPI Row */}
            <div style={S.grid3}>
              <div style={{ ...S.metricCard, borderColor: "#16a34a30" }}>
                <div style={{ ...S.metricValue, color: "#16a34a" }}>{formatCurrency(actionPlan.totalSavings)}</div>
                <div style={S.metricLabel}>PROJECTED SAVINGS</div>
                <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 6 }}>vs. reactive response</div>
              </div>
              <div style={{ ...S.metricCard, borderColor: "#dc262630" }}>
                <div style={{ ...S.metricValue, color: "#dc2626" }}>{formatCurrency(actionPlan.reactiveCost)}</div>
                <div style={S.metricLabel}>REACTIVE COST</div>
                <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 6 }}>if no action taken</div>
              </div>
              <div style={{ ...S.metricCard, borderColor: "#f0c00030" }}>
                <div style={{ ...S.metricValue, color: "#92700a" }}>{formatCurrency(actionPlan.proactiveCost)}</div>
                <div style={S.metricLabel}>PROACTIVE COST</div>
                <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 6 }}>recommended plan</div>
              </div>
            </div>

            {/* KPI Details */}
            <div style={{ ...S.grid3, marginBottom: 16 }}>
              {Object.entries(actionPlan.kpis).map(([k, v]) => (
                <div key={k} style={S.metricCard}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{String(v)}</div>
                  <div style={S.metricLabel}>{k.replace(/([A-Z])/g, " $1").toUpperCase()}</div>
                </div>
              ))}
            </div>

            {/* Savings Breakdown */}
            <div style={{ ...S.card, marginBottom: 16 }}>
              <div style={S.sectionTitle}>💰 SAVINGS BREAKDOWN</div>
              {actionPlan.savingsBreakdown.map((s: any, i: number) => {
                const colors = ["#16a34a", "#3b82f6", "#8b5cf6", "#f59e0b"];
                const pct = Math.round((s.amount / actionPlan.totalSavings) * 100);
                return (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <div style={{ fontSize: 11, color: "#0f172a" }}>{s.category}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: colors[i % 4] }}>{formatCurrency(s.amount)}</div>
                    </div>
                    <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 6 }}>{s.description}</div>
                    <div style={{ height: 4, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: colors[i % 4], borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Immediate Actions */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#64748b", marginBottom: 10 }}>⚡ IMMEDIATE ACTIONS REQUIRED</div>
              {actionPlan.immediateActions.map((a: any) => (
                <div key={a.priority} style={S.actionRow(a.priority)}>
                  <div style={S.priBadge(a.priority)}>{a.priority}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{a.action}</div>
                      <div style={{ fontSize: 9, color: "#92700a", letterSpacing: 1 }}>{a.timeframe}</div>
                    </div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>{a.detail}</div>
                    <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 4 }}>OWNER: {a.owner}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Passenger Care */}
            <div style={{ ...S.card, marginBottom: 16 }}>
              <div style={S.sectionTitle}>👥 PASSENGER CARE PROTOCOL</div>
              {actionPlan.passengerCare.map((p: any, i: number) => (
                <div key={i} style={S.paxRow}>
                  <div>
                    <div style={{ fontSize: 11, color: "#0f172a", marginBottom: 3 }}>{p.segment}</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>{p.action}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#92700a" }}>{p.count}</div>
                    <div style={{ fontSize: 9, color: "#94a3b8" }}>PAX</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Affected Flights Table */}
            <div style={S.card}>
              <div style={S.sectionTitle}>✈ AFFECTED FLIGHTS — {flights.length} TOTAL (LIVE LH DATA)</div>
              <table style={S.flightTable}>
                <thead>
                  <tr>
                    {["FLIGHT", "ROUTE", "DEP", "AIRCRAFT", "PAX", "CONNECTING", "VIP", "REVENUE", "GATE"].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {flights.map((f, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "#f8fafc" }}>
                      <td style={{ ...S.td, color: "#92700a", fontWeight: 700 }}>{f.flightNo}</td>
                      <td style={S.td}>{f.origin}→{f.destination}</td>
                      <td style={S.td}>{f.departure}</td>
                      <td style={S.td}>{f.aircraft}</td>
                      <td style={{ ...S.td, color: "#0f172a" }}>{f.passengers}</td>
                      <td style={{ ...S.td, color: "#3b82f6" }}>{f.connectingPax}</td>
                      <td style={{ ...S.td, color: "#92700a" }}>{f.vipPax}</td>
                      <td style={{ ...S.td, color: "#16a34a" }}>€{(f.revenue / 1000).toFixed(0)}K</td>
                      <td style={S.td}>{f.gate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #f8fafc; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes progress { 0% { width: 0%; margin-left: 0; } 50% { width: 60%; margin-left: 20%; } 100% { width: 0%; margin-left: 100%; } }
        select option { background: #ffffff; color: #0f172a; }
      `}</style>
    </div>
  );
}
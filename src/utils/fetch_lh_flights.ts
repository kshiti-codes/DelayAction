// ─── Lufthansa Flight Data Fetcher ───────────────────────────────────────────
// Run: npx tsx fetch_lh_flights.ts

const CLIENT_ID     = "u4bnhm9uhcmq5yjt588sarh7";
const CLIENT_SECRET = "TYCf4nYDvfwc9StPyBnk";
const BASE_URL      = "https://api.lufthansa.com/v1";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Flight {
  flightNo:      string;
  origin:        string;
  destination:   string;
  departure:     string;
  arrival:       string;
  aircraft:      string;
  status:        string;
  passengers:    number;
  crew:          number;
  connectingPax: number;
  vipPax:        number;
  revenue:       number;
  gate:          string;
}

interface WeatherType {
  id:       string;
  label:    string;
  icon:     string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  color:    string;
}

interface LHLeg {
  origin:                   string;
  destination:              string;
  aircraftType:             string;
  aircraftDepartureTimeUTC: number;
  aircraftDepartureTimeLT?: number;
  aircraftArrivalTimeUTC:   number;
  aircraftArrivalTimeLT?:   number;
}

interface LHFlightAggregate {
  flightNumber:  number;
  legs:          LHLeg[];
  dataElements?: { id: number; value: string }[];
}

interface TokenResponse {
  access_token: string;
}

// ─── Lookup Tables — aircraft names match your exact sample format ─────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const rnd = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;

function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

function toSSIMDate(date: Date): string {
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return `${String(date.getDate()).padStart(2,"0")}${months[date.getMonth()]}${String(date.getFullYear()).slice(-2)}`;
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  const res = await fetch(`${BASE_URL}/oauth/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type:    "client_credentials",
    }),
  });
  const data = await res.json() as TokenResponse;
  if (!data.access_token) throw new Error("Auth failed: " + JSON.stringify(data));
  console.log("✅ Token obtained");
  return data.access_token;
}

async function fetchFlights(token: string): Promise<LHFlightAggregate[]> {
  const ssim   = toSSIMDate(new Date());
  const params = new URLSearchParams({
    airlines:        "LH",
    startDate:       ssim,
    endDate:         ssim,
    daysOfOperation: "1234567",
    timeMode:        "LT",
    origin:          "FRA",
  });

  const res = await fetch(
    `${BASE_URL}/flight-schedules/flightschedules/passenger?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (res.status === 206) console.warn("⚠️  Results truncated (206 Partial Content)");
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<LHFlightAggregate[]>;
}

// ─── Format into your exact MOCK_FLIGHTS shape ────────────────────────────────

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

// ─── Main ─────────────────────────────────────────────────────────────────────

const WEATHER_TYPES: WeatherType[] = [
  { id: "thunderstorm", label: "Thunderstorm",   icon: "⛈",  severity: "HIGH",     color: "#f59e0b" },
  { id: "fog",          label: "Dense Fog",       icon: "🌫",  severity: "MEDIUM",   color: "#94a3b8" },
  { id: "snowstorm",    label: "Snowstorm",       icon: "❄",   severity: "HIGH",     color: "#60a5fa" },
  { id: "wind",         label: "Strong Winds",    icon: "💨",  severity: "MEDIUM",   color: "#a78bfa" },
  { id: "ice",          label: "Freezing Rain",   icon: "🌨",  severity: "CRITICAL", color: "#34d399" },
  { id: "tornado",      label: "Tornado Warning", icon: "🌪",  severity: "CRITICAL", color: "#f87171" },
];

(async () => {
  try {
    const token        = await getToken();
    const raw          = await fetchFlights(token);
    console.log(`✅ Fetched ${raw.length} flight aggregates from Lufthansa API`);

    const MOCK_FLIGHTS: Flight[] = formatFlights(raw);

    // Inline single-object-per-line format — matches your exact sample style
    const flightsStr = MOCK_FLIGHTS.map(f => `  { flightNo: "${f.flightNo}", origin: "${f.origin}", destination: "${f.destination}", departure: "${f.departure}", arrival: "${f.arrival}", aircraft: "${f.aircraft}", status: "${f.status}", passengers: ${f.passengers}, crew: ${f.crew}, connectingPax: ${f.connectingPax}, vipPax: ${f.vipPax}, revenue: ${f.revenue}, gate: "${f.gate}" }`).join(",\n");
    const weatherStr  = WEATHER_TYPES.map(w => `  { id: "${w.id}", label: "${w.label}", icon: "${w.icon}", severity: "${w.severity}", color: "${w.color}" }`).join(",\n");

    const output =
`// ─── Lufthansa Flight Data (fetched ${new Date().toISOString()}) ───────────────────────────────────────────────
const MOCK_FLIGHTS: Flight[] = [
${flightsStr},
];

const WEATHER_TYPES: WeatherType[] = [
${weatherStr},
];

export { MOCK_FLIGHTS, WEATHER_TYPES };
export type { Flight, WeatherType };
`;

    console.log("\n" + output);

    const { writeFileSync } = await import("fs");
    writeFileSync("lh_flights_output.ts", output);
    console.log("✅ Written to lh_flights_output.ts");

  } catch (err) {
    console.error("❌", (err as Error).message);
    process.exit(1);
  }
})();

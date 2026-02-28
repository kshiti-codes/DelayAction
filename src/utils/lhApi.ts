import type { Flight } from "../types/lh";

// ─── Config ───────────────────────────────────────────────────────────────────
const LH_CLIENT_ID     = import.meta.env.VITE_LH_CLIENT_ID as string;
const LH_CLIENT_SECRET = import.meta.env.VITE_LH_CLIENT_SECRET as string;
const LH_BASE_URL = "/lh-api";

// ─── Lookup Tables ────────────────────────────────────────────────────────────
const AIRCRAFT_DISPLAY: Record<string, string> = {
  A388: "A380", A380: "A380",
  A359: "A350", A350: "A350", A35K: "A350",
  A333: "A330", A330: "A330", A346: "A340",
  A321: "A321", A320: "A320", A319: "A319",
  B748: "B747", B744: "B747", B74S: "B747",
  B788: "B787", B789: "B787", B78X: "B787",
  B77W: "B777", B773: "B777",
  E190: "E190",
};
const PASSENGERS: Record<string, number> = {
  A380: 412, A350: 293, A340: 220, A330: 251,
  A321: 190, A320: 174, A319: 140,
  B747: 368, B787: 224, B777: 335, E190: 100,
};
const CREW: Record<string, number> = {
  A380: 19, A350: 14, A340: 13, A330: 12,
  A321: 8,  A320: 6,  A319: 5,
  B747: 17, B787: 13, B777: 15, E190: 4,
};
const REVENUE_RATE: Record<string, number> = {
  JFK: 750, LAX: 750, NRT: 750, SIN: 750, GRU: 750,
  JNB: 750, PEK: 750, YYZ: 750, SFO: 750, MEX: 750,
  HKG: 750, BKK: 700, DEL: 650, BOM: 650,
  DXB: 480, ORD: 480, IAD: 480, EWR: 480,
};
const FRA_GATES = ["A44","A50","A60","B22","B30","C14","Z04","Z10","Z16","A26"];
const MUC_GATES = ["G30","G40","H10","K20"];

// ─── Raw LH API types ─────────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── Exported API functions ────────────────────────────────────────────────────
export async function fetchLHToken(): Promise<string> {
  const res = await fetch(`${LH_BASE_URL}/oauth/token`, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      client_id:     LH_CLIENT_ID,
      client_secret: LH_CLIENT_SECRET,
      grant_type:    "client_credentials",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("LH Auth failed: " + JSON.stringify(data));
  return data.access_token as string;
}

export async function fetchLHFlights(token: string, origin: string): Promise<Flight[]> {
  const ssim   = toSSIMDate(new Date());
  const params = new URLSearchParams({
    airlines: "LH", startDate: ssim, endDate: ssim,
    daysOfOperation: "1234567", timeMode: "LT", origin,
  });
  const res = await fetch(
    `${LH_BASE_URL}/flight-schedules/flightschedules/passenger?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`LH API ${res.status}: ${await res.text()}`);
  const raw: LHFlightAggregate[] = await res.json();
  return formatFlights(raw);
}

function formatFlights(raw: LHFlightAggregate[]): Flight[] {
  return raw
    .filter(f => f.legs?.length > 0 && f.legs[0]?.aircraftDepartureTimeLT != null)
    .sort((a, b) => a.legs[0].aircraftDepartureTimeLT! - b.legs[0].aircraftDepartureTimeLT!)
    .map(f => {
      const leg      = f.legs[0];
      const aircraft = AIRCRAFT_DISPLAY[leg.aircraftType] ?? leg.aircraftType;
      const pax      = PASSENGERS[aircraft] ?? 200;
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
        crew:          CREW[aircraft] ?? 10,
        connectingPax: Math.round(pax * (0.15 + Math.random() * 0.25)),
        vipPax:        rnd(3, 30),
        revenue:       Math.round(pax * (REVENUE_RATE[leg.destination] ?? 250) * (0.85 + Math.random() * 0.3) / 1000) * 1000,
        gate:          gates[rnd(0, gates.length - 1)],
      };
    });
}

// ─── Fallback data (used if API is unreachable / CORS blocked) ────────────────
export const FALLBACK_FLIGHTS: Flight[] = [
  { flightNo: "LH 400", origin: "FRA", destination: "JFK", departure: "14:35", arrival: "17:20", aircraft: "A380", status: "On Time", passengers: 412, crew: 19, connectingPax: 87,  vipPax: 12, revenue: 284000, gate: "A60" },
  { flightNo: "LH 202", origin: "FRA", destination: "LAX", departure: "15:10", arrival: "18:45", aircraft: "B747", status: "On Time", passengers: 368, crew: 17, connectingPax: 104, vipPax: 8,  revenue: 261000, gate: "B22" },
  { flightNo: "LH 718", origin: "FRA", destination: "DXB", departure: "15:55", arrival: "00:20", aircraft: "A350", status: "On Time", passengers: 293, crew: 14, connectingPax: 61,  vipPax: 22, revenue: 198000, gate: "Z10" },
  { flightNo: "LH 106", origin: "FRA", destination: "ORD", departure: "16:20", arrival: "19:05", aircraft: "A330", status: "On Time", passengers: 251, crew: 12, connectingPax: 73,  vipPax: 5,  revenue: 172000, gate: "C14" },
  { flightNo: "LH 452", origin: "FRA", destination: "GRU", departure: "17:00", arrival: "03:15", aircraft: "B787", status: "On Time", passengers: 224, crew: 13, connectingPax: 38,  vipPax: 9,  revenue: 189000, gate: "A44" },
  { flightNo: "LH 900", origin: "MUC", destination: "FRA", departure: "13:50", arrival: "14:55", aircraft: "A320", status: "Boarding", passengers: 174, crew: 6,  connectingPax: 142, vipPax: 3,  revenue: 52000,  gate: "G30" },
];
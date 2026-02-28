export interface Flight {
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

export interface WeatherType {
  id: string;
  label: string;
  icon: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
}

export interface DisruptionConfig {
  airport: string;
  startTime: string;
  duration: string;
  radius: string;
}

export interface SavingsItem {
  category: string;
  amount: number;
  description: string;
}

export interface ImmediateAction {
  priority: number;
  action: string;
  detail: string;
  timeframe: string;
  owner: string;
}

export interface PassengerCareItem {
  segment: string;
  count: number;
  action: string;
}

export interface ActionPlan {
  summary: string;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  totalSavings: number;
  savingsBreakdown: SavingsItem[];
  immediateActions: ImmediateAction[];
  passengerCare: PassengerCareItem[];
  reactiveCost: number;
  proactiveCost: number;
  kpis: Record<string, string | number>;
}

export type AppStep = "idle" | "fetching" | "analyzing" | "done";

export interface LogEntry {
  msg: string;
  type: "info" | "success" | "warn" | "error";
}
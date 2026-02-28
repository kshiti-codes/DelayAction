import type { ActionPlan } from "../types/lh";

interface Props {
  plan: ActionPlan;
  weatherLabel: string;
  weatherIcon: string;
  airport: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const RISK_STYLES: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  CRITICAL: { bg: "#FFF1F2", border: "#FECDD3", text: "#BE123C", badge: "#FB7185" },
  HIGH:     { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E", badge: "#FCD34D" },
  MEDIUM:   { bg: "#F0F9FF", border: "#BAE6FD", text: "#0C4A6E", badge: "#7DD3FC" },
  LOW:      { bg: "#F0FDF4", border: "#BBF7D0", text: "#14532D", badge: "#86EFAC" },
};

const PRIORITY_COLORS = ["#EF4444", "#F59E0B", "#3B82F6", "#8B5CF6"];

const SAVINGS_COLORS = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B"];

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 20, ...style }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>
      {children}
    </div>
  );
}

export default function ActionPlanCard({ plan, weatherLabel, weatherIcon, airport }: Props) {
  const risk  = RISK_STYLES[plan.riskLevel] ?? RISK_STYLES["MEDIUM"];
  const maxSavings = Math.max(...plan.savingsBreakdown.map(s => s.amount));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Summary banner ─────────────────────────────────────────────────── */}
      <div style={{ background: risk.bg, border: `1px solid ${risk.border}`, borderRadius: 12, padding: 20, borderLeft: `4px solid ${risk.badge}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>{weatherIcon}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
                {weatherLabel} — {airport}
              </div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>AI Action Plan · {new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          </div>
          <span style={{ background: risk.bg, border: `1px solid ${risk.badge}`, color: risk.text, borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700 }}>
            {plan.riskLevel}
          </span>
        </div>
        <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, margin: 0 }}>
          {plan.summary}
        </p>
      </div>

      {/* ── Cost overview ───────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Card style={{ borderTop: "3px solid #10B981" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#059669" }}>{fmt(plan.totalSavings)}</div>
          <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginTop: 4 }}>Projected savings</div>
          <div style={{ fontSize: 11, color: "#D1D5DB", marginTop: 2 }}>vs. doing nothing</div>
        </Card>
        <Card style={{ borderTop: "3px solid #EF4444" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#DC2626" }}>{fmt(plan.reactiveCost)}</div>
          <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginTop: 4 }}>Reactive cost</div>
          <div style={{ fontSize: 11, color: "#D1D5DB", marginTop: 2 }}>if no action taken</div>
        </Card>
        <Card style={{ borderTop: "3px solid #FCD34D" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#D97706" }}>{fmt(plan.proactiveCost)}</div>
          <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginTop: 4 }}>Proactive cost</div>
          <div style={{ fontSize: 11, color: "#D1D5DB", marginTop: 2 }}>recommended plan</div>
        </Card>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────────────── */}
      <Card>
        <SectionLabel>Key Metrics</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Object.keys(plan.kpis).length}, 1fr)`, gap: 12 }}>
          {Object.entries(plan.kpis).map(([key, val]) => (
            <div key={key} style={{ textAlign: "center", padding: "10px 0" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>{String(val)}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                {key.replace(/([A-Z])/g, " $1").trim()}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Immediate Actions ───────────────────────────────────────────────── */}
      <Card>
        <SectionLabel>Immediate Actions</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {plan.immediateActions.map((a) => {
            const color = PRIORITY_COLORS[a.priority - 1] ?? "#94A3B8";
            return (
              <div key={a.priority} style={{ display: "flex", gap: 12, padding: "14px", background: "#F9FAFB", borderRadius: 10, borderLeft: `3px solid ${color}` }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: color + "18", color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                  {a.priority}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{a.action}</span>
                    <span style={{ fontSize: 11, color: "#D97706", fontWeight: 600, background: "#FFFBEB", padding: "2px 8px", borderRadius: 20 }}>
                      {a.timeframe}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>{a.detail}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>Owner: {a.owner}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Savings Breakdown ───────────────────────────────────────────────── */}
      <Card>
        <SectionLabel>Savings Breakdown</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {plan.savingsBreakdown.map((s, i) => {
            const color = SAVINGS_COLORS[i % SAVINGS_COLORS.length];
            const pct   = Math.round((s.amount / maxSavings) * 100);
            return (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{s.category}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>{s.description}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color, marginLeft: 16, flexShrink: 0 }}>{fmt(s.amount)}</div>
                </div>
                <div style={{ height: 5, background: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 0.8s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Passenger Care ──────────────────────────────────────────────────── */}
      <Card>
        <SectionLabel>Passenger Care Protocol</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {plan.passengerCare.map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: i < plan.passengerCare.length - 1 ? "1px solid #F3F4F6" : "none" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 3 }}>{p.segment}</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>{p.action}</div>
              </div>
              <div style={{ textAlign: "right", marginLeft: 20, flexShrink: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#D97706" }}>{p.count}</div>
                <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 500 }}>passengers</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

    </div>
  );
}
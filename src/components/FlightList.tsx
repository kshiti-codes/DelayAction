import type { Flight } from "../types/lh";

interface Props {
  flights: Flight[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  "On Time": { bg: "#ECFDF5", color: "#065F46" },
  "Boarding": { bg: "#EFF6FF", color: "#1D4ED8" },
  "Delayed":  { bg: "#FFF7ED", color: "#9A3412" },
};

export default function FlightList({ flights }: Props) {
  if (flights.length === 0) return null;

  const totalPax = flights.reduce((s, f) => s + f.passengers, 0);
  const totalRev = flights.reduce((s, f) => s + f.revenue, 0);

  return (
    <div>
      {/* Summary row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Affected Flights", value: flights.length },
          { label: "Total Passengers",  value: totalPax.toLocaleString("de-DE") },
          { label: "Revenue at Risk",   value: fmt(totalRev) },
        ].map(item => (
          <div key={item.label} style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 2 }}>{item.value}</div>
            <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #E5E7EB" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F9FAFB" }}>
              {["Flight", "Route", "Departs", "Aircraft", "Passengers", "Connecting", "Revenue", "Gate"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6B7280", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {flights.map((f, i) => {
              const st = STATUS_STYLE[f.status] ?? STATUS_STYLE["On Time"];
              return (
                <tr key={i} style={{ borderBottom: i < flights.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: "#111827" }}>{f.flightNo}</td>
                  <td style={{ padding: "12px 14px", color: "#374151" }}>
                    <span style={{ fontWeight: 600 }}>{f.origin}</span>
                    <span style={{ color: "#D1D5DB", margin: "0 4px" }}>→</span>
                    <span>{f.destination}</span>
                  </td>
                  <td style={{ padding: "12px 14px", color: "#374151", fontWeight: 500 }}>{f.departure}</td>
                  <td style={{ padding: "12px 14px", color: "#6B7280" }}>{f.aircraft}</td>
                  <td style={{ padding: "12px 14px", color: "#374151" }}>{f.passengers}</td>
                  <td style={{ padding: "12px 14px", color: "#3B82F6", fontWeight: 500 }}>{f.connectingPax}</td>
                  <td style={{ padding: "12px 14px", color: "#059669", fontWeight: 500 }}>{fmt(f.revenue)}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ background: "#F3F4F6", borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 600, color: "#374151" }}>
                      {f.gate}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
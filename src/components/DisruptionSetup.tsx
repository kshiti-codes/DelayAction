import type { DisruptionConfig } from "../types/lh";

const AIRPORTS = [
  { code: "FRA", name: "Frankfurt" },
  { code: "MUC", name: "Munich" },
  { code: "DUS", name: "Düsseldorf" },
  { code: "HAM", name: "Hamburg" },
  { code: "BER", name: "Berlin" },
  { code: "STR", name: "Stuttgart" },
];

const DURATIONS = ["1", "2", "3", "4", "6", "8", "12"];

interface Props {
  config: DisruptionConfig;
  onChange: (config: DisruptionConfig) => void;
}

const label = (text: string) => (
  <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" as const }}>
    {text}
  </div>
);

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1.5px solid #E5E7EB",
  borderRadius: 8,
  fontSize: 14,
  color: "#111827",
  background: "#FAFAFA",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  appearance: "none",
  WebkitAppearance: "none",
};

export default function DisruptionSetup({ config, onChange }: Props) {
  const set = (key: keyof DisruptionConfig) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...config, [key]: e.target.value });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
        Set the scope of the disruption
      </p>

      {/* Airport */}
      <div>
        {label("Affected Airport")}
        <div style={{ position: "relative" }}>
          <select style={inputStyle} value={config.airport} onChange={set("airport")}>
            {AIRPORTS.map(a => (
              <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
            ))}
          </select>
          <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#9CA3AF", fontSize: 12 }}>▾</div>
        </div>
      </div>

      {/* Start Time + Duration side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          {label("Starts At")}
          <input
            style={inputStyle}
            type="time"
            value={config.startTime}
            onChange={set("startTime")}
          />
        </div>
        <div>
          {label("Duration")}
          <div style={{ position: "relative" }}>
            <select style={inputStyle} value={config.duration} onChange={set("duration")}>
              {DURATIONS.map(d => (
                <option key={d} value={d}>{d} {Number(d) === 1 ? "hour" : "hours"}</option>
              ))}
            </select>
            <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#9CA3AF", fontSize: 12 }}>▾</div>
          </div>
        </div>
      </div>

      {/* Radius */}
      <div>
        {label("Affected Radius")}
        <div style={{ position: "relative" }}>
          <select style={inputStyle} value={config.radius} onChange={set("radius")}>
            {["25", "50", "75", "100", "150"].map(r => (
              <option key={r} value={r}>{r} km around airport</option>
            ))}
          </select>
          <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#9CA3AF", fontSize: 12 }}>▾</div>
        </div>
      </div>
    </div>
  );
}
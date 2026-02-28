import type { WeatherType } from "../types/lh";

export const WEATHER_TYPES: WeatherType[] = [
  { id: "thunderstorm", label: "Thunderstorm",   icon: "⛈",  severity: "HIGH",     description: "Lightning, heavy rain, strong gusts" },
  { id: "fog",          label: "Dense Fog",       icon: "🌫",  severity: "MEDIUM",   description: "Visibility below 200m" },
  { id: "snowstorm",    label: "Snowstorm",       icon: "❄️",  severity: "HIGH",     description: "Heavy snowfall, icy runways" },
  { id: "wind",         label: "Strong Winds",    icon: "💨",  severity: "MEDIUM",   description: "Gusts exceeding 60 km/h" },
  { id: "ice",          label: "Freezing Rain",   icon: "🌨",  severity: "CRITICAL", description: "Black ice, de-icing required" },
  { id: "tornado",      label: "Tornado Warning", icon: "🌪️",  severity: "CRITICAL", description: "Ground stop may be required" },
];

const SEVERITY_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  CRITICAL: { bg: "#FFF1F2", text: "#BE123C", dot: "#FB7185" },
  HIGH:     { bg: "#FFFBEB", text: "#B45309", dot: "#FCD34D" },
  MEDIUM:   { bg: "#F0F9FF", text: "#0369A1", dot: "#7DD3FC" },
  LOW:      { bg: "#F0FDF4", text: "#166534", dot: "#86EFAC" },
};

interface Props {
  selected: WeatherType | null;
  onSelect: (w: WeatherType) => void;
}

export default function WeatherPicker({ selected, onSelect }: Props) {
  return (
    <div>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16, marginTop: 0 }}>
        What's happening at the airport?
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {WEATHER_TYPES.map(w => {
          const isSelected = selected?.id === w.id;
          const sev = SEVERITY_STYLES[w.severity];
          return (
            <button
              key={w.id}
              onClick={() => onSelect(w)}
              style={{
                background:  isSelected ? sev.bg : "#FAFAFA",
                border:      `1.5px solid ${isSelected ? sev.dot : "#E5E7EB"}`,
                borderRadius: 12,
                padding:     "14px 16px",
                cursor:      "pointer",
                textAlign:   "left",
                transition:  "all 0.15s ease",
                boxShadow:   isSelected ? `0 0 0 3px ${sev.dot}40` : "none",
              }}
            >
              <div style={{ fontSize: 26, marginBottom: 8, lineHeight: 1 }}>{w.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? sev.text : "#111827", marginBottom: 3 }}>
                {w.label}
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1.4 }}>
                {w.description}
              </div>
              {isSelected && (
                <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, background: sev.bg, border: `1px solid ${sev.dot}`, borderRadius: 20, padding: "2px 8px" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: sev.dot }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: sev.text, letterSpacing: 0.5 }}>{w.severity}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
import type { LogEntry } from "../types/lh";
import { useEffect, useRef } from "react";

const ICONS: Record<string, string> = {
  info:    "·",
  success: "✓",
  warn:    "!",
  error:   "✗",
};
const COLORS: Record<string, string> = {
  info:    "#9CA3AF",
  success: "#10B981",
  warn:    "#F59E0B",
  error:   "#EF4444",
};

interface Props {
  entries: LogEntry[];
}

export default function StatusLog({ entries }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <div
      ref={ref}
      style={{
        background:   "#F9FAFB",
        border:       "1px solid #E5E7EB",
        borderRadius: 10,
        padding:      "12px 16px",
        maxHeight:    160,
        overflowY:    "auto",
        display:      "flex",
        flexDirection: "column",
        gap:          4,
      }}
    >
      {entries.map((e, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ color: COLORS[e.type], fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
            {ICONS[e.type]}
          </span>
          <span style={{ fontSize: 12, color: e.type === "info" ? "#6B7280" : COLORS[e.type], lineHeight: 1.5 }}>
            {e.msg}
          </span>
        </div>
      ))}
    </div>
  );
}
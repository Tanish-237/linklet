import React from "react";

// Ring geometry in a 100x100 viewBox. The outer radius is 50; a 76% cutout leaves
// a ring 12 units thick, so its centreline sits at radius 44.
const RADIUS = 44;
const STROKE = 12;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const COLORS = {
  present: "#10b981", // emerald
  absent: "#f43f5e", // rose
  // Neutral ring for "nothing to show yet" — a theme token (not a fixed
  // hex) since, unlike the present/absent status colors, this one isn't
  // semantic and needs to read as a light-gray ring in light mode instead
  // of the near-black it was fixed to.
  emptyRing: "rgb(var(--line-strong))",
};

/**
 * Two-segment attendance ring. Replaces a chart.js doughnut that pulled ~200 KB of
 * charting code into the dashboard bundle for what is, visually, two arcs.
 * Hovering a segment shows a native tooltip ("Present: 5 classes (71%)").
 */
const DonutChart = ({ present = 0, absent = 0, unit = "classes" }) => {
  const total = present + absent;
  const presentLength = total > 0 ? (present / total) * CIRCUMFERENCE : 0;
  const percent = (value) => (total > 0 ? Math.round((value / total) * 100) : 0);

  const label =
    total > 0
      ? `Attendance: ${present} present and ${absent} absent out of ${total} ${unit} (${percent(present)}% present)`
      : `No ${unit} recorded yet`;

  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-full"
      role="img"
      aria-label={label}
      data-testid="attendance-donut"
    >
      {/* Start at 12 o'clock and run clockwise, like a standard doughnut. */}
      <g transform="rotate(-90 50 50)" fill="none" strokeWidth={STROKE}>
        {total === 0 ? (
          <circle cx="50" cy="50" r={RADIUS} stroke={COLORS.emptyRing} />
        ) : (
          <>
            <circle cx="50" cy="50" r={RADIUS} stroke={COLORS.absent}>
              {absent > 0 && <title>{`Absent: ${absent} ${unit} (${percent(absent)}%)`}</title>}
            </circle>
            {present > 0 && (
              <circle
                cx="50"
                cy="50"
                r={RADIUS}
                stroke={COLORS.present}
                strokeDasharray={`${presentLength} ${CIRCUMFERENCE - presentLength}`}
                style={{ transition: "stroke-dasharray 0.6s ease" }}
              >
                <title>{`Present: ${present} ${unit} (${percent(present)}%)`}</title>
              </circle>
            )}
          </>
        )}
      </g>
    </svg>
  );
};

export default DonutChart;

export default function ScoreGauge({ score }) {
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const s = score === null || score === undefined ? 0 : score;
  const filled = (s / 100) * circ;
  const color = s >= 80 ? "#16a34a" : s >= 60 ? "#22c55e" : s >= 30 ? "#d97706" : "#e11d48";
  const label = "0 = bad  ·  60+ great";

  return (
    <div className="gauge" style={{ "--gauge-color": color }}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={radius} fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ - filled}`}
          transform="rotate(-90 70 70)"
        />
      </svg>
      <div className="gauge-score">
        <span className="num">{s}</span>
        <span className="grade">/100</span>
      </div>
      <span className="gauge-scale">{label}</span>
    </div>
  );
}
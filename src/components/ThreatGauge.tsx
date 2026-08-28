interface ThreatGaugeProps {
  score: number;
  level: 'clean' | 'suspicious' | 'malicious';
  size?: number;
}

export function ThreatGauge({ score, level, size = 160 }: ThreatGaugeProps) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color = level === 'clean' ? '#10b981' : level === 'suspicious' ? '#f59e0b' : '#ef4444';
  const bgColor = level === 'clean' ? '#10b98120' : level === 'suspicious' ? '#f59e0b20' : '#ef444420';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth="10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-out, stroke 0.5s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-bold" style={{ color }}>
          {score}
        </span>
        <span className="text-xs uppercase tracking-wider text-slate-500">Threat Score</span>
      </div>
    </div>
  );
}

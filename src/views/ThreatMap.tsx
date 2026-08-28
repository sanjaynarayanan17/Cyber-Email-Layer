import { useState } from 'react';
import { Loader2, Globe2, MapPin, Server, AlertTriangle, Building2 } from 'lucide-react';
import { geolocateIps } from '@/lib/supabase';
import type { GeoResult } from '@/lib/types';

export function ThreatMap() {
  const [ipInput, setIpInput] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedHop, setSelectedHop] = useState<GeoResult | null>(null);

  const handleLookup = async () => {
    const ips = ipInput
      .split(/[\s,\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (ips.length === 0) return;

    setLoading(true);
    setError('');
    setResults([]);
    setSelectedHop(null);
    try {
      const data = await geolocateIps(ips);
      setResults(data);
      if (data.length > 0) setSelectedHop(data[0]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const validResults = results.filter((r) => r.latitude !== null && r.longitude !== null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Threat GeoLocation Map</h2>
        <p className="mt-1 text-sm text-slate-400">
          Trace IP addresses to their geographic origin and visualize the email's journey across the world.
        </p>
      </div>

      {/* Input */}
      <div className="card p-6">
        <label className="mb-2 block text-sm font-medium text-slate-300">IP Addresses to Trace</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={ipInput}
            onChange={(e) => setIpInput(e.target.value)}
            placeholder="Enter IPs separated by commas (e.g. 8.8.8.8, 1.1.1.1)"
            className="input-field flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          />
          <button onClick={handleLookup} disabled={loading || !ipInput.trim()} className="btn-primary shrink-0">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Globe2 size={18} />}
            {loading ? 'Tracing...' : 'Trace IPs'}
          </button>
        </div>
        <div className="mt-2 flex gap-3">
          <button
            onClick={() => setIpInput('8.8.8.8, 1.1.1.1, 208.67.222.222')}
            className="text-xs text-teal-400 hover:text-teal-300"
          >
            Load sample IPs
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>

      {/* Map + details */}
      {results.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Map */}
          <div className="card p-4 lg:col-span-2">
            <WorldMap results={validResults} selectedHop={selectedHop} onSelect={setSelectedHop} />
          </div>

          {/* Details panel */}
          <div className="space-y-3">
            {selectedHop ? (
              <HopDetails hop={selectedHop} />
            ) : (
              <div className="card p-6 text-center text-sm text-slate-500">
                Select a point on the map to view details.
              </div>
            )}

            {/* Hop list */}
            <div className="card p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-200">All Traced Locations</h3>
              <div className="space-y-2">
                {results.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedHop(r)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                      selectedHop?.ip_address === r.ip_address
                        ? 'border-teal-700 bg-teal-500/5'
                        : 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/30'
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-500/10 text-xs font-bold text-teal-400">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs text-slate-300">{r.ip_address}</p>
                      <p className="truncate text-xs text-slate-500">
                        {r.city ? `${r.city}, ` : ''}{r.country || 'Unknown'}
                      </p>
                    </div>
                    {r.is_suspicious && <AlertTriangle size={14} className="text-red-400" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {results.length === 0 && !loading && !error && (
        <div className="card p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/50">
            <Globe2 size={28} className="text-slate-500" />
          </div>
          <p className="text-slate-400">Enter IP addresses to trace their geographic origin.</p>
          <p className="mt-1 text-sm text-slate-500">
            IPs extracted from email analysis can be pasted here to visualize the email's path.
          </p>
        </div>
      )}
    </div>
  );
}

function HopDetails({ hop }: { hop: GeoResult }) {
  return (
    <div className="card p-5 animate-fade-in">
      <div className="flex items-center gap-2">
        <MapPin size={18} className="text-teal-400" />
        <h3 className="text-sm font-semibold text-slate-200">Location Details</h3>
      </div>
      <div className="mt-4 space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">IP Address</p>
          <p className="mt-0.5 font-mono text-sm text-amber-400">{hop.ip_address}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Country</p>
            <p className="mt-0.5 text-sm text-slate-200">{hop.country || 'Unknown'}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Region</p>
            <p className="mt-0.5 text-sm text-slate-200">{hop.region || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">City</p>
            <p className="mt-0.5 text-sm text-slate-200">{hop.city || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Coordinates</p>
            <p className="mt-0.5 font-mono text-xs text-slate-300">
              {hop.latitude?.toFixed(2)}, {hop.longitude?.toFixed(2)}
            </p>
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">ISP / Organization</p>
          <div className="mt-1 flex items-start gap-2">
            <Building2 size={14} className="mt-0.5 shrink-0 text-slate-500" />
            <p className="text-sm text-slate-300">{hop.isp || hop.org || 'Unknown'}</p>
          </div>
        </div>
        {hop.as_number && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">AS Number</p>
            <p className="mt-0.5 font-mono text-xs text-slate-400">{hop.as_number}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          {hop.is_hosting_provider && (
            <span className="badge badge-warning">
              <Server size={12} /> Hosting Provider
            </span>
          )}
          {hop.is_suspicious && (
            <span className="badge badge-critical">
              <AlertTriangle size={12} /> Suspicious Network
            </span>
          )}
          {!hop.is_hosting_provider && !hop.is_suspicious && (
            <span className="badge badge-clean">Clean Network</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Equirectangular projection: lat/lon to SVG x/y
function project(lat: number, lon: number, width: number, height: number): { x: number; y: number } {
  const x = (lon + 180) * (width / 360);
  const y = (90 - lat) * (height / 180);
  return { x, y };
}

function WorldMap({
  results, selectedHop, onSelect,
}: {
  results: GeoResult[];
  selectedHop: GeoResult | null;
  onSelect: (hop: GeoResult) => void;
}) {
  const width = 800;
  const height = 400;

  const points = results.map((r) => ({
    ...r,
    pos: project(r.latitude!, r.longitude!, width, height),
  }));

  // Build connecting lines between consecutive points
  const lines = points.slice(0, -1).map((p, i) => ({
    from: p.pos,
    to: points[i + 1].pos,
  }));

  return (
    <div className="relative overflow-hidden rounded-lg">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ background: '#0f172a' }}>
        {/* Simplified world map - grid background */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" />
          </pattern>
          <radialGradient id="dotGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={width} height={height} fill="url(#grid)" />

        {/* Continent outlines (simplified) */}
        <g fill="#1e293b" stroke="#334155" strokeWidth="0.5" opacity="0.8">
          {/* North America */}
          <path d="M 80 70 Q 120 55 180 60 Q 220 65 250 80 Q 260 100 240 130 Q 210 150 170 155 Q 130 150 100 130 Q 70 110 80 70 Z" />
          {/* South America */}
          <path d="M 220 170 Q 250 165 270 180 Q 280 210 270 250 Q 260 280 240 290 Q 220 285 215 260 Q 210 230 215 200 Q 218 185 220 170 Z" />
          {/* Europe */}
          <path d="M 380 70 Q 420 60 450 70 Q 460 85 450 100 Q 430 110 400 105 Q 380 100 375 85 Q 375 75 380 70 Z" />
          {/* Africa */}
          <path d="M 400 120 Q 440 115 460 130 Q 470 160 460 200 Q 450 230 430 240 Q 410 235 400 210 Q 390 180 395 150 Q 398 130 400 120 Z" />
          {/* Asia */}
          <path d="M 460 60 Q 530 50 620 55 Q 680 65 700 85 Q 690 110 650 120 Q 600 125 540 115 Q 480 110 460 90 Q 455 75 460 60 Z" />
          {/* Australia */}
          <path d="M 620 220 Q 660 215 690 225 Q 700 245 685 260 Q 660 265 635 255 Q 615 245 620 220 Z" />
        </g>

        {/* Connecting lines */}
        {lines.map((line, i) => (
          <line
            key={i}
            x1={line.from.x}
            y1={line.from.y}
            x2={line.to.x}
            y2={line.to.y}
            stroke="#14b8a6"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.5"
          >
            <animate attributeName="stroke-dashoffset" from="0" to="-16" dur="1s" repeatCount="indefinite" />
          </line>
        ))}

        {/* Points */}
        {points.map((p, i) => {
          const isSelected = selectedHop?.ip_address === p.ip_address;
          const color = p.is_suspicious ? '#ef4444' : p.is_hosting_provider ? '#f59e0b' : '#14b8a6';
          return (
            <g
              key={i}
              onClick={() => onSelect(p)}
              style={{ cursor: 'pointer' }}
            >
              {/* Glow */}
              <circle cx={p.pos.x} cy={p.pos.y} r={isSelected ? 14 : 10} fill="url(#dotGlow)" />
              {/* Main dot */}
              <circle
                cx={p.pos.x}
                cy={p.pos.y}
                r={isSelected ? 6 : 4}
                fill={color}
                stroke="#0f172a"
                strokeWidth="1.5"
                style={{ transition: 'r 0.2s ease' }}
              >
                {isSelected && (
                  <animate attributeName="r" values="6;8;6" dur="1.5s" repeatCount="indefinite" />
                )}
              </circle>
              {/* Label */}
              {isSelected && (
                <text
                  x={p.pos.x}
                  y={p.pos.y - 12}
                  fill="#e2e8f0"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {p.ip_address}
                </text>
              )}
              {/* Number badge */}
              <text
                x={p.pos.x}
                y={p.pos.y + 3}
                fill="#0f172a"
                fontSize="7"
                fontWeight="bold"
                textAnchor="middle"
              >
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-teal-500" /> Clean
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Hosting
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Suspicious
        </span>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, Globe2, MapPin, Server, AlertTriangle, Building2, Satellite } from 'lucide-react';
import { geolocateIps } from '@/lib/supabase';
import type { GeoResult } from '@/lib/types';

// Fix Leaflet default icon paths in bundler environment
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function createCustomIcon(color: string, number: number, isSelected: boolean): L.DivIcon {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: ${isSelected ? 32 : 24}px;
      height: ${isSelected ? 32 : 24}px;
      background: ${color};
      border: 2px solid #0f172a;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${isSelected ? 14 : 11}px;
      font-weight: bold;
      color: white;
      box-shadow: 0 0 ${isSelected ? 16 : 8}px ${color}80;
      transition: all 0.2s ease;
      cursor: pointer;
    ">${number}</div>`,
    iconSize: [isSelected ? 32 : 24, isSelected ? 32 : 24],
    iconAnchor: [isSelected ? 16 : 12, isSelected ? 16 : 12],
  });
}

// Component to fly to selected location
function FlyToSelected({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], 6, { duration: 1.2 });
    }
  }, [target, map]);
  return null;
}

export function ThreatMap() {
  const [ipInput, setIpInput] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedHop, setSelectedHop] = useState<GeoResult | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [mapStyle, setMapStyle] = useState<'satellite' | 'street' | 'dark'>('satellite');

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
    setFlyTarget(null);
    try {
      const data = await geolocateIps(ips);
      setResults(data);
      if (data.length > 0 && data[0].latitude !== null) {
        setSelectedHop(data[0]);
        setFlyTarget({ lat: data[0].latitude!, lng: data[0].longitude! });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHop = (hop: GeoResult) => {
    setSelectedHop(hop);
    if (hop.latitude !== null && hop.longitude !== null) {
      setFlyTarget({ lat: hop.latitude, lng: hop.longitude });
    }
  };

  const validResults = results.filter((r) => r.latitude !== null && r.longitude !== null);

  const tileLayerConfig = {
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    },
    street: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
    },
    dark: {
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attribution: '&copy; CARTO &copy; OpenStreetMap contributors',
    },
  };

  const polylinePositions: [number, number][] = validResults
    .map((r) => [r.latitude!, r.longitude!] as [number, number]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Threat GeoLocation Map</h2>
        <p className="mt-1 text-sm text-slate-400">
          Trace IP addresses to their geographic origin on a real satellite map with street-level detail.
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
          <div className="card overflow-hidden lg:col-span-2">
            {/* Map style toggle */}
            <div className="flex items-center justify-between border-b border-slate-800 p-3">
              <div className="flex items-center gap-2">
                <Satellite size={16} className="text-teal-400" />
                <span className="text-sm font-medium text-slate-300">Live Map</span>
              </div>
              <div className="flex gap-1 rounded-lg bg-slate-800/50 p-1">
                {(['satellite', 'street', 'dark'] as const).map((style) => (
                  <button
                    key={style}
                    onClick={() => setMapStyle(style)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-all ${
                      mapStyle === style ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Leaflet map */}
            <div style={{ height: '500px', width: '100%' }} className="relative z-0">
              <MapContainer
                center={[20, 0]}
                zoom={2}
                style={{ height: '100%', width: '100%', background: '#0f172a' }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  url={tileLayerConfig[mapStyle].url}
                  attribution={tileLayerConfig[mapStyle].attribution}
                />
                {validResults.map((r, i) => {
                  const isSelected = selectedHop?.ip_address === r.ip_address;
                  const color = r.is_suspicious ? '#ef4444' : r.is_hosting_provider ? '#f59e0b' : '#14b8a6';
                  return (
                    <Marker
                      key={i}
                      position={[r.latitude!, r.longitude!]}
                      icon={createCustomIcon(color, i + 1, isSelected)}
                      eventHandlers={{ click: () => handleSelectHop(r) }}
                    >
                      <Popup>
                        <div style={{ minWidth: '180px' }}>
                          <strong style={{ fontSize: '14px' }}>{r.ip_address}</strong>
                          <br />
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            {r.city ? `${r.city}, ` : ''}{r.country}
                          </span>
                          <br />
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {r.isp || r.org || 'Unknown ISP'}
                          </span>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
                {polylinePositions.length > 1 && (
                  <Polyline
                    positions={polylinePositions}
                    pathOptions={{ color: '#14b8a6', weight: 2, dashArray: '8 8', opacity: 0.6 }}
                  />
                )}
                <FlyToSelected target={flyTarget} />
              </MapContainer>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 border-t border-slate-800 p-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-teal-500" /> Clean
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-amber-500" /> Hosting
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-500" /> Suspicious
              </span>
            </div>
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
                    onClick={() => handleSelectHop(r)}
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
            IPs extracted from email analysis can be pasted here to visualize the email's path on a real satellite map.
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

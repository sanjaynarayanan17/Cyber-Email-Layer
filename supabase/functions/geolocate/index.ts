import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GeoResult {
  ip_address: string;
  country: string;
  country_code: string;
  region: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  isp: string;
  org: string;
  as_number: string;
  is_hosting_provider: boolean;
  is_suspicious: boolean;
  raw: Record<string, unknown>;
}

const HOSTING_KEYWORDS = [
  "hosting", "datacenter", "data center", "cloud", "server", "vps",
  "amazon", "aws", "google", "microsoft", "azure", "digitalocean",
  "linode", "vultr", "ovh", "hetzner", "leaseweb", "contabo", "oracle",
  "alibaba", "tencent", "huawei",
];

const SUSPICIOUS_KEYWORDS = [
  "anonymous", "proxy", "vpn", "tor", "relay", "bulletproof",
  "spam", "abuse", "botnet",
];

function classifyNetwork(org: string, isp: string): { isHosting: boolean; isSuspicious: boolean } {
  const text = `${org} ${isp}`.toLowerCase();
  const isHosting = HOSTING_KEYWORDS.some((k) => text.includes(k));
  const isSuspicious = SUSPICIOUS_KEYWORDS.some((k) => text.includes(k));
  return { isHosting, isSuspicious };
}

async function lookupIp(ip: string): Promise<GeoResult> {
  // Use ip-api.com (free, no key required, 45 req/min limit)
  const url = `http://ip-api.com/json/${ip}?fields=status,message,continent,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,as,asname,query`;
  const resp = await fetch(url);
  const data = await resp.json();

  if (data.status !== "success") {
    throw new Error(data.message || `Lookup failed for ${ip}`);
  }

  const org = data.org || "";
  const isp = data.isp || "";
  const { isHosting, isSuspicious } = classifyNetwork(org, isp);

  return {
    ip_address: ip,
    country: data.country || "",
    country_code: data.countryCode || "",
    region: data.regionName || "",
    city: data.city || "",
    latitude: typeof data.lat === "number" ? data.lat : null,
    longitude: typeof data.lon === "number" ? data.lon : null,
    isp,
    org,
    as_number: data.as || "",
    is_hosting_provider: isHosting,
    is_suspicious: isSuspicious,
    raw: data,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const ips: string[] = body.ips || [];

    if (!Array.isArray(ips) || ips.length === 0) {
      return new Response(
        JSON.stringify({ error: "No IPs provided. Send { ips: [\"1.2.3.4\", ...] }" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cache first
    const { data: cached } = await supabase
      .from("ip_geolocation_cache")
      .select("*")
      .in("ip_address", ips);

    const cacheMap = new Map<string, GeoResult>();
    for (const row of cached || []) {
      cacheMap.set(row.ip_address, row as GeoResult);
    }

    const results: GeoResult[] = [];
    const toLookup: string[] = [];

    for (const ip of ips) {
      if (cacheMap.has(ip)) {
        results.push(cacheMap.get(ip)!);
      } else {
        toLookup.push(ip);
      }
    }

    // Lookup uncached IPs (respect rate limit: sequential with small delay)
    for (const ip of toLookup) {
      try {
        const result = await lookupIp(ip);
        results.push(result);

        // Upsert into cache
        await supabase
          .from("ip_geolocation_cache")
          .upsert({
            ip_address: result.ip_address,
            country: result.country,
            country_code: result.country_code,
            region: result.region,
            city: result.city,
            latitude: result.latitude,
            longitude: result.longitude,
            isp: result.isp,
            org: result.org,
            as_number: result.as_number,
            is_hosting_provider: result.is_hosting_provider,
            is_suspicious: result.is_suspicious,
            raw: result.raw,
          }, { onConflict: "ip_address" });
      } catch (err) {
        results.push({
          ip_address: ip,
          country: "Unknown",
          country_code: "",
          region: "",
          city: "",
          latitude: null,
          longitude: null,
          isp: "Lookup failed",
          org: "",
          as_number: "",
          is_hosting_provider: false,
          is_suspicious: false,
          raw: { error: (err as Error).message },
        });
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { createClient } from '@supabase/supabase-js';
import type { GeoResult } from './types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const EDGE_FUNCTION_URL = `${supabaseUrl}/functions/v1/geolocate`;

export async function geolocateIps(ips: string[]): Promise<GeoResult[]> {
  if (ips.length === 0) return [];

  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ ips }),
  });

  if (!response.ok) {
    throw new Error(`Geolocation lookup failed (${response.status})`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }
  if (!data.results || !Array.isArray(data.results)) {
    throw new Error('Unexpected response from geolocation service');
  }
  return data.results as GeoResult[];
}

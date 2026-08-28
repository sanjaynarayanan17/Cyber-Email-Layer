export interface ParsedHeader {
  key: string;
  value: string;
}

export interface ReceivedHop {
  raw: string;
  from: string;
  by: string;
  for: string;
  with: string;
  timestamp: string;
  ip: string;
}

export interface ExtractedLink {
  url: string;
  displayText: string;
  isIpBased: boolean;
  isShortened: boolean;
  domain: string;
  isLookalike: boolean;
}

export interface Finding {
  id?: string;
  case_id?: string;
  category: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  weight: number;
}

export interface ThreatAnalysis {
  score: number;
  level: 'clean' | 'suspicious' | 'malicious';
  findings: Finding[];
  parsedHeaders: ParsedHeader[];
  receivedHops: ReceivedHop[];
  extractedLinks: ExtractedLink[];
  extractedIps: string[];
  senderEmail: string;
  senderName: string;
  subject: string;
  recipientEmail: string;
  spf: string;
  dkim: string;
  dmarc: string;
  contentHash: string;
}

export interface CaseRecord {
  id: string;
  title: string;
  notes: string;
  threat_score: number;
  threat_level: 'clean' | 'suspicious' | 'malicious';
  sender_email: string;
  sender_name: string;
  subject: string;
  recipient_email: string;
  content_hash: string;
  raw_email: string;
  parsed_headers: ParsedHeader[];
  received_hops: ReceivedHop[];
  extracted_links: ExtractedLink[];
  extracted_ips: string[];
  created_at: string;
  updated_at: string;
  findings?: Finding[];
}

export interface GeoResult {
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

export interface EmailLog {
  id: string;
  case_id: string | null;
  sender_email: string;
  sender_name: string;
  subject: string;
  recipient_email: string;
  threat_score: number;
  threat_level: 'clean' | 'suspicious' | 'malicious';
  spf: string;
  dkim: string;
  dmarc: string;
  findings_count: number;
  critical_count: number;
  warning_count: number;
  extracted_ips: string[];
  extracted_links: ExtractedLink[];
  content_hash: string;
  created_at: string;
}

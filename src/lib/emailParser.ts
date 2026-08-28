import type { ParsedHeader, ReceivedHop, ExtractedLink } from './types';

const IP_REGEX = /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g;
const IPV6_REGEX = /\b[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){7}\b/g;
const URL_REGEX = /https?:\/\/[^\s<>"'<>\\]+/gi;
const EMAIL_ADDR_REGEX = /([^\s<>]+@[^>]+)>?/;

const SHORTENER_DOMAINS = [
  'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly', 'is.gd',
  'buff.ly', 'rebrand.ly', 'shorturl.at', 'cutt.ly', 'tiny.cc',
  'rb.gy', 's.id', 'lnkd.in',
];

const LOOKALIKE_MAP: Record<string, string[]> = {
  'gmai1.com': ['gmail.com'], 'gmai.com': ['gmail.com'], 'gmial.com': ['gmail.com'],
  'gmaill.com': ['gmail.com'], 'gmaii.com': ['gmail.com'], 'gnail.com': ['gmail.com'],
  'yahooo.com': ['yahoo.com'], 'yaho.com': ['yahoo.com'], 'yhaoo.com': ['yahoo.com'],
  'microsft.com': ['microsoft.com'], 'micrsoft.com': ['microsoft.com'],
  'micros0ft.com': ['microsoft.com'], 'rnicrosoft.com': ['microsoft.com'],
  'paypa1.com': ['paypal.com'], 'paypaI.com': ['paypal.com'], 'paypol.com': ['paypal.com'],
  'arnazon.com': ['amazon.com'], 'amaz0n.com': ['amazon.com'], 'amazom.com': ['amazon.com'],
  'amazn.com': ['amazon.com'],
  'app1e.com': ['apple.com'], 'appl.com': ['apple.com'], 'appple.com': ['apple.com'],
  'faceb00k.com': ['facebook.com'], 'faceboook.com': ['facebook.com'],
  'facebok.com': ['facebook.com'], 'facbook.com': ['facebook.com'],
  'instagrarn.com': ['instagram.com'], 'instagra.com': ['instagram.com'],
  'netfl1x.com': ['netflix.com'], 'netflx.com': ['netflix.com'],
  'linkedln.com': ['linkedin.com'], 'linked.com': ['linkedin.com'],
  'welsfargo.com': ['wellsfargo.com'], 'wellsfarg0.com': ['wellsfargo.com'],
  'bank0famerica.com': ['bankofamerica.com'], 'bankofamerca.com': ['bankofamerica.com'],
  'ch4se.com': ['chase.com'], 'chase.com.com': ['chase.com'],
  'outlok.com': ['outlook.com'], 'outl00k.com': ['outlook.com'],
  'dlsney.com': ['disney.com'], 'disn3y.com': ['disney.com'],
  'g00gle.com': ['google.com'], 'googie.com': ['google.com'], 'goog1e.com': ['google.com'],
};

export function parseEmail(rawEmail: string): {
  headers: ParsedHeader[];
  receivedHops: ReceivedHop[];
  body: string;
  senderEmail: string;
  senderName: string;
  subject: string;
  recipientEmail: string;
  spf: string;
  dkim: string;
  dmarc: string;
  extractedIps: string[];
  extractedLinks: ExtractedLink[];
} {
  // Normalize line endings
  const normalized = rawEmail.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split headers from body at first blank line
  const splitIndex = normalized.indexOf('\n\n');
  const headerSection = splitIndex >= 0 ? normalized.substring(0, splitIndex) : normalized;
  const body = splitIndex >= 0 ? normalized.substring(splitIndex + 2) : '';

  // Unfold continuation lines (lines starting with space/tab belong to previous header)
  const unfolded = headerSection.replace(/\n[ \t]+/g, ' ');

  const headerLines = unfolded.split('\n').filter((l) => l.trim().length > 0);
  const headers: ParsedHeader[] = [];
  for (const line of headerLines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim();
      const value = line.substring(colonIdx + 1).trim();
      headers.push({ key, value });
    }
  }

  const getHeader = (name: string): string => {
    const h = headers.find((x) => x.key.toLowerCase() === name.toLowerCase());
    return h ? h.value : '';
  };

  // Parse From header
  const fromHeader = getHeader('From');
  let senderEmail = '';
  let senderName = '';
  const fromMatch = fromHeader.match(/<([^>]+)>/);
  if (fromMatch) {
    senderEmail = fromMatch[1];
    senderName = fromHeader.substring(0, fromHeader.indexOf('<')).trim().replace(/"/g, '');
  } else {
    const addrMatch = fromHeader.match(EMAIL_ADDR_REGEX);
    senderEmail = addrMatch ? addrMatch[1] : fromHeader.trim();
    senderName = '';
  }

  // Parse To header
  const toHeader = getHeader('To');
  const toMatch = toHeader.match(/<([^>]+)>/);
  const recipientEmail = toMatch ? toMatch[1] : (toHeader.match(EMAIL_ADDR_REGEX)?.[1] || toHeader.trim());

  const subject = getHeader('Subject');

  // Parse Received headers into hops
  const receivedHeaders = headers.filter((h) => h.key.toLowerCase() === 'received');
  const receivedHops: ReceivedHop[] = receivedHeaders.map((h) => parseReceivedHeader(h.value));

  // Extract IPs from received headers
  const receivedIps: string[] = [];
  for (const hop of receivedHops) {
    if (hop.ip) receivedIps.push(hop.ip);
  }

  // Extract IPs from body and headers
  const allText = normalized;
  const ipv4Matches = allText.match(IP_REGEX) || [];
  const ipv6Matches = allText.match(IPV6_REGEX) || [];
  const allIps = Array.from(new Set([...receivedIps, ...ipv4Matches, ...ipv6Matches]));

  // Extract links from body
  const urlMatches = body.match(URL_REGEX) || [];
  const extractedLinks: ExtractedLink[] = [];
  for (const url of Array.from(new Set(urlMatches))) {
    const cleaned = url.replace(/[.,;:!?)]+$/, '');
    let domain = '';
    try {
      domain = new URL(cleaned).hostname;
    } catch {
      domain = '';
    }
    const isIpBased = /^\d+\.\d+\.\d+\.\d+$/.test(domain);
    const isShortened = SHORTENER_DOMAINS.some((s) => domain === s || domain.endsWith('.' + s));
    const isLookalike = !!LOOKALIKE_MAP[domain.toLowerCase()];
    extractedLinks.push({
      url: cleaned,
      displayText: '',
      isIpBased,
      isShortened,
      domain,
      isLookalike,
    });
  }

  // Authentication results
  const authResults = getHeader('Authentication-Results') || getHeader('Authentication-results');
  const spf = extractAuthResult(authResults, 'spf');
  const dkim = extractAuthResult(authResults, 'dkim');
  const dmarc = extractAuthResult(authResults, 'dmarc');

  // Also check Received-SPF header
  if (!spf) {
    const receivedSpf = getHeader('Received-SPF');
    if (receivedSpf) {
      const m = receivedSpf.match(/(pass|fail|softfail|neutral|none|temperror|permerror)/i);
      if (m) {
        return {
          headers, receivedHops, body, senderEmail, senderName, subject, recipientEmail,
          spf: m[1].toLowerCase(), dkim, dmarc, extractedIps: allIps, extractedLinks,
        };
      }
    }
  }

  return {
    headers, receivedHops, body, senderEmail, senderName, subject, recipientEmail,
    spf, dkim, dmarc, extractedIps: allIps, extractedLinks,
  };
}

function parseReceivedHeader(raw: string): ReceivedHop {
  const fromMatch = raw.match(/from\s+([^\s]+(?:\s+\([^)]+\))?)/i);
  const byMatch = raw.match(/by\s+([^\s;]+)/i);
  const forMatch = raw.match(/for\s+<([^>]+)>/i);
  const withMatch = raw.match(/with\s+([^\n;]+)/i);
  const ipMatch = raw.match(IP_REGEX);

  // Timestamp is typically after the semicolon
  const semicolonIdx = raw.lastIndexOf(';');
  const timestamp = semicolonIdx >= 0 ? raw.substring(semicolonIdx + 1).trim() : '';

  return {
    raw,
    from: fromMatch ? fromMatch[1].trim() : '',
    by: byMatch ? byMatch[1].trim() : '',
    for: forMatch ? forMatch[1] : '',
    with: withMatch ? withMatch[1].trim() : '',
    timestamp,
    ip: ipMatch ? ipMatch[0] : '',
  };
}

function extractAuthResult(authHeader: string, type: string): string {
  if (!authHeader) return '';
  const regex = new RegExp(`${type}=(pass|fail|softfail|neutral|none|temperror|permerror|bestguess)`, 'i');
  const match = authHeader.match(regex);
  return match ? match[1].toLowerCase() : '';
}

export async function computeContentHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

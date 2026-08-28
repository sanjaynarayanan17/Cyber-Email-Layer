import type { ThreatAnalysis, Finding, ParsedHeader, ReceivedHop, ExtractedLink } from './types';
import { parseEmail, computeContentHash } from './emailParser';

const URGENT_KEYWORDS = [
  'urgent', 'immediately', 'action required', 'verify your account', 'suspended',
  'account will be closed', 'confirm your identity', 'update your information',
  'dear customer', 'dear valued customer', 'unusual activity', 'security alert',
  'verify now', 'click here to verify', 'limited time', 'act now', 'final notice',
  'overdue', 'password expired', 'compromised', 'unauthorized access',
  'account locked', 'verify your email', 'confirm your account',
];

const SCAM_KEYWORDS = [
  'lottery', 'winner', 'congratulations you have won', 'inheritance', 'next of kin',
  'deceased', 'wire transfer', 'western union', 'moneygram', 'nigerian prince',
  'business proposal', 'confidential transaction', 'million dollars',
  'safe deposit', 'unclaimed funds', 'beneficiary', 'diplomatic courier',
  'shipping fee', 'clearance fee', 'tax payment required',
];

const PHISHING_KEYWORDS = [
  'verify your password', 'enter your password', 'confirm your password',
  'login to confirm', 'sign in to verify', 'update payment method',
  'payment method expired', 'card has been blocked', 'unlock account',
  'reset your password', 'security check', 'billing information',
  'invoice attached', 'click to download', 'view document',
];

export async function analyzeEmail(rawEmail: string): Promise<ThreatAnalysis> {
  const parsed = parseEmail(rawEmail);
  const contentHash = await computeContentHash(rawEmail);
  const findings: Finding[] = [];
  let score = 0;

  // 1. SPF/DKIM/DMARC checks
  if (!parsed.spf && !parsed.dkim && !parsed.dmarc) {
    findings.push({
      category: 'authentication',
      severity: 'warning',
      title: 'No authentication results found',
      description: 'This email has no SPF, DKIM, or DMARC authentication headers. Legitimate emails from major providers almost always include these. Their absence is suspicious.',
      weight: 15,
    });
    score += 15;
  } else {
    if (parsed.spf === 'fail' || parsed.spf === 'softfail') {
      findings.push({
        category: 'authentication',
        severity: 'critical',
        title: `SPF ${parsed.spf}`,
        description: `The sender's IP address is not authorized to send email for this domain (SPF=${parsed.spf}). This is a strong indicator the sender address is forged.`,
        weight: 25,
      });
      score += 25;
    } else if (parsed.spf === 'pass') {
      findings.push({
        category: 'authentication',
        severity: 'info',
        title: 'SPF pass',
        description: 'The sending IP is authorized by the sender domain (SPF=pass). This is a positive signal.',
        weight: 0,
      });
    }
    if (parsed.dkim === 'fail' || parsed.dkim === 'permerror') {
      findings.push({
        category: 'authentication',
        severity: 'critical',
        title: `DKIM ${parsed.dkim}`,
        description: 'The email\'s cryptographic signature is invalid or missing (DKIM fail). The email content may have been tampered with or the signature is forged.',
        weight: 25,
      });
      score += 25;
    } else if (parsed.dkim === 'pass') {
      findings.push({
        category: 'authentication',
        severity: 'info',
        title: 'DKIM pass',
        description: 'The email is cryptographically signed and the signature is valid (DKIM=pass). This is a positive signal.',
        weight: 0,
      });
    }
    if (parsed.dmarc === 'fail') {
      findings.push({
        category: 'authentication',
        severity: 'critical',
        title: 'DMARC fail',
        description: 'The domain\'s DMARC policy evaluated this email as failing authentication. Legitimate senders rarely fail DMARC.',
        weight: 20,
      });
      score += 20;
    } else if (parsed.dmarc === 'pass') {
      findings.push({
        category: 'authentication',
        severity: 'info',
        title: 'DMARC pass',
        description: 'DMARC authentication passed, confirming the email aligns with the domain\'s policy.',
        weight: 0,
      });
    }
  }

  // 2. Sender display name vs address mismatch
  if (parsed.senderName && parsed.senderEmail) {
    const nameDomain = extractDomainFromEmail(parsed.senderName);
    const emailDomain = extractDomainFromEmail(parsed.senderEmail);
    if (nameDomain && emailDomain && nameDomain !== emailDomain) {
      findings.push({
        category: 'spoofing',
        severity: 'critical',
        title: 'Display name domain mismatch',
        description: `The display name mentions "${nameDomain}" but the actual sending address uses "${emailDomain}". This is a classic spoofing technique to make the email appear to come from a trusted brand.`,
        weight: 20,
      });
      score += 20;
    }
  }

  // 3. Reply-To vs From mismatch
  const replyTo = parsed.headers.find((h) => h.key.toLowerCase() === 'reply-to');
  if (replyTo && parsed.senderEmail) {
    const replyToDomain = extractDomainFromEmail(replyTo.value);
    const fromDomain = extractDomainFromEmail(parsed.senderEmail);
    if (replyToDomain && fromDomain && replyToDomain !== fromDomain) {
      findings.push({
        category: 'spoofing',
        severity: 'critical',
        title: 'Reply-To address mismatch',
        description: `Replies to this email go to "${replyTo.value}" (domain: ${replyToDomain}), which is different from the sender address domain "${fromDomain}". This is used to redirect responses to an attacker-controlled address.`,
        weight: 20,
      });
      score += 20;
    }
  }

  // 4. Lookalike domain check
  const senderDomain = extractDomainFromEmail(parsed.senderEmail);
  if (senderDomain) {
    const lowerDomain = senderDomain.toLowerCase();
    if (LOOKALIKE_DOMAINS[lowerDomain]) {
      findings.push({
        category: 'spoofing',
        severity: 'critical',
        title: 'Lookalike sender domain',
        description: `The sender domain "${senderDomain}" is a lookalike for "${LOOKALIKE_DOMAINS[lowerDomain]}". This uses visually similar characters to impersonate a legitimate domain.`,
        weight: 25,
      });
      score += 25;
    }
  }

  // 5. Link analysis
  for (const link of parsed.extractedLinks) {
    if (link.isIpBased) {
      findings.push({
        category: 'links',
        severity: 'critical',
        title: 'IP-based URL detected',
        description: `The link "${link.url}" uses a raw IP address instead of a domain name. Legitimate organizations use domain names; IP-based URLs are a common phishing indicator.`,
        weight: 15,
      });
      score += 15;
    }
    if (link.isShortened) {
      findings.push({
        category: 'links',
        severity: 'warning',
        title: 'Shortened URL detected',
        description: `The link "${link.url}" uses a URL shortener (${link.domain}). Shortened URLs hide the true destination and are frequently used in phishing.`,
        weight: 10,
      });
      score += 10;
    }
    if (link.isLookalike) {
      findings.push({
        category: 'links',
        severity: 'critical',
        title: 'Lookalike link domain',
        description: `The link domain "${link.domain}" is a lookalike for a legitimate domain. This is designed to fool the reader into trusting a fake site.`,
        weight: 20,
      });
      score += 20;
    }
  }

  // 6. Content analysis - urgent/manipulative language
  const bodyLower = parsed.body.toLowerCase();
  const subjectLower = parsed.subject.toLowerCase();
  const contentLower = bodyLower + ' ' + subjectLower;
  const foundUrgent = URGENT_KEYWORDS.filter((k) => contentLower.includes(k));
  if (foundUrgent.length >= 3) {
    findings.push({
      category: 'content',
      severity: 'warning',
      title: 'Urgency and pressure tactics',
      description: `The email uses multiple urgency phrases (${foundUrgent.slice(0, 3).join(', ')}...). Creating a false sense of urgency is a primary social engineering technique to rush the victim into acting without thinking.`,
      weight: 15,
    });
    score += 15;
  } else if (foundUrgent.length > 0) {
    findings.push({
      category: 'content',
      severity: 'info',
      title: 'Some urgency language present',
      description: `The email contains urgency-related language (${foundUrgent[0]}). This alone is not conclusive but contributes to the overall risk.`,
      weight: 5,
    });
    score += 5;
  }

  // 7. Scam keywords
  const foundScam = SCAM_KEYWORDS.filter((k) => contentLower.includes(k));
  if (foundScam.length >= 2) {
    findings.push({
      category: 'content',
      severity: 'critical',
      title: 'Classic scam language detected',
      description: `The email contains language commonly associated with financial scams (${foundScam.slice(0, 3).join(', ')}). These phrases appear frequently in advance-fee fraud and lottery scams.`,
      weight: 25,
    });
    score += 25;
  } else if (foundScam.length === 1) {
    findings.push({
      category: 'content',
      severity: 'warning',
      title: 'Potential scam language',
      description: `The email contains "${foundScam[0]}", language often seen in scam emails. Treat with caution.`,
      weight: 10,
    });
    score += 10;
  }

  // 8. Phishing keywords
  const foundPhishing = PHISHING_KEYWORDS.filter((k) => contentLower.includes(k));
  if (foundPhishing.length >= 2) {
    findings.push({
      category: 'content',
      severity: 'critical',
      title: 'Credential phishing language',
      description: `The email uses phrases designed to harvest credentials (${foundPhishing.slice(0, 3).join(', ')}). These are designed to trick the reader into entering passwords or payment info on a fake site.`,
      weight: 20,
    });
    score += 20;
  } else if (foundPhishing.length === 1) {
    findings.push({
      category: 'content',
      severity: 'warning',
      title: 'Possible phishing language',
      description: `The email contains "${foundPhishing[0]}", which is sometimes used in credential phishing attempts.`,
      weight: 8,
    });
    score += 8;
  }

  // 9. Mismatched From and To domains (if both present)
  if (parsed.senderEmail && parsed.recipientEmail) {
    const fromDomain = extractDomainFromEmail(parsed.senderEmail);
    const toDomain = extractDomainFromEmail(parsed.recipientEmail);
    if (fromDomain && toDomain && fromDomain === toDomain) {
      // Internal email - slightly less suspicious but not conclusive
    }
  }

  // 10. Empty or missing From
  if (!parsed.senderEmail) {
    findings.push({
      category: 'spoofing',
      severity: 'critical',
      title: 'Missing sender address',
      description: 'The email has no valid From address. Legitimate emails always have a sender. This is a strong indicator of a malformed or malicious message.',
      weight: 15,
    });
    score += 15;
  }

  // 11. Number of received hops - very few hops can indicate direct injection
  if (parsed.receivedHops.length === 0) {
    findings.push({
      category: 'headers',
      severity: 'warning',
      title: 'No Received headers',
      description: 'The email has no Received headers, making it impossible to trace the email\'s path through mail servers. Legitimate emails always have at least one Received header.',
      weight: 10,
    });
    score += 10;
  }

  // Clamp score to 0-100
  score = Math.min(score, 100);

  let level: 'clean' | 'suspicious' | 'malicious';
  if (score >= 50) {
    level = 'malicious';
  } else if (score >= 20) {
    level = 'suspicious';
  } else {
    level = 'clean';
  }

  // If there are no findings at all, add a positive note
  if (findings.length === 0) {
    findings.push({
      category: 'authentication',
      severity: 'info',
      title: 'No threats detected',
      description: 'No suspicious indicators were found in this email. The authentication, sender, links, and content all appear legitimate.',
      weight: 0,
    });
  }

  return {
    score,
    level,
    findings,
    parsedHeaders: parsed.headers,
    receivedHops: parsed.receivedHops,
    extractedLinks: parsed.extractedLinks,
    extractedIps: parsed.extractedIps,
    senderEmail: parsed.senderEmail,
    senderName: parsed.senderName,
    subject: parsed.subject,
    recipientEmail: parsed.recipientEmail,
    spf: parsed.spf,
    dkim: parsed.dkim,
    dmarc: parsed.dmarc,
    contentHash,
  };
}

function extractDomainFromEmail(email: string): string {
  if (!email) return '';
  const match = email.match(/@([^>@\s]+)/);
  return match ? match[1].toLowerCase() : '';
}

const LOOKALIKE_DOMAINS: Record<string, string> = {
  'gmai1.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmial.com': 'gmail.com',
  'gmaill.com': 'gmail.com', 'gmaii.com': 'gmail.com', 'gnail.com': 'gmail.com',
  'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yhaoo.com': 'yahoo.com',
  'microsft.com': 'microsoft.com', 'micrsoft.com': 'microsoft.com',
  'micros0ft.com': 'microsoft.com', 'rnicrosoft.com': 'microsoft.com',
  'paypa1.com': 'paypal.com', 'paypaI.com': 'paypal.com', 'paypol.com': 'paypal.com',
  'amaz0n.com': 'amazon.com', 'amazom.com': 'amazon.com', 'amazn.com': 'amazon.com',
  'app1e.com': 'apple.com', 'appl.com': 'apple.com', 'appple.com': 'apple.com',
  'faceb00k.com': 'facebook.com', 'faceboook.com': 'facebook.com',
  'facebok.com': 'facebook.com', 'facbook.com': 'facebook.com',
  'instagrarn.com': 'instagram.com', 'instagra.com': 'instagram.com',
  'netfl1x.com': 'netflix.com', 'netflx.com': 'netflix.com',
  'linkedln.com': 'linkedin.com', 'linked.com': 'linkedin.com',
  'welsfargo.com': 'wellsfargo.com', 'wellsfarg0.com': 'wellsfargo.com',
  'bank0famerica.com': 'bankofamerica.com', 'bankofamerca.com': 'bankofamerica.com',
  'ch4se.com': 'chase.com', 'outlok.com': 'outlook.com', 'outl00k.com': 'outlook.com',
  'dlsney.com': 'disney.com', 'disn3y.com': 'disney.com',
  'g00gle.com': 'google.com', 'googie.com': 'google.com', 'goog1e.com': 'google.com',
};

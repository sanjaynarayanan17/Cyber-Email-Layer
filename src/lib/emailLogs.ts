import { supabase } from './supabase';
import type { EmailLog, ThreatAnalysis } from './types';

export async function logEmailAnalysis(
  analysis: ThreatAnalysis
): Promise<EmailLog | null> {
  const criticalCount = analysis.findings.filter((f) => f.severity === 'critical' && f.weight > 0).length;
  const warningCount = analysis.findings.filter((f) => f.severity === 'warning' && f.weight > 0).length;
  const findingsCount = analysis.findings.filter((f) => f.weight > 0).length;

  const logData = {
    sender_email: analysis.senderEmail,
    sender_name: analysis.senderName,
    subject: analysis.subject,
    recipient_email: analysis.recipientEmail,
    threat_score: analysis.score,
    threat_level: analysis.level,
    spf: analysis.spf,
    dkim: analysis.dkim,
    dmarc: analysis.dmarc,
    findings_count: findingsCount,
    critical_count: criticalCount,
    warning_count: warningCount,
    extracted_ips: analysis.extractedIps,
    extracted_links: analysis.extractedLinks,
    content_hash: analysis.contentHash,
  };

  const { data, error } = await supabase
    .from('email_logs')
    .insert(logData)
    .select()
    .single();

  if (error) {
    console.error('Failed to log email analysis:', error.message);
    return null;
  }
  return data as EmailLog;
}

export async function linkLogToCase(logId: string, caseId: string): Promise<void> {
  const { error } = await supabase
    .from('email_logs')
    .update({ case_id: caseId })
    .eq('id', logId);
  if (error) {
    console.error('Failed to link log to case:', error.message);
  }
}

export async function listEmailLogs(limit = 50): Promise<EmailLog[]> {
  const { data, error } = await supabase
    .from('email_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load email logs: ${error.message}`);
  return (data || []) as EmailLog[];
}

export async function getLogStats(): Promise<{
  totalAnalyzed: number;
  cleanCount: number;
  suspiciousCount: number;
  maliciousCount: number;
  avgScore: number;
}> {
  const { data, error } = await supabase
    .from('email_logs')
    .select('threat_score, threat_level');

  if (error) throw new Error(`Failed to load log stats: ${error.message}`);

  const logs = (data || []) as Pick<EmailLog, 'threat_score' | 'threat_level'>[];
  const totalAnalyzed = logs.length;
  const cleanCount = logs.filter((l) => l.threat_level === 'clean').length;
  const suspiciousCount = logs.filter((l) => l.threat_level === 'suspicious').length;
  const maliciousCount = logs.filter((l) => l.threat_level === 'malicious').length;
  const avgScore = totalAnalyzed > 0
    ? Math.round(logs.reduce((sum, l) => sum + l.threat_score, 0) / totalAnalyzed)
    : 0;

  return { totalAnalyzed, cleanCount, suspiciousCount, maliciousCount, avgScore };
}

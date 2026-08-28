import { supabase } from './supabase';
import type { CaseRecord, ThreatAnalysis, Finding } from './types';

export async function saveCase(
  title: string,
  notes: string,
  rawEmail: string,
  analysis: ThreatAnalysis
): Promise<CaseRecord> {
  const caseData = {
    title,
    notes,
    threat_score: analysis.score,
    threat_level: analysis.level,
    sender_email: analysis.senderEmail,
    sender_name: analysis.senderName,
    subject: analysis.subject,
    recipient_email: analysis.recipientEmail,
    content_hash: analysis.contentHash,
    raw_email: rawEmail,
    parsed_headers: analysis.parsedHeaders,
    received_hops: analysis.receivedHops,
    extracted_links: analysis.extractedLinks,
    extracted_ips: analysis.extractedIps,
  };

  const { data, error } = await supabase
    .from('cases')
    .insert(caseData)
    .select()
    .single();

  if (error) throw new Error(`Failed to save case: ${error.message}`);

  const caseId = data.id;

  // Save findings
  if (analysis.findings.length > 0) {
    const findingRows = analysis.findings.map((f: Finding) => ({
      case_id: caseId,
      category: f.category,
      severity: f.severity,
      title: f.title,
      description: f.description,
      weight: f.weight,
    }));

    const { error: findingsError } = await supabase
      .from('findings')
      .insert(findingRows);

    if (findingsError) throw new Error(`Failed to save findings: ${findingsError.message}`);
  }

  // Fetch the complete case with findings
  const { data: fullCase, error: fetchError } = await supabase
    .from('cases')
    .select('*, findings(*)')
    .eq('id', caseId)
    .single();

  if (fetchError) throw new Error(`Failed to fetch saved case: ${fetchError.message}`);
  return fullCase as CaseRecord;
}

export async function listCases(): Promise<CaseRecord[]> {
  const { data, error } = await supabase
    .from('cases')
    .select('*, findings(*)')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to load cases: ${error.message}`);
  return (data || []) as CaseRecord[];
}

export async function getCase(id: string): Promise<CaseRecord | null> {
  const { data, error } = await supabase
    .from('cases')
    .select('*, findings(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load case: ${error.message}`);
  return data as CaseRecord | null;
}

export async function deleteCase(id: string): Promise<void> {
  const { error } = await supabase.from('cases').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete case: ${error.message}`);
}

export async function updateCaseNotes(id: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from('cases')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`Failed to update notes: ${error.message}`);
}

export async function getDashboardStats(): Promise<{
  totalCases: number;
  cleanCount: number;
  suspiciousCount: number;
  maliciousCount: number;
  recentCases: CaseRecord[];
}> {
  const { data: recent, error } = await supabase
    .from('cases')
    .select('*, findings(*)')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw new Error(`Failed to load stats: ${error.message}`);

  const cases = (recent || []) as CaseRecord[];
  const { count: totalCases, error: countError } = await supabase
    .from('cases')
    .select('*', { count: 'exact', head: true });

  if (countError) throw new Error(`Failed to count cases: ${countError.message}`);

  const cleanCount = cases.filter((c) => c.threat_level === 'clean').length;
  const suspiciousCount = cases.filter((c) => c.threat_level === 'suspicious').length;
  const maliciousCount = cases.filter((c) => c.threat_level === 'malicious').length;

  return {
    totalCases: totalCases || 0,
    cleanCount,
    suspiciousCount,
    maliciousCount,
    recentCases: cases,
  };
}

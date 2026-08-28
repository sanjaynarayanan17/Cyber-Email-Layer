import { useState } from 'react';
import {
  MailSearch, Loader2, Save, Link2, MapPin, Server, ShieldCheck,
  AlertTriangle, ShieldX, Info, FileText, ChevronDown, ChevronRight,
} from 'lucide-react';
import { analyzeEmail } from '@/lib/threatEngine';
import { saveCase } from '@/lib/cases';
import { logEmailAnalysis, linkLogToCase } from '@/lib/emailLogs';
import type { ThreatAnalysis } from '@/lib/types';
import { ThreatGauge } from '@/components/ThreatGauge';
import { ThreatLevelBadge, SeverityBadge, SeverityIcon } from '@/components/Badges';
import type { View } from '@/components/NavBar';

const SAMPLE_EMAIL = `From: "Microsoft Security" <security@microsft-login.com>
To: user@example.com
Subject: Urgent: Verify Your Account Immediately
Date: Mon, 15 Jan 2024 10:30:00 +0000
Reply-To: support@verify-account.xyz
Authentication-Results: spf=fail (sender IP is not authorized)
   dkim=fail (signature invalid)
   dmarc=fail

Dear Valued Customer,

We have detected unusual activity on your account. Your account will be suspended
unless you verify your identity immediately.

Please click here to verify your password and confirm your account:
http://192.168.1.1/verify?account=update

If you do not act now, your account will be permanently closed.

Thank you,
Microsoft Security Team`;

export function Analyzer({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [rawEmail, setRawEmail] = useState('');
  const [analysis, setAnalysis] = useState<ThreatAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveModal, setSaveModal] = useState(false);
  const [caseTitle, setCaseTitle] = useState('');
  const [caseNotes, setCaseNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [logId, setLogId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    headers: true,
    hops: true,
    links: true,
    ips: true,
  });

  const handleAnalyze = async () => {
    if (!rawEmail.trim()) return;
    setLoading(true);
    setError('');
    setAnalysis(null);
    try {
      const result = await analyzeEmail(rawEmail);
      setAnalysis(result);
      setCaseTitle(result.subject || 'Untitled Investigation');
      // Auto-log the analysis for the real-time feed
      const log = await logEmailAnalysis(result);
      if (log) setLogId(log.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!analysis) return;
    setSaving(true);
    try {
      const savedCase = await saveCase(caseTitle, caseNotes, rawEmail, analysis);
      // Link the log entry to the saved case
      if (logId) await linkLogToCase(logId, savedCase.id);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveModal(false);
        setSaveSuccess(false);
        onNavigate('cases');
      }, 1200);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Email Threat Analyzer</h2>
        <p className="mt-1 text-sm text-slate-400">
          Paste the full raw email (including headers) to analyze for phishing, spoofing, and malicious content.
        </p>
      </div>

      {/* Input section */}
      <div className="card p-6">
        <div className="mb-3 flex items-center justify-between">
          <label className="text-sm font-medium text-slate-300">Raw Email Content</label>
          <button
            onClick={() => setRawEmail(SAMPLE_EMAIL)}
            className="text-xs text-teal-400 hover:text-teal-300"
          >
            Load sample phishing email
          </button>
        </div>
        <textarea
          value={rawEmail}
          onChange={(e) => setRawEmail(e.target.value)}
          placeholder="Paste the raw email here, including all headers..."
          className="input-field h-48 resize-y font-mono text-xs leading-relaxed"
        />
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleAnalyze}
            disabled={!rawEmail.trim() || loading}
            className="btn-primary"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <MailSearch size={18} />}
            {loading ? 'Analyzing...' : 'Analyze Email'}
          </button>
          {rawEmail.trim() && (
            <button onClick={() => { setRawEmail(''); setAnalysis(null); }} className="btn-secondary">
              Clear
            </button>
          )}
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        )}
      </div>

      {/* Results */}
      {analysis && (
        <div className="space-y-6 animate-fade-in">
          {/* Score summary */}
          <div className="card p-6">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
              <ThreatGauge score={analysis.score} level={analysis.level} />
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <ThreatLevelBadge level={analysis.level} />
                  <span className="text-sm text-slate-500">
                    Based on {analysis.findings.filter((f) => f.weight > 0).length} risk factors
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <AuthChip label="SPF" value={analysis.spf} />
                  <AuthChip label="DKIM" value={analysis.dkim} />
                  <AuthChip label="DMARC" value={analysis.dmarc} />
                  <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Hops Traced</p>
                    <p className="mt-1 text-lg font-semibold text-slate-200">{analysis.receivedHops.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Findings */}
          <div className="card p-6">
            <h3 className="mb-4 text-sm font-semibold text-slate-200">Threat Findings</h3>
            <div className="space-y-3">
              {analysis.findings.map((f, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-4 transition-all ${
                    f.severity === 'critical'
                      ? 'border-red-900/40 bg-red-950/10'
                      : f.severity === 'warning'
                      ? 'border-amber-900/40 bg-amber-950/10'
                      : 'border-slate-800 bg-slate-800/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      f.severity === 'critical' ? 'bg-red-500/10 text-red-400'
                      : f.severity === 'warning' ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-sky-500/10 text-sky-400'
                    }`}>
                      <SeverityIcon severity={f.severity} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-slate-200">{f.title}</h4>
                        <SeverityBadge severity={f.severity} />
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{f.description}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        <span className="rounded bg-slate-800 px-1.5 py-0.5">{f.category}</span>
                        {f.weight > 0 && <span className="text-slate-500">+{f.weight} points</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Collapsible detail sections */}
          {/* Email headers */}
          <CollapsibleSection
            title="Parsed Headers"
            icon={<FileText size={16} />}
            expanded={expandedSections.headers}
            onToggle={() => toggleSection('headers')}
            count={analysis.parsedHeaders.length}
          >
            <div className="space-y-1.5">
              {analysis.parsedHeaders.map((h, i) => (
                <div key={i} className="flex gap-3 rounded-lg bg-slate-800/20 p-2.5 text-xs">
                  <span className="shrink-0 font-mono font-medium text-teal-400">{h.key}:</span>
                  <span className="min-w-0 flex-1 break-words font-mono text-slate-400">{h.value}</span>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Received hops */}
          <CollapsibleSection
            title="Received Path (Mail Server Hops)"
            icon={<Server size={16} />}
            expanded={expandedSections.hops}
            onToggle={() => toggleSection('hops')}
            count={analysis.receivedHops.length}
          >
            <div className="space-y-3">
              {analysis.receivedHops.length === 0 ? (
                <p className="text-sm text-slate-500">No received headers found.</p>
              ) : (
                analysis.receivedHops.map((hop, i) => (
                  <div key={i} className="rounded-lg border border-slate-800 bg-slate-800/20 p-4">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500/10 text-xs font-bold text-teal-400">
                        {i + 1}
                      </span>
                      <span className="text-slate-300">
                        {hop.from && <span>From <span className="font-mono text-teal-400">{hop.from}</span> </span>}
                        {hop.by && <span>via <span className="font-mono text-teal-400">{hop.by}</span></span>}
                      </span>
                    </div>
                    <div className="mt-2 ml-8 space-y-1 text-xs text-slate-500">
                      {hop.ip && <p>IP: <span className="font-mono text-amber-400">{hop.ip}</span></p>}
                      {hop.with && <p>Protocol: {hop.with}</p>}
                      {hop.for && <p>For: {hop.for}</p>}
                      {hop.timestamp && <p>Time: {hop.timestamp}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CollapsibleSection>

          {/* Links */}
          <CollapsibleSection
            title="Extracted Links"
            icon={<Link2 size={16} />}
            expanded={expandedSections.links}
            onToggle={() => toggleSection('links')}
            count={analysis.extractedLinks.length}
          >
            <div className="space-y-2">
              {analysis.extractedLinks.length === 0 ? (
                <p className="text-sm text-slate-500">No links found in the email body.</p>
              ) : (
                analysis.extractedLinks.map((link, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/20 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs text-slate-300">{link.url}</p>
                      <p className="mt-0.5 text-xs text-slate-500">Domain: {link.domain}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {link.isIpBased && <span className="badge badge-critical">IP URL</span>}
                      {link.isShortened && <span className="badge badge-warning">Shortened</span>}
                      {link.isLookalike && <span className="badge badge-critical">Lookalike</span>}
                      {!link.isIpBased && !link.isShortened && !link.isLookalike && (
                        <span className="badge badge-clean">OK</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CollapsibleSection>

          {/* IPs */}
          <CollapsibleSection
            title="Extracted IP Addresses"
            icon={<MapPin size={16} />}
            expanded={expandedSections.ips}
            onToggle={() => toggleSection('ips')}
            count={analysis.extractedIps.length}
          >
            <div className="flex flex-wrap gap-2">
              {analysis.extractedIps.length === 0 ? (
                <p className="text-sm text-slate-500">No IP addresses found.</p>
              ) : (
                analysis.extractedIps.map((ip, i) => (
                  <span key={i} className="rounded-lg border border-slate-700 bg-slate-800/30 px-3 py-1.5 font-mono text-xs text-amber-400">
                    {ip}
                  </span>
                ))
              )}
            </div>
          </CollapsibleSection>

          {/* Save button */}
          <div className="flex justify-end">
            <button onClick={() => setSaveModal(true)} className="btn-primary">
              <Save size={18} /> Save as Case
            </button>
          </div>
        </div>
      )}

      {/* Save modal */}
      {saveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 animate-scale-in">
            {saveSuccess ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                  <ShieldCheck size={28} className="text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-200">Case Saved</h3>
                <p className="mt-1 text-sm text-slate-500">Redirecting to cases...</p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-slate-200">Save Investigation Case</h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">Case Title</label>
                    <input
                      type="text"
                      value={caseTitle}
                      onChange={(e) => setCaseTitle(e.target.value)}
                      className="input-field"
                      placeholder="Enter a title for this case"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">Analyst Notes</label>
                    <textarea
                      value={caseNotes}
                      onChange={(e) => setCaseNotes(e.target.value)}
                      className="input-field h-24 resize-y"
                      placeholder="Add your investigation notes..."
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button onClick={() => setSaveModal(false)} className="btn-secondary">Cancel</button>
                  <button onClick={handleSave} disabled={saving || !caseTitle.trim()} className="btn-primary">
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {saving ? 'Saving...' : 'Save Case'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AuthChip({ label, value }: { label: string; value: string }) {
  const status = !value ? 'none' : value === 'pass' ? 'pass' : 'fail';
  const color = status === 'pass' ? 'text-emerald-400' : status === 'fail' ? 'text-red-400' : 'text-slate-500';
  const bg = status === 'pass' ? 'border-emerald-900/40 bg-emerald-950/10' : status === 'fail' ? 'border-red-900/40 bg-red-950/10' : 'border-slate-700 bg-slate-800/30';
  const Icon = status === 'pass' ? ShieldCheck : status === 'fail' ? ShieldX : Info;

  return (
    <div className={`rounded-lg border p-3 ${bg}`}>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <Icon size={14} className={color} />
        <span className={`text-sm font-semibold capitalize ${color}`}>{value || 'none'}</span>
      </div>
    </div>
  );
}

function CollapsibleSection({
  title, icon, expanded, onToggle, count, children,
}: {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-6">
      <button onClick={onToggle} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-teal-400">{icon}</span>
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">{count}</span>
        </div>
        {expanded ? <ChevronDown size={18} className="text-slate-500" /> : <ChevronRight size={18} className="text-slate-500" />}
      </button>
      {expanded && <div className="mt-4">{children}</div>}
    </div>
  );
}

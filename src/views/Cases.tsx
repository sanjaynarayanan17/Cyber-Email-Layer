import { useEffect, useState } from 'react';
import {
  FolderOpen, Loader2, Search, Trash2, FileText, ArrowLeft,
  ShieldCheck, AlertTriangle, ShieldAlert, Save, X,
} from 'lucide-react';
import { listCases, deleteCase, updateCaseNotes, getCase } from '@/lib/cases';
import type { CaseRecord } from '@/lib/types';
import { ThreatLevelBadge, SeverityBadge, SeverityIcon } from '@/components/Badges';
import { ThreatGauge } from '@/components/ThreatGauge';
import type { View } from '@/components/NavBar';

export function Cases({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'clean' | 'suspicious' | 'malicious'>('all');
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadCases = async () => {
    setLoading(true);
    try {
      const data = await listCases();
      setCases(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteCase(id);
      setCases(cases.filter((c) => c.id !== id));
      setDeleteConfirm(null);
      if (selectedCase?.id === id) setSelectedCase(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleOpenCase = async (id: string) => {
    try {
      const c = await getCase(id);
      if (c) {
        setSelectedCase(c);
        setNotes(c.notes || '');
        setNotesDirty(false);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedCase) return;
    setSavingNotes(true);
    try {
      await updateCaseNotes(selectedCase.id, notes);
      setNotesDirty(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingNotes(false);
    }
  };

  const filtered = cases.filter((c) => {
    const matchesSearch = !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.sender_email.toLowerCase().includes(search.toLowerCase()) ||
      c.subject.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || c.threat_level === filter;
    return matchesSearch && matchesFilter;
  });

  if (showReport && selectedCase) {
    return <ForensicReport caseRecord={selectedCase} onBack={() => setShowReport(false)} />;
  }

  if (selectedCase) {
    return (
      <CaseDetail
        caseRecord={selectedCase}
        notes={notes}
        notesDirty={notesDirty}
        savingNotes={savingNotes}
        onNotesChange={(n) => { setNotes(n); setNotesDirty(true); }}
        onSaveNotes={handleSaveNotes}
        onBack={() => setSelectedCase(null)}
        onShowReport={() => setShowReport(true)}
        onDelete={() => setDeleteConfirm(selectedCase.id)}
        deleteConfirm={deleteConfirm}
        onConfirmDelete={() => handleDelete(selectedCase.id)}
        onCancelDelete={() => setDeleteConfirm(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Investigation Cases</h2>
          <p className="mt-1 text-sm text-slate-400">Saved forensic investigations and threat analyses.</p>
        </div>
        <button onClick={() => onNavigate('analyze')} className="btn-secondary">
          <FileText size={16} /> New Analysis
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, sender, or subject..."
            className="input-field pl-10"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'clean', 'suspicious', 'malicious'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-2 text-sm font-medium capitalize transition-all ${
                filter === f
                  ? 'bg-teal-500/10 text-teal-400'
                  : 'text-slate-400 hover:bg-slate-800/50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Cases list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-teal-500" />
        </div>
      ) : error ? (
        <div className="card p-6 text-center text-red-400">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/50">
            <FolderOpen size={28} className="text-slate-500" />
          </div>
          <p className="text-slate-400">No cases found.</p>
          <p className="mt-1 text-sm text-slate-500">
            {cases.length === 0
              ? 'Analyze an email and save it as a case to get started.'
              : 'Try adjusting your search or filter.'}
          </p>
          {cases.length === 0 && (
            <button onClick={() => onNavigate('analyze')} className="btn-primary mt-4">
              <FileText size={16} /> Analyze an Email
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => handleOpenCase(c.id)}
              className="card flex items-center gap-4 p-4 text-left transition-all hover:border-slate-700 hover:bg-slate-800/20"
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
                c.threat_level === 'malicious' ? 'bg-red-500/10'
                : c.threat_level === 'suspicious' ? 'bg-amber-500/10'
                : 'bg-emerald-500/10'
              }`}>
                {c.threat_level === 'malicious' ? <ShieldAlert size={22} className="text-red-400" />
                : c.threat_level === 'suspicious' ? <AlertTriangle size={22} className="text-amber-400" />
                : <ShieldCheck size={22} className="text-emerald-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-medium text-slate-200">{c.title}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {c.sender_email && <span className="truncate">{c.sender_email}</span>}
                  {c.subject && <span className="truncate">— {c.subject}</span>}
                  <span>{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <ThreatLevelBadge level={c.threat_level} />
                <span className="text-lg font-bold text-slate-400">{c.threat_score}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CaseDetail({
  caseRecord, notes, notesDirty, savingNotes,
  onNotesChange, onSaveNotes, onBack, onShowReport,
  onDelete, deleteConfirm, onConfirmDelete, onCancelDelete,
}: {
  caseRecord: CaseRecord;
  notes: string;
  notesDirty: boolean;
  savingNotes: boolean;
  onNotesChange: (n: string) => void;
  onSaveNotes: () => void;
  onBack: () => void;
  onShowReport: () => void;
  onDelete: () => void;
  deleteConfirm: string | null;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  const findings = caseRecord.findings || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
          <ArrowLeft size={16} /> Back to Cases
        </button>
        <div className="flex gap-2">
          <button onClick={onShowReport} className="btn-secondary">
            <FileText size={16} /> View Report
          </button>
          <button onClick={onDelete} className="btn-danger">
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="card p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <ThreatGauge score={caseRecord.threat_score} level={caseRecord.threat_level} />
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <ThreatLevelBadge level={caseRecord.threat_level} />
            </div>
            <h2 className="text-lg font-bold text-slate-100">{caseRecord.title}</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Sender</p>
                <p className="mt-0.5 text-slate-300">{caseRecord.sender_email || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Recipient</p>
                <p className="mt-0.5 text-slate-300">{caseRecord.recipient_email || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Subject</p>
                <p className="mt-0.5 text-slate-300">{caseRecord.subject || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Date</p>
                <p className="mt-0.5 text-slate-300">{new Date(caseRecord.created_at).toLocaleString()}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs uppercase tracking-wider text-slate-500">Content Hash (SHA-256)</p>
                <p className="mt-0.5 break-all font-mono text-xs text-slate-400">{caseRecord.content_hash}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Analyst Notes</h3>
          {notesDirty && (
            <button onClick={onSaveNotes} disabled={savingNotes} className="btn-secondary text-xs">
              {savingNotes ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Notes
            </button>
          )}
        </div>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          className="input-field h-24 resize-y"
          placeholder="Add investigation notes..."
        />
      </div>

      {/* Findings */}
      <div className="card p-6">
        <h3 className="mb-4 text-sm font-semibold text-slate-200">Threat Findings ({findings.length})</h3>
        <div className="space-y-3">
          {findings.map((f, i) => (
            <div
              key={i}
              className={`rounded-lg border p-4 ${
                f.severity === 'critical' ? 'border-red-900/40 bg-red-950/10'
                : f.severity === 'warning' ? 'border-amber-900/40 bg-amber-950/10'
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
                    {f.weight > 0 && <span>+{f.weight} points</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-sm p-6 animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                <Trash2 size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-200">Delete this case?</h3>
                <p className="text-sm text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={onCancelDelete} className="btn-secondary">Cancel</button>
              <button onClick={onConfirmDelete} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ForensicReport({ caseRecord, onBack }: { caseRecord: CaseRecord; onBack: () => void }) {
  const findings = caseRecord.findings || [];
  const reportDate = new Date().toLocaleString();

  return (
    <div className="space-y-6">
      <div className="no-print flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
          <ArrowLeft size={16} /> Back to Case
        </button>
        <button onClick={() => window.print()} className="btn-primary">
          <FileText size={16} /> Print / Save PDF
        </button>
      </div>

      {/* Report content */}
      <div className="card p-8 space-y-6">
        {/* Header */}
        <div className="border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10">
              <ShieldCheck size={22} className="text-teal-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">SentinelMail Forensic Report</h1>
              <p className="text-xs uppercase tracking-wider text-slate-500">Email Threat Intelligence Platform</p>
            </div>
          </div>
        </div>

        {/* Case info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Case Title</p>
            <p className="mt-1 font-medium text-slate-200">{caseRecord.title}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Report Generated</p>
            <p className="mt-1 text-slate-300">{reportDate}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Threat Score</p>
            <p className="mt-1 font-bold text-slate-200">{caseRecord.threat_score} / 100</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Threat Level</p>
            <div className="mt-1">
              <ThreatLevelBadge level={caseRecord.threat_level} />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Sender</p>
            <p className="mt-1 text-slate-300">{caseRecord.sender_email || '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Recipient</p>
            <p className="mt-1 text-slate-300">{caseRecord.recipient_email || '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Subject</p>
            <p className="mt-1 text-slate-300">{caseRecord.subject || '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Case Created</p>
            <p className="mt-1 text-slate-300">{new Date(caseRecord.created_at).toLocaleString()}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs uppercase tracking-wider text-slate-500">Content Hash (SHA-256)</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-400">{caseRecord.content_hash}</p>
          </div>
        </div>

        {/* Findings */}
        <div className="border-t border-slate-800 pt-6">
          <h2 className="mb-4 text-base font-semibold text-slate-200">Threat Findings</h2>
          <div className="space-y-3">
            {findings.map((f, i) => (
              <div key={i} className="rounded-lg border border-slate-800 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">#{i + 1}</span>
                  <SeverityBadge severity={f.severity} />
                  <h4 className="text-sm font-medium text-slate-200">{f.title}</h4>
                </div>
                <p className="mt-1.5 text-sm text-slate-400">{f.description}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <span className="rounded bg-slate-800 px-1.5 py-0.5">{f.category}</span>
                  {f.weight > 0 && <span>+{f.weight} points</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Received hops */}
        {caseRecord.received_hops && caseRecord.received_hops.length > 0 && (
          <div className="border-t border-slate-800 pt-6">
            <h2 className="mb-4 text-base font-semibold text-slate-200">Email Path (Received Hops)</h2>
            <div className="space-y-2">
              {caseRecord.received_hops.map((hop, i) => (
                <div key={i} className="rounded-lg border border-slate-800 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500/10 text-xs font-bold text-teal-400">
                      {i + 1}
                    </span>
                    <span className="text-slate-300">
                      {hop.from && <span>From <span className="font-mono text-teal-400">{hop.from}</span> </span>}
                      {hop.by && <span>via <span className="font-mono text-teal-400">{hop.by}</span></span>}
                    </span>
                  </div>
                  <div className="mt-1 ml-7 space-y-0.5 text-xs text-slate-500">
                    {hop.ip && <p>IP: <span className="font-mono text-amber-400">{hop.ip}</span></p>}
                    {hop.with && <p>Protocol: {hop.with}</p>}
                    {hop.timestamp && <p>Time: {hop.timestamp}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Extracted links */}
        {caseRecord.extracted_links && caseRecord.extracted_links.length > 0 && (
          <div className="border-t border-slate-800 pt-6">
            <h2 className="mb-4 text-base font-semibold text-slate-200">Extracted Links</h2>
            <div className="space-y-2">
              {caseRecord.extracted_links.map((link, i) => (
                <div key={i} className="rounded-lg border border-slate-800 p-3">
                  <p className="break-all font-mono text-xs text-slate-300">{link.url}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {link.isIpBased && <span className="badge badge-critical">IP URL</span>}
                    {link.isShortened && <span className="badge badge-warning">Shortened</span>}
                    {link.isLookalike && <span className="badge badge-critical">Lookalike</span>}
                    {!link.isIpBased && !link.isShortened && !link.isLookalike && (
                      <span className="badge badge-clean">OK</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Extracted IPs */}
        {caseRecord.extracted_ips && caseRecord.extracted_ips.length > 0 && (
          <div className="border-t border-slate-800 pt-6">
            <h2 className="mb-4 text-base font-semibold text-slate-200">Extracted IP Addresses</h2>
            <div className="flex flex-wrap gap-2">
              {caseRecord.extracted_ips.map((ip, i) => (
                <span key={i} className="rounded-lg border border-slate-700 bg-slate-800/30 px-3 py-1.5 font-mono text-xs text-amber-400">
                  {ip}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Analyst notes */}
        {caseRecord.notes && (
          <div className="border-t border-slate-800 pt-6">
            <h2 className="mb-4 text-base font-semibold text-slate-200">Analyst Notes</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-400">{caseRecord.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-800 pt-4 text-center text-xs text-slate-600">
          <p>This report was generated by SentinelMail Forensic Intelligence Platform.</p>
          <p className="mt-1">The content hash serves as a tamper-evident seal. Any modification to the original email will produce a different hash.</p>
        </div>
      </div>
    </div>
  );
}

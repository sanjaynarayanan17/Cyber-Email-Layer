import { useEffect, useState } from 'react';
import {
  Inbox as InboxIcon, MailOpen, ShieldCheck, AlertTriangle, ShieldAlert,
  Search, Clock, MailSearch, Trash2, Server, Link2, MapPin,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { EmailLog } from '@/lib/types';
import { ThreatLevelBadge } from '@/components/Badges';
import type { View } from '@/components/NavBar';

export function Inbox({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<EmailLog | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'clean' | 'suspicious' | 'malicious'>('all');

  useEffect(() => {
    loadEmails();
  }, []);

  const loadEmails = async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (err) throw new Error(err.message);
      setLogs((data || []) as EmailLog[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('email_logs').delete().eq('id', id);
      setLogs(logs.filter((l) => l.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const filtered = logs.filter((l) => {
    const matchesSearch = !search ||
      l.subject.toLowerCase().includes(search.toLowerCase()) ||
      l.sender_email.toLowerCase().includes(search.toLowerCase()) ||
      l.sender_domain.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || l.threat_level === filter;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-teal-500" />
      </div>
    );
  }

  if (error) {
    return <div className="card p-6 text-center text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Email Inbox</h2>
          <p className="mt-1 text-sm text-slate-400">
            Browse and read analyzed emails. Click any email to view its full content and threat details.
          </p>
        </div>
        <button onClick={() => onNavigate('analyze')} className="btn-secondary">
          <MailSearch size={16} /> Analyze New Email
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        {/* Email list */}
        <div className="card flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          {/* Search + filter */}
          <div className="border-b border-slate-800 p-3 space-y-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search emails..."
                className="input-field pl-10 text-sm"
              />
            </div>
            <div className="flex gap-1">
              {(['all', 'clean', 'suspicious', 'malicious'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium capitalize transition-all ${
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

          {/* Email items */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/50">
                  <InboxIcon size={22} className="text-slate-500" />
                </div>
                <p className="text-sm text-slate-400">
                  {logs.length === 0 ? 'No emails in your inbox yet.' : 'No emails match your search.'}
                </p>
                {logs.length === 0 && (
                  <button onClick={() => onNavigate('analyze')} className="btn-primary mt-3 text-xs">
                    <MailSearch size={14} /> Analyze Your First Email
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {filtered.map((log) => (
                  <button
                    key={log.id}
                    onClick={() => setSelected(log)}
                    className={`flex w-full items-start gap-3 p-3 text-left transition-all ${
                      selected?.id === log.id
                        ? 'bg-teal-500/5 border-l-2 border-teal-500'
                        : 'hover:bg-slate-800/30 border-l-2 border-transparent'
                    }`}
                  >
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      log.threat_level === 'malicious' ? 'bg-red-500/10'
                      : log.threat_level === 'suspicious' ? 'bg-amber-500/10'
                      : 'bg-emerald-500/10'
                    }`}>
                      {log.threat_level === 'malicious' ? <ShieldAlert size={18} className="text-red-400" />
                      : log.threat_level === 'suspicious' ? <AlertTriangle size={18} className="text-amber-400" />
                      : <ShieldCheck size={18} className="text-emerald-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-200">
                          {log.sender_email || 'Unknown sender'}
                        </p>
                        <span className="shrink-0 text-[10px] text-slate-500">
                          {new Date(log.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="truncate text-xs text-slate-400 mt-0.5">
                        {log.subject || '(no subject)'}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <ThreatLevelBadge level={log.threat_level} />
                        <span className="text-xs font-bold text-slate-500">{log.threat_score}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Reading pane */}
        <div className="card overflow-hidden" style={{ maxHeight: 'calc(100vh - 220px)' }}>
          {!selected ? (
            <div className="flex h-full flex-col items-center justify-center py-20">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/50">
                <MailOpen size={28} className="text-slate-500" />
              </div>
              <p className="text-slate-400">Select an email to read</p>
              <p className="mt-1 text-sm text-slate-500">
                Emails you analyze will appear here for reading and review.
              </p>
            </div>
          ) : (
            <EmailReader log={selected} onDelete={handleDelete} onNavigate={onNavigate} />
          )}
        </div>
      </div>
    </div>
  );
}

function EmailReader({
  log, onDelete, onNavigate,
}: {
  log: EmailLog;
  onDelete: (id: string) => void;
  onNavigate: (view: View) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-slate-800 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-slate-100">
              {log.subject || '(no subject)'}
            </h3>
            <div className="mt-2 flex items-center gap-3">
              <ThreatLevelBadge level={log.threat_level} />
              <span className="text-sm font-bold text-slate-400">Score: {log.threat_score}</span>
            </div>
          </div>
          <button
            onClick={() => onDelete(log.id)}
            className="btn-danger shrink-0 text-xs"
            title="Delete email"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Sender info */}
        <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">From</p>
            <p className="mt-0.5 text-slate-300">
              {log.sender_name && <span className="font-medium">{log.sender_name} </span>}
              {log.sender_email && <span className="text-slate-400">&lt;{log.sender_email}&gt;</span>}
              {!log.sender_email && !log.sender_name && <span className="text-slate-500">Unknown</span>}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Date</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-slate-300">
              <Clock size={12} className="text-slate-500" />
              {new Date(log.created_at).toLocaleString()}
            </p>
          </div>
          {log.recipient_email && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">To</p>
              <p className="mt-0.5 text-slate-300">{log.recipient_email}</p>
            </div>
          )}
          {log.sender_domain && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Sender Domain</p>
              <p className="mt-0.5 font-mono text-xs text-teal-400">{log.sender_domain}</p>
            </div>
          )}
        </div>

        {/* Auth chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <AuthChip label="SPF" value={log.spf} />
          <AuthChip label="DKIM" value={log.dkim} />
          <AuthChip label="DMARC" value={log.dmarc} />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Email Body</h4>
        {log.body ? (
          <pre className="whitespace-pre-wrap break-words rounded-lg border border-slate-800 bg-slate-800/20 p-4 text-sm text-slate-300 font-sans leading-relaxed">
            {log.body}
          </pre>
        ) : (
          <p className="text-sm text-slate-500">No body content was extracted from this email.</p>
        )}

        {/* Quick stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBox label="Findings" value={log.findings_count} />
          <StatBox label="Critical" value={log.critical_count} color="text-red-400" />
          <StatBox label="Warnings" value={log.warning_count} color="text-amber-400" />
          <StatBox label="Score" value={log.threat_score} color="text-teal-400" />
        </div>

        {/* IPs */}
        {log.extracted_ips && log.extracted_ips.length > 0 && (
          <div className="mt-6">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <MapPin size={12} /> Extracted IPs
            </h4>
            <div className="flex flex-wrap gap-2">
              {log.extracted_ips.map((ip, i) => (
                <span key={i} className="rounded-lg border border-slate-700 bg-slate-800/30 px-3 py-1.5 font-mono text-xs text-amber-400">
                  {ip}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Links */}
        {log.extracted_links && log.extracted_links.length > 0 && (
          <div className="mt-6">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Link2 size={12} /> Extracted Links
            </h4>
            <div className="space-y-1.5">
              {log.extracted_links.map((link, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-800/20 p-2.5">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-300">{link.url}</span>
                  <div className="flex shrink-0 gap-1">
                    {link.isIpBased && <span className="badge badge-critical text-[10px]">IP</span>}
                    {link.isShortened && <span className="badge badge-warning text-[10px]">Short</span>}
                    {link.isLookalike && <span className="badge badge-critical text-[10px]">Fake</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Raw email */}
        {log.raw_email && (
          <div className="mt-6">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Server size={12} /> Raw Email Source
            </h4>
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-xs text-slate-400 font-mono leading-relaxed">
              {log.raw_email}
            </pre>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button onClick={() => onNavigate('analyze')} className="btn-secondary text-xs">
            <MailSearch size={14} /> Analyze Another
          </button>
        </div>
      </div>
    </div>
  );
}

function AuthChip({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  const isPass = value === 'pass';
  const isFail = value === 'fail' || value === 'softfail' || value === 'permerror';
  const color = isPass ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10'
    : isFail ? 'text-red-400 border-red-500/20 bg-red-500/10'
    : 'text-slate-400 border-slate-700 bg-slate-700/30';
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-mono ${color}`}>
      {label}={value}
    </span>
  );
}

function StatBox({ label, value, color = 'text-slate-200' }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-800/20 p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

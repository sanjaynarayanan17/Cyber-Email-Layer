import { useEffect, useState } from 'react';
import {
  ShieldCheck, AlertTriangle, ShieldAlert, FolderOpen, MailSearch,
  ArrowRight, Activity, Globe2, Clock, Radio, TrendingUp, Mail,
} from 'lucide-react';
import { getDashboardStats } from '@/lib/cases';
import { getLogStats, listEmailLogs } from '@/lib/emailLogs';
import { supabase } from '@/lib/supabase';
import type { CaseRecord, EmailLog } from '@/lib/types';
import { ThreatLevelBadge } from '@/components/Badges';
import type { View } from '@/components/NavBar';

interface DashboardStats {
  totalCases: number;
  cleanCount: number;
  suspiciousCount: number;
  maliciousCount: number;
  recentCases: CaseRecord[];
}

interface LogStats {
  totalAnalyzed: number;
  cleanCount: number;
  suspiciousCount: number;
  maliciousCount: number;
  avgScore: number;
}

export function Dashboard({ onNavigate }: { onNavigate: (view: View) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [logStats, setLogStats] = useState<LogStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getDashboardStats(), getLogStats(), listEmailLogs(5)])
      .then(([s, ls, logs]) => {
        setStats(s);
        setLogStats(ls);
        setRecentLogs(logs);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Realtime: update feed when new log arrives
  useEffect(() => {
    const channel = supabase
      .channel('dashboard_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'email_logs' },
        (payload) => {
          const newLog = payload.new as EmailLog;
          setRecentLogs((prev) => [newLog, ...prev].slice(0, 5));
          setLogStats((prev) => {
            if (!prev) return prev;
            const total = prev.totalAnalyzed + 1;
            return {
              totalAnalyzed: total,
              cleanCount: prev.cleanCount + (newLog.threat_level === 'clean' ? 1 : 0),
              suspiciousCount: prev.suspiciousCount + (newLog.threat_level === 'suspicious' ? 1 : 0),
              maliciousCount: prev.maliciousCount + (newLog.threat_level === 'malicious' ? 1 : 0),
              avgScore: Math.round((prev.avgScore * prev.totalAnalyzed + newLog.threat_score) / total),
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-teal-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-red-400">Failed to load dashboard data.</p>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero section */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/30 p-8">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-teal-500/5 blur-3xl" />
        <div className="relative">
          <h2 className="text-2xl font-bold text-slate-100">Email Threat Intelligence Dashboard</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Analyze suspicious emails for phishing, spoofing, and malicious content. Trace the
            geographic origin of messages, build forensic cases, and monitor threats in real time.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => onNavigate('analyze')} className="btn-primary">
              <MailSearch size={18} /> Analyze an Email
            </button>
            <button onClick={() => onNavigate('monitor')} className="btn-secondary">
              <Radio size={18} /> Live Monitor
            </button>
            <button onClick={() => onNavigate('map')} className="btn-secondary">
              <Globe2 size={18} /> View Threat Map
            </button>
          </div>
        </div>
      </div>

      {/* Email analysis stats */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Mail size={16} className="text-teal-400" />
          <h3 className="text-sm font-semibold text-slate-200">Email Analysis Overview</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Emails Analyzed</p>
                <p className="mt-2 text-3xl font-bold text-slate-100">{logStats?.totalAnalyzed ?? 0}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-800/50">
                <Mail size={22} className="text-slate-400" />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Avg Threat Score</p>
                <p className="mt-2 text-3xl font-bold text-teal-400">{logStats?.avgScore ?? 0}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-500/10">
                <TrendingUp size={22} className="text-teal-400" />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Clean</p>
                <p className="mt-2 text-3xl font-bold text-emerald-400">{logStats?.cleanCount ?? 0}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10">
                <ShieldCheck size={22} className="text-emerald-400" />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Suspicious</p>
                <p className="mt-2 text-3xl font-bold text-amber-400">{logStats?.suspiciousCount ?? 0}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10">
                <AlertTriangle size={22} className="text-amber-400" />
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">Malicious</p>
                <p className="mt-2 text-3xl font-bold text-red-400">{logStats?.maliciousCount ?? 0}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10">
                <ShieldAlert size={22} className="text-red-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column: Recent logs + Saved cases */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Live feed preview */}
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-teal-400" />
              <h3 className="text-sm font-semibold text-slate-200">Recent Analyses</h3>
              <span className="flex items-center gap-1 text-xs text-teal-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
                </span>
                Live
              </span>
            </div>
            <button onClick={() => onNavigate('monitor')} className="text-xs text-teal-400 hover:text-teal-300">
              View all
            </button>
          </div>

          {recentLogs.length === 0 ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/50">
                <Mail size={22} className="text-slate-500" />
              </div>
              <p className="text-sm text-slate-400">No emails analyzed yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 rounded-lg border border-transparent p-2.5 transition-all hover:border-slate-700 hover:bg-slate-800/30"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    log.threat_level === 'malicious' ? 'bg-red-500/10'
                    : log.threat_level === 'suspicious' ? 'bg-amber-500/10'
                    : 'bg-emerald-500/10'
                  }`}>
                    {log.threat_level === 'malicious' ? <ShieldAlert size={16} className="text-red-400" />
                    : log.threat_level === 'suspicious' ? <AlertTriangle size={16} className="text-amber-400" />
                    : <ShieldCheck size={16} className="text-emerald-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-200">
                      {log.subject || '(no subject)'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {log.sender_email && <span className="truncate">{log.sender_email}</span>}
                      <span className="flex items-center gap-0.5">
                        <Clock size={10} />
                        {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <ThreatLevelBadge level={log.threat_level} />
                    <span className="text-base font-bold text-slate-400">{log.threat_score}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Saved cases */}
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen size={18} className="text-teal-400" />
              <h3 className="text-sm font-semibold text-slate-200">Saved Cases</h3>
            </div>
            <button onClick={() => onNavigate('cases')} className="text-xs text-teal-400 hover:text-teal-300">
              View all
            </button>
          </div>

          {!stats || stats.totalCases === 0 ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/50">
                <FolderOpen size={22} className="text-slate-500" />
              </div>
              <p className="text-sm text-slate-400">No saved cases yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.recentCases.slice(0, 5).map((c) => (
                <button
                  key={c.id}
                  onClick={() => onNavigate('cases')}
                  className="flex w-full items-center justify-between rounded-lg border border-transparent p-2.5 text-left transition-all hover:border-slate-700 hover:bg-slate-800/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-200">{c.title}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                      {c.sender_email && <span className="truncate">{c.sender_email}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ThreatLevelBadge level={c.threat_level} />
                    <span className="text-base font-bold text-slate-400">{c.threat_score}</span>
                    <ArrowRight size={14} className="text-slate-600" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

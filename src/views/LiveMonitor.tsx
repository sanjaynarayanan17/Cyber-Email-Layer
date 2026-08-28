import { useEffect, useState, useRef } from 'react';
import {
  Radio, ShieldCheck, AlertTriangle, ShieldAlert, Mail,
  Clock, TrendingUp, Activity, Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { listEmailLogs, getLogStats } from '@/lib/emailLogs';
import type { EmailLog } from '@/lib/types';
import { ThreatLevelBadge } from '@/components/Badges';

interface LogStats {
  totalAnalyzed: number;
  cleanCount: number;
  suspiciousCount: number;
  maliciousCount: number;
  avgScore: number;
}

export function LiveMonitor() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isLive, setIsLive] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    Promise.all([listEmailLogs(50), getLogStats()])
      .then(([logData, statData]) => {
        setLogs(logData);
        setStats(statData);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!isLive) return;

    const channel = supabase
      .channel('email_logs_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'email_logs' },
        (payload) => {
          const newLog = payload.new as EmailLog;
          setLogs((prev) => [newLog, ...prev].slice(0, 50));
          setNewCount((c) => c + 1);
          setStats((prev) => {
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
  }, [isLive]);

  // Reset new count when user scrolls to top
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = 0;
      setNewCount(0);
    }
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
        <p className="text-red-400">Failed to load live monitor data.</p>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-100">
            Live Email Monitor
            {isLive && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-teal-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
                </span>
                LIVE
              </span>
            )}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Real-time feed of every email analyzed through the platform. New analyses appear here instantly.
          </p>
        </div>
        <button
          onClick={() => setIsLive(!isLive)}
          className={isLive ? 'btn-secondary' : 'btn-primary'}
        >
          {isLive ? <Radio size={16} /> : <Zap size={16} />}
          {isLive ? 'Pause Feed' : 'Resume Feed'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Total Analyzed</p>
              <p className="mt-2 text-3xl font-bold text-slate-100">{stats?.totalAnalyzed ?? 0}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800/50">
              <Mail size={20} className="text-slate-400" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Avg Score</p>
              <p className="mt-2 text-3xl font-bold text-teal-400">{stats?.avgScore ?? 0}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10">
              <TrendingUp size={20} className="text-teal-400" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Clean</p>
              <p className="mt-2 text-3xl font-bold text-emerald-400">{stats?.cleanCount ?? 0}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <ShieldCheck size={20} className="text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Suspicious</p>
              <p className="mt-2 text-3xl font-bold text-amber-400">{stats?.suspiciousCount ?? 0}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <AlertTriangle size={20} className="text-amber-400" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Malicious</p>
              <p className="mt-2 text-3xl font-bold text-red-400">{stats?.maliciousCount ?? 0}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
              <ShieldAlert size={20} className="text-red-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Live feed */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-teal-400" />
            <h3 className="text-sm font-semibold text-slate-200">Live Analysis Feed</h3>
          </div>
          {newCount > 0 && isLive && (
            <span className="flex items-center gap-1.5 text-xs text-teal-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
              </span>
              {newCount} new {newCount === 1 ? 'entry' : 'entries'}
            </span>
          )}
        </div>

        <div ref={feedRef} className="max-h-[600px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/50">
                <Radio size={28} className="text-slate-500" />
              </div>
              <p className="text-slate-400">No emails analyzed yet.</p>
              <p className="mt-1 text-sm text-slate-500">
                Analyze an email and it will appear here in real time.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {logs.map((log, i) => (
                <LogEntry key={log.id} log={log} isNew={i < newCount && isLive} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LogEntry({ log, isNew }: { log: EmailLog; isNew: boolean }) {
  const timeStr = new Date(log.created_at).toLocaleTimeString();
  const dateStr = new Date(log.created_at).toLocaleDateString();

  return (
    <div className={`flex items-start gap-4 p-4 transition-all ${isNew ? 'bg-teal-500/5 animate-fade-in' : ''}`}>
      {/* Threat indicator */}
      <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
        log.threat_level === 'malicious' ? 'bg-red-500/10'
        : log.threat_level === 'suspicious' ? 'bg-amber-500/10'
        : 'bg-emerald-500/10'
      }`}>
        {log.threat_level === 'malicious' ? <ShieldAlert size={20} className="text-red-400" />
        : log.threat_level === 'suspicious' ? <AlertTriangle size={20} className="text-amber-400" />
        : <ShieldCheck size={20} className="text-emerald-400" />}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-slate-200">
            {log.subject || '(no subject)'}
          </p>
          <ThreatLevelBadge level={log.threat_level} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          {log.sender_email && <span className="truncate">{log.sender_email}</span>}
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {dateStr} {timeStr}
          </span>
          <span>Score: <span className="font-mono font-semibold text-slate-400">{log.threat_score}</span></span>
          {log.critical_count > 0 && (
            <span className="text-red-400">{log.critical_count} critical</span>
          )}
          {log.warning_count > 0 && (
            <span className="text-amber-400">{log.warning_count} warnings</span>
          )}
          {log.extracted_ips && log.extracted_ips.length > 0 && (
            <span>{log.extracted_ips.length} IPs</span>
          )}
          {log.extracted_links && log.extracted_links.length > 0 && (
            <span>{log.extracted_links.length} links</span>
          )}
        </div>
        {/* Auth chips */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <AuthMiniChip label="SPF" value={log.spf} />
          <AuthMiniChip label="DKIM" value={log.dkim} />
          <AuthMiniChip label="DMARC" value={log.dmarc} />
        </div>
      </div>

      {/* Score badge */}
      <div className="shrink-0 text-right">
        <p className={`text-2xl font-bold ${
          log.threat_level === 'malicious' ? 'text-red-400'
          : log.threat_level === 'suspicious' ? 'text-amber-400'
          : 'text-emerald-400'
        }`}>
          {log.threat_score}
        </p>
      </div>
    </div>
  );
}

function AuthMiniChip({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  const isPass = value === 'pass';
  const isFail = value === 'fail' || value === 'softfail' || value === 'permerror';
  const color = isPass ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    : isFail ? 'text-red-400 bg-red-500/10 border-red-500/20'
    : 'text-slate-400 bg-slate-700/30 border-slate-700';

  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono ${color}`}>
      {label}={value}
    </span>
  );
}

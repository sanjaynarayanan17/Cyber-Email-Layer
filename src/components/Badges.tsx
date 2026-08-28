import { ShieldCheck, AlertTriangle, ShieldAlert, Info, ShieldX } from 'lucide-react';

export function SeverityIcon({ severity, className = '' }: { severity: string; className?: string }) {
  switch (severity) {
    case 'critical':
      return <ShieldX className={className} size={16} />;
    case 'warning':
      return <AlertTriangle className={className} size={16} />;
    case 'info':
      return <Info className={className} size={16} />;
    default:
      return <Info className={className} size={16} />;
  }
}

export function ThreatLevelBadge({ level, className = '' }: { level: 'clean' | 'suspicious' | 'malicious'; className?: string }) {
  switch (level) {
    case 'clean':
      return (
        <span className={`badge badge-clean ${className}`}>
          <ShieldCheck size={14} /> Clean
        </span>
      );
    case 'suspicious':
      return (
        <span className={`badge badge-suspicious ${className}`}>
          <AlertTriangle size={14} /> Suspicious
        </span>
      );
    case 'malicious':
      return (
        <span className={`badge badge-malicious ${className}`}>
          <ShieldAlert size={14} /> Malicious
        </span>
      );
  }
}

export function SeverityBadge({ severity }: { severity: 'info' | 'warning' | 'critical' }) {
  switch (severity) {
    case 'critical':
      return <span className="badge badge-critical">Critical</span>;
    case 'warning':
      return <span className="badge badge-warning">Warning</span>;
    case 'info':
      return <span className="badge badge-info">Info</span>;
  }
}

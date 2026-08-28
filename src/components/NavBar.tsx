import { Shield, LayoutDashboard, MailSearch, Globe2, FolderOpen, Radio } from 'lucide-react';

export type View = 'dashboard' | 'analyze' | 'monitor' | 'map' | 'cases';

interface NavBarProps {
  currentView: View;
  onNavigate: (view: View) => void;
}

const navItems: { id: View; label: string; icon: typeof Shield }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'analyze', label: 'Analyze Email', icon: MailSearch },
  { id: 'monitor', label: 'Live Monitor', icon: Radio },
  { id: 'map', label: 'Threat Map', icon: Globe2 },
  { id: 'cases', label: 'Cases', icon: FolderOpen },
];

export function NavBar({ currentView, onNavigate }: NavBarProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-600">
            <Shield size={20} className="text-slate-950" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100">SentinelMail</h1>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Forensic Intelligence</p>
          </div>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                  active
                    ? 'bg-teal-500/10 text-teal-400'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Mobile nav */}
        <nav className="flex items-center gap-1 md:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
                  active
                    ? 'bg-teal-500/10 text-teal-400'
                    : 'text-slate-400 hover:bg-slate-800/50'
                }`}
                title={item.label}
              >
                <Icon size={18} />
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

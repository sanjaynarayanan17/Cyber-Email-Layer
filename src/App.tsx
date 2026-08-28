import { useState } from 'react';
import { NavBar } from '@/components/NavBar';
import type { View } from '@/components/NavBar';
import { Dashboard } from '@/views/Dashboard';
import { Analyzer } from '@/views/Analyzer';
import { LiveMonitor } from '@/views/LiveMonitor';
import { ThreatMap } from '@/views/ThreatMap';
import { Cases } from '@/views/Cases';

function App() {
  const [view, setView] = useState<View>('dashboard');

  return (
    <div className="min-h-screen bg-slate-950">
      <NavBar currentView={view} onNavigate={setView} />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {view === 'dashboard' && <Dashboard onNavigate={setView} />}
        {view === 'analyze' && <Analyzer onNavigate={setView} />}
        {view === 'monitor' && <LiveMonitor />}
        {view === 'map' && <ThreatMap />}
        {view === 'cases' && <Cases onNavigate={setView} />}
      </main>
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-600">
        SentinelMail — Email Threat Detection, GeoLocation & Forensic Intelligence Platform
      </footer>
    </div>
  );
}

export default App;
